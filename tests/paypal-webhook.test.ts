// PayPal webhooks: every event is verified with PayPal first, a refund made outside the page
// rolls the cap back, a repeated event is handled once, and without config the route is 503.
// PayPal and Supabase are mocked.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CapRow } from "@/lib/db/cap-state";
import { JORDAN } from "@/lib/data/personas";
import { PAYPAL_API } from "@/lib/paypal/client";
import { DEMO_TAP_DATE, encodeOrderRef, planCheckout } from "@/lib/paypal/plan";
import { handleEvent, refundedCaptureId, resetSeenEvents, verifyWebhook } from "@/lib/paypal/webhook";
import { POST as webhookRoute } from "@/app/api/paypal/webhook/route";

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "PAYPAL_WEBHOOK_ID", "SUPABASE_SECRET_KEY"] as const;
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};
let calls: { url: string; init: RequestInit }[] = [];
let clientCount = 0;

type Reply = { status?: number; body: unknown };
function mockPayPal(answer: (url: string, init: RequestInit) => Reply) {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const reply: Reply = url.endsWith("/v1/oauth2/token") ? { body: { access_token: "sandbox-token", expires_in: 32400 } } : answer(url, init);
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as typeof fetch;
}
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  calls = [];
  resetSeenEvents();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});
function setKeys() {
  process.env.PAYPAL_CLIENT_ID = `sb-webhook-client-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
  process.env.PAYPAL_WEBHOOK_ID = "WH-TEST-0001";
}

const SIG = {
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-time": "2026-11-12T18:00:00Z",
  "paypal-transmission-sig": "sig==",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
  "paypal-auth-algo": "SHA256withRSA",
};
const ref = () => encodeOrderRef(planCheckout(JORDAN.wallet, { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE }, []));
const refundEvent = (id = "WH-EVT-1", value = "21.00") => ({
  id,
  event_type: "PAYMENT.CAPTURE.REFUNDED",
  resource: {
    id: "REFUND1",
    status: "COMPLETED",
    amount: { currency_code: "USD", value },
    links: [
      { rel: "self", href: `${PAYPAL_API}/v2/payments/refunds/REFUND1` },
      { rel: "up", href: `${PAYPAL_API}/v2/payments/captures/CAPTURE9` },
    ],
  },
});
const captureRecord = () => ({ id: "CAPTURE9", status: "PARTIALLY_REFUNDED", custom_id: ref(), amount: { currency_code: "USD", value: "84.00" } });
const request = (event: unknown, headers: Record<string, string> = SIG) =>
  new Request("http://localhost/api/paypal/webhook", { method: "POST", headers, body: JSON.stringify(event) });
/** verify answers `status`; GET capture answers with the record. */
const paypal = (status: string) => (url: string, init: RequestInit): Reply =>
  url.endsWith("/verify-webhook-signature") ? { body: { verification_status: status } } : init.method === "GET" ? { body: captureRecord() } : assert.fail(`unexpected ${url}`);

// ---------- config ----------

test("missing keys or PAYPAL_WEBHOOK_ID: 503 and nothing reaches PayPal", async () => {
  mockPayPal(() => assert.fail("should not reach PayPal"));
  assert.equal((await webhookRoute(request(refundEvent()))).status, 503);
  setKeys();
  delete process.env.PAYPAL_WEBHOOK_ID;
  const res = await webhookRoute(request(refundEvent()));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "paypal_webhook_not_configured" });
  assert.equal(calls.length, 0);
});

// ---------- verification ----------

test("verifyWebhook: sends the headers, webhook_id and the raw event to PayPal", async () => {
  setKeys();
  mockPayPal(paypal("SUCCESS"));
  const raw = JSON.stringify(refundEvent());
  assert.equal(await verifyWebhook(raw, new Headers(SIG)), true);
  const call = calls.find((c) => c.url.endsWith("/verify-webhook-signature"))!;
  assert.equal(call.url, `${PAYPAL_API}/v1/notifications/verify-webhook-signature`);
  assert.equal((call.init.headers as Record<string, string>).authorization, "Bearer sandbox-token");
  const sent = String(call.init.body);
  assert.ok(sent.endsWith(`"webhook_event":${raw}}`), "the raw event, byte for byte");
  assert.deepEqual(JSON.parse(sent), {
    transmission_id: "tx-1",
    transmission_time: SIG["paypal-transmission-time"],
    transmission_sig: "sig==",
    cert_url: SIG["paypal-cert-url"],
    auth_algo: "SHA256withRSA",
    webhook_id: "WH-TEST-0001",
    webhook_event: refundEvent(),
  });
});

test("verification failure: 400, and the event is never acted on", async () => {
  setKeys();
  mockPayPal(paypal("FAILURE"));
  const res = await webhookRoute(request(refundEvent()));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "unverified_webhook" });
  assert.ok(!calls.some((c) => c.url.includes("/v2/payments/captures/")), "no capture lookup");
});

test("missing signature headers or a non-object body: 400 without asking PayPal", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const { ["paypal-transmission-sig"]: _drop, ...partial } = SIG;
  void _drop;
  assert.equal((await webhookRoute(request(refundEvent(), partial))).status, 400);
  assert.equal((await webhookRoute(new Request("http://localhost/x", { method: "POST", headers: SIG, body: "not json" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("verified refund with no known user: logged, 200, nothing written", async () => {
  setKeys();
  mockPayPal(paypal("SUCCESS"));
  const res = await webhookRoute(request(refundEvent()));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true, handled: "refund_logged", captureId: "CAPTURE9", refunded: "21.00", reason: "no_user" });
});

test("verified capture completed: an idempotent no-op (the capture route already counted it)", async () => {
  setKeys();
  mockPayPal(paypal("SUCCESS"));
  const res = await webhookRoute(request({ id: "WH-EVT-C", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAPTURE9", status: "COMPLETED" } }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true, handled: "capture_noop", captureId: "CAPTURE9" });
});

// ---------- refund rollback ----------

const POOL = "amex_gold|groceries||25000|year";
const ROWS: CapRow[] = [{ card_id: "amex_gold", pool_key: POOL, period_key: "2026", consumed: 184 }];
function fakeDb(sink: { upserts: unknown[][] }) {
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { card_id: "amex_gold" }, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: table === "cap_state" ? ROWS.map((r) => ({ ...r, consumed: String(r.consumed) })) : [], error: null }),
      upsert: async (rows: unknown[]) => {
        sink.upserts.push(rows);
        return { error: null };
      },
    };
    return chain;
  };
  return { from: query } as unknown as SupabaseClient;
}

test("refunded event with a known user rolls cap_state back by the refund", async () => {
  setKeys();
  mockPayPal(paypal("SUCCESS"));
  const sink = { upserts: [] as unknown[][] };
  const out = await handleEvent(refundEvent(), { db: () => fakeDb(sink), userFor: async (r, id) => (r.cardId === "amex_gold" && id === "CAPTURE9" ? "user-1" : null) });
  assert.deepEqual(out, { handled: "refund_rolled_back", captureId: "CAPTURE9", refunded: "21.00", capReleased: 21, rewardReversed: 0.84 });
  assert.deepEqual(sink.upserts, [[{ card_id: "amex_gold", pool_key: POOL, period_key: "2026", consumed: 163, user_id: "user-1" }]]);
});

test("duplicate event id: handled once, the second delivery changes nothing", async () => {
  setKeys();
  mockPayPal(paypal("SUCCESS"));
  const sink = { upserts: [] as unknown[][] };
  const deps = { db: () => fakeDb(sink), userFor: async () => "user-1" };
  assert.equal((await handleEvent(refundEvent("WH-DUP"), deps)).handled, "refund_rolled_back");
  assert.deepEqual(await handleEvent(refundEvent("WH-DUP"), deps), { handled: "duplicate", eventId: "WH-DUP" });
  assert.equal(sink.upserts.length, 1);

  // Through the route too: the second delivery is a 200 duplicate.
  const first = await webhookRoute(request(refundEvent("WH-DUP-2")));
  const second = await webhookRoute(request(refundEvent("WH-DUP-2")));
  assert.equal((await first.json()).handled, "refund_logged");
  assert.deepEqual(await second.json(), { received: true, handled: "duplicate", eventId: "WH-DUP-2" });
});

test("a failed handling releases the event id so PayPal's retry can succeed", async () => {
  setKeys();
  mockPayPal((url) => (url.endsWith("/verify-webhook-signature") ? { body: { verification_status: "SUCCESS" } } : { status: 500, body: { name: "INTERNAL_SERVER_ERROR" } }));
  assert.equal((await webhookRoute(request(refundEvent("WH-RETRY")))).status, 500);
  mockPayPal(paypal("SUCCESS"));
  assert.equal((await (await webhookRoute(request(refundEvent("WH-RETRY")))).json()).handled, "refund_logged");
});

test("refundedCaptureId reads the rel=up link and nothing else", () => {
  assert.equal(refundedCaptureId(refundEvent().resource), "CAPTURE9");
  assert.equal(refundedCaptureId({ links: [{ rel: "up", href: "https://evil.example/../../v1/oauth2/token" }] }), null);
  assert.equal(refundedCaptureId({}), null);
});
