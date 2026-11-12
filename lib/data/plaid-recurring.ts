// Plaid /transactions/recurring/get -> Monte's recurring charges. PURE: no network, no
// env, no SDK runtime import (types only), so a test can feed it a fixture.
//
// The output is a superset of lib/engine/insights.ts `Subscription` (what the Leaks view
// already reads from subscriptions(txns)), so the UI can show the bank's own streams in
// the same place with no new shape. Only outflow streams are mapped: inflows are pay and
// refunds, never a leak. Tombstoned streams (stopped billing) are dropped by default.

import type { Subscription } from "@/lib/engine/insights";
import { DEFAULT_CARD_ID, categorize, matchCardId, type PlaidAccount, type PlaidPfc } from "@/lib/data/plaid";

// ---------- Plaid-shaped inputs (structural subsets of the v48 SDK types) ----------

export type PlaidStreamAmount = { amount?: number | null; iso_currency_code?: string | null };

export type PlaidTransactionStream = {
  account_id: string;
  stream_id: string;
  description: string;
  merchant_name?: string | null;
  first_date: string;
  last_date: string;
  predicted_next_date?: string | null;
  /** WEEKLY | BIWEEKLY | SEMI_MONTHLY | MONTHLY | ANNUALLY | UNKNOWN */
  frequency: string;
  transaction_ids?: string[];
  average_amount: PlaidStreamAmount;
  last_amount: PlaidStreamAmount;
  is_active: boolean;
  /** MATURE | EARLY_DETECTION | TOMBSTONED | UNKNOWN */
  status: string;
  personal_finance_category?: PlaidPfc | null;
};

export type PlaidRecurringResponse = {
  inflow_streams?: PlaidTransactionStream[] | null;
  outflow_streams?: PlaidTransactionStream[] | null;
};

// ---------- output ----------

export type RecurringStatus = "active" | "early_detection" | "tombstoned";

export type RecurringCharge = Subscription & {
  source: "plaid-recurring";
  streamId: string;
  accountId: string;
  /** Catalog card id of the account it bills to (Monte's default card when unknown). */
  cardId: string;
  /** Plaid's frequency, as sent. */
  frequency: string;
  averageAmount: number;
  lastAmount: number;
  firstDate: string;
  lastDate: string;
  nextDate: string | null;
  status: RecurringStatus;
};

// ---------- frequency ----------

const PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMI_MONTHLY: 24,
  MONTHLY: 12,
  ANNUALLY: 1,
};

const DAY_MS = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Charges per year for a Plaid frequency. UNKNOWN falls back to the stream's own
 *  history (span / (count - 1)); null when there is nothing to go on. */
export function chargesPerYear(
  frequency: string,
  history?: { firstDate?: string; lastDate?: string; count?: number },
): number | null {
  const known = PER_YEAR[(frequency ?? "").toUpperCase()];
  if (known) return known;
  const count = history?.count ?? 0;
  if (!history?.firstDate || !history?.lastDate || count < 2) return null;
  const span = (Date.parse(history.lastDate) - Date.parse(history.firstDate)) / DAY_MS;
  if (!(span > 0)) return null;
  const gap = span / (count - 1);
  return gap >= 1 ? 365 / gap : null;
}

/** Average charge x charges per year, in dollars; null when the frequency is unusable. */
export function yearlyCost(
  averageAmount: number,
  frequency: string,
  history?: { firstDate?: string; lastDate?: string; count?: number },
): number | null {
  const n = chargesPerYear(frequency, history);
  return n === null ? null : round2(Math.abs(averageAmount) * n);
}

export function normalizeStatus(status: string, isActive: boolean): RecurringStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "TOMBSTONED") return "tombstoned";
  if (s === "EARLY_DETECTION") return "early_detection";
  if (s === "MATURE") return "active";
  return isActive ? "active" : "tombstoned";
}

// ---------- the mapper ----------

export type MapRecurringOptions = {
  /** Accounts from the same item: used to name the card each stream bills to. */
  accounts?: PlaidAccount[];
  /** account_id -> catalog card id; wins over name matching. */
  cardByAccount?: Record<string, string>;
  /** Keep streams Plaid has stopped seeing. Default false. */
  includeTombstoned?: boolean;
};

export function mapRecurring(res: PlaidRecurringResponse, opts: MapRecurringOptions = {}): RecurringCharge[] {
  const byAccount: Record<string, string> = { ...opts.cardByAccount };
  for (const a of opts.accounts ?? []) if (!byAccount[a.account_id]) byAccount[a.account_id] = matchCardId(a);

  const out: RecurringCharge[] = [];
  // inflow_streams are deliberately never read.
  for (const s of res.outflow_streams ?? []) {
    const status = normalizeStatus(s.status, s.is_active);
    if (status === "tombstoned" && !opts.includeTombstoned) continue;

    const averageAmount = round2(s.average_amount?.amount ?? 0);
    const lastAmount = round2(s.last_amount?.amount ?? averageAmount);
    // Plaid: positive = money out. A non-positive "outflow" is a refund pattern, not a bill.
    if (!(averageAmount > 0)) continue;

    const count = s.transaction_ids?.length ?? 0;
    const history = { firstDate: s.first_date, lastDate: s.last_date, count };
    const perYearCharges = chargesPerYear(s.frequency, history);
    if (perYearCharges === null) continue;

    const merchant = s.merchant_name?.trim() || s.description?.trim() || "Unknown";
    const decision = categorize({
      transaction_id: s.stream_id,
      account_id: s.account_id,
      date: s.last_date,
      amount: averageAmount,
      name: s.description ?? "",
      merchant_name: s.merchant_name ?? null,
      personal_finance_category: s.personal_finance_category ?? null,
    });

    out.push({
      merchant,
      category: decision.category ?? "everything_else",
      amount: lastAmount,
      first: averageAmount,
      count,
      cadenceDays: Math.round(365 / perYearCharges),
      perYear: round2(averageAmount * perYearCharges),
      priceHike: lastAmount > averageAmount * 1.04,
      source: "plaid-recurring",
      streamId: s.stream_id,
      accountId: s.account_id,
      cardId: byAccount[s.account_id] ?? DEFAULT_CARD_ID,
      frequency: s.frequency,
      averageAmount,
      lastAmount,
      firstDate: s.first_date,
      lastDate: s.last_date,
      nextDate: s.predicted_next_date ?? null,
      status,
    });
  }
  return out.sort((a, b) => b.perYear - a.perYear || a.merchant.localeCompare(b.merchant));
}
