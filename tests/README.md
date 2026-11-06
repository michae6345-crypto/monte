# tests

`npm test` runs every file (`scripts/test.ts` imports them) with Node's built-in test runner.

| File | What it covers |
|---|---|
| `engine.test.ts` | Five hand-computed earn cases, caps crossed mid-purchase, shared cap pools, per-person invariants and snapshots, Jordan's −$427 receipt, determinism |
| `provenance.test.ts` | Every rule type traces to its source; each receipt reconciles to the cent; every card has a source URL and checked date |
| `interest.test.ts` | `choose()` with no balances, some, and all; interest is zero on a card paid in full; Plaid's revolving balance (paid in full is not debt) |
| `merchants.test.ts` | Store names to categories (the Plaid rules first), the type-ahead, and the card credits a store triggers |
| `apportion.test.ts` | The printed receipt's cents add up to its own total for every demo person |
| `api-best.test.ts` | `/api/best` (the extension's endpoint): domains to categories, the balance skip, perks, and a 400 for every bad input |
