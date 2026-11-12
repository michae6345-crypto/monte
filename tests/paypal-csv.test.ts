// The PayPal activity CSV: header, cents, quoting, and formula injection from outside text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_CSV_HEADER, activityCsv, csvCell, type ActivityCsvRow } from "@/lib/paypal/csv";

const row = (over: Partial<ActivityCsvRow> = {}): ActivityCsvRow => ({
  date: "2026-11-12",
  merchant: "Trader Joe's",
  source: "session",
  amount: 84,
  card: "Amex Gold",
  reward: 3.36,
  rewardKept: 3.36,
  cap: "$84 of $25,000 used",
  refunded: 0,
  refund: "Not refunded",
  ...over,
});

test("csv: header first, then one line per row, CRLF ends", () => {
  const out = activityCsv([row(), row({ merchant: "Costco", amount: 120.5 })]);
  const lines = out.split("\r\n");
  assert.equal(lines[0], ACTIVITY_CSV_HEADER.join(","));
  assert.equal(lines.length, 4, "header + 2 rows + trailing empty");
  assert.equal(lines[3], "");
  assert.ok(out.endsWith("\r\n"));
});

test("csv: dollars to the cent and the source spelled out", () => {
  const [, first] = activityCsv([row({ amount: 84, reward: 3.364 })]).split("\r\n");
  assert.equal(first, `2026-11-12,Trader Joe's,Monte checkout,84.00,Amex Gold,3.36,3.36,"$84 of $25,000 used",0.00,Not refunded`);
  const [, imported] = activityCsv([row({ source: "paypal" })]).split("\r\n");
  assert.ok(imported.includes(",PayPal Transaction Search,"));
});

test("csv: commas, quotes and newlines are quoted per RFC 4180", () => {
  assert.equal(csvCell('Joe "the" Grocer, LA'), '"Joe ""the"" Grocer, LA"');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  assert.equal(csvCell("plain"), "plain");
});

test("csv: text that a spreadsheet would run as a formula is defused", () => {
  for (const bad of ["=HYPERLINK(\"http://x\")", "+1+1", "-2", "@SUM(A1)", "\tcmd"]) {
    assert.ok(csvCell(bad).replace(/^"/, "").startsWith("'"), `defused: ${bad}`);
  }
  // numbers are numbers, even negative ones
  assert.equal(csvCell(-2), "-2.00");
  assert.equal(csvCell(Number.NaN), "");
});
