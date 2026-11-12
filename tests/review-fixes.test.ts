// Regression tests for the PayPal / Plaid server review fixes. PayPal is mocked; Plaid never
// gets a network call (every case here answers before the SDK is used).

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { Txn } from "@/lib/engine";
import { JORDAN } from "@/lib/data/personas";
import { DEMO_TAP_DATE, encodeOrderRef, planCheckout } from "@/lib/paypal/plan";
import { claimRefund, releaseRefund, rollbackRefund } from "@/lib/paypal/refund";
import { OWNER_COOKIE, signCaptures } from "@/lib/paypal/owner";
import { POST as refundRoute } from "@/app/api/paypal/refund/route";
import { POST as linkTokenRoute } from "@/app/api/plaid/link-token/route";
import { sandboxOnly } from "@/lib/data/plaid-server";
import { GET as recurringRoute } from "@/app/api/plaid/recurring/route";

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"] as const;
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};
let calls: { url: string; init: RequestInit }[] = [];
let clientCount = 0;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  calls = [];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});

type Reply = { status?: number; body: unknown };
function mockFetch(answer: (url: string, init: RequestInit) => Reply) {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const reply: Reply = url.endsWith("/v1/oauth2/token") ? { body: { access_token: "sandbox-token", expires_in: 32400 } } : answer(url, init);
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as typeof fetch;
}
function setPayPalKeys() {
  process.env.PAYPAL_CLIENT_ID = `sb-review-client-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
}

const ref = () => encodeOrderRef(planCheckout(JORDAN.wallet, { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE }, []));
const refundRequest = (body: unknown) =>
  new Request("http://localhost/api/paypal/refund", { method: "POST", headers: { cookie: `${OWNER_COOKIE}=${signCaptures(["CAPTURE9"])}` }, body: JSON.stringify(body) });
const paypal = (refundId: string, customId = ref()) => (url: string, init: RequestInit): Reply =>
  init.method === "GET"
    ? { body: { id: "CAPTURE9", status: "COMPLETED", custom_id: customId, amount: { currency_code: "USD", value: "84.00" } } }
    : url.endsWith("/refund")
      ? { status: 201, body: { id: refundId, status: "COMPLETED", amount: { currency_code: "USD", value: "84.00" } } }
      : assert.fail(`unexpected ${url}`);

// ---------- refund replay ----------

test("claimRefund: a refund id is applied once; a released claim can be applied again", () => {
  assert.equal(claimRefund("REVIEW-REFUND-A"), true);
  assert.equal(claimRefund("REVIEW-REFUND-A"), false);
  releaseRefund("REVIEW-REFUND-A");
  assert.equal(claimRefund("REVIEW-REFUND-A"), true);
});

test("refund route: a retried requestId (same PayPal refund) is flagged replayed, not rolled back again", async () => {
  setPayPalKeys();
  mockFetch(paypal("REVIEW-REFUND-B"));
  const first = await (await refundRoute(refundRequest({ captureId: "CAPTURE9", requestId: "monte-review-0001" }))).json();
  const again = await (await refundRoute(refundRequest({ captureId: "CAPTURE9", requestId: "monte-review-0001" }))).json();
  assert.equal(first.replayed, false);
  assert.equal(again.replayed, true);
  assert.equal(again.refundId, "REVIEW-REFUND-B");
  assert.equal(again.rollback.rewardReversed, first.rollback.rewardReversed, "the receipt is the same");
});

test("refund route: a completed refund never 500s because the rollback can't be priced", async () => {
  setPayPalKeys();
  // A Monte order ref whose card is no longer in the catalog: rollbackRefund throws.
  const parts = ref().split("|");
  parts[1] = "retired_card";
  mockFetch(paypal("REVIEW-REFUND-C", parts.join("|")));
  const res = await refundRoute(refundRequest({ captureId: "CAPTURE9" }));
  assert.equal(res.status, 200, "the money already moved; the receipt must come back");
  const data = await res.json();
  assert.equal(data.refundId, "REVIEW-REFUND-C");
  assert.equal(data.rollback, null);
});

// ---------- rollback math ----------

test("rollbackRefund: a counter already below zero is not pushed up", () => {
  const txn: Txn = { id: "paypal-X", date: DEMO_TAP_DATE, merchant: "Trader Joe's", amount: 84, category: "groceries", cardUsed: "amex_gold" };
  const r = rollbackRefund([{ card_id: "amex_gold", pool_key: "amex_gold|groceries||25000|year", period_key: "2026", consumed: -5 }], txn, 84);
  assert.equal(r.rows[0].consumed, -5);
  assert.equal(r.capReleased, 0);
});

// ---------- Plaid: sandbox only ----------

function setPlaidKeys(env: string) {
  process.env.PLAID_CLIENT_ID = "plaid-client";
  process.env.PLAID_SECRET = "plaid-secret";
  process.env.PLAID_ENV = env;
}

// exchange and data import next/headers, which plain node can't load; they use the same
// sandboxOnly() gate tested here, before anything else.
test("Plaid: sandboxOnly gates production, and link-token answers 503 there without calling Plaid", async () => {
  setPlaidKeys("production");
  mockFetch(() => assert.fail("should not reach Plaid"));
  assert.equal(sandboxOnly()?.status, 503);
  const res = await linkTokenRoute(new Request("http://localhost/api/plaid/link-token", { method: "POST", body: "{}" }));
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
  setPlaidKeys("sandbox");
  assert.equal(sandboxOnly(), null);
});

test("Plaid recurring: a malformed access-token cookie reads as not linked, not a 500", async () => {
  setPlaidKeys("sandbox");
  mockFetch(() => assert.fail("should not reach Plaid"));
  const res = await recurringRoute(new Request("http://localhost/api/plaid/recurring", { headers: { cookie: "monte_plaid_access_token=%E0%A4%A" } }));
  assert.equal(res.status, 409);
  assert.equal(calls.length, 0);
});
