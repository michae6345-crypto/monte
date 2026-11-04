// A balance transfer: move a carried balance to a card with a 0% intro APR on transfers, and pay
// it off inside the intro period. The catalog states intro offers as text ("0% for 18 months on
// balance transfers only"); this reads the months from it. Transfer fees aren't in the catalog as
// numbers ("balance transfer fee applies"): they're usually 3% to 5% of the balance, so savings
// are figured at the worst case, 5%, and the range is shown.

import type { Holding } from "@/lib/engine";
import { CARDS, card, openToNewApplicants } from "@/lib/engine/catalog";
import { aprOf } from "@/lib/engine/interest";

export type Transfer = {
  toCardId: string;
  months: number;
  /** pay this a month to clear it inside the intro period */
  monthly: number;
  /** interest on the same steady payoff at the card's own APR */
  interestStaying: number;
  feeLow: number;
  feeHigh: number;
  /** interestStaying minus the worst-case (5%) fee */
  saved: number;
};

/** "0% for 18 months on balance transfers only" -> 18; null when the offer has no balance transfers. */
export function transferMonths(intro: string | undefined | null): number | null {
  if (!intro) return null;
  const m = /0%\s+for\s+(\d+)\s+months?\s+on\s+([^;]*?)(?:,\s*then|;|$)/i.exec(intro);
  if (!m || !/balance transfer/i.test(m[2])) return null;
  return Number(m[1]);
}

const issuerOf = (id: string) => card(id).issuer.replace(/\s*\(.*\)\s*/, "").trim();

/** The longest 0% balance-transfer offer from a different issuer (issuers don't take transfers
 *  from their own cards) on a card you don't already have (intro offers are for new accounts), if
 *  it saves money on this balance. */
export function bestTransfer(h: Holding, wallet: Holding[] = []): Transfer | null {
  const balance = h.balance ?? 0;
  if (!(balance > 0)) return null;
  const apr = aprOf(h) / 100;
  const held = new Set([h.cardId, ...wallet.map((w) => w.cardId)]);
  let best: Transfer | null = null;
  for (const c of CARDS) {
    if (held.has(c.id) || issuerOf(c.id) === issuerOf(h.cardId) || !openToNewApplicants(c)) continue;
    const months = transferMonths((c as { intro_apr?: string }).intro_apr);
    if (!months) continue;
    // a steady payoff over the intro months: the balance averages about half its size
    const interestStaying = balance * (apr / 12) * months * 0.5;
    const t: Transfer = {
      toCardId: c.id,
      months,
      monthly: balance / months,
      interestStaying,
      feeLow: balance * 0.03,
      feeHigh: balance * 0.05,
      saved: interestStaying - balance * 0.05,
    };
    if (t.saved > 0 && (!best || t.saved > best.saved)) best = t;
  }
  return best;
}
