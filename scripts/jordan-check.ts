// Jordan's headline numbers, exact, with the arithmetic behind them.
// Run: JITI_ALIAS='{"@":"<this worktree>"}' npx jiti scripts/jordan-check.ts
import { receipt, interestFor, creditsUsed } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { JORDAN, yearOf } from "@/lib/data/personas";

const tx = yearOf(JORDAN);
const r = receipt(JORDAN.wallet, tx);
const f = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
console.log(`Jordan: ${tx.length} purchases, ${f(r.spend)} spend, ${tx[0].date} to ${tx[tx.length - 1].date}`);
console.log(`rewards(actual cards) ${f(r.rewards)} + credits ${f(r.credits)} - fees ${f(r.fees)} - interest ${f(r.interest)} = RECEIPT NET ${f(r.net)}`);
console.log(`replay(best card in the same wallet) ${f(r.best.total)} - actual ${f(r.actual.total)} = LEFT ON THE TABLE ${f(r.leftOnTable)}`);
for (const h of JORDAN.wallet) {
  const c = card(h.cardId);
  console.log(
    `  ${c.name}: rewards ${f(r.actual.byCard[h.cardId] ?? 0)}  credits ${f(creditsUsed(h))}  fee ${f(c.annual_fee)}` +
      `  interest ${f(interestFor(h))}${h.balance ? ` (= ${f(h.balance)} balance x ${h.apr ?? c.purchase_apr_range[1]}% APR)` : ""}`,
  );
}
console.log(`SPEC.md claims Receipt -$427 and Replay $104 -> rounded actual: ${f(Math.round(r.net))} and ${f(Math.round(r.leftOnTable))}`);
