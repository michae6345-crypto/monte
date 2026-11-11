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
  categories, credits and fees. Each card lists the issuer's source URLs and the date they
  were checked. 11 cards are marked `UNVERIFIED` and badged in the UI.
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

`npm test` runs `tests/engine.test.ts`, `tests/provenance.test.ts` and
`tests/paypal.test.ts`: hand-computed earn cases, caps crossed mid-purchase, shared cap
pools, determinism, a check that every receipt line traces to a source and adds up to the
engine's total to the cent, and the checkout path with PayPal and Claude mocked. On a clean
`npm ci` all 73 tests pass.

## PayPal + AI (PayPal AI Hackathon, Nov 2026)

### What we built during the hackathon

Monte's engine and site were built at TrojanHacks on 17-18 Oct 2026. This work was added in
November 2026, during the PayPal AI Hackathon's submission period:

- **PayPal checkout on the Tap view.** After Monte ranks your cards for a purchase, it tells
  you which card to choose in your PayPal wallet and why: the rewards on this purchase and
  the cap room left. You pay through PayPal's window. The receipt shows the cap counter move.
- **A checkout agent.** Type "I'm spending $84 on groceries at Trader Joe's." Claude calls
  Monte's engine, explains the result in plain English and proposes the order. Nothing is
  charged until you approve it in PayPal's window.
- **Tests** for the path from purchase to ranked card to order amount to cap counter.

Sandbox only. No real money moves: `lib/paypal/client.ts` has only the sandbox URL, and any
other `PAYPAL_ENV` counts as not configured.

### PayPal APIs

| API | Call | Where |
|---|---|---|
| OAuth 2.0 client credentials | `POST /v1/oauth2/token` | `lib/paypal/client.ts` |
| Orders v2, create | `POST /v2/checkout/orders` | `app/api/paypal/create-order`, and the agent's `create_paypal_order` tool |
| Orders v2, capture | `POST /v2/checkout/orders/{id}/capture` | `app/api/paypal/capture-order` |
| JavaScript SDK v6 | one-time payment session, `<paypal-button>` | `components/ace/paypal-checkout.tsx` |

We tried `@paypal/agent-toolkit` 1.11.0 and don't use it. It has no adapter for the Anthropic
SDK, it would add 88 packages, including the OpenAI SDK and LangChain, and its create-order tool
takes item prices from the model, which this app doesn't allow. The agent's tool calls the
same order code as the checkout button.

### AI tools

| Tool | How it's used |
|---|---|
| Claude Opus 5.5 (Anthropic SDK) | The checkout agent (`lib/paypal/agent.ts`): reads the typed purchase, calls `rank_cards` and `create_paypal_order`, and writes the explanation |
| Claude Haiku 5.5 (Anthropic SDK) | Merchant labeling (`lib/model/categorize.ts`): cleans up bank descriptors and picks a category |
| Claude Code | Development: wrote most of this integration, its tests and these docs, reviewed by us |

### Keeping the math out of the model

The engine is deterministic and the AI never does the math. For the agent, that's enforced in
code:

- `rank_cards` runs the engine. Claude only passes in the store, the category and the amount.
- The amount has to appear in what the person typed, or the tool refuses it.
- `create_paypal_order` takes no arguments, so the order can only be for the engine's amount.
- Every number in Claude's reply has to appear in a tool result or in what the person typed,
  and the reply has to name the engine's card. If not, the app shows a sentence built from the
  engine's numbers instead.
- A card carrying a balance is never recommended. If every card carries one, no order is made.

The engine's result is always shown next to Claude's words, with its rule, math, issuer source
and checked date.

### Run it with sandbox keys

1. Create a sandbox REST app at
   [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Copy `.env.example` to `.env.local` and fill in `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
   `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (the same client ID), `PAYPAL_ENV=sandbox` and
   `ANTHROPIC_API_KEY`.
3. Run `npm ci` and `npm run dev`, then open
   [localhost:3000/#checkout](http://localhost:3000/#checkout), which opens the Tap view at checkout.
4. `curl localhost:3000/api/health` should say `"paypal":"sandbox","agent":"ready"`.
5. Pay with a sandbox personal account from the dashboard's Testing Tools.

Without keys, every `/api/paypal/*` route returns `503 {"error":"paypal_not_configured"}` and
the app still runs, with the ranking and no button. The click-by-click demo is
[`docs/PAYPAL-DEMO.md`](docs/PAYPAL-DEMO.md).

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
