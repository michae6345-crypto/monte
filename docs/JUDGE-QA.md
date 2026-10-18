# Judge Q&A

Answers to the questions we expect. Rule for the room: whoever owns the area answers in
two sentences, then stops. If we don't know, say so and say what we'd do to find out.

Every number below is reproducible on stage:

```bash
npm test                                                    # 36 tests
node --import ./scripts/_alias.mjs scripts/jordan-check.ts  # the −$427.03 receipt
node --import ./scripts/_alias.mjs scripts/lp-vs-greedy.ts  # LP vs greedy
node --import ./scripts/_alias.mjs scripts/mc.ts            # Monte Carlo odds
```

---

## Kaushal Patel (OpenAI) — where the model stops and code starts

**Does a model compute any number on screen?**
No. There is no model in the math path at all. Every figure comes from the rules engine in
`lib/engine/`, applied to published card terms in `data/cards.json`. You can unplug the
network and every number still renders.

**So where is the AI?**
In how the product was built, not in what it computes. That was deliberate: a hallucinated
dollar figure in a finance tool is worse than no tool.

**How do you know the engine is right?**
36 tests, including five purchases computed by hand from the issuer's published terms with
the arithmetic written in the comments, plus a cap case where a spending cap is crossed
mid-purchase and we check the blended rate. Run `npm test`.

**What happens when it's wrong?**
Two guards. Any card whose terms we could not fully verify is badged `UNVERIFIED` in the
UI — 11 of our 29. And every dollar clicks through to the rule and the issuer page behind
it, so a user can check us rather than trust us.

---

## Franck Leveneur (Data-Sleek) — the data model and sourcing

**Where do the card terms come from and how do they stay fresh?**
Each of the 29 cards carries its issuer source URL and the date we checked it (all
2026-10-17). Today refreshing is manual, and that's the honest limit: at scale you'd want a
scheduled re-crawl with a diff against the last snapshot and a human review queue for
changed terms.

**How does Plaid category mapping work, and where is it wrong?**
`data/category_map.json` maps Plaid's `personal_finance_category` to ours, with
merchant-name overrides taking priority, then detailed, then primary, then a fallback.
Refunds, payments and transfers are dropped. Where it's wrong is predictable: warehouse
clubs and superstores. Costco and Walmart are excluded from many grocery bonuses, and a
Plaid category alone can't tell a Target grocery run from a Target TV. Rows we can't
resolve confidently come back flagged rather than guessed.

**PII?**
No card numbers anywhere. The Plaid access token lives in an httpOnly cookie and never
reaches the client — a sandbox-grade shortcut we'd replace with server-side session storage
before touching real accounts. The repo is public, so keys exist only in the environment.

**What's the data model?**
Two types do the work: a `Txn` (date, merchant, amount, category, card used) and a
`Holding` (card, revolving balance, APR). Personas, CSV upload and Plaid all produce that
same pair, so the engine never knows or cares where the data came from.

---

## Saty Raghavachary (USC) — explain how it works

**Why is this a linear program and not just greedy?**
Greedy routes purchases in date order, so an early cheap purchase can burn a spending cap
that a later, larger purchase needed. The LP assigns the whole year at once: a binary for
which card and rule each purchase uses, a continuous variable for the dollars falling
inside each cap, and one constraint per cap pool per period.

**Then what does the LP actually buy you here?**
Honestly, on our three demo wallets: nothing. The gap is **$0.00** — greedy is already
optimal, and the LP is how we *know*, because it returns a matching upper bound rather than
just agreeing. Where it matters is when a cap binds, so we built the smallest case that
proves it: Citi Custom Cash plus Double Cash, $400 of dining on 3 March then $500 on
20 March. Greedy earns $30.00, optimal is $33.00. We have not put a fabricated gap on a
slide.

**Why is your Monte Carlo method the right one?**
We resample 12 of the person's own months with replacement, then re-date them into one
synthetic year and replay the full engine over it, so caps, quarters and rotations
re-accumulate from zero in every simulated year. The tempting shortcut — scoring the real
year once and resampling the monthly totals — is wrong whenever a cap binds, because a
month's reward total is only valid under the cap usage it was computed with. We measured
it: identical on two personas, and **9.7% optimistic** on the third, the one whose card
binds. Correct costs 19–313 ms for 1,000 years, so there was no reason to approximate.

**Why do the odds say 100%?**
Because it's a paired comparison. Every wallet is scored on the same drawn year — the same
purchases, the same timing — so the only difference is routing. If a card is better for how
you actually spend, it's better in essentially every year we can draw. The spread in the
fan chart is real uncertainty about *which* months you get; it moves both wallets together.
We deliberately don't add a year-over-year spending drift parameter, because one year of
statements gives us no way to estimate it — inventing one would widen the fan with our
assumption instead of your data. The knob exists and is off.

**Is it deterministic?**
Yes, seeded. Same input, same numbers, every reload. The tests assert it.

---

## Chris Lin (Cylier) — do the numbers hold up, who pays, does it scale

**Where does the interest number come from?**
Balance × APR. Jordan: $2,800 × 26.24% = $734.72, with the APR taken from his own card
rather than the catalog's maximum. It's a yearly approximation, not an average-daily-balance
amortisation, and we'd say so to a user — the conclusion doesn't move, because the interest
is larger than every reward he earned.

**Why does Jordan come out negative?**
Rewards $552.69 + perks used $80.00 − annual fees $325.00 − interest $734.72 = **−$427.03**.
He earned $552.69 and paid $734.72 in interest. The rewards were never the problem.

**Who pays for this?**
Not the user, and deliberately not card issuers per approved application — that's the
conflict of interest that makes every competitor push you toward another card. Monte refuses
to recommend a card while you carry a balance, which is the opposite of an affiliate
business. The defensible model is a subscription, or a bank or credit union licensing it for
their own customers.

**Does it scale on real Plaid data?**
The engine is pure and runs on a year of transactions in milliseconds, so compute isn't the
problem. The hard parts are category accuracy on real merchant strings and keeping 29 cards'
terms current — both are data operations problems, not engineering ones.

---

## Anyone — real vs simulated

**Real:** the rules engine, the 29-card catalog with sources and dates, the Monte Carlo, the
LP, provenance, 36 tests, statement CSV upload, and the Plaid integration code.

**Simulated:** Jordan, Maya, the Parks, Sam and Rosa are synthetic demo people. Tap is a web demo, not
NFC. Plaid runs against the sandbox, and this deployment has no Plaid keys, so those routes
return `503 plaid_not_configured` and the app stays on its demo people.

**Next:** live Plaid, automatic freshness checks on card terms, and the merchant category
edge cases above.

---

## If we're asked something we don't know

Say "we don't know" and then say what we'd check. Every number here has a script behind it;
if a judge doubts one, run it in front of them.
