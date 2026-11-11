// POST /api/paypal/capture-order -> capture an order the buyer approved in PayPal's window.
//
// Body: { orderId }. Optional: Authorization: Bearer <supabase jwt>
// Returns: { status, orderId, captureId, value, currency, txn, cap: { store } }
//
// The card and store come from what Monte stored in the order when it was created. A signed-in
// person's cap counters are updated in Supabase; for the demo people `cap.store` is "memory" and
// the browser adds `txn` to the person's purchases. Only a COMPLETED capture counts toward a cap.

import { serviceDb, requestUser } from "@/lib/db/client";
import { captureOrder, failure, jsonBody, notConfigured, paypalConfigured, paypalFailure } from "@/lib/paypal/client";
import { persistCapture } from "@/lib/paypal/persist";
import { capturedTxn, decodeOrderRef } from "@/lib/paypal/plan";

const ORDER_ID = /^[A-Za-z0-9-]{5,64}$/;

export async function POST(req: Request) {
  if (!paypalConfigured()) return notConfigured();

  const { orderId } = await jsonBody(req);
  if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) return failure(400, "bad_request", { message: "orderId is required" });

  let captured;
  try {
    captured = await captureOrder(orderId);
  } catch (e) {
    return paypalFailure(e);
  }

  if (captured.status !== "COMPLETED" || captured.captureStatus !== "COMPLETED" || !captured.captureId || !captured.value) {
    return failure(402, "not_completed", { status: captured.status, capture_status: captured.captureStatus });
  }
  const ref = decodeOrderRef(captured.customId);
  if (!ref) return failure(502, "not_a_monte_order");

  const txn = capturedTxn(ref, captured.captureId, captured.value);

  // The money has moved by now, so a counter that can't be written must not lose the receipt.
  let store: "supabase" | "memory" = "memory";
  try {
    const db = serviceDb();
    const userId = db ? await requestUser(req, db) : null;
    if (db && userId && (await persistCapture(db, userId, txn))) store = "supabase";
  } catch (e) {
    console.warn("paypal: cap counter not written:", (e as Error).message);
  }

  return Response.json(
    {
      status: captured.status,
      orderId: captured.orderId,
      captureId: captured.captureId,
      value: captured.value,
      currency: captured.currency,
      txn,
      cap: { store },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
