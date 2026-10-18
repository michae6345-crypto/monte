# scripts

Run any of them with `node --import ./scripts/_alias.mjs scripts/<name>.ts`. Each prints
its working.

| Script | What it checks |
|---|---|
| `test.ts` | Runs the 36 tests in `tests/` (`npm test`) |
| `jordan-check.ts` | Jordan's −$427.03 receipt and $104.14 left on the table, line by line |
| `mc.ts` | Monte Carlo odds for each demo person |
| `mc-method.ts` | Measures why each drawn year is re-simulated instead of resampling monthly rewards |
| `lp-vs-greedy.ts` | LP against greedy routing, with a worked cap trap |
| `print.ts` | Every person's receipt, per-card value and best card to add |
| `stmt-test.ts` | Statement CSV parsing on Chase- and Amex-style exports |
| `plaid-fixture-test.ts` | The Plaid mapping on hand-written fixtures; no keys needed |
