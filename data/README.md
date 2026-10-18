# data

The facts the engine runs on. Each rule carries the issuer's source URL and the date we
checked it (2026-10-17).

| File | What's in it |
|---|---|
| `cards.json` | 29 US credit cards: earn rules, caps, rotations, fees, credits, point values |
| `category_map.json` | Plaid categories and merchant rules mapped to Monte's 20 spending categories |

A card the catalog could not fully source is flagged `UNVERIFIED`, and the UI badges it.
