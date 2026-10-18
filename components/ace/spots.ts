// The stores Tap and the Monte Card offer, made the selected person's: in each category the
// person shops in, their most-visited store at their typical amount. A person who already shops
// at the sample store keeps it, so Jordan's demo numbers never move. Categories the person never
// shops in are left out.

import type { Txn } from "@/lib/engine";

export function spotsFor<T extends { merchant: string; category: string; amount: number; where: string }>(base: T[], txns: Txn[], where: string): T[] {
  const out = base.flatMap((s) => {
    const mine = txns.filter((t) => t.category === s.category);
    // a category this person never shops in isn't offered (no flights for someone who never flies)
    if (!mine.length) return [];
    if (mine.some((t) => t.merchant === s.merchant)) return [s];
    const by = new Map<string, number[]>();
    for (const t of mine) by.set(t.merchant, [...(by.get(t.merchant) ?? []), t.amount]);
    const [merchant, amounts] = [...by.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const sorted = [...amounts].sort((a, b) => a - b);
    return [{ ...s, merchant, amount: Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100, where }];
  });
  return out.length >= 3 ? out : base;
}
