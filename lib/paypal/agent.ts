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

import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "@/lib/model/categorize";
import type { CreatedOrder } from "@/lib/paypal/client";
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

If the message doesn't give a store and a dollar amount in digits, ask for them and don't call a tool. If it's about something other than paying for a purchase, say that's all you can help with.`;

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
];

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type CreateMessage = (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.Messages.BetaMessage>;
export type AgentResult = { reply: string; plan: CheckoutPlan | null; order: CreatedOrder | null; replyChecked: boolean };

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
}): Promise<AgentResult> {
  const { chat, context, createOrder, createMessage = callClaude } = args;
  const typed = chat.filter((t) => t.role === "user").map((t) => t.text).join(" ");
  const typedNumbers = numbersIn(typed);
  const toolOutput: string[] = [];
  let plan: CheckoutPlan | null = null;
  let order: CreatedOrder | null = null;

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
    return { out: { error: `Unknown tool ${name}` }, isError: true };
  };

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = chat.map((t) => ({ role: t.role, content: t.text }));
  let reply = "";

  const started = Date.now();
  for (let turn = 0; turn < MAX_TURNS && Date.now() - started < DEADLINE_MS; turn++) {
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await createMessage({
        model: AGENT_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        tools: TOOLS,
        messages,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      // once the engine has answered, its result is still worth showing
      if (!plan) throw e;
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
        result = { out: { error: "PayPal couldn't create the order. Tell the person to try again." }, isError: true };
      }
      const content = JSON.stringify(result.out);
      toolOutput.push(content);
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: result.isError });
    }
    messages.push({ role: "user", content: results });
  }

  const finalPlan = plan as CheckoutPlan | null;
  const allowed = new Set([...typedNumbers, ...numbersIn(toolOutput.join(" "))]);
  const replyChecked =
    reply.length > 0 && numbersIn(reply).every((n) => allowed.has(n)) && (!finalPlan?.pick || reply.includes(finalPlan.pick.name));

  return {
    reply: replyChecked
      ? reply
      : finalPlan
        ? explainPlan(finalPlan, Boolean(order))
        : reply
          ? "Tell me the store and the dollar amount, like: I'm spending $84 on groceries at Trader Joe's."
          : "I couldn't finish that one. Try again, or use the checkout on the left.",
    plan: finalPlan,
    order,
    replyChecked,
  };
}
