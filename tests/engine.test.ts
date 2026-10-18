// Engine tests (SPEC #18): five hand-computed purchases across different rule kinds, the
// cap arithmetic (mid-purchase crossing, shared pools, per-category pools), and the three
// demo personas (invariants + headline snapshots so a regression is loud).
//
// Run from the repo root:
//   JITI_ALIAS='{"@":"<abs path to repo root>"}' npx jiti tests/engine.test.ts
// Exits non-zero if anything fails. Zero new dependencies: node:test + node:assert/strict.
//
// Every expected number below is hand-computed in a comment from the rule as it is written
// in data/cards.json. Nothing here reads a value back out of the engine to build its own
// expectation.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  earnOptions,
  eligibleCards,
  receipt,
  setValuation,
  simulate,
  tap,
  creditsUsed,
  interestFor,
  type Holding,
  type Txn,
} from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { JORDAN, MAYA, PARKS, yearOf, type Persona } from "@/lib/data/personas";

// ---------- helpers ----------

/** A transaction with sensible defaults; override only what the case is about. */
const txn = (o: Partial<Txn>): Txn => ({
  id: "t",
  date: "2026-11-15",
  merchant: "",
  amount: 0,
  category: "everything_else",
  cardUsed: "",
  ...o,
});

/** Round to cents, so hand arithmetic can be compared with ===. */
const cents = (n: number) => Math.round(n * 100) / 100;

/** Rewards for one purchase on one card with no cap usage yet. */
const rewardOf = (cardId: string, t: Txn) => evaluate(card(cardId), t, new Map(), null);

/** The cap-pool key the engine itself would use for the first rule matching this purchase.
 *  Taken from earnOptions() rather than rebuilt here, so cap tests can never key a pool
 *  differently from evaluate(). */
function capKey(cardId: string, t: Txn, ruleStartsWith: string): string {
  const o = earnOptions(card(cardId), t, null).find((x) => x.rule.startsWith(ruleStartsWith));
  assert.ok(o, `no rule starting "${ruleStartsWith}" applies to ${cardId} on ${t.category}/${t.merchant}`);
  assert.ok(o.cap, `rule "${o.rule}" has no cap`);
  return o.cap.key;
}

// ============================================================================
// FIVE HAND-COMPUTED PURCHASES, one per rule kind
// ============================================================================

// 1. PLAIN CATEGORY MULTIPLIER.
// Chase Freedom Unlimited, data/cards.json: { "category": "dining", "multiplier": 3 }
// ("restaurants incl. takeout and eligible delivery"), no cap. Cash card, 1c/point.
// $84.20 x 3% = $2.526 -> $2.53. (Beats the card's own 1.5x base.)
test("1/5 plain category multiplier: CFU 3x dining", () => {
  const e = rewardOf("chase_freedom_unlimited", txn({ merchant: "Sweetgreen", category: "dining", amount: 84.2 }));
  assert.equal(e.mult, 3);
  assert.equal(e.rule, "3x dining");
  assert.equal(cents(e.reward), 2.53);
  assert.equal(e.reward, (84.2 * 3 * 1) / 100);
});

// 2. MERCHANT-LIST RULE.
// Apple Card, data/cards.json: { "category": "gas", "multiplier": 3,
// "merchants": ["Exxon", "Mobil"] } ("3% at Apple and the ten named merchants with Apple
// Pay"). Cash card, 1c/point. $52.00 x 3% = $1.56.
// The card's 2x everything_else rule also applies here; 3% must win.
test("2/5 merchant-list rule: Apple Card 3x at Mobil beats its own 2x on everything", () => {
  const t = txn({ merchant: "Mobil", category: "gas", amount: 52 });
  const e = rewardOf("apple_card", t);
  assert.equal(e.mult, 3);
  assert.equal(e.rule, "3x at Exxon, Mobil");
  assert.equal(cents(e.reward), 1.56);
  // Same category at a merchant NOT on the list falls back to 2x on everything: $52 x 2% = $1.04.
  const off = rewardOf("apple_card", txn({ merchant: "Chevron", category: "gas", amount: 52 }));
  assert.equal(off.mult, 2);
  assert.equal(off.rule, "2x on everything");
  assert.equal(cents(off.reward), 1.04);
});

// 3. everything_else AND the bare base rate.
// Apple Card, data/cards.json: { "category": "everything_else", "multiplier": 2 }
// ("2% with Apple Pay"). $45.00 x 2% = $0.90.
// Chase Freedom Unlimited has no groceries rule, so groceries fall to its published
// base_multiplier 1.5: $110.00 x 1.5% = $1.65.
test("3/5 everything_else and base: Apple 2x on everything, CFU 1.5x base", () => {
  const e = rewardOf("apple_card", txn({ merchant: "Venmo", category: "everything_else", amount: 45 }));
  assert.equal(e.mult, 2);
  assert.equal(e.rule, "2x on everything");
  assert.equal(cents(e.reward), 0.9);

  const b = rewardOf("chase_freedom_unlimited", txn({ merchant: "Ralphs", category: "groceries", amount: 110 }));
  assert.equal(b.mult, 1.5);
  assert.equal(b.rule, "1.5x base");
  assert.equal(cents(b.reward), 1.65);
});

// 4. ROTATING Q4 CATEGORY.
// Discover it Cash Back, data/cards.json rotating: q4_2026 ["dining","entertainment",
// "utilities"], dates "2026-10-01 to 2026-12-31", multiplier 5, cap $1,500/quarter,
// after_cap_multiplier 1, activation_required true.
// $64.00 dining on 2026-11-15 x 5% = $3.20, and it consumes $64 of the quarter's pool.
// The same purchase on 2026-09-15 is outside the published window -> 1x base = $0.64.
test("4/5 rotating Q4 category: Discover it 5x dining inside the window only", () => {
  const t = txn({ merchant: "BCD Tofu House", category: "dining", amount: 64, date: "2026-11-15" });
  const e = rewardOf("discover_it_cash_back", t);
  assert.equal(e.mult, 5);
  assert.equal(e.rule, "5x Q4 rotating dining");
  assert.equal(cents(e.reward), 3.2);
  assert.deepEqual(e.consume, [{ pool: "discover_it_cash_back|rotating|2026-Q4", amount: 64 }]);

  const before = rewardOf("discover_it_cash_back", { ...t, date: "2026-09-15" });
  assert.equal(before.mult, 1);
  assert.equal(before.rule, "1x base");
  assert.equal(cents(before.reward), 0.64);
});

// 5. A POINTS CARD WHERE pointValue() MATTERS.
// Chase Sapphire Preferred, data/cards.json: { "category": "dining", "multiplier": 3 },
// currency "UR", point_value_cents 2.05 (The Points Guy, Oct 2026).
//   travel valuation: $84.20 x 3 x 2.05c = $5.1783 -> $5.18  (252.6 UR points)
//   cash   valuation: pointValue() = min(1, 2.05) = 1c, so $84.20 x 3% = $2.526 -> $2.53
test("5/5 points card: CSP 3x dining is $5.18 at travel value, $2.53 at cash value", () => {
  const t = txn({ merchant: "Sugarfish", category: "dining", amount: 84.2 });
  try {
    setValuation("travel");
    const e = rewardOf("chase_sapphire_preferred", t);
    assert.equal(e.mult, 3);
    assert.equal(e.rule, "3x dining");
    assert.equal(cents(e.reward), 5.18);
    assert.equal(e.reward, (84.2 * 3 * 2.05) / 100);
  } finally {
    setValuation("cash");
  }
  const cash = rewardOf("chase_sapphire_preferred", t);
  assert.equal(cents(cash.reward), 2.53);
});

// ============================================================================
// CAPS
// ============================================================================

// Blue Cash Everyday, data/cards.json: { "category": "groceries", "multiplier": 3,
// "cap": { "amount": 6000, "period": "year" }, "after_cap_multiplier": 1 }.
// With $5,900 of the $6,000 calendar-year pool used, a $200 grocery purchase straddles it:
//   in-cap $100 x 3x + over-cap $100 x 1x = 300 + 100 = 400 point-dollars
//   effective multiplier = 400 / 200 = 2.0x, reward = $200 x 2% = $4.00
// The NEXT grocery purchase (pool now full) earns the after-cap rate: $100 x 1% = $1.00.
test("cap crossed MID-purchase: BCE groceries blends to 2.0x, then 1x after", () => {
  const t = txn({ merchant: "Ralphs", category: "groceries", amount: 200, date: "2026-11-15" });
  const key = capKey("amex_blue_cash_everyday", t, "3x groceries");
  assert.equal(key, "amex_blue_cash_everyday|groceries||6000|year|2026");

  const used = new Map<string, number>([[key, 5900]]);
  const e = evaluate(card("amex_blue_cash_everyday"), t, used, null);
  assert.equal(e.mult, 2); // blended
  assert.equal(cents(e.reward), 4.0);
  assert.equal(e.rule, "3x groceries (cap $6,000/year)");
  assert.deepEqual(e.consume, [{ pool: key, amount: 100 }]); // only $100 of room was left

  // apply the consumption as simulate() would, then the next purchase
  for (const c of e.consume) used.set(c.pool, (used.get(c.pool) ?? 0) + c.amount);
  assert.equal(used.get(key), 6000);
  const next = evaluate(card("amex_blue_cash_everyday"), txn({ merchant: "Ralphs", category: "groceries", amount: 100, date: "2026-11-20" }), used, null);
  assert.equal(next.mult, 1); // after_cap_multiplier 1 == base_multiplier 1
  assert.equal(cents(next.reward), 1.0);
});

// Blue Cash Everyday's three 3% categories each have their OWN $6,000 calendar-year cap
// (its catalog notes say so explicitly, and capPool() encodes it: the pool id includes the
// rule's category). A full groceries pool must leave online_retail untouched at 3%.
test("per-category pools: BCE's groceries cap does not touch its online_retail cap", () => {
  const gro = txn({ merchant: "Ralphs", category: "groceries", amount: 100, date: "2026-11-20" });
  const online = txn({ merchant: "Amazon", category: "online_retail", amount: 100, date: "2026-11-20" });
  const groKey = capKey("amex_blue_cash_everyday", gro, "3x groceries");
  const onlineKey = capKey("amex_blue_cash_everyday", online, "3x online retail");
  assert.notEqual(groKey, onlineKey);

  const used = new Map<string, number>([[groKey, 6000]]);
  assert.equal(cents(evaluate(card("amex_blue_cash_everyday"), gro, used, null).reward), 1.0); // exhausted
  const e = evaluate(card("amex_blue_cash_everyday"), online, used, null);
  assert.equal(e.mult, 3);
  assert.equal(cents(e.reward), 3.0); // own pool, still full
});

// Citi Custom Cash: ONE $500-a-billing-cycle pool shared by all eleven 5% categories
// (SHARED_CAP_CARDS in lib/engine/index.ts; capPool() drops the category from the key).
// $400 of dining already used this cycle, then a $200 gas purchase:
//   in-cap $100 x 5x + over-cap $100 x 1x = 600 / 200 = 3.0x -> $200 x 3% = $6.00
test("shared pool: Citi Custom Cash's single $500/cycle spans categories", () => {
  const gas = txn({ merchant: "Mobil", category: "gas", amount: 200, date: "2026-11-20" });
  const dining = txn({ merchant: "Guisados", category: "dining", amount: 400, date: "2026-11-05" });
  const gasKey = capKey("citi_custom_cash", gas, "5x gas");
  const diningKey = capKey("citi_custom_cash", dining, "5x dining");
  assert.equal(gasKey, "citi_custom_cash|500|billing_cycle|2026-11");
  assert.equal(diningKey, gasKey); // same pool, different categories

  const e = evaluate(card("citi_custom_cash"), gas, new Map([[gasKey, 400]]), null);
  assert.equal(e.mult, 3);
  assert.equal(cents(e.reward), 6.0);

  // and the next billing cycle is a fresh pool
  const dec = txn({ ...gas, date: "2026-12-02" });
  assert.equal(capKey("citi_custom_cash", dec, "5x gas"), "citi_custom_cash|500|billing_cycle|2026-12");
});

// Bank of America Customized Cash Rewards: a combined $2,500-a-QUARTER pool across its 3%
// choice category and its 2% groceries/wholesale clubs (also in SHARED_CAP_CARDS).
test("shared pool: BofA Customized Cash's combined $2,500/quarter", () => {
  const gro = txn({ merchant: "Ralphs", category: "groceries", amount: 100, date: "2026-11-20" });
  const key = capKey("bofa_customized_cash_rewards", gro, "2x groceries");
  assert.equal(key, "bofa_customized_cash_rewards|2500|quarter|2026-Q4");
  const club = txn({ merchant: "Costco", category: "wholesale_clubs", amount: 300, date: "2026-12-20" });
  assert.equal(capKey("bofa_customized_cash_rewards", club, "2x wholesale clubs"), key); // same quarter, same pool
  // $2,400 used, then $300 at Costco: in-cap $100 x 2x + $200 x 1x = 400 / 300 = 1.3333x
  const e = evaluate(card("bofa_customized_cash_rewards"), club, new Map([[key, 2400]]), null);
  assert.equal(Math.round(e.mult * 10000) / 10000, 1.3333);
  assert.equal(cents(e.reward), 4.0); // $300 x 1.3333% = $4.00
});

// ============================================================================
// THE THREE PERSONAS: invariants, then headline snapshots
// ============================================================================

const PEOPLE: Persona[] = [JORDAN, MAYA, PARKS];

for (const p of PEOPLE) {
  test(`${p.name}: invariants`, () => {
    const tx = yearOf(p);
    const r = receipt(p.wallet, tx);

    // best play can never be worse than what actually happened
    assert.ok(
      r.best.total >= r.actual.total - 1e-9,
      `${p.name}: best ${r.best.total} < actual ${r.actual.total}`,
    );
    assert.equal(cents(r.leftOnTable), cents(Math.max(0, r.best.total - r.actual.total)));

    // the receipt adds up, to the cent
    assert.equal(cents(r.net), cents(r.rewards + r.credits - r.fees - r.interest));
    // and per card, from the catalog fee / the holding's credits and interest
    for (const h of p.wallet) {
      const row = r.perCard.find((x) => x.cardId === h.cardId)!;
      assert.equal(row.fee, card(h.cardId).annual_fee);
      assert.equal(cents(row.credits), cents(creditsUsed(h)));
      assert.equal(cents(row.interest), cents(interestFor(h)));
      assert.equal(cents(row.net), cents(row.rewards + row.credits - row.fee - row.interest));
    }
    assert.equal(cents(r.rewards), cents(r.actual.total));
    assert.equal(cents(r.spend), cents(tx.reduce((a, t) => a + t.amount, 0)));

    // the best policy never routes a new purchase to a card carrying a balance, unless
    // every card in the wallet carries one (SPEC: "never recommend a card with a balance")
    const carrying = new Set(p.wallet.filter((h) => (h.balance ?? 0) > 0).map((h) => h.cardId));
    const allCarry = carrying.size === p.wallet.length;
    for (const h of r.best.hits) {
      if (carrying.has(h.cardId)) {
        assert.ok(allCarry, `${p.name}: best play routed ${h.txnId} to ${h.cardId}, which carries a balance`);
      }
    }
    assert.deepEqual(
      eligibleCards(p.wallet),
      allCarry ? p.wallet.map((h) => h.cardId) : p.wallet.filter((h) => !(h.balance && h.balance > 0)).map((h) => h.cardId),
    );

    // tap() never picks a blocked card while an unblocked one is on the table
    const history = tx.filter((t) => t.date >= "2026-10-01");
    const probes: [string, string, number][] = [
      ["Mobil", "gas", 52],
      ["Sweetgreen", "dining", 16],
      ["Trader Joe's", "groceries", 64],
      ["Amazon", "online_retail", 45],
      ["Uber", "rideshare", 22],
      ["Delta", "airfare", 310],
      ["Netflix", "streaming", 15.49],
      ["Venmo", "everything_else", 40],
    ];
    for (const [merchant, category, amount] of probes) {
      const t = tap(p.wallet, { date: "2026-10-18", merchant, category, amount }, history);
      assert.equal(t.ranked.length, p.wallet.length);
      if (t.ranked.some((x) => !x.blocked)) {
        assert.ok(!t.pick.blocked, `${p.name}: tap picked blocked ${t.pick.cardId} for ${merchant}`);
      }
      // ranked is sorted by reward, best first
      for (let i = 1; i < t.ranked.length; i++) {
        assert.ok(t.ranked[i - 1].reward >= t.ranked[i].reward - 1e-9, `${p.name}: tap ranking out of order`);
      }
      // a blocked card is blocked because it carries a balance, and only then
      for (const o of t.ranked) {
        assert.equal(!!o.blocked, (p.wallet.find((h) => h.cardId === o.cardId)!.balance ?? 0) > 0);
      }
    }
  });
}

// When EVERY card carries a balance there is nothing clean to route to, so the best play
// may (and must be allowed to) use a balance-carrying card.
test("all cards carrying a balance: eligibleCards falls back to the whole wallet", () => {
  const wallet: Holding[] = [
    { cardId: "apple_card", balance: 2800, apr: 26.24 },
    { cardId: "discover_it_cash_back", balance: 1200, apr: 24.24 },
  ];
  assert.deepEqual(eligibleCards(wallet), ["apple_card", "discover_it_cash_back"]);
  const tx = yearOf(JORDAN).slice(0, 50);
  const best = simulate(wallet, tx, "best");
  assert.equal(best.hits.length, 50);
  assert.ok(best.total > 0);
  const t = tap(wallet, { date: "2026-10-18", merchant: "Mobil", category: "gas", amount: 52 }, []);
  assert.ok(t.pick.blocked, "with no clean card, tap's pick is necessarily a blocked one");
});

// ---------- headline snapshots (a regression here should be loud) ----------
//
// Measured on the integration base (commit 1e0a194) with the default "cash" valuation.
// Jordan's two numbers are the ones docs/SPEC.md's demo path advertises:
//   Receipt -$427  ->  -$427.03   (SPEC's rounded claim holds)
//   Replay  $104   ->   $104.14   (SPEC's rounded claim holds)

const SNAPSHOTS: Record<string, { txns: number; spend: number; rewards: number; credits: number; fees: number; interest: number; net: number; best: number; leftOnTable: number }> = {
  jordan: { txns: 576, spend: 23785.15, rewards: 552.69, credits: 80, fees: 325, interest: 734.72, net: -427.03, best: 656.83, leftOnTable: 104.14 },
  maya: { txns: 430, spend: 29681.86, rewards: 558.32, credits: 0, fees: 95, interest: 0, net: 463.32, best: 684.8, leftOnTable: 126.48 },
  parks: { txns: 492, spend: 40053.19, rewards: 511.03, credits: 0, fees: 0, interest: 290.88, net: 220.15, best: 737.13, leftOnTable: 226.1 },
};

for (const p of PEOPLE) {
  test(`${p.name}: headline snapshot`, () => {
    // Pin the valuation. It is module-level state, so without this the snapshots
    // depend on whatever ran before them, and the site sets it per person
    // (Maya is shown at travel, everyone else at cash).
    setValuation("cash");
    const s = SNAPSHOTS[p.id];
    const tx = yearOf(p);
    const r = receipt(p.wallet, tx);
    assert.equal(tx.length, s.txns);
    assert.equal(cents(r.spend), s.spend);
    assert.equal(cents(r.rewards), s.rewards);
    assert.equal(cents(r.credits), s.credits);
    assert.equal(cents(r.fees), s.fees);
    assert.equal(cents(r.interest), s.interest);
    assert.equal(cents(r.net), s.net);
    assert.equal(cents(r.best.total), s.best);
    assert.equal(cents(r.leftOnTable), s.leftOnTable);
  });
}

// The site shows Maya at travel valuation and everyone else at cash, so her headline on
// screen is not the cash snapshot above. Both are correct; they answer different
// questions. Pinned here so nobody quotes the wrong one on a slide.
test("Maya: cash and travel are different headlines, and both are hers", () => {
  const tx = yearOf(MAYA);
  setValuation("cash");
  const cash = receipt(MAYA.wallet, tx);
  setValuation("travel");
  const travel = receipt(MAYA.wallet, tx);
  setValuation("cash"); // leave the module as we found it

  assert.equal(cents(cash.net), 463.32);
  assert.equal(cents(travel.net), 944.19);
  // Travel points are worth more per point, so the same year earns more...
  assert.ok(travel.rewards > cash.rewards);
  // ...but the gap between cards narrows, so less is left on the table.
  assert.ok(travel.leftOnTable < cash.leftOnTable);
  assert.equal(cents(travel.leftOnTable), 89.71);
});

// SPEC.md's demo path claims "Receipt (-$427)" and "Replay ($104)" for Jordan. Verified
// against the engine as it stands, with no change to engine code or data.
test("SPEC demo path: Jordan's receipt is -$427 and his replay leaves $104 on the table", () => {
  const r = receipt(JORDAN.wallet, yearOf(JORDAN));
  assert.equal(Math.round(r.net), -427, `SPEC claims -$427; engine says ${r.net.toFixed(2)}`);
  assert.equal(Math.round(r.leftOnTable), 104, `SPEC claims $104; engine says ${r.leftOnTable.toFixed(2)}`);
  // to the cent, for the record
  assert.equal(cents(r.net), -427.03);
  assert.equal(cents(r.leftOnTable), 104.14);
  // and the arithmetic behind the receipt: 552.69 + 80 - 325 - 734.72 = -427.03
  assert.equal(cents(r.rewards + r.credits - r.fees - r.interest), -427.03);
  // the interest is the whole story: $2,800 x 26.24% = $734.72 on the Apple Card
  assert.equal(cents(interestFor(JORDAN.wallet[2])), 734.72);
  assert.equal(cents((2800 * 26.24) / 100), 734.72);
});

// Determinism: the engine is pure, so the same inputs give byte-identical results.
test("deterministic: same persona year, same receipt twice", () => {
  const a = receipt(JORDAN.wallet, yearOf(JORDAN));
  const b = receipt(JORDAN.wallet, yearOf(JORDAN));
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});
