# Monte: architecture

Three levels: one paragraph, then the parts and how data moves, then the algorithms.

## 1. In one paragraph

Monte is a deterministic rules engine for credit cards. A catalog of 29 cards
(`data/cards.json`) holds every published earn rule, cap, rotating category, credit, fee
and point value, each with the issuer's source URL and the date we checked it. The engine
plays a year of real purchases through a wallet and produces a receipt: rewards plus perks
used, minus annual fees, minus interest. The same engine is reused by everything else: a
replay that routes each purchase to the best card you already hold, a Monte Carlo that
re-runs the engine over 1,000 resampled years to compare wallets, and an LP that checks
whether the greedy routing was optimal. For speed at the register, a one-time sync stores
how much of each cap is already spent, so a tap reads a few counters instead of replaying
your history. No AI model is in the pricing path.

## 2. Components and data flow

```
                 data/cards.json  (29 cards: rules, caps, credits, fees, sources, checked dates)
                        |
                        v
   purchases --->  lib/engine/index.ts   evaluate()  -> one purchase on one card, given caps used
   (Plaid or            |                simulate()  -> a year, "actual" or "best" policy
    CSV upload)         |                receipt()   -> rewards + perks - fees - interest
                        |
          +-------------+--------------+-----------------------+
          v                            v                       v
   montecarlo.ts                    lp.ts                provenance.ts
   1,000 resampled years,           MILP over the whole  every dollar -> rule,
   engine replayed per year         year; proves or      source URL, checked date,
   -> odds per wallet option        improves greedy      UNVERIFIED badge

   Production path for the register moment:

   POST /api/sync  (once, slow is fine)          POST /api/tap  (every purchase, fast)
     write holdings + transactions                 read holdings + cap_state (indexed)
     capStateFrom(): walk history once  ---->      capMapFrom(): rebuild cap usage map
     upsert cap_state(card, pool, period, used)    evaluate() each eligible card, rank
                                                   return pick, ranked list, cap notes, ms
```

| Piece | File | Role |
|---|---|---|
| Catalog | `data/cards.json`, `lib/engine/catalog.ts` | Published rules per card, with sources and dates |
| Engine | `lib/engine/index.ts` | `evaluate`, `simulate`, `receipt`, `tap`, `whatIf`, `marginalValue` |
| Monte Carlo | `lib/engine/montecarlo.ts` | Seeded block bootstrap; compares wallet options year by year |
| LP | `lib/engine/lp.ts` | Whole-year assignment with `javascript-lp-solver`; upper bound plus replayed plan |
| Provenance | `lib/engine/provenance.ts` | Traces every line to a rule, URL, date and the purchases behind it |
| Cap cache | `lib/db/cap-state.ts` | `capStateFrom` (sync) and `capMapFrom` (tap) |
| API | `app/api/sync`, `app/api/tap`, `app/api/plaid/*` | Sync once, tap fast, Plaid link |
| Database | Supabase Postgres | `profiles`, `bank_items`, `holdings`, `transactions`, `cap_state`, `merchant_overrides`, `card_terms` |

Measured on a laptop: routing a whole year takes about 1 ms; a tap that replays history
takes about 2.9 ms and grows with history; 1,000 Monte Carlo years take about 58 ms
(19 to 313 ms across our test people). The cap cache makes tap cost independent of how
long you have been a customer.

## 3. The algorithms, in plain words

### Cap-aware greedy with blended rates

For each purchase, in date order, `evaluate()` looks at every rule on a card that applies
(merchant lists, "everything else", pick-one categories, rotating windows). If the rule
has a cap, it checks how much of that cap pool is left this period. A purchase that
straddles the cap boundary gets a blended rate: the part inside the cap earns the bonus,
the rest earns the after-cap rate. Example: $40 left on a 5% cap and a $100 purchase earns
5% on $40 and 1% on $60, a blended 2.6%. Cap pools are keyed the way the issuer's terms
work (Citi Custom Cash shares one $500 per billing cycle, BofA Customized Cash shares one
$2,500 per quarter, Blue Cash Everyday has a separate $6,000 per category per year).
`simulate(..., "best")` picks the highest-earning card for each purchase and charges its
cap usage.

### Never route to a revolving card

`eligibleCards()` removes any card carrying a balance from best-play routing (unless every
card has one). New purchases on a revolving card accrue interest from day one, so 2% back
is a loss at 26.24% APR (Jordan: $734.72 of interest against $552.69 of rewards). The same rule blocks "apply for a new card" suggestions while you
carry a balance.

### Monte Carlo: block bootstrap that replays the engine

Purchases are grouped by calendar month. A simulated year draws 12 of your own months with
replacement and places them in slots January to December, keeping each purchase's day of
month, so monthly, billing-cycle, quarterly and annual caps reset where they would in a
real year. Partial edge months are dropped from the pool. The full engine then runs on
each simulated year for every wallet option, all on the same resampled year (common random
numbers), and we report the mean, p5/p50/p95 and the share of years each option comes
out ahead. The PRNG is seeded, so the same inputs give the same odds.

Why not resample monthly reward totals instead? Because caps bind across months. A month
that earned $25 on a capped card in the real year may earn much less in a simulated year
where earlier months already used the cap. Adding up precomputed totals ignores that and
overstates capped cards. `scripts/mc-method.ts` measures that bias instead of just
asserting it.

### LP: is greedy actually optimal?

Greedy in date order can waste a cap on a small early purchase that a bigger later one
needed. `lp.ts` solves the whole year at once:

```
Variables  y[t,c,o] in {0,1}: purchase t on card c under rule o;  a[t,c,o] >= 0: dollars inside o's cap
Objective  max sum pointValue(c)/100 * ( amount(t)*after(o)*y + (mult(o) - after(o)) * a )
Assign     for every t: sum over c,o of y[t,c,o] = 1
Link       a[t,c,o] <= amount(t) * y[t,c,o]
Caps       for every cap pool and period: sum of a drawing on it <= cap amount
```

Rule options come from the same `earnOptions()` the greedy uses, so the two cannot
disagree about rules. The objective is reported as an upper bound, and the chosen plan is
replayed through `evaluate()` in date order. When the two match, the plan is proven
optimal. Result: the LP-vs-greedy gap is $0.00 on all three test wallets, so greedy is
proven optimal there. On a constructed cap-trap case greedy gets $30.00 and the optimum is
$33.00, which shows the LP catches the cases where greedy falls short.

### Provenance

Every receipt line carries the rule label, the issuer source URL(s), the date we checked
it, and the transactions, balance or credit it came from. All 29 cards had their sources
checked on 2026-10-17; 11 are marked UNVERIFIED, and every line from those cards shows the
badge.

## Privacy

- Row-level security is on for every table. A user's session cannot read another user's
  rows.
- No card numbers are stored anywhere. A holding is a catalog card id, balance, APR and
  credits used.
- The Plaid access token lives in an httpOnly cookie, so page scripts cannot read it.
- CSV statements are parsed in the browser.
- The only model call is merchant-name cleanup (in progress on another branch). It never
  sees rules or computes money.

## What's real vs simulated

| Real | Simulated or assumed |
|---|---|
| Card rules, caps, fees, credits from issuer pages, checked 2026-10-17 | 11 of 29 cards marked UNVERIFIED |
| The engine, receipt, replay, LP, Monte Carlo, cap cache | Demo people (Jordan and others) are synthetic purchase histories |
| Supabase schema with RLS, sync and tap routes | Plaid runs in sandbox |
| 36 tests over the engine and provenance | Rotating categories only for the published Q4 2026 lineup; other quarters earn base rate |
| Timings measured on a laptop | Monte Carlo is the spread of your own months, not a forecast of changed habits |
