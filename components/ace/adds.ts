// One source for "what to add": What to apply for, Pay this first and the paid-off fan chart
// all price the same shortlist with the same 1,000 simulated years, so a card never shows
// two different values (audit 2, b).

import { whatIf, type Holding, type Txn } from "@/lib/engine";
import { CARDS, openToNewApplicants } from "@/lib/engine/catalog";
import { monteCarlo } from "@/lib/engine/montecarlo";

/** Cards open to new applicants, ranked by what each would have added on last year's
 *  purchases, with any balance treated as paid off. A one-card wallet keeps student cards in
 *  view; secured cards stay out. */
export function addShortlist(wallet: Holding[], txns: Txn[], noFee = false) {
  const base = wallet.some((h) => h.balance) ? wallet.map((h) => ({ ...h, balance: 0 })) : wallet;
  const thin = wallet.length === 1;
  return CARDS.filter((c) => !wallet.some((h) => h.cardId === c.id))
    .filter((c) => !noFee || c.annual_fee === 0)
    .filter((c) => !/secured/i.test(c.id) && (thin || !/student/i.test(c.id)) && openToNewApplicants(c))
    .map((c) => ({ c, w: whatIf(base, txns, c.id)! }))
    .sort((a, b) => b.w.net - a.w.net || a.c.id.localeCompare(b.c.id));
}

/** The shortlist through 1,000 seeded years (balances assumed paid off): each card's median
 *  gain over the wallet, and the share of years it comes out ahead. */
export function addMedians(wallet: Holding[], txns: Txn[], ids: string[], driftSd = 0) {
  const mc = monteCarlo(wallet, txns, { years: 1000, seed: 42, assumePaidOff: wallet.some((h) => (h.balance ?? 0) > 0), candidates: ids, driftSd });
  const gain = new Map(
    mc.options.filter((o) => o.id.startsWith("add:")).map((o) => [o.id.slice(4), { gain: o.p50 - mc.current.p50, win: o.winShare }]),
  );
  return { mc, gain };
}
