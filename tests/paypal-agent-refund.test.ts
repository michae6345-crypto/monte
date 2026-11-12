// "Return the Trader Joe's purchase": the checkout agent proposes a refund and never makes one.
// Claude and PayPal's capture lookup are mocked. Expected numbers by hand from data/cards.json:
// Amex Gold, groceries, 4x at 1c, $84 captured -> $3.36 earned.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import type { Txn } from "@/lib/engine";
import { JORDAN } from "@/lib/data/personas";
import { explainRefund, proposeRefund, runCheckoutAgent, type CreateMessage, type SessionCapture } from "@/lib/paypal/agent";
import { confirmAgentRefund, refundProposalLine, rememberCapture } from "@/lib/paypal/agent-refund-client";
import { DEMO_TAP_DATE } from "@/lib/paypal/plan";
import { POST as agentRoute } from "@/app/api/paypal/agent/route";

type Message = Anthropic.Beta.Messages.BetaMessage;
type Sent = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
const message = (content: unknown[], stop_reason = "end_turn") => ({ id: "m", type: "message", role: "assistant", model: "mock", content, stop_reason, stop_sequence: null, usage: {} }) as unknown as Message;
const toolCall = (name: string, input: object, id = name) => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

function script(...replies: Message[]) {
  const sent: Sent[] = [];
  const create: CreateMessage = async (params) => {
    sent.push(structuredClone(params));
    const next = replies.shift();
    assert.ok(next, "Claude was called more times than scripted");
    return next;
  };
  return { sent, create };
}
const toolResult = (sent: Sent[], turn: number) => {
  const last = sent[turn].messages[sent[turn].messages.length - 1];
  return (last.content as Anthropic.Beta.Messages.BetaToolResultBlockParam[])[0];
};

const TJ: Txn = { id: "paypal-CAPTURE9", date: DEMO_TAP_DATE, merchant: "Trader Joe's", amount: 84, category: "groceries", cardUsed: "amex_gold" };
const CAPTURES: SessionCapture[] = [
  { captureId: "CAPTURE9", merchant: "Trader Joe's", amount: "84.00" },
  { captureId: "CAPTURE8", merchant: "Shell", amount: "40.00" },
];
const context = () => ({ wallet: JORDAN.wallet, history: [], valuation: "cash" as const, date: DEMO_TAP_DATE });
const noOrder = async () => assert.fail("a refund must never create an order");
/** PayPal's record: only CAPTURE9 is a refundable Monte order. */
const lookups: string[] = [];
const lookupCapture = async (id: string) => {
  lookups.push(id);
  return id === "CAPTURE9" ? TJ : null;
};
beforeEach(() => {
  lookups.length = 0;
});

async function run(said: string, replies: Message[], captures = CAPTURES) {
  const { sent, create } = script(...replies);
  const out = await runCheckoutAgent({ chat: [{ role: "user", text: said }], context: context(), createOrder: noOrder, createMessage: create, captures, lookupCapture });
  return { out, sent };
}

// ---------- the math ----------

test("proposeRefund: full and partial refunds priced by the rollback", () => {
  const full = proposeRefund(TJ, "CAPTURE9", 84);
  assert.deepEqual(full, {
    captureId: "CAPTURE9",
    merchant: "Trader Joe's",
    amount: "84.00",
    full: true,
    cardId: "amex_gold",
    card: "American Express Gold Card",
    category: "groceries",
    capBack: 84,
    rewardsReversed: 3.36,
  });
  const part = proposeRefund(TJ, "CAPTURE9", 21);
  assert.equal(part.amount, "21.00");
  assert.equal(part.full, false);
  assert.equal(part.capBack, 21);
  assert.equal(part.rewardsReversed, 0.84); // 3.36 x 21/84
  assert.match(explainRefund(part), /\$21\.00.*\$21\.00 of cap room.*\$0\.84/);
});

// ---------- the agent ----------

test("agent: 'return the Trader Joe's purchase' proposes the full refund and refunds nothing", async () => {
  const reply = "Ready to refund $84.00 at Trader Joe's on American Express Gold Card: $84.00 of cap room back and $3.36 of rewards reversed. Nothing is refunded until you confirm.";
  const { out, sent } = await run("Return the Trader Joe's purchase", [message([toolCall("propose_refund", { capture_id: "CAPTURE9" })], "tool_use"), message([text(reply)])]);

  assert.equal(out.proposal?.captureId, "CAPTURE9");
  assert.equal(out.proposal?.amount, "84.00");
  assert.equal(out.proposal?.capBack, 84);
  assert.equal(out.proposal?.rewardsReversed, 3.36);
  assert.equal(out.reply, reply);
  assert.equal(out.replyChecked, true);
  assert.equal(out.order, null);
  assert.deepEqual(lookups, ["CAPTURE9"]);
  const result = JSON.parse(String(toolResult(sent, 1).content));
  assert.equal(result.refunded, false);
  assert.equal(result.cap_room_back, "$84.00");
  // the session's captures are in the prompt, and the tool is there to call
  assert.match(String(sent[0].system), /"capture_id":"CAPTURE9"/);
  assert.ok(sent[0].tools?.some((t) => "name" in t && t.name === "propose_refund"));
});

test("agent: 'refund $21 of that' proposes a partial refund priced by the engine", async () => {
  const { out } = await run("Refund $21 of the Trader Joe's one", [message([toolCall("propose_refund", { capture_id: "CAPTURE9", amount: 21 })], "tool_use"), message([text("")])]);
  assert.equal(out.proposal?.amount, "21.00");
  assert.equal(out.proposal?.rewardsReversed, 0.84);
  assert.equal(out.replyChecked, false);
  assert.equal(out.reply, explainRefund(out.proposal!));
});

test("agent: an amount the person never typed is refused (unless it's the full capture)", async () => {
  const { out, sent } = await run("Return the Trader Joe's purchase", [message([toolCall("propose_refund", { capture_id: "CAPTURE9", amount: 20 })], "tool_use"), message([text("How much should I refund?")])]);
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.proposal, null);

  const full = await run("Return the Trader Joe's purchase", [message([toolCall("propose_refund", { capture_id: "CAPTURE9", amount: 84 })], "tool_use"), message([text("")])]);
  assert.equal(full.out.proposal?.amount, "84.00");
});

test("agent: more than was captured is refused", async () => {
  const { out, sent } = await run("Refund $90 of Trader Joe's", [message([toolCall("propose_refund", { capture_id: "CAPTURE9", amount: 90 })], "tool_use"), message([text("That's more than you paid.")])]);
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.proposal, null);
});

test("agent: an invented capture id never reaches PayPal", async () => {
  const { out, sent } = await run("Return the Trader Joe's purchase", [message([toolCall("propose_refund", { capture_id: "MADEUP123" })], "tool_use"), message([text("Which purchase?")])]);
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.deepEqual(lookups, []);
  assert.equal(out.proposal, null);
});

test("agent: no id is only fine when there's exactly one capture", async () => {
  const two = await run("Return it", [message([toolCall("propose_refund", {})], "tool_use"), message([text("Which one?")])]);
  assert.equal(two.out.proposal, null);
  assert.deepEqual(lookups, []);
  const one = await run("Return it", [message([toolCall("propose_refund", {})], "tool_use"), message([text("")])], [CAPTURES[0]]);
  assert.equal(one.out.proposal?.captureId, "CAPTURE9");
});

test("agent: a capture PayPal says isn't refundable gets no proposal", async () => {
  const { out, sent } = await run("Return the Shell purchase", [message([toolCall("propose_refund", { capture_id: "CAPTURE8" })], "tool_use"), message([text("That one can't be refunded.")])]);
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.proposal, null);
});

test("agent: without session captures nothing can be proposed", async () => {
  const { out, sent } = await run("Return the Trader Joe's purchase", [message([toolCall("propose_refund", { capture_id: "CAPTURE9" })], "tool_use"), message([text("No purchases to return.")])], []);
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.proposal, null);
  assert.doesNotMatch(String(sent[0].system), /Recent purchases/);
});

test("agent: a reply with a number the tools never gave is replaced by the engine's words", async () => {
  const { out } = await run("Return the Trader Joe's purchase", [
    message([toolCall("propose_refund", { capture_id: "CAPTURE9" })], "tool_use"),
    message([text("Refunding $84.00 on American Express Gold Card; you'll lose about $4 a year.")]),
  ]);
  assert.equal(out.replyChecked, false);
  assert.equal(out.reply, explainRefund(out.proposal!));
});

// ---------- the browser helper ----------

test("client: confirm sends exactly the proposed capture and amount to /api/paypal/refund", async () => {
  const p = proposeRefund(TJ, "CAPTURE9", 21);
  let seen: { url: string; body: Record<string, unknown> } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({ status: "COMPLETED", refunded: "21.00", txnId: "paypal-CAPTURE9" }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await confirmAgentRefund(p, { requestId: "req-12345678", fetchImpl });
  assert.equal(r.refunded, "21.00");
  assert.deepEqual(seen, { url: "/api/paypal/refund", body: { captureId: "CAPTURE9", amount: "21.00", requestId: "req-12345678" } });

  const failing = (async () => new Response(JSON.stringify({ error: "already_refunded" }), { status: 409 })) as unknown as typeof fetch;
  await assert.rejects(confirmAgentRefund(p, { fetchImpl: failing }), /already_refunded/);
  assert.equal(refundProposalLine(p), "Refund $21.00 at Trader Joe's on American Express Gold Card: $21.00 of cap room back, $0.84 of rewards reversed.");
  assert.deepEqual(rememberCapture(CAPTURES, CAPTURES[1]).map((c) => c.captureId), ["CAPTURE8", "CAPTURE9"]);
});

// ---------- the route ----------

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "ANTHROPIC_API_KEY"] as const;
let saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});

test("route: malformed captures are a 400 before Claude or PayPal is called", async () => {
  process.env.PAYPAL_CLIENT_ID = "sb-client-refund-agent";
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  globalThis.fetch = (async () => assert.fail("nothing should be fetched")) as typeof fetch;
  const body = (captures: unknown) => ({ messages: [{ role: "user", text: "Return the Trader Joe's purchase" }], wallet: JORDAN.wallet, history: [], date: DEMO_TAP_DATE, captures });
  for (const bad of ["x", [{ captureId: "no spaces!", merchant: "TJ", amount: "84.00" }], [{ captureId: "CAPTURE9", merchant: "TJ", amount: "-1" }], Array(11).fill(CAPTURES[0])]) {
    const res = await agentRoute(new Request("http://localhost/api/paypal/agent", { method: "POST", headers: { "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify(body(bad)) }));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});
