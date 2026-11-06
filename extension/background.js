// Service worker. Two jobs:
//  1. Checkout reminders (opt-in): when you turn them on in the popup, Chrome asks you to let
//     Monte read sites; then checkout.js is registered for https pages, and only acts on pages
//     that look like a cart or checkout. Turning them off unregisters it and gives the access back.
//  2. Asking Monte: content scripts send their question here, and this worker calls /api/best
//     (pages' own security rules don't apply to the extension's requests).

const DEFAULT_API = "https://ace-eta-beryl.vercel.app";
const SCRIPT_ID = "monte-checkout";

async function setReminders(on) {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (on && !existing.length) {
    await chrome.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: ["https://*/*"], js: ["checkout.js"], runAt: "document_idle", persistAcrossSessions: true },
    ]);
  }
  if (!on && existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "reminders") {
    setReminders(msg.on).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "best") {
    (async () => {
      const { monte } = await chrome.storage.local.get("monte");
      if (!monte?.wallet?.length) return reply({ error: "no_wallet" });
      const api = monte.api || DEFAULT_API;
      try {
        const res = await fetch(api + "/api/best", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: monte.wallet, domain: msg.domain, amount: msg.amount }),
        });
        reply(await res.json());
      } catch (e) {
        reply({ error: String(e) });
      }
    })();
    return true;
  }
  return false;
});

// if access was taken back from Chrome's own settings, stop the reminders too
chrome.permissions.onRemoved.addListener(async () => {
  const ok = await chrome.permissions.contains({ origins: ["https://*/*"] });
  if (!ok) {
    await setReminders(false);
    await chrome.storage.local.set({ reminders: false });
  }
});
