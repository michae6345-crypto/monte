// Why lib/engine/montecarlo.ts re-simulates every drawn year instead of resampling
// precomputed monthly rewards (the method in components/ace/mc.ts). Measures the bias
// instead of asserting it, so the Q&A answer has a number in it.
//
// Run: JITI_ALIAS='{"@":"<worktree abs path>"}' npx jiti scripts/mc-method.ts
import { simulate, creditsUsed, interestFor, type Holding, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { monteCarlo, resampledYears, monthBlocks } from "@/lib/engine/montecarlo";
import { monteCarlo as uiMonteCarlo } from "@/components/ace/mc";
import { PERSONAS, yearOf } from "@/lib/data/personas";

const $ = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
const YEARS = 200; // enough for a stable bias estimate; the engine default is 1000

/** The approximation under test, with drift switched off: play the REAL year once, total
 *  the best-play reward of each calendar month, then a simulated year is just the sum of
 *  the 12 drawn months' totals. Caps are whatever the real year used; drawing the same
 *  month twice cannot saturate a cap twice. */
function bucketMethod(wallet: Holding[], txns: Txn[], years: Txn[][]): number[] {
  const sim = simulate(wallet, txns, "best");
  const byId = new Map(txns.map((t) => [t.id, t]));
  const perMonth = new Map<string, number>();
  for (const h of sim.hits) {
    const t = byId.get(h.txnId)!;
    const k = t.date.slice(0, 7);
    perMonth.set(k, (perMonth.get(k) ?? 0) + h.reward);
  }
  // each resampled txn id is "<origId>@<year>.<slot>": recover which real month it came from
  return years.map((yr) => {
    const seen = new Set<string>();
    let total = 0;
    for (const t of yr) {
      const slot = t.id.slice(t.id.lastIndexOf(".") + 1);
      const orig = byId.get(t.id.slice(0, t.id.indexOf("@")))!;
      const key = `${slot}|${orig.date.slice(0, 7)}`;
      if (seen.has(key)) continue; // one month block per slot
      seen.add(key);
      total += perMonth.get(orig.date.slice(0, 7)) ?? 0;
    }
    return total;
  });
}

for (const p of PERSONAS) {
  const tx = yearOf(p);
  console.log(`\n==== ${p.name} (${tx.length} purchases, ${monthBlocks(tx).length} full months in the bootstrap pool)`);

  // 1. what each implementation reports today
  const t0 = performance.now();
  const mine = monteCarlo(p.wallet, tx);
  const mineMs = performance.now() - t0;
  const t1 = performance.now();
  const theirs = uiMonteCarlo(p.wallet, tx);
  const theirsMs = performance.now() - t1;
  // structural: the engine's result has one extra field (hypothetical) the stand-in lacks
  const head = (n: string, r: { current: { p5: number; p50: number; p95: number }; options: { label: string; winShare: number }[] }, ms: number) =>
    console.log(
      `  ${n.padEnd(22)} p5 ${$(r.current.p5)}  p50 ${$(r.current.p50)}  p95 ${$(r.current.p95)}` +
        `  spread p95-p5 ${$(r.current.p95 - r.current.p5)}  ${r.options.length} options  ${ms.toFixed(0)} ms`,
    );
  head("engine (bootstrap)", mine, mineMs);
  head("UI stand-in (+drift)", theirs, theirsMs);
  console.log(`    engine options: ${mine.options.map((o) => `${o.label} ${(o.winShare * 100).toFixed(0)}%`).join(" | ") || "(none)"}`);
  console.log(`    UI options:     ${theirs.options.map((o) => `${o.label} ${(o.winShare * 100).toFixed(0)}%`).join(" | ") || "(none)"}`);

  // 2. the cap bias, isolated: same drawn years, drift off, approximation vs re-simulation
  const years = resampledYears(tx, YEARS, 42);
  const fixed = p.wallet.reduce((a, h) => a + creditsUsed(h) - card(h.cardId).annual_fee - interestFor(h), 0);
  const truth = years.map((yr) => simulate(p.wallet, yr, "best").total);
  const approx = bucketMethod(p.wallet, tx, years);
  const err = truth.map((v, i) => approx[i] - v);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const srt = [...err].sort((a, b) => a - b);
  console.log(
    `  cap bias over ${YEARS} identical drawn years (rewards only, drift off): mean ${$(mean(err))}` +
      `  p5 ${$(srt[Math.floor(0.05 * YEARS)])}  p95 ${$(srt[Math.floor(0.95 * YEARS)])}  max |err| ${$(Math.max(...err.map(Math.abs)))}`,
  );
  console.log(
    `  mean net: re-simulated ${$(mean(truth) + fixed)}  vs bucket approximation ${$(mean(approx) + fixed)}` +
      `  (${((mean(err) / Math.max(1, mean(truth))) * 100).toFixed(2)}% of rewards)`,
  );
}
