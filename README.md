# Ace

**The right card every time, and the truth about what your cards cost you.**

Built at ACM@USC TrojanHacks 2026 (Finance vertical) by Adrian Erlikhman and Michael
Tarekegn, with Claude Code. Inspired by Uno Wallet (YC Spring 2026), which picks the best
card at tap time. Ace adds the net cost: rewards and credits used, minus annual fees,
interest and other fees, from your real spending.

- **The Receipt:** what your cards earned and cost you last year, line by line
- **Replay:** a year of purchases re-routed to the best card in your wallet: money left on the table
- **Tap:** the best card for this merchant right now, with caps, credits, and never a card carrying a balance
- **Keep or cancel:** each card's fee against the value it adds over your next-best card
- **What if:** drag any card into your wallet and see your net change

The engine is deterministic: published card terms (sourced and dated in `data/cards.json`)
plus a cap-aware optimizer. AI only cleans merchant names.

See `docs/` for the spec, demo path and build plan.

## Run

```bash
npm install
npm run dev
```

## Real vs simulated

Real: card terms and sources, the rewards engine and optimizer, Plaid sandbox. Simulated:
the demo user "Jordan" and his transactions are synthetic; Tap is a web demo, not NFC.
