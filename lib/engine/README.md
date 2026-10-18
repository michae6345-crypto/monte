# lib/engine

The math. Pure, deterministic TypeScript: no network, no model, no `Math.random`. Every
number comes from a rule in `data/cards.json` and the purchases it applied to.

| File | What it does |
|---|---|
| `index.ts` | `simulate`, `receipt`, `tap`, `marginalValue`, `whatIf`: earn rules, caps, shared pools, rotations, credits, interest |
| `catalog.ts` | Types for `data/cards.json` and `card(id)` lookup |
| `insights.ts` | Spending by category and merchant, recurring charges |
| `montecarlo.ts` | Resamples your months into 1,000 years and reruns the engine on each; seeded |
| `lp.ts` | Solves the year as one LP to check greedy routing against an upper bound |
