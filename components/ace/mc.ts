// Monte Carlo over a year of spending. Stand-in with the exact signature of Michael's
// lib/engine/montecarlo.ts; when that lands, re-export it from here and nothing else changes.
//
// Method: play the real year through each wallet (Monte's routing, caps respected), total
// the net by calendar month, then build each simulated year by drawing 12 of those months
// with replacement. Every wallet sees the same draws, so "wins in N% of years" compares
// like with like. Seeded: the same inputs give the same numbers on every reload.

import { creditsUsed, interestFor, simulate, whatIf, type Holding, type Policy, type Txn } from "@/lib/engine";
import { CARDS, card, openToNewApplicants } from "@/lib/engine/catalog";

export type Band = { month: number; p5: number; p25: number; p50: number; p75: number; p95: number };
export type Outcome = {
  id: string; // "current" | "add:<cardId>" | "drop:<cardId>"
  label: string;
  mean: number;
  p5: number;
  p50: number;
  p95: number;
  winShare: number; // 0..1, share of years this beats current (current = 0.5)
  bands: Band[];
};
export type MonteCarloResult = { years: number; seed: number; current: Outcome; options: Outcome[] };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rewards by calendar month and category (12 x categories) from playing `txns` through
 *  `wallet`, plus the fixed yearly part (credits used − fees − interest). */
export type Ledger = { byMonthCat: Map<string, number>[]; fixed: number; interest: number };

export function ledger(wallet: Holding[], txns: Txn[], policy: Policy = "best"): Ledger {
  const sim = simulate(wallet, txns, policy);
  const byId = new Map(txns.map((t) => [t.id, t]));
  const months = monthKeys(txns);
  const byMonthCat = Array.from({ length: 12 }, () => new Map<string, number>());
  for (const h of sim.hits) {
    const t = byId.get(h.txnId);
    if (!t) continue;
    const k = months.indexOf(t.date.slice(0, 7));
    if (k < 0 || k > 11) continue;
    byMonthCat[k].set(t.category, (byMonthCat[k].get(t.category) ?? 0) + h.reward);
  }
  const interest = wallet.reduce((a, h) => a + interestFor(h), 0);
  const fixed = wallet.reduce((a, h) => a + creditsUsed(h) - card(h.cardId).annual_fee, 0);
  return { byMonthCat, fixed, interest };
}

/** Net value by month (12 entries), the real year with no resampling. */
export function monthlyNet(wallet: Holding[], txns: Txn[], policy: Policy = "best"): number[] {
  const l = ledger(wallet, txns, policy);
  return l.byMonthCat.map((m) => [...m.values()].reduce((a, b) => a + b, 0) + (l.fixed - l.interest) / 12);
}

function monthKeys(txns: Txn[]): string[] {
  const keys = [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort();
  return keys.slice(-12);
}

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

/** One simulated year: which real month stands in for each month, how much more or less
 *  you spend in each category that year, and how big your carried balance runs. */
export type Draw = { months: number[]; scale: Record<string, number>; balance: number };

const CATS = [
  "dining", "groceries", "online_groceries", "gas", "ev_charging", "transit", "rideshare", "travel_portal", "airfare", "hotels",
  "streaming", "drugstores", "home_improvement", "entertainment", "rent", "utilities", "phone", "online_retail", "wholesale_clubs",
  "everything_else",
];

/** Spending habits drift: each category moves by a log-normal factor (sd 0.3) each year. */
export function draws(years: number, seed: number): Draw[] {
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  return Array.from({ length: years }, () => ({
    months: Array.from({ length: 12 }, () => Math.floor(r() * 12)),
    scale: Object.fromEntries(CATS.map((c) => [c, Math.exp(0.3 * gauss() - 0.045)])),
    balance: Math.exp(0.35 * gauss() - 0.06),
  }));
}

/** Cumulative net by month for each simulated year. */
export function paths(l: Ledger, ds: Draw[]): number[][] {
  const perMonthFixed = l.fixed / 12;
  return ds.map((d) => {
    let c = 0;
    const int = (l.interest * d.balance) / 12;
    return d.months.map((m) => {
      let v = perMonthFixed - int;
      for (const [cat, x] of l.byMonthCat[m] ?? []) v += x * (d.scale[cat] ?? 1);
      return (c += v);
    });
  });
}

function outcome(id: string, label: string, ps: number[][], base: number[] | null): Outcome {
  const finals = ps.map((p) => p[11]);
  const sorted = [...finals].sort((a, b) => a - b);
  const bands: Band[] = Array.from({ length: 12 }, (_, m) => {
    const col = ps.map((p) => p[m]).sort((a, b) => a - b);
    return { month: m + 1, p5: q(col, 0.05), p25: q(col, 0.25), p50: q(col, 0.5), p75: q(col, 0.75), p95: q(col, 0.95) };
  });
  const winShare = base ? finals.filter((v, i) => v > base[i] + 0.5).length / finals.length : 0.5;
  return {
    id,
    label,
    mean: finals.reduce((a, b) => a + b, 0) / finals.length,
    p5: q(sorted, 0.05),
    p50: q(sorted, 0.5),
    p95: q(sorted, 0.95),
    winShare,
    bands,
  };
}

export function monteCarlo(
  wallet: Holding[],
  txns: Txn[],
  opts: { years?: number; seed?: number; candidates?: string[] } = {},
): MonteCarloResult {
  const years = opts.years ?? 1000;
  const seed = opts.seed ?? 42;
  const idx = draws(years, seed);

  const curPaths = paths(ledger(wallet, txns), idx);
  const current = outcome("current", "Your wallet", curPaths, null);
  const base = curPaths.map((p) => p[11]);

  const candidates =
    opts.candidates ??
    CARDS.filter((c) => openToNewApplicants(c) && !wallet.some((h) => h.cardId === c.id))
      .map((c) => ({ id: c.id, w: whatIf(wallet, txns, c.id) }))
      .filter((x) => x.w)
      .sort((a, b) => b.w!.net - a.w!.net)
      .slice(0, 5)
      .map((x) => x.id);

  const options: Outcome[] = [];
  for (const id of candidates) {
    const w = [...wallet, { cardId: id }];
    options.push(outcome(`add:${id}`, `Add ${card(id).name}`, paths(ledger(w, txns), idx), base));
  }
  for (const h of wallet) {
    if (card(h.cardId).annual_fee <= 0 || wallet.length < 2) continue;
    const w = wallet.filter((x) => x.cardId !== h.cardId);
    options.push(outcome(`drop:${h.cardId}`, `Cancel ${card(h.cardId).name}`, paths(ledger(w, txns), idx), base));
  }
  options.sort((a, b) => b.winShare - a.winShare || b.mean - a.mean);
  return { years, seed, current, options };
}
