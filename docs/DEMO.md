# Ace · demo path (4 min + 1 min Q&A)

Michael talks, Adrian drives. Demo from the production URL on the laptop plus one phone
(the Tap screen). Every number below is computed by the engine on Jordan's seeded year.
The bracketed ones get filled in on Sunday morning.

## 0:00–0:25 · Hook (slide)

> "Quick question: which card is in your wallet right now, and what did it cost you last
> year? Not the annual fee. The real number."

The slide shows two stats with sources:

- the average card APR (Fed G.19)
- the share of cardholders who carry a balance

## 0:25–0:45 · Jordan (slide)

> "Jordan is 24, first job in LA, three cards: one from college, one for the signup
> bonus, one with a balance on it."

## 0:45–1:35 · The Receipt (live)

1. Add Jordan's three cards (tap the card art). Connect transactions with the Plaid
   sandbox, or load the seeded year.
2. The receipt prints line by line:
   + [$410] rewards · + [$84] credits used · − [$325] annual fee · − [$690] interest
   → **"Your cards cost you [$521] last year."**
3. The money river draws in. Point at the red interest stream:
   > "Jordan earned 2% back and paid 24% on the balance."

## 1:35–2:15 · Replay (live)

4. Hit **Replay**. The year plays as dots falling into the card actually used.
5. Flip to **Best card**. The dots re-route, and the counter climbs to **[$231] left on
   the table**. Groceries were going on the 1.5% card instead of the 4x card.

## 2:15–2:50 · Tap (live, on the phone)

6. On the phone: "You're at **Sweetgreen**." The wallet fans and **Amex Gold rises**:
   "4x · $[x] back vs $[y] on Freedom Unlimited".
7. Switch to **Trader Joe's**: Amex Gold again (4x groceries), and its yearly grocery
   cap meter shows how much is left.
8. Switch to **Mobil**. The Apple Card would win (3% at Mobil with Apple Pay; check it's
   still listed), but Ace says **"Not this one: it has a $2,800 balance at 26% APR. Use
   Freedom Unlimited."**
   > "That's the rule no rewards app has."

## 2:50–3:15 · Keep or cancel + What if (live)

9. Open Keep or cancel. Amex Gold's scale tips: fee [$325] vs [$212] of value over the
   next-best card. Verdict: **downgrade or cancel, unless you use the dining credits**.
10. Drag Blue Cash Preferred into the wallet: **"+$[184] a year net of fee."**

## 3:15–3:45 · How it works (slide)

One diagram:

transactions (Plaid) → category map → rewards rules engine (25 cards, every rule sourced)
→ **cap-aware optimizer (LP)** → receipt, replay, tap, marginal value

> "The AI only cleans merchant names. Every dollar comes from published card terms and an
> optimizer, and you can click any number to see the rule behind it."

Show one click: [$231] → the transactions → "Amex Gold · 4x groceries · source: amex.com,
checked 17 Oct".

## 3:45–4:00 · Impact (slide)

- Dollars recovered per user per year. Pilot: USC students with their first cards.
- **Real:** the engine, the card terms, the optimizer, the Plaid sandbox connection.
- **Simulated:** Jordan is a made-up person, the transactions are seeded, and Tap is a
  web demo (no NFC).

## Q&A answers to have ready

- **"Card terms change. How do you keep up?"** Every rule has a source and a checked
  date; anything over 90 days old gets flagged. A nightly job would diff the issuer
  pages.
- **"Isn't this what NerdWallet does?"** NerdWallet ranks by referral fee and doesn't
  use your spending. We rank by your net value, and we count interest.
- **"Why an optimizer and not just picking the best card per purchase?"** Caps. Per
  purchase, the greedy choice blows through a 5% cap early in the quarter. The LP spreads
  spending across cards and beats greedy by [$X] on Jordan's year.
- **"Who pays?"** Premium tier, employer wellness benefit, and disclosed referrals ranked
  only by the user's value.
- **"How accurate is the category mapping?"** Plaid categories are a proxy for the
  merchant category codes issuers actually use. Merchant overrides cover the known
  exceptions. We tested [N] merchants by hand.
