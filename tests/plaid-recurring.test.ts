// Plaid recurring streams -> Monte recurring charges, and the purchase-APR pick that feeds
// interest math. Fixtures are trimmed copies of real Plaid sandbox response shapes
// (/transactions/recurring/get, /liabilities/get). No network, no keys.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chargesPerYear, mapRecurring, normalizeStatus, yearlyCost, type PlaidRecurringResponse, type PlaidTransactionStream } from "@/lib/data/plaid-recurring";
import { DEFAULT_CARD_ID, mapWallet, purchaseApr, type PlaidAccount, type PlaidCreditLiability } from "@/lib/data/plaid";
import { GET as recurringRoute } from "@/app/api/plaid/recurring/route";

const CREDIT: PlaidAccount = {
  account_id: "acc_credit_1",
  name: "Plaid Credit Card",
  official_name: "Plaid Diamond 12.5% APR Interest Credit Card",
  mask: "3333",
  type: "credit",
  subtype: "credit card",
  balances: { current: 410, available: 1590, limit: 2000 },
};

function stream(over: Partial<PlaidTransactionStream>): PlaidTransactionStream {
  return {
    account_id: "acc_credit_1",
    stream_id: "stream_x",
    description: "NETFLIX.COM",
    merchant_name: "Netflix",
    first_date: "2025-11-14",
    last_date: "2026-10-14",
    predicted_next_date: "2026-11-14",
    frequency: "MONTHLY",
    transaction_ids: Array.from({ length: 12 }, (_, i) => `t${i}`),
    average_amount: { amount: 15.49, iso_currency_code: "USD" },
    last_amount: { amount: 15.49, iso_currency_code: "USD" },
    is_active: true,
    status: "MATURE",
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES", confidence_level: "VERY_HIGH" },
    ...over,
  };
}

const FIXTURE: PlaidRecurringResponse = {
  inflow_streams: [
    stream({
      stream_id: "in_payroll",
      description: "ACME PAYROLL",
      merchant_name: null,
      frequency: "BIWEEKLY",
      average_amount: { amount: -2150, iso_currency_code: "USD" },
      last_amount: { amount: -2150, iso_currency_code: "USD" },
      personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" },
    }),
  ],
  outflow_streams: [
    stream({ stream_id: "out_netflix" }),
    stream({
      stream_id: "out_gym",
      description: "PLANET FITNESS CLUB FEES",
      merchant_name: "Planet Fitness",
      frequency: "MONTHLY",
      average_amount: { amount: 24.99 },
      last_amount: { amount: 29.99 },
      personal_finance_category: { primary: "PERSONAL_CARE", detailed: "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS" },
    }),
    stream({
      stream_id: "out_coffee",
      description: "BLUE BOTTLE COFFEE",
      merchant_name: "Blue Bottle",
      frequency: "WEEKLY",
      first_date: "2026-08-01",
      transaction_ids: ["c1", "c2", "c3"],
      average_amount: { amount: 6.5 },
      last_amount: { amount: 6.5 },
      status: "EARLY_DETECTION",
      personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
    }),
    stream({
      stream_id: "out_hulu_dead",
      description: "HULU",
      merchant_name: "Hulu",
      last_date: "2026-03-02",
      is_active: false,
      status: "TOMBSTONED",
      average_amount: { amount: 7.99 },
      last_amount: { amount: 7.99 },
    }),
    stream({
      stream_id: "out_amazon_prime",
      description: "AMAZON PRIME*2K4",
      merchant_name: "Amazon Prime",
      frequency: "ANNUALLY",
      first_date: "2025-12-01",
      last_date: "2025-12-01",
      transaction_ids: ["p1"],
      average_amount: { amount: 139 },
      last_amount: { amount: 139 },
    }),
    stream({
      stream_id: "out_refund",
      description: "REFUND",
      merchant_name: null,
      average_amount: { amount: -12 },
      last_amount: { amount: -12 },
    }),
  ],
};

// ---------- frequency -> yearly cost ----------

test("chargesPerYear: every Plaid frequency normalizes to charges a year", () => {
  assert.equal(chargesPerYear("WEEKLY"), 52);
  assert.equal(chargesPerYear("BIWEEKLY"), 26);
  assert.equal(chargesPerYear("SEMI_MONTHLY"), 24);
  assert.equal(chargesPerYear("MONTHLY"), 12);
  assert.equal(chargesPerYear("ANNUALLY"), 1);
  assert.equal(chargesPerYear("monthly"), 12);
});

test("chargesPerYear: UNKNOWN falls back to the stream's own history, else null", () => {
  // 4 charges over 90 days = a 30-day gap -> 365/30 a year
  const n = chargesPerYear("UNKNOWN", { firstDate: "2026-01-01", lastDate: "2026-04-01", count: 4 });
  assert.equal(Math.round(n! * 100) / 100, Math.round((365 / 30) * 100) / 100);
  assert.equal(chargesPerYear("UNKNOWN", { firstDate: "2026-01-01", lastDate: "2026-01-01", count: 1 }), null);
  assert.equal(chargesPerYear("UNKNOWN"), null);
});

test("yearlyCost: average amount x frequency", () => {
  assert.equal(yearlyCost(15.49, "MONTHLY"), 185.88);
  assert.equal(yearlyCost(6.5, "WEEKLY"), 338);
  assert.equal(yearlyCost(100, "SEMI_MONTHLY"), 2400);
  assert.equal(yearlyCost(139, "ANNUALLY"), 139);
  assert.equal(yearlyCost(10, "UNKNOWN"), null);
});

test("normalizeStatus: MATURE active, EARLY_DETECTION kept, TOMBSTONED dead", () => {
  assert.equal(normalizeStatus("MATURE", true), "active");
  assert.equal(normalizeStatus("EARLY_DETECTION", true), "early_detection");
  assert.equal(normalizeStatus("TOMBSTONED", false), "tombstoned");
  assert.equal(normalizeStatus("UNKNOWN", true), "active");
  assert.equal(normalizeStatus("UNKNOWN", false), "tombstoned");
});

// ---------- the mapper ----------

test("mapRecurring: outflows only, tombstoned and refunds dropped, sorted by yearly cost", () => {
  const out = mapRecurring(FIXTURE, { accounts: [CREDIT] });
  assert.deepEqual(
    out.map((r) => r.streamId),
    ["out_coffee", "out_gym", "out_netflix", "out_amazon_prime"],
  );
  assert.equal(out.some((r) => r.streamId === "in_payroll"), false);
  assert.equal(out.some((r) => r.status === "tombstoned"), false);
  assert.equal(out.every((r) => r.source === "plaid-recurring"), true);
});

test("mapRecurring: the Netflix stream in Monte's Subscription shape", () => {
  const n = mapRecurring(FIXTURE, { accounts: [CREDIT] }).find((r) => r.streamId === "out_netflix")!;
  assert.equal(n.merchant, "Netflix");
  assert.equal(n.amount, 15.49);
  assert.equal(n.averageAmount, 15.49);
  assert.equal(n.perYear, 185.88);
  assert.equal(n.cadenceDays, 30);
  assert.equal(n.count, 12);
  assert.equal(n.frequency, "MONTHLY");
  assert.equal(n.lastDate, "2026-10-14");
  assert.equal(n.nextDate, "2026-11-14");
  assert.equal(n.accountId, "acc_credit_1");
  assert.equal(n.status, "active");
  assert.equal(n.priceHike, false);
  assert.equal(typeof n.category, "string");
});

test("mapRecurring: a last charge above the average is a price hike; early detection is kept", () => {
  const out = mapRecurring(FIXTURE, { accounts: [CREDIT] });
  const gym = out.find((r) => r.streamId === "out_gym")!;
  assert.equal(gym.priceHike, true);
  assert.equal(gym.amount, 29.99);
  assert.equal(gym.perYear, 299.88); // 24.99 x 12: yearly cost is on the average
  const coffee = out.find((r) => r.streamId === "out_coffee")!;
  assert.equal(coffee.status, "early_detection");
  assert.equal(coffee.perYear, 338);
  assert.equal(coffee.cadenceDays, 7);
});

test("mapRecurring: includeTombstoned keeps the cancelled stream; unknown account -> default card", () => {
  const out = mapRecurring(FIXTURE, { includeTombstoned: true });
  const hulu = out.find((r) => r.streamId === "out_hulu_dead")!;
  assert.equal(hulu.status, "tombstoned");
  assert.equal(hulu.cardId, DEFAULT_CARD_ID);
  const pinned = mapRecurring(FIXTURE, { cardByAccount: { acc_credit_1: "amex_gold" } });
  assert.equal(pinned.every((r) => r.cardId === "amex_gold"), true);
});

test("mapRecurring: empty or missing stream lists are fine", () => {
  assert.deepEqual(mapRecurring({}), []);
  assert.deepEqual(mapRecurring({ inflow_streams: null, outflow_streams: null }), []);
});

// ---------- APRs from /liabilities/get (already wired in mapWallet) ----------

const LIABILITY: PlaidCreditLiability = {
  account_id: "acc_credit_1",
  aprs: [
    { apr_percentage: 27.95, apr_type: "cash_apr", balance_subject_to_apr: 0 },
    { apr_percentage: 0, apr_type: "balance_transfer_apr", balance_subject_to_apr: 0 },
    { apr_percentage: 12.5, apr_type: "purchase_apr", balance_subject_to_apr: 410 },
    { apr_percentage: 29.99, apr_type: "special", balance_subject_to_apr: 0 },
  ],
  last_statement_balance: 410,
  minimum_payment_amount: 20,
  is_overdue: false,
};

test("purchaseApr: purchase_apr wins over cash, special and balance-transfer APRs", () => {
  assert.equal(purchaseApr(LIABILITY.aprs), 12.5);
});

test("purchaseApr: absent or zero purchase APR -> undefined (engine default applies)", () => {
  assert.equal(purchaseApr([{ apr_percentage: 27.95, apr_type: "cash_apr" }]), undefined);
  assert.equal(purchaseApr([{ apr_percentage: 0, apr_type: "purchase_apr" }]), undefined);
  assert.equal(purchaseApr([]), undefined);
  assert.equal(purchaseApr(null), undefined);
});

test("mapWallet: the bank's APR and balance reach the holding; no liability -> no APR", () => {
  const [h] = mapWallet([CREDIT], [LIABILITY]);
  assert.equal(h.apr, 12.5);
  assert.equal(h.balance, 410);
  const [bare] = mapWallet([CREDIT], []);
  assert.equal(bare.apr, undefined);
});

// ---------- the route ----------

test("GET /api/plaid/recurring: 409 plaid_not_linked with keys but no cookie", async () => {
  const saved = { id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET };
  process.env.PLAID_CLIENT_ID = "test-client";
  process.env.PLAID_SECRET = "test-secret";
  try {
    const res = await recurringRoute(new Request("http://localhost/api/plaid/recurring"));
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "plaid_not_linked" });
  } finally {
    if (saved.id === undefined) delete process.env.PLAID_CLIENT_ID;
    else process.env.PLAID_CLIENT_ID = saved.id;
    if (saved.secret === undefined) delete process.env.PLAID_SECRET;
    else process.env.PLAID_SECRET = saved.secret;
  }
});

test("GET /api/plaid/recurring: 503 plaid_not_configured without keys", async () => {
  const saved = { id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET };
  delete process.env.PLAID_CLIENT_ID;
  delete process.env.PLAID_SECRET;
  try {
    const res = await recurringRoute(new Request("http://localhost/api/plaid/recurring"));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "plaid_not_configured" });
  } finally {
    if (saved.id !== undefined) process.env.PLAID_CLIENT_ID = saved.id;
    if (saved.secret !== undefined) process.env.PLAID_SECRET = saved.secret;
  }
});
