// POST /api/paypal/webhook -> PayPal tells the server about captures and refunds, including
// ones made outside the page (a refund issued from the sandbox dashboard).
//
// Every event is verified with PayPal (verify-webhook-signature) before it is read: unverified
// events get 400. Without PayPal keys or PAYPAL_WEBHOOK_ID the route answers 503. See
// lib/paypal/webhook.ts for what each event does and the in-memory de-dupe limitation.

import { serviceDb } from "@/lib/db/client";
import { failure, paypalFailure } from "@/lib/paypal/client";
import { handleEvent, verifyWebhook, webhookConfigured, type WebhookEvent } from "@/lib/paypal/webhook";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: Request) {
  if (!webhookConfigured()) return failure(503, "paypal_webhook_not_configured");

  const raw = await req.text();
  let verified: boolean;
  try {
    verified = await verifyWebhook(raw, req.headers);
  } catch (e) {
    return paypalFailure(e);
  }
  if (!verified) return failure(400, "unverified_webhook");

  const event = JSON.parse(raw) as WebhookEvent;
  try {
    const outcome = await handleEvent(event, { db: serviceDb });
    return Response.json({ received: true, ...outcome }, { headers: NO_STORE });
  } catch (e) {
    console.warn("paypal webhook: event not handled:", (e as Error).message);
    // A 5xx makes PayPal retry the event later.
    return failure(500, "webhook_failed");
  }
}
