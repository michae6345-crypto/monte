// Proves the cap_state cache gives the same answer as replaying history.
//
//   node --import ./scripts/_alias.mjs scripts/cap-cache-check.ts
//
// For Jordan: build cap rows once with capStateFrom (what sync writes to public.cap_state),
// rebuild the map with capMapFrom (what /api/tap reads), rank the wallet with evaluate(),
// and compare against the engine's tap(), which replays the whole year every call.

import { card } from "@/lib/engine/catalog";
import { evaluate, simulate, tap, type Holding, type Txn } from "@/lib/engine";
import { capMapFrom, capStateFrom } from "@/lib/db/cap-state";
import { JORDAN, yearOf } from "@/lib/data/personas";

const wallet: Holding[] = JORDAN.wallet;
const history: Txn[] = yearOf(JORDAN);
const DATE = "2026-10-18";

const purchases: Omit<Txn, "id" | "cardUsed">[] = [
  { date: DATE, merchant: "Mobil", amount: 48.2, category: "gas" },
  { date: DATE, merchant: "Trader Joe's", amount: 76.45, category: "groceries" },
  { date: DATE, merchant: "Whole Foods Market", amount: 132.1, category: "groceries" },
  { date: DATE, merchant: "Sugarfish", amount: 64.0, category: "dining" },
  { date: DATE, merchant: "Blue Bottle Coffee", amount: 6.75, category: "dining" },
  { date: DATE, merchant: "Amazon", amount: 39.99, category: "online_retail" },
  { date: DATE, merchant: "Uber", amount: 22.4, category: "rideshare" },
  { date: DATE, merchant: "CVS Pharmacy", amount: 18.3, category: "drugstores" },
  { date: DATE, merchant: "AMC Theatres", amount: 31.0, category: "entertainment" },
  { date: DATE, merchant: "Delta", amount: 289.0, category: "airfare" },
  { date: DATE, merchant: "Home Depot", amount: 54.6, category: "everything_else" },
];

const blocked = (h: Holding) => !!(h.balance && h.balance > 0);

// What sync does once.
const rows = capStateFrom(wallet, history);

function cachedPick(p: Omit<Txn, "id" | "cardUsed">) {
  const used = capMapFrom(rows); // what /api/tap reads: one indexed select
  const txn: Txn = { ...p, id: "tap", cardUsed: "" };
  const ranked = wallet
    .map((h) => ({ cardId: h.cardId, reward: evaluate(card(h.cardId), txn, used, null).reward, blocked: blocked(h) }))
    .sort((a, b) => b.reward - a.reward);
  return ranked.find((r) => !r.blocked) ?? ranked[0];
}

const cents = (x: number) => Math.round(x * 100);
let failures = 0;
console.log(`Jordan: ${history.length} txns, ${rows.length} cap_state rows\n`);
for (const p of purchases) {
  const a = cachedPick(p);
  const b = tap(wallet, p, history).pick;
  const ok = a.cardId === b.cardId && cents(a.reward) === cents(b.reward);
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${p.merchant.padEnd(20)} $${p.amount.toFixed(2).padStart(7)}  cache ${a.cardId} $${a.reward.toFixed(2)}  |  tap ${b.cardId} $${b.reward.toFixed(2)}`,
  );
}

// Timing: cached ranking (map rebuild + evaluate) vs tap() replaying the year.
function time(fn: () => void, n: number) {
  for (let i = 0; i < 5; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
}
const N = 200;
const tCache = time(() => purchases.forEach(cachedPick), N) / purchases.length;
const tTap = time(() => purchases.forEach((p) => tap(wallet, p, history)), 20) / purchases.length;
console.log(`\ncached: ${(tCache * 1000).toFixed(1)}us/tap   tap() replay: ${(tTap * 1000).toFixed(1)}us/tap   speedup ${(tTap / tCache).toFixed(0)}x`);

// Semantic check: the counters themselves. cap_state counts spend on the card ACTUALLY
// used (real spend against each issuer's cap). tap() replays history on the BEST policy
// and evaluates each hit against an empty map, so its counters describe a hypothetical
// year and are not clamped at the cap. Show where they differ.
const replay = new Map<string, number>();
for (const h of simulate(wallet, history, "best").hits) {
  const tx = history.find((x) => x.id === h.txnId)!;
  for (const c of evaluate(card(h.cardId), tx, new Map(), null).consume) replay.set(c.pool, (replay.get(c.pool) ?? 0) + c.amount);
}
const cached = capMapFrom(rows);
const keys = [...new Set([...cached.keys(), ...replay.keys()])].sort();
let diffs = 0;
console.log("\ncap counters (pool | actual-card cache | tap best-policy replay):");
for (const k of keys) {
  const x = cached.get(k) ?? 0;
  const y = replay.get(k) ?? 0;
  if (cents(x) !== cents(y)) diffs++;
  console.log(`  ${cents(x) === cents(y) ? " " : "*"} ${k.padEnd(48)} ${x.toFixed(2).padStart(10)} ${y.toFixed(2).padStart(10)}`);
}
console.log(
  diffs
    ? `\n${diffs} pool(s) differ. The cache is the correct one: caps are consumed by real spend on the real card. ` +
        "tap() counts a hypothetical best-play year; it only agrees on the pick while no cap is near exhaustion."
    : "\nCounters identical.",
);

if (failures) {
  console.error(`\n${failures} purchase(s) disagree`);
  process.exit(1);
}
console.log(`\nAll ${purchases.length} purchases: same card, same reward to the cent.`);
