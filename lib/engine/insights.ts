// Spending analytics over a year of transactions. Pure functions.

import type { Txn } from "./index";

export function byCategory(txns: Txn[]) {
  const m = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const e = m.get(t.category) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count++;
    m.set(t.category, e);
  }
  const total = txns.reduce((a, t) => a + t.amount, 0);
  return [...m.entries()]
    .map(([category, v]) => ({ category, ...v, share: total ? v.total / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

export function byMonth(txns: Txn[], cats: string[]) {
  const months = new Map<string, Record<string, number>>();
  for (const t of txns) {
    const k = t.date.slice(0, 7);
    const row = months.get(k) ?? {};
    const c = cats.includes(t.category) ? t.category : "other";
    row[c] = (row[c] ?? 0) + t.amount;
    months.set(k, row);
  }
  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, parts]) => ({ month, parts, total: Object.values(parts).reduce((a, b) => a + b, 0) }));
}

export function topMerchants(txns: Txn[], n = 8) {
  const m = new Map<string, { total: number; count: number; category: string }>();
  for (const t of txns) {
    const e = m.get(t.merchant) ?? { total: 0, count: 0, category: t.category };
    e.total += t.amount;
    e.count++;
    m.set(t.merchant, e);
  }
  return [...m.entries()]
    .map(([merchant, v]) => ({ merchant, ...v, avg: v.total / v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export type Subscription = {
  merchant: string;
  category: string;
  amount: number; // latest charge
  first: number;
  count: number;
  cadenceDays: number;
  perYear: number;
  priceHike: boolean;
};

const NOT_SUBSCRIPTIONS = new Set(["dining", "groceries", "gas", "rideshare", "transit", "online_retail", "drugstores", "everything_else", "wholesale_clubs"]);

/** A merchant charged 3+ times at a near-constant amount on a near-regular schedule. */
export function subscriptions(txns: Txn[]): Subscription[] {
  const g = new Map<string, Txn[]>();
  for (const t of txns) g.set(t.merchant, [...(g.get(t.merchant) ?? []), t]);
  const out: Subscription[] = [];
  for (const [merchant, list] of g) {
    if (list.length < 3 || NOT_SUBSCRIPTIONS.has(list[0].category)) continue;
    const s = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amts = s.map((t) => t.amount);
    const med = [...amts].sort((a, b) => a - b)[Math.floor(amts.length / 2)];
    const steady = amts.filter((a) => Math.abs(a - med) / med < 0.08).length / amts.length;
    const gaps = s.slice(1).map((t, i) => (new Date(t.date).getTime() - new Date(s[i].date).getTime()) / 86400000);
    const gmed = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
    const regular = gaps.filter((x) => Math.abs(x - gmed) <= 6).length / Math.max(1, gaps.length);
    if (steady < 0.8 || regular < 0.6 || gmed < 6 || gmed > 40) continue;
    const last = amts[amts.length - 1];
    out.push({
      merchant,
      category: s[0].category,
      amount: last,
      first: amts[0],
      count: s.length,
      cadenceDays: Math.round(gmed),
      perYear: (last * 365) / gmed,
      priceHike: last > amts[0] * 1.04,
    });
  }
  return out.sort((a, b) => b.perYear - a.perYear);
}
