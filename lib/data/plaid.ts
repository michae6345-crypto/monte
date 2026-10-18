// Plaid -> Monte mapping. PURE: no network, no env, no Plaid SDK import, so it runs in
// a script, in a route handler and in a test the same way.
//
// The category rules are not invented here: they come from data/category_map.json and its
// `how_to_apply` field, which says, in order:
//   1. skip negative amounts on a credit account (Plaid: positive = money out),
//   2. merchant_overrides first-match-wins against merchant_name, then name /
//      original_description after stripping descriptor_prefixes,
//   3. else detailed_map[pfc.detailed], else primary_map[pfc.primary], else everything_else,
//   4. exclude: true means not reward-eligible spend (income, transfers, payments, fees),
//   5. merchant_dependent / review entries are low confidence - surface them.
//
// Output types are the engine's own (lib/engine Txn / Holding), which is also the shape
// lib/data/personas.ts produces, so the UI can swap persona -> Plaid with one call.

import rawMap from "@/data/category_map.json";
import { CARDS } from "@/lib/engine/catalog";
import type { Holding, Txn } from "@/lib/engine";

// ---------- the category map ----------

type MapEntry = {
  category: string | null;
  exclude?: boolean;
  note?: string;
  review?: boolean;
  merchant_dependent?: boolean;
  pfc_versions?: string[];
};
type OverrideEntry = { pattern: string; category: string; note?: string; review?: boolean; merchant_dependent?: boolean };
type CategoryMap = {
  vocabulary: string[];
  how_to_apply: string[];
  primary_map: Record<string, MapEntry>;
  detailed_map: Record<string, MapEntry>;
  merchant_overrides: OverrideEntry[];
  descriptor_prefixes: { prefix: string; meaning?: string }[];
};

const MAP = rawMap as unknown as CategoryMap;
const VOCAB = new Set(MAP.vocabulary);
const FALLBACK_CATEGORY = "everything_else";

/** Compiled once: merchant_overrides in file order, because first match wins. */
const OVERRIDES: { re: RegExp; entry: OverrideEntry }[] = MAP.merchant_overrides.map((entry) => ({
  re: new RegExp(entry.pattern, "i"),
  entry,
}));

/** Longest prefix first, so "DD *DOORDASH" is not half-stripped by a shorter prefix. */
const PREFIXES = MAP.descriptor_prefixes
  .map((p) => p.prefix.toUpperCase())
  .sort((a, b) => b.length - a.length);

// ---------- Plaid-shaped inputs ----------
// Structural subsets of the Plaid v48 response types: anything the SDK returns is
// assignable to these, and a hand-written fixture can be too (see scripts/plaid-fixture-test.ts).

export type PlaidPfc = { primary: string; detailed?: string; confidence_level?: string | null };

export type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Plaid convention: positive = money out of the account (a purchase). */
  amount: number;
  name: string;
  merchant_name?: string | null;
  original_description?: string | null;
  pending?: boolean;
  personal_finance_category?: PlaidPfc | null;
  iso_currency_code?: string | null;
};

export type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type?: string;
  subtype?: string | null;
  balances?: { current?: number | null; available?: number | null; limit?: number | null } | null;
};

export type PlaidApr = { apr_percentage: number; apr_type: string; balance_subject_to_apr?: number | null };

export type PlaidCreditLiability = {
  account_id?: string | null;
  aprs: PlaidApr[];
  last_statement_balance?: number | null;
  minimum_payment_amount?: number | null;
  is_overdue?: boolean | null;
};

// ---------- card matching ----------

/** Flat-rate cash-back default when an account name tells us nothing (Plaid sandbox
 *  returns "Plaid Credit Card"): 2% on everything, no annual fee, no assumptions. */
export const DEFAULT_CARD_ID = "citi_double_cash";

/** Distinctive product names, checked before the generic token score. Order matters:
 *  the more specific name has to win ("blue cash preferred" before "blue cash"). */
const CARD_KEYWORDS: [RegExp, string][] = [
  [/sapphire\s*reserve/i, "chase_sapphire_reserve"],
  [/sapphire\s*preferred|\bcsp\b/i, "chase_sapphire_preferred"],
  [/freedom\s*unlimited|\bcfu\b/i, "chase_freedom_unlimited"],
  [/freedom\s*flex/i, "chase_freedom_flex"],
  [/prime\s*visa|amazon\s*(prime\s*)?(rewards|visa)/i, "chase_prime_visa"],
  [/blue\s*cash\s*preferred|\bbcp\b/i, "amex_blue_cash_preferred"],
  [/blue\s*cash\s*everyday|\bbce\b/i, "amex_blue_cash_everyday"],
  [/(amex|american\s*express).*\bplatinum\b|platinum\s*card/i, "amex_platinum"],
  [/(amex|american\s*express).*\bgold\b|gold\s*card/i, "amex_gold"],
  [/venture\s*x/i, "capital_one_venture_x"],
  [/\bventure\b/i, "capital_one_venture"],
  [/\bsavor\b/i, "capital_one_savor"],
  [/quicksilver\s*student/i, "capital_one_quicksilver_student"],
  [/quicksilver/i, "capital_one_quicksilver"],
  [/platinum\s*secured|secured.*capital\s*one/i, "capital_one_platinum_secured"],
  [/double\s*cash/i, "citi_double_cash"],
  [/custom\s*cash/i, "citi_custom_cash"],
  [/strata\s*premier|premier\s*card/i, "citi_strata_premier"],
  [/discover\s*it.*student/i, "discover_it_student_cash_back"],
  [/discover\s*it.*secured/i, "discover_it_secured"],
  [/discover\s*it|discover\s*card/i, "discover_it_cash_back"],
  [/active\s*cash/i, "wells_fargo_active_cash"],
  [/autograph/i, "wells_fargo_autograph"],
  [/customized\s*cash/i, "bofa_customized_cash_rewards"],
  [/apple\s*card/i, "apple_card"],
  [/bilt\s*palladium/i, "bilt_palladium"],
  [/bilt\s*obsidian/i, "bilt_obsidian"],
  [/bilt/i, "bilt_blue"],
  [/altitude\s*go/i, "us_bank_altitude_go"],
];

const STOPWORDS = new Set([
  "card",
  "credit",
  "the",
  "from",
  "visa",
  "mastercard",
  "signature",
  "rewards",
  "cash",
  "back",
  "account",
  "bank",
  "plaid",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Best-effort account-name -> catalog card id, with a sensible default. Never throws:
 *  an id that is not in the catalog would crash the engine, so we only ever return
 *  catalog ids. */
export function matchCardId(account: Pick<PlaidAccount, "name" | "official_name" | "subtype">): string {
  const text = [account.official_name ?? "", account.name ?? ""].join(" ").trim();
  if (text) {
    for (const [re, id] of CARD_KEYWORDS) if (re.test(text)) return id;
    // Generic fallback: score catalog names by distinctive shared tokens.
    const want = new Set(tokens(text));
    let bestId = "";
    let bestScore = 0;
    for (const c of CARDS) {
      const score = tokens(`${c.name} ${c.issuer}`).filter((t) => want.has(t)).length;
      if (score > bestScore) {
        bestScore = score;
        bestId = c.id;
      }
    }
    if (bestScore >= 2) return bestId;
  }
  return DEFAULT_CARD_ID;
}

// ---------- merchant and category ----------

/** Strip POS / processor descriptor prefixes (SQ *, TST*, DD *...) so the real merchant
 *  is what the overrides see. */
export function stripDescriptorPrefix(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 3; i++) {
    const upper = s.toUpperCase();
    const hit = PREFIXES.find((p) => upper.startsWith(p));
    if (!hit) break;
    s = s.slice(hit.length).replace(/^[\s*]+/, "");
  }
  return s.trim();
}

/** Display merchant: Plaid's cleaned merchant_name when it has one, else the raw
 *  descriptor with the processor prefix and trailing store/terminal numbers removed. */
export function merchantOf(t: PlaidTransaction): string {
  const named = t.merchant_name?.trim();
  if (named) return named;
  const s = stripDescriptorPrefix(t.name ?? "")
    .replace(/\s+#?\d{3,}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s || (t.name ?? "").trim() || "Unknown";
}

export type CategoryDecision = {
  /** null when this transaction is not reward-eligible spend and must be dropped. */
  category: string | null;
  /** Why it was dropped, when it was. */
  dropped?: "refund_or_payment" | "excluded_category" | "pending";
  /** Which rule decided, for provenance: "override", "detailed", "primary", "fallback". */
  via: "override" | "detailed" | "primary" | "fallback" | "none";
  /** how_to_apply rule 5: merchant_dependent / review entries are low confidence. */
  lowConfidence: boolean;
  note?: string;
};

function finish(entry: MapEntry | OverrideEntry, via: CategoryDecision["via"]): CategoryDecision {
  const excluded = "exclude" in entry && entry.exclude === true;
  const raw = entry.category;
  const category = excluded || !raw ? null : VOCAB.has(raw) ? raw : FALLBACK_CATEGORY;
  return {
    category,
    dropped: category === null ? "excluded_category" : undefined,
    via,
    lowConfidence: Boolean(entry.review || entry.merchant_dependent),
    note: entry.note,
  };
}

/** data/category_map.json's how_to_apply, in order. */
export function categorize(t: PlaidTransaction): CategoryDecision {
  // 1. Plaid: positive = money out. Negative or zero on a credit account is a refund,
  //    a payment or a transfer, and is never reward-eligible spend.
  if (!(t.amount > 0)) {
    return { category: null, dropped: "refund_or_payment", via: "none", lowConfidence: false };
  }

  // 2. merchant_overrides, first match wins: merchant_name first, then the raw
  //    descriptor(s) with processor prefixes stripped.
  const candidates = [
    t.merchant_name ?? "",
    stripDescriptorPrefix(t.name ?? ""),
    stripDescriptorPrefix(t.original_description ?? ""),
  ].filter(Boolean);
  for (const { re, entry } of OVERRIDES) {
    if (candidates.some((c) => re.test(c))) return finish(entry, "override");
  }

  // 3. detailed_map, then primary_map, then everything_else.
  const pfc = t.personal_finance_category;
  if (pfc?.detailed) {
    const d = MAP.detailed_map[pfc.detailed];
    if (d) return finish(d, "detailed");
  }
  if (pfc?.primary) {
    const p = MAP.primary_map[pfc.primary];
    if (p) return finish(p, "primary");
  }
  return { category: FALLBACK_CATEGORY, via: "fallback", lowConfidence: true, note: "No personal_finance_category matched the map." };
}

// ---------- transactions ----------

const round2 = (n: number) => Math.round(n * 100) / 100;

export type MapTxnOptions = {
  /** Pending transactions are provisional; the demo uses posted ones only. */
  includePending?: boolean;
  /** account_id -> catalog card id. Falls back to matching the account name. */
  cardByAccount?: Record<string, string>;
};

export type MappedTxns = {
  txns: Txn[];
  /** How many Plaid rows we dropped, and why - shown as "x of y not reward-eligible". */
  dropped: { refundOrPayment: number; excluded: number; pending: number };
  /** Txn ids whose category came from a low-confidence map entry (how_to_apply rule 5). */
  lowConfidenceIds: string[];
};

export function mapTransactions(
  plaidTxns: PlaidTransaction[],
  accounts: PlaidAccount[] = [],
  opts: MapTxnOptions = {},
): MappedTxns {
  const byAccount: Record<string, string> = { ...opts.cardByAccount };
  for (const a of accounts) if (!byAccount[a.account_id]) byAccount[a.account_id] = matchCardId(a);

  const txns: Txn[] = [];
  const lowConfidenceIds: string[] = [];
  const dropped = { refundOrPayment: 0, excluded: 0, pending: 0 };

  for (const t of plaidTxns) {
    if (t.pending && !opts.includePending) {
      dropped.pending++;
      continue;
    }
    const d = categorize(t);
    if (!d.category) {
      if (d.dropped === "refund_or_payment") dropped.refundOrPayment++;
      else dropped.excluded++;
      continue;
    }
    txns.push({
      id: t.transaction_id,
      date: (t.date ?? "").slice(0, 10),
      merchant: merchantOf(t),
      amount: round2(t.amount),
      category: d.category,
      cardUsed: byAccount[t.account_id] ?? DEFAULT_CARD_ID,
    });
    if (d.lowConfidence) lowConfidenceIds.push(t.transaction_id);
  }

  txns.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  return { txns, dropped, lowConfidenceIds };
}

// ---------- liabilities -> wallet ----------

/** Purchase APR in percent, from the liability's aprs[]. Only purchase_apr matters for
 *  what spending costs; balance-transfer / cash / penalty APRs are a different balance. */
export function purchaseApr(aprs: PlaidApr[] | undefined | null): number | undefined {
  const purchase = (aprs ?? []).find((a) => a.apr_type === "purchase_apr");
  const apr = purchase?.apr_percentage;
  return typeof apr === "number" && apr > 0 ? round2(apr) : undefined;
}

/** Revolving balance in dollars. Plaid reports credit balances as positive = owed. */
function revolvingBalance(account: PlaidAccount | undefined, liability: PlaidCreditLiability | undefined): number {
  const subject = liability?.aprs?.find((a) => a.apr_type === "purchase_apr")?.balance_subject_to_apr;
  const candidate = subject ?? liability?.last_statement_balance ?? account?.balances?.current ?? 0;
  return Math.max(0, round2(Math.abs(candidate ?? 0)));
}

export function mapWallet(accounts: PlaidAccount[], credit: PlaidCreditLiability[] = []): Holding[] {
  const liabilityByAccount = new Map(credit.filter((c) => c.account_id).map((c) => [c.account_id as string, c]));
  const accountById = new Map(accounts.map((a) => [a.account_id, a]));
  // Liabilities can name an account the accounts array does not, and vice versa.
  const creditAccountIds = new Set([
    ...accounts.filter((a) => a.type === "credit").map((a) => a.account_id),
    ...credit.map((c) => c.account_id).filter((id): id is string => Boolean(id)),
  ]);

  const byCard = new Map<string, Holding>();
  for (const accountId of creditAccountIds) {
    const account = accountById.get(accountId);
    const liability = liabilityByAccount.get(accountId);
    const cardId = account ? matchCardId(account) : DEFAULT_CARD_ID;
    const balance = revolvingBalance(account, liability);
    const apr = purchaseApr(liability?.aprs);
    const existing = byCard.get(cardId);
    if (existing) {
      // Two different Plaid accounts matched the same catalog card: one holding, worst
      // case wins (balances add up, the higher APR stands).
      const total = round2((existing.balance ?? 0) + balance);
      if (total > 0) existing.balance = total;
      if (apr && apr > (existing.apr ?? 0)) existing.apr = apr;
      continue;
    }
    const holding: Holding = { cardId };
    if (balance > 0) holding.balance = balance;
    if (apr) holding.apr = apr;
    byCard.set(cardId, holding);
  }
  return [...byCard.values()];
}

// ---------- the one shape the UI consumes ----------

/** Same pair the personas feed the store (wallet + txns), plus provenance. */
export type PlaidFeed = {
  txns: Txn[];
  wallet: Holding[];
  source: "plaid-sandbox";
  dropped: { refundOrPayment: number; excluded: number; pending: number };
  lowConfidenceIds: string[];
};

export function buildFeed(input: {
  transactions: PlaidTransaction[];
  accounts: PlaidAccount[];
  credit?: PlaidCreditLiability[] | null;
  includePending?: boolean;
}): PlaidFeed {
  const wallet = mapWallet(input.accounts, input.credit ?? []);
  const cardByAccount: Record<string, string> = {};
  for (const a of input.accounts) cardByAccount[a.account_id] = matchCardId(a);
  const { txns, dropped, lowConfidenceIds } = mapTransactions(input.transactions, input.accounts, {
    cardByAccount,
    includePending: input.includePending,
  });

  // The engine charges a txn to wallet[0] when its cardUsed is not in the wallet, so
  // every card a transaction was put on has to be in the wallet.
  const have = new Set(wallet.map((h) => h.cardId));
  for (const t of txns) {
    if (!have.has(t.cardUsed)) {
      have.add(t.cardUsed);
      wallet.push({ cardId: t.cardUsed });
    }
  }
  if (wallet.length === 0) wallet.push({ cardId: DEFAULT_CARD_ID });

  return { txns, wallet, source: "plaid-sandbox", dropped, lowConfidenceIds };
}
