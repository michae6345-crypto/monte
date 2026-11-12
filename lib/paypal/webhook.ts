// PayPal webhooks: how the server hears about money that moved outside the page, such as a
// refund issued from the PayPal sandbox dashboard.
//
// Every event is checked with PayPal's own POST /v1/notifications/verify-webhook-signature
// before anything is read from it. Two events matter:
//   PAYMENT.CAPTURE.COMPLETED  the capture route already counted it at capture time, so this
//                              is an idempotent no-op (it never adds to a cap a second time).
//   PAYMENT.CAPTURE.REFUNDED   roll the cap back through rollbackRefund + persistRefund, when
//                              the Supabase user behind the capture is known; otherwise log it.
//
// De-dupe is by event id, in memory. LIMITATION: that set lives in one server process, so a
// restart, a second instance or a serverless cold start forgets it, and PayPal's retry of an
// already-handled event would be handled again. A durable table keyed by event id fixes that.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYPAL_API, PayPalError, accessToken, getCapture } from "@/lib/paypal/client";
import { persistRefund } from "@/lib/paypal/persist";
import { capturedTxn, decodeOrderRef, type OrderRef } from "@/lib/paypal/plan";
import { refundValue, rollbackRefund } from "@/lib/paypal/refund";

const TIMEOUT_MS = 15_000;

export function webhookConfigured(): boolean {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "sandbox" && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID);
}

// ---------- verification ----------

const SIG_HEADERS = {
  transmission_id: "paypal-transmission-id",
  transmission_time: "paypal-transmission-time",
  transmission_sig: "paypal-transmission-sig",
  cert_url: "paypal-cert-url",
  auth_algo: "paypal-auth-algo",
} as const;

/** true only when PayPal answers verification_status SUCCESS. Missing headers or a body that
 *  isn't a JSON object fail without a network call. The raw body is spliced in byte for byte:
 *  re-serialising the parsed event can change it and break the signature check. */
export async function verifyWebhook(raw: string, headers: Headers): Promise<boolean> {
  const fields: Record<string, string> = {};
  for (const [field, header] of Object.entries(SIG_HEADERS)) {
    const v = headers.get(header);
    if (!v) return false;
    fields[field] = v;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  } catch {
    return false;
  }
  const head = JSON.stringify({ ...fields, webhook_id: process.env.PAYPAL_WEBHOOK_ID });
  const body = `${head.slice(0, -1)},"webhook_event":${raw}}`;
  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as { verification_status?: string; name?: string; message?: string };
  if (!res.ok) throw new PayPalError(res.status, data);
  return data.verification_status === "SUCCESS";
}

// ---------- de-dupe (in memory, see the limitation above) ----------

const MAX_SEEN = 1000;
const seen = new Set<string>();

function claim(eventId: string): boolean {
  if (seen.has(eventId)) return false;
  seen.add(eventId);
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string);
  return true;
}
/** Tests only. */
export function resetSeenEvents(): void {
  seen.clear();
}

// ---------- handling ----------

export type WebhookEvent = { id?: string; event_type?: string; resource?: Record<string, unknown> };

/** Who the capture belongs to, for persistRefund. Monte's custom_id carries the card and store
 *  but no user today, so the default knows nobody and a refund event is logged, not written. */
export type UserResolver = (ref: OrderRef, captureId: string) => Promise<string | null>;

export type Deps = { db?: () => SupabaseClient | null; userFor?: UserResolver };

export type Outcome =
  | { handled: "duplicate"; eventId: string }
  | { handled: "ignored"; eventType: string }
  | { handled: "capture_noop"; captureId: string | null }
  | { handled: "refund_logged"; captureId: string; refunded: string; reason: string }
  | { handled: "refund_rolled_back"; captureId: string; refunded: string; capReleased: number; rewardReversed: number };

type Link = { rel?: string; href?: string };

/** The capture a refund belongs to: PayPal links it as rel "up". */
export function refundedCaptureId(resource: Record<string, unknown>): string | null {
  const links = Array.isArray(resource.links) ? (resource.links as Link[]) : [];
  const up = links.find((l) => l.rel === "up" && typeof l.href === "string");
  const m = up && /\/v2\/payments\/captures\/([A-Za-z0-9]{5,64})$/.exec(up.href!);
  return m ? m[1] : null;
}

const noUser: UserResolver = async () => null;

async function onRefunded(resource: Record<string, unknown>, deps: Deps): Promise<Outcome> {
  const captureId = refundedCaptureId(resource);
  const amount = (resource.amount ?? {}) as { value?: unknown };
  const refunded = refundValue(amount.value);
  if (!captureId || !refunded) {
    console.warn("paypal webhook: refund event without a capture link or amount");
    return { handled: "refund_logged", captureId: captureId ?? "unknown", refunded: refunded ?? "0.00", reason: "unreadable" };
  }
  if (resource.status !== "COMPLETED") {
    return { handled: "refund_logged", captureId, refunded, reason: `refund_${String(resource.status ?? "unknown").toLowerCase()}` };
  }
  // PayPal's own record of the capture says what was bought, with which card, for how much.
  const capture = await getCapture(captureId);
  const ref = decodeOrderRef(capture.customId ?? (typeof resource.custom_id === "string" ? resource.custom_id : null));
  if (!ref || !capture.value) {
    console.info(`paypal webhook: refund ${refunded} on ${captureId} is not a Monte order`);
    return { handled: "refund_logged", captureId, refunded, reason: "not_a_monte_order" };
  }
  const txn = capturedTxn(ref, captureId, capture.value);
  const db = (deps.db ?? (() => null))();
  const userId = db ? await (deps.userFor ?? noUser)(ref, captureId) : null;
  if (!db || !userId) {
    const r = rollbackRefund([], txn, Number(refunded));
    console.info(`paypal webhook: refund $${refunded} on ${captureId} (${ref.cardId}, reverses $${r.rewardReversed} rewards); no Supabase user known, cap not written`);
    return { handled: "refund_logged", captureId, refunded, reason: "no_user" };
  }
  const saved = await persistRefund(db, userId, txn, Number(refunded));
  if (!saved) return { handled: "refund_logged", captureId, refunded, reason: "card_not_held" };
  return { handled: "refund_rolled_back", captureId, refunded, capReleased: saved.capReleased, rewardReversed: saved.rewardReversed };
}

/** Handle one verified event. Throws when a step fails, after releasing the event id, so
 *  PayPal's retry gets another go. */
export async function handleEvent(event: WebhookEvent, deps: Deps = {}): Promise<Outcome> {
  const eventId = typeof event.id === "string" ? event.id : "";
  const type = String(event.event_type ?? "");
  if (eventId && !claim(eventId)) return { handled: "duplicate", eventId };
  try {
    const resource = event.resource && typeof event.resource === "object" ? event.resource : {};
    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      // Counted by /api/paypal/capture-order when the capture happened; never counted twice here.
      return { handled: "capture_noop", captureId: typeof resource.id === "string" ? resource.id : null };
    }
    if (type === "PAYMENT.CAPTURE.REFUNDED") return await onRefunded(resource, deps);
    return { handled: "ignored", eventType: type };
  } catch (e) {
    if (eventId) seen.delete(eventId);
    throw e;
  }
}
