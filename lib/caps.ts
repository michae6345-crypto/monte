// How much of each capped bonus is used this period: Amex Gold's 4x groceries stops at $25,000 a
// year, Blue Cash Preferred's 6% at $6,000, a Freedom Flex quarter's 5% at $1,500. Spend counts
// toward a cap when it went on that card in that category, as Monte would have routed it (the
// "best" replay), in the cap's current period.

import { simulate, type Holding, type Txn } from "@/lib/engine";
import { card, type Period } from "@/lib/engine/catalog";

export type CapUse = {
  cardId: string;
  /** "4x groceries", "5% this quarter's categories" */
  label: string;
  cap: number;
  used: number;
  period: Period;
  /** "this year", "this quarter", "this month" */
  when: string;
};

function periodKey(date: string, p: Period): string {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  if (p === "month" || p === "billing_cycle") return date.slice(0, 7);
  if (p === "quarter") return `${y}-Q${Math.ceil(m / 3)}`;
  if (p === "half_year") return `${y}-H${m <= 6 ? 1 : 2}`;
  return y;
}

const WHEN: Record<string, string> = { month: "this month", billing_cycle: "this billing cycle", quarter: "this quarter", half_year: "this half-year", year: "this year" };

export function capsUsed(wallet: Holding[], txns: Txn[], today = new Date().toISOString().slice(0, 10)): CapUse[] {
  const thisYear = today.slice(0, 4);
  const inYear = txns.filter((t) => t.date.startsWith(thisYear));
  if (!inYear.length) return [];
  const byId = new Map(inYear.map((t) => [t.id, t]));
  const hits = simulate(wallet, inYear, "best").hits;
  const out: CapUse[] = [];
  for (const h of wallet) {
    const c = card(h.cardId);
    const spentOn = (cats: string[], period: Period, merchants?: string[]) =>
      hits.reduce((sum, x) => {
        if (x.cardId !== h.cardId) return sum;
        const t = byId.get(x.txnId)!;
        if (!cats.includes(t.category) || periodKey(t.date, period) !== periodKey(today, period)) return sum;
        if (merchants?.length && !merchants.some((m) => t.merchant.toLowerCase().includes(m.toLowerCase()))) return sum;
        return sum + t.amount;
      }, 0);
    for (const r of c.earn_rules) {
      if (!r.cap) continue;
      const used = spentOn([r.category], r.cap.period, r.merchants);
      if (used > 0)
        out.push({ cardId: h.cardId, label: `${r.multiplier}x ${r.category.replace(/_/g, " ")}`, cap: r.cap.amount, used, period: r.cap.period, when: WHEN[r.cap.period] ?? "" });
    }
    const rot = c.rotating as { q4_2026?: string[]; multiplier?: number; cap?: number; cap_period?: Period; period?: string; dates?: string } | undefined;
    // only while the catalog's quarter is the current one: these are Q4 2026's categories
    const [from, to] = (rot?.period ?? rot?.dates ?? "").split(" to ");
    const current = !from || !to || (today >= from && today <= to);
    if (rot?.cap && rot.q4_2026?.length && current) {
      const period = rot.cap_period ?? "quarter";
      const used = spentOn(rot.q4_2026, period);
      if (used > 0) out.push({ cardId: h.cardId, label: `${rot.multiplier}% this quarter's categories`, cap: rot.cap, used, period, when: WHEN[period] ?? "" });
    }
  }
  return out;
}
