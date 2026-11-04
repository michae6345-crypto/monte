// choose(): rewards minus the interest a purchase adds (lib/engine/interest.ts).
// Every expected number is hand-computed in a comment from data/cards.json's rules at the
// cash valuation (1 cent a point) and the APRs given here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { setValuation, tap, type Holding } from "@/lib/engine";
import { choose, purchaseInterest } from "@/lib/engine/interest";
import { revolvingBalance } from "@/lib/data/plaid";

setValuation("cash");
const at = (merchant: string, category: string, amount: number) => ({ date: "2026-10-20", merchant, category, amount });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} vs ${b}`);

test("interest: nothing on a card paid in full; a month of APR on one with a balance", () => {
  near(purchaseInterest({ cardId: "apple_card" }, 100), 0);
  near(purchaseInterest({ cardId: "apple_card", balance: 0 }, 100), 0);
  // $100 × 24% / 12 = $2.00
  near(purchaseInterest({ cardId: "apple_card", balance: 500, apr: 24 }, 100), 2);
  // three months: $100 × 24% × 3/12 = $6.00
  near(purchaseInterest({ cardId: "apple_card", balance: 500, apr: 24 }, 100, 3), 6);
});

test("no balances anywhere: the same pick as tap(), net = reward", () => {
  const wallet: Holding[] = [{ cardId: "amex_gold" }, { cardId: "chase_freedom_unlimited" }];
  const d = choose(wallet, at("Sweetgreen", "dining", 41.53));
  assert.equal(d.mode, "none");
  assert.equal(d.pick.cardId, tap(wallet, at("Sweetgreen", "dining", 41.53)).pick.cardId);
  // Gold 4x dining: $41.53 × 4 × 1¢ = $1.66
  assert.equal(d.pick.cardId, "amex_gold");
  near(d.pick.net, 1.66);
  assert.equal(d.skipped, undefined);
});

test("grace: a card paid in full beats a higher earner that carries a balance, and the skip is named", () => {
  const wallet: Holding[] = [
    { cardId: "amex_gold", balance: 1200, apr: 30 },
    { cardId: "chase_freedom_unlimited" },
  ];
  const d = choose(wallet, at("Sweetgreen", "dining", 100));
  assert.equal(d.mode, "grace");
  // CFU 3x dining = $3.00, no interest (grace period)
  assert.equal(d.pick.cardId, "chase_freedom_unlimited");
  near(d.pick.net, 3);
  // Gold would earn $4.00 but adds $100 × 30% / 12 = $2.50 of interest in its first month
  assert.equal(d.skipped?.cardId, "amex_gold");
  near(d.skipped!.reward, 4);
  near(d.skipped!.interest, 2.5);
  assert.ok(d.skipped!.blocked, "the skipped card keeps tap()'s reason");
});

test("all cards carry a balance: nothing is off limits, reward minus interest decides", () => {
  const wallet: Holding[] = [
    { cardId: "amex_gold", balance: 1200, apr: 30 },
    { cardId: "chase_freedom_unlimited", balance: 800, apr: 20 },
  ];
  // dining $100: Gold $4.00 − $2.50 = $1.50; CFU $3.00 − $100×20%/12 ($1.67) = $1.33 -> Gold
  const dining = choose(wallet, at("Sweetgreen", "dining", 100));
  assert.equal(dining.mode, "all");
  assert.equal(dining.pick.cardId, "amex_gold");
  near(dining.pick.net, 1.5);
  assert.equal(dining.pick.blocked, undefined);
  assert.equal(dining.skipped, undefined);
  // everything else $100: Gold 1x $1.00 − $2.50 = −$1.50; CFU 1.5x $1.50 − $1.67 = −$0.17 -> CFU (lower APR)
  const misc = choose(wallet, at("Hardware store", "everything_else", 100));
  assert.equal(misc.pick.cardId, "chase_freedom_unlimited");
  near(misc.pick.net, 1.5 - 100 * 0.2 / 12);
});

test("Plaid: a card paid in full is not carrying a balance, whatever its current balance", () => {
  const acct = { account_id: "a", name: "Card", balances: { current: 640 } };
  // balance_subject_to_apr is what accrues: it wins when present
  assert.equal(revolvingBalance(acct, { aprs: [{ apr_percentage: 24, apr_type: "purchase_apr", balance_subject_to_apr: 410.22 }] }), 410.22);
  // statement $395.50 paid in full -> nothing revolving, though $640 is on the card now
  assert.equal(revolvingBalance(acct, { aprs: [{ apr_percentage: 24, apr_type: "purchase_apr" }], last_statement_balance: 395.5, last_payment_amount: 395.5 }), 0);
  // statement $395.50, $100 paid -> $295.50 revolving
  assert.equal(revolvingBalance(acct, { aprs: [], last_statement_balance: 395.5, last_payment_amount: 100 }), 295.5);
  // no liability data at all: not assumed to be debt
  assert.equal(revolvingBalance(acct, undefined), 0);
});

test("the ranked list covers every card once, the pick first", () => {
  const wallet: Holding[] = [
    { cardId: "amex_gold", balance: 1200, apr: 30 },
    { cardId: "chase_freedom_unlimited" },
    { cardId: "apple_card" },
  ];
  const d = choose(wallet, at("Trader Joe's", "groceries", 60));
  assert.equal(d.ranked.length, 3);
  assert.equal(new Set(d.ranked.map((c) => c.cardId)).size, 3);
  assert.equal(d.ranked[0].cardId, d.pick.cardId);
  assert.ok(!d.pick.carries);
});
