// Server-side Plaid reads: /transactions/sync paginated to the end, plus credit
// liabilities. Mapping to our types happens in lib/data/plaid.ts; this file only fetches.

import type { PlaidApi, Transaction } from "plaid";
import type { PlaidAccount, PlaidCreditLiability, PlaidTransaction } from "@/lib/data/plaid";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SyncResult = {
  transactions: PlaidTransaction[];
  accounts: PlaidAccount[];
  /** Plaid's own readiness flag; NOT_READY means the historical pull is still running. */
  status: string;
  pages: number;
  cursor: string;
};

/** Pull every page until has_more = false, applying added/modified/removed in order.
 *  In sandbox the first sync can return nothing while transactions are still being
 *  prepared (transactions_update_status = NOT_READY), so retry a few times. */
export async function syncAllTransactions(
  client: PlaidApi,
  accessToken: string,
  opts: { retries?: number; retryDelayMs?: number } = {},
): Promise<SyncResult> {
  const retries = opts.retries ?? 5;
  const retryDelayMs = opts.retryDelayMs ?? 1500;

  for (let attempt = 0; ; attempt++) {
    const byId = new Map<string, Transaction>();
    const removed = new Set<string>();
    let accounts: PlaidAccount[] = [];
    let cursor: string | undefined;
    let status = "";
    let pages = 0;

    for (;;) {
      const res = await client.transactionsSync({
        access_token: accessToken,
        ...(cursor ? { cursor } : {}),
        count: 500,
        options: { include_original_description: true, include_personal_finance_category: true },
      });
      const d = res.data;
      pages++;
      status = String(d.transactions_update_status ?? "");
      if (d.accounts?.length) accounts = d.accounts;
      for (const t of d.added ?? []) byId.set(t.transaction_id, t);
      for (const t of d.modified ?? []) byId.set(t.transaction_id, t);
      for (const r of d.removed ?? []) {
        removed.add(r.transaction_id);
        byId.delete(r.transaction_id);
      }
      cursor = d.next_cursor;
      if (!d.has_more) break;
    }

    const transactions = [...byId.values()].filter((t) => !removed.has(t.transaction_id));
    const ready = transactions.length > 0 || status === "HISTORICAL_UPDATE_COMPLETE";
    if (ready || attempt >= retries) {
      return { transactions, accounts, status, pages, cursor: cursor ?? "" };
    }
    // Sandbox is still building the item's history: wait and sync again from scratch.
    await sleep(retryDelayMs);
  }
}

export async function fetchCreditLiabilities(
  client: PlaidApi,
  accessToken: string,
): Promise<{ accounts: PlaidAccount[]; credit: PlaidCreditLiability[] }> {
  const res = await client.liabilitiesGet({ access_token: accessToken });
  return { accounts: res.data.accounts ?? [], credit: res.data.liabilities?.credit ?? [] };
}
