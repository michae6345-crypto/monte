# Monte: Devpost submission

## Inspiration

Rewards apps show you points. They do not show you what the cards cost. We built a test
person, Jordan, 24, first job in LA, three cards and a $2,800 balance. Last year he earned
$552.69 in rewards and $80.00 in perks. He also paid $325.00 in annual fees and $734.72 in
interest. Net, his cards cost him $427.03. Every app he uses would have congratulated him
on his points. We wanted a tool that tells the truth about the net, and then tells you what
to do about it.

## What it does

Monte reads a year of your purchases and works out what your credit cards really did for you: rewards plus the perks you used, minus annual fees, minus interest, card by card. Then it replays the same year with every purchase on the best card you already hold (for Jordan, $104.14 left on the table across 576 purchases), tells you which card to tap at a given merchant right now, whether each card earns its fee, and what to apply for next with odds from 1,000 simulated years. It never routes a purchase to a card carrying a balance, and every dollar on screen links back to the issuer's published rule and the date we checked it.

## How we built it

The core is a deterministic rules engine in TypeScript. A catalog of 29 cards holds every
earn rule, cap, shared cap pool, pick-one category, quarterly rotation, credit and fee,
each with its source URL. `evaluate()` scores one purchase on one card given how much of
each cap is already spent, with a blended rate when a purchase crosses a cap boundary.
`simulate()` plays a year through a wallet and `receipt()` turns it into the net.

Three things sit on top of that one engine:

- A Monte Carlo that draws 12 of your own months with replacement to build a year, then
  runs the full engine on that year for every wallet option. 1,000 years take about 58 ms.
- An LP (mixed-integer, via javascript-lp-solver) that assigns the whole year at once to
  check whether the greedy routing was optimal.
- A provenance layer that traces every receipt line to its rule, source and purchases.

For the register moment we split the work. A one-time sync walks your history and stores
how much of each cap pool is used in a Supabase `cap_state` table. A tap then reads those
counters and ranks the wallet without touching history. Routing a whole year takes about
1 ms; a tap that replays history takes about 2.9 ms and grows with it; the cached tap does
not grow. The front end is Next.js, with Plaid (sandbox) or a CSV upload parsed in the
browser.

## Challenges we ran into

Caps were the hard part. Citi Custom Cash shares one $500 cap across categories per
billing cycle, BofA Customized Cash shares $2,500 per quarter, and Blue Cash Everyday has a
separate $6,000 per category per year. Getting the pool keys right, and making the engine,
the LP and the Monte Carlo all use the same keys, took several passes.

Caps also broke our first Monte Carlo. Resampling monthly reward totals is quick, but a
capped card's month is worth less once earlier months have used the cap, so that method
overstates capped cards. We switched to replaying the engine on every simulated year and
wrote a script that measures the difference.

Greedy routing can waste a cap on an early small purchase. We needed to know whether that
was costing anyone money, which is why the LP exists.

## Accomplishments that we're proud of

- The LP proves greedy optimal on all three test wallets (gap $0.00), and on a constructed
  cap-trap case it finds $33.00 where greedy gets $30.00. We report both an upper bound and
  a replayed plan, so "optimal" is a checked claim.
- The cached tap gives the same answer as a full history replay, because the cache is
  built by the same `evaluate()` and keyed by the same cap pools.
- 36 tests over the engine and provenance, and a script that checks the fast Monte Carlo
  path matches `simulate()` to the cent.
- No AI model in the pricing path. A model is only used to clean up merchant names.
- All 29 cards have sources checked on 2026-10-17, and the 11 we could not fully confirm
  are marked UNVERIFIED in the UI.

## What we learned

Interest outweighs rewards for anyone carrying a balance, and almost no tool says so. On
the technical side: when a system has non-linear limits like caps, you have to simulate the
system, not the totals it produced. And a cheap greedy is fine as long as you have a way to
prove it.

## What's next

- Finish merchant-name cleanup so more purchases land in the right category.
- Confirm the 11 unverified cards and add published rotating lineups for other quarters.
- Production Plaid, and a background job that updates `cap_state` as new purchases post.
- Payoff planning: which balance to pay first, and when it is safe to open a new card.

## Built with

TypeScript, Next.js, React, Supabase (Postgres with row-level security), Plaid,
javascript-lp-solver, D3 (d3-sankey), Tailwind CSS, shadcn/ui, framer-motion. Deployed on Vercel.
