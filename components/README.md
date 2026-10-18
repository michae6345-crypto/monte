# components

UI only. Numbers come from `lib/engine`; nothing here computes a dollar.

| Folder | What's in it |
|---|---|
| `ace/` | The product sections: receipt, replay, tap, keep, odds, strategy, trace, presenter mode, tap demo |
| `brand/` | The Monte mark, bracket labels, hand-drawn notes |
| `monte-card/` | The Monte card shown in the wallet and tap demo |
| `ui/` | Base parts: button, card, dialog, tabs, tooltip, slider |

`ace/` keeps its pre-rename name; the product was called Ace until 18 Oct.

`ace/tap-demo.tsx` is the tap at the register: reader, Apple Pay-style phone, and the five
steps, on `tap()` from `lib/engine`.
