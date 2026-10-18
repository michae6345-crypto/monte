# Monte: every card played right, and what your cards really cost

TrojanHacks 2026 · **Finance** vertical · Team 1 · Adrian Erlikhman (UI, branding) and
Michael Tarekegn (production, backend). Submission due **Sun 18 Oct, 12:00**; we submit
at 11:30. Rules and rubric: `docs/HACKATHON.md`.

## The pitch

People pick credit cards for the signup bonus, then lose money three ways:

- the wrong card at the register
- annual fees for perks they never use
- interest that outweighs every reward

Rewards apps show points. **Monte shows the net**: rewards plus perks used, minus fees,
minus interest. It reads a year of your purchases, tells you which card to use for each
one, which card to keep, and which to apply for next. And it runs Monte Carlo
simulations of next year, so every recommendation comes with odds, not a guess.

**Name:** Monte Carlo simulation (finance and poker solvers), with a casino wink.

**Category:** tap-time card pickers choose the best card at the register. Monte adds the
cost side. Others in the space are Pointwise (YC W23), CardStack, Wallaby and Kudos:
they compete on rewards, we compete on net cost.

**Track fit:** "make financial products, fees, and tradeoffs easier to understand and
compare" for a clearly defined user (Jordan, 24, first job in LA, three cards, one with
a balance).

**Rule of the engine:** deterministic. The AI never does the math. Every dollar on
screen traces to a card rule in `data/cards.json` (issuer source plus checked date)
and to the purchases behind it.

## Features

Status: ✅ built and live · 🟡 partly built · ⬜ to build.
Owner: **A** = Adrian (UI, branding) · **M** = Michael (production, backend).

### Your money
| # | Feature | Status | Owner |
|---|---|---|---|
| 1 | Spending treemap by category, month-by-month bars, top merchants | ✅ | A |
| 2 | Recurring charges ("keeps charging you") with the best card for each, price-rise flag | ✅ | A |
| 3 | Statement CSV upload (Chase, Amex, Capital One formats), parsed in the browser | ✅ | A/M |
| 4 | **Plaid sandbox Link**: connect an account, pull transactions + liabilities (APR, balance), map Plaid categories with `data/category_map.json` | ✅ | **M** |
| 5 | Merchant correction: re-categorise a merchant once, applied everywhere (saved) | ⬜ | M (store) + A (UI) |

### Your cards
| # | Feature | Status | Owner |
|---|---|---|---|
| 6 | Wallet builder: 29 real cards, balance per card, cash vs travel point value | ✅ | A |
| 7 | **The Receipt**: rewards + perks used − fees − interest = net, per card | ✅ | A |
| 8 | **Purchase history with a verdict**: card used, card Monte would pick, the difference; search, merchant drill-down, misses only | ✅ | A |
| 9 | **Replay**: the year re-routed to the best card in the same wallet ("$104 left on the table") | ✅ | A |
| 10 | **Tap**: best card at a merchant now; caps used this quarter, perk-first ("use your Uber Cash"), rotating-category activation, and never a card with a balance | ✅ | A |
| 11 | **Keep or cancel**: each card's fee against the value it adds over your next-best card | ✅ | A |

### What to apply for
| # | Feature | Status | Owner |
|---|---|---|---|
| 12 | Best next card from your own spending; filters: no annual fee, perks you'd use, cash/travel | ✅ | A |
| 13 | Signup-bonus planner: can your normal spending hit the minimum in time; rank by every year or first year with bonus | ✅ | A |
| 14 | "No new card yet" when you carry a balance; payoff plan instead | ✅ | A |
| 15 | **Monte Carlo**: resample your months into 1,000 simulated next years; show the odds a card or wallet beats yours ("Blue Cash Preferred wins in 84% of years"), as a fan chart | ✅ | **M** (engine) + **A** (chart) |

### Engine and data
| # | Feature | Status | Owner |
|---|---|---|---|
| 16 | Rules engine: earn rates, caps, shared cap pools, pick-one categories, Q4 2026 rotations, credits | ✅ | done |
| 17 | **LP optimizer** for the replay (caps make greedy sub-optimal) + the number "LP beats greedy by $X on Jordan's year" | ✅ | **M** |
| 18 | Engine tests: 5 hand-computed purchases + one cap case + the 3 personas | ✅ | **M** |
| 19 | Provenance: every dollar clicks through to its rule, source URL and checked date; UNVERIFIED badge where the catalog marks one | ✅ | M (data) + A (UI) |
| 20 | Production: Vercel env vars for Plaid, error and empty states, no keys in the public repo | 🟡 | **M** |

### Brand and story
| # | Feature | Status | Owner |
|---|---|---|---|
| 21 | Logo, theme and fonts for Monte (replace the brand kit) | ⬜ | **A** |
| 22 | **Monte Wrapped**: shareable year in review ("61 Sweetgreen bowls, $231 left on the table") | ⬜ | **A** |
| 23 | Nudges this week: activate categories, perks expiring, renewals worth negative, pay this first | ✅ | A |
| 24 | Slides (7), 60-second backup video, submission text | ⬜ | **A** (deck) + **M** (Q&A sheet) |

## Status note (01:35 Sun, Michael)

Backend/engine is COMPLETE and merged: Monte Carlo, LP, provenance, 36 passing tests,
Plaid routes, `/api/health`, `render.yaml`, `docs/deploy.md`, `docs/JUDGE-QA.md`, README.
Verify with `npm run check` and `npm test`.

Two honest corrections to this spec:
- **#17**: there is no "LP beats greedy by $X on Jordan's year". The gap is **$0.00** on all
  three wallets — greedy is already optimal and the LP proves it by returning a matching
  upper bound. The real case is a hand-built cap trap: greedy $30.00 vs optimal $33.00.
- **#4**: Plaid code is done, but no deployment has keys, so those routes return
  `503 plaid_not_configured` by design and the app stays on personas.

## Cut order if we're behind
Merchant correction → Monte Wrapped → Plaid (keep CSV upload + personas, say so) → LP
(keep greedy with caps) → fan chart (keep the one odds number).

**Never cut:** Receipt, purchase history, Replay, Tap with the balance rule, Keep or
cancel, apply planner, click-to-source.

## Timeline (Sunday)
| When | Adrian (UI, brand) | Michael (prod, backend) |
|---|---|---|
| now–2:00 | Logo + theme + fonts; apply to the site | Plaid sandbox Link + `/api/plaid/*`; LP optimizer |
| 2:00 | Checkpoint: Plaid sandbox data renders in every section on the live URL | |
| 8:00–9:30 | Monte Carlo chart, Wrapped, mobile pass | Monte Carlo engine, tests, provenance, prod env |
| 9:30–10:30 | Slides, backup video | Q&A sheet, README, bug bash on prod |
| 10:30 | **Feature freeze** | |
| 10:30–11:30 | Rehearse 3× on prod; upload slides + description to the Team 1 Drive folder; submit by 11:30 | |

## Demo path (4 min + 1)
Hook → Jordan → **Money** (where it goes) → **Receipt** (−$427) → **Purchases**
(the misses) → **Replay** ($104) → **Tap** on a phone (Mobil: "not this one, it has a
balance") → **Keep or cancel** (Amex Gold: downgrade) → **Apply** with Monte Carlo odds
→ how it works (the AI never does the math) → real vs simulated. Bonus: run Tap on a
judge's own wallet.

## Stack and repo
Next.js 16 (App Router) + TypeScript, Tailwind v4 + shadcn/ui, framer-motion,
d3-hierarchy, javascript-lp-solver, Plaid (sandbox), Vercel. The engine lives in
`lib/engine/`, data in `data/`, demo people in `lib/data/personas.ts`, screens in
`components/ace/`. `npm run check` before every push to main.
