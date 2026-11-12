// The checkout agent: a person types a purchase, Claude calls two tools, and explains.
//
// Claude reads the sentence and writes the words. It doesn't pick the card or touch a number:
//   rank_cards          runs the deterministic engine (planCheckout)
//   create_paypal_order takes no arguments, so the amount and card can only be the engine's
// Three checks hold that line in code, not just in the prompt:
//   - the amount passed to rank_cards has to appear in what the person typed
//   - every number in the reply has to appear in a tool result or in what the person typed
//   - the reply has to name the card the engine picked
// A reply that fails is replaced by explainPlan(). The order is only ever created here; the
// person still has to approve it in PayPal's window, and nothing is charged without that.
//
// Returns go the same way. propose_refund never refunds anything: it prices a refund with the
// deterministic rollback (lib/paypal/refund.ts) and hands back a proposal the person confirms
// in the UI, which then calls /api/paypal/refund. It can only name a capture from this session's
// list (sent by the browser, checked against PayPal's own record), and the amount has to be in
// what the person typed or be the whole captured amount.

import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "@/lib/model/categorize";
import type { Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { applyPurchase } from "@/lib/db/cap-state";
import type { CreatedOrder } from "@/lib/paypal/client";
import { refundValue, rollbackRefund } from "@/lib/paypal/refund";
import { capRoomLine, explainPlan, orderValue, planAtValuation, usd, type CheckoutPlan } from "@/lib/paypal/plan";
import { isCategory, safeText, type CheckoutContext } from "@/lib/paypal/validate";

export const AGENT_MODEL = "claude-opus-5-5";
const MAX_TURNS = 5;
// Stop starting turns after this long. With one call's timeout on top, the worst case stays
// inside the route's 60-second maxDuration.
const DEADLINE_MS = 30_000;
const CALL_TIMEOUT_MS = 25_000;
// A short reply on a public demo: this is a cost limit, and hitting it falls back to explainPlan().
const MAX_TOKENS = 2048;

const SYSTEM = `You are Monte's checkout assistant. Monte is a credit-card app, and this demo runs on PayPal's sandbox, so no real money moves.

When someone describes a purchase, call rank_cards with the store, the category and the dollar amount they typed. Monte's deterministic engine decides the card. If it recommends one, call create_paypal_order, then answer in two or three plain sentences: which card to choose in their PayPal wallet, what it earns on this purchase, how much cap room is left if the rule has a cap, and that nothing is charged until they approve it in the PayPal window.

The tools are the only source of card choices and numbers. Use card names and figures exactly as the tools give them. Don't calculate, round, estimate or compare anything yourself, and never suggest a card listed under do_not_use, even if it would earn more.

If someone wants to return or refund a purchase, call propose_refund with the capture_id of that purchase from the recent purchases listed below, and an amount only if they typed one in digits (leave it out for a full refund). Never make up a capture_id: if the purchase isn't listed, or it's unclear which one they mean, ask. propose_refund refunds nothing; it prepares a refund the person confirms with a button. Answer in one or two sentences: the card, the amount, the cap room it gives back and the rewards it reverses, exactly as the tool gives them, and that nothing is refunded until they confirm.

If the message doesn't give a store and a dollar amount in digits, ask for them and don't call a tool. If it's about something other than paying for a purchase or returning one, say that's all you can help with.`;

type Tool = Anthropic.Beta.Messages.BetaTool;

const TOOLS: Tool[] = [
  {
    name: "rank_cards",
    description:
      "Runs Monte's deterministic rules engine on the person's wallet for one purchase. Returns the card to choose, what it earns, its cap room, the cards not to use, and the provenance of each number.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        merchant: { type: "string", description: "The store's name, e.g. Trader Joe's." },
        category: { type: "string", enum: [...CATEGORIES], description: "The best match for what's being bought." },
        amount: { type: "number", description: "The dollar amount exactly as the person typed it." },
      },
      required: ["merchant", "category", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "create_paypal_order",
    description:
      "Creates a PayPal sandbox order for the purchase most recently ranked, for the engine's amount. It charges nothing: the person approves or cancels it in PayPal's window. Takes no arguments.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "propose_refund",
    description:
      "Prepares a refund of one recent PayPal purchase and prices it with Monte's deterministic rollback: the card, the cap room it gives back and the rewards it reverses. It refunds nothing; the person confirms in the app. Leave amount out for a full refund.",
    input_schema: {
      type: "object",
      properties: {
        capture_id: { type: "string", description: "The capture_id of a purchase from the recent purchases list. Never invent one." },
        amount: { type: "number", description: "Dollars to refund, only if the person typed it in digits." },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

/** One purchase captured this session, as the browser knows it. Only these can be refunded. */
export type SessionCapture = { captureId: string; merchant: string; amount: string };
/** The refund the person is asked to confirm. Nothing has been refunded yet. */
export type RefundProposal = {
  captureId: string;
  merchant: string;
  /** Dollars to refund, "21.00"; the whole captured amount when `full`. */
  amount: string;
  full: boolean;
  cardId: string;
  card: string;
  category: string;
  /** Dollars of cap room the refund gives back. */
  capBack: number;
  /** Dollars of rewards the refund takes back. */
  rewardsReversed: number;
};
/** PayPal's own record of a capture, as the purchase it added; null if it isn't a refundable Monte order. */
export type LookupCapture = (captureId: string) => Promise<Txn | null>;

/** Price a refund of `refund` dollars of the captured purchase `txn`. Pure: the cap rows are the
 *  ones this purchase alone would have written, so capBack is what it put in and gets back. */
export function proposeRefund(txn: Txn, captureId: string, refund: number): RefundProposal {
  const r = rollbackRefund(applyPurchase([], { cardId: txn.cardUsed }, txn), txn, refund);
  return {
    captureId,
    merchant: txn.merchant,
    amount: r.refunded.toFixed(2),
    full: Math.abs(r.refunded - txn.amount) < 0.005,
    cardId: r.cardId,
    card: card(r.cardId).name,
    category: r.category,
    capBack: r.capReleased,
    rewardsReversed: r.rewardReversed,
  };
}

/** The proposal in the engine's own words, for when Claude's reply fails a check. */
export function explainRefund(p: RefundProposal): string {
  const what = p.full ? `the full ${usd(Number(p.amount))}` : usd(Number(p.amount));
  const cap = p.capBack > 0 ? ` It gives ${usd(p.capBack)} of cap room back on ${p.card}` : ` It was on ${p.card}`;
  return `Ready to refund ${what} of your ${p.merchant} purchase.${cap} and reverses ${usd(p.rewardsReversed)} of rewards. Nothing is refunded until you confirm.`;
}

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type CreateMessage = (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.Messages.BetaMessage>;
export type AgentResult = { reply: string; plan: CheckoutPlan | null; order: CreatedOrder | null; proposal: RefundProposal | null; replyChecked: boolean };

const callClaude: CreateMessage = (params) => new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 0 }).beta.messages.create(params);

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map((n) => Number(n.replace(/,/g, "")));

/** What the engine said, already in words and formatted, so there's nothing left to compute. */
function toolView(plan: CheckoutPlan) {
  const { pick, runnerUp, capRoom, purchase, orderValue: value } = plan;
  return {
    purchase: { merchant: purchase.merchant, category: purchase.category.replace(/_/g, " "), amount: usd(Number(value)) },
    choose_in_paypal: pick?.name ?? null,
    no_recommendation_reason: pick ? undefined : "Every card in this wallet carries a balance.",
    earns: pick ? usd(pick.reward) : undefined,
    rule: pick?.rule,
    cap_room: pick ? (capRoom ? capRoomLine(capRoom) : "This rule has no spending cap.") : undefined,
    next_best: runnerUp ? { card: runnerUp.name, earns: usd(runnerUp.reward), picked_card_earns_more_by: usd(runnerUp.gap) } : undefined,
    do_not_use: plan.ranked.filter((r) => r.blocked).map((r) => ({ card: r.name, why: r.blocked })),
    ranking: plan.ranked.map((r) => ({ card: r.name, earns: usd(r.reward), rule: r.rule, blocked: Boolean(r.blocked), provenance: r.citation })),
  };
}

export async function runCheckoutAgent(args: {
  chat: ChatTurn[];
  context: CheckoutContext;
  createOrder: (plan: CheckoutPlan) => Promise<CreatedOrder>;
  createMessage?: CreateMessage;
  /** This session's captures, newest first. Without them (and lookupCapture) nothing can be refunded. */
  captures?: SessionCapture[];
  lookupCapture?: LookupCapture;
}): Promise<AgentResult> {
  const { chat, context, createOrder, createMessage = callClaude, captures = [], lookupCapture } = args;
  const typed = chat.filter((t) => t.role === "user").map((t) => t.text).join(" ");
  const typedNumbers = numbersIn(typed);
  const toolOutput: string[] = [];
  let plan: CheckoutPlan | null = null;
  let order: CreatedOrder | null = null;
  let proposal: RefundProposal | null = null;

  const runTool = async (name: string, input: Record<string, unknown>): Promise<{ out: object; isError?: boolean }> => {
    if (name === "rank_cards") {
      const merchant = safeText(input.merchant, 48);
      const { amount, category } = input;
      if (!merchant || !isCategory(category)) return { out: { error: "A store and a known category are required." }, isError: true };
      if (!orderValue(amount)) return { out: { error: "The amount must be between $0.01 and $10,000, to the cent." }, isError: true };
      if (!typedNumbers.includes(amount as number)) return { out: { error: "That amount isn't in what the person typed. Ask them for the amount in digits." }, isError: true };
      plan = planAtValuation(context.valuation, context.wallet, { merchant, category, amount: amount as number, date: context.date }, context.history);
      order = null;
      return { out: toolView(plan) };
    }
    if (name === "create_paypal_order") {
      if (!plan) return { out: { error: "Call rank_cards first." }, isError: true };
      if (!plan.pick) return { out: { error: "The engine recommended no card, so there's no order to create." }, isError: true };
      if (!order) order = await createOrder(plan);
      return { out: { order_id: order.id, amount: usd(Number(order.value)), status: order.status, charged: false, next_step: "The person approves or cancels this in PayPal's window." } };
    }
    if (name === "propose_refund") {
      if (!captures.length || !lookupCapture) return { out: { error: "There are no PayPal purchases from this session to refund." }, isError: true };
      const id = input.capture_id ?? (captures.length === 1 ? captures[0].captureId : undefined);
      const listed = captures.find((c) => c.captureId === id);
      if (!listed) return { out: { error: "Use a capture_id from the recent purchases list. If it's unclear which purchase they mean, ask." }, isError: true };
      const txn = await lookupCapture(listed.captureId);
      if (!txn) return { out: { error: "PayPal says that purchase can't be refunded." }, isError: true };
      let refund = txn.amount;
      if (input.amount !== undefined) {
        const asked = refundValue(input.amount);
        if (!asked || (!typedNumbers.includes(input.amount as number) && Number(asked) !== txn.amount)) {
          return { out: { error: "That amount isn't in what the person typed. Leave it out for a full refund, or ask them for the amount in digits." }, isError: true };
        }
        if (Number(asked) > txn.amount) return { out: { error: `That's more than the ${usd(txn.amount)} captured.` }, isError: true };
        refund = Number(asked);
      }
      proposal = proposeRefund(txn, listed.captureId, refund);
      const p = proposal;
      return {
        out: {
          capture_id: p.captureId,
          merchant: p.merchant,
          captured: usd(txn.amount),
          refund: usd(Number(p.amount)),
          full_refund: p.full,
          card: p.card,
          category: p.category.replace(/_/g, " "),
          cap_room_back: usd(p.capBack),
          rewards_reversed: usd(p.rewardsReversed),
          refunded: false,
          next_step: "The person confirms the refund in the app. Nothing is refunded until then.",
        },
      };
    }
    return { out: { error: `Unknown tool ${name}` }, isError: true };
  };

  // The ids are the browser's, checked against PayPal before anything is priced.
  const system = captures.length
    ? `${SYSTEM}\n\nRecent purchases this session (newest first):\n${JSON.stringify(captures.map((c) => ({ capture_id: c.captureId, merchant: c.merchant, amount: c.amount })))}`
    : SYSTEM;
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = chat.map((t) => ({ role: t.role, content: t.text }));
  let reply = "";

  const started = Date.now();
  for (let turn = 0; turn < MAX_TURNS && Date.now() - started < DEADLINE_MS; turn++) {
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await createMessage({
        model: AGENT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        messages,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      // once the engine has answered, its result is still worth showing
      if (!plan && !proposal) throw e;
      console.warn("agent: model call failed after ranking:", (e as Error).message);
      break;
    }
    // a refusal or a cut-off can leave a half-written tool call: never run those
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") break;
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue;

    const calls = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    if (!calls.length) {
      reply = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      break;
    }

    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      let result: { out: object; isError?: boolean };
      try {
        result = await runTool(call.name, call.input as Record<string, unknown>);
      } catch (e) {
        console.warn("agent: tool failed:", call.name, (e as Error).message);
        const what = call.name === "propose_refund" ? "look up that purchase" : "create the order";
        result = { out: { error: `PayPal couldn't ${what}. Tell the person to try again.` }, isError: true };
      }
      const content = JSON.stringify(result.out);
      toolOutput.push(content);
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: result.isError });
    }
    messages.push({ role: "user", content: results });
  }

  const finalPlan = plan as CheckoutPlan | null;
  const finalProposal = proposal as RefundProposal | null;
  const allowed = new Set([...typedNumbers, ...numbersIn(toolOutput.join(" "))]);
  const replyChecked =
    reply.length > 0 &&
    numbersIn(reply).every((n) => allowed.has(n)) &&
    (!finalPlan?.pick || reply.includes(finalPlan.pick.name)) &&
    (!finalProposal || reply.includes(finalProposal.card));

  return {
    reply: replyChecked
      ? reply
      : finalProposal
        ? explainRefund(finalProposal)
        : finalPlan
          ? explainPlan(finalPlan, Boolean(order))
          : reply
            ? "Tell me the store and the dollar amount, like: I'm spending $84 on groceries at Trader Joe's."
            : "I couldn't finish that one. Try again, or use the checkout on the left.",
    plan: finalPlan,
    order,
    proposal: finalProposal,
    replyChecked,
  };
}
