// GET /api/paypal/transactions -> the sandbox account's PayPal purchases as Monte transactions.
//
// Query: ?months=1..36 (default 12), ?card=<catalog card id that funds PayPal> (optional).
// Returns: { txns, dropped, range: { start, end }, source: "paypal-sandbox" }
// 503 {"error":"paypal_not_configured"} without sandbox keys; PayPal failures map through
// paypalFailure like the other /api/paypal routes.

import { failure, notConfigured, PayPalError, paypalConfigured, paypalFailure } from "@/lib/paypal/client";
import { importPayPalPurchases } from "@/lib/paypal/transactions";
import { CARDS } from "@/lib/engine/catalog";

export async function GET(req: Request) {
  if (!paypalConfigured()) return notConfigured();

  const url = new URL(req.url);
  const months = url.searchParams.has("months") ? Number(url.searchParams.get("months")) : 12;
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return failure(400, "bad_request", { message: "months must be an integer from 1 to 36" });
  }
  const card = url.searchParams.get("card") ?? undefined;
  if (card !== undefined && !CARDS.some((c) => c.id === card)) {
    return failure(400, "bad_request", { message: "unknown card" });
  }

  // PayPal's search index lags a few hours; the end can be "now" and simply return less.
  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);

  try {
    const mapped = await importPayPalPurchases({ start, end, cardUsed: card });
    return Response.json(
      { ...mapped, range: { start: start.toISOString(), end: end.toISOString() }, source: "paypal-sandbox" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    // PayPal answers 403 NOT_AUTHORIZED when the sandbox app doesn't have the Transaction
    // Search feature turned on. Say that plainly instead of a generic PayPal error.
    if (e instanceof PayPalError && e.status === 403) {
      return failure(503, "transaction_search_not_enabled", {
        message: "Turn on Transaction search for this app in the PayPal developer dashboard.",
      });
    }
    return paypalFailure(e);
  }
}
