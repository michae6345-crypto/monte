// SPEC #17: does the LP/MILP replay optimizer beat the greedy best-play replay?
// Run: JITI_ALIAS='{"@":"<repo root>"}' npx jiti scripts/lp-vs-greedy.ts   (as scripts/mc.ts)
//
// Prints, per persona: greedy total, LP total, the gap in dollars, the solve time, which
// solver finished (milp = integral answer, lp = relaxation used as a bound only), and the
// upper bound. A ~$0 gap is printed as ~$0 and is not a bug: it means no cap in that
// wallet actually binds, so date order cannot cost anything.
import { simulate, type Holding, type Txn } from "@/lib/engine";
import { optimalReplay } from "@/lib/engine/lp";
import { PERSONAS, yearOf } from "@/lib/data/personas";

const $ = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.log("  CHECK FAILED:", msg);
  }
};

function run(name: string, wallet: Holding[], tx: Txn[]) {
  const greedy = simulate(wallet, tx, "best");
  const t0 = performance.now();
  const lp = optimalReplay(wallet, tx);
  const ms = performance.now() - t0;
  const gap = lp.total - greedy.total;

  console.log(`\n== ${name}: ${tx.length} txns, wallet ${wallet.map((h) => h.cardId).join(" + ")}`);
  console.log(
    `  greedy ${$(greedy.total)} | LP ${$(lp.total)} | gap ${gap < 1e-6 ? "~$0.00 (no cap binds here)" : "+" + $(gap)} | ${ms.toFixed(0)} ms | method ${lp.method}${
      lp.method === "lp" ? " (relaxation: the number below is a BOUND, not an achieved plan)" : ""
    } | upper bound ${lp.bound === undefined ? "none (solver returned nothing usable)" : $(lp.bound)}`,
  );
  if (lp.bound === undefined) console.log("  no upper bound available, so optimality is NOT claimed here.");
  else if (lp.bound > lp.total + 1e-6)
    console.log(`  bound is ${$(lp.bound - lp.total)} above the achieved plan: not proven optimal (mixed-rate cap pool or relaxation).`);
  else console.log("  achieved plan equals the upper bound: proven optimal.");
  check(lp.bound === undefined || lp.bound >= lp.total - 1e-6, `${name}: bound ${lp.bound} below achieved total ${lp.total}`);

  // the guard from the spec: the optimizer may never come in under greedy
  check(lp.total >= greedy.total - 1e-6, `${name}: LP ${lp.total} < greedy ${greedy.total}`);
  check(lp.hits.length === tx.length, `${name}: one hit per purchase`);
  check(Math.abs(lp.hits.reduce((a, h) => a + h.reward, 0) - lp.total) < 1e-9, `${name}: hits sum to total`);
  check(
    Math.abs(Object.values(lp.byCard).reduce((a, b) => a + b, 0) - lp.total) < 1e-9,
    `${name}: byCard sums to total`,
  );
  check(JSON.stringify(optimalReplay(wallet, tx)) === JSON.stringify(lp), `${name}: deterministic (same input, same output)`);
  return { greedy: greedy.total, lp: lp.total, ms };
}

for (const p of PERSONAS) run(p.name, p.wallet, yearOf(p));

// ---------------------------------------------------------------------------
// The hand-built case where greedy is PROVABLY wrong, because of a cap.
//
// Wallet: Citi Custom Cash (5% on the top category, first $500 per billing cycle, then 1%;
// 1 point = 1c) and Citi Double Cash (2% flat). Two dining purchases in one cycle:
//   Mar 3   $400      Mar 20   $500
//
// GREEDY, in date order:
//   Mar 3  Custom Cash 5% of 400 = $20.00 (beats Double Cash's $8.00) -> $100 of cap left
//   Mar 20 Custom Cash blends: (100*5 + 400*1)/500 = 1.8x -> $9.00; Double Cash 2% = $10.00
//          so greedy takes Double Cash                                    -> $10.00
//   greedy total = 20.00 + 10.00 = $30.00
// OPTIMAL, assigning both at once:
//   Mar 20 on Custom Cash: 5% of 500 (fills the $500 cap exactly)         -> $25.00
//   Mar 3  on Double Cash: 2% of 400                                      ->  $8.00
//   total = $33.00        (both on Custom Cash would be 20.00 + 9.00 = $29.00, so $33 wins)
// EXPECTED GAP = 33.00 - 30.00 = $3.00
// ---------------------------------------------------------------------------
const capWallet: Holding[] = [{ cardId: "citi_custom_cash" }, { cardId: "citi_double_cash" }];
const capTxns: Txn[] = [
  { id: "h1", date: "2026-03-03", merchant: "Sweetgreen", amount: 400, category: "dining", cardUsed: "citi_double_cash" },
  { id: "h2", date: "2026-03-20", merchant: "Sugarfish", amount: 500, category: "dining", cardUsed: "citi_double_cash" },
];
const hand = run("hand-built cap trap (2 cards, 2 purchases)", capWallet, capTxns);
check(Math.abs(hand.greedy - 30) < 1e-9, `hand-built: greedy should be $30.00, got ${hand.greedy}`);
check(Math.abs(hand.lp - 33) < 1e-9, `hand-built: LP should be $33.00, got ${hand.lp}`);
const handPlan = optimalReplay(capWallet, capTxns);
check(
  handPlan.hits.find((h) => h.txnId === "h2")?.cardId === "citi_custom_cash" &&
    handPlan.hits.find((h) => h.txnId === "h1")?.cardId === "citi_double_cash",
  "hand-built: the LP must put the $500 purchase on Custom Cash and the $400 on Double Cash",
);
console.log("  hand-built arithmetic: greedy $30.00, optimal $33.00, expected gap $3.00 -> " + $(hand.lp - hand.greedy));

// ---------------------------------------------------------------------------
// The same three spending years on a CAP-HEAVY wallet (a hypothetical wallet, NOT anyone's
// persona data: no persona or card data is edited anywhere). Citi Custom Cash's single
// $500/cycle pool and BofA Customized Cash's combined $2,500/quarter pool are the rules
// that make date order expensive, and neither is in a demo wallet -- which is exactly why
// the demo personas show a $0 gap. This is also the only case big enough to exercise the
// MILP/LP branch at 430-580 purchases.
// ---------------------------------------------------------------------------
const heavy: Holding[] = [
  { cardId: "citi_custom_cash" },
  { cardId: "bofa_customized_cash_rewards" },
  { cardId: "citi_double_cash" },
  { cardId: "amex_blue_cash_everyday" },
];
for (const p of PERSONAS) run(`${p.name}'s year on a cap-heavy wallet (hypothetical)`, heavy, yearOf(p));

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
