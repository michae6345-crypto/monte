// Runs the Plaid mapping (lib/data/plaid.ts) over hand-written Plaid-shaped fixtures and
// asserts the result. No network, no Plaid keys, no new deps - this is what proves the
// mapping while we have no sandbox credentials.
//
//   node --import ./scripts/_alias.mjs scripts/plaid-fixture-test.ts
//
// Exits non-zero on the first failed assertion.

import {
  DEFAULT_CARD_ID,
  buildFeed,
  categorize,
  mapTransactions,
  mapWallet,
  matchCardId,
  merchantOf,
  purchaseApr,
  type PlaidAccount,
  type PlaidCreditLiability,
  type PlaidTransaction,
} from "@/lib/data/plaid";
import { receipt } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  failures++;
  console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

function ok(label: string, condition: boolean, detail = "") {
  checks++;
  if (condition) return;
  failures++;
  console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
}

// ---------- fixtures ----------
// Shaped like Plaid /transactions/sync `added` rows (v48). Amounts positive = money out.

const ACCOUNT_CREDIT: PlaidAccount = {
  account_id: "acct_credit_1",
  name: "Plaid Credit Card",
  official_name: "Plaid Diamond 12.5% APR Interest Credit Card",
  mask: "3333",
  type: "credit",
  subtype: "credit card",
  balances: { current: 410, available: 2590, limit: 3000 },
};

const ACCOUNT_SAPPHIRE: PlaidAccount = {
  account_id: "acct_credit_2",
  name: "Chase Sapphire Preferred",
  official_name: "Chase Sapphire Preferred Visa Signature",
  mask: "9012",
  type: "credit",
  subtype: "credit card",
  balances: { current: 0, limit: 12000 },
};

const ACCOUNT_CHECKING: PlaidAccount = {
  account_id: "acct_depository_1",
  name: "Plaid Checking",
  official_name: "Plaid Gold Standard 0% Interest Checking",
  type: "depository",
  subtype: "checking",
  balances: { current: 1203.42 },
};

const pfc = (primary: string, detailed: string, confidence_level = "VERY_HIGH") => ({
  primary,
  detailed,
  confidence_level,
});

const TXNS: PlaidTransaction[] = [
  // 1. plain restaurant via detailed_map
  {
    transaction_id: "t_dining",
    account_id: "acct_credit_1",
    date: "2026-10-14",
    amount: 18.42,
    name: "TST* GUISADOS",
    merchant_name: "Guisados",
    personal_finance_category: pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT"),
  },
  // 2. merchant_overrides beats the PFC: Uber Eats codes as a marketplace here
  {
    transaction_id: "t_ubereats",
    account_id: "acct_credit_1",
    date: "2026-10-13",
    amount: 32.1,
    name: "UBER EATS 8KD2L",
    merchant_name: "Uber Eats",
    personal_finance_category: pfc("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"),
  },
  // 3. override on the raw descriptor only, no merchant_name, and no PFC at all
  {
    transaction_id: "t_instacart",
    account_id: "acct_credit_1",
    date: "2026-10-12",
    amount: 96.37,
    name: "SQ *INSTACART 4821",
    merchant_name: null,
    original_description: "SQ *INSTACART 4821 SAN FRANCISCO CA",
    personal_finance_category: null,
  },
  // 4. descriptor prefix stripped for display, category from the PFC
  {
    transaction_id: "t_coffee",
    account_id: "acct_credit_1",
    date: "2026-10-11",
    amount: 6.75,
    name: "SQ *BLUE BOTTLE 0094",
    merchant_name: null,
    personal_finance_category: pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE"),
  },
  // 5. gas, and cents that need rounding
  {
    transaction_id: "t_gas",
    account_id: "acct_credit_2",
    date: "2026-10-10",
    amount: 52.005,
    name: "MOBIL 0042",
    merchant_name: "Mobil",
    personal_finance_category: pfc("TRANSPORTATION", "TRANSPORTATION_GAS"),
  },
  // 6. refund: negative amount, dropped by how_to_apply rule 1
  {
    transaction_id: "t_refund",
    account_id: "acct_credit_1",
    date: "2026-10-09",
    amount: -24.99,
    name: "AMAZON MKTPL REFUND",
    merchant_name: "Amazon",
    personal_finance_category: pfc("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"),
  },
  // 7. card payment: positive amount but an excluded category
  {
    transaction_id: "t_payment",
    account_id: "acct_credit_1",
    date: "2026-10-08",
    amount: 500,
    name: "Payment Thank You - Web",
    merchant_name: null,
    personal_finance_category: pfc("LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"),
  },
  // 8. interest charge: excluded, never spend
  {
    transaction_id: "t_interest",
    account_id: "acct_credit_1",
    date: "2026-10-07",
    amount: 31.18,
    name: "INTEREST CHARGE ON PURCHASES",
    personal_finance_category: pfc("BANK_FEES", "BANK_FEES_INTEREST_CHARGE"),
  },
  // 9. transfer out: excluded
  {
    transaction_id: "t_transfer",
    account_id: "acct_credit_1",
    date: "2026-10-06",
    amount: 120,
    name: "VENMO CASHOUT",
    merchant_name: "Venmo",
    personal_finance_category: pfc("TRANSFER_OUT", "TRANSFER_OUT_TRANSFER_OUT_FROM_APPS"),
  },
  // 10. unknown PFC: falls through to everything_else, flagged low confidence
  {
    transaction_id: "t_unknown",
    account_id: "acct_credit_1",
    date: "2026-10-05",
    amount: 44,
    name: "SOME NEW THING 991",
    personal_finance_category: pfc("SOMETHING_NEW", "SOMETHING_NEW_ENTIRELY", "LOW"),
  },
  // 11. primary_map fallback when the detailed value is unknown
  {
    transaction_id: "t_primary_only",
    account_id: "acct_credit_1",
    date: "2026-10-04",
    amount: 75.5,
    name: "LADWP",
    merchant_name: "LADWP",
    personal_finance_category: pfc("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_BRAND_NEW_SUBTYPE"),
  },
  // 12. pending: provisional, dropped by default
  {
    transaction_id: "t_pending",
    account_id: "acct_credit_1",
    date: "2026-10-15",
    amount: 21.5,
    name: "SWEETGREEN 118",
    merchant_name: "Sweetgreen",
    pending: true,
    personal_finance_category: pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT"),
  },
  // 13. flights on the second card
  {
    transaction_id: "t_airfare",
    account_id: "acct_credit_2",
    date: "2026-10-03",
    amount: 318,
    name: "DELTA AIR LINES",
    merchant_name: "Delta Air Lines",
    personal_finance_category: pfc("TRAVEL", "TRAVEL_FLIGHTS"),
  },
];

const CREDIT_LIABILITIES: PlaidCreditLiability[] = [
  {
    account_id: "acct_credit_1",
    aprs: [
      { apr_percentage: 27.95, apr_type: "purchase_apr", balance_subject_to_apr: 410.22 },
      { apr_percentage: 0, apr_type: "balance_transfer_apr", balance_subject_to_apr: 0 },
      { apr_percentage: 29.99, apr_type: "cash_apr", balance_subject_to_apr: 0 },
      { apr_percentage: 31.99, apr_type: "penalty_apr", balance_subject_to_apr: 0 },
    ],
    last_statement_balance: 395.5,
    minimum_payment_amount: 40,
    is_overdue: false,
  },
  {
    account_id: "acct_credit_2",
    aprs: [{ apr_percentage: 21.49, apr_type: "purchase_apr", balance_subject_to_apr: 0 }],
    last_statement_balance: 0,
    minimum_payment_amount: 0,
    is_overdue: false,
  },
];

const ACCOUNTS = [ACCOUNT_CREDIT, ACCOUNT_SAPPHIRE, ACCOUNT_CHECKING];

// ---------- categories ----------

check("dining from detailed_map", categorize(TXNS[0]).category, "dining");
check("dining via detailed_map, not an override", categorize(TXNS[0]).via, "detailed");
check("Uber Eats override beats the PFC", categorize(TXNS[1]).category, "dining");
check("override reported as the source", categorize(TXNS[1]).via, "override");
check("Instacart override on the stripped descriptor", categorize(TXNS[2]).category, "online_groceries");
check("coffee is dining", categorize(TXNS[3]).category, "dining");
check("gas", categorize(TXNS[4]).category, "gas");
check("negative amount is dropped", categorize(TXNS[5]).category, null);
check("negative amount reason", categorize(TXNS[5]).dropped, "refund_or_payment");
check("card payment is excluded", categorize(TXNS[6]).category, null);
check("card payment reason", categorize(TXNS[6]).dropped, "excluded_category");
check("interest charge is excluded", categorize(TXNS[7]).category, null);
check("transfer out is excluded", categorize(TXNS[8]).category, null);
check("unknown PFC falls back", categorize(TXNS[9]).category, "everything_else");
check("unknown PFC is low confidence", categorize(TXNS[9]).lowConfidence, true);
check("unknown PFC via", categorize(TXNS[9]).via, "fallback");
check("unknown detailed falls back to primary_map", categorize(TXNS[10]).category, "utilities");
check("primary_map reported as the source", categorize(TXNS[10]).via, "primary");
check("flights", categorize(TXNS[12]).category, "airfare");

// Every category we emit has to be in the engine's vocabulary, or the engine throws.
for (const t of TXNS) {
  const c = categorize(t).category;
  ok(`category in vocabulary: ${t.transaction_id}`, c === null || typeof c === "string");
}

// ---------- merchants ----------

check("merchant_name wins", merchantOf(TXNS[0]), "Guisados");
check("SQ * prefix stripped", merchantOf(TXNS[3]), "BLUE BOTTLE");
check("descriptor store number stripped", merchantOf(TXNS[2]), "INSTACART");

// ---------- card matching ----------

check("sapphire preferred matched by name", matchCardId(ACCOUNT_SAPPHIRE), "chase_sapphire_preferred");
check("generic sandbox card falls back to the default", matchCardId(ACCOUNT_CREDIT), DEFAULT_CARD_ID);
check("the default is a real catalog card", card(DEFAULT_CARD_ID).id, DEFAULT_CARD_ID);
check("amex gold", matchCardId({ name: "American Express Gold Card", official_name: null, subtype: "credit card" }), "amex_gold");
check(
  "blue cash preferred beats blue cash everyday",
  matchCardId({ name: "Blue Cash Preferred Card", official_name: null, subtype: "credit card" }),
  "amex_blue_cash_preferred",
);
check("apple card", matchCardId({ name: "Apple Card", official_name: null, subtype: "credit card" }), "apple_card");
check("venture x beats venture", matchCardId({ name: "Venture X Rewards", official_name: null, subtype: "credit card" }), "capital_one_venture_x");
check("empty name falls back", matchCardId({ name: "", official_name: null, subtype: null }), DEFAULT_CARD_ID);

// ---------- transactions ----------

const mapped = mapTransactions(TXNS, ACCOUNTS);
check("dropped refunds and payments", mapped.dropped, { refundOrPayment: 1, excluded: 3, pending: 1 });
check("kept the reward-eligible rows", mapped.txns.length, 8);
check(
  "ids kept, oldest first",
  mapped.txns.map((t) => t.id),
  ["t_airfare", "t_primary_only", "t_unknown", "t_gas", "t_coffee", "t_instacart", "t_ubereats", "t_dining"],
);
check("dates are YYYY-MM-DD", mapped.txns.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date)), true);
check("amounts are positive", mapped.txns.every((t) => t.amount > 0), true);
check("amount rounded to cents", mapped.txns.find((t) => t.id === "t_gas")?.amount, 52.01);
check("cardUsed from the matched account", mapped.txns.find((t) => t.id === "t_gas")?.cardUsed, "chase_sapphire_preferred");
check("cardUsed default for the generic account", mapped.txns.find((t) => t.id === "t_dining")?.cardUsed, DEFAULT_CARD_ID);
check("low-confidence ids surfaced", mapped.lowConfidenceIds, ["t_unknown"]);

const withPending = mapTransactions(TXNS, ACCOUNTS, { includePending: true });
check("pending included on request", withPending.txns.length, 9);

const overridden = mapTransactions(TXNS, ACCOUNTS, { cardByAccount: { acct_credit_1: "amex_gold" } });
check("cardByAccount override wins", overridden.txns.find((t) => t.id === "t_dining")?.cardUsed, "amex_gold");

check("empty input is not a crash", mapTransactions([], []).txns, []);

// ---------- liabilities -> wallet ----------

check("purchase APR picked out of aprs[]", purchaseApr(CREDIT_LIABILITIES[0].aprs), 27.95);
check("no purchase APR", purchaseApr([{ apr_percentage: 0, apr_type: "purchase_apr" }]), undefined);
check("no aprs at all", purchaseApr(undefined), undefined);

const wallet = mapWallet(ACCOUNTS, CREDIT_LIABILITIES);
check("one holding per credit account, checking ignored", wallet.length, 2);
check(
  "holdings",
  wallet,
  [
    { cardId: DEFAULT_CARD_ID, balance: 410.22, apr: 27.95 },
    { cardId: "chase_sapphire_preferred", apr: 21.49 },
  ],
);
check("no liabilities still yields a wallet", mapWallet([ACCOUNT_SAPPHIRE], []), [{ cardId: "chase_sapphire_preferred" }]);

// ---------- the whole feed ----------

const feed = buildFeed({ transactions: TXNS, accounts: ACCOUNTS, credit: CREDIT_LIABILITIES });
check("source", feed.source, "plaid-sandbox");
check("feed txns", feed.txns.length, 8);
check("feed wallet", feed.wallet.map((h) => h.cardId), [DEFAULT_CARD_ID, "chase_sapphire_preferred"]);
ok(
  "every cardUsed is in the wallet (the engine charges unknown cards to wallet[0])",
  feed.txns.every((t) => feed.wallet.some((h) => h.cardId === t.cardUsed)),
);
check("a feed with no accounts still has a wallet", buildFeed({ transactions: [], accounts: [] }).wallet.length, 1);

// The point of the whole exercise: the feed runs through the engine like a persona does.
const r = receipt(feed.wallet, feed.txns);
ok("receipt runs on the Plaid feed", Number.isFinite(r.net), `net=${r.net}`);
ok("receipt saw the spend", r.spend > 0, `spend=${r.spend}`);
check(
  "receipt spend equals the mapped amounts",
  Math.round(r.spend * 100) / 100,
  Math.round(feed.txns.reduce((s, t) => s + t.amount, 0) * 100) / 100,
);
ok("balance carried through to the wallet", feed.wallet.some((h) => (h.balance ?? 0) > 0));

// ---------- result ----------

console.log(`${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
console.log(
  `feed: ${feed.txns.length} txns on ${feed.wallet.length} cards, ` +
    `dropped ${feed.dropped.refundOrPayment} refunds/payments + ${feed.dropped.excluded} excluded + ${feed.dropped.pending} pending, ` +
    `net ${r.net.toFixed(2)}`,
);
