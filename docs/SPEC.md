# Ace: the right card every time, and the truth about what your cards cost you

TrojanHacks 2026 · **Finance** vertical · Team 1 (Adrian Erlikhman, Michael Tarekegn)
Copies **Uno Wallet** (YC Spring 2026: picks the best card at tap time, 33K waitlist)
and goes past it: Uno only tells you which card earns the most, and Ace also tells you
what your cards actually **cost**.

> Name is a placeholder. "Ace" (the best card in the deck). Alternatives: Trump Card,
> Stack, Swipe Right, Leftover.

## The problem

People choose credit cards on the signup bonus and then stop thinking about them. Three
things quietly cost them money:

1. **Wrong card at the register.** Groceries go on the 1% card while the 4% card sits in
   the wallet. Rotating 5% categories never get activated. Caps get blown.
2. **Fees for benefits they don't use.** A $325 annual fee justified by $424 of credits,
   of which they actually use $84.
3. **Interest that dwarfs the rewards.** Earning 2% back while paying ~22% APR on a
   carried balance. This is the one most rewards apps hide, because they earn from
   recommending more cards.

Nobody shows the **net**: rewards + credits used − fees − interest, per card, from your
real spending.

## The user

**Jordan, 24, first job in LA** ($58K). Three cards:

- Chase Freedom Unlimited, from college
- Amex Gold, for the bonus
- Apple Card, carrying about $2,800

Spends on rent, dining, Trader Joe's, gas, Uber, Spotify and Amazon.

**Track challenge:** "make financial products, fees, and tradeoffs easier to understand
and compare". Also helps "track expenses".

## What it does: six screens

### 1 · Add your wallet

- **Pick your cards** from a grid of card art. You can also connect through Plaid
  (sandbox) or drop in a statement CSV.
- **No card numbers, ever.** We store only which products you hold.
- **Transactions:** Plaid sandbox custom user, or our seeded 12-month history for Jordan.

### 2 · The Receipt (the hero screen)

- One big animated number: **"Your cards cost you $[net] last year."** Every dollar
  figure in this spec is illustrative until the engine computes it from Jordan's seeded
  year.
- It tallies up like a receipt printing. Each line expands into the transactions behind
  it:
  - **+ rewards earned**
  - **+ credits used**
  - **− annual fees**
  - **− interest**
  - **− foreign transaction and late fees**
- **Money river:** a Sankey diagram flowing from spending categories → cards → where the
  value ended up: green rewards, red interest and fees.
- **Shareable card:** "My cards cost me $[net]. What do yours?" This is the marketable,
  viral piece.

### 3 · Replay: "money left on the table"

- A year of transactions plays on a timeline: dots fall into the card that was actually
  used.
- Flip the toggle to **"best card"** and every dot re-routes to the optimal card in the
  same wallet. The **missed rewards** counter climbs ("+$231").
- Bar of missed value by category: groceries $96, dining $71, gas $38…
- Respects real caps:
  - Freedom Flex 5% up to $1,500 per quarter
  - Custom Cash 5% on its top category up to $500 per cycle
  - Blue Cash Preferred 6% on groceries up to $6,000 per year

### 4 · Tap: the Uno moment

- A phone frame. Pick where you are: search, or a mini map of nearby LA merchants
  (Sweetgreen, Trader Joe's, Shell, Uber, Delta).
- The wallet fans out and the **best card rises**: "Amex Gold · 4x · $2.80 back vs
  $0.70 on Apple Card".
- **Live context:**
  - **Cap meters:** "Freedom Flex 5% · $1,210 of $1,500 used this quarter"
  - **Activation reminders:** "Activate Q4 categories first"
  - **Credits:** "You have $10 Uber Cash left this month, use it first"
  - **The honesty rule:** if you carry a balance on a card, Ace never recommends
    putting more on it.

### 5 · Keep or cancel

- Each card sits on a **balance scale**.
- **Left pan:** annual fee.
- **Right pan:** the value the card *adds* over your next-best card for your spending
  (its marginal value: optimal wallet with it minus optimal wallet without it), plus
  credits you actually use.
- **Verdict:**
  - Keep
  - **Downgrade** to the no-fee sibling, which keeps your credit history
  - Cancel, with a note on credit-score impact

### 6 · What if

- Browse about 25 real cards with Oct 2026 terms, each sourced.
- **Drag one into your wallet.** The optimizer re-runs on your real year: "+$184 a year,
  net of the $95 fee". The signup bonus is shown separately as a one-time amount.
- **Sliders** for monthly spend by category; the best wallet updates live.
- **Ranking is by your net value only.** No affiliate ordering.

### Interest reality (shows whenever there's a balance)

- A banner that overrides everything else: **"Rewards don't matter until this is gone:
  you paid $690 in interest to earn $410 in rewards."**
- **Payoff plan:** avalanche order and a month slider ("pay $250/mo → debt-free by
  July, $412 interest saved").
- **Balance-transfer option,** with its 3–5% fee counted.

## The engine (deterministic: the AI never does the math)

| Part | How |
|---|---|
| **Category** | Plaid `personal_finance_category`, mapped to our 20 reward categories. Merchant overrides cover issuer quirks: Costco and Walmart don't count as "grocery" for Amex; Apple Card gives 3% at named merchants. Real issuers decide by merchant category code (MCC), so we document the mapping. |
| **Reward per (transaction, card)** | amount × multiplier × point value. The rules cover caps, after-cap rates, conditions (portal-only, activation), and rotating categories for the current quarter. |
| **Optimal assignment (replay)** | Caps make it a real optimization: maximize total reward subject to per-period caps, solved as a small LP / min-cost flow (javascript-lp-solver), with a greedy marginal-gain baseline we can compare against. |
| **Tap-time pick** | An online greedy with the remaining cap per card and period. Explains itself: "4x dining × $70 × 1.0¢ = $2.80". |
| **Marginal value of a card** | Optimal wallet value with the card minus without it. Drives Keep or cancel and What if. |
| **Interest** | Average daily balance × APR / 365 per day, from statement balances (Plaid Liabilities in sandbox, or seeded). |
| **Credits used** | Detected from transactions (Uber Cash, the dining credit merchants) or ticked by the user. |
| **Provenance** | Every rule in `cards.json` carries its source URL and the date we checked it. Every dollar on screen clicks through to the rule and the transactions behind it. |

**Where AI is used:**

- cleaning merchant names
- the category fallback when Plaid's category is ambiguous
- an optional "explain my receipt" voice-over

The user can override all of it. **This is the answer for Kaushal:** the numbers come
from an optimizer and published card terms, not from a model.

## Data

- `data/cards.json`: about 25 cards. Earn rules, caps, rotating Q4 2026 categories,
  credits, fees, APR ranges, point valuations with sources. Being built now.
- `data/category_map.json`: Plaid categories → reward categories, plus notes on MCCs.
- **Jordan's year:** about 600 synthetic transactions at real LA merchants, generated by
  script with realistic amounts, plus statement balances for the Apple Card. The same
  data is loaded into a Plaid sandbox custom user if the sandbox allows it.
- **Pitch stats**, with sources:
  - average APR (Fed G.19)
  - US card debt (NY Fed)
  - the share of cardholders who carry a balance

## Impact, and how we'd measure it

- **Dollars recovered per user per year:** missed rewards, plus fees on cards that
  aren't worth it, plus interest saved by the payoff plan. Computed by replaying each
  user's own history.
- **Pilot:** USC students, first cards, about 50 users. Measure the change in net card
  value over 3 months.
- **Who pays (Chris's question):**
  - premium tier ($3/mo)
  - an employer financial-wellness benefit
  - card referrals, but only ranked by user value and disclosed. That makes it the
    honest NerdWallet.

## Prior art

| Product | What it does | What it misses |
|---|---|---|
| Uno Wallet (YC Spring 2026) | Best card at tap | Not yet launched (waitlist); rewards only |
| CardPointers, MaxRewards | Best-card lookup, offer activation | No interest or net cost; manual |
| Kudos | Browser checkout extension | Online only |
| NerdWallet | Card match | Ranked by referral fees; not your spending |
| Apple Wallet | Holds cards | No recommendation |

**Ace's angle:** the net cost (including interest and unused benefits), a cap-aware
optimizer, and every number traceable to its source.

## Scope

- **In:** US consumer cards, the 25-card catalog, 12 months of history, the 6 screens.
- **Out:** live tap-to-pay (no NFC or real card provisioning), business cards, points
  transfers to airline and hotel partners (one cents-per-point value per currency).

## Privacy

- Sandbox data only.
- We never see card numbers or credentials.
- The engine runs in the browser.
- The shareable card shows totals, never transactions.
