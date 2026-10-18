# Monte: every card played right, and what your cards really cost

TrojanHacks 2026 · Finance vertical · Team 1 (Adrian Erlikhman, Michael Tarekegn).
Copies Uno Wallet (YC Spring 2026) and adds the true net cost of each card, with Monte
Carlo odds. (The code still says `ace` in folder and component names; that is fine.)

## Scope
`docs/SPEC.md` is the feature list with owners, status, timeline, cut order and demo path.
`docs/HACKATHON.md` is the rulebook and rubric. Anything not on the demo path is out of
scope until it's done.

## Stack
Next.js (App Router) + TypeScript, Tailwind v4 + shadcn/ui, framer-motion, d3-sankey,
javascript-lp-solver, Plaid (sandbox only). Deployed on Vercel. Before using a Next.js
API you haven't used this session, check the current docs: versions are in package.json.

## Commands
- `npm run dev`: local dev on :3000
- `npm run check`: typecheck + lint + build. Run it before every push to main.

## Rules
- The engine is deterministic: the AI never does the math. Every dollar shown must trace
  to a card rule in `data/cards.json` (with its source URL and checked date) and to the
  transactions behind it.
- Never recommend a card that carries a balance.
- No real card numbers or credentials anywhere. Plaid keys live in `.env.local` and
  Vercel env vars only; the repo is public.
- Small commits; never push a failing `npm run check` to main.

## Ownership
- Production and backend (Michael): `lib/engine/`, `lib/data/`, `app/api/`, `scripts/`,
  Plaid, the LP optimizer, Monte Carlo engine, tests, env and deploy settings
- UI and branding (Adrian): `app/page.tsx`, `app/layout.tsx`, `app/globals.css`,
  `components/`, the logo, theme and fonts
- Shared, ask first: `lib/contract.ts`, `package.json`, `data/`
