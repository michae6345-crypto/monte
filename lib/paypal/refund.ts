// Returns put the cap back. When a PayPal refund completes, the spending-cap counter the
// purchase filled goes back down by the refunded amount, and the rewards it earned are reversed
// in proportion to how much of it came back.
//
// Pure and deterministic, like the rest of the money math: no network, no model. The engine's
// own evaluate() says which cap pool the purchase used, so the rollback can't touch a pool
// the purchase never filled.

import { evaluate, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { capMapFrom, type CapRow } from "@/lib/db/cap-state";

const round2 = (n: number) => Math.round(n * 100) / 100;
const CENTS = /^\d{1,7}(\.\d{1,2})?$/;

/** A refund amount as PayPal wants it: "12.30". null if it isn't a positive amount to the cent. */
export function refundValue(raw: unknown): string | null {
  const s = typeof raw === "number" ? (Number.isFinite(raw) ? String(raw) : "") : typeof raw === "string" ? raw.trim() : "";
  if (!CENTS.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents >= 1 ? (cents / 100).toFixed(2) : null;
}

export type Rollback = {
  cardId: string;
  category: string;
  /** What came back, in dollars. */
  refunded: number;
  /** Dollars of cap room given back, summed over the pools the purchase used. */
  capReleased: number;
  /** What the purchase earned when it was made, and how much of that the refund takes back. */
  rewardOriginal: number;
  rewardReversed: number;
  /** The cap rows after the rollback: exactly what goes back into cap_state. */
  rows: CapRow[];
};

/** Undo `refund` dollars of a captured purchase `txn` (amount = what was captured) on the
 *  person's cap rows. The counter goes down by the refunded amount, never below zero, and only
 *  in the pools this purchase consumed. Rewards reverse proportionally: refund / amount of
 *  what the purchase earned against the counters as they stood before it. */
export function rollbackRefund(rows: CapRow[], txn: Txn, refund: number): Rollback {
  if (!(txn.amount > 0)) throw new RangeError(`Not a captured amount: ${txn.amount}`);
  if (!(refund > 0) || refund > txn.amount + 1e-9) throw new RangeError(`Refund ${refund} must be between $0.01 and ${txn.amount}`);
  const c = card(txn.cardUsed);
  // Which pools a purchase like this fills: an empty cap map shows every pool it would touch.
  const pools = evaluate(c, txn, new Map(), null).consume.map((x) => x.pool);

  const take = (base: CapRow[], dollars: number): { rows: CapRow[]; released: number } => {
    let released = 0;
    const out = base.map((r) => {
      if (r.card_id !== txn.cardUsed || !pools.includes(`${r.pool_key}|${r.period_key}`)) return { ...r };
      // A counter that is already at or below zero has nothing to give back (and must not grow).
      const back = Math.max(0, Math.min(dollars, Number(r.consumed)));
      released += back;
      return { ...r, consumed: round2(Number(r.consumed) - back) };
    });
    return { rows: out, released: round2(released) };
  };

  // The counters before this purchase, to price what it originally earned.
  const before = take(rows, txn.amount).rows;
  const rewardOriginal = evaluate(c, txn, capMapFrom(before), null).reward;
  const after = take(rows, refund);
  return {
    cardId: txn.cardUsed,
    category: txn.category,
    refunded: round2(refund),
    capReleased: after.released,
    rewardOriginal: round2(rewardOriginal),
    rewardReversed: round2((rewardOriginal * refund) / txn.amount),
    rows: after.rows,
  };
}

// ---------- replay guard ----------

/** Refund ids whose cap rollback has already been applied in this process. PayPal answers a
 *  retried PayPal-Request-Id with the SAME refund, so without this a double click would roll the
 *  cap back twice. In memory, like the webhook de-dupe: a cold start forgets it. */
const MAX_APPLIED = 1000;
const applied = new Set<string>();

/** true the first time a refund id is seen; false for a replay of one already applied. */
export function claimRefund(refundId: string): boolean {
  if (applied.has(refundId)) return false;
  applied.add(refundId);
  if (applied.size > MAX_APPLIED) applied.delete(applied.values().next().value as string);
  return true;
}
/** Release a claim whose rollback failed, so a retry can apply it. */
export function releaseRefund(refundId: string): void {
  applied.delete(refundId);
}
