// Pay in 4 vs. the card that carries a balance. Expected numbers are worked out by hand:
// amortized payment = P * r / (1 - (1 + r)^-n), r = APR / 12, interest = payment * n - P.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JORDAN } from "@/lib/data/personas";
import { DEMO_TAP_DATE } from "@/lib/paypal/plan";
import { balanceCard, cardPayoff, comparePayLater, payIn4Eligible, payIn4Schedule, payLaterLine, PAY_LATER_FINE_PRINT } from "@/lib/paypal/paylater";

test("Pay in 4 eligibility: $30 to $1,500 inclusive", () => {
  for (const ok of [30, 64.2, 1500]) assert.equal(payIn4Eligible(ok).eligible, true, String(ok));
  for (const no of [29.99, 16.5, 1500.01, 0, -1, NaN]) assert.equal(payIn4Eligible(no).eligible, false, String(no));
  assert.match(payIn4Eligible(16.5).reason!, /starts at \$30/);
  assert.match(payIn4Eligible(2000).reason!, /\$1,500/);
});

test("schedule: 4 payments every 2 weeks, cents add up, leftover cent on the first", () => {
  const s = payIn4Schedule(64.2, "2026-10-18");
  assert.deepEqual(s.map((i) => i.date), ["2026-10-18", "2026-11-01", "2026-11-15", "2026-11-29"]);
  assert.deepEqual(s.map((i) => i.amount), [16.05, 16.05, 16.05, 16.05]);
  const odd = payIn4Schedule(100.01, "2026-12-25");
  assert.deepEqual(odd.map((i) => i.amount), [25.01, 25, 25, 25]);
  assert.deepEqual(odd.map((i) => i.date), ["2026-12-25", "2027-01-08", "2027-01-22", "2027-02-05"]);
  for (const amt of [30, 33.33, 99.99, 1499.99]) {
    const total = payIn4Schedule(amt, "2026-01-01").reduce((t, i) => t + Math.round(i.amount * 100), 0);
    assert.equal(total, Math.round(amt * 100), String(amt));
  }
});

test("card payoff: $64.20 at 26.24% over 12 months is $6.14/month and $9.49 interest", () => {
  assert.deepEqual(cardPayoff(64.2, 26.24, 12), { payment: 6.14, interest: 9.49 });
  assert.deepEqual(cardPayoff(84, 26.24, 12), { payment: 8.03, interest: 12.41 });
  assert.deepEqual(cardPayoff(120, 0, 12), { payment: 10, interest: 0 });
  // paying it off faster costs less interest
  assert.ok(cardPayoff(500, 26.24, 3).interest < cardPayoff(500, 26.24, 12).interest);
});

test("Jordan: compared with Apple Card at 26.24%, the one card with a balance", () => {
  const bc = balanceCard(JORDAN.wallet);
  assert.equal(bc?.cardId, "apple_card");
  assert.equal(bc?.apr, 26.24);
  const c = comparePayLater(64.2, DEMO_TAP_DATE, JORDAN.wallet);
  assert.equal(c.eligible, true);
  assert.equal(c.months, 12);
  assert.equal(c.cardInterest, 9.49);
  assert.equal(c.interestAvoided, 9.49);
  assert.equal(c.schedule.length, 4);
  const line = payLaterLine(c);
  assert.match(line, /4 payments of about \$16\.05/);
  assert.match(line, /26\.24% APR/);
  assert.match(line, /\$9\.49 in interest/);
});

test("ineligible amounts: no schedule, nothing avoided, and the line says why", () => {
  const c = comparePayLater(16.5, DEMO_TAP_DATE, JORDAN.wallet);
  assert.equal(c.eligible, false);
  assert.deepEqual(c.schedule, []);
  assert.equal(c.interestAvoided, 0);
  assert.match(payLaterLine(c), /starts at \$30/);
});

test("no balance anywhere: schedule only, no interest claim", () => {
  const wallet = JORDAN.wallet.map((h) => ({ ...h, balance: 0 }));
  const c = comparePayLater(64.2, DEMO_TAP_DATE, wallet);
  assert.equal(c.card, null);
  assert.equal(c.interestAvoided, 0);
  assert.doesNotMatch(payLaterLine(c), /in interest/);
  assert.doesNotMatch(payLaterLine(c), /APR/);
});

test("never framed as free money: eligibility and late fees are in the fine print", () => {
  assert.match(PAY_LATER_FINE_PRINT, /approving you/);
  assert.match(PAY_LATER_FINE_PRINT, /late payment can carry a fee/);
});
