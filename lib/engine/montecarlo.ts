// Monte Carlo: resample your own months into many plausible next years and ask, year by
// year, whether a different wallet would have come out ahead. Deterministic: a seeded
// PRNG, no Math.random, so the same inputs give the same odds on every reload.
//
// Method
// - Block bootstrap by month. Purchases are grouped by calendar month (YYYY-MM). A
//   simulated year draws 12 of those months with replacement and puts them in slots
//   1..12 of one synthetic calendar year (SYN_YEAR). Each purchase keeps its day of the
//   month (clamped to the slot's last day), so monthly, billing-cycle, quarterly,
//   half-year and annual caps reset where they would in a real year.
// - Partial edge months (the first month when the data starts after the 7th, the last
//   when it ends more than a week before month end) are left out of the pool when at
//   least 3 full months remain, so a half-month doesn't pass for a quiet month.
// - Rotating categories: slot k is calendar month k of SYN_YEAR = 2026. The catalog
//   only has the published Q4 2026 lineups (2026-10-01 to 2026-12-31), so slots 10-12
//   earn the Q4 rotation and slots 1-9 earn the card's base rate on those categories.
//   Q1-Q3 lineups aren't published; crediting nothing is conservative and matches
//   receipt(), which also only pays a rotation inside its published window.
// - No invented year-over-year drift by default: the fan is the spread from your own
//   months, not a forecast of changed habits. opts.driftSd turns drift on, applied to
//   purchase amounts before the rules run (so caps stay non-linear); see MonteCarloOpts.
// - Common random numbers: every option is scored on the same resampled year as your
//   current wallet, so winShare is a paired comparison (share of years strictly ahead).
// - Net = best-play rewards (same greedy as simulate(..., "best"), re-implemented over
//   precomputed rule tables for speed; scripts/mc.ts checks it matches simulate() to the
//   cent) + credits used − annual fees − interest (interestFor), as in receipt().
//   Added cards: paid in full, credits unused, annual fee counts. Dropped cards: their
//   rewards, credits and fee go away; any balance on them stays (closing a card does
//   not clear the debt), so their interest still counts.
// - Balance rule (SPEC #14, "no new card while you carry a balance"): if any held card
//   carries a balance, no "add:" options are produced, even for explicit candidates.
//   "drop:" options (cards with an annual fee) are still produced. For the "here is what
//   opens up once you've cleared it" screen, pass { assumePaidOff: true }: balances are
//   zeroed before anything runs and the result carries `hypothetical` so it can never be
//   mistaken for the real wallet.
// - Bands, cumulative net by month: rewards as earned in each month; the annual fee is
//   charged in full in month 1 (it posts up front, so fee cards start below zero);
//   credits used and interest are spread evenly, 1/12 a month. Month 12 = the year net.

import { CARDS, card, openToNewApplicants, type CatalogCard, type Period } from "./catalog";
import { capPool, chooseOptions, creditsUsed, interestFor, pointValue, rotatingPool, whatIf, type Holding, type Txn } from "./index";

export type Band = { month: number; p5: number; p25: number; p50: number; p75: number; p95: number };
export type Outcome = {
  id: string;
  label: string;
  mean: number;
  p5: number;
  p50: number;
  p95: number;
  winShare: number;
  bands: Band[];
};
export type MonteCarloResult = {
  years: number;
  seed: number;
  current: Outcome;
  options: Outcome[];
  /** null for the real wallet; set when opts.assumePaidOff cleared a balance. */
  hypothetical: Hypothetical | null;
};
export type MonteCarloOpts = {
  years?: number;
  seed?: number;
  candidates?: string[];
  /** Optional year-over-year spending drift, OFF by default (0 = pure block bootstrap).
   *  With driftSd = s, each simulated year multiplies every purchase AMOUNT in a category
   *  by exp(s*z - s^2/2), z ~ N(0,1), drawn once per category per year (median 1, so the
   *  mean year is unchanged). It scales amounts BEFORE the rules run, so a category that
   *  drifts up earns less than proportionally once it crosses a cap; scaling finished
   *  rewards instead would miss that. The default is 0 because nothing in one year of a
   *  person's own statements estimates how their spending drifts between years: the fan
   *  then shows exactly the uncertainty the data supports (which months you get), and
   *  nothing invented. */
  driftSd?: number;
  /** The "once you've paid this off" view: every balance is treated as cleared before
   *  anything else runs, so interest drops out and "add:" options are allowed again
   *  (SPEC #14 only blocks a new card WHILE you carry one). The result carries
   *  `hypothetical` so a screen can never show this as the current wallet by accident. */
  assumePaidOff?: boolean;
};

/** Marks a result as the paid-off hypothetical rather than the real wallet. */
export type Hypothetical = { assumePaidOff: true; clearedBalance: number; cards: string[] };

/** Same wallet with every balance cleared. Used by opts.assumePaidOff; exported so a
 *  caller can see exactly what the hypothetical changes. */
export function paidOffWallet(wallet: Holding[]): Holding[] {
  return wallet.map((h) => ({ ...h, balance: 0 }));
}

function hypotheticalOf(wallet: Holding[], on: boolean | undefined): Hypothetical | null {
  if (!on) return null;
  const carrying = wallet.filter((h) => (h.balance ?? 0) > 0);
  return { assumePaidOff: true, clearedBalance: carrying.reduce((a, h) => a + (h.balance ?? 0), 0), cards: carrying.map((h) => h.cardId) };
}

const SYN_YEAR = 2026;
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2026 is not a leap year

// ---------- PRNG ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- months and resampling ----------

/** Purchases grouped by YYYY-MM in date order, partial edge months dropped (see top). */
export function monthBlocks(txns: Txn[]): Txn[][] {
  const by = new Map<string, Txn[]>();
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const k = t.date.slice(0, 7);
    let g = by.get(k);
    if (!g) by.set(k, (g = []));
    g.push(t);
  }
  let blocks = [...by.keys()].sort().map((k) => by.get(k)!);
  const day = (t: Txn) => Number(t.date.slice(8, 10));
  const dim = (t: Txn) => DAYS_IN[Number(t.date.slice(5, 7)) - 1] ?? 31;
  if (blocks.length > 0) {
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const dropFirst = day(first[0]) > 7;
    const dropLast = blocks.length > 1 && day(last[last.length - 1]) < dim(last[last.length - 1]) - 7;
    const kept = blocks.slice(dropFirst ? 1 : 0, dropLast ? -1 : undefined);
    if (kept.length >= 3) blocks = kept;
  }
  return blocks;
}

/** For each simulated year, which month block fills slots 1..12. Same seed, same draws. */
export function drawYears(nBlocks: number, years: number, seed: number): Uint16Array {
  const rnd = mulberry32(seed);
  const out = new Uint16Array(years * 12);
  if (nBlocks === 0) return out;
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(rnd() * nBlocks);
  return out;
}

function slotDate(t: Txn, slot: number): string {
  const d = Math.min(Number(t.date.slice(8, 10)) || 1, DAYS_IN[slot - 1]);
  return `${SYN_YEAR}-${String(slot).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The resampled years as plain transactions, re-dated into SYN_YEAR. Used by the checks
 *  in scripts/mc.ts to compare against simulate(); monteCarlo itself skips building them. */
export function resampledYears(txns: Txn[], years = 1000, seed = 42): Txn[][] {
  const blocks = monthBlocks(txns);
  const draws = drawYears(blocks.length, years, seed);
  const out: Txn[][] = [];
  for (let y = 0; y < years; y++) {
    const yr: Txn[] = [];
    if (blocks.length)
      for (let s = 1; s <= 12; s++)
        for (const t of blocks[draws[y * 12 + s - 1]]) yr.push({ ...t, id: `${t.id}@${y}.${s}`, date: slotDate(t, s) });
    out.push(yr);
  }
  return out;
}

// ---------- precomputed rule tables (a faster simulate(..., "best")) ----------

/** One way a card can earn on one purchase, everything known ahead except caps used,
 *  the rotation window (depends on the slot) and pick-one choices (depend on the year). */
type Entry = {
  mult: number;
  after: number;
  pool: number; // -1 = uncapped
  capAmt: number;
  period: Period;
  choiceCat: string | null; // rule only counts if this category was picked this year
  rot: boolean; // rotating: only inside the window
};

type Prepared = {
  id: string;
  pv: number;
  base: number;
  hasChoice: boolean;
  from: string;
  to: string;
  entries: Entry[][]; // per purchase index
};

function periodSlot(p: Period, slot: number): number {
  switch (p) {
    case "month":
    case "billing_cycle":
      return slot - 1;
    case "quarter":
      return Math.ceil(slot / 3) - 1;
    case "half_year":
      return slot <= 6 ? 0 : 1;
    default:
      return 0;
  }
}

function merchantMatch(list: string[] | undefined, m: string): boolean {
  return !!list && list.some((x) => m.includes(x.toLowerCase()));
}

function prepare(c: CatalogCard, txns: Txn[], pools: Map<string, number>): Prepared {
  const pool = (key: string) => {
    let i = pools.get(key);
    if (i === undefined) pools.set(key, (i = pools.size));
    return i;
  };
  const r = c.rotating;
  const [from = "", to = ""] = r ? (r.period ?? r.dates ?? "").split(" to ") : [];
  const entries = txns.map((t) => {
    const m = t.merchant.toLowerCase();
    const list: Entry[] = [];
    for (const e of c.earn_rules) {
      if (merchantMatch(e.merchants_excluded, m)) continue;
      const applies = e.merchants ? merchantMatch(e.merchants, m) : e.category === t.category || e.category === "everything_else";
      if (!applies) continue;
      list.push({
        mult: e.multiplier,
        after: e.after_cap_multiplier ?? c.base_multiplier,
        pool: e.cap ? pool(capPool(c, e)) : -1,
        capAmt: e.cap?.amount ?? 0,
        period: e.cap?.period ?? "year",
        choiceCat: e.choice_group ? e.category : null,
        rot: false,
      });
    }
    if (r && from && to && r.q4_2026.includes(t.category))
      list.push({
        mult: r.multiplier,
        after: r.after_cap_multiplier ?? c.base_multiplier,
        pool: r.cap ? pool(rotatingPool(c)) : -1,
        capAmt: r.cap ?? 0,
        period: r.cap_period ?? "quarter",
        choiceCat: null,
        rot: true,
      });
    return list;
  });
  return { id: c.id, pv: pointValue(c), base: c.base_multiplier, hasChoice: c.earn_rules.some((e) => e.choice_group), from, to, entries };
}

/** Best play over one resampled year: identical greedy to simulate(wallet, year, "best"),
 *  writing cumulative rewards at the end of each month into cum[0..11]. Returns total. */
function playYear(
  eligible: Prepared[],
  choices: (Set<string> | null)[],
  order: Int32Array, // purchase indices in date order
  slots: Uint8Array, // slot of each entry in order
  dates: string[], // synthetic date of each entry in order
  amounts: Float64Array,
  used: Float64Array,
  cum: Float64Array,
  cumOff: number,
): number {
  used.fill(0);
  let total = 0;
  let k = 0;
  for (let s = 1; s <= 12; s++) {
    for (; k < order.length && slots[k] === s; k++) {
      const i = order[k];
      const amt = amounts[i];
      let bestReward = 0;
      let bestPoolKey = -1;
      let bestConsume = 0;
      for (let ci = 0; ci < eligible.length; ci++) {
        const p = eligible[ci];
        const choice = choices[ci];
        let mult = p.base;
        let poolKey = -1;
        let consume = 0;
        const list = p.entries[i];
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (e.choiceCat !== null && choice && !choice.has(e.choiceCat)) continue;
          if (e.rot && !(dates[k] >= p.from && dates[k] <= p.to)) continue;
          let eff = e.mult;
          let pk = -1;
          let cons = 0;
          if (e.pool >= 0) {
            pk = e.pool * 12 + periodSlot(e.period, s);
            const left = Math.max(0, e.capAmt - used[pk]);
            const inCap = Math.min(left, amt);
            eff = amt > 0 ? (inCap * e.mult + (amt - inCap) * e.after) / amt : e.mult;
            cons = inCap;
          }
          if (eff > mult) {
            mult = eff;
            poolKey = pk;
            consume = cons;
          }
        }
        const reward = (amt * mult * p.pv) / 100;
        if (ci === 0 || reward > bestReward + 1e-9) {
          bestReward = reward;
          bestPoolKey = poolKey;
          bestConsume = consume;
        }
      }
      if (bestPoolKey >= 0) used[bestPoolKey] += bestConsume;
      total += bestReward;
    }
    cum[cumOff + s - 1] = total;
  }
  return total;
}

// ---------- options ----------

type Option = { id: string; label: string; wallet: Holding[]; fixed: { credits: number; fees: number; interest: number } };

/** Short display name: "Amex Gold", "Blue Cash Preferred", "Citi Double Cash". */
export function mcLabel(id: string): string {
  let n = card(id)
    .name.replace(/^The /, "")
    .replace(/ Card from American Express$/, "")
    .replace(/ from American Express$/, "")
    .replace("American Express", "Amex")
    .replace(/ Visa Signature Card$/, "")
    .trim();
  const short = n.replace(/ Card$/, "");
  if (short !== n && short.includes(" ")) n = short; // "Citi Double Cash", but "Apple Card"
  return n === "Platinum Card" || n === "Platinum" ? "Amex Platinum" : n;
}

function fixedOf(wallet: Holding[], extraInterest = 0) {
  let credits = 0;
  let fees = 0;
  let interest = extraInterest;
  for (const h of wallet) {
    credits += creditsUsed(h);
    fees += card(h.cardId).annual_fee;
    interest += interestFor(h);
  }
  return { credits, fees, interest };
}

export function carriesBalance(wallet: Holding[]): boolean {
  return wallet.some((h) => (h.balance ?? 0) > 0);
}

/** Cards to test adding: explicit list, or the top 5 open cards by whatIf on the real
 *  year. Empty while any held card carries a balance (SPEC #14). */
export function addCandidates(wallet: Holding[], txns: Txn[], candidates?: string[]): string[] {
  if (carriesBalance(wallet)) return [];
  const held = new Set(wallet.map((h) => h.cardId));
  const known = new Set(CARDS.map((c) => c.id));
  if (candidates) return [...new Set(candidates)].filter((id) => known.has(id) && !held.has(id));
  return CARDS.filter((c) => !held.has(c.id) && openToNewApplicants(c))
    .map((c) => ({ id: c.id, net: whatIf(wallet, txns, c.id)?.net ?? -Infinity }))
    .sort((a, b) => b.net - a.net || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((x) => x.id);
}

function optionsFor(wallet: Holding[], txns: Txn[], candidates?: string[]): Option[] {
  const out: Option[] = [{ id: "current", label: "Your wallet", wallet, fixed: fixedOf(wallet) }];
  for (const id of addCandidates(wallet, txns, candidates)) {
    const w = [...wallet, { cardId: id }];
    out.push({ id: `add:${id}`, label: `Add ${mcLabel(id)}`, wallet: w, fixed: fixedOf(w) });
  }
  for (const h of wallet) {
    if (card(h.cardId).annual_fee <= 0) continue;
    const w = wallet.filter((x) => x !== h);
    out.push({ id: `drop:${h.cardId}`, label: `Drop ${mcLabel(h.cardId)}`, wallet: w, fixed: fixedOf(w, interestFor(h)) });
  }
  return out;
}

// ---------- the run ----------

export type MonteCarloSamples = {
  years: number;
  seed: number;
  options: { id: string; label: string; net: Float64Array; cum: Float64Array /* years x 12 */ }[];
  hypothetical: Hypothetical | null;
};

/** Every simulated year's net for every option (index 0 = current). monteCarlo()
 *  summarises this; it is exported for checks and for anyone who wants the raw draws. */
export function monteCarloSamples(wallet: Holding[], txns: Txn[], opts: MonteCarloOpts = {}): MonteCarloSamples {
  const years = Math.max(1, Math.floor(opts.years ?? 1000));
  const seed = opts.seed ?? 42;
  const hypothetical = hypotheticalOf(wallet, opts.assumePaidOff);
  if (hypothetical) wallet = paidOffWallet(wallet);
  const options = optionsFor(wallet, txns, opts.candidates);

  const blocks = monthBlocks(txns);
  const pool: Txn[] = blocks.flat();
  const blockStart: number[] = [];
  let acc = 0;
  for (const b of blocks) {
    blockStart.push(acc);
    acc += b.length;
  }
  const baseAmounts = Float64Array.from(pool, (t) => t.amount);
  const draws = drawYears(blocks.length, years, seed);

  // optional spending drift (see MonteCarloOpts.driftSd): its own PRNG stream, so turning
  // it on does not change which months get drawn
  const driftSd = Math.max(0, opts.driftSd ?? 0);
  const cats = [...new Set(pool.map((t) => t.category))].sort();
  const catOf = Int32Array.from(pool, (t) => cats.indexOf(t.category));
  const drnd = mulberry32(seed ^ 0x9e3779b9);
  const gauss = () => Math.sqrt(-2 * Math.log(drnd() || 1e-9)) * Math.cos(2 * Math.PI * drnd());
  const factor = new Float64Array(cats.length);
  const amounts = driftSd > 0 ? new Float64Array(baseAmounts.length) : baseAmounts;

  // rule tables for every card any option holds
  const pools = new Map<string, number>();
  const prepared = new Map<string, Prepared>();
  for (const o of options) for (const h of o.wallet) if (!prepared.has(h.cardId)) prepared.set(h.cardId, prepare(card(h.cardId), pool, pools));
  const used = new Float64Array(Math.max(1, pools.size) * 12);
  const choiceCards = [...prepared.values()].filter((p) => p.hasChoice);

  const eligibleOf = (w: Holding[]) => {
    const free = w.filter((h) => !((h.balance ?? 0) > 0));
    return (free.length > 0 ? free : w).map((h) => prepared.get(h.cardId)!);
  };
  const eligible = options.map((o) => eligibleOf(o.wallet));

  const res = options.map((o) => ({ id: o.id, label: o.label, net: new Float64Array(years), cum: new Float64Array(years * 12) }));
  const cap = pool.length * 12;
  const order = new Int32Array(cap);
  const slots = new Uint8Array(cap);
  const dates: string[] = new Array(cap);
  const dateCache = new Map<number, string>(); // purchase index * 16 + slot

  for (let y = 0; y < years; y++) {
    if (driftSd > 0) {
      for (let c = 0; c < cats.length; c++) factor[c] = Math.exp(driftSd * gauss() - (driftSd * driftSd) / 2);
      for (let i = 0; i < amounts.length; i++) amounts[i] = baseAmounts[i] * factor[catOf[i]];
    }
    // lay out the year: slot by slot, each drawn month in date order
    let n = 0;
    if (blocks.length)
      for (let s = 1; s <= 12; s++) {
        const b = draws[y * 12 + s - 1];
        const st = blockStart[b];
        for (let i = st; i < st + blocks[b].length; i++) {
          order[n] = i;
          slots[n] = s;
          let d = dateCache.get(i * 16 + s);
          if (d === undefined) dateCache.set(i * 16 + s, (d = slotDate(pool[i], s)));
          dates[n] = d;
          n++;
        }
      }
    const ord = order.subarray(0, n);
    // pick-one categories (BofA, Bilt Obsidian) are chosen on this year's spending
    const choiceOf = new Map<string, Set<string> | null>();
    if (choiceCards.length) {
      const yr: Txn[] = [];
      for (let k = 0; k < n; k++) yr.push(pool[ord[k]]);
      for (const p of choiceCards) choiceOf.set(p.id, chooseOptions(p.id, yr));
    }
    for (let o = 0; o < options.length; o++) {
      const el = eligible[o];
      const r = res[o];
      const f = options[o].fixed;
      const total = el.length
        ? playYear(el, el.map((p) => choiceOf.get(p.id) ?? null), ord, slots, dates, amounts, used, r.cum, y * 12)
        : (r.cum.fill(0, y * 12, y * 12 + 12), 0);
      r.net[y] = total + f.credits - f.fees - f.interest;
      for (let m = 1; m <= 12; m++) r.cum[y * 12 + m - 1] += ((f.credits - f.interest) * m) / 12 - f.fees;
    }
  }
  return { years, seed, options: res, hypothetical };
}

// ---------- summary ----------

function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function monteCarlo(wallet: Holding[], txns: Txn[], opts: MonteCarloOpts = {}): MonteCarloResult {
  const s = monteCarloSamples(wallet, txns, opts);
  const base = s.options[0].net;
  const outcomes: Outcome[] = s.options.map((o, idx) => {
    const sorted = Float64Array.from(o.net).sort();
    let mean = 0;
    let wins = 0;
    for (let y = 0; y < s.years; y++) {
      mean += o.net[y];
      if (o.net[y] > base[y] + 1e-9) wins++;
    }
    const bands: Band[] = [];
    const col = new Float64Array(s.years);
    for (let m = 0; m < 12; m++) {
      for (let y = 0; y < s.years; y++) col[y] = o.cum[y * 12 + m];
      col.sort();
      bands.push({ month: m + 1, p5: r2(quantile(col, 0.05)), p25: r2(quantile(col, 0.25)), p50: r2(quantile(col, 0.5)), p75: r2(quantile(col, 0.75)), p95: r2(quantile(col, 0.95)) });
    }
    return {
      id: o.id,
      label: o.label,
      mean: r2(mean / s.years),
      p5: r2(quantile(sorted, 0.05)),
      p50: r2(quantile(sorted, 0.5)),
      p95: r2(quantile(sorted, 0.95)),
      winShare: idx === 0 ? 0.5 : wins / s.years,
      bands,
    };
  });
  const [current, ...options] = outcomes;
  options.sort((a, b) => b.winShare - a.winShare || b.mean - a.mean);
  return { years: s.years, seed: s.seed, current, options, hypothetical: s.hypothetical };
}
