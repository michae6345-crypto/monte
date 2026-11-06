// Runs only on Monte's own site. Copies the wallet you set up in the Monte app (the cards, and
// any balance and APR; never purchases) into the extension, so the popup knows your cards.
// Checks again every few seconds while the tab is open, so edits in the app carry over.

const KEY = "monte.app.v1";
let last = "";

function sync() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    saved = null;
  }
  const wallet = saved && Array.isArray(saved.wallet) ? saved.wallet.map((h) => ({ cardId: h.cardId, balance: h.balance || 0, apr: h.apr })) : [];
  const payload = JSON.stringify({ wallet, label: saved ? saved.label : null, origin: location.origin });
  if (payload === last) return;
  last = payload;
  chrome.storage.local.set({ monte: { wallet, label: saved ? saved.label : null, api: location.origin, at: Date.now() } });
}

sync();
setInterval(sync, 4000);
