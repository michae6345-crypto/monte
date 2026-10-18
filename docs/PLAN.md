# Ace · build plan: Sat ~10 pm → Sun 11:30 am

Submit by **11:30** (deadline is noon) to the ACM Drive folder. The submission needs:

- name + vertical (**Finance**)
- team names
- the public GitHub repo
- a 3-sentence description
- slides

**Feature freeze at 10:30.**

Before anything else, one of us messages an organizer on Discord: "Team 1 is switching
from Social Cause to Finance."

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui on Vercel
- **framer-motion** for the receipt, the wallet fan and the dots
- **d3-sankey** for the money river
- `javascript-lp-solver` for the optimizer
- Plaid Node SDK (sandbox)

No database: card data and Jordan's year are JSON in the repo, and the engine runs in the
browser, so the demo works offline once loaded.

## Who owns what

| | Michael · engine | Adrian · experience |
|---|---|---|
| Folders | `lib/engine/`, `lib/data/`, `app/api/`, `scripts/` | `app/(screens)/`, `components/` |
| Builds | category map, rewards calc, LP optimizer, marginal value, interest, credits detection, Plaid sandbox, Jordan's seeded year, engine tests | the six screens, animations, phone Tap view, share card, slides, backup video |

Shared, ask first: `lib/contract.ts`.

## Contract (first 30 minutes)

```ts
type Category = 'dining'|'groceries'|'gas'|'transit'|'rideshare'|'airfare'|'hotels'|'streaming'|'online_retail'|'drugstores'|'rent'|'utilities'|'everything_else'|...
type Txn = { id: string; date: string; merchant: string; amount: number; category: Category; cardUsed: string }
type Card = { id: string; name: string; annualFee: number; aprRange: [number, number]; pointValueCents: number;
  earn: { category: Category; mult: number; cap?: { amount: number; period: 'month'|'quarter'|'year'|'cycle' }; afterCap?: number }[];
  base: number; credits: { name: string; amount: number; period: string }[]; source: string[]; checked: string }
type Receipt = { rewards: number; credits: number; fees: number; interest: number; otherFees: number; net: number }
type Assignment = { txnId: string; best: string; reward: number; actualReward: number }[]
type TapPick = { card: string; reward: number; reason: string; runnerUp: { card: string; reward: number }; warnings: string[] }
```

Plus `lib/mock.ts` with hard-coded outputs, so screens build before the engine exists.

## Timeline

| When | Michael (engine) | Adrian (experience) |
|---|---|---|
| **10:00–10:30 pm** | Contract + mock. Read `data/cards.json` from the research agent. | Repo, Next.js, Tailwind, shadcn, deploy to Vercel. Card-art components. |
| **10:30 pm–12:30 am** | Seed Jordan's 12 months (script). Category map. Per-transaction reward calc + Receipt. Tests: 5 hand-computed transactions. | **Receipt** screen with the printing animation + Sankey on the mock |
| **12:30–2:00 am** | LP optimizer + greedy baseline, then Replay assignment, then marginal value | **Replay** dots + toggle, **Tap** phone view with the wallet fan |
| **2:00 am** | Checkpoint: real engine numbers render on the live URL. Sleep. | Sleep |
| **Sun 8:00–9:30** | Interest + credits + "don't use the card with a balance" rule. Plaid sandbox connect (cut if it fights). | **Keep or cancel** scales, **What if** drag-in + sliders, share card |
| **9:30–10:30** | Fill the real numbers into DEMO.md. Bug bash on prod. README. | Mobile pass, polish, slides, record the 60-second backup |
| **10:30** | **Feature freeze** | |
| **10:30–11:30** | Rehearse 3 times on prod. Upload slides + description. Submit by 11:30. | |

## Cut lines, in order

1. Plaid sandbox connect → seeded data only (say so)
2. Share card
3. What-if sliders (keep drag-in)
4. Balance-transfer option
5. LP → greedy with cap tracking (keep "beats naive" only if the LP is done)
6. Money river Sankey → stacked bar

**Never cut:** the Receipt with real numbers, Replay with "left on the table", Tap with
the balance warning, Keep or cancel, click-through to the source rule.

## Risks

- **Card terms accuracy:** every rule comes from the research agent's sourced JSON, and
  anything marked unverified gets a badge.
- **Animation time sink:** Adrian time-boxes each screen to 60–90 minutes and takes the
  simplest version first.
- **Optimizer bugs:** test on 5 hand-checked transactions plus one cap case before any UI
  depends on it.
