<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/monte-mark-dark.svg">
    <img src="public/brand/monte-mark.svg" alt="Monte" width="48">
  </picture>
</p>

<h1 align="center">Monte</h1>

<p align="center">
  <a href="https://ace-eta-beryl.vercel.app">Live demo</a> ·
  <a href="https://youtu.be/Tn4YrpoLjh8">Video</a> ·
  <a href="https://devpost.com/software/monte-calygj">Devpost</a>
</p>

Monte takes a year of credit card purchases and computes what each card earned or cost
you: rewards plus perks used, minus annual fees, minus interest. It then replays the same
year with every purchase on the best card you already hold, and at the register it ranks
your cards for a single purchase.

Built in a two-person team at ACM@USC TrojanHacks 2026, where it won Best Project in
Finance ([Devpost](https://devpost.com/software/monte-calygj)).

Everything runs on demo data. The five people in the app (Jordan, Maya, the Parks, Sam,
Rosa) are synthetic spending histories, and Plaid runs against its sandbox, not a real bank.

## How it works

- **Card catalog** (`data/cards.json`): 29 cards with their earn rates, caps, rotating
  categories, credits and fees. Each rule has the issuer's source URL and the date it was
  checked. 11 cards are marked `UNVERIFIED` and badged in the UI.
- **Rules engine** (`lib/engine/index.ts`): plays purchases through a wallet in date order
  and tracks spending caps, including caps shared across categories. A card carrying a
  balance is left out of best-card routing unless every card carries one.
- **Plaid integration** (`lib/data/plaid*.ts`, `app/api/plaid/`): link-token, exchange,
  sandbox and data routes. `lib/data/plaid.ts` maps Plaid transactions and accounts into the
  same types the demo people use. Without keys every route returns
  `503 plaid_not_configured` and the app stays on demo data.
- **Monte Carlo** (`lib/engine/montecarlo.ts`): builds 1,000 simulated years by resampling
  the person's own months and runs the full engine on each one, so caps reset where they
  would in a real year. The random generator is seeded, so the same inputs give the same
  odds. `scripts/mc-method.ts` measures the bias that resampling monthly totals would add.
- **LP check** (`lib/engine/lp.ts`): greedy routing can waste a cap on an early purchase,
  so the year is also solved as one integer program with `javascript-lp-solver`. On all
  five demo wallets the greedy plan equals the LP's upper bound, so greedy is optimal there.
  On a hand-built cap trap greedy earns $30.00 and the LP finds $33.00
  (`scripts/lp-vs-greedy.ts`).
- **Provenance** (`lib/engine/provenance.ts`): every receipt line traces back to its
  rule, the arithmetic, the source URL and the checked date.
- **Cap cache** (`lib/db/cap-state.ts`, `app/api/sync`, `app/api/tap`): a one-time sync
  stores how much of each cap is used, so a tap reads counters instead of replaying history.

More detail, including the LP formulation: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run it locally

Needs Node 24 (the version `render.yaml` pins). No keys are required; the app runs on the
demo people.

```bash
npm ci
npm run dev      # http://localhost:3000
npm test         # engine and provenance tests (Node's built-in test runner)
npm run check    # typecheck, lint, build
```

To connect the Plaid sandbox, copy `.env.example` to `.env.local` and fill in the Plaid
keys. Setup steps are in [`docs/deploy.md`](docs/deploy.md).

The verification scripts print their working:

```bash
node --import ./scripts/_alias.mjs scripts/jordan-check.ts  # Jordan's receipt, line by line
node --import ./scripts/_alias.mjs scripts/mc.ts            # Monte Carlo odds per person
node --import ./scripts/_alias.mjs scripts/lp-vs-greedy.ts  # LP vs greedy on every wallet
```

## Tests

`npm test` runs `tests/engine.test.ts` and `tests/provenance.test.ts`: hand-computed earn
cases, caps crossed mid-purchase, shared cap pools, determinism, and a check that every
receipt line traces to a source and adds up to the engine's total to the cent. On a clean
`npm ci` all 36 tests pass.

## Team

- **Michael Tarekegn**: backend. Plaid integration (`lib/data/plaid*.ts`,
  `app/api/plaid/`), Monte Carlo (`lib/engine/montecarlo.ts`), LP check
  (`lib/engine/lp.ts`), provenance (`lib/engine/provenance.ts`), Supabase sync and cap
  cache (`lib/db/`, `app/api/sync`, `app/api/tap`), the `/dashboard` and `/engine` pages,
  two of the demo people (Sam and Rosa), the test suite (`tests/`) and most of the
  verification scripts (`scripts/`).
- **Adrian Erlikhman**: product and front end. The card catalog and category map
  (`data/`), most of the rules engine (`lib/engine/index.ts`), the statement CSV parser,
  the first three demo people, the UI (`components/`) and the brand.

Attribution follows `git log` and `git blame` on each path.
