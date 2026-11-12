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

Monte looks at a year of credit card purchases, works out what each card earned or cost
you, and tells you which card to use next. Live at https://ace-eta-beryl.vercel.app.

## What it does

- Adds up each card's year: rewards and perks used, minus annual fees and interest.
- Replays the same year with every purchase on the best card you already hold.
- Ranks your cards for one purchase at the register (the Tap view), counting spending caps.
- Runs 1,000 simulated years (Monte Carlo) to show how often the best plan stays best.
- Lists recurring charges in the Leaks view.
- Shows where every number came from: the rule, the math, the issuer's page and the date we checked it.

The card catalog (`data/cards.json`) has 29 cards. 11 are marked unverified and badged in the app.

## PayPal AI Hackathon

We built Monte on Oct 17-18, 2026, after the PayPal AI Hackathon opened on Oct 1, and it
won Best Project in Finance at ACM@USC TrojanHacks that weekend. Monte had no PayPal code then.
Everything below was added during the submission period:

- PayPal checkout from the Tap view. Monte says which card to pick in your PayPal wallet and why, and the receipt shows the cap counter move.
- A checkout agent. You type something like "I'm spending $84 on groceries at Trader Joe's". Claude asks Monte's engine, explains the pick and sets up the order. Nothing is charged until you approve it in PayPal's window.
- Refunds from the receipt. When a refund completes, the cap room goes back and the rewards are reversed in proportion.
- Pay Later vs. card interest. If a card carries a balance, Monte compares Pay in 4 with what the same purchase would cost at that card's APR.
- PayPal purchase import, so PayPal spending counts toward the year.
- Plaid recurring charges in Leaks, from the bank's own recurring detection when a sandbox bank is linked.
- The agent handles returns too. "Return the Trader Joe's purchase" gets a refund proposal priced by the engine, and nothing is refunded until you press Confirm.
- Itemized orders. PayPal's review page shows what is being bought and which card Monte picked, and `/api/paypal/order/{id}` reads back PayPal's record of the order, captures and refunds.
- Webhooks. `/api/paypal/webhook` checks every event with PayPal before trusting it, so a refund made in the PayPal dashboard still reaches Monte.
- A PayPal activity page at `/paypal`: checkouts, the card Monte played, rewards, refunds and imported PayPal history, with totals.
- Venmo and Pay Later buttons, off by default behind `NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING=1` until we test them in the sandbox.

PayPal APIs we call (all in `lib/paypal/`):

| API | Used for |
|---|---|
| OAuth 2.0 (`/v1/oauth2/token`) | access tokens |
| Orders v2 (`/v2/checkout/orders`, `.../capture`) | creating and capturing the order |
| Payments v2 refunds (`/v2/payments/captures/{id}/refund`) | refunds |
| Webhooks (`/v1/notifications/verify-webhook-signature`) | checking webhook events |
| Transaction Search (`/v1/reporting/transactions`) | importing PayPal purchases |
| JavaScript SDK v6 | the PayPal button (`components/ace/paypal-checkout.tsx`) |

AI tools:

| Tool | Used for |
|---|---|
| Claude Opus 5.5 | the checkout agent (`lib/paypal/agent.ts`) |
| Claude Haiku 5.5 | cleaning up merchant names and picking a category (`lib/model/categorize.ts`) |
| Claude Code | development. We used Claude Code to write most of the code and reviewed it. |

PayPal is sandbox only. No real money moves. `lib/paypal/client.ts` has only the sandbox
URL, and any `PAYPAL_ENV` other than `sandbox` counts as not configured.

## Why the math is safe

The engine (`lib/engine/`) is plain code. Same inputs, same answer, and the Monte Carlo
random generator is seeded. The model never computes a dollar amount:

- The agent's `rank_cards` tool runs the engine. Claude only passes the store, category and amount, and the amount has to appear in what you typed.
- `create_paypal_order` takes no arguments, so the order can only be for the engine's amount.
- Every number in Claude's reply has to appear in a tool result or in what you typed, and the reply has to name the engine's card. If it doesn't, the app shows a sentence built from the engine's numbers instead.
- Refund rollback and the Pay Later comparison are plain code with no model call.

The engine's result is always shown next to Claude's words. More detail is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run it locally

You need Node 24.

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:3000
npm test                     # 149 tests, Node's built-in runner
```

The app runs with no keys on the demo people. Keys turn on the live parts:

| Variable | Where to get it |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (same ID), `PAYPAL_ENV=sandbox` | a sandbox REST app at [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox) |
| `PAYPAL_WEBHOOK_ID` (optional) | the sandbox app's Webhooks section, pointing at `/api/paypal/webhook` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` | [dashboard.plaid.com](https://dashboard.plaid.com/developers/keys) |
| `SUPABASE_SECRET_KEY` | your Supabase project's API settings (the public URL and key are already in `.env.example`) |

Without PayPal keys, every `/api/paypal/*` route returns `503 paypal_not_configured` and the
Tap view shows the ranking with no button. `curl localhost:3000/api/health` shows what is
connected. The click-by-click demo is in [`docs/PAYPAL-DEMO.md`](docs/PAYPAL-DEMO.md), and
deploy steps are in [`docs/deploy.md`](docs/deploy.md).

## Trying it as a judge

Open the [live demo](https://ace-eta-beryl.vercel.app/#tap-view), pick Jordan and a store in
the Tap view, and use the PayPal button under the ranking. PayPal's window asks for a sandbox
buyer login. Make one for free under Sandbox → Accounts at developer.paypal.com, or use the
test login in our Devpost testing notes. After paying, try "Return it" on the receipt.

## Real vs. simulated

- The demo people (Jordan, Maya, the Parks, Sam, Rosa) are made up. Their spending is synthetic.
- PayPal and Plaid run against their sandboxes only. We have not run any of this with real money or a real bank.
- 11 of the 29 cards have terms we haven't confirmed with the issuer. They are badged in the app.
- Pay in 4 uses PayPal's published US terms. Monte doesn't know if PayPal would approve you, and the card interest is an estimate (monthly compounding, not average daily balance).
- PayPal doesn't say which card funded a payment, so imported PayPal purchases go on a card you choose.

## Team

- **Adrian Erlikhman**: interface, brand and PayPal checkout. Also the card catalog, most of the rules engine and the first three demo people.
- **Michael Tarekegn**: backend, Plaid, the LP solver, Monte Carlo and the tests. Also provenance, the Supabase cap cache, Sam and Rosa, and most of the verification scripts.

MIT license. See [`LICENSE`](LICENSE).
