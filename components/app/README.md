# components/app

The app at `/app` (`app/app/page.tsx`): what you open at the register. Phone first, no account;
everything is saved in this browser.

| File | What it does |
|---|---|
| `app.tsx` | The shell: header, the four tabs (Pay, Cards, Year, Connect), first-run screen, `/app#tab` links |
| `use-wallet.ts` | The saved wallet (cards, and a year of purchases once connected) in localStorage, via `useSyncExternalStore` |
| `pay.tsx` | Where you are (search, Near me, or a category) and roughly how much -> the card, why, every card's net, perks first |
| `cards.tsx` | The wallet: best categories per card, balances and APRs (editable), what to pay down first, keep or cancel on your year |
| `year.tsx` | The receipt on your own year: net, each card, biggest misses, recurring charges |
| `connect.tsx` | Plaid Link (and the sandbox test bank), a statement CSV, the demo people, the extension, and "forget everything" |

The math is all `lib/engine` (`choose()` in `interest.ts`); stores and perks are `lib/merchants.ts`
and `lib/perks.ts`; the Plaid client is `lib/data/plaid-link.ts`.
