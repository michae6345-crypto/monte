// POST /api/paypal/create-order -> a sandbox order for one ranked purchase.
//
// Body: { purchase: { merchant, category, amount }, wallet, history, date, valuation? }
// Returns: { id, status, value, plan }
//
// The server re-runs the engine, so the order is for the engine's plan and not for anything
// the browser asserts about it. 503 {"error":"paypal_not_configured"} without keys.

import { setValuation } from "@/lib/engine";
import { createOrderForPlan, failure, jsonBody, notConfigured, paypalConfigured, paypalFailure } from "@/lib/paypal/client";
import { planCheckout } from "@/lib/paypal/plan";
import { isBad, parseContext, parsePurchase } from "@/lib/paypal/validate";

export async function POST(req: Request) {
  if (!paypalConfigured()) return notConfigured();

  const body = await jsonBody(req);
  const context = parseContext(body);
  if (isBad(context)) return failure(400, "bad_request", { message: context.error });
  const purchase = parsePurchase(body.purchase, context.date);
  if (isBad(purchase)) return failure(400, "bad_request", { message: purchase.error });

  // the valuation is module state in the engine; this block is synchronous, so requests can't mix
  setValuation(context.valuation);
  const plan = planCheckout(context.wallet, purchase, context.history);
  if (!plan.pick) return failure(409, "no_card_without_balance", { plan });

  try {
    const order = await createOrderForPlan(plan);
    return Response.json({ ...order, plan }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return paypalFailure(e);
  }
}
