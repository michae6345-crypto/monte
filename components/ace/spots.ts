// The stores Tap and the Monte Card offer, made the selected person's: in each category the
// person shops in, their most-visited store at their typical amount. A person who already shops
// at the sample store keeps it, so Jordan's demo numbers never move.

import type { Txn } from "@/lib/engine";

export function spotsFor<T extends { merchant: string; category: string; amount: number; where: string }>(base: T[], txns: Txn[], where: string): T[] {
  return base.map((s) => {
    const mine = txns.filter((t) => t.category === s.category);
    if (!mine.length || mine.some((t) => t.merchant === s.merchant)) return s;
    const by = new Map<string, number[]>();
    for (const t of mine) by.set(t.merchant, [...(by.get(t.merchant) ?? []), t.amount]);
    const [merchant, amounts] = [...by.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const sorted = [...amounts].sort((a, b) => a - b);
    return { ...s, merchant, amount: Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100, where };
  });
}
