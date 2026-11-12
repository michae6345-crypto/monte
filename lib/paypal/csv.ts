// The PayPal activity table as a CSV file, for anyone who wants the rows in a spreadsheet.
//
// Pure: no DOM, no network. Every dollar is whatever the activity table already computed with
// the engine; this only formats it. Text cells that a spreadsheet would read as a formula
// (=, +, -, @, tab or carriage return first) get a leading apostrophe, because merchant names
// imported from PayPal Transaction Search are outside text.

export type ActivityCsvRow = {
  date: string;
  merchant: string;
  source: "session" | "paypal";
  amount: number;
  card: string;
  reward: number;
  rewardKept: number;
  cap: string;
  refunded: number;
  refund: string;
};

export const ACTIVITY_CSV_HEADER = [
  "date",
  "merchant",
  "source",
  "amount_usd",
  "card",
  "reward_usd",
  "reward_kept_usd",
  "cap_after",
  "refunded_usd",
  "refund_status",
] as const;

const FORMULA = /^[=+\-@\t\r]/;

/** One CSV cell: formula-looking text defused, then quoted if it holds a comma, quote or newline. */
export function csvCell(value: string | number): string {
  let s = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(2) : "") : value;
  if (typeof value === "string" && FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole file: a header row, then one row per purchase, CRLF line ends as RFC 4180 asks. */
export function activityCsv(rows: ActivityCsvRow[]): string {
  const lines = [ACTIVITY_CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.merchant,
        r.source === "session" ? "Monte checkout" : "PayPal Transaction Search",
        r.amount,
        r.card,
        r.reward,
        r.rewardKept,
        r.cap,
        r.refunded,
        r.refund,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
