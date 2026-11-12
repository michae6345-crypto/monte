// PayPal Pay in 4 next to the card that carries a balance: what splitting the purchase
// into four 0% payments would cost, and what the same purchase costs on that card at its APR.
//
// Deterministic, no network. Pay in 4's terms here are PayPal's published US terms: four
// payments, the first today and then every 2 weeks, 0% interest, for purchases of $30 to
// $1,500. Approval is up to PayPal and not every purchase or person qualifies; a late payment
// can carry a fee. Nothing here says the person is approved.
//
// The card side, stated once and used everywhere: the purchase goes on a card that already
// carries a balance, so there is no grace period and interest starts today. The person pays
// this purchase off in equal monthly payments over N months (default 12, a "minimum-ish"
// pace), with interest compounding monthly at APR / 12. That is a standard amortized loan;
// actual issuers compute interest on the average daily balance, so treat this as an estimate.

import type { Holding } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";

export const PAY_IN_4 = { min: 30, max: 1500, payments: 4, everyDays: 14 } as const;
/** The card payoff pace the comparison assumes, in months. */
export const DEFAULT_PAYOFF_MONTHS = 12;

export type Installment = { n: number; date: string; amount: number };

export type BalanceCard = { cardId: string; name: string; apr: number; balance: number };

export type PayLaterComparison = {
  amount: number;
  eligible: boolean;
  /** Why not, in plain words, when it isn't eligible. */
  reason: string | null;
  schedule: Installment[];
  /** null when no card in the wallet carries a balance. */
  card: BalanceCard | null;
  months: number;
  /** Interest on the card over `months` of equal payments. 0 when there's no card. */
  cardInterest: number;
  cardMonthlyPayment: number;
  /** Interest Pay in 4 avoids compared with the card, if paid on time. */
  interestAvoided: number;
};

const toCents = (n: number) => Math.round(n * 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Is this amount inside Pay in 4's US range? */
export function payIn4Eligible(amount: number): { eligible: boolean; reason: string | null } {
  if (!Number.isFinite(amount) || amount <= 0) return { eligible: false, reason: "Not a purchase amount." };
  if (amount < PAY_IN_4.min) return { eligible: false, reason: `Pay in 4 starts at $${PAY_IN_4.min}.` };
  if (amount > PAY_IN_4.max) return { eligible: false, reason: `Pay in 4 tops out at $${PAY_IN_4.max.toLocaleString("en-US")}.` };
  return { eligible: true, reason: null };
}

/** Four payments every 2 weeks, in whole cents. Any leftover cent goes on the first payment,
 *  so the four always add up to the purchase exactly. */
export function payIn4Schedule(amount: number, startDate: string): Installment[] {
  const total = toCents(amount);
  const base = Math.floor(total / PAY_IN_4.payments);
  const extra = total - base * PAY_IN_4.payments;
  return Array.from({ length: PAY_IN_4.payments }, (_, k) => ({
    n: k + 1,
    date: addDays(startDate, k * PAY_IN_4.everyDays),
    amount: (base + (k === 0 ? extra : 0)) / 100,
  }));
}

/** Interest on `amount` at `apr` percent, paid off in `months` equal monthly payments
 *  (standard amortization, monthly rate APR / 12, interest from day one). */
export function cardPayoff(amount: number, apr: number, months: number): { payment: number; interest: number } {
  if (!(amount > 0) || !(months >= 1)) return { payment: 0, interest: 0 };
  const r = apr / 100 / 12;
  if (r <= 0) return { payment: round2(amount / months), interest: 0 };
  const payment = (amount * r) / (1 - Math.pow(1 + r, -months));
  return { payment: round2(payment), interest: round2(payment * months - amount) };
}

/** The wallet's card with a balance and the highest APR (the engine's APR fallback when the
 *  holding has none). null if nothing carries a balance. */
export function balanceCard(wallet: Holding[]): BalanceCard | null {
  let best: BalanceCard | null = null;
  for (const h of wallet) {
    if (!h.balance || h.balance <= 0) continue;
    const c = card(h.cardId);
    const apr = h.apr ?? c.purchase_apr_range[1];
    if (!best || apr > best.apr) best = { cardId: h.cardId, name: c.name, apr, balance: h.balance };
  }
  return best;
}

export function comparePayLater(amount: number, startDate: string, wallet: Holding[], months = DEFAULT_PAYOFF_MONTHS): PayLaterComparison {
  const { eligible, reason } = payIn4Eligible(amount);
  const bc = balanceCard(wallet);
  const payoff = bc ? cardPayoff(amount, bc.apr, months) : { payment: 0, interest: 0 };
  return {
    amount,
    eligible,
    reason,
    schedule: eligible ? payIn4Schedule(amount, startDate) : [],
    card: bc,
    months,
    cardInterest: payoff.interest,
    cardMonthlyPayment: payoff.payment,
    interestAvoided: eligible ? payoff.interest : 0,
  };
}

const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One sentence for the panel, built only from the comparison's numbers. */
export function payLaterLine(c: PayLaterComparison): string {
  if (!c.eligible) return `${c.reason} Pay in 4 isn't an option for ${usd(c.amount)}.`;
  const split = `Pay in 4 splits ${usd(c.amount)} into 4 payments of about ${usd(c.schedule[1].amount)}, every 2 weeks, at 0% interest.`;
  if (!c.card) return split;
  return `${split} On ${c.card.name} at ${c.card.apr}% APR, paid off over ${c.months} months, the same purchase costs about ${usd(c.cardInterest)} in interest.`;
}

export const PAY_LATER_FINE_PRINT =
  "Pay in 4 depends on PayPal approving you for this purchase, and a late payment can carry a fee. It isn't free money: it's the same price, spread out. Card interest assumes equal monthly payments starting today.";
