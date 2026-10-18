# lib/data

Where purchases come from: the demo people, or Plaid.

| File | What it does |
|---|---|
| `personas.ts` | Five synthetic spending years (Jordan, Maya, the Parks, Sam, Rosa) on real LA merchants; seeded |
| `plaid.ts` | Maps Plaid transactions and accounts to Monte's types. Pure: no network, no SDK |
| `plaid-sync.ts` | Server-side reads: `/transactions/sync` to the end, plus credit liabilities |
| `plaid-server.ts` | Plaid client, access-token cookie, and the error shapes every route returns |
| `plaid-feed.ts` | `loadPlaidSandbox()`: the one call the UI makes to swap a persona for Plaid data |
