import { simulate, tap } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { PERSONAS, yearOf } from "@/lib/data/personas";
import { createHash } from "node:crypto";
const h = createHash("sha256");
for (const p of PERSONAS) {
  const tx = yearOf(p);
  h.update(JSON.stringify(simulate(p.wallet, tx, "best")));
  h.update(JSON.stringify(simulate(p.wallet, tx, "actual")));
  for (const c of CARDS) h.update(JSON.stringify(simulate([...p.wallet.filter(w=>w.cardId!==c.id), { cardId: c.id }], tx, "best")));
  h.update(JSON.stringify(tap(p.wallet, { date: "2026-10-18", merchant: "Mobil", category: "gas", amount: 52 }, tx)));
}
console.log(h.digest("hex"));
