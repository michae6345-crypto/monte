// Which card to pay with, counting the interest a purchase adds as well as what it earns.
//
// The question this answers: if a person can't pay a balance down and pays interest anyway, how
// does routing purchases away from the card with the balance help?
//
// The answer, as the engine now computes it:
//  - A card that carries a balance has no grace period. A new purchase on it accrues interest
//    from the day it posts, for as long as that balance revolves. A card paid in full each
//    month keeps its grace period, so the same purchase costs no interest at all if that
//    statement is paid. While at least one card is paid in full, a card with a balance is
//    skipped, and the skip says what it would have cost: one month alone is APR / 12, about
//    2.2% at 26%, which is more than almost any card earns.
//  - When every card carries a balance, he's right: the purchase costs interest wherever it
//    goes. Then nothing is skipped and the cards are ranked by what they earn minus the
//    interest the purchase adds, which usually means the lowest APR wins.
//
// tap() is unchanged (the demo's numbers and tests rest on it); this wraps it.

import { tap, type Holding, type TapOption, type Txn } from "./index";
import { card } from "./catalog";

/** How long a purchase on a card with a balance is assumed to ride that balance. One month
 *  is the floor (the purchase posts, then the statement closes, then it is due); a balance
 *  that has revolved for a while usually keeps revolving, so this understates the cost. */
export const CARRY_MONTHS = 1;

export const aprOf = (h: Holding) => h.apr ?? card(h.cardId).purchase_apr_range[1];
export const carries = (h: Holding) => !!h.balance && h.balance > 0;

/** Interest this purchase adds on this card over `months`. Zero on a card paid in full. */
export function purchaseInterest(h: Holding, amount: number, months = CARRY_MONTHS): number {
  if (!carries(h) || !(amount > 0)) return 0;
  return amount * (aprOf(h) / 100) * (months / 12);
}

export type Choice = TapOption & {
  /** interest the purchase adds on this card over CARRY_MONTHS (0 when paid in full) */
  interest: number;
  /** reward minus interest: what the purchase is worth on this card */
  net: number;
  apr: number;
  carries: boolean;
};

/** none: no card carries a balance (pure rewards). grace: some do, and they're skipped.
 *  all: every card does, so the cheapest net of interest wins. */
export type Mode = "none" | "grace" | "all";

export type Decision = {
  pick: Choice;
  /** the pick first; then the other candidates by net; then any skipped cards by net */
  ranked: Choice[];
  mode: Mode;
  /** the best-earning card that was skipped for its balance, when it out-earns the pick */
  skipped?: Choice;
  capNotes: string[];
};

export function choose(wallet: Holding[], t: Omit<Txn, "id" | "cardUsed">, history: Txn[] = [], months = CARRY_MONTHS): Decision {
  if (!wallet.length) throw new Error("choose: the wallet is empty");
  const base = tap(wallet, t, history);
  const hold = new Map(wallet.map((h) => [h.cardId, h]));
  const all: Choice[] = base.ranked.map((o) => {
    const h = hold.get(o.cardId)!;
    const interest = purchaseInterest(h, t.amount, months);
    return { ...o, interest, net: o.reward - interest, apr: aprOf(h), carries: carries(h) };
  });
  const free = all.filter((c) => !c.carries);
  const mode: Mode = free.length === all.length ? "none" : free.length ? "grace" : "all";
  const byNet = (a: Choice, b: Choice) => b.net - a.net || b.reward - a.reward || a.cardId.localeCompare(b.cardId);
  const pool = mode === "grace" ? free : all;
  const candidates = [...pool].sort(byNet);
  const rest = all.filter((c) => !pool.includes(c)).sort(byNet);
  // when every card carries a balance nothing is "off limits": it's a cost, ranked like one
  const ranked = (mode === "all" ? candidates.map((c) => ({ ...c, blocked: undefined })) : [...candidates, ...rest]) as Choice[];
  const pick = ranked[0];
  const skipped = rest.filter((c) => c.reward > pick.reward + 0.004).sort((a, b) => b.reward - a.reward)[0];
  return { pick, ranked, mode, skipped, capNotes: base.capNotes };
}
