// The one call the UI makes to pull the PayPal sandbox account's purchases.
//
//   import { loadPayPalPurchases } from "@/lib/paypal/transactions-feed";
//   const feed = await loadPayPalPurchases({ months: 12, card: "citi-double-cash" });
//
// Failures throw a PayPalImportError carrying a stable `code`: "paypal_not_configured" (503)
// when the deployment has no PayPal sandbox keys.

import type { Txn } from "@/lib/engine";

export type PayPalPurchaseFeed = {
  txns: Txn[];
  dropped: Record<string, number>;
  range: { start: string; end: string };
  source: "paypal-sandbox";
};

export class PayPalImportError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "PayPalImportError";
    this.code = code;
    this.status = status;
  }
}

export async function loadPayPalPurchases(opts: { months?: number; card?: string } = {}): Promise<PayPalPurchaseFeed> {
  const q = new URLSearchParams();
  if (opts.months) q.set("months", String(opts.months));
  if (opts.card) q.set("card", opts.card);
  const qs = q.toString();
  const res = await fetch(`/api/paypal/transactions${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) {
    let code = res.status === 503 ? "paypal_not_configured" : "paypal_import_failed";
    let message: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.error) code = body.error;
      message = body.message;
    } catch {
      // non-JSON error body: keep the fallback code
    }
    throw new PayPalImportError(code, res.status, message);
  }
  const body = (await res.json()) as PayPalPurchaseFeed;
  return { ...body, txns: Array.isArray(body.txns) ? body.txns : [], dropped: body.dropped ?? {} };
}

/** Total rows the server skipped (refunds, fees, non-USD, ...). */
export const droppedCount = (d: Record<string, number>) => Object.values(d).reduce((a, n) => a + (Number(n) || 0), 0);

