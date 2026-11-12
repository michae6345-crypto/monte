# tests

`npm test` runs every file below with Node's built-in test runner.

| File | What it covers |
|---|---|
| `engine.test.ts` | Five hand-computed earn cases, caps crossed mid-purchase, shared cap pools, per-person invariants and snapshots, Jordan's −$427 receipt, determinism |
| `provenance.test.ts` | Every rule type traces to its source; each receipt reconciles to the cent; every card has a source URL and checked date |
| `paypal.test.ts` | With PayPal and Claude mocked: purchase to ranked card to order amount to capture to cap counter; the balance rule; 503s without keys; the agent's guards |
| `paypal-transactions.test.ts` | PayPal purchase import: Transaction Search fixture to Monte transactions; refunds, fees, transfers, incoming, pending and non-USD rows skipped; 12 months split into ≤31-day windows; pagination; 503 without sandbox keys |
