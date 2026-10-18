// GET /api/plaid/data -> { txns, wallet, source: "plaid-sandbox" }, already mapped to the
// engine's types - the same (wallet, txns) pair lib/data/personas.ts produces, so the UI
// swaps persona -> Plaid with this one call.
//
// transactions/sync is paginated to has_more = false and retried while the sandbox
// prepares transactions; liabilitiesGet supplies each credit card's balance and purchase
// APR. Mapping (categories, merchants, card matching) is lib/data/plaid.ts.

import { cookies } from "next/headers";
import { buildFeed } from "@/lib/data/plaid";
import { PLAID_COOKIE, notConfigured, notLinked, plaidClient, plaidFailure } from "@/lib/data/plaid-server";
import { fetchCreditLiabilities, syncAllTransactions } from "@/lib/data/plaid-sync";

export async function GET() {
  const client = plaidClient();
  if (!client) return notConfigured();

  const accessToken = (await cookies()).get(PLAID_COOKIE)?.value;
  if (!accessToken) return notLinked();

  try {
    const sync = await syncAllTransactions(client, accessToken);
    // Liabilities can be unavailable (an institution without credit products); the
    // wallet then falls back to the accounts and card matching alone.
    let accounts = sync.accounts;
    let credit: Awaited<ReturnType<typeof fetchCreditLiabilities>>["credit"] = [];
    try {
      const liabilities = await fetchCreditLiabilities(client, accessToken);
      credit = liabilities.credit;
      if (liabilities.accounts.length) accounts = liabilities.accounts;
    } catch {
      credit = [];
    }

    const feed = buildFeed({ transactions: sync.transactions, accounts, credit });
    return Response.json(
      { ...feed, status: sync.status, pages: sync.pages },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return plaidFailure(e);
  }
}
