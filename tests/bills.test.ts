// cardBills(): what's due on each card, from Plaid Liabilities and the account's limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeed, cardBills } from "@/lib/data/plaid";

const accounts = [
  { account_id: "a1", name: "Chase Freedom Unlimited", type: "credit", balances: { current: 1210.5, limit: 3000 } },
  { account_id: "a2", name: "Amex Gold Card", type: "credit", balances: { current: 0, limit: 10000 } },
  { account_id: "chk", name: "Plaid Checking", type: "depository", balances: { current: 900 } },
];
const credit = [
  { account_id: "a1", aprs: [{ apr_percentage: 27.99, apr_type: "purchase_apr", balance_subject_to_apr: 800 }], last_statement_balance: 950, minimum_payment_amount: 35, next_payment_due_date: "2026-11-21", is_overdue: false },
  { account_id: "a2", aprs: [], last_statement_balance: 0, minimum_payment_amount: 0, next_payment_due_date: null, is_overdue: true },
];

test("bills: due date, minimum, statement, limit and what's on the card now, per catalog card", () => {
  const b = cardBills(accounts, credit);
  assert.deepEqual(Object.keys(b).sort(), ["amex_gold", "chase_freedom_unlimited"]); // checking is not a card
  assert.deepEqual(b.chase_freedom_unlimited, { dueDate: "2026-11-21", minimum: 35, statement: 950, limit: 3000, owedNow: 1210.5 });
  assert.equal(b.amex_gold.overdue, true);
  assert.equal(b.amex_gold.dueDate, undefined);
});

test("bills travel with the feed", () => {
  const feed = buildFeed({ transactions: [], accounts, credit });
  assert.equal(feed.bills.chase_freedom_unlimited.minimum, 35);
  // and the revolving balance is Plaid's balance subject to APR, not the $1,210.50 on the card now
  assert.equal(feed.wallet.find((h) => h.cardId === "chase_freedom_unlimited")?.balance, 800);
});
