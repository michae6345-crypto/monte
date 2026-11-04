// Randomized checks of choose(): 600 seeded random wallets, stores and amounts, and the rules the
// decision must never break, whatever the input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "@/lib/engine/catalog";
import { choose, networksAt } from "@/lib/engine/interest";
import { CATEGORY_LABEL } from "@/lib/merchants";
import type { Holding } from "@/lib/engine";

// a small seeded generator (mulberry32), so a failure reproduces
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATS = Object.keys(CATEGORY_LABEL);
const STORES = ["Trader Joe's", "Costco", "Uber", "Shell", "Amazon", "Sweetgreen", "Delta", "CVS Pharmacy", "Netflix", "Target", "Somewhere New"];

test("choose(): 600 random wallets never break the rules", () => {
  const r = rng(20261103);
  for (let i = 0; i < 600; i++) {
    const n = 1 + Math.floor(r() * 5);
    const ids = [...CARDS].sort(() => r() - 0.5).slice(0, n).map((c) => c.id);
    const wallet: Holding[] = ids.map((cardId) => (r() < 0.3 ? { cardId, balance: Math.round(r() * 5000), apr: 15 + Math.round(r() * 15) } : { cardId }));
    const merchant = STORES[Math.floor(r() * STORES.length)];
    const category = CATS[Math.floor(r() * CATS.length)];
    const amount = Math.round((0.5 + r() * 900) * 100) / 100;
    const d = choose(wallet, { date: "2026-11-03", merchant, category, amount });
    const ctx = JSON.stringify({ i, wallet, merchant, category, amount });

    // the pick is one of the cards, and every card is ranked once (minus any the store won't take)
    const takes = networksAt(merchant);
    assert.ok(wallet.some((h) => h.cardId === d.pick.cardId), ctx);
    assert.equal(new Set(d.ranked.map((c) => c.cardId)).size, d.ranked.length, ctx);
    assert.ok(d.ranked.length <= wallet.length && (takes ? true : d.ranked.length === wallet.length), ctx);
    assert.equal(d.ranked[0].cardId, d.pick.cardId, ctx);
    for (const c of d.ranked) {
      // numbers are numbers, and net is reward minus interest
      assert.ok(Number.isFinite(c.reward) && Number.isFinite(c.interest) && Number.isFinite(c.net), ctx);
      assert.ok(c.reward >= 0 && c.interest >= 0, ctx);
      assert.ok(Math.abs(c.net - (c.reward - c.interest)) < 1e-9, ctx);
      // no interest on a card paid in full
      if (!c.carries) assert.equal(c.interest, 0, ctx);
    }
    // the mode matches the wallet, and in "grace" the pick never carries a balance
    const carrying = d.ranked.filter((c) => c.carries).length;
    assert.equal(d.mode, carrying === 0 ? "none" : carrying === d.ranked.length ? "all" : "grace", ctx);
    if (d.mode === "grace") assert.ok(!d.pick.carries, ctx);
    // among the cards it could pick, nothing beats the pick on net
    const pool = d.mode === "grace" ? d.ranked.filter((c) => !c.carries) : d.ranked;
    assert.ok(pool.every((c) => c.net <= d.pick.net + 1e-9), ctx);
    // a skipped card really did out-earn the pick
    if (d.skipped) assert.ok(d.skipped.carries && d.skipped.reward > d.pick.reward, ctx);
  }
});
