// Checks the merchant labeler. The model labels merchants; it never prices anything.
// A wrong label costs a category, and the engine downstream stays exact.
// Fallback path always runs; the live path runs only if ANTHROPIC_API_KEY is set.

import { categorize, fallback, CATEGORIES } from "@/lib/model/categorize";

const UGLY = [
  "SQ *BLUE BOTTLE COF 0417 LOS ANGELES CA",
  "TST* GUISADOS ECHO PARK",
  "AMZN Mktp US*2K3",
  "UBER *TRIP HELP.UBER.COM",
  "SHELL OIL 57444",
  "POS TRADER JOE'S #123 PASADENA CA",
  "NETFLIX.COM",
  "COSTCO WHSE #0479",
];

const valid = new Set<string>(CATEGORIES);
let fail = 0;
const fb = fallback(UGLY);
for (const r of fb) {
  const ok = valid.has(r.category) && r.confidence === "review" && r.merchant.length > 0;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.raw.padEnd(42)} -> ${r.merchant} [${r.category}]`);
}
const weird = fallback(["", "   ", "*", "12345"]);
if (weird.length !== 4 || !weird.every((r) => valid.has(r.category))) fail++;

if (process.env.ANTHROPIC_API_KEY) {
  const live = await categorize(UGLY);
  console.log(`\nlive (${live.model}):`);
  for (const r of live.results) {
    if (!valid.has(r.category)) fail++;
    console.log(`  ${r.raw.padEnd(42)} -> ${r.merchant} [${r.category}, ${r.confidence}]`);
  }
} else {
  console.log("\nlive path skipped: ANTHROPIC_API_KEY not set");
}

console.log(fail ? `\n${fail} failure(s)` : "\nall checks passed");
process.exit(fail ? 1 : 0);
