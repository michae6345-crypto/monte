// The Ace engine. Deterministic: every dollar comes from a published card rule in
// data/cards.json and the transactions it applies to. No model is involved here.

import { card, type CatalogCard, type EarnRule, type Period } from "./catalog";

export type Txn = {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number; // dollars
  category: string;
  cardUsed: string;
};

export type Holding = {
  cardId: string;
  /** Average revolving balance over the year, in dollars. 0 = paid in full. */
  balance?: number;
  /** Purchase APR in percent. */
  apr?: number;
  /** Dollars of each credit actually used over the year, keyed by credit name. */
  creditsUsed?: Record<string, number>;
};

export type Policy = "actual" | "best";

export type Hit = {
  txnId: string;
  cardId: string;
  reward: number; // dollars of value
  mult: number; // effective multiplier after caps
  rule: string; // human label of the rule that applied
};

export type SimResult = { hits: Hit[]; byCard: Record<string, number>; total: number };

// ---------- point valuation ----------

/** "cash": every point redeemed at 1¢ (what you get as a statement credit or cash back,
 *  roughly). "travel": The Points Guy's Oct 2026 valuations, for people who transfer
 *  points to airlines and hotels. Cash-back cards are 1¢ either way. */
export type Valuation = "cash" | "travel";
let VALUATION: Valuation = "cash";
export function setValuation(v: Valuation) {
  VALUATION = v;
}
export function pointValue(c: CatalogCard): number {
  return VALUATION === "travel" ? c.point_value_cents : Math.min(1, c.point_value_cents);
}

// ---------- periods and caps ----------

function periodKey(date: string, p: Period): string {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  switch (p) {
    case "month":
    case "billing_cycle":
      return date.slice(0, 7);
    case "quarter":
      return `${y}-Q${Math.ceil(m / 3)}`;
    case "half_year":
      return `${y}-H${m <= 6 ? 1 : 2}`;
    default:
      return y;
  }
}

/** Rules on one card with the same cap amount and period share one pool
 *  (Citi Custom Cash's single $500, BofA's combined $2,500). */
function capPool(c: CatalogCard, r: EarnRule): string {
  return `${c.id}|${r.cap!.amount}|${r.cap!.period}`;
}

// BofA Customized Cash: which categories make up each 3% choice option.
const CHOICE_OPTIONS: Record<string, string[][]> = {
  bofa_ccr_choice: [
    ["gas", "ev_charging"],
    ["online_retail", "streaming", "phone", "utilities"],
    ["dining"],
    ["airfare", "hotels"],
    ["drugstores"],
    ["home_improvement"],
  ],
};

/** For pick-one cards, choose the option that earns the most on this spending. */
export function chooseOptions(cardId: string, txns: Txn[]): Set<string> | null {
  const c = card(cardId);
  const groups = new Set(c.earn_rules.filter((r) => r.choice_group).map((r) => r.choice_group!));
  if (groups.size === 0) return null;
  const spend: Record<string, number> = {};
  for (const t of txns) spend[t.category] = (spend[t.category] ?? 0) + t.amount;
  const chosen = new Set<string>();
  for (const g of groups) {
    const opts = CHOICE_OPTIONS[g] ?? [...new Set(c.earn_rules.filter((r) => r.choice_group === g).map((r) => r.category))].map((x) => [x]);
    let best = opts[0];
    let bestSpend = -1;
    for (const o of opts) {
      const s = o.reduce((a, k) => a + (spend[k] ?? 0), 0);
      if (s > bestSpend) {
        bestSpend = s;
        best = o;
      }
    }
    best.forEach((k) => chosen.add(k));
  }
  return chosen;
}

function merchantMatch(list: string[] | undefined, merchant: string): boolean {
  if (!list) return false;
  const m = merchant.toLowerCase();
  return list.some((x) => m.includes(x.toLowerCase()));
}

function inRotation(c: CatalogCard, t: Txn): boolean {
  const r = c.rotating;
  if (!r) return false;
  const span = r.period ?? r.dates ?? "";
  const [from, to] = span.split(" to ");
  if (!from || !to) return false;
  return t.date >= from && t.date <= to && r.q4_2026.includes(t.category);
}

type Eval = { mult: number; reward: number; rule: string; consume: { pool: string; amount: number }[] };

/** Value of putting transaction t on card c, given cap usage so far. Pure. */
export function evaluate(
  c: CatalogCard,
  t: Txn,
  used: Map<string, number>,
  choice: Set<string> | null,
): Eval {
  let best: Eval = { mult: c.base_multiplier, reward: 0, rule: `${c.base_multiplier}x base`, consume: [] };

  const consider = (mult: number, cap: { amount: number; period: Period; pool: string } | null, after: number, label: string) => {
    let eff = mult;
    let consume: Eval["consume"] = [];
    if (cap) {
      const key = `${cap.pool}|${periodKey(t.date, cap.period)}`;
      const left = Math.max(0, cap.amount - (used.get(key) ?? 0));
      const inCap = Math.min(left, t.amount);
      eff = t.amount > 0 ? (inCap * mult + (t.amount - inCap) * after) / t.amount : mult;
      consume = [{ pool: key, amount: inCap }];
    }
    if (eff > best.mult) best = { mult: eff, reward: 0, rule: label, consume };
  };

  for (const r of c.earn_rules) {
    if (r.choice_group && choice && !choice.has(r.category)) continue;
    if (merchantMatch(r.merchants_excluded, t.merchant)) continue;
    const applies = r.merchants
      ? merchantMatch(r.merchants, t.merchant)
      : r.category === t.category || r.category === "everything_else";
    if (!applies) continue;
    const label = r.merchants
      ? `${r.multiplier}x at ${r.merchants.join(", ")}`
      : r.category === "everything_else"
        ? `${r.multiplier}x on everything`
        : `${r.multiplier}x ${t.category.replace(/_/g, " ")}`;
    consider(
      r.multiplier,
      r.cap ? { amount: r.cap.amount, period: r.cap.period, pool: capPool(c, r) } : null,
      r.after_cap_multiplier ?? c.base_multiplier,
      r.cap ? `${label} (cap $${r.cap.amount.toLocaleString()}/${r.cap.period.replace("_", " ")})` : label,
    );
  }

  if (inRotation(c, t)) {
    const r = c.rotating!;
    consider(
      r.multiplier,
      r.cap ? { amount: r.cap, period: r.cap_period ?? "quarter", pool: `${c.id}|rotating` } : null,
      r.after_cap_multiplier ?? c.base_multiplier,
      `${r.multiplier}x Q4 rotating ${t.category}`,
    );
  }

  best.reward = (t.amount * best.mult * pointValue(c)) / 100;
  return best;
}

// ---------- simulation ----------

/** Play a year of transactions through a wallet.
 *  actual: the card each purchase was really made on.
 *  best:   at each purchase, the card that earns the most given caps used so far, never a
 *          card carrying a balance (new purchases on it accrue interest from day one). */
export function simulate(wallet: Holding[], txns: Txn[], policy: Policy, defaultCard?: string): SimResult {
  const ids = wallet.map((h) => h.cardId);
  const cards = ids.map(card);
  const noBalance = wallet.filter((h) => !(h.balance && h.balance > 0)).map((h) => h.cardId);
  const eligible = noBalance.length > 0 ? noBalance : ids;
  const choices = new Map(ids.map((id) => [id, chooseOptions(id, txns)]));
  const used = new Map<string, number>();
  const hits: Hit[] = [];
  const byCard: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));

  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    let pickId: string;
    let ev: Eval;
    if (policy === "actual") {
      pickId = ids.includes(t.cardUsed) ? t.cardUsed : (defaultCard ?? ids[0]);
      ev = evaluate(card(pickId), t, used, choices.get(pickId) ?? null);
    } else {
      pickId = eligible[0];
      ev = evaluate(card(pickId), t, used, choices.get(pickId) ?? null);
      for (const id of eligible.slice(1)) {
        const e = evaluate(card(id), t, used, choices.get(id) ?? null);
        if (e.reward > ev.reward + 1e-9) {
          ev = e;
          pickId = id;
        }
      }
    }
    for (const c of ev.consume) used.set(c.pool, (used.get(c.pool) ?? 0) + c.amount);
    hits.push({ txnId: t.id, cardId: pickId, reward: ev.reward, mult: ev.mult, rule: ev.rule });
    byCard[pickId] = (byCard[pickId] ?? 0) + ev.reward;
  }
  void cards;
  const total = hits.reduce((a, h) => a + h.reward, 0);
  return { hits, byCard, total };
}

// ---------- the receipt ----------

export type CardReceipt = {
  cardId: string;
  rewards: number;
  credits: number;
  fee: number;
  interest: number;
  net: number;
};

export type Receipt = {
  rewards: number;
  credits: number;
  fees: number;
  interest: number;
  net: number;
  leftOnTable: number;
  perCard: CardReceipt[];
  actual: SimResult;
  best: SimResult;
  spend: number;
};

export function interestFor(h: Holding): number {
  if (!h.balance || h.balance <= 0) return 0;
  const apr = h.apr ?? card(h.cardId).purchase_apr_range[1];
  return (h.balance * apr) / 100;
}

export function creditsUsed(h: Holding): number {
  return Object.values(h.creditsUsed ?? {}).reduce((a, b) => a + b, 0);
}

export function receipt(wallet: Holding[], txns: Txn[], defaultCard?: string): Receipt {
  const actual = simulate(wallet, txns, "actual", defaultCard);
  const best = simulate(wallet, txns, "best");
  const perCard = wallet.map((h) => {
    const c = card(h.cardId);
    const rewards = actual.byCard[h.cardId] ?? 0;
    const credits = creditsUsed(h);
    const interest = interestFor(h);
    return { cardId: h.cardId, rewards, credits, fee: c.annual_fee, interest, net: rewards + credits - c.annual_fee - interest };
  });
  const sum = (k: keyof CardReceipt) => perCard.reduce((a, p) => a + (p[k] as number), 0);
  return {
    rewards: sum("rewards"),
    credits: sum("credits"),
    fees: sum("fee"),
    interest: sum("interest"),
    net: sum("net"),
    leftOnTable: Math.max(0, best.total - actual.total),
    perCard,
    actual,
    best,
    spend: txns.reduce((a, t) => a + t.amount, 0),
  };
}

// ---------- keep or cancel / what if ----------

/** Value a card adds over the rest of the wallet: best-play rewards with it minus without
 *  it, plus credits actually used, minus its fee. */
export function marginalValue(wallet: Holding[], txns: Txn[], cardId: string) {
  const without = wallet.filter((h) => h.cardId !== cardId);
  const withIt = simulate(wallet, txns, "best").total;
  const withoutIt = without.length ? simulate(without, txns, "best").total : 0;
  const h = wallet.find((x) => x.cardId === cardId);
  const credits = h ? creditsUsed(h) : 0;
  const fee = card(cardId).annual_fee;
  const rewardsAdded = withIt - withoutIt;
  return { rewardsAdded, credits, fee, net: rewardsAdded + credits - fee };
}

/** If you added this card (paid in full, credits unused), how much better off a year? */
export function whatIf(wallet: Holding[], txns: Txn[], cardId: string) {
  if (wallet.some((h) => h.cardId === cardId)) return null;
  const now = simulate(wallet, txns, "best").total;
  const next = simulate([...wallet, { cardId }], txns, "best").total;
  const fee = card(cardId).annual_fee;
  return { rewardsAdded: next - now, fee, net: next - now - fee };
}

// ---------- tap ----------

export type TapOption = { cardId: string; reward: number; mult: number; rule: string; blocked?: string };

export function tap(
  wallet: Holding[],
  t: Omit<Txn, "id" | "cardUsed">,
  history: Txn[] = [],
): { ranked: TapOption[]; pick: TapOption; capNotes: string[] } {
  const used = new Map<string, number>();
  // replay this period's history on the best policy so caps reflect what's already used
  const sim = simulate(wallet, history, "best");
  for (const h of sim.hits) {
    const tx = history.find((x) => x.id === h.txnId)!;
    const c = card(h.cardId);
    const ev = evaluate(c, tx, new Map(), chooseOptions(h.cardId, history));
    for (const x of ev.consume) used.set(x.pool, (used.get(x.pool) ?? 0) + x.amount);
  }
  const txn: Txn = { ...t, id: "tap", cardUsed: "" };
  const ranked: TapOption[] = wallet
    .map((h) => {
      const c = card(h.cardId);
      const e = evaluate(c, txn, used, chooseOptions(h.cardId, history));
      const blocked =
        h.balance && h.balance > 0
          ? `Carries a $${Math.round(h.balance).toLocaleString()} balance at ${h.apr ?? c.purchase_apr_range[1]}% APR: new purchases start charging interest today.`
          : undefined;
      return { cardId: h.cardId, reward: e.reward, mult: e.mult, rule: e.rule, blocked };
    })
    .sort((a, b) => b.reward - a.reward);
  const pick = ranked.find((r) => !r.blocked) ?? ranked[0];
  const capNotes: string[] = [];
  for (const h of wallet) {
    const c = card(h.cardId);
    if (c.rotating && c.rotating.activation_required && c.rotating.q4_2026.includes(t.category))
      capNotes.push(`${c.name}: ${c.rotating.multiplier}% on ${t.category} this quarter, but only if activated.`);
  }
  return { ranked, pick, capNotes };
}
