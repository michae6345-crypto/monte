# Monte for Chrome: the right card at online checkout

Uno and the other tap-to-pay pickers stop at the register. Online, the browser already knows where
you are: the site's domain. Click Monte on any store's site and it names the card to pay with there,
counting interest as well as points (the same `choose()` as the app's Pay screen).

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3. Permissions: `storage` (your wallet) and `activeTab` (the site you're on, only when you click). |
| `sync.js` | Runs only on Monte's own site. Copies the cards you set up in the Monte app (card, balance, APR; never purchases) into the extension. |
| `popup.html/.css/.js` | The popup: the site's category, the card to use, why, and every card's net. |
| `icons/` | Monte's mark, drawn from `public/brand/favicon.svg`. |

**Privacy.** The popup sends Monte's `/api/best` your card ids, any balance and APR, the site's
domain and the amount. The endpoint is stateless: nothing is stored or logged. No purchases, names or
account numbers ever leave the app.

## Install (unpacked, for now)

1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open [Monte](https://ace-eta-beryl.vercel.app/app) once and add your cards (or connect your bank).
4. On any store's site, click the Monte icon.

Working on it locally: the content script also runs on `http://localhost:3011`, and the popup calls
whichever Monte origin your wallet came from.
