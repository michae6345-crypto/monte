// The popup: which card for the site in the current tab. The wallet comes from the Monte app
// (sync.js copies it in when you open Monte); the pick comes from Monte's /api/best, which keeps
// nothing. Without a wallet yet, it sends you to the app to set one up.

const DEFAULT_API = "https://ace-eta-beryl.vercel.app";
const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function state() {
  const [{ monte }, { amount }] = await Promise.all([chrome.storage.local.get("monte"), chrome.storage.local.get("amount")]);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try {
    const u = new URL(tab?.url || "");
    if (u.protocol === "http:" || u.protocol === "https:") host = u.hostname;
  } catch {
    host = "";
  }
  return { monte: monte || null, host, amount: Number(amount) > 0 ? Number(amount) : 50 };
}

function render(html) {
  $("main").innerHTML = html;
}

async function run() {
  const { monte, host, amount } = await state();
  const api = (monte && monte.api) || DEFAULT_API;
  $("open").href = api + "/app#cards";
  $("amount").value = amount;
  $("site").textContent = host.replace(/^www\./, "");

  if (!monte || !monte.wallet || !monte.wallet.length) {
    render(
      `<p class="label">first, your cards</p>
       <p class="why">Open Monte and add your cards (or connect your bank). The extension picks them up from there.</p>
       <a class="btn" href="${esc(api)}/app" target="_blank" rel="noreferrer">Open Monte</a>`,
    );
    return;
  }
  if (!host || /(^|\.)(ace-eta-beryl\.vercel\.app|localhost)$/.test(host)) {
    render(`<p class="label">${esc(monte.wallet.length)} cards loaded</p><p class="why">Open a store's website, then click Monte to see which card to pay with there.</p>`);
    return;
  }

  render(`<p class="dim">Working out the card for ${esc(host)}…</p>`);
  let r;
  try {
    const res = await fetch(api + "/api/best", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: monte.wallet, domain: host, amount }),
    });
    r = await res.json();
    if (!res.ok) throw new Error(r.message || r.error || res.status);
  } catch (e) {
    render(`<p class="label">couldn't reach Monte</p><p class="why dim">${esc(e.message || e)}</p>`);
    return;
  }

  const p = r.pick;
  const rows = r.ranked
    .map((c) => {
      const off = r.mode === "grace" && c.carries;
      const cls = c.cardId === p.cardId ? "on" : off ? "off" : "";
      const note = c.interest > 0 ? ` <span class="dim">(${money(c.interest)}/mo interest)</span>` : "";
      return `<li class="${cls}"><span>${esc(c.name)}${note}</span><span class="n ${c.net >= 0 ? "gain" : "loss"}">${money(c.net)}</span></li>`;
    })
    .join("");
  const perks = (r.perks || [])
    .map((p) => `<p class="perk">Use your ${esc(p.name)}'s <b>${money(p.amount)} ${esc(p.per)}</b> ${esc(p.credit)} first, if it isn't used yet.</p>`)
    .join("");
  render(
    `${perks}<p class="label">${esc(r.place.label)} at ${esc(r.place.name)}${r.place.via === "words" ? " (best guess)" : ""}</p>
     <div class="pick">${esc(p.name)}</div>
     <div class="earn"><span class="${p.net >= 0 ? "gain" : "loss"}">${p.interest > 0 ? money(p.net) + " net" : money(p.reward) + " back"}</span> <span class="dim">on ${money(r.amount)}</span></div>
     <div class="rule">${esc(p.rule)}</div>
     <p class="why">${esc(r.why)}</p>
     <ul>${rows}</ul>`,
  );
}

$("amount").addEventListener("change", async (e) => {
  const v = Number(e.target.value);
  if (v > 0) {
    await chrome.storage.local.set({ amount: v });
    run();
  }
});

run();
