// POST /api/paypal/agent -> the checkout agent's answer to one typed purchase.
//
// Body: { messages: [{ role, text }], wallet, history, date, valuation?, captures?: [{ captureId, merchant, amount }] }
// Returns: { reply, plan, order, proposal, replyChecked }
//
// `captures` are this session's PayPal purchases, newest first. With them the agent can propose
// a refund: `proposal` is { captureId, merchant, amount, full, cardId, card, category, capBack,
// rewardsReversed }. Nothing is refunded here; the browser confirms by POSTing captureId and
// amount to /api/paypal/refund. Card, store and captured amount come from PayPal's record.
// A refund can only be proposed for a capture in this browser's signed `monte_captures` cookie;
// asking for one that isn't answers 403 {"error":"not_your_capture"}.
//
// 503 {"error":"paypal_not_configured"} without PayPal keys, 503 {"error":"agent_not_configured"}
// without an Anthropic key. It can create an order but can't charge one.

import Anthropic from "@anthropic-ai/sdk";
import { runCheckoutAgent, type ChatTurn, type LookupCapture, type SessionCapture } from "@/lib/paypal/agent";
import { createOrderForPlan, failure, getCapture, jsonBody, notConfigured, paypalConfigured } from "@/lib/paypal/client";
import { ownedCaptures } from "@/lib/paypal/owner";
import { capturedTxn, decodeOrderRef } from "@/lib/paypal/plan";
import { refundValue } from "@/lib/paypal/refund";
import { isBad, parseContext, safeText } from "@/lib/paypal/validate";

// The agent's own deadline stays inside this (lib/paypal/agent.ts).
export const maxDuration = 60;

// Each question costs real model tokens and the URL is public. The per-address limit keeps one
// visitor from hogging it; the overall one holds even if someone rotates x-forwarded-for.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 15;
const ALL_PER_WINDOW = 120;
const recent = new Map<string, number[]>();
let everyone: number[] = [];

function overLimit(ip: string): boolean {
  const now = Date.now();
  everyone = everyone.filter((t) => t > now - WINDOW_MS);
  if (everyone.length >= ALL_PER_WINDOW) return true;
  everyone.push(now);
  for (const [key, times] of recent) if (times[times.length - 1] < now - WINDOW_MS) recent.delete(key);
  const times = (recent.get(ip) ?? []).filter((t) => t > now - WINDOW_MS);
  times.push(now);
  recent.set(ip, times);
  return times.length > PER_WINDOW;
}

function parseChat(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) return null;
  const chat = raw.map((t: { role?: unknown; text?: unknown }) => ({ role: t?.role, text: safeText(t?.text, 500) }));
  if (chat.some((t) => (t.role !== "user" && t.role !== "assistant") || !t.text)) return null;
  // the API wants a conversation that starts and ends on the person
  if (chat[0].role !== "user" || chat[chat.length - 1].role !== "user") return null;
  return chat as ChatTurn[];
}

const CAPTURE_ID = /^[A-Za-z0-9]{5,64}$/;
const REFUNDABLE = new Set(["COMPLETED", "PARTIALLY_REFUNDED"]);

/** Up to 10 of this session's captures. Absent is fine; anything malformed is a bad request. */
function parseCaptures(raw: unknown): SessionCapture[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 10) return null;
  const out: SessionCapture[] = [];
  for (const c of raw as { captureId?: unknown; merchant?: unknown; amount?: unknown }[]) {
    const merchant = safeText(c?.merchant, 48);
    const amount = refundValue(c?.amount);
    if (typeof c?.captureId !== "string" || !CAPTURE_ID.test(c.captureId) || !merchant || !amount) return null;
    out.push({ captureId: c.captureId, merchant, amount });
  }
  return out;
}

/** PayPal's own record of the capture, so the card and amount never come from the browser. */
const lookupCapture: LookupCapture = async (captureId) => {
  const capture = await getCapture(captureId);
  const ref = decodeOrderRef(capture.customId);
  if (!REFUNDABLE.has(capture.status) || !capture.value || !ref) return null;
  return capturedTxn(ref, captureId, capture.value);
};

export async function POST(req: Request) {
  if (!paypalConfigured()) return notConfigured();
  if (!process.env.ANTHROPIC_API_KEY) return failure(503, "agent_not_configured");
  if (overLimit(req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local")) return failure(429, "agent_busy");

  const body = await jsonBody(req);
  const chat = parseChat(body.messages);
  if (!chat) return failure(400, "bad_request", { message: "messages must be 1 to 8 short turns, ending on the person's" });
  const context = parseContext(body);
  if (isBad(context)) return failure(400, "bad_request", { message: context.error });
  const captures = parseCaptures(body.captures);
  if (!captures) return failure(400, "bad_request", { message: "captures must be up to 10 of { captureId, merchant, amount }" });

  // Only this browser's own captures can be looked up for a refund.
  const owned = new Set(ownedCaptures(req));
  const denied = { any: false };
  const ownLookup: LookupCapture = async (captureId) => {
    if (!owned.has(captureId)) {
      denied.any = true;
      return null;
    }
    return lookupCapture(captureId);
  };

  try {
    const result = await runCheckoutAgent({ chat, context, createOrder: createOrderForPlan, captures, lookupCapture: ownLookup });
    // A refund turn that only hit someone else's capture; a purchase in the same turn still answers.
    if (denied.any && !result.proposal && !result.plan && !result.order) return failure(403, "not_your_capture");
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return failure(429, "agent_busy");
    console.warn("agent: request failed:", (e as Error).message);
    return failure(502, "agent_error");
  }
}
