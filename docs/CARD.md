# The Monte card: MVP

**Try it:** [`/card`](https://ace-eta-beryl.vercel.app/card). Pick a store, tap, and watch the
authorization round trip.

## The idea

When you tap any card, the network asks the card's issuer to approve the purchase before the
terminal says "approved". That **authorization request** already names the store (its
descriptor), its **merchant category code (MCC)** and the amount. A card program built on an
issuing platform answers those requests with its own server. That is where Monte runs: the
network has already said which store and which category (no guessing from location), and Monte
picks which card in your wallet should play the purchase, with the same `choose()` the app uses:
rewards minus the interest a purchase adds on a card with a balance, and perks first.

## What's built (and tested)

| Piece | File | What it does |
|---|---|---|
| MCC to category | `lib/card/mcc.ts` | The published MCC list mapped to Monte's 20 categories, including the airline (3000-3350) and hotel (3501-3999) brand blocks |
| The decision | `lib/card/authorize.ts` | Reads an authorization request, cleans the descriptor to a store name ("CVS/PHARMACY #9213" -> CVS Pharmacy), runs `choose()`, and returns the card to play, why, perks and timing |
| The responder | `app/api/card/authorize/route.ts` | `POST`: the endpoint an issuing platform calls per purchase. Lithic's Auth Stream Access shape in (`token`, `amount` in cents, `merchant{descriptor, mcc, city, state}`, `card{token, memo}`), Lithic's answer out (`{result: "APPROVED", token, avs_result, balance}`). Monte's decision only with `x-monte-debug: 1`. Standard Webhooks signature check when `LITHIC_WEBHOOK_SECRET` is set. `GET`: recent decisions on this server instance |
| The page | `app/card/page.tsx`, `components/card/card-lab.tsx` | The round trip on screen: the request, the card Monte played, the answer |
| Tests | `tests/card.test.ts` | MCCs, descriptor clean-up, the request/answer shapes, the pick (Jordan at Trader Joe's: Amex Gold, $2.57), the signature check |

**Whose wallet?** The card's `memo` carries it as `monte:w=<code>` (the same encoding as the app's
"copy to another device" link: card ids, balances, APRs, nothing else). Otherwise
`MONTE_CARD_WALLET`, or, for the simulator only, a `monte_wallet` array in the request.

**Monte approves everything.** It routes purchases; it doesn't police them.

## Switching on a real (test) card network: Lithic sandbox

Built, not yet run (no key on this project): `lib/card/lithic.ts` and `/api/card/lithic`.

1. Get a sandbox API key from Lithic's dashboard. Set `LITHIC_API_KEY` (local `.env.local` and Vercel).
2. Deploy, then `POST /api/card/lithic {"action":"enroll"}` points Lithic's Auth Stream Access at
   this deployment's `/api/card/authorize`. Set `LITHIC_WEBHOOK_SECRET` to the responder's secret.
3. `POST /api/card/lithic {"action":"issue","wallet":[...]}` issues a virtual card whose memo is
   your wallet.
4. `POST /api/card/lithic {"action":"simulate","pan":"...","amount":64.2,"descriptor":"TRADER JOE'S","mcc":"5411"}`
   runs a test purchase on Lithic's network; Lithic calls the responder, and the decision shows in
   `GET /api/card/authorize`.

Without the key every action answers `503 issuer_not_configured`. Stripe Issuing (test mode,
`issuing_authorization.request` webhooks) would take a second adapter in `fromLithic`'s place.

## What isn't built: moving the money

Picking the card is the easy half. Paying with it is where Mordi Shadpour's point applies: "the
hardest part isn't only the technology... it's navigating the payment ecosystem, securing
partnerships... and meeting the regulatory and compliance requirements."

| Model | How | The catch |
|---|---|---|
| **Pass-through** (Curve's model) | The Monte card approves, then charges your chosen card for the same amount | Your card's issuer sees Monte, not the store, so the category bonus is gone (4x groceries becomes 1x); some issuers treat it as a cash advance; Monte pays card fees on every charge |
| **Tokens for your own cards** | Monte holds network tokens for your existing cards and presents the chosen one | Needs each issuer (or the networks' token services) to agree to provision into a third-party wallet: partnerships, not code |
| **Monte issues the card** | Monte is the card (with a bank partner) and pays rewards itself out of interchange | A bank partner, compliance, and the money: matching a 4x card's rewards costs more than interchange brings in |
| **Advise** (shipping today) | You pay with the chosen card yourself | The app (Pay, near me), the browser extension and the lock screen do the telling |

So the MVP proves the decision on the network's own message, in the network's format, in about a
millisecond. The money movement is a partnership problem, and the "advise" model is what Monte
ships until one exists.
