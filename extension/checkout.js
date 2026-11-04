// Checkout reminders: runs on https pages only after you turn reminders on, and acts only on a
// page that looks like a cart or checkout. Shows one small chip with the card to pay with. It
// reads the page's order total if it can find one; it never reads or fills card numbers.

(() => {
  if (window.top !== window || window.__monteChip) return;
  window.__monteChip = true;

  const host = location.hostname.replace(/^www\./, "");
  if (/(^|\.)(ace-eta-beryl\.vercel\.app)$/.test(host)) return;
  const looksLikeCheckout = () =>
    /\b(checkout|cart|basket|bag|payment|place-?order|order-?review)\b/i.test(location.pathname + " " + location.search) ||
    /\b(checkout|your cart|shopping cart|place order|payment)\b/i.test(document.title);
  if (!looksLikeCheckout()) return;

  // dismissed on this site this session: stay away
  const key = "monte-dismissed:" + host;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {}

  /** The order total, if the page says it plainly: the last "total" line with a dollar amount. */
  function findTotal() {
    const els = [...document.querySelectorAll("body *")].filter((el) => el.children.length < 4 && /total/i.test(el.textContent || "") && (el.textContent || "").length < 120);
    let best = null;
    for (const el of els) {
      const m = (el.textContent || "").replace(/,/g, "").match(/\$\s?(\d{1,6}(?:\.\d{2})?)/);
      if (m && !/sub\s*total|savings|discount/i.test(el.textContent || "")) best = Number(m[1]);
    }
    return best && best > 0 && best < 100000 ? best : null;
  }

  const total = findTotal();
  chrome.runtime.sendMessage({ type: "best", domain: location.hostname, amount: total || 50 }, (r) => {
    if (!r || r.error || !r.pick) return;
    show(r, total);
  });

  function show(r, total) {
    const money = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toFixed(2);
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    const root = wrap.attachShadow({ mode: "closed" });
    const p = r.pick;
    const perk = r.perks && r.perks[0];
    root.innerHTML = `
      <style>
        .c{font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0e0f12;background:#fff;border-radius:14px;
           box-shadow:0 0 0 1px #e4e6ea,0 18px 40px -16px rgba(12,14,20,.45);padding:12px 14px;max-width:300px}
        .t{display:flex;align-items:center;gap:8px;font:600 10px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6f78}
        .x{margin-left:auto;border:0;background:none;font-size:16px;line-height:1;color:#6b6f78;cursor:pointer;padding:0 2px}
        .n{margin-top:6px;font-size:16px;font-weight:600;letter-spacing:-.01em}
        .g{color:#1f7a4d}.d{color:#6b6f78}
        .w{margin-top:6px;color:#6b6f78;font-size:12px}
        .k{margin-top:8px;padding:6px 8px;border-left:3px solid #1f7a4d;background:#f7f8fa;border-radius:6px;font-size:12px}
      </style>
      <div class="c" role="note" aria-label="Monte: which card to pay with">
        <div class="t"><span>Monte · pay with</span><button class="x" aria-label="Dismiss">×</button></div>
        ${perk ? `<div class="k">First: your ${esc(perk.name)}'s ${money(perk.amount)} ${esc(perk.per)} ${esc(perk.credit)}</div>` : ""}
        <div class="n">${esc(p.name)}</div>
        <div><span class="g">${p.interest > 0 ? money(p.net) + " net" : money(p.reward) + " back"}</span>
          <span class="d">on ${money(r.amount)}${total ? "" : " (about)"} · ${esc(r.place.label.toLowerCase())}</span></div>
        <div class="w">${esc(r.why)}</div>
      </div>`;
    root.querySelector(".x").addEventListener("click", () => {
      wrap.remove();
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
    });
    document.documentElement.appendChild(wrap);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
})();
