// PayPal purchase history -> Monte transactions, so PayPal spending counts in the engine.
//
// Two halves, the same split as lib/data/plaid.ts / plaid-sync.ts:
//   - mapPayPalTransactions(): PURE. PayPal Transaction Search `transaction_details` in,
//     engine Txn[] out. No network, no env; the tests run it on a fixture.
//   - fetchPayPalTransactions(): GET /v1/reporting/transactions over <=31-day windows
//     (PayPal's limit), every page of each, sandbox only.
//
// Categories are deterministic: data/category_map.json's merchant_overrides via the Plaid
// mapper's categorize(), else everything_else. No model call. PayPal does not say WHICH
// credit card funded a payment (only instrument_type, e.g. CREDIT_CARD), so the card is the
// caller's choice (cardUsed), defaulting to the same flat-rate card the Plaid mapper uses.

import { categorize, DEFAULT_CARD_ID } from "@/lib/data/plaid";
import { PAYPAL_API, PayPalError } from "@/lib/paypal/client";
import type { Txn } from "@/lib/engine";

// ---------- PayPal Transaction Search shapes (the fields we read) ----------

type Money = { currency_code?: string; value?: string };

export type PayPalTransactionDetail = {
  transaction_info?: {
    transaction_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_updated_date?: string;
    transaction_amount?: Money;
    fee_amount?: Money;
    transaction_status?: string;
    transaction_subject?: string;
    instrument_type?: string;
    instrument_sub_type?: string;
  };
  payer_info?: {
    email_address?: string;
    payer_name?: { given_name?: string; surname?: string; alternate_full_name?: string };
  };
  payee_info?: { business_name?: string; email_address?: string };
  cart_info?: { item_details?: { item_name?: string; item_description?: string }[] };
};

export type TransactionSearchPage = {
  transaction_details?: PayPalTransactionDetail[];
  page?: number;
  total_pages?: number;
  total_items?: number;
};

// ---------- mapping (pure) ----------

export type PayPalMapOptions = {
  /** Catalog card id that funds PayPal purchases. Default: DEFAULT_CARD_ID. */
  cardUsed?: string;
};

export type PayPalDropReason = "not_a_payment" | "incoming" | "not_completed" | "not_usd" | "excluded_category" | "bad_row";

export type MappedPayPal = {
  txns: Txn[];
  dropped: Record<PayPalDropReason, number>;
};

/** T00xx are payments (checkout, subscriptions, website payments...). Everything else is a
 *  fee (T01), currency conversion (T02), bank move (T03/T04), refund/reversal (T11), hold (T21),
 *  transfer (T22) and so on: not purchases. */
const PAYMENT_CODE = /^T00\d\d$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Display merchant: the counterparty's business name, then their name, then the subject,
 *  then the first cart item. */
export function paypalMerchant(d: PayPalTransactionDetail): string {
  const name = d.payer_info?.payer_name;
  const candidates = [
    d.payee_info?.business_name,
    name?.alternate_full_name,
    [name?.given_name, name?.surname].filter(Boolean).join(" "),
    d.transaction_info?.transaction_subject,
    d.cart_info?.item_details?.[0]?.item_name,
  ];
  for (const c of candidates) if (c && c.trim()) return c.trim();
  return "PayPal purchase";
}

/** Payer-side completed USD payments become spend; refunds, transfers, fees, incoming money,
 *  pending/denied rows and non-USD rows are counted in `dropped` and skipped. */
export function mapPayPalTransactions(details: PayPalTransactionDetail[], opts: PayPalMapOptions = {}): MappedPayPal {
  const cardUsed = opts.cardUsed ?? DEFAULT_CARD_ID;
  const dropped: Record<PayPalDropReason, number> = {
    not_a_payment: 0, incoming: 0, not_completed: 0, not_usd: 0, excluded_category: 0, bad_row: 0,
  };
  const txns: Txn[] = [];
  const seen = new Set<string>();

  for (const d of details) {
    const info = d.transaction_info;
    const id = info?.transaction_id;
    const date = (info?.transaction_initiation_date ?? "").slice(0, 10);
    const value = Number(info?.transaction_amount?.value);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || seen.has(id)) {
      dropped.bad_row++;
      continue;
    }
    if (!PAYMENT_CODE.test(info?.transaction_event_code ?? "")) {
      dropped.not_a_payment++;
      continue;
    }
    // Account-holder view: money out is negative. Positive = someone paid us, not spend.
    if (!(value < 0)) {
      dropped.incoming++;
      continue;
    }
    if ((info?.transaction_status ?? "S") !== "S") {
      dropped.not_completed++;
      continue;
    }
    if ((info?.transaction_amount?.currency_code ?? "USD") !== "USD") {
      dropped.not_usd++;
      continue;
    }

    const merchant = paypalMerchant(d);
    const item = d.cart_info?.item_details?.[0]?.item_name ?? "";
    const decision = categorize({
      transaction_id: id,
      account_id: "paypal",
      amount: -value,
      date,
      name: merchant,
      merchant_name: merchant,
      original_description: item,
      pending: false,
    });
    if (!decision.category) {
      dropped.excluded_category++;
      continue;
    }
    seen.add(id);
    txns.push({ id: `paypal-${id}`, date, merchant, amount: round2(-value), category: decision.category, cardUsed });
  }

  txns.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  return { txns, dropped };
}

// ---------- date windows ----------

export const MAX_WINDOW_DAYS = 31;
const DAY_MS = 86_400_000;

/** Split [start, end] into contiguous windows no longer than 31 days, as Transaction Search
 *  requires. Each window ends 1 second before the next begins. */
export function dateWindows(start: Date, end: Date, maxDays = MAX_WINDOW_DAYS): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const endMs = end.getTime();
  let s = start.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(endMs) || s > endMs) return out;
  while (s <= endMs) {
    const e = Math.min(s + maxDays * DAY_MS - 1000, endMs);
    out.push({ start: iso(s), end: iso(e) });
    s = e + 1000;
  }
  return out;
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

// ---------- network (server only) ----------

const TIMEOUT_MS = 15_000;
const PAGE_SIZE = 500;
const MAX_PAGES_PER_WINDOW = 50;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** client.ts keeps its token helper private, so this module gets its own client-credentials
 *  token (sandbox base URL from client.ts), cached until shortly before it expires. */
let cached: { clientId: string; value: string; expires: number } | null = null;

export async function transactionsAccessToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  if (cached && cached.clientId === clientId && cached.expires > Date.now()) return cached.value;
  const res = await fetchImpl(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${process.env.PAYPAL_CLIENT_SECRET ?? ""}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; name?: string; message?: string };
  if (!res.ok || !data.access_token) throw new PayPalError(res.status, data);
  cached = { clientId, value: data.access_token, expires: Date.now() + ((data.expires_in ?? 0) - 60) * 1000 };
  return data.access_token;
}

export type FetchOptions = {
  start: Date;
  end: Date;
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Skip the OAuth call (tests). */
  token?: string;
};

/** Every transaction_detail in [start, end]: one request per window per page. */
export async function fetchPayPalTransactions(opts: FetchOptions): Promise<PayPalTransactionDetail[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = opts.token ?? (await transactionsAccessToken(fetchImpl));
  const all: PayPalTransactionDetail[] = [];
  for (const w of dateWindows(opts.start, opts.end)) {
    for (let page = 1; page <= MAX_PAGES_PER_WINDOW; page++) {
      const qs = new URLSearchParams({
        start_date: w.start,
        end_date: w.end,
        fields: "all",
        page_size: String(PAGE_SIZE),
        page: String(page),
      });
      const res = await fetchImpl(`${PAYPAL_API}/v1/reporting/transactions?${qs}`, {
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => ({}))) as TransactionSearchPage & { name?: string; message?: string };
      if (!res.ok) throw new PayPalError(res.status, body);
      all.push(...(body.transaction_details ?? []));
      if (page >= (body.total_pages ?? 1)) break;
    }
  }
  return all;
}

/** Fetch + map, for the route. Throws PayPalError on a PayPal failure. */
export async function importPayPalPurchases(opts: FetchOptions & PayPalMapOptions): Promise<MappedPayPal> {
  return mapPayPalTransactions(await fetchPayPalTransactions(opts), opts);
}
