# Monte — Judge Q&A, full pack

TrojanHacks 2026 · Finance vertical · Team 1 (Adrian Erlikhman, Michael Tarekegn).
Judging 12:45 pm PT. Preliminary Q&A is short; finalists get 4 min present + 3 min questions.

**How to use this.** Read the cheat sheet and the two flagged lists. Everything after that is
lookup. Answer in two sentences, stop, let them ask again. If you don't know: "We don't know —
here's how we'd check," then name the script or the file.

**The rule that keeps us out of trouble:** every number in this pack is reproducible on stage.
Anywhere a number isn't verified, this file says `[VERIFY]` instead of guessing. Do the same out loud.

```bash
npm test                                                    # 36 tests, 0 fail
npm run smoke                                               # 15/15 against the live site
node --import ./scripts/_alias.mjs scripts/jordan-check.ts  # the -$427.03 receipt, line by line
node --import ./scripts/_alias.mjs scripts/lp-vs-greedy.ts  # LP vs greedy + the cap trap
node --import ./scripts/_alias.mjs scripts/mc.ts            # Monte Carlo odds per person
```

Live: https://ace-eta-beryl.vercel.app

---

## The numbers, on one card (never say one that isn't here)

| Person | Headline |
|---|---|
| **Jordan** (24, first job in LA, 3 cards, $2,800 balance) | Net **-$427.03** = rewards $552.69 + credits used $80.00 - annual fees $325.00 - interest $734.72. Interest = $2,800 x 26.24% APR. Replay leaves **$104.14** on the table ($656.83 played right vs $552.69 actual). 576 purchases, $23,785.15 spend. |
| **Maya** (freelance designer) | **Two correct headlines — always say which valuation.** CASH: net **$463.32**, left **$126.48**. TRAVEL (what the site shows her at): net **$944.19**, left **$89.71**. |
| **The Parks** (family of four, 2 cards, $1,200 balance) | Net **$220.15**, left **$226.10**. |
| **Sam** (19, student, ONE card, pays in full) | $9,375/yr spend, net **+$102.17**, left **$0.00** — nothing to re-route, and that's the point. |
| **Rosa** (38, house-cleaning business, irregular income, $1,900 at 28.74%) | $27,709/yr, interest **$546.06** vs rewards **$457.75**, net **-$88.31**. **10.4x** swing slowest to busiest month; the site shows **5.1x** after excluding partial months. |
| **Amex Gold (Jordan)** | Per-card net **-$51.76** → "a -$52/yr downgrade". Wallet-level drop is **+$48/yr** now, **+$75/yr** once he's paid off. **Not interchangeable — say which one you mean.** |
| **LP vs greedy** | **$0.00** gap on all three original wallets. Greedy is already optimal and the LP *proves* it with a matching upper bound. Honest case: a hand-built cap trap, greedy **$30.00** vs optimal **$33.00**. **Never say "LP beats greedy by $X" on a persona.** |
| **Monte Carlo** | 1,000 years, seed 42, deterministic, **19-313 ms**. Drift OFF by default. Win shares are often 100% because it's a paired comparison on the same drawn year — lead with dollars. |
| **Catalog** | **29** cards, each with issuer source URLs and checked date **2026-10-17**; **11** marked UNVERIFIED. Jordan's wallet is fully verified. |
| **Tests** | **36** passing. 15/15 smoke against the live site. |
| **Plaid** | Code built, sandbox-only, **no keys on the deployment** → routes return `503 plaid_not_configured`; the app stays on the five demo people. |

---

## IF YOU ONLY MEMORISE ONE THING PER JUDGE

**Kaushal Patel (OpenAI) — "the AI never does the math."**
There is no model anywhere in the number path. Every dollar comes from `lib/engine/` applied to
published terms in `data/cards.json`; unplug the network and every figure still renders. A
hallucinated dollar figure in a finance tool is worse than no tool, so we took the model out of the
one place it could hurt. 36 tests, five purchases hand-computed from issuer terms with the
arithmetic written in the comments.

**Franck Leveneur (Data-Sleek) — "two types, one mapping, and I'll tell you where it's wrong."**
The whole system reduces to a `Txn` (date, merchant, amount, category, card used) and a `Holding`
(card, revolving balance, APR); personas, CSV upload and Plaid all produce that same pair, so the
engine never knows the source. Plaid's `personal_finance_category` maps to our 20-term vocabulary
with merchant-name overrides first, then detailed, then primary, then fallback — and it is
predictably wrong on warehouse clubs and superstores, because Costco and Walmart are excluded from
many grocery bonuses and a category alone can't tell a Target grocery run from a Target TV. No card
numbers anywhere; 29 cards each carry the issuer URL and the date we read it (2026-10-17), refresh
is manual today, and 11 cards are badged UNVERIFIED rather than quietly shown.

**Saty Raghavachary (USC) — "caps are what make this a linear program, and the LP's honest answer is $0.00."**
Greedy routes purchases in date order, so a cheap early purchase can burn a cap a later larger
purchase needed; the LP assigns the whole year at once — a binary per (purchase, card, rule), a
continuous variable for the dollars falling inside each cap, one constraint per cap pool per period.
On our demo wallets the gap is **$0.00**: greedy is already optimal, and the LP is how we *know*,
because it returns a matching upper bound instead of just agreeing. The Monte Carlo resamples 12 of
the person's own months and **replays the whole engine** over each synthetic year, because resampling
monthly reward totals is invalid the moment a cap binds.

**Chris Lin (Cylier) — "unfold any number on screen, and nobody pays us to recommend a card."**
Interest is balance x APR from the user's own card: Jordan, $2,800 x 26.24% = $734.72 — a yearly
approximation, not average-daily-balance, and we say so, because the conclusion doesn't move when
interest exceeds every reward he earned. Rewards $552.69 + perks used $80.00 - fees $325.00 -
interest $734.72 = **-$427.03**. We refuse to recommend a new card while you carry a balance, which
rules out the affiliate model every competitor runs on — the defensible model is a subscription or a
bank/credit union licensing it.

---

## THE 10 MOST LIKELY QUESTIONS

1. **What is this?** → E1
2. **Who is it for?** → E2
3. **Why isn't this a spreadsheet / why can't I just read my statement?** → H1
4. **Where's the AI?** → AI1
5. **How do you pick which card to use?** → R1
6. **What is the Monte Carlo actually doing?** → MC1
7. **Where do the card terms come from, and how do you keep them fresh?** → D1
8. **How much does a typical person save?** → S1
9. **Who pays for this / what's the business model?** → M3
10. **What's real and what's simulated?** → HO1

## THE 5 MOST DANGEROUS QUESTIONS
*(a weak answer here costs real points — rehearse these out loud)*

1. **"Your LP — how much does it actually beat greedy by?"** → **LP3**. The trap is bluffing a
   number. The answer is **$0.00** on all three wallets, and that's a *result*, not a failure.
2. **"Why should I trust your numbers?"** → **H5**. Every dollar clicks through to its rule, the
   issuer page and the date we read it; 11 of 29 cards are badged UNVERIFIED; 36 tests including
   hand-computed purchases. Trust is the product.
3. **"So the data's fake."** → **HO2**. Yes — the *people* are synthetic and we say so on screen.
   The card terms, engine, LP, Monte Carlo and provenance are real, and the synthetic year is the one
   part a real Plaid pull replaces in a single function call.
4. **"Why won't Chase just build this?"** → **H2**. An issuer can only optimise its own cards, and
   will never tell you its own card is costing you money. The conflict is structural, not technical.
5. **"Isn't this affiliate bait?"** → **M4** / **H4**. Monte refuses to recommend a card while you
   carry a balance. That rule is in the engine, not the marketing, and it's the opposite of an
   affiliate funnel.

---

# 1. EASY / OPENING

**E1. What is Monte?**
Monte shows the net value of your credit cards: rewards, plus the perks you actually used, minus
annual fees, minus interest — computed from a year of your real purchases. Rewards apps show you
points; Monte shows what the cards cost you. Jordan earned $552.69 in rewards and paid $734.72 in
interest, so his cards cost him $427.03 more than they paid him.

**E2. Who is it for?**
Anyone with two or more cards and money moving through a bank, but the user we designed for is
Jordan: 24, first job in LA, three cards, one carrying a $2,800 balance. That's the person who has
been sold on rewards and has never been shown the other side of the ledger. We also built a student
with one card and a self-employed cleaner with irregular income to prove the tool doesn't only work
for the flattering case.

**E3. Why should I care?**
Because the three ways people lose money on cards — the wrong card at the register, fees for perks
they never use, interest that outweighs every reward — are all invisible in the apps they already
have. Monte makes the net a single number and then tells you the three moves that change it. For
Jordan that's $104.14 of mis-routed purchases, a -$52/yr card, and a $734.72 interest bill.

**E4. What did you build this weekend?**
A deterministic rewards engine over a 29-card catalog with sourced, dated issuer terms; a receipt
that nets rewards, perks, fees and interest per card; a replay that re-routes the year; a tap screen;
a keep-or-cancel view; an apply planner; a 1,000-year Monte Carlo; an LP optimizer; and provenance so
every dollar clicks through to its rule. 36 tests, deployed, 15/15 smoke tests against the live site.

**E5. Give me the 20-second version.**
Jordan, 24, three cards. His cards cost him $427 last year and no rewards app would have told him.
Monte reads his year, shows the net, tells him which card to use for each purchase, which to keep,
which to apply for — and gives each recommendation odds from 1,000 simulated years.

**E6. Why is it called Monte?**
Monte Carlo simulation, which is how we put odds on next year instead of a single guess — with a
casino wink, since the whole product is about playing a hand well. The name is also a promise: every
recommendation comes with a probability, not a vibe.

**E7. What does a user do first?**
Pick a person (or upload a statement CSV, or connect a bank in the full version), and the first
screen is where their money went — stores sized by dollars, month by month. Then the receipt: four
numbers and a net. Every screen after that is a decision, not a chart.

**E8. What's the single most surprising thing you found?**
That the rewards were never Jordan's problem. He played his cards reasonably badly — $104.14 left on
the table — but the interest alone was $734.72, seven times the routing mistake. A rewards optimiser
that doesn't model interest is optimising the small number.

**E9. Is it live? Can I use it right now?**
Yes — https://ace-eta-beryl.vercel.app, and it works on a phone. There are five demo people; you can
also drop in a Chase, Amex or Capital One statement CSV and it parses in the browser.

**E10. What's the one screen I should look at?**
The Receipt. Four lines, one net, and every one of those four lines clicks through to the card rule,
the issuer page and the date we read it. If you only believe one screen, believe that one, because
it's the one with the sources attached.

**E11. Which track and why?**
Finance — specifically "make financial products, fees, and tradeoffs easier to understand and
compare" for a clearly defined user. A credit card is the financial product most people own and
least understand, and the fee/interest/reward tradeoff is exactly what we compute.

**E12. How is this different from Mint or Copilot?**
Budgeting apps tell you where your money went; they don't know your card terms, so they can't tell
you the money went to the wrong card. Monte starts from the 29-card catalog and the rules — caps,
rotations, pick-one categories, credits — and only then looks at your spending.

**E13. What does "left on the table" mean?**
It's the difference between what you earned and what the *same wallet* would have earned if every
purchase went to the best card you already own. Jordan: $656.83 played right versus $552.69 actual =
$104.14. No new cards, no new spending — the same year, re-routed.

---

# 2. HARD / ADVERSARIAL

**H1. Why is this not a spreadsheet?**
Because caps, periods and shared pools make it a sequencing problem, not a multiplication. The right
card for a purchase depends on how much of a cap you've already consumed this cycle, which quarter
it's in, which pick-one category you selected, and whether a card carries a balance — and that
changes with every purchase. 576 purchases times 29 cards times multiple rules each isn't a
spreadsheet anyone maintains correctly.

**H2. Why won't issuers just do this?**
An issuer can only optimise across its own cards, and it will never tell you that its own $325 fee
card is netting you -$52 a year, or that your balance costs more than every reward you earn. That
conflict is structural. The only players who can honestly compute the net are ones that don't get
paid per approved application.

**H3. What if your card data is wrong?**
Then we'd rather you catch it than trust us, which is why every card carries its issuer source URLs
and a checked date (2026-10-17), and every dollar clicks through to the rule behind it. 11 of our 29
cards have at least one field we couldn't confirm on an issuer page, and those are badged UNVERIFIED
in the UI rather than quietly shown. Jordan's wallet is fully verified, which is why we demo on it.

**H4. Isn't this just affiliate bait with extra steps?**
The engine refuses to recommend any new card while you carry a balance — it returns a payoff plan
instead. That is the single most expensive rule you could write for an affiliate business, and we
wrote it into the optimizer, not the marketing copy.

**H5. Why should I trust your numbers?**
Three reasons: every dollar unfolds to its rule, the issuer page and the date; 36 tests including
five purchases computed by hand from published terms with the arithmetic in the comments, plus a cap
case where a cap is crossed mid-purchase and we check the blended rate; and the headline numbers each
have a script that prints its own workings. Pick any number on screen and we'll open it.

**H6. Your interest math is wrong — nobody computes interest as balance times APR.**
Correct, and we say so on the record: it's a yearly approximation, not an average-daily-balance
amortisation with compounding and grace periods. We use it because it's the number a user can verify
from their own statement, and because the conclusion doesn't move — Jordan's interest exceeds every
reward he earned by a wide margin. The exact amortisation is a one-function upgrade, and it would
make the number worse for him, not better.

**H7. Isn't the real advice just "pay off your card"?**
Yes, and Monte says exactly that — for Jordan it blocks every new-card recommendation and shows a
payoff plan instead. What it adds is the *size* of the gap: $734.72 of interest against $552.69 of
rewards makes "stop chasing points, kill the balance" a number instead of an opinion.

**H8. Five fake people is not a product.**
Agreed. The five people are a fixture for the engine, and they're labelled as synthetic on screen.
The engine takes a `Txn` list and a `Holding` list — personas, CSV upload and Plaid all produce
exactly that pair, so swapping in a real year is one function call, not a rewrite.

**H9. What stops a user from gaming this — putting everything on one card to look good?**
Nothing, and nothing should: Monte's advice is only as good as the transaction history behind it. We
don't score the user; we score the wallet. If the history is incomplete the right fix is connecting
all accounts, which is exactly what the Plaid path is for.

**H10. You're telling broke people to optimise credit card points.**
No — for the person carrying a balance we tell them to stop. Jordan and Rosa both come out negative,
and for both the recommendation is the balance, not the points. Monte is the only one in this
category whose answer is sometimes "use fewer cards and pay this off".

**H11. Why would anyone trust a hackathon project with their bank login?**
They shouldn't, and today they can't: this deployment has no Plaid keys, so those routes return
`503 plaid_not_configured` by design. For production you'd need a real security review, server-side
session storage for the access token, and the bank-side requirements of a Plaid production
agreement — none of which gets done in 24 hours, and we'd rather say that than pretend.

**H12. Isn't the "net" number just going to depress people?**
It's the number that changes behaviour. Showing Jordan $552.69 of rewards makes him feel clever;
showing him -$427.03 with four lines and a fix for each one makes him pay down a balance. We always
pair the net with the three moves that improve it.

**H13. The 100% odds look like a bug.**
It's a paired comparison — every option is scored on the *same* drawn year, same purchases, same
timing, so routing is the only difference. If a card is better for how you actually spend, it's
better in essentially every year we can draw. That's why we lead with the dollar spread, not the
percentage.

**H14. What's your biggest weakness?**
The data layer, not the engine. Synthetic people instead of real ones, a manual refresh for card
terms, and category accuracy on real merchant strings — the warehouse-club and superstore cases we
know are wrong. All three are data-operations problems, and the engine stays correct while we fix
them.

**H15. Isn't 29 cards far too few? Pointwise compares about 4,000.**
29 verified beats 4,000 scraped for what we're claiming, because our claim is per-dollar provenance
with a source URL and a date. Breadth is a crawling problem with a known shape — a scheduled
re-crawl, a diff against the last snapshot, and a human review queue for changed terms. We'd rather
ship 29 we can defend and badge the 11 we can't fully confirm.

**H16. Isn't this just another card-picker app?**
Card pickers choose the best card at tap time; Monte adds the entire cost side —
fees, credits actually used, and interest — which changes the recommendation, because the best card
to tap is sometimes no new card at all.

---

# 3. CARD ROUTING — THE MECHANICS

**R1. How do you pick a card for a purchase?**
For each card we enumerate every published rule that could apply — category match, merchant
include/exclude list, base rate, the pick-one choice, the rotating bonus if the date is inside its
window — then compute the dollar value given how much of each cap is already consumed, and take the
highest. Value per dollar is `multiplier x point_value_cents / 100`, so a 3x card at 1¢ loses to a 2x
card at 2¢. Cards carrying a balance are excluded from new routing entirely.

**R2. What about spending caps?**
Each capped rule has a pool keyed by pool identity plus period, so `citi_custom_cash|500|billing_cycle|2026-03`.
When a purchase straddles the cap we blend: the dollars inside the cap earn the bonus rate, the rest
earn `after_cap_multiplier` (the base rate by default), and the effective multiplier is the
dollar-weighted average. One of our hand-computed tests is exactly that mid-purchase crossing.

**R3. Shared cap pools — what are those?**
Some cards put several bonus rules under one pot: Citi Custom Cash has a single $500 a billing cycle
across all its 5% categories, and BofA Customized Cash has one combined $2,500 a quarter. Every other
capped rule gets its own pool even when the dollar amounts match — Blue Cash Everyday's three 3%
categories each have their own $6,000 calendar-year cap. Getting that wrong would overstate rewards,
so the pool key is computed in one exported function that both greedy and the LP use.

**R4. Rotating categories?**
We only encode the published Q4 2026 lineups, with the window as real dates, so a purchase earns the
rotation only if its date falls inside 2026-10-01 to 2026-12-31 and its category is in the lineup.
Q1-Q3 lineups aren't published yet, so those months earn the card's base rate — conservative on
purpose. The tap screen also warns you when a rotation requires activation and you haven't activated.

**R5. Pick-one categories?**
For cards like BofA Customized Cash, where you choose one 3% category, we run the choice as an
optimisation over your actual spending: sum the year's spend in each option group and pick the group
that earns the most. The option groups are the issuer's own groupings — gas and EV charging together,
online retail with streaming, phone and utilities, and so on. It's chosen once per year of data, the
same way a user sets it once.

**R6. Point valuations — how do you avoid the "my points are worth 2 cents" argument?**
We ship two valuations and label which one you're looking at. "Cash" values every point at 1¢, what
you actually get as a statement credit; "travel" uses The Points Guy's October 2026 valuations for
people who transfer to airlines and hotels. Maya is the case that proves it matters: net $463.32 at
cash, net $944.19 at travel. We never quote one without saying which.

**R7. Why would you ever not use the highest-earning card?**
Because a card carrying a balance starts charging interest on new purchases immediately, and no
reward rate beats a 26% APR. If every card in the wallet carries a balance we fall back to all of
them rather than refusing to answer — but the tap screen tells you the card is blocked and why, with
the balance and the APR in the sentence.

**R8. Show me that rule in action.**
At Mobil, Jordan's Apple Card earns 3x with Apple Pay — the best rate in his wallet — and Monte says
don't use it: "carries a $2,800 balance at 26.24% APR; new purchases start charging interest today."
It routes him to the next-best card instead. That's the demo moment where the product's values show.

**R9. What actually happens at the register in real life?**
Today you'd open Monte and read the answer, which is a web demo, not NFC — we're clear about that.
The real version is a wallet-level intercept so the right card is
selected on tap. Our bet is that the selection logic and the cost model are the hard part, and the
tap surface is an integration.

**R10. MCC versus category — which do you use?**
We use Plaid's `personal_finance_category` mapped to a 20-term vocabulary, with merchant-name
overrides taking priority, then detailed category, then primary, then a fallback. That's not the same
as the merchant category code the issuer actually pays on, and the gap is where the errors live:
MCCs are assigned by the acquirer per merchant location, so a mapped category is a good prediction
and not a guarantee.

**R11. Where is the mapping wrong, specifically?**
Warehouse clubs and superstores. Costco and Walmart are excluded from many grocery bonuses, and a
Plaid category alone can't tell a Target grocery run from a Target TV. We encode the exclusions we
know as merchant exclusion lists on the rules, and rows we can't resolve confidently come back
flagged rather than guessed.

**R12. How do you handle refunds, payments and transfers?**
Dropped before the engine sees them. A refund isn't a purchase, a card payment isn't spending, and a
transfer would double-count — leaving them in would inflate both the spend and the rewards.

**R13. What about a purchase that matches two rules on the same card?**
We take the best one, which is what the issuer does. Each rule is evaluated independently with its
own cap pool, so a merchant-specific 5x and a category 3x are two separate options on the same card
and the higher effective value after caps wins.

**R14. Does the order of purchases matter?**
Yes, and that's precisely why the LP exists. Greedy processes purchases in date order, so a cheap
purchase early in a cycle can consume a cap a larger purchase later in that same cycle needed. The
LP assigns the whole year at once and gives us the bound to check greedy against.

**R15. How do you handle credits and perks — the $325 Amex fee?**
Credits count only to the extent they were *used*, per card, from the holding data — Jordan used $60
of Uber Cash and $20 of dining credit, so $80, not the full published value. That's the honest
difference between a card's marketing value and its value to you. It's why his Amex Gold nets -$51.76
per card, with the $325 fee against $106.65 of rewards and $80 of credits.

**R16. What's a "cap trap"?**
The smallest case where greedy loses: Citi Custom Cash (single $500/cycle at 5%) plus Double Cash,
$400 of dining on 3 March then $500 on 20 March. Greedy burns $400 of the cap on the small purchase
and earns $30.00; the optimal assignment earns $33.00. We hand-built it because we refuse to put a
fabricated gap on a slide.

**R17. Why not just tell people to carry one card?**
For some people we do — Sam, 19, one card, pays in full, nets +$102.17 and has $0.00 left on the
table. Monte's answer there is "you're already playing this right", which is a result we wanted the
tool to be able to give. The keep-or-cancel screen is the same logic pointed at fees.

**R18. How do you value a card you don't own yet?**
We replay your year with the card added, paid in full and credits unused, and subtract the annual
fee — so the comparison is rewards added versus fee, never the marketing bonus. Any card we'd
recommend has to clear its own fee on your actual spending. And if you carry a balance, we produce
no add-a-card options at all.

---

# 4. THE MONTE CARLO

**MC1. What is the Monte Carlo doing?**
It builds 1,000 plausible versions of your next year out of your own months, then replays the full
rules engine over each one, and reports the distribution of net outcomes for your current wallet and
each alternative. So a recommendation comes with a spread and odds instead of a single point
estimate. 1,000 years, seed 42, 19-313 ms.

**MC2. Why resample instead of forecasting?**
Because we have one year of statements and no basis for a forecast. A block bootstrap over your own
months makes the only honest claim available: "if next year looks like a reshuffle of your own
months, here's the range." Anything smoother would be our assumption wearing your data's clothes.

**MC3. Why resample months rather than individual purchases?**
Because spending is correlated within a month — rent, the phone bill, a holiday trip, a slow work
month all move together. Drawing 12 whole months with replacement preserves that structure; drawing
individual purchases would shatter it and understate the spread. Rosa is the case that proves it
matters: her slowest and busiest months differ by 10.4x.

**MC4. Why re-simulate the whole year instead of resampling monthly reward totals?**
Because a month's reward total is only valid under the cap usage it was computed with. If a card's
cap binds, reusing that month's total in a different position in the year double-counts the bonus.
The shortcut was measured as identical on two personas and 9.7% optimistic on the one whose cap
binds — correct costs 19-313 ms, so there was no reason to approximate.

**MC5. How do caps behave across simulated years?**
Each simulated year puts the drawn months into slots 1 to 12 of one synthetic calendar year, with
each purchase keeping its day of the month (clamped to the slot's last day). So monthly,
billing-cycle, quarterly, half-year and annual caps all reset exactly where they would in a real
year, and every simulated year accumulates from zero.

**MC6. What about rotating categories in a simulated year?**
Slot k is calendar month k of the synthetic year, and the catalog only has the published Q4 2026
lineups, so slots 10-12 can earn the rotation and slots 1-9 earn the base rate on those categories.
That's deliberately conservative and it matches the receipt, which also only pays a rotation inside
its published window.

**MC7. What are "partial months" and why exclude them?**
If the data starts after the 7th or ends more than a week before month end, that month isn't a month
— it's a fragment, and in the pool it would masquerade as a quiet month and bias everything
downward. We drop those edge months as long as at least three full months remain. Rosa shows the
effect: a 10.4x slowest-to-busiest swing in the raw data, 5.1x once partial months are excluded, and
the site shows 5.1x.

**MC8. Why is spending drift off by default?**
Because one year of statements gives us no way to estimate year-over-year drift, and inventing a
standard deviation would widen the fan with our assumption instead of your data. The knob exists —
`driftSd` — and it's applied to purchase amounts before the rules run, so caps stay non-linear. We
left it off and we say so.

**MC9. Why do the odds say 100%?**
Common random numbers: every option is scored on the same drawn year, so purchases and timing are
identical and routing is the only difference. If a card is better for how you actually spend, it wins
in essentially every year we can draw. The fan's width is real uncertainty about *which* months you
get, and it moves both wallets together — so we lead with the dollar difference, not the percentage.

**MC10. Is it deterministic?**
Yes. A seeded mulberry32 PRNG, no `Math.random` anywhere in the path, seed 42 by default — same
inputs, same odds, every reload. The tests assert it, so a regression that silently changed the
numbers would fail the build.

**MC11. What does the fan chart mean?**
It's cumulative net by month across the 1,000 simulated years, shown as percentile bands —
5th, 25th, median, 75th, 95th. Month 12 is the year's net. Fee cards start below zero because the
annual fee posts in full in month 1, which is also what happens to you.

**MC12. Why 1,000 years and not 10,000?**
1,000 is where the percentile bands are stable at the resolution we display, and it keeps the whole
run at 19-313 ms so the chart is interactive. There's no barrier to 10,000 — it's linear — we just
didn't need it. [VERIFY] if a judge asks for a convergence plot; we didn't build one.

**MC13. How do you handle adding or dropping a card in a simulation?**
An added card is modelled as paid in full with credits unused and its annual fee charged — the
conservative case. A dropped card loses its rewards, credits and fee, but any balance on it stays and
so does its interest, because closing a card doesn't clear the debt. Both are the choices that make
the recommendation harder to justify, not easier.

**MC14. What if the user carries a balance — do you still simulate new cards?**
No. If any held card carries a balance, no add-a-card options are generated at all, even if a
candidate is passed explicitly. There's a separate explicit hypothetical — "here's what opens up once
this is cleared" — which zeroes the balances and carries a flag so the result can never be mistaken
for the real wallet.

**MC15. Does the Monte Carlo agree with the rest of the engine?**
It has to. For speed it replays best-play routing over precomputed rule tables rather than calling
the main simulator, and `scripts/mc.ts` checks that it matches `simulate()` to the cent. If those two
ever diverged, that check fails.

**MC16. Where does the Monte Carlo change a recommendation?**
Where the point estimate is close. A card that wins by $5 on the single observed year but loses in a
meaningful share of drawn years is a different recommendation from one that wins in nearly all of
them — and without the simulation both look like "+$5".

---

# 5. THE LP

**LP1. Why linear programming at all?**
Because caps make routing a global assignment problem rather than a per-purchase choice. Greedy is
myopic: it can spend a limited cap on a small purchase early in the period and leave nothing for a
large one later. An LP assigns the whole year at once and can't be fooled by date order.

**LP2. What's the formulation?**
A binary `y[t,c,o]` for putting purchase t on card c under rule option o, and a continuous
`a[t,c,o] >= 0` for the dollars of t that land inside rule o's cap — the only continuous part.
Maximise the over-cap rate on the whole purchase plus the bonus spread on the in-cap dollars, subject
to one-card-one-rule per purchase, a linking constraint `a <= amount x y`, and one row per cap pool
per period. The rule options come from the same exported `earnOptions()` greedy uses, so the two can
never disagree about what the rules are.

**LP3. How much does the LP beat greedy by? (THE DANGEROUS ONE)**
On our three demo wallets: **$0.00**. Greedy is already optimal, and the LP is how we *know* —
it returns a matching upper bound rather than just agreeing with us. Where it matters is a binding
cap, so we built the smallest case that proves it: greedy $30.00 versus optimal $33.00 on a
hand-constructed cap trap. We have not put a fabricated gap on a slide.

**LP4. Then why keep the LP if the gap is zero?**
Because "greedy is optimal here" is a claim, and without the LP it's an untested one. The LP turns it
into a proof for this wallet and this year, and it's the component that will start paying the moment
someone's spending actually binds a cap — a Custom Cash user with heavy dining, or anyone near the
$1,500 quarterly rotation limit.

**LP5. Isn't the LP's answer potentially *better* than anything a person could do?**
We were careful about exactly that. The cap rows let the optimizer choose how a pool's dollars split
between purchases, while reality fills a pool in date order — which is identical when every option on
a pool earns the same rate, but can be optimistic for a pool mixing rates, like BofA Customized Cash's
3% choice category sharing one $2,500/quarter pool with its 2% grocery rule. So the objective is
reported as a `bound`, and the number we *show* comes from replaying the chosen assignment through
the engine's own evaluator in date order. When the replay equals the bound, the assignment is proven
optimal.

**LP6. Is it an LP or a MILP?**
A MILP: the card-and-rule choice is binary and the in-cap dollars are continuous. It's labelled in
the result (`method: "milp" | "lp"`) so you can see which path ran, and we prune dominated
(purchase, card) pairs before building the model to keep it tractable.

**LP7. What solver, and does it scale?**
`javascript-lp-solver`, in-process, no service. Model size grows with purchases times cards times
rules, which is why we prune options that can't win. For a year of one person's spending that's fine;
for a cap-dense wallet at a much larger scale you'd want a real solver or a min-cost-flow
reformulation. [VERIFY] exact solve times — we report the LP as a verification path, not a hot path.

**LP8. Could you model this as min-cost flow instead?**
For the pure cap structure, largely yes — purchases to card-rule arcs with capacities on the pools —
and it would be faster. The binary "one card, one rule, whole purchase" condition is what pushes it
to a MILP, since flow would happily split a single purchase across cards. That's the trade we'd look
at first if solve time ever mattered.

**LP9. Does the LP run in the product or just in a script?**
Both paths exist: the solver is in `lib/engine/lp.ts` and `scripts/lp-vs-greedy.ts` prints the
comparison and the cap trap. The user-facing replay uses greedy, which we've proven matches the bound
on these wallets, and the LP is the check behind it.

**LP10. What would change your mind about greedy being good enough?**
A real user whose spending binds a cap pool with mixed rates. That's a measurable condition, not a
judgement call: we can detect a binding pool and run the LP only for those wallets, which is the
production design — greedy by default, LP where the bound doesn't match.

---

# 6. SAVINGS / IMPACT

**S1. How much does a typical person save?**
It depends entirely on which problem they have, and that's the finding. Pure routing: Jordan $104.14
a year, the Parks $226.10, Maya $126.48 at cash or $89.71 at travel, Sam $0.00. The fee and interest
side is bigger — Jordan's Amex Gold is a -$52/yr card and his interest bill is $734.72.

**S2. Is $104 a year worth building a company on?**
$104 is only the routing slice. The whole net for Jordan is -$427.03, and the three moves Monte shows
him — route correctly, downgrade a card that doesn't pay, attack the balance — are each in the same
order of magnitude or bigger. The headline isn't "$104 of points", it's "your cards cost you $427 and
here's each dollar of it".

**S3. What about someone with one card?**
Sam, 19, student, one card, pays in full: $9,375 of spend, net +$102.17, $0.00 left on the table.
Monte's answer is "you're already playing this right" — and a tool that can't say that is a tool
that will always find a reason to recommend a card.

**S4. What about someone in debt?**
That's Jordan and Rosa, and for both the engine refuses to recommend a new card and shows a payoff
plan instead. Rosa: $27,709 of spend, $546.06 of interest against $457.75 of rewards, net -$88.31 —
she's a profitable customer for her issuer and a losing one for herself.

**S5. How is this different from just saying "pay off your debt"?**
Everyone already says that; nobody shows you the number. Monte puts the interest line next to the
rewards line in the same receipt, so "your points habit earned $457.75 and your balance cost $546.06"
is arithmetic rather than advice. Then it quantifies what clears when the balance clears.

**S6. Who does this help the most?**
People with a fee card and a balance, because they're losing on all three axes at once — Jordan is
that case by construction. The second group is people with several no-fee cards who never think about
which one to use: the Parks leave $226.10 on the table with just two cards.

**S7. Does it ever tell someone to cancel a card?**
It tells them what the card is worth to them and lets them decide — Jordan's Amex Gold nets -$51.76
per card, which reads as "a -$52/yr downgrade". We're careful that the wallet-level figure is a
different number: dropping it moves the wallet by +$48/yr now and +$75/yr once he's paid off, because
the rest of the wallet absorbs some of the spending. We never swap those two numbers.

**S8. Why does dropping a card that loses $52 only gain $48?**
Because the per-card figure charges that card's own rewards against its own fee, while the
wallet-level figure re-routes its spending to the next-best card you own, which recovers part of the
reward. Both are correct answers to different questions, and the keep-or-cancel screen is the
wallet-level one, because that's the decision.

**S9. What's the aggregate impact claim?**
We don't make one, because we'd have to invent a population. What we can say is the per-person
arithmetic on five different shapes of spender, and that the dominant term for two of five is
interest, not rewards. A credible national number needs real data, and that's exactly what we don't
have yet.

**S10. Why is the Parks' "left on the table" bigger than Jordan's with fewer cards?**
Because their spending concentrates in categories where their two cards differ a lot, and nothing in
the routing problem scales with card count — it scales with how much of your spending sits in a
category where the card you reach for isn't the card that pays. $226.10 on two cards is the cleanest
demonstration that this isn't a power-user problem.

**S11. How long before a user sees value?**
Immediately, because it's retrospective: it reads the year that already happened. There's no learning
period, no "check back in three months" — the receipt is computable the moment the transactions land.

**S12. What's the behaviour change you're actually betting on?**
Three, in order of value: pay the balance, drop or downgrade a fee that doesn't pay for itself, and
reach for a different card at the register. The first two are one-time decisions, which is why we
lead with them — they don't depend on the user remembering anything.

---

# 7. MARKET / BUSINESS

**M1. Who is this for, commercially?**
Two doors. Consumer: multi-card holders who want the net, not the points — and specifically people
early in their credit life who were sold rewards and have never been shown interest. B2B: a bank or
credit union that wants to show its own customers an honest net, which is a retention story rather
than an acquisition one.

**M2. What's the TAM?**
We won't quote a number we haven't verified — [VERIFY] for any market-size figure. The honest shape
is: the addressable user is a US adult with two or more rewards cards, and the ones we help most are
the subset carrying a revolving balance. Both are large and both are measurable from public data we
didn't have time to source properly.

**M3. Who pays?**
Not the user per recommendation, and deliberately not issuers per approved application. The two
models we'd defend are a consumer subscription and licensing to a bank or credit union for their own
customers. Both are compatible with telling a user to cancel a card, which the affiliate model isn't.

**M4. Why not affiliate? That's free money.**
Because it would make us lie by omission. The moment you earn per approved card, "you carry a
balance, don't apply for anything" is a revenue-negative recommendation — and that's exactly the
recommendation Jordan needs. Our engine hard-codes the refusal, so the business model had to follow.

**M5. Competitors — who's in this space?**
Tap-time card-picker apps choose the best card at the register. Pointwise (YC W23) recommends which cards to get, comparing roughly 4,000 cards from a
daily-refreshed database. Kudos is the funded incumbent — an app and browser extension that picks the
card at checkout, $10.2M Series A in 2024 led by QED, reported 200,000 registered users and over
$200M of annualised checkout volume. Wallaby was the original "which card should I use" app and was
acquired by Bankrate in 2014 and folded into its card-distribution business.

**M6. So why won't they win?**
Because every one of them competes on the rewards side, where the money is in sending you to another
card. Kudos's distribution is checkout; Pointwise's product is card selection; Wallaby literally
became part of a card marketplace. None of them has a reason to tell you your card costs you money,
and the net is the thing that actually moved Jordan's number — $734.72 of interest against $104.14 of
routing.

**M7. What about CardStack?**
[UNVERIFIED] — we could not confirm an active product by that name in the card-optimizer space in
public sources, so we won't characterise it. Treat our competitive claims as: Kudos and Pointwise
verified from public reporting, Wallaby verified via the
2014 Bankrate acquisition, CardStack unverified.

**M8. What's the moat?**
Not the engine — a good engineer rebuilds it. The moat is the verified, sourced, dated terms
database with per-dollar provenance and the UNVERIFIED discipline, plus the positioning that lets us
say "cancel this" out loud. The first is an operations asset that compounds; the second is a
commitment competitors funded by card referrals can't copy.

**M9. Why wouldn't Kudos just add an interest model?**
They could add the arithmetic tomorrow; what they can't easily do is build a product whose headline
number is sometimes "your cards cost you $427, apply for nothing". That's a brand and revenue
decision, not an engineering one, and incumbents rarely take the revenue-negative version.

**M10. Why not just sell to banks from day one?**
That's probably the faster business, and it's the one we'd test first with a credit union: an honest
net view is a retention and trust product for an institution that doesn't live on interchange from
premium rewards. Consumer is the better place to prove the engine, because you need real transaction
breadth before an institution will take you seriously.

**M11. What would you need to raise?**
We'd rather name the milestones than a number. The first dollars go to the terms-refresh pipeline and
a Plaid production agreement, because those are what turn a correct engine into a product you can
point at a stranger's bank account. [VERIFY] on any funding figure.

**M12. Is there a B2B2C version?**
Yes, and it's the cleanest fit: a credit union embeds the receipt for its own members, we never touch
the PII, and the bank already has the transaction data and the APRs. The engine is pure and takes a
`Txn` list and a `Holding` list, so it can run inside their environment.

**M13. What's your go-to-market?**
The receipt is the hook — "what do your cards actually cost you" is a shareable number, which is why
we built a year-in-review view. Beyond that we'd be guessing, and guessing at CAC in a judging room
is how you lose credibility. [VERIFY].

**M14. How do you keep users once the one-time advice is taken?**
Because the routing advice renews every month and the catalog changes under them — terms get worse,
caps change, rotations move quarterly, perks go unused. The one-time wins get them in; the recurring
value is the monthly nudges and the next-card timing.

---

# 8. DATA & PRIVACY

**D1. Where do the card terms come from?**
From the issuers' own pages, read by hand: all 29 cards carry their source URLs and the date we read
them, 2026-10-17. Point valuations are The Points Guy's October 2026 numbers for the travel
valuation, and 1¢ for cash, and the catalog says which. Anything we couldn't confirm on an issuer
page is marked `unverified` with the specific fields named.

**D2. How do the terms stay fresh?**
Today they don't automatically — refresh is manual, and that's the honest limit. At scale you'd want
a scheduled re-crawl, a diff against the last snapshot, and a human review queue for any changed
term, with the checked date on screen so a user can see staleness. The data model already carries the
date and the source, so the pipeline has somewhere to write.

**D3. What are the 11 UNVERIFIED cards and why ship them?**
They're cards where at least one field couldn't be confirmed on an issuer page on 2026-10-17; the
catalog names the unverified fields and the secondary source we used. We ship them badged because a
visible caveat is more useful than a missing card, and the badge propagates: every receipt line
belonging to an unverified card inherits it. Jordan's wallet is fully verified, which is why the demo
runs on him.

**D4. What's the data model?**
Two types do the work. A `Txn` — date, merchant, amount, category, card used — and a `Holding` —
card id, revolving balance, APR, and the dollars of each credit actually used. Personas, CSV upload
and Plaid all produce that same pair, so the engine never knows or cares where the data came from.

**D5. And the card side of the model?**
A card has an issuer, annual fee, base multiplier, a purchase APR range, a point value in cents, a
list of earn rules, optional rotating bonus, and credits. An earn rule has a category from a
closed 20-term vocabulary, an optional merchant include list, an optional merchant exclude list, an
optional cap with amount and period, an after-cap multiplier, and an optional choice group for
pick-one cards. The closed vocabulary is what makes the mapping auditable.

**D6. How does the Plaid category mapping work?**
`data/category_map.json` maps Plaid's `personal_finance_category` — PFCv2, a superset of PFCv1, from
Plaid's published taxonomy CSV fetched 2026-10-17 — to our vocabulary. Precedence is merchant-name
override, then detailed category, then primary, then a fallback. Refunds, payments and transfers are
dropped before the engine runs.

**D7. Where is the mapping wrong?**
Predictably, on warehouse clubs and superstores: Costco and Walmart are excluded from many grocery
bonuses, and no category can tell a Target grocery run from a Target TV. A mapped category also isn't
the merchant category code the issuer actually pays on. Rows we can't resolve confidently come back
flagged rather than guessed.

**D8. How would you fix the mapping properly?**
A merchant-level table rather than a category-level one, built from the MCC the network reports where
we can get it, plus a user correction that applies everywhere once made — that feature is specced and
not built. Then measure it: a labelled sample of real merchant strings and a per-category accuracy
number we publish rather than claim. [VERIFY] — we have no accuracy number today, because we have no
real transaction data.

**D9. What PII do you handle?**
No card numbers, anywhere, ever. Transactions carry merchant, amount, date and category; holdings
carry a balance and an APR. Today there's no user database at all — the demo people are generated in
process and CSV upload is parsed in the browser.

**D10. Where does the Plaid access token live?**
In an httpOnly cookie, so it never reaches the client — a sandbox-grade shortcut we'd replace with
server-side session storage before touching a real account. The repo is public, so keys exist only in
the environment, and without them the routes return `503 plaid_not_configured`.

**D11. What would you store in production?**
As little as possible, and the shape is already narrow: the token server-side only, the derived
`Txn`/`Holding` pair, and the user's corrections. Everything we display is recomputable from those,
so there's no reason to keep a materialised copy of anyone's balances.

**D12. What would a bank require before letting you near real accounts?**
A Plaid production agreement rather than sandbox, server-side token storage with encryption at rest,
auditable access logging, a data retention and deletion policy, and a security review. On the data
side: a documented terms-refresh process with provenance, because a bank's compliance team will ask
where the 26.24% came from. We'd also expect to drop the average-daily-balance approximation.

**D13. GDPR / CCPA?**
The honest answer is we haven't done that work — it's a hackathon prototype with no user accounts, so
there's nothing to delete yet. The design helps: everything derives from the `Txn`/`Holding` pair, so
deletion is one row set, and we show no data we can't trace. [VERIFY] on any compliance claim.

**D14. How do you know the engine agrees with your own data?**
Tests, including that every card in the catalog has a source URL and a checked date to click through
to, that the UNVERIFIED set is exactly the cards the catalog flags along with their rules and
credits, and that each persona's receipt provenance reconciles with the computed receipt to the cent.
Those are three of the 36.

**D15. Can a user correct a miscategorised merchant?**
Not yet — it's specced and it was the first thing we cut, because without real data there was nothing
to correct. It's the highest-value data feature we know of, because one correction per merchant per
user compounds into a merchant table.

**D16. What's the provenance record actually contain?**
For a reward: the purchase, the card, the rule label, the arithmetic as a readable string
(`$84.20 x 3x x 2.05¢/point = $5.18`), the issuer source URLs, the checked date, and whether the card
is unverified. There are four kinds of line — reward, fee, credit, interest — and the interest one
says whether the APR came from the user's account or from the catalog.

---

# 9. SCALE & ENGINEERING

**SC1. Does it scale?**
The engine is pure and stateless and runs a year of one person's transactions in milliseconds — 1,000
full-engine simulated years in 19-313 ms, which bounds the single-year cost at well under a
millisecond. Per-user compute isn't the problem; the data operations are.

**SC2. What's the slowest thing?**
The Monte Carlo, and only because it's 1,000 replays — 19-313 ms depending on the wallet, which is
still inside a single interaction. The LP is the other heavy path, which is why it's a verification
tool rather than a per-request one and why we prune dominated options before building the model.

**SC3. What breaks at 10,000 users?**
Nothing in the math. What breaks is the terms catalog: 29 cards refreshed by hand doesn't survive
contact with 10,000 users who hold cards we don't have, so the crawl-and-review pipeline becomes the
critical path. Second is category accuracy on real merchant strings, which needs the correction
loop and a labelled sample.

**SC4. Where would you run the engine?**
It's pure TypeScript with no I/O, so it runs anywhere — in a serverless function today, and it could
run client-side or inside a bank's own environment unchanged. That portability is deliberate: the
B2B2C version needs the engine to go to the data rather than the data to us.

**SC5. Latency budget for a real user?**
Transactions in from Plaid is the only slow step and it's the provider's; everything after it is
milliseconds, with the Monte Carlo as the one tens-of-milliseconds component. Caching is trivial
because the whole thing is deterministic: same inputs, same output, so a result is cacheable until
new transactions arrive.

**SC6. What does it cost to run per user?**
Dominated by the data provider, not compute — the engine is a fraction of a cent of CPU per user per
refresh. [VERIFY] on Plaid's per-user pricing; we've only used the sandbox, so quoting a number would
be inventing one.

**SC7. Real transaction data versus synthetic — what actually changes?**
Three things: merchant strings get messy, categories get wrong in the ways we've described, and
balances and APRs come from the liabilities endpoint rather than being declared. The engine's input
shape doesn't change at all, which is why we think the synthetic year is a fair stand-in for
*correctness* even though it can't stand in for *accuracy*.

**SC8. How do you know the live site works?**
`npm run smoke` runs 15 checks against the deployed URL and currently passes 15/15, on top of 36 unit
tests. There's also a `/api/health` route. We ran the smoke suite against production, not localhost,
because the thing judges see is production.

**SC9. What's your test strategy?**
Three layers: five purchases computed by hand from published issuer terms with the arithmetic written
in the comments; a cap case where a cap is crossed mid-purchase, checking the blended rate; and
whole-persona reconciliation — each persona's provenance has to add back up to its receipt to the
cent. Plus determinism assertions on the Monte Carlo, so a silent numeric regression fails the build.

**SC10. How would you handle a user with ten cards and 5,000 transactions?**
Greedy is linear in purchases times eligible cards, so that's still milliseconds. The LP is the part
that grows, which is the production design we'd ship: run greedy always, detect binding cap pools,
and run the LP only for the wallets where the bound doesn't match. [VERIFY] exact solve times at that
size — we haven't measured it.

**SC11. What's the stack and why?**
Next.js App Router with TypeScript, Tailwind and shadcn/ui, framer-motion for the animated views,
d3-hierarchy for the treemap, `javascript-lp-solver` for the MILP, Plaid for bank data, deployed on
Vercel. The choice that matters is that the engine is plain TypeScript with no framework or network
dependency — it's the part that has to be portable and testable.

**SC12. What's the worst piece of code in there?**
The tap screen's cap reconstruction replays the period's history to work out cap usage, and it does
that replay twice in slightly different ways — it's correct but it's the thing we'd rewrite first.
Beyond that, the Monte Carlo deliberately re-implements best-play routing over precomputed tables for
speed, which is duplication defended only by a cent-exact cross-check against the main simulator.

---

# 10. AI SPECIFICALLY

**AI1. Where is the AI?**
In how the product was built, not in what it computes. There is no model in the number path at all —
every figure comes from the rules engine applied to published terms, and you can unplug the network
and every number still renders. The intended production role for a model is narrow: cleaning messy
merchant strings and handling category fallback where the mapping is uncertain.

**AI2. So why isn't the model doing the math?**
Because a hallucinated dollar figure in a finance tool is worse than no tool. An LLM asked to compute
$84.20 x 3x x 2.05¢ will usually get it right and occasionally won't, and there's no way for the user
to tell which one they're looking at. Deterministic code plus a source link is auditable; a confident
paragraph isn't.

**AI3. Then what's innovative about it?**
The cost model and the cap-aware optimisation over a real year, with odds attached — none of which a
general assistant can do, because it doesn't have your transactions, the cap state, or a dated terms
database it can cite. The architectural claim is the interesting part: the right use of a model here
is the data-cleaning edge, not the reasoning core.

**AI4. Where *would* you use a model?**
Merchant normalisation ("SQ *SWEETGREEN 4412" to Sweetgreen), category fallback for rows the
deterministic mapping can't resolve, parsing unfamiliar statement CSV layouts, and writing the
explanation sentence around numbers the engine has already computed. In every one of those the model
produces a *label* or *prose*, never a figure.

**AI5. How would you evaluate the model's part?**
As a classification problem, not a generation one: a labelled sample of real merchant strings, a
per-category accuracy number, and a confidence threshold below which we flag the row instead of
guessing. The same discipline we already use — flagged rather than guessed — just with a model as one
more fallible source. We have no accuracy number today because we have no real merchant data.
[VERIFY].

**AI6. What's your hallucination risk today?**
Zero in the numbers, by construction — there's no model in that path. The residual risk is in
anything *written*: a prose claim that drifts from what the engine computed. We handle that by making
the numbers the source of truth in the UI and pinning every one of them to a rule and a source.

**AI7. Judges will say "everyone claims deterministic". Prove it.**
Three ways, live: `npm test` runs 36 tests including hand-computed purchases; every dollar on screen
opens to its rule, arithmetic string, issuer URL and checked date; and the Monte Carlo is seeded, so
the same inputs give the same odds every reload and the tests assert it. There is no API key for a
model in the deployment.

**AI8. Isn't "no AI" a weak answer at an AI-judged hackathon?**
It's a position, and it's the one a finance tool has to take. The interesting engineering here is a
cap-aware MILP and a method-correct Monte Carlo, and we'd rather be judged on those than on a
chatbot wrapper. We're explicit about where a model belongs, which is a stronger answer than
sprinkling one into the math.

**AI9. Why not "chat with your money"?**
Because the question a user actually has — "which card do I use, which do I cancel" — has one correct
answer that can be computed and sourced, and a chat interface makes it harder to find, not easier.
Also ChatGPT already ships finance features; competing on conversation is competing where we lose.

**AI10. Did AI write the code?**
Yes, a lot of it — we used Claude Code heavily and we'll say so plainly. What we did was specify the
engine semantics, build the hand-computed test cases that the generated code had to satisfy, and
reject the convenient-but-wrong versions. The clearest example is the Monte Carlo: resampling monthly
totals is the easy thing to write, and it's wrong, and we measured that it's wrong by 9.7% on the
persona whose cap binds.

---

# 11. DESIGN & UX

**U1. Why this layout?**
It's a sequence, not a dashboard: where your money went, what your cards cost, the misses, the
replay, what to do next. Each screen asks one question and answers it, because the user's problem
isn't a lack of charts — it's that nobody ever gave them the net in one number.

**U2. Why five demo people?**
Because one persona lets you tune the product to flatter itself. Jordan loses money, Maya is the
valuation-sensitive case, the Parks are a family with two cards and a lot left on the table, Sam is
already optimal and has $0.00 to gain, and Rosa has irregular income with a 10.4x month-to-month
swing. Sam exists specifically so the tool can tell someone there's nothing to fix.

**U3. Why a presenter mode?**
Because a four-minute demo with a hostile clock is its own failure mode. Press P and the arrow keys
walk the demo path section by section with a 4:00 timer and a speaker cue per step, so the screen
always does what the sentence says. It also means a judge can drive the demo themselves.

**U4. Accessibility?**
Keyboard navigation through the presenter path, ARIA labels on the interactive and chart elements,
and `prefers-reduced-motion` honoured so the animated views degrade rather than assault anyone. It's
not an audited product and we won't claim WCAG conformance — [VERIFY] on any conformance level — but
contrast, focus and reduced motion were built in, not retrofitted.

**U5. Does it work on a phone?**
Yes, and the tap screen is specifically designed for it, because "which card do I use" is a question
you ask standing at a register. The rest of the site is responsive down to phone width.

**U6. Why a web app and not a native app?**
Because the hard part of this product is the cost model, and we had a weekend. A web app let us ship
the engine, the LP, the Monte Carlo, the provenance and a working deployment — and a native app
without those is a prettier shell around nothing. The native version is a real requirement for
tap-time selection, and it's an integration problem on top of logic that already works.

**U7. Why does the receipt look like a paper receipt?**
Because it sets the right expectation: a receipt is a list of charges you can check, not a score. The
four lines plus a net, in that order, is the whole argument, and every line is tappable down to its
source.

**U8. How does a user know what they can trust?**
The UNVERIFIED badge on any card whose terms we couldn't fully confirm, the checked date, and the
click-through from every dollar to its rule and the issuer page. We'd rather show a visible caveat
than a clean screen that's quietly wrong.

**U9. What's the hardest thing to communicate visually?**
Odds. "Blue Cash Preferred wins in 100% of simulated years" reads as a bug, so the fan chart shows
the cumulative net bands and we lead with the dollar difference and treat the percentage as support.
Uncertainty is genuinely hard to draw without either overselling or confusing.

**U10. Is there onboarding?**
Not really — you land on a person and the first screen is their money. That's deliberate for a demo,
and for a real user the equivalent first step is connecting an account, which is one screen. We'd
rather the first thing you see be your own number than a tour.

**U11. What would you change about the UX first?**
Make the two Maya headlines impossible to confuse — a persistent valuation toggle with the mode in
the headline, since $463.32 and $944.19 are both correct and the difference is a setting. Same class
of fix for the per-card versus wallet-level card value.

**U12. Who designed it?**
Adrian owns the UI, branding, logo, theme and every screen component; Michael owns the engine, data,
API routes, tests and deploy. We split on a file boundary from the start, which is why we could both
ship all weekend without blocking each other.

---

# 12. HONESTY / REAL vs SIMULATED

**HO1. What's real and what's simulated?**
**Real:** the rules engine, the 29-card catalog with sources and checked dates, the Monte Carlo, the
LP, provenance, 36 tests, statement CSV upload, the Plaid integration code, and every number those
produce. **Simulated:** the five demo people and their transactions are synthetic; tap is a web demo,
not NFC; Plaid runs against the sandbox and this deployment has no keys, so those routes return `503
plaid_not_configured`.

**HO2. So all your data is fake.**
The *people* are synthetic and labelled as such on screen. The card terms are real, read from issuer
pages and dated. The engine, the LP, the Monte Carlo and the provenance are real and tested. The
synthetic year is the single component a real Plaid pull replaces, because personas, CSV upload and
Plaid all emit the same `Txn`/`Holding` pair.

**HO3. Why synthetic rather than your own statements?**
Two reasons, and the second is the real one: our own spending wouldn't contain the cases we needed to
test — a fee card with partially-used credits, a revolving balance at a known APR, irregular income —
and a public repo is not where anyone's statements belong. The generator is seeded, so the year is
reproducible and reviewable.

**HO4. How do I know the personas aren't tuned to make the product look good?**
Look at Sam: one card, pays in full, $0.00 left on the table, and the product's answer is "nothing to
fix". And at Jordan, the headline persona, who comes out at -$427.03 — we lead with our own worst
number. If we were tuning for a demo we wouldn't have built the case where the tool has nothing to
sell.

**HO5. What's missing before this is production?**
Live Plaid with a production agreement and server-side token storage; an automatic terms-refresh
pipeline with diffing and review; real average-daily-balance interest; the merchant correction loop
and a measured category accuracy; and a security review. The engine is the part we'd change least.

**HO6. What's your biggest weakness, honestly?**
That we have no real transaction data, so we can demonstrate correctness but not accuracy. The engine
is provably right about the rules it's given and the categories it's handed; whether real merchant
strings land in the right category is unmeasured, and we won't pretend otherwise.

**HO7. Is anything on screen a number you can't source?**
Not in the receipt, the replay, the keep-or-cancel view or the Monte Carlo — those all trace to rules
and transactions. If you find one that doesn't open to a source, that's a bug and we want to know
which screen.

**HO8. Did you start building before the hackathon?**
We'd rather state it than be asked: [VERIFY — confirm against the repo's commit history before
answering, and answer exactly what it shows]. The rules are explicit that the repo should reflect
work done during the event, so the right move is to state what was pre-existing, if anything, in the
README and the submission rather than let a judge discover it.

**HO9. What are you *not* claiming?**
A market size, a per-user cost, a category accuracy number, WCAG conformance, an LP gap on any
persona, and an exact-amortisation interest figure. Each of those is marked `[VERIFY]` in our own
prep sheet, which is the discipline we'd want from a tool handling our money.

**HO10. What's the one slide you'd insist on?**
Real / simulated / next, because the rubric scores exactly that and because it's the slide that makes
every other number believable. A team that volunteers its limits gets asked easier questions.

---

# 13. CURVEBALLS

**C1. What would you do with another week?**
Live Plaid with real transactions and the liabilities endpoint for true APRs and balances; the
merchant correction loop; and an automated terms-refresh with diffing. In that order, because all
three are about turning a correct engine into an accurate one.

**C2. What did you cut, and why?**
Merchant correction, the shareable year-in-review, and the brand pass in places — all UI-side value
that doesn't change whether the numbers are right. We had a written cut order before we were behind,
and we protected the receipt, purchase history, replay, tap with the balance rule, keep-or-cancel, the
apply planner and click-to-source.

**C3. What's the bug you know about?**
Our own docs are out of sync with the code in three places and we'd rather flag them than be caught:
the README and the old Q&A sheet say 35 tests when it's 36; the spec's feature table still promises
"LP beats greedy by $X on Jordan's year", which does not exist and which the spec's own status note
corrects to $0.00; and the README's real/simulated section says three demo people when there are
five. Also the tap screen reconstructs cap usage with a redundant double replay — correct, but ugly.

**C4. What did you get wrong and fix?**
The Monte Carlo. The first version resampled monthly reward totals, which is invalid once a cap binds
because a month's total is only valid under the cap usage it was computed with. We measured the
error — identical on two personas, 9.7% optimistic on the one whose card binds — and rewrote it to
replay the full engine over every simulated year, at 19-313 ms for 1,000 years.

**C5. What did you believe going in that turned out to be false?**
That the routing gap would be the story. We expected the LP to beat greedy and it doesn't — $0.00 on
all three wallets — and we expected mis-routing to be the big number, and it's $104.14 against
$734.72 of interest. The product got better when we followed the data instead of the pitch.

**C6. If I gave you $100k, what would you do?**
Buy the two things that aren't code: a Plaid production agreement with the security work it requires,
and the terms-refresh pipeline with a human review queue. Then put real transaction data through the
engine and publish a category-accuracy number, because that's the claim we currently can't make.

**C7. Why should you win?**
Because we built the honest version. The engine is deterministic and tested, the hard parts — a
cap-aware MILP and a method-correct Monte Carlo — are real and we can derive them on a whiteboard, and
when the results disagreed with our pitch we changed the pitch: the LP gap is $0.00 and we say so.
And the product's headline number is the one nobody else will show you.

**C8. What's the most interesting technical decision in there?**
Reporting the LP's objective as a *bound* rather than a result. The cap rows let the optimizer choose
how a pool's dollars split between purchases, while reality fills pools in date order — so we replay
the chosen assignment through the engine's own evaluator and only claim optimality when the replay
equals the bound. It's the difference between a solver that looks good and a number you can act on.

**C9. If this doesn't work, why?**
Data operations, not math. If keeping terms current across hundreds of cards, and getting real
merchant strings into the right categories, turns out to be more expensive than the value we create
per user, the model doesn't close — and that's a cost we can't yet price because we've never run real
data.

**C10. What's the dumbest thing you shipped?**
Five personas when three would have demoed fine. Sam and Rosa cost us hours and neither is in the
four-minute path — and they're the two that made the product honest, because Sam is the case with
nothing to sell and Rosa is the irregular-income case the Finance track explicitly asks about.

**C11. Who's your first user?**
Someone 22 to 28 with two or three cards, one of them with a fee and one of them revolving — Jordan,
built from that shape. They're the group most sold on rewards and least shown interest, and they're
also the ones for whom a one-time decision changes hundreds of dollars.

**C12. What question were you hoping we'd ask?**
Why the Monte Carlo re-simulates instead of resampling totals, because the answer is a real
methodological trap with a measured error: 9.7% optimistic on the persona whose cap binds, and
identical on the two where no cap binds. It's the clearest evidence that we understood the problem
rather than reached for the library.

**C13. One sentence: why does Monte exist?**
Because every tool in this category is paid to tell you to get another card, and somebody has to be
able to tell you your cards cost you $427.

---

# 14. TEAM / PROCESS

**T1. How did you build this that fast?**
A written spec with owners, statuses and a cut order before we wrote code, and a file-level ownership
split: Adrian on UI, branding and every screen; Michael on the engine, data, API routes, tests and
deploy. We touched almost no shared files, so neither of us was ever blocked, and `npm run check`
gated every push to main.

**T2. Who did what?**
Michael: `lib/engine/` — the rules engine, the MILP, the Monte Carlo, provenance — plus the card
catalog, the Plaid routes, the tests, the scripts and the deployment. Adrian: the whole UI, the
brand, the logo and theme, and every screen including the treemap, the replay, the fan chart and the
presenter mode.

**T3. What did AI write?**
A lot of the code — we used Claude Code throughout and we're not going to be coy about it. Our
contribution was the specification, the semantics of the rules, the hand-computed test cases the code
had to satisfy, and catching the generated version that was convenient and wrong. The Monte Carlo
rewrite is the example: a model writes the easy resampling first, and we had to know it was invalid.

**T4. How did you decide what to build?**
The rubric and the track prompt, read literally. 75% of the score is problem/user, technical
execution and UX, so we named one user and one decision; the Finance prompt asks to make fees and
tradeoffs comparable, which is the whole product; and the demo criterion explicitly scores separating
real from simulated, so that's a slide and a section of the site.

**T5. What was the hardest part?**
Cap semantics. Getting shared pools right — Citi Custom Cash's single $500 a cycle versus Blue Cash
Everyday's three separate $6,000 caps that look identical — is the kind of detail that silently
inflates every number downstream. We ended up with one exported function that computes the pool key,
used by both greedy and the LP, so they can't drift apart.

**T6. How did you divide the risk?**
By making the engine independently verifiable. Every headline number has a script that prints its own
workings, so the UI could change all weekend without anyone wondering whether the figures still held.
That's also why 36 tests exist at a hackathon.

**T7. What would you do differently?**
Write the data-freshness pipeline before the fifth persona. We spent time broadening the demo and not
enough on the thing that actually limits the product, and the cut order should have reflected that.

**T8. How do you handle a disagreement?**
The spec is the arbiter, and when the spec turned out to be wrong we corrected the spec in writing —
the status note that replaces "LP beats greedy by $X" with "$0.00, and here's the hand-built cap trap
instead" is in the repo. It's less satisfying than being right and it's the reason our numbers hold
up.

**T9. Did you compete in one track?**
Finance, and only Finance. We registered as Social Cause and switched before judging, with the change
told to an organizer.

**T10. What did you learn?**
That the honest number is usually the more interesting one. Every time we removed an assumption — the
invented drift parameter, the resampled totals, the fabricated LP gap — the product got more
defensible and the story got better, which is not what we expected going in.

---

## Fallback lines

- **Don't know:** "We don't know. Here's how we'd check it — " and name the file or script.
- **Asked for a number we don't have:** "I won't guess at that one. What I can tell you is — " and
  go to a verified number next door.
- **Caught in an error:** "You're right, that's wrong." Correct it, say which number is right, move
  on. Every number here has a script behind it; if a judge doubts one, run it in front of them.
- **Running out of time:** "The short version is: your cards cost Jordan $427 last year and no other
  tool would have told him. Everything else is how we prove it."
