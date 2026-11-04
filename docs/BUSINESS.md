# How Monte makes money, and how it plugs in

Written 3 Nov 2026. Prices of competitors come from [`RESEARCH.md`](RESEARCH.md) (with sources there);
anything marked *to verify* is an estimate to check before it goes in a deck.

## What Monte is

One decision, made everywhere you pay: **which card, counting interest as well as points.** The same
`choose()` runs in four places today:

| Surface | Where you are | Built |
|---|---|---|
| The app (`/app`) | At the register: search, your usual stores, or where you are | Yes, works offline |
| The browser extension | Any store's website, and at checkout | Yes (unpacked; Web Store listing next) |
| The API (`/api/best`) | Inside someone else's app | Yes, stateless |
| The Monte card (`/card`) | Inside the card network's authorization | The decision, yes; the money, needs a bank |

## Who pays

### 1. People: free core, paid "Plus"

Card pickers already charge: CardPointers about $90 a year, MaxRewards Gold over $100, Kudos $63-92.
Reviewers complain about paywalls on every tab. So:

- **Free, always:** the card pick (app and extension), adding cards by hand, the year from a statement.
  That's the habit, and it should never be paywalled.
- **Monte Plus**, priced well under the others (say $3 a month or $29 a year, *to test*): a linked bank
  that stays in sync (Plaid costs money per linked account, so this is where it belongs), due-date and
  utilization alerts, cap and rotating-category reminders, the receipt every month, and your cards on
  every device.

### 2. Card recommendations, only if the ranking can't be bought

Issuers pay referral fees for approved applications; that's how NerdWallet, Bankrate and Pointwise make
money. Monte already ranks "what to apply for" with its own engine on your own spending. The one rule:
**the fee never changes the order.** Show the ranking first, disclose the link second. The story page
currently says Monte isn't paid by referrals; if this switches on, that line changes the same day.

### 3. Other apps: the decision as an API

Personal-finance apps (budgeting apps, neobanks, credit unions, wallets like Uno) already hold their
users' cards and transactions. What they don't have is the decision engine: 29 cards' rules, caps,
rotations, credits, the interest math, and the receipt. Monte sells that:

- `POST /api/best`: wallet + store (or website) + amount in, the card and the reason out. Stateless, so
  it holds no customer data.
- The receipt and keep-or-cancel as calls on a partner's own transactions (the engine already takes
  Plaid-shaped data).
- Priced per active user per month or per thousand calls (*to set with the first partner*).

This is the fastest path to revenue that needs no license: the partner already has the bank
connection, the users and the compliance.

### 4. Later: the Monte card

One card that plays your best card at every purchase. The decision on the network's authorization is
built (`/card`). Moving the money needs a sponsor bank through an issuing platform (Lithic, Marqeta,
Stripe Issuing), network registration, and an answer to the category problem (see
[`CARD.md`](CARD.md)). Revenue would be interchange, but paying out a 4x card's rewards from interchange
loses money, so the realistic version is a card that routes to your cards (needs tokens and partners)
rather than one that matches them. This is a company with a bank partner, not a student project.

## How to plug Monte in

### A partner app (today)

1. Call `POST /api/best` with the user's cards (ids from Monte's catalog, plus any balance and APR),
   the store or website, and the amount. Full reference and a live console: [`/developers`](https://ace-eta-beryl.vercel.app/developers).
2. Show the card and the one-line reason. Monte never needs the user's name, account numbers or
   purchases for this.
3. Optional: send a year of transactions to get the receipt (what each card earned or cost).

### The app with live bank data

1. Plaid sandbox keys today (free); `.env.local` and Vercel, as in the README.
2. For real banks: Plaid production needs a company profile and a security questionnaire, and Chase,
   Bank of America and Wells Fargo need OAuth registration on top.
3. Store Plaid access tokens server-side, encrypted, per user (today they sit in a cookie, which is
   only fine in sandbox). Supabase is already in the project for this.

### The Monte card on a test network

Lithic or Stripe Issuing sandbox keys switch on the responder that's already built
(`/api/card/authorize`, `/api/card/stripe`); `docs/CARD.md` has the steps. Stripe needs an adult as
the account owner.

## What needs a grown-up, a company or a partner

| Step | Needs |
|---|---|
| Plaid production, issuing live, Apple's wallet programs | A company (LLC or C-corp) and its bank account |
| Stripe account, Apple Developer Program | An adult as the account owner |
| Any Monte card that moves money | A sponsor bank via an issuing platform, network registration |
| Card referral links | Affiliate network approval, disclosures |

## The next three things, in order

1. **One partner on the API.** A budgeting app or credit union that already has Plaid data; the
   integration is one call.
2. **The extension on the Chrome Web Store**, free, as the top of the funnel (users find it while
   shopping, then install the app).
3. **Plus with Plaid production**, once there's a company to hold the keys.
