// POST /api/paypal/refund -> refund a sandbox capture, in full or in part, and put the cap back.
//
// Body: { captureId, amount?: "12.30", requestId? }. Optional: Authorization: Bearer <supabase jwt>
// Returns: { status, refundId, captureId, refunded, currency, requestId, txnId, rollback, cap: { store } }
//
// The captured amount, card and store come from PayPal's own record of the capture (the
// custom_id Monte wrote when it created the order), never from the browser. Only a COMPLETED
// refund moves a cap counter. For the demo people `cap.store` is "memory": the browser lowers
// the amount of the purchase `txnId` by `refunded`, and the engine recounts the cap from that.
// `requestId` is sent as PayPal-Request-Id, so a retry with the same id can't refund twice; the
// retry answers `replayed: true` and does not roll the cap back a second time.
// Only the browser that paid may refund: 403 {"error":"not_your_capture"} unless captureId is in
// its signed `monte_captures` cookie (set by capture-order; lib/paypal/owner.ts).

import { serviceDb, requestUser } from "@/lib/db/client";
import { PayPalError, failure, getCapture, jsonBody, notConfigured, paypalConfigured, paypalFailure, refundCapture } from "@/lib/paypal/client";
import { ownsCapture } from "@/lib/paypal/owner";
import { persistRefund } from "@/lib/paypal/persist";
import { capturedTxn, decodeOrderRef } from "@/lib/paypal/plan";
import { claimRefund, refundValue, releaseRefund, rollbackRefund, type Rollback } from "@/lib/paypal/refund";

const CAPTURE_ID = /^[A-Za-z0-9]{5,64}$/;
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
const REFUNDABLE = new Set(["COMPLETED", "PARTIALLY_REFUNDED"]);

/** What the receipt needs; the rows themselves stay on the server. */
const summary = (r: Rollback) => ({
  cardId: r.cardId,
  category: r.category,
  refunded: r.refunded,
  capReleased: r.capReleased,
  rewardOriginal: r.rewardOriginal,
  rewardReversed: r.rewardReversed,
});

export async function POST(req: Request) {
  if (!paypalConfigured()) return notConfigured();

  const body = await jsonBody(req);
  const { captureId, requestId } = body;
  if (typeof captureId !== "string" || !CAPTURE_ID.test(captureId)) return failure(400, "bad_request", { message: "captureId is required" });
  if (requestId !== undefined && (typeof requestId !== "string" || !REQUEST_ID.test(requestId))) {
    return failure(400, "bad_request", { message: "requestId must be 8 to 64 letters, digits or dashes" });
  }
  if (!ownsCapture(req, captureId)) return failure(403, "not_your_capture");
  const asked = body.amount === undefined ? null : refundValue(body.amount);
  if (body.amount !== undefined && !asked) return failure(400, "bad_request", { message: "amount must be a positive dollar amount, to the cent" });

  let capture;
  try {
    capture = await getCapture(captureId);
  } catch (e) {
    return paypalFailure(e);
  }
  if (!REFUNDABLE.has(capture.status) || !capture.value) return failure(409, "not_refundable", { capture_status: capture.status });
  const ref = decodeOrderRef(capture.customId);
  if (!ref) return failure(409, "not_a_monte_order");
  const captured = Number(capture.value);
  if (asked && Number(asked) > captured) return failure(400, "bad_request", { message: `amount can't be more than the $${capture.value} captured` });

  let refund;
  try {
    refund = await refundCapture(captureId, asked ?? undefined, typeof requestId === "string" ? requestId : undefined);
  } catch (e) {
    if (e instanceof PayPalError && (e.issue === "REFUND_AMOUNT_EXCEEDED" || e.issue === "CAPTURE_FULLY_REFUNDED")) {
      return failure(409, "already_refunded", { issue: e.issue });
    }
    return paypalFailure(e);
  }

  const txn = capturedTxn(ref, captureId, capture.value);
  const refunded = Number(refund.value ?? asked ?? capture.value);
  let store: "supabase" | "memory" = "memory";
  let rollback: ReturnType<typeof summary> | null = null;

  let replayed = false;

  if (refund.status === "COMPLETED") {
    // Rewards to reverse, for the receipt. Never throws: the money is already back.
    const estimate = () => {
      try {
        return summary(rollbackRefund([], txn, refunded));
      } catch (e) {
        console.warn("paypal: refund rollback not computed:", (e as Error).message);
        return null;
      }
    };
    // A retried requestId comes back as the same refund: its cap was already put back once.
    replayed = !claimRefund(refund.refundId);
    if (replayed) {
      rollback = estimate();
    } else {
      // The money is back by now, so a counter that can't be written must not lose the receipt.
      try {
        const db = serviceDb();
        const userId = db ? await requestUser(req, db) : null;
        const saved = db && userId ? await persistRefund(db, userId, txn, refunded) : null;
        if (saved) store = "supabase";
        rollback = saved ? summary(saved) : estimate();
      } catch (e) {
        console.warn("paypal: cap rollback not written:", (e as Error).message);
        releaseRefund(refund.refundId); // nothing was written, so a retry may still apply it
        rollback = estimate();
      }
    }
  }

  return Response.json(
    {
      status: refund.status,
      refundId: refund.refundId,
      captureId,
      refunded: refunded.toFixed(2),
      currency: refund.currency ?? capture.currency,
      requestId: refund.requestId,
      txnId: txn.id,
      rollback,
      cap: { store },
      replayed,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
