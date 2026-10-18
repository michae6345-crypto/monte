# Monte

**Every card, played right, and what your cards really cost you.**

Built at ACM@USC TrojanHacks 2026 (Finance vertical) by Adrian Erlikhman and Michael
Tarekegn, with Claude Code. Inspired by Uno Wallet (YC Spring 2026), which picks the best
card at tap time. Monte adds the cost side: rewards and perks you actually use, minus
annual fees and interest, from your real spending, with Monte Carlo odds on what to do
next.

- **Your money:** where it goes, top merchants, what keeps charging you
- **The Receipt:** what your cards earned and cost you last year
- **Purchases:** every purchase with the card you used and the card Monte would pick
- **Replay:** the same year on the best card in your wallet
- **Tap:** the best card at a merchant right now, never one carrying a balance
- **Keep or cancel / What to apply for:** each card's real value, signup-bonus planner

The engine is deterministic: published card terms (sourced and dated in `data/cards.json`)
plus a cap-aware optimizer. AI never does the math. Full feature list and owners:
`docs/SPEC.md`. Rules and rubric: `docs/HACKATHON.md`.

## Run

```bash
npm install
npm run dev
```

## Real vs simulated

Real: card terms and sources, the rewards engine, statement upload. Plaid sandbox is in progress.
Simulated: the demo people and their transactions are synthetic; Tap is a web demo, not NFC.
