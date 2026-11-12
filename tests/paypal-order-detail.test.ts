// Richer, auditable orders: the order Monte creates is itemized for PayPal's review page, its
// item_total is the engine's amount to the cent, and GET /api/paypal/order/{id} reads back what
// PayPal says about it. PayPal is mocked.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { getOrder, itemCategory, PAYPAL_API, purchaseUnitForPlan, softDescriptor } from "@/lib/paypal/client";
import { DEMO_TAP_DATE, decodeOrderRef, encodeOrderRef, planCheckout, type Purchase } from "@/lib/paypal/plan";
import { POST as createOrderRoute } from "@/app/api/paypal/create-order/route";
import { GET as orderRoute } from "@/app/api/paypal/order/[id]/route";

const TJ: Purchase = { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE };
const jordanYear = () => yearOf(JORDAN).filter((t) => t.date.startsWith("2026") && t.date <= DEMO_TAP_DATE);
const plan = (p: Purchase = TJ) => planCheckout(JORDAN.wallet, p, jordanYear());

// ---------- the purchase unit ----------

test("itemized: one line for the engine's purchase, and item_total is exactly amount.value", () => {
  for (const amount of [84, 0.01, 64.2, 1234.56, 9999.99]) {
    const p = plan({ ...TJ, amount });
    const unit = purchaseUnitForPlan(p);
    assert.equal(unit.amount.value, p.orderValue);
    assert.equal(unit.amount.breakdown.item_total.value, unit.amount.value, `item_total for ${amount}`);
    assert.equal(unit.amount.breakdown.item_total.currency_code, unit.amount.currency_code);
    const lineSum = unit.items.reduce((s, i) => s + Math.round(Number(i.unit_amount.value) * 100) * Number(i.quantity), 0);
    assert.equal((lineSum / 100).toFixed(2), unit.amount.breakdown.item_total.value, "lines add up to item_total");
  }
  const unit = purchaseUnitForPlan(plan());
  assert.deepEqual(unit.items, [{ name: "Trader Joe's - groceries", quantity: "1", unit_amount: { currency_code: "USD", value: "84.00" }, category: "PHYSICAL_GOODS" }]);
});

test("the description names Monte's pick and stays within PayPal's 127 characters", () => {
  const p = plan();
  const unit = purchaseUnitForPlan(p);
  assert.ok(unit.description.startsWith(`Monte pick: ${p.pick!.name}.`), unit.description);
  const long = purchaseUnitForPlan(plan({ ...TJ, merchant: "M".repeat(120) }));
  assert.ok(long.description.length <= 127);
  assert.ok(long.description.startsWith("Monte pick: "));
  assert.ok(long.items[0].name.length <= 127);
});

test("custom_id is unchanged, so capture and refunds still read the card", () => {
  const p = plan();
  const unit = purchaseUnitForPlan(p);
  assert.equal(unit.custom_id, encodeOrderRef(p));
  assert.equal(decodeOrderRef(unit.custom_id)?.cardId, "amex_gold");
});

test("item category and soft descriptor follow PayPal's rules", () => {
  assert.equal(itemCategory("streaming"), "DIGITAL_GOODS");
  assert.equal(itemCategory("phone"), "DIGITAL_GOODS");
  assert.equal(itemCategory("groceries"), "PHYSICAL_GOODS");
  assert.equal(itemCategory("everything_else"), "PHYSICAL_GOODS");
  assert.equal(softDescriptor("Trader Joe's"), "MONTE Trader Joes");
  assert.equal(softDescriptor("A Very Long Merchant Name Indeed"), "MONTE A Very Long Merc");
  for (const m of ["Trader Joe's", "Café ☕ & Co!", "x".repeat(60)]) {
    const s = softDescriptor(m)!;
    assert.ok(s.length <= 22 && /^[A-Za-z0-9 .*-]+$/.test(s), s);
  }
  assert.equal(softDescriptor("☕☕"), null);
  assert.equal("soft_descriptor" in purchaseUnitForPlan(plan({ ...TJ, merchant: "☕" })), false);
});

// ---------- the routes, with PayPal mocked ----------

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
  process.env.PAYPAL_CLIENT_ID = `sb-detail-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
}

const get = (id: string) => orderRoute(new Request(`http://localhost/api/paypal/order/${id}`), { params: Promise.resolve({ id }) });

const customId = () => encodeOrderRef(plan());
const orderBody = (captureStatus: string, refunds: { id: string; status: string; amount: { currency_code: string; value: string } }[] = []) => ({
  id: "ORDER123",
  status: "COMPLETED",
  create_time: "2026-10-18T17:00:00Z",
  purchase_units: [
    {
      reference_id: "monte",
      custom_id: customId(),
      description: "Monte pick: American Express Gold Card. Trader Joe's (groceries), Monte sandbox demo",
      amount: { currency_code: "USD", value: "84.00", breakdown: { item_total: { currency_code: "USD", value: "84.00" } } },
      items: [{ name: "Trader Joe's - groceries", quantity: "1", unit_amount: { currency_code: "USD", value: "84.00" }, category: "PHYSICAL_GOODS" }],
      payments: { captures: [{ id: "CAPTURE9", status: captureStatus, amount: { currency_code: "USD", value: "84.00" } }], refunds },
    },
  ],
});

test("create-order sends the itemized unit to PayPal", async () => {
  setKeys();
  mockPayPal(() => ({ status: 201, body: { id: "ORDER123", status: "CREATED" } }));
  const res = await createOrderRoute(
    new Request("http://localhost/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ purchase: { merchant: TJ.merchant, category: TJ.category, amount: TJ.amount }, wallet: JORDAN.wallet, history: jordanYear(), date: TJ.date }),
    }),
  );
  assert.equal(res.status, 200);
  const unit = JSON.parse(String(calls[1].init.body)).purchase_units[0];
  assert.equal(unit.amount.value, "84.00");
  assert.equal(unit.amount.breakdown.item_total.value, unit.amount.value);
  assert.equal(unit.items.length, 1);
  assert.match(unit.description, /^Monte pick: /);
});

test("order detail: 503 without keys, and PayPal is never called", async () => {
  mockPayPal(() => assert.fail("should not reach PayPal"));
  const res = await get("ORDER123");
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "paypal_not_configured" });
  assert.equal(calls.length, 0);
});

test("order detail: an id that could change the URL is refused before PayPal hears about it", async () => {
  setKeys();
  mockPayPal(() => assert.fail("should not reach PayPal"));
  for (const bad of ["../x", "ab", "ORDER/123", "ORDER?x=1", "a".repeat(65), "ORDER 1"]) assert.equal((await get(bad)).status, 400, bad);
  assert.equal(calls.length, 0);
});

test("order detail: status, amount, items, capture and the card Monte remembered", async () => {
  setKeys();
  mockPayPal(() => ({ body: orderBody("COMPLETED") }));
  const res = await get("ORDER123");
  assert.equal(res.status, 200);
  assert.equal(calls[1].url, `${PAYPAL_API}/v2/checkout/orders/ORDER123`);
  assert.equal(calls[1].init.method, "GET");
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, "Bearer sandbox-token");
  const d = await res.json();
  assert.equal(d.status, "COMPLETED");
  assert.equal(d.value, "84.00");
  assert.equal(d.currency, "USD");
  assert.deepEqual(d.items, [{ name: "Trader Joe's - groceries", quantity: "1", value: "84.00", currency: "USD", category: "PHYSICAL_GOODS" }]);
  assert.deepEqual(d.captures, [{ id: "CAPTURE9", status: "COMPLETED", value: "84.00" }]);
  assert.equal(d.refundStatus, "NONE");
  assert.equal(d.refunded, "0.00");
  assert.equal(d.ref.cardId, "amex_gold");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("order detail: partial and full refunds read from PayPal's own statuses", async () => {
  setKeys();
  const r1 = { id: "REFUND1", status: "COMPLETED", amount: { currency_code: "USD", value: "21.00" } };
  const r2 = { id: "REFUND2", status: "COMPLETED", amount: { currency_code: "USD", value: "63.00" } };
  mockPayPal(() => ({ body: orderBody("PARTIALLY_REFUNDED", [r1]) }));
  let d = await getOrder("ORDER123");
  assert.equal(d.refundStatus, "PARTIAL");
  assert.equal(d.refunded, "21.00");
  mockPayPal(() => ({ body: orderBody("REFUNDED", [r1, r2]) }));
  d = await getOrder("ORDER123");
  assert.equal(d.refundStatus, "FULL");
  assert.equal(d.refunded, "84.00");
  assert.deepEqual(d.refunds.map((r) => r.id), ["REFUND1", "REFUND2"]);
});

test("order detail: an unpaid order has no captures; unknown is 404; failures never echo credentials", async () => {
  setKeys();
  mockPayPal(() => ({ body: { id: "ORDER9", status: "CREATED", purchase_units: [{ amount: { currency_code: "USD", value: "5.00" } }] } }));
  let d = await (await get("ORDER9")).json();
  assert.equal(d.status, "CREATED");
  assert.deepEqual(d.captures, []);
  assert.equal(d.refundStatus, "NONE");
  assert.equal(d.ref, null);

  mockPayPal(() => ({ status: 404, body: { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] } }));
  let res = await get("ORDER404");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "order_not_found" });

  mockPayPal(() => ({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "dbg1" } }));
  res = await get("ORDER500");
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes("sb-secret") && !text.includes("sandbox-token"));
  d = JSON.parse(text);
  assert.equal(d.error, "paypal_error");
});
