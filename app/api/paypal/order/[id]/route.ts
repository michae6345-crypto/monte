// GET /api/paypal/order/{id} -> what PayPal itself says about a sandbox order, for audit.
//
// Returns: { orderId, status, value, currency, description, items, captures, refunds,
//            refundStatus, refunded, ref }
//
// The server asks PayPal (GET /v2/checkout/orders/{id}), so nothing here comes from the
// browser. `ref` is the card and store Monte stored in custom_id when it created the order,
// or null for an order Monte didn't create. 503 {"error":"paypal_not_configured"} without keys.

import { failure, getOrder, notConfigured, PayPalError, paypalConfigured, paypalFailure } from "@/lib/paypal/client";
import { decodeOrderRef } from "@/lib/paypal/plan";

const ORDER_ID = /^[A-Za-z0-9-]{5,64}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!paypalConfigured()) return notConfigured();

  const { id } = await params;
  if (typeof id !== "string" || !ORDER_ID.test(id)) return failure(400, "bad_request", { message: "a PayPal order id is required" });

  try {
    const order = await getOrder(id);
    return Response.json({ ...order, ref: decodeOrderRef(order.customId) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof PayPalError && e.status === 404) return failure(404, "order_not_found");
    return paypalFailure(e);
  }
}
