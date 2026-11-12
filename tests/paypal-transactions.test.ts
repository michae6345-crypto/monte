// PayPal purchase import: Transaction Search JSON -> Monte Txn[], with PayPal mocked.
// The fixture is synthetic sandbox-style data (tests/fixtures/paypal-transaction-search.json).

import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fixture from "@/tests/fixtures/paypal-transaction-search.json";
import { PAYPAL_API } from "@/lib/paypal/client";
import { DEFAULT_CARD_ID } from "@/lib/data/plaid";
import {
  dateWindows,
  fetchPayPalTransactions,
  mapPayPalTransactions,
  MAX_WINDOW_DAYS,
  type PayPalTransactionDetail,
  type TransactionSearchPage,
} from "@/lib/paypal/transactions";
import { GET as transactionsRoute } from "@/app/api/paypal/transactions/route";

const pages = fixture.pages as TransactionSearchPage[];
const allDetails = pages.flatMap((p) => p.transaction_details ?? []) as PayPalTransactionDetail[];

// ---------- mapping ----------

test("PayPal mapping: payer-side completed USD payments become positive spend", () => {
  const { txns, dropped } = mapPayPalTransactions(allDetails, { cardUsed: "amex_gold" });
  assert.deepEqual(
    txns.map((t) => [t.id, t.date, t.merchant, t.amount, t.cardUsed]),
    [
      ["paypal-5TY05013RG002845M", "2026-03-04", "Amazon.com", 42.1, "amex_gold"],
      ["paypal-8KD43217XF447751A", "2026-03-07", "Netflix", 15.49, "amex_gold"],
      ["paypal-1AB23456CD789012E", "2026-03-09", "DoorDash", 28.75, "amex_gold"],
      ["paypal-0QR11122ST333444U", "2026-03-28", "Target", 63.12, "amex_gold"],
    ],
  );
  assert.ok(txns.every((t) => t.amount > 0));
  assert.deepEqual(dropped, { not_a_payment: 3, incoming: 1, not_completed: 1, not_usd: 1, excluded_category: 0, bad_row: 0 });
});

test("PayPal mapping: categories come from data/category_map.json, no model", () => {
  const byMerchant = Object.fromEntries(mapPayPalTransactions(allDetails).txns.map((t) => [t.merchant, t.category]));
  assert.equal(byMerchant["Netflix"], "streaming");
  assert.equal(byMerchant["Amazon.com"], "online_retail");
  assert.equal(byMerchant["DoorDash"], "dining");
  assert.equal(typeof byMerchant["Target"], "string");
});

test("PayPal mapping: default card, duplicate ids and broken rows", () => {
  const dup = [allDetails[1], allDetails[1], { transaction_info: { transaction_id: "X" } }, {}];
  const { txns, dropped } = mapPayPalTransactions(dup);
  assert.equal(txns.length, 1);
  assert.equal(txns[0].cardUsed, DEFAULT_CARD_ID);
  assert.equal(dropped.bad_row, 3);
});

test("PayPal mapping: refunds, fees and transfers never count, whatever their sign", () => {
  const codes = ["T1107", "T1106", "T0106", "T0400", "T0300", "T2201", "T0200"];
  const rows = codes.map((code, i) => ({
    transaction_info: {
      transaction_id: `R${i}`,
      transaction_event_code: code,
      transaction_initiation_date: "2026-05-01T00:00:00+0000",
      transaction_amount: { currency_code: "USD", value: "-10.00" },
      transaction_status: "S",
    },
  }));
  const { txns, dropped } = mapPayPalTransactions(rows);
  assert.equal(txns.length, 0);
  assert.equal(dropped.not_a_payment, codes.length);
});

// ---------- windows ----------

test("dateWindows: 12 months splits into contiguous chunks of at most 31 days", () => {
  const start = new Date("2025-11-12T00:00:00Z");
  const end = new Date("2026-11-12T00:00:00Z");
  const w = dateWindows(start, end);
  assert.equal(w.length, 12); // 365 days / 31 = 11.8
  assert.equal(w[0].start, "2025-11-12T00:00:00Z");
  assert.equal(w.at(-1)!.end, "2026-11-12T00:00:00Z");
  for (let i = 0; i < w.length; i++) {
    const span = Date.parse(w[i].end) - Date.parse(w[i].start);
    assert.ok(span <= MAX_WINDOW_DAYS * 86_400_000, `window ${i} is ${span}ms`);
    assert.ok(span >= 0);
    if (i > 0) assert.equal(Date.parse(w[i].start) - Date.parse(w[i - 1].end), 1000);
  }
  assert.deepEqual(dateWindows(end, start), []);
  assert.equal(dateWindows(start, start).length, 1);
});

// ---------- fetching ----------

type Call = { url: string; auth: string | null };

function fakeFetch(handler: (url: URL) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: input, auth: headers.get("authorization") });
    const { status, body } = handler(new URL(input));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

test("fetchPayPalTransactions: every window, every page, fields=all", async () => {
  const { calls, fetchImpl } = fakeFetch((url) => {
    // March has two pages of data; every other window is empty.
    if (url.searchParams.get("start_date")!.startsWith("2026-03")) {
      return { status: 200, body: pages[Number(url.searchParams.get("page")) - 1] };
    }
    return { status: 200, body: { transaction_details: [], page: 1, total_pages: 0 } };
  });
  const details = await fetchPayPalTransactions({
    start: new Date("2026-01-01T00:00:00Z"),
    end: new Date("2026-04-30T23:59:59Z"),
    token: "TEST_TOKEN",
    fetchImpl,
  });
  assert.equal(details.length, allDetails.length);
  // Jan 1-31, Feb 1-Mar 3, Mar 4-Apr 3 (two pages), Apr 4-30
  assert.equal(calls.length, 5);
  for (const c of calls) {
    const u = new URL(c.url);
    assert.equal(u.origin + u.pathname, `${PAYPAL_API}/v1/reporting/transactions`);
    assert.equal(u.searchParams.get("fields"), "all");
    assert.equal(c.auth, "Bearer TEST_TOKEN");
  }
  assert.deepEqual(calls.filter((c) => c.url.includes("start_date=2026-03")).map((c) => new URL(c.url).searchParams.get("page")), ["1", "2"]);
});

test("fetchPayPalTransactions: a PayPal error surfaces as an error, not as no purchases", async () => {
  const { fetchImpl } = fakeFetch(() => ({ status: 403, body: { name: "NOT_AUTHORIZED", message: "Authorization failed" } }));
  await assert.rejects(
    fetchPayPalTransactions({ start: new Date("2026-01-01Z"), end: new Date("2026-01-10Z"), token: "T", fetchImpl }),
    /Authorization failed/,
  );
});

// ---------- route ----------

const saved = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, env: process.env.PAYPAL_ENV };
afterEach(() => {
  for (const [k, v] of [["PAYPAL_CLIENT_ID", saved.id], ["PAYPAL_CLIENT_SECRET", saved.secret], ["PAYPAL_ENV", saved.env]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test("transactions route: 503 JSON without keys, and live keys count as no keys", async () => {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  let res = await transactionsRoute(new Request("http://localhost/api/paypal/transactions"));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "paypal_not_configured" });

  process.env.PAYPAL_CLIENT_ID = "x";
  process.env.PAYPAL_CLIENT_SECRET = "y";
  process.env.PAYPAL_ENV = "live";
  res = await transactionsRoute(new Request("http://localhost/api/paypal/transactions"));
  assert.equal(res.status, 503);
});

test("transactions route: bad months or card is a 400 before any PayPal call", async () => {
  process.env.PAYPAL_CLIENT_ID = "x";
  process.env.PAYPAL_CLIENT_SECRET = "y";
  process.env.PAYPAL_ENV = "sandbox";
  for (const q of ["months=0", "months=40", "months=abc", "card=not_a_card"]) {
    const res = await transactionsRoute(new Request(`http://localhost/api/paypal/transactions?${q}`));
    assert.equal(res.status, 400, q);
  }
});
