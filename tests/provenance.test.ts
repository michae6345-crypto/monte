// Provenance tests (SPEC #19): every dollar clicks through to its rule, source URL and
// checked date, and the UNVERIFIED badge appears exactly where the catalog marks a card.
//
// Run from the repo root:
//   JITI_ALIAS='{"@":"<abs path to repo root>"}' npx jiti tests/provenance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { receipt, simulate, type Holding, type Txn } from "@/lib/engine";
import { card, CARDS } from "@/lib/engine/catalog";
import {
  cardSource,
  citation,
  creditProvenanceFor,
  creditsUsedTotal,
  feeProvenanceFor,
  interestProvenanceFor,
  matchCatalogRule,
  provenanceFor,
  receiptProvenance,
  unverifiedCards,
} from "@/lib/engine/provenance";
import { JORDAN, MAYA, PARKS, yearOf } from "@/lib/data/personas";

const cents = (n: number) => Math.round(n * 100) / 100;

const txn = (o: Partial<Txn>): Txn => ({
  id: "t",
  date: "2026-11-15",
  merchant: "",
  amount: 0,
  category: "everything_else",
  cardUsed: "",
  ...o,
});

// ---------- a reward row ----------

test("provenanceFor: a plain category rule traces to its rule, source URL and checked date", () => {
  const t = txn({ id: "j1", merchant: "Sweetgreen", category: "dining", amount: 84.2 });
  const p = provenanceFor({ txnId: "j1", cardId: "chase_freedom_unlimited", reward: 2.526, mult: 3, rule: "3x dining" }, t);
  assert.equal(p.kind, "reward");
  assert.equal(p.source.cardId, "chase_freedom_unlimited");
  assert.equal(p.source.cardName, "Chase Freedom Unlimited");
  assert.equal(p.source.issuer, "Chase");
  assert.equal(p.source.checked, "2026-10-17");
  assert.equal(p.source.unverified, false);
  assert.deepEqual(p.source.sourceUrls, card("chase_freedom_unlimited").source_urls);
  assert.ok(p.source.sourceUrls.length > 0);
  assert.equal(p.rule, "3x dining");
  assert.equal(p.catalogRule?.category, "dining");
  assert.equal(p.catalogRule?.multiplier, 3);
  assert.equal(p.conditions, "restaurants incl. takeout and eligible delivery");
  assert.equal(p.cap, undefined);
  assert.equal(p.rotating, false);
  assert.equal(p.pointValueCents, 1);
  assert.equal(p.math, "$84.20 x 3x = $2.53");
  assert.match(citation(p), /Chase Freedom Unlimited \(Chase\), https:\/\/creditcards\.chase\.com\S+, checked 2026-10-17$/);
});

test("provenanceFor: a merchant-list rule names the merchants it matched", () => {
  const t = txn({ id: "j2", merchant: "Mobil", category: "gas", amount: 52 });
  const p = provenanceFor({ txnId: "j2", cardId: "apple_card", reward: 1.56, mult: 3, rule: "3x at Exxon, Mobil" }, t);
  assert.deepEqual(p.catalogRule?.merchants, ["Exxon", "Mobil"]);
  assert.equal(p.catalogRule?.multiplier, 3);
  assert.equal(p.merchant, "Mobil");
  assert.equal(p.math, "$52.00 x 3x = $1.56");
});

test("provenanceFor: a capped rule carries its published cap and after-cap rate", () => {
  // the purchase that straddles Blue Cash Everyday's $6,000 groceries cap: blended 2.0x
  const t = txn({ id: "p1", merchant: "Ralphs", category: "groceries", amount: 200 });
  const p = provenanceFor({ txnId: "p1", cardId: "amex_blue_cash_everyday", reward: 4, mult: 2, rule: "3x groceries (cap $6,000/year)" }, t);
  assert.deepEqual(p.cap, { amount: 6000, period: "year", afterCapMultiplier: 1 });
  assert.equal(p.mult, 2); // the blended rate, below the rule's headline 3x
  assert.equal(p.catalogRule?.multiplier, 3);
  assert.equal(p.math, "$200.00 x 2x = $4.00");
});

test("provenanceFor: a rotating rule carries its window, labels and activation flag", () => {
  const t = txn({ id: "p2", merchant: "BCD Tofu House", category: "dining", amount: 64 });
  const p = provenanceFor({ txnId: "p2", cardId: "discover_it_cash_back", reward: 3.2, mult: 5, rule: "5x Q4 rotating dining" }, t);
  assert.equal(p.rotating, true);
  assert.deepEqual(p.rotatingDetail, {
    window: "2026-10-01 to 2026-12-31",
    labels: ["Restaurants", "Entertainment", "Utilities"],
    activationRequired: true,
  });
  assert.deepEqual(p.cap, { amount: 1500, period: "quarter", afterCapMultiplier: 1 });
  // Discover it Cash Back is flagged unverified in the catalog, so this dollar is badged
  assert.equal(p.source.unverified, true);
  assert.match(citation(p), /\[UNVERIFIED\]$/);
});

test("provenanceFor: a points card shows the cents-per-point it was valued at", () => {
  // default "cash" valuation: pointValue() = min(1, 2.05) = 1c
  const t = txn({ id: "m1", merchant: "Sugarfish", category: "dining", amount: 84.2 });
  const p = provenanceFor({ txnId: "m1", cardId: "chase_sapphire_preferred", reward: 2.526, mult: 3, rule: "3x dining" }, t);
  assert.equal(p.pointValueCents, 1);
  assert.equal(p.math, "$84.20 x 3x x 1c/point = $2.53 (252.60 UR)");
});

test("matchCatalogRule: the base rate matches no rule", () => {
  const t = txn({ merchant: "Ralphs", category: "groceries", amount: 110 });
  assert.deepEqual(matchCatalogRule(card("chase_freedom_unlimited"), t, "1.5x base"), { rule: null, rotating: false });
});

// ---------- fee, credit, interest ----------

test("feeProvenanceFor: traces to the card's published annual_fee, null when there is none", () => {
  const f = feeProvenanceFor("amex_gold");
  assert.ok(f);
  assert.equal(f.kind, "fee");
  assert.equal(f.amount, 325);
  assert.equal(f.annualFee, card("amex_gold").annual_fee);
  assert.equal(f.math, "American Express Gold Card annual fee $325.00 (published)");
  assert.deepEqual(f.source.sourceUrls, card("amex_gold").source_urls);
  assert.equal(feeProvenanceFor("apple_card"), null);
});

test("creditProvenanceFor: each credit traces to the named catalog credit and how it was used", () => {
  const h: Holding = JORDAN.wallet[1]; // amex_gold, creditsUsed { "Uber Cash": 60, "Dining credit": 20 }
  const lines = creditProvenanceFor(h);
  assert.equal(lines.length, 2);
  assert.equal(cents(lines.reduce((a, l) => a + l.amount, 0)), cents(creditsUsedTotal(h)));

  const uber = lines.find((l) => l.creditName === "Uber Cash")!;
  assert.equal(uber.used, 60);
  assert.equal(uber.catalogAmount, 10);
  assert.equal(uber.period, "month");
  assert.equal(uber.perYear, 120); // $10/month x 12
  assert.equal(uber.unknownToCatalog, false);
  assert.match(uber.howToUse!, /add the Gold Card to Uber/);
  assert.equal(uber.math, 'used $60.00 of $10.00/month ($120.00/yr) "Uber Cash"');

  const dining = lines.find((l) => l.creditName === "Dining credit")!;
  assert.equal(dining.used, 20);
  assert.equal(dining.perYear, 120);

  // a credit the catalog does not list is flagged rather than silently sourced
  const odd = creditProvenanceFor({ cardId: "amex_gold", creditsUsed: { "Imaginary credit": 50 } });
  assert.equal(odd[0].unknownToCatalog, true);
  assert.equal(odd[0].catalogAmount, 0);
  assert.match(odd[0].math, /the catalog does not list/);

  assert.deepEqual(creditProvenanceFor({ cardId: "apple_card" }), []);
});

test("interestProvenanceFor: says whether the APR came from the account or the catalog", () => {
  // Jordan's Apple Card: balance $2,800 at an APR on file of 26.24% -> $734.72 a year
  const own = interestProvenanceFor(JORDAN.wallet[2])!;
  assert.equal(own.kind, "interest");
  assert.equal(own.balance, 2800);
  assert.equal(own.aprPct, 26.24);
  assert.equal(own.aprSource, "holding");
  assert.equal(cents(own.amount), 734.72);
  assert.equal(own.math, "$2,800.00 average balance x 26.24% APR = $734.72 a year (APR from your account)");
  assert.deepEqual(own.catalogAprRange, card("apple_card").purchase_apr_range);

  // no APR on file: interestFor() falls back to the TOP of the published range (27.99%)
  const fallback = interestProvenanceFor({ cardId: "apple_card", balance: 2800 })!;
  assert.equal(fallback.aprSource, "catalog_apr_range_max");
  assert.equal(fallback.aprPct, card("apple_card").purchase_apr_range[1]);
  assert.equal(fallback.aprPct, 27.99);
  assert.equal(cents(fallback.amount), cents((2800 * 27.99) / 100));
  assert.equal(cents(fallback.amount), 783.72);
  assert.match(fallback.math, /no APR on file: top of the card's published range 17.74%-27.99%/);

  // paid in full: no interest line at all
  assert.equal(interestProvenanceFor({ cardId: "apple_card" }), null);
  assert.equal(interestProvenanceFor({ cardId: "apple_card", balance: 0, apr: 26.24 }), null);
});

// ---------- the whole receipt ----------

for (const p of [JORDAN, MAYA, PARKS]) {
  test(`${p.name}: receiptProvenance reconciles with receipt() to the cent`, () => {
    const tx = yearOf(p);
    const r = receipt(p.wallet, tx);
    const prov = receiptProvenance(p.wallet, tx);

    // one reward line per purchase, same card and same dollars as the engine's own hits
    assert.equal(prov.rewards.length, tx.length);
    assert.equal(prov.rewards.length, r.actual.hits.length);
    for (let i = 0; i < prov.rewards.length; i++) {
      const h = r.actual.hits[i];
      const line = prov.rewards[i];
      assert.equal(line.txnId, h.txnId);
      assert.equal(line.source.cardId, h.cardId);
      assert.equal(line.amount, h.reward);
      assert.equal(line.mult, h.mult);
      assert.equal(line.rule, h.rule);
      // every dollar has a source URL and a checked date
      assert.ok(line.source.sourceUrls.length > 0, `${line.source.cardId} has no source_urls`);
      assert.ok(line.source.checked, `${line.source.cardId} has no checked date`);
      assert.ok(line.math.includes("="));
    }

    // the four buckets add up to the engine's receipt, to the cent
    const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
    assert.equal(cents(sum(prov.rewards)), cents(r.rewards));
    assert.equal(cents(sum(prov.credits)), cents(r.credits));
    assert.equal(cents(sum(prov.fees)), cents(r.fees));
    assert.equal(cents(sum(prov.interest)), cents(r.interest));
    assert.equal(cents(prov.net), cents(r.net));
    assert.equal(prov.lines.length, prov.rewards.length + prov.fees.length + prov.credits.length + prov.interest.length);

    // every rewards line whose rule is not the base rate resolves to a catalog rule
    for (const line of prov.rewards) {
      if (!line.rule.endsWith("x base")) {
        assert.ok(line.catalogRule, `${line.source.cardId}: rule "${line.rule}" did not resolve to a catalog rule`);
      }
    }
  });
}

test("Jordan: the receipt's four buckets are -$427.03 and each one is sourced", () => {
  const prov = receiptProvenance(JORDAN.wallet, yearOf(JORDAN));
  const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
  assert.equal(cents(sum(prov.rewards)), 552.69);
  assert.equal(cents(sum(prov.credits)), 80);
  assert.equal(cents(sum(prov.fees)), 325);
  assert.equal(cents(sum(prov.interest)), 734.72);
  assert.equal(cents(prov.net), -427.03);
  // one fee line (Amex Gold), two credit lines (Uber Cash, Dining credit), one interest
  // line (Apple Card), because the other two cards are paid in full and fee-free
  assert.deepEqual(prov.fees.map((f) => f.source.cardId), ["amex_gold"]);
  assert.deepEqual(prov.credits.map((c) => c.creditName), ["Uber Cash", "Dining credit"]);
  assert.deepEqual(prov.interest.map((i) => i.source.cardId), ["apple_card"]);
  for (const line of prov.lines) assert.ok(citation(line).length > 0);
  // Jordan holds no unverified card, so the receipt shows no badge
  assert.deepEqual(prov.unverified, []);
});

test("The Parks: the UNVERIFIED badge reaches their receipt (Discover it Cash Back)", () => {
  const prov = receiptProvenance(PARKS.wallet, yearOf(PARKS));
  assert.deepEqual(prov.unverified.map((u) => u.cardId), ["discover_it_cash_back"]);
  assert.ok(prov.rewards.some((l) => l.source.cardId === "discover_it_cash_back" && l.source.unverified));
  assert.ok(prov.rewards.some((l) => l.source.cardId === "amex_blue_cash_everyday" && !l.source.unverified));
});

// ---------- the UNVERIFIED list ----------

test("unverifiedCards: exactly the cards data/cards.json flags, with their rules and credits", () => {
  const all = unverifiedCards();
  assert.deepEqual(
    all.map((u) => u.cardId),
    CARDS.filter((c) => c.unverified === true).map((c) => c.id),
  );
  assert.deepEqual(all.map((u) => u.cardId), [
    "chase_freedom_flex",
    "capital_one_venture_x",
    "capital_one_quicksilver",
    "citi_double_cash",
    "citi_custom_cash",
    "citi_strata_premier",
    "discover_it_cash_back",
    "discover_it_student_cash_back",
    "discover_it_secured",
    "bofa_customized_cash_rewards",
    "us_bank_altitude_go",
  ]);
  assert.equal(all.length, 11);

  for (const u of all) {
    const c = card(u.cardId);
    assert.ok(u.sourceUrls.length > 0, `${u.cardId} has no source_urls`);
    assert.ok(u.checked, `${u.cardId} has no checked date`);
    // a rule label for every earn rule, plus the rotating lineup, plus the base rate
    assert.equal(u.rules.length, c.earn_rules.length + (c.rotating ? 1 : 0) + 1);
    assert.equal(u.rules[u.rules.length - 1], `${c.base_multiplier}x base`);
    assert.deepEqual(u.credits, c.credits.map((x) => x.name));
    assert.equal(cardSource(u.cardId).unverified, true);
  }

  // Discover it Cash Back: its rotating Q4 lineup is on the badge too
  const disc = all.find((u) => u.cardId === "discover_it_cash_back")!;
  assert.ok(disc.rules.includes("5x Q4 rotating dining, entertainment, utilities"));
  assert.ok(disc.rules.includes("1x base"));
  // Citi Custom Cash: all eleven 5% categories inherit the badge
  const ccc = all.find((u) => u.cardId === "citi_custom_cash")!;
  assert.equal(ccc.rules.filter((r) => r.startsWith("5x ")).length, 12); // 11 categories + travel_portal

  // narrowing to a wallet returns only that wallet's unverified cards, deduplicated
  assert.deepEqual(unverifiedCards(MAYA.wallet.map((h) => h.cardId)).map((u) => u.cardId), ["citi_double_cash"]);
  assert.deepEqual(unverifiedCards(["apple_card", "amex_gold"]), []);
  assert.deepEqual(unverifiedCards(["citi_double_cash", "citi_double_cash"]).length, 1);
});

test("every card in the catalog has a source URL and a checked date to click through to", () => {
  for (const c of CARDS) {
    const s = cardSource(c.id);
    assert.ok(s.sourceUrls.length > 0, `${c.id} has no source_urls`);
    assert.ok(s.checked, `${c.id} has no checked date`);
    for (const u of s.sourceUrls) assert.match(u, /^https:\/\//, `${c.id}: ${u} is not an https URL`);
  }
});

// ---------- provenance follows the engine, not a copy of it ----------

test("provenance works off any SimResult, including the best-play replay", () => {
  const tx = yearOf(MAYA);
  const best = simulate(MAYA.wallet, tx, "best");
  const byId = new Map(tx.map((t) => [t.id, t]));
  const lines = best.hits.map((h) => provenanceFor(h, byId.get(h.txnId)!));
  assert.equal(cents(lines.reduce((a, l) => a + l.amount, 0)), cents(best.total));
  assert.equal(cents(best.total), 684.8);
  for (const l of lines) assert.ok(l.source.sourceUrls.length > 0);
});
