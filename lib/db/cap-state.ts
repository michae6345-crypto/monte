// The cache that makes a tap instant.
//
// Without it, answering "which card should pay?" means replaying the year to work out how
// much of each cap is already spent — about 3ms, and it grows with your history. With it,
// a tap is one indexed read keyed by (card, pool, period), and the cost stops depending on
// how long you've been a customer.
//
// The rule: sync walks the history once and writes these counters. Every purchase after
// that increments them. Nothing replays.

import { chooseOptions, evaluate, type Holding, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";

/** Pick-one cards (BofA Customized Cash) must be evaluated with the category the person
 *  chose. Passing null to evaluate() turns on EVERY choice option at once, which pays 3%
 *  on six categories instead of one. With a history we choose the way the engine does;
 *  without one we choose none, so the card is understated rather than overstated. */
export function choiceFor(cardId: string, txns: Txn[]): Set<string> | null {
  const hasChoice = card(cardId).earn_rules.some((r) => r.choice_group);
  if (!hasChoice) return null;
  return txns.length ? chooseOptions(cardId, txns) : new Set();
}

export type CapRow = { card_id: string; pool_key: string; period_key: string; consumed: number };

/** Walk a history once and total what each cap pool has consumed. Run on sync, and on
 *  any backfill. The output is exactly what lands in public.cap_state. */
export function capStateFrom(wallet: Holding[], txns: Txn[]): CapRow[] {
  const used = new Map<string, number>();
  const byCard = new Map<string, Map<string, number>>();
  const choices = new Map(wallet.map((h) => [h.cardId, choiceFor(h.cardId, txns)]));

  for (const t of [...txns].sort((a, b) => a.date.localeCompare(b.date))) {
    const holding = wallet.find((h) => h.cardId === t.cardUsed);
    if (!holding) continue;
    const ev = evaluate(card(holding.cardId), t, used, choices.get(holding.cardId) ?? null);
    for (const c of ev.consume) {
      used.set(c.pool, (used.get(c.pool) ?? 0) + c.amount);
      if (!byCard.has(holding.cardId)) byCard.set(holding.cardId, new Map());
      byCard.get(holding.cardId)!.set(c.pool, (byCard.get(holding.cardId)!.get(c.pool) ?? 0) + c.amount);
    }
  }

  const rows: CapRow[] = [];
  for (const [cardId, pools] of byCard) {
    for (const [poolAndPeriod, consumed] of pools) {
      // the engine keys a pool as "<pool>|<periodKey>"
      const i = poolAndPeriod.lastIndexOf("|");
      rows.push({
        card_id: cardId,
        pool_key: poolAndPeriod.slice(0, i),
        period_key: poolAndPeriod.slice(i + 1),
        consumed: Math.round(consumed * 100) / 100,
      });
    }
  }
  return rows;
}

/** Rebuild the engine's in-memory cap map from stored rows, so a tap can be answered
 *  without touching the transaction history at all. */
export function capMapFrom(rows: CapRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(`${r.pool_key}|${r.period_key}`, Number(r.consumed));
  return m;
}

/** After a purchase is approved, add what it consumed. This is the only write a tap makes. */
export function applyPurchase(rows: CapRow[], holding: Holding, t: Txn, choice: Set<string> | null = choiceFor(holding.cardId, [])): CapRow[] {
  const used = capMapFrom(rows);
  const ev = evaluate(card(holding.cardId), t, used, choice);
  const next = [...rows];
  for (const c of ev.consume) {
    const i = c.pool.lastIndexOf("|");
    const pool_key = c.pool.slice(0, i);
    const period_key = c.pool.slice(i + 1);
    const found = next.find((r) => r.card_id === holding.cardId && r.pool_key === pool_key && r.period_key === period_key);
    if (found) found.consumed = Math.round((found.consumed + c.amount) * 100) / 100;
    else next.push({ card_id: holding.cardId, pool_key, period_key, consumed: Math.round(c.amount * 100) / 100 });
  }
  return next;
}
