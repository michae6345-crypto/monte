// POST /api/paypal/agent -> the checkout agent's answer to one typed purchase.
//
// Body: { messages: [{ role, text }], wallet, history, date, valuation? }
// Returns: { reply, plan, order, replyChecked }
//
// 503 {"error":"paypal_not_configured"} without PayPal keys, 503 {"error":"agent_not_configured"}
// without an Anthropic key. It can create an order but can't charge one.

import Anthropic from "@anthropic-ai/sdk";
import { runCheckoutAgent, type ChatTurn } from "@/lib/paypal/agent";
import { createOrderForPlan, failure, jsonBody, notConfigured, paypalConfigured } from "@/lib/paypal/client";
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

export async function POST(req: Request) {
  if (!paypalConfigured()) return notConfigured();
  if (!process.env.ANTHROPIC_API_KEY) return failure(503, "agent_not_configured");
  if (overLimit(req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local")) return failure(429, "agent_busy");

  const body = await jsonBody(req);
  const chat = parseChat(body.messages);
  if (!chat) return failure(400, "bad_request", { message: "messages must be 1 to 8 short turns, ending on the person's" });
  const context = parseContext(body);
  if (isBad(context)) return failure(400, "bad_request", { message: context.error });

  try {
    const result = await runCheckoutAgent({ chat, context, createOrder: createOrderForPlan });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return failure(429, "agent_busy");
    console.warn("agent: request failed:", (e as Error).message);
    return failure(502, "agent_error");
  }
}
