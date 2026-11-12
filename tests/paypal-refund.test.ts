// Returns put the cap back: refund a sandbox capture, in full or in part, and the cap counter and
// rewards roll back by exactly what came back. PayPal and Supabase are mocked.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Txn } from "@/lib/engine";
import type { CapRow } from "@/lib/db/cap-state";
import { JORDAN } from "@/lib/data/personas";
import { PAYPAL_API, refundCapture } from "@/lib/paypal/client";
import { persistRefund } from "@/lib/paypal/persist";
import { DEMO_TAP_DATE, encodeOrderRef, planCheckout } from "@/lib/paypal/plan";
import { refundValue, rollbackRefund } from "@/lib/paypal/refund";
import { POST as refundRoute } from "@/app/api/paypal/refund/route";

const POOL = "amex_gold|groceries||25000|year";
const TXN: Txn = { id: "paypal-CAPTURE9", date: DEMO_TAP_DATE, merchant: "Trader Joe's", amount: 84, category: "groceries", cardUsed: "amex_gold" };
// $100 of groceries earlier this year, then this $84 capture: the counter reads $184.
const ROWS: CapRow[] = [
  { card_id: "amex_gold", pool_key: POOL, period_key: "2026", consumed: 184 },
  { card_id: "amex_gold", pool_key: "amex_gold|dining||50000|year", period_key: "2026", consumed: 40 },
];

// ---------- the math ----------

test("refundValue: two decimals, positive, nothing else", () => {
  assert.equal(refundValue("21"), "21.00");
  assert.equal(refundValue("21.5"), "21.50");
  assert.equal(refundValue(0.01), "0.01");
  assert.equal(refundValue(" 84.00 "), "84.00");
  for (const bad of ["1.234", "0", "0.00", "-5", "abc", "", "1e3", NaN, Infinity, null, {}]) assert.equal(refundValue(bad), null, String(bad));
});

test("full refund: the cap counter goes back to where it was and the whole reward reverses", () => {
  const r = rollbackRefund(ROWS, TXN, 84);
  assert.equal(r.rows[0].consumed, 100);
  assert.equal(r.capReleased, 84);
  assert.equal(r.rewardOriginal, 3.36); // $84 x 4x x 1c
  assert.equal(r.rewardReversed, 3.36);
  assert.equal(r.rows[1].consumed, 40, "a pool the purchase never touched stays put");
  assert.equal(ROWS[0].consumed, 184, "the input rows aren't mutated");
});

test("partial refund: the counter drops by the refund, the reward reverses in proportion", () => {
  const r = rollbackRefund(ROWS, TXN, 21);
  assert.equal(r.rows[0].consumed, 163);
  assert.equal(r.capReleased, 21);
  assert.equal(r.rewardReversed, 0.84); // 3.36 x 21/84
  const twice = rollbackRefund(r.rows, TXN, 63);
  assert.equal(twice.rows[0].consumed, 100, "two partials add up to the full refund");
  assert.equal(r.rewardReversed + twice.rewardReversed, 3.36);
});

test("rollback never takes a counter below zero, and refuses impossible refunds", () => {
  const r = rollbackRefund([{ card_id: "amex_gold", pool_key: POOL, period_key: "2026", consumed: 30 }], TXN, 84);
  assert.equal(r.rows[0].consumed, 0);
  assert.equal(r.capReleased, 30);
  assert.throws(() => rollbackRefund(ROWS, TXN, 84.01));
  assert.throws(() => rollbackRefund(ROWS, TXN, 0));
  assert.throws(() => rollbackRefund(ROWS, { ...TXN, amount: 0 }, 1));
});

test("no counters (the demo people): rewards still reverse, nothing to release", () => {
  const r = rollbackRefund([], TXN, 42);
  assert.deepEqual(r.rows, []);
  assert.equal(r.capReleased, 0);
  assert.equal(r.rewardReversed, 1.68);
});

// ---------- the route, with PayPal mocked ----------

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV"] as const;
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
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});
function setKeys() {
  process.env.PAYPAL_CLIENT_ID = `sb-refund-client-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
}

const request = (body: unknown) => new Request("http://localhost/api/paypal/refund", { method: "POST", body: JSON.stringify(body) });
const ref = () => encodeOrderRef(planCheckout(JORDAN.wallet, { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE }, []));
const captureRecord = (status = "COMPLETED") => ({ id: "CAPTURE9", status, custom_id: ref(), amount: { currency_code: "USD", value: "84.00" } });
/** GET capture answers with the record; POST refund answers with `refund`. */
const paypal = (refund: Reply, capture = captureRecord()) => (url: string, init: RequestInit): Reply =>
  init.method === "GET" ? { body: capture } : url.endsWith("/refund") ? refund : assert.fail(`unexpected ${url}`);
const headersOf = (i: number) => calls[i].init.headers as Record<string, string>;

test("refundCapture: POST to the capture's refund URL with a PayPal-Request-Id", async () => {
  setKeys();
  mockPayPal(() => ({ status: 201, body: { id: "REFUND1", status: "COMPLETED", amount: { currency_code: "USD", value: "21.00" } } }));
  const r = await refundCapture("CAPTURE9", "21.00", "monte-refund-0001");
  assert.equal(calls[1].url, `${PAYPAL_API}/v2/payments/captures/CAPTURE9/refund`);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(headersOf(1)["paypal-request-id"], "monte-refund-0001");
  assert.equal(headersOf(1).authorization, "Bearer sandbox-token");
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { amount: { currency_code: "USD", value: "21.00" } });
  assert.deepEqual(r, { refundId: "REFUND1", status: "COMPLETED", value: "21.00", currency: "USD", requestId: "monte-refund-0001" });

  await refundCapture("CAPTURE9");
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), {}, "no amount means a full refund");
  assert.match(headersOf(2)["paypal-request-id"], /^[0-9a-f-]{36}$/, "a fresh id when the caller gives none");
});

test("without keys the refund route answers 503 and calls nothing", async () => {
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const res = await refundRoute(request({ captureId: "CAPTURE9" }));
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});

test("bad refunds are refused before PayPal hears about them", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const cases = [
    {},
    { captureId: "../../v1/oauth2/token" },
    { captureId: "CAP 9" },
    { captureId: 42 },
    { captureId: "CAPTURE9", amount: "1.234" },
    { captureId: "CAPTURE9", amount: -5 },
    { captureId: "CAPTURE9", amount: "0.00" },
    { captureId: "CAPTURE9", requestId: "x" },
    { captureId: "CAPTURE9", requestId: "has spaces in it" },
  ];
  for (const c of cases) assert.equal((await refundRoute(request(c))).status, 400, JSON.stringify(c));
  assert.equal(calls.length, 0);
});

test("a refund larger than the capture is refused, and nothing is refunded", async () => {
  setKeys();
  mockPayPal(paypal({ body: assert.fail }));
  const res = await refundRoute(request({ captureId: "CAPTURE9", amount: "84.01" }));
  assert.equal(res.status, 400);
  assert.ok(!calls.some((c) => c.url.endsWith("/refund")));
});

test("full refund (demo person): returns the status and the reward to reverse", async () => {
  setKeys();
  mockPayPal(paypal({ status: 201, body: { id: "REFUND1", status: "COMPLETED", amount: { currency_code: "USD", value: "84.00" } } }));
  const res = await refundRoute(request({ captureId: "CAPTURE9", requestId: "monte-refund-full-1" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(calls[1].url, `${PAYPAL_API}/v2/payments/captures/CAPTURE9`);
  assert.equal(headersOf(2)["paypal-request-id"], "monte-refund-full-1");
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), {});
  assert.equal(data.status, "COMPLETED");
  assert.equal(data.refundId, "REFUND1");
  assert.equal(data.refunded, "84.00");
  assert.equal(data.txnId, "paypal-CAPTURE9");
  assert.deepEqual(data.cap, { store: "memory" });
  assert.deepEqual(data.rollback, { cardId: "amex_gold", category: "groceries", refunded: 84, capReleased: 0, rewardOriginal: 3.36, rewardReversed: 3.36 });
});

test("partial refund: PayPal is asked for exactly that amount, rewards reverse in proportion", async () => {
  setKeys();
  mockPayPal(paypal({ status: 201, body: { id: "REFUND2", status: "COMPLETED", amount: { currency_code: "USD", value: "21.00" } } }));
  const data = await (await refundRoute(request({ captureId: "CAPTURE9", amount: 21 }))).json();
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), { amount: { currency_code: "USD", value: "21.00" } });
  assert.ok(headersOf(2)["paypal-request-id"]);
  assert.equal(data.refunded, "21.00");
  assert.equal(data.rollback.rewardReversed, 0.84);
});

test("a refund that isn't COMPLETED yet moves no counter", async () => {
  setKeys();
  mockPayPal(paypal({ status: 201, body: { id: "REFUND3", status: "PENDING" } }));
  const data = await (await refundRoute(request({ captureId: "CAPTURE9" }))).json();
  assert.equal(data.status, "PENDING");
  assert.equal(data.rollback, null);
});

test("already refunded, or not a Monte capture, reads as a conflict", async () => {
  setKeys();
  mockPayPal(paypal({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "CAPTURE_FULLY_REFUNDED" }] } }));
  const res = await refundRoute(request({ captureId: "CAPTURE9" }));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "already_refunded");

  mockPayPal(paypal({ body: assert.fail }, { ...captureRecord(), custom_id: "someone-else" }));
  assert.equal((await refundRoute(request({ captureId: "CAPTURE9" }))).status, 409);
  mockPayPal(paypal({ body: assert.fail }, captureRecord("REFUNDED")));
  assert.equal((await refundRoute(request({ captureId: "CAPTURE9" }))).status, 409);
});

test("signed in: the refund rolls cap_state back through the same rows", async () => {
  let upserted: unknown[] = [];
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { card_id: "amex_gold" }, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: table === "cap_state" ? ROWS.map((r) => ({ ...r, consumed: String(r.consumed) })) : [], error: null }),
      upsert: async (rows: unknown[]) => {
        upserted = rows;
        return { error: null };
      },
    };
    return chain;
  };
  const r = await persistRefund({ from: query } as unknown as SupabaseClient, "user-1", TXN, 21);
  assert.equal(r?.rewardReversed, 0.84);
  assert.deepEqual(upserted, [{ card_id: "amex_gold", pool_key: POOL, period_key: "2026", consumed: 163, user_id: "user-1" }]);
});
