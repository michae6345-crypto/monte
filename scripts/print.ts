import { receipt, marginalValue, whatIf, tap } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { PERSONAS, yearOf, JORDAN } from "@/lib/data/personas";
const $ = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(0);
for (const p of PERSONAS) {
  const tx = yearOf(p);
  const r = receipt(p.wallet, tx);
  console.log(`\n== ${p.name}: ${tx.length} txns, spend ${$(r.spend)}`);
  console.log(`rewards ${$(r.rewards)} credits ${$(r.credits)} fees ${$(r.fees)} interest ${$(r.interest)} NET ${$(r.net)} | best-play rewards ${$(r.best.total)} left ${$(r.leftOnTable)}`);
  for (const c of r.perCard) console.log("  ", c.cardId.padEnd(28), "rew", $(c.rewards), "net", $(c.net), "| keep:", JSON.stringify(Object.fromEntries(Object.entries(marginalValue(p.wallet, tx, c.cardId)).map(([k,v])=>[k,Math.round(v)]))));
  const wi = CARDS.map(c => ({ id: c.id, w: whatIf(p.wallet, tx, c.id) })).filter(x => x.w).sort((a, b) => b.w!.net - a.w!.net).slice(0, 5);
  console.log("  best adds:", wi.map(x => `${x.id} ${$(x.w!.net)}`).join(" | "));
}
const tx = yearOf(JORDAN);
for (const [m, c, a] of [["Sweetgreen","dining",16],["Trader Joe's","groceries",64],["Mobil","gas",52],["Uber","rideshare",22],["Amazon","online_retail",45]] as const) {
  const t = tap(JORDAN.wallet, { date: "2026-10-18", merchant: m, category: c, amount: a }, tx.filter(x=>x.date>="2026-10-01"));
  console.log(m, "->", t.pick.cardId, t.pick.rule, $(t.pick.reward*100)+"c", "|", t.ranked.map(r=>`${r.cardId}:${(r.reward).toFixed(2)}${r.blocked?"(blocked)":""}`).join(" "), t.capNotes);
}
