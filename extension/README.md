# Monte for Chrome: the right card at online checkout

Uno and the other tap-to-pay pickers stop at the register. Online, the browser already knows where
you are: the site's domain. Monte names the card to pay with there, counting interest as well as
points (the same `choose()` as the app's Pay screen), and a card's credit at that store (Uber Cash,
the Disney streaming credit...) first.

Two ways it shows up:

- **Click the Monte icon** on any store's site: the site's category, the card to use, why, and every
  card's net. Uses only `activeTab`: Monte sees the site you're on when you click, nothing else.
- **Remind me at checkout** (off until you turn it on in the popup): Chrome asks you to let Monte
  read sites, and then on pages that look like a cart or checkout a small note shows the card, using
  the page's order total when it can find one. Dismiss it once and it stays away from that site for
  the session. Turn it off and the access is handed back. It never reads or fills card numbers.

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3. `storage`, `activeTab`, `scripting`; site access is optional and asked for only when reminders are turned on |
| `sync.js` | Runs only on Monte's own site. Copies the cards you set up in the Monte app (card, balance, APR; never purchases) into the extension |
| `popup.html/.css/.js` | The popup, and the reminders switch |
| `background.js` | Registers or removes the checkout script, and asks Monte's `/api/best` for content scripts |
| `checkout.js` | The checkout note: acts only on cart/checkout pages, finds the order total, shows the card in a shadow-DOM chip |
| `icons/` | Monte's mark, drawn from `public/brand/favicon.svg` |

**Privacy.** Monte's `/api/best` receives your card ids, any balance and APR, the site's domain and
the amount. It stores nothing. No purchases, names or account numbers leave the app.

## Install (unpacked, for now)

1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open [Monte](https://ace-eta-beryl.vercel.app/app) once and add your cards (or connect your bank).
4. On any store's site, click the Monte icon. Turn on "Remind me at checkout" if you want the note.

Working on it locally: the content script also runs on `http://localhost:3011`, and the popup calls
whichever Monte origin your wallet came from. Chrome no longer loads unpacked extensions from the
command line, so the popup and the checkout note were checked as pages with a stubbed `chrome` object
against the local API (DoorDash -> dining, Whole Foods -> groceries, Delta -> flights; a checkout
page's "Order total $64.20" read over its subtotal).
