// The one call the UI makes to swap a persona for real Plaid data.
//
//   import { loadPlaidSandbox } from "@/lib/data/plaid-feed";
//   const feed = await loadPlaidSandbox();   // { txns, wallet, source: "plaid-sandbox" }
//
// feed.wallet / feed.txns are exactly the pair lib/data/personas.ts produces, so they go
// straight into the store (see docs/deploy.md for the two-line store diff).
// Failures throw a PlaidUnavailable carrying a stable `code`: "plaid_not_configured" when
// the deployment has no Plaid keys (the normal case right now), in which case the UI
// should stay on the personas and say so.

import type { PlaidFeed } from "@/lib/data/plaid";

export type { PlaidFeed } from "@/lib/data/plaid";

export class PlaidUnavailable extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "PlaidUnavailable";
    this.code = code;
    this.status = status;
  }
}

async function readError(res: Response, fallback: string): Promise<PlaidUnavailable> {
  let code = fallback;
  let message: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; message?: string; code?: string };
    if (body.error) code = body.error;
    message = body.message ?? body.code ?? undefined;
  } catch {
    // non-JSON error body (a proxy or a crash): keep the fallback code
  }
  return new PlaidUnavailable(code, res.status, message);
}

/** Link the Plaid sandbox item (no Link UI) and return the mapped feed. */
export async function loadPlaidSandbox(): Promise<PlaidFeed> {
  const linked = await fetch("/api/plaid/sandbox", { method: "POST", cache: "no-store" });
  if (!linked.ok) throw await readError(linked, "plaid_link_failed");
  return fetchPlaidData();
}

/** Re-read the already-linked item (the access_token cookie is still set). */
export async function fetchPlaidData(): Promise<PlaidFeed> {
  const res = await fetch("/api/plaid/data", { cache: "no-store" });
  if (!res.ok) throw await readError(res, "plaid_data_failed");
  return (await res.json()) as PlaidFeed;
}
