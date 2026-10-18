import { parseStatement } from "@/lib/engine/statement";
const chase = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
10/14/2026,10/15/2026,TST* GUISADOS,Food & Drink,Sale,-18.42,
10/12/2026,10/13/2026,TRADER JOE S #123,Groceries,Sale,-64.10,
10/11/2026,10/12/2026,MOBIL 0042,Gas,Sale,-52.00,
10/10/2026,10/10/2026,Payment Thank You-Mobile,,Payment,500.00,
10/09/2026,10/10/2026,UBER *TRIP,Travel,Sale,-22.40,
10/08/2026,10/09/2026,NETFLIX.COM,Bills & Utilities,Sale,-15.49,
10/05/2026,10/06/2026,AMAZON MKTPL*AB12,Shopping,Sale,-45.99,
10/03/2026,10/04/2026,"SQ *BLUE BOTTLE, LA",Food & Drink,Sale,-6.75,`;
const amex = `Date,Description,Amount
10/14/2026,WHOLEFDS LA 10234,82.31
10/13/2026,DELTA AIR LINES,318.00
10/12/2026,AUTOPAY PAYMENT - THANK YOU,-400.00`;
for (const [n, t] of [["chase", chase], ["amex", amex]] as const) {
  const r = parseStatement(t, "chase_freedom_unlimited");
  console.log(n, "skipped", r.skipped); for (const x of r.txns) console.log("  ", x.date, x.merchant.padEnd(22), x.amount, x.category);
}
