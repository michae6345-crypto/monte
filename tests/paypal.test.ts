// PayPal + AI: purchase -> ranked card -> order amount -> capture -> cap counter, with PayPal
// and Claude mocked. Every expected number is worked out by hand from data/cards.json.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { tap, type Holding, type Txn } from "@/lib/engine";
import { JORDAN, PERSONAS, yearOf } from "@/lib/data/personas";
import { spotsFor } from "@/components/ace/spots";
import { runCheckoutAgent, type CreateMessage } from "@/lib/paypal/agent";
import { PAYPAL_API } from "@/lib/paypal/client";
import { persistCapture } from "@/lib/paypal/persist";
import { capMoveLine, capRoomLine, capturedTxn, decodeOrderRef, DEMO_TAP_DATE, encodeOrderRef, explainPlan, orderValue, planCheckout, type Purchase } from "@/lib/paypal/plan";
import { POST as createOrderRoute } from "@/app/api/paypal/create-order/route";
import { POST as captureOrderRoute } from "@/app/api/paypal/capture-order/route";
import { POST as agentRoute } from "@/app/api/paypal/agent/route";

const TJ: Purchase = { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE };
const jordanYear = () => yearOf(JORDAN).filter((t) => t.date.startsWith("2026") && t.date <= DEMO_TAP_DATE);
const cents = (n: number) => Math.round(n * 100) / 100;

// ---------- the plan: what the engine says ----------

test("orderValue: two decimals for PayPal, and null for what can't be an order", () => {
  assert.equal(orderValue(84), "84.00");
  assert.equal(orderValue(64.2), "64.20");
  assert.equal(orderValue(0.01), "0.01");
  for (const bad of [0, -5, 1.234, 10000.01, NaN, Infinity, "84", null]) assert.equal(orderValue(bad), null, String(bad));
});

test("Jordan at Trader Joe's: Amex Gold, 4x on groceries, and the balance card is out", () => {
  const plan = planCheckout(JORDAN.wallet, TJ, jordanYear());
  assert.equal(plan.pick?.cardId, "amex_gold");
  assert.equal(cents(plan.pick!.reward), 3.36); // $84 x 4 x 1c
  assert.equal(plan.orderValue, "84.00");
  assert.match(plan.pick!.rule, /^4x groceries \(cap \$25,000\/year\)/);
  assert.equal(plan.ranked.find((r) => r.cardId === "apple_card")?.blocked?.includes("$2,800"), true);
  assert.notEqual(plan.pick!.cardId, "apple_card");
  assert.deepEqual(
    { cap: plan.capRoom?.cap, period: plan.capRoom?.period, used: plan.capRoom?.usedBefore, left: plan.capRoom?.leftAfter },
    { cap: 25000, period: "year", used: 0, left: 24916 },
  );
  assert.equal(capRoomLine(plan.capRoom!), "$24,916.00 of $25,000 left this year after this purchase");
});

test("every ranked line carries its provenance back to the issuer's page", () => {
  for (const r of planCheckout(JORDAN.wallet, TJ, jordanYear()).ranked) {
    assert.match(r.citation, /https?:\/\//, r.cardId);
    assert.match(r.citation, /checked \d{4}-\d{2}-\d{2}/, r.cardId);
    assert.ok(r.math.includes("$84.00"), r.cardId);
  }
});

test("a card with a balance is never the pick, even when it would earn the most", () => {
  const wallet: Holding[] = [{ cardId: "amex_gold", balance: 500, apr: 25 }, { cardId: "chase_freedom_unlimited" }];
  const plan = planCheckout(wallet, TJ, []);
  assert.equal(plan.ranked[0].cardId, "amex_gold");
  assert.ok(plan.ranked[0].blocked);
  assert.equal(plan.pick?.cardId, "chase_freedom_unlimited");
});

test("when every card carries a balance, Monte recommends nothing", () => {
  const plan = planCheckout([{ cardId: "amex_gold", balance: 500 }, { cardId: "apple_card", balance: 100 }], TJ, []);
  assert.equal(plan.pick, null);
  assert.equal(plan.capRoom, null);
  assert.match(explainPlan(plan), /won't recommend/);
  assert.throws(() => encodeOrderRef(plan));
});

test("a purchase that crosses a cap earns the blended rate and leaves no room", () => {
  const used: Txn = { id: "h", date: "2026-03-01", merchant: "Ralphs", amount: 24950, category: "groceries", cardUsed: "amex_gold" };
  const plan = planCheckout([{ cardId: "amex_gold" }], { ...TJ, amount: 100 }, [used]);
  assert.equal(cents(plan.pick!.reward), 2.5); // $50 at 4x + $50 at 1x
  assert.deepEqual([plan.capRoom?.leftBefore, plan.capRoom?.thisPurchase, plan.capRoom?.leftAfter], [50, 50, 0]);
});

test("the panel and the phone in the Tap view agree for every demo person and store", () => {
  const BASE = [
    { merchant: "Sweetgreen", category: "dining", amount: 16.5, where: "" },
    { merchant: "Trader Joe's", category: "groceries", amount: 64.2, where: "" },
    { merchant: "Mobil", category: "gas", amount: 52, where: "" },
    { merchant: "Uber", category: "rideshare", amount: 22.4, where: "" },
    { merchant: "Netflix", category: "streaming", amount: 15.49, where: "" },
    { merchant: "Delta", category: "airfare", amount: 318, where: "" },
    { merchant: "CVS Pharmacy", category: "drugstores", amount: 23.8, where: "" },
    { merchant: "AMC Theatres", category: "entertainment", amount: 34, where: "" },
  ];
  for (const p of PERSONAS) {
    const year = yearOf(p);
    const soFar = year.filter((t) => t.date.startsWith("2026") && t.date <= DEMO_TAP_DATE);
    for (const s of spotsFor(BASE, year, "")) {
      const purchase = { merchant: s.merchant, category: s.category, amount: s.amount, date: DEMO_TAP_DATE };
      const phone = tap(p.wallet, purchase, year.filter((t) => t.date >= "2026-10-01"));
      const plan = planCheckout(p.wallet, purchase, soFar);
      assert.equal(plan.pick?.cardId, phone.pick.cardId, `${p.id} at ${s.merchant}`);
      assert.equal(cents(plan.pick!.reward), cents(phone.pick.reward), `${p.id} at ${s.merchant}`);
    }
  }
});

test("what an order remembers survives the trip, even with a | in the store's name", () => {
  const plan = planCheckout(JORDAN.wallet, { ...TJ, merchant: "A|B Market" }, []);
  const encoded = encodeOrderRef(plan);
  assert.ok(encoded.length <= 127);
  assert.deepEqual(decodeOrderRef(encoded), { cardId: "amex_gold", category: "groceries", date: DEMO_TAP_DATE, merchant: "A|B Market" });
  for (const bad of [null, undefined, "", "somebody else's order", "v0|a|b|c|d"]) assert.equal(decodeOrderRef(bad), null);
});

// ---------- the routes, with PayPal mocked ----------

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "ANTHROPIC_API_KEY"] as const;
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};
let calls: { url: string; init: RequestInit }[] = [];
let clientCount = 0;

type Reply = { status?: number; body: unknown };
/** Answers OAuth itself; `order` answers everything else. */
function mockPayPal(order: (url: string, init: RequestInit) => Reply) {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const reply: Reply = url.endsWith("/v1/oauth2/token") ? { body: { access_token: "sandbox-token", token_type: "Bearer", expires_in: 32400 } } : order(url, init);
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as typeof fetch;
}

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  calls = [];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});
function setKeys() {
  // a fresh id each time, so the cached token from another test can't hide the OAuth call
  process.env.PAYPAL_CLIENT_ID = `sb-client-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
}

const request = (body: unknown) => new Request("http://localhost/api/paypal/x", { method: "POST", body: JSON.stringify(body) });
const checkoutBody = (over: object = {}) => ({ purchase: { merchant: TJ.merchant, category: TJ.category, amount: TJ.amount }, wallet: JORDAN.wallet, history: jordanYear(), date: TJ.date, ...over });
const completed = (customId: string, value: string) => ({
  id: "ORDER123",
  status: "COMPLETED",
  purchase_units: [{ reference_id: "monte", payments: { captures: [{ id: "CAPTURE9", status: "COMPLETED", custom_id: customId, amount: { currency_code: "USD", value } }] } }],
});

test("without keys every PayPal route answers 503 paypal_not_configured and calls nothing", async () => {
  mockPayPal(() => assert.fail("should not reach PayPal"));
  for (const route of [createOrderRoute, captureOrderRoute, agentRoute]) {
    const res = await route(request({}));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "paypal_not_configured" });
  }
  assert.equal(calls.length, 0);
});

test("anything but the sandbox counts as not configured", async () => {
  setKeys();
  process.env.PAYPAL_ENV = "live";
  mockPayPal(() => assert.fail("should not reach PayPal"));
  assert.equal((await createOrderRoute(request(checkoutBody()))).status, 503);
  assert.equal(calls.length, 0);
});

test("purchase -> ranked card -> order for exactly that amount, on the sandbox", async () => {
  setKeys();
  mockPayPal(() => ({ status: 201, body: { id: "ORDER123", status: "CREATED" } }));
  const res = await createOrderRoute(request(checkoutBody()));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.id, "ORDER123");
  assert.equal(data.plan.pick.cardId, "amex_gold");

  assert.equal(calls[0].url, `${PAYPAL_API}/v1/oauth2/token`);
  assert.equal(calls[0].init.body, "grant_type=client_credentials");
  assert.match(String((calls[0].init.headers as Record<string, string>).authorization), /^Basic /);
  assert.equal(calls[1].url, "https://api-m.sandbox.paypal.com/v2/checkout/orders");
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, "Bearer sandbox-token");
  const body = JSON.parse(String(calls[1].init.body));
  assert.equal(body.intent, "CAPTURE");
  assert.deepEqual(body.purchase_units[0].amount, { currency_code: "USD", value: "84.00" });
  assert.equal(decodeOrderRef(body.purchase_units[0].custom_id)?.cardId, "amex_gold");
});

test("bad checkouts are refused before PayPal hears about them", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const cases = [
    checkoutBody({ wallet: [{ cardId: "not_a_card" }] }),
    checkoutBody({ wallet: [] }),
    checkoutBody({ purchase: { merchant: "X", category: "groceries", amount: 1.234 } }),
    checkoutBody({ purchase: { merchant: "X", category: "groceries", amount: -5 } }),
    checkoutBody({ purchase: { merchant: "X", category: "weapons", amount: 5 } }),
    checkoutBody({ purchase: { merchant: "", category: "groceries", amount: 5 } }),
    checkoutBody({ date: "tomorrow" }),
  ];
  for (const c of cases) assert.equal((await createOrderRoute(request(c))).status, 400, JSON.stringify(c).slice(0, 80));
  assert.equal(calls.length, 0);
});

test("no order is created when every card carries a balance", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const res = await createOrderRoute(request(checkoutBody({ wallet: [{ cardId: "amex_gold", balance: 900 }] })));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "no_card_without_balance");
  assert.equal(calls.length, 0);
});

test("capture -> receipt -> the cap counter moves by what was captured", async () => {
  setKeys();
  const before = planCheckout(JORDAN.wallet, TJ, jordanYear());
  mockPayPal(() => ({ status: 201, body: completed(encodeOrderRef(before), "84.00") }));
  const res = await captureOrderRoute(request({ orderId: "ORDER123" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(calls[1].url, "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture");
  assert.equal((calls[1].init.headers as Record<string, string>).prefer, "return=representation");
  assert.equal(data.captureId, "CAPTURE9");
  assert.deepEqual(data.cap, { store: "memory" });
  assert.deepEqual(data.txn, { id: "paypal-CAPTURE9", date: TJ.date, merchant: TJ.merchant, amount: 84, category: "groceries", cardUsed: "amex_gold" });

  assert.equal(capMoveLine(before.capRoom!), "$25,000.00 → $24,916.00 of $25,000 this year");
  const after = planCheckout(JORDAN.wallet, TJ, [...jordanYear(), data.txn]);
  assert.equal(after.capRoom?.usedBefore, 84);
  assert.equal(after.capRoom?.leftBefore, 24916);
  assert.equal(after.capRoom?.leftAfter, 24832);
});

test("a repeat capture changes nothing", async () => {
  setKeys();
  mockPayPal(() => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }], debug_id: "abc" } }));
  const res = await captureOrderRoute(request({ orderId: "ORDER123" }));
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, "already_captured");
  assert.equal(data.txn, undefined);
});

test("a capture that didn't complete doesn't count toward a cap", async () => {
  setKeys();
  const plan = planCheckout(JORDAN.wallet, TJ, []);
  const pending = completed(encodeOrderRef(plan), "84.00");
  pending.purchase_units[0].payments.captures[0].status = "PENDING";
  mockPayPal(() => ({ status: 201, body: pending }));
  const res = await captureOrderRoute(request({ orderId: "ORDER123" }));
  assert.equal(res.status, 402);
  assert.equal((await res.json()).txn, undefined);
});

test("a declined card reads as declined, and a PayPal failure never echoes credentials", async () => {
  setKeys();
  mockPayPal(() => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } }));
  assert.equal((await captureOrderRoute(request({ orderId: "ORDER123" }))).status, 402);
  mockPayPal(() => ({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "d1" } }));
  const res = await createOrderRoute(request(checkoutBody()));
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes("sb-secret") && !text.includes("sandbox-token"));
});

test("capture refuses an order id that could change the URL", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  for (const orderId of ["../../v1/oauth2/token", "", "a b c d e", 42]) assert.equal((await captureOrderRoute(request({ orderId }))).status, 400);
});

test("signed in: the capture goes through applyPurchase into cap_state", async () => {
  let upserted: unknown[] = [];
  const existing = [{ card_id: "amex_gold", pool_key: "amex_gold|groceries||25000|year", period_key: "2026", consumed: "100" }];
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { card_id: "amex_gold", balance: 0, apr: null, credits_used: {} }, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: table === "cap_state" ? existing : [], error: null }),
      upsert: async (rows: unknown[]) => {
        upserted = rows;
        return { error: null };
      },
    };
    return chain;
  };
  const db = { from: query } as unknown as SupabaseClient;
  const ok = await persistCapture(db, "user-1", { id: "paypal-1", date: "2026-10-18", merchant: "Trader Joe's", amount: 84, category: "groceries", cardUsed: "amex_gold" });
  assert.equal(ok, true);
  assert.deepEqual(upserted, [{ card_id: "amex_gold", pool_key: "amex_gold|groceries||25000|year", period_key: "2026", consumed: 184, user_id: "user-1" }]);
});

// ---------- the agent, with Claude mocked ----------

type Message = Anthropic.Beta.Messages.BetaMessage;
const message = (content: unknown[], stop_reason = "end_turn") => ({ id: "m", type: "message", role: "assistant", model: "mock", content, stop_reason, stop_sequence: null, usage: {} }) as unknown as Message;
const toolCall = (name: string, input: object, id = name) => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

/** A scripted Claude: returns each message in turn and keeps every request it was sent. */
function script(...replies: Message[]) {
  const sent: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    sent.push(structuredClone(params));
    const next = replies.shift();
    assert.ok(next, "Claude was called more times than scripted");
    return next;
  };
  return { sent, create };
}

const toolResult = (sent: { messages: Anthropic.Beta.Messages.BetaMessageParam[] }[], turn: number) => {
  const last = sent[turn].messages[sent[turn].messages.length - 1];
  return (last.content as Anthropic.Beta.Messages.BetaToolResultBlockParam[])[0];
};
const context = () => ({ wallet: JORDAN.wallet, history: jordanYear(), valuation: "cash" as const, date: DEMO_TAP_DATE });
const askTJ = [{ role: "user" as const, text: "I'm spending $84 on groceries at Trader Joe's." }];
const rankTJ = () => toolCall("rank_cards", { merchant: "Trader Joe's", category: "groceries", amount: 84 });
const GOOD_REPLY = "Choose American Express Gold Card in PayPal: it earns $3.36, with $24,916.00 of $25,000 left. Nothing is charged until you approve it.";
const fakeOrder = (made: string[]) => async (plan: { orderValue: string }) => {
  made.push(plan.orderValue);
  return { id: "ORDER77", status: "CREATED", value: plan.orderValue };
};

test("agent: ranks with the engine, then proposes the engine's order", async () => {
  const made: string[] = [];
  const { sent, create } = script(message([rankTJ()], "tool_use"), message([toolCall("create_paypal_order", {})], "tool_use"), message([text(GOOD_REPLY)]));
  const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder(made), createMessage: create });

  assert.equal(out.plan?.pick?.cardId, "amex_gold");
  assert.deepEqual(made, ["84.00"]);
  assert.equal(out.order?.id, "ORDER77");
  assert.equal(out.reply, GOOD_REPLY);
  assert.equal(out.replyChecked, true);

  const ranked = JSON.parse(String(toolResult(sent, 1).content));
  assert.equal(ranked.choose_in_paypal, "American Express Gold Card");
  assert.equal(ranked.earns, "$3.36");
  assert.equal(ranked.cap_room, "$24,916.00 of $25,000 left this year after this purchase");
  assert.equal(ranked.do_not_use[0].card, "Apple Card");
  assert.match(ranked.ranking[0].provenance, /https?:\/\//);
  assert.equal(JSON.parse(String(toolResult(sent, 2).content)).charged, false);
  // the model can't name a card or an amount for the order
  const orderTool = sent[0].tools?.find((t) => "name" in t && t.name === "create_paypal_order") as Anthropic.Beta.Messages.BetaTool;
  assert.deepEqual(orderTool.input_schema.properties, {});
});

test("agent: an amount the person never typed never reaches the engine", async () => {
  const made: string[] = [];
  const { sent, create } = script(message([toolCall("rank_cards", { merchant: "Trader Joe's", category: "groceries", amount: 840 })], "tool_use"), message([text("How much are you spending?")]));
  const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder(made), createMessage: create });
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.plan, null);
  assert.equal(out.order, null);
  assert.deepEqual(made, []);
});

test("agent: no order before a ranking", async () => {
  const made: string[] = [];
  const { sent, create } = script(message([toolCall("create_paypal_order", {})], "tool_use"), message([text("Tell me the store and amount.")]));
  const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder(made), createMessage: create });
  assert.equal(toolResult(sent, 1).is_error, true);
  assert.equal(out.order, null);
  assert.deepEqual(made, []);
});

test("agent: no order when every card carries a balance", async () => {
  const made: string[] = [];
  const ctx = { ...context(), wallet: [{ cardId: "amex_gold", balance: 900 }] };
  const { sent, create } = script(message([rankTJ()], "tool_use"), message([toolCall("create_paypal_order", {})], "tool_use"), message([text("No card to recommend.")]));
  const out = await runCheckoutAgent({ chat: askTJ, context: ctx, createOrder: fakeOrder(made), createMessage: create });
  assert.equal(JSON.parse(String(toolResult(sent, 1).content)).choose_in_paypal, null);
  assert.equal(toolResult(sent, 2).is_error, true);
  assert.equal(out.order, null);
  assert.deepEqual(made, []);
});

for (const [name, bad] of [
  ["a number it worked out itself", "Choose American Express Gold Card: you'll save $2.11 a month."],
  ["a different card", "Choose Apple Card, it earns $3.36."],
  ["nothing at all", ""],
] as const) {
  test(`agent: a reply with ${name} is replaced by the engine's own words`, async () => {
    const { create } = script(message([rankTJ()], "tool_use"), message([toolCall("create_paypal_order", {})], "tool_use"), message(bad ? [text(bad)] : []));
    const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder([]), createMessage: create });
    assert.equal(out.replyChecked, false);
    assert.equal(out.reply, explainPlan(out.plan!));
    assert.ok(out.reply.includes("American Express Gold Card") && out.reply.includes("$3.36"));
  });
}

test("agent: a refusal runs no tool and creates no order", async () => {
  const made: string[] = [];
  const { sent, create } = script(message([rankTJ()], "refusal"));
  const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder(made), createMessage: create });
  assert.equal(sent.length, 1);
  assert.equal(out.plan, null);
  assert.deepEqual(made, []);
  assert.equal(out.replyChecked, false);
});

test("agent: stops after a bounded number of turns", async () => {
  const replies = Array.from({ length: 5 }, () => message([rankTJ()], "tool_use"));
  const { sent, create } = script(...replies);
  const out = await runCheckoutAgent({ chat: askTJ, context: context(), createOrder: fakeOrder([]), createMessage: create });
  assert.equal(sent.length, 5);
  assert.equal(out.replyChecked, false);
});

test("agent route: PayPal keys alone aren't enough", async () => {
  setKeys();
  const res = await agentRoute(request({ messages: askTJ, wallet: JORDAN.wallet, history: [], date: DEMO_TAP_DATE }));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "agent_not_configured" });
});

test("captured purchases count on the card Monte picked", () => {
  const txn = capturedTxn({ cardId: "amex_gold", category: "groceries", date: "2026-10-18", merchant: "Trader Joe's" }, "C1", "64.20");
  assert.deepEqual(txn, { id: "paypal-C1", date: "2026-10-18", merchant: "Trader Joe's", amount: 64.2, category: "groceries", cardUsed: "amex_gold" });
});
