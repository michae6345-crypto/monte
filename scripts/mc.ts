// Monte Carlo headline numbers per persona, with sanity checks.
// Run: JITI_ALIAS='{"@":"<repo root>"}' npx jiti scripts/mc.ts   (same as scripts/print.ts)
import { simulate, creditsUsed, interestFor } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { monteCarlo, monteCarloSamples, paidOffWallet, resampledYears } from "@/lib/engine/montecarlo";
import { PERSONAS, yearOf } from "@/lib/data/personas";
import type { Holding } from "@/lib/engine";

const $ = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.log("  CHECK FAILED:", msg);
  }
};

function run(name: string, wallet: Holding[], tx: ReturnType<typeof yearOf>, paidOff = false) {
  const o = paidOff ? { assumePaidOff: true } : {};
  // warm-up so the timing reflects a reload, not the first JIT pass
  monteCarlo(wallet, tx, { ...o, years: 50 });
  const t0 = performance.now();
  const r = monteCarlo(wallet, tx, o);
  const ms = performance.now() - t0;
  const t1 = performance.now();
  const r2 = monteCarlo(wallet, tx, o);
  const ms2 = performance.now() - t1;
  if (paidOff) wallet = paidOffWallet(wallet);

  console.log(`\n== ${name}: ${tx.length} txns, ${r.years} years, seed ${r.seed}, ${ms.toFixed(0)} ms (rerun ${ms2.toFixed(0)} ms)`);
  if (r.hypothetical) console.log(`  HYPOTHETICAL: ${$(r.hypothetical.clearedBalance)} of balance treated as cleared on ${r.hypothetical.cards.join(", ")}`);
  check(paidOff === (r.hypothetical !== null), "hypothetical marks the paid-off view and nothing else");
  const c = r.current;
  console.log(`  current net: p5 ${$(c.p5)}  p50 ${$(c.p50)}  p95 ${$(c.p95)}  mean ${$(c.mean)}`);
  if (r.options.length === 0) console.log("  (no options: no fee cards to drop, and no new card while a balance is carried)");
  for (const o of r.options) {
    const verb = o.id.startsWith("add:") ? `${o.label.replace(/^Add /, "")} wins` : `${o.label} wins`;
    console.log(
      `  ${verb} in ${pct(o.winShare)} of years  | net p5 ${$(o.p5)} p50 ${$(o.p50)} p95 ${$(o.p95)} mean ${$(o.mean)} (${o.mean - c.mean >= 0 ? "+" : ""}${(o.mean - c.mean).toFixed(2)} vs current)`,
    );
  }

  // checks
  check(JSON.stringify(r) === JSON.stringify(r2), "same seed gives identical output");
  check(JSON.stringify(r) !== JSON.stringify(monteCarlo(wallet, tx, { ...o, seed: 7 })) || tx.length === 0, "different seed changes output");
  for (const o of [c, ...r.options]) {
    check(o.winShare >= 0 && o.winShare <= 1, `${o.id} winShare in [0,1]`);
    check(o.p5 <= o.p50 && o.p50 <= o.p95, `${o.id} p5 <= p50 <= p95`);
    check(o.bands.length === 12 && o.bands.every((b, i) => b.month === i + 1), `${o.id} 12 bands`);
    for (const b of o.bands) check(b.p5 <= b.p25 && b.p25 <= b.p50 && b.p50 <= b.p75 && b.p75 <= b.p95, `${o.id} band ${b.month} monotone`);
    check(Math.abs(o.bands[11].p50 - o.p50) < 0.02, `${o.id} month-12 band equals year net`);
  }
  check(r.options.every((o, i) => i === 0 || r.options[i - 1].winShare >= o.winShare), "options sorted by winShare");
  if (wallet.some((h) => (h.balance ?? 0) > 0)) check(r.options.every((o) => !o.id.startsWith("add:")), "no add: while carrying a balance");

  // the fast greedy must match engine simulate(..., "best") on the same resampled years
  const s = monteCarloSamples(wallet, tx, { ...o, years: 30 });
  const yrs = resampledYears(tx, 30, 42);
  let worst = 0;
  for (let y = 0; y < 30; y++) {
    for (const o of s.options) {
      let w: Holding[] = wallet;
      let extraInterest = 0;
      if (o.id.startsWith("add:")) w = [...wallet, { cardId: o.id.slice(4) }];
      else if (o.id.startsWith("drop:")) {
        const d = wallet.find((h) => h.cardId === o.id.slice(5))!;
        w = wallet.filter((h) => h !== d);
        extraInterest = interestFor(d);
      }
      const rewards = w.length ? simulate(w, yrs[y], "best").total : 0;
      const net = rewards + w.reduce((a, h) => a + creditsUsed(h) - card(h.cardId).annual_fee - interestFor(h), 0) - extraInterest;
      worst = Math.max(worst, Math.abs(net - o.net[y]));
    }
  }
  check(worst < 1e-6, `fast greedy matches simulate() (max diff ${worst})`);
  console.log(`  checks: fast greedy vs simulate() max diff $${worst.toExponential(1)} over 30 years x ${s.options.length} options`);
  return ms;
}

const times: number[] = [];
for (const p of PERSONAS) times.push(run(p.name, p.wallet, yearOf(p)));

// The "once you've paid this off" screen: SPEC #14 blocks a new card while a balance is
// carried, so this is the honest way to show what opens up after it is cleared.
for (const p of PERSONAS)
  if (p.wallet.some((h) => (h.balance ?? 0) > 0)) run(`${p.name}, balance paid off`, p.wallet, yearOf(p), true);

console.log(`\nslowest default run: ${Math.max(...times).toFixed(0)} ms`);
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
