// Walks the demo path against a deployment and fails loudly if anything the pitch
// depends on is missing. No dependencies, no browser: the page is server-rendered, so
// the numbers we present are in the HTML and we can check them with fetch.
//
//   node --import ./scripts/_alias.mjs scripts/smoke.ts
//   node --import ./scripts/_alias.mjs scripts/smoke.ts https://monte-rm86.onrender.com
//
//   ... scripts/smoke.ts https://ace-eta-beryl.vercel.app --require-paypal
//
// --require-paypal (or SMOKE_REQUIRE_PAYPAL=1) fails unless /api/health says
// paypal "sandbox" and agent "ready". Without it, those states are only reported.
//
// Exits 0 if the demo is safe to present, 1 if it is not.

const ARGS = process.argv.slice(2);
const REQUIRE_PAYPAL = ARGS.includes("--require-paypal") || process.env.SMOKE_REQUIRE_PAYPAL === "1";
const BASE = (ARGS.find((a) => !a.startsWith("--")) ?? process.env.MONTE_URL ?? "https://ace-eta-beryl.vercel.app").replace(/\/$/, "");

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });

async function main() {
  // --- the page itself -----------------------------------------------------
  let html = "";
  let status = 0;
  let ms = 0;
  let pageHeaders: Headers | null = null;
  try {
    const t0 = Date.now();
    const res = await fetch(BASE, { headers: { "user-agent": "monte-smoke" } });
    ms = Date.now() - t0;
    status = res.status;
    pageHeaders = res.headers;
    html = await res.text();
  } catch (e) {
    add("page loads", false, `fetch failed: ${(e as Error).message}`);
    report();
    return;
  }
  add("page loads", status === 200, `HTTP ${status} in ${ms}ms, ${html.length} bytes`);
  add("page is not an error shell", html.length > 20000, `${html.length} bytes`);

  // --- the five people the demo switches between ---------------------------
  for (const person of ["Jordan", "Maya", "Parks", "Sam", "Rosa"]) {
    add(`person: ${person}`, html.includes(person));
  }

  // --- the numbers the pitch is built on -----------------------------------
  // Verified against the engine: receipt -$427.03, replay $104.14 left on the table.
  add("Jordan's receipt (427)", /427/.test(html), "the headline the whole pitch turns on");
  add("Jordan's replay (104)", /104/.test(html), "left on the table");

  // --- the claim we make about ourselves -----------------------------------
  // Assert the substance, not one sentence: the wording of this section gets edited
  // often, and a smoke check that breaks on a copy change is worse than no check.
  add("how-it-works section present", /how it works/i.test(html));
  add("sourcing claim present", /published terms/i.test(html), "numbers come from the issuers' terms");

  // --- health --------------------------------------------------------------
  try {
    const res = await fetch(`${BASE}/api/health`);
    const body = (await res.json()) as { ok?: boolean; app?: string; plaid?: string };
    add("/api/health responds", res.status === 200, `HTTP ${res.status}`);
    add("/api/health says ok", body.ok === true && body.app === "monte", JSON.stringify(body));
    // Not a failure: we present on personas either way. Just say which it is out loud.
    add("plaid state is known", typeof body.plaid === "string", `plaid: ${body.plaid}`);
  } catch (e) {
    add("/api/health responds", false, (e as Error).message);
  }

  // --- the Plaid routes must fail politely, never 500 ----------------------
  try {
    const res = await fetch(`${BASE}/api/plaid/data`);
    const ok = res.status === 503 || res.status === 200 || res.status === 409;
    add("plaid route degrades politely", ok, `HTTP ${res.status} (503 = no keys, which is expected)`);
  } catch (e) {
    add("plaid route degrades politely", false, (e as Error).message);
  }

  // --- PayPal: polite without keys, a real sandbox order with them -----------
  try {
    const health = (await (await fetch(`${BASE}/api/health`)).json()) as { paypal?: string; agent?: string };
    add("paypal state is known", typeof health.paypal === "string", `paypal: ${health.paypal}, agent: ${health.agent}`);
    // Creates an order nobody approves, so it charges nothing and expires on its own.
    const res = await fetch(`${BASE}/api/paypal/create-order`, {
      method: "POST",
      body: JSON.stringify({
        purchase: { merchant: "Trader Joe's", category: "groceries", amount: 84 },
        wallet: [{ cardId: "amex_gold" }, { cardId: "apple_card", balance: 2800, apr: 26.24 }],
        history: [],
        date: "2026-10-18",
      }),
    });
    const body = (await res.json()) as { error?: string; id?: string; value?: string; plan?: { pick?: { cardId?: string } } };
    if (health.paypal === "sandbox") {
      add("paypal sandbox order", res.status === 200 && !!body.id, `HTTP ${res.status} ${body.error ?? body.id ?? ""}`);
      add("order is the engine's amount and card", body.value === "84.00" && body.plan?.pick?.cardId === "amex_gold", `${body.value} on ${body.plan?.pick?.cardId}`);
    } else {
      add("paypal route degrades politely", res.status === 503 && body.error === "paypal_not_configured", `HTTP ${res.status} (no keys on this deployment)`);
    }
  } catch (e) {
    add("paypal routes respond", false, (e as Error).message);
  }

  // --- security headers (next.config.ts) ----------------------------------
  if (pageHeaders) {
    const nosniff = pageHeaders.get("x-content-type-options") ?? "";
    const csp = pageHeaders.get("content-security-policy") ?? "";
    add("header: X-Content-Type-Options nosniff", nosniff.toLowerCase() === "nosniff", nosniff || "missing");
    add("header: CSP frame-ancestors", /frame-ancestors/i.test(csp), csp || "missing");
  }

  // --- PayPal and agent state, from /api/health ----------------------------
  let paypalState = "unknown";
  try {
    const h = (await (await fetch(`${BASE}/api/health`, { headers: { "cache-control": "no-store" } })).json()) as {
      paypal?: string;
      agent?: string;
      commit?: string | null;
    };
    paypalState = String(h.paypal);
    const detail = `paypal: ${h.paypal}, agent: ${h.agent}, commit: ${h.commit ?? "n/a"}`;
    if (REQUIRE_PAYPAL) {
      add("paypal is sandbox (required)", h.paypal === "sandbox", detail);
      add("agent is ready (required)", h.agent === "ready", detail);
    } else {
      add("paypal/agent state reported", typeof h.paypal === "string" && typeof h.agent === "string", `${detail} (pass --require-paypal to enforce)`);
    }
  } catch (e) {
    add("paypal/agent state reported", false, (e as Error).message);
  }

  // --- the checkout panel ships on the home page when PayPal is configured --
  // "Pay with PayPal" is the panel's heading in components/ace/paypal-checkout.tsx. The Tap
  // tab renders client-side, so the string is in the page's JS chunks, not its server HTML.
  const MARKER = "Pay with PayPal";
  let panel = html.includes(MARKER);
  let where = panel ? "server HTML" : "";
  if (!panel) {
    const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
    const hits = await Promise.all(
      srcs.map(async (src) => {
        try {
          return (await (await fetch(new URL(src, BASE + "/"))).text()).includes(MARKER);
        } catch {
          return false;
        }
      }),
    );
    panel = hits.some(Boolean);
    where = panel ? `JS chunk (searched ${srcs.length})` : `not in HTML or ${srcs.length} JS chunks`;
  }
  if (paypalState === "sandbox") add("home page has PayPal checkout panel", panel, `"${MARKER}" in ${where}`);
  else add("home page PayPal panel (not required: paypal not configured)", true, panel ? `present (${where})` : "absent");

  // --- /paypal activity page -----------------------------------------------
  try {
    const res = await fetch(`${BASE}/paypal`);
    const text = await res.text();
    add("/paypal page", res.status === 200 && text.includes("PayPal activity"), `HTTP ${res.status}${text.includes("PayPal activity") ? "" : ', missing "PayPal activity"'}`);
  } catch (e) {
    add("/paypal page", false, (e as Error).message);
  }

  // --- PayPal routes reject bad input politely, never 500 -------------------
  const probe = async (name: string, path: string, init: RequestInit | undefined, allowed: number[]) => {
    try {
      const res = await fetch(`${BASE}${path}`, init);
      const body = (await res.text()).slice(0, 80).replace(/\s+/g, " ");
      add(name, allowed.includes(res.status), `HTTP ${res.status} (want ${allowed.join("/")}) ${body}`);
    } catch (e) {
      add(name, false, (e as Error).message);
    }
  };
  const post = { method: "POST", headers: { "content-type": "application/json" }, body: "{}" };
  // The route checks keys before the id, so without keys a bad id answers 503.
  await probe("order/BAD!! rejected", "/api/paypal/order/BAD!!", undefined, paypalState === "sandbox" ? [400] : [400, 503]);
  await probe("transactions responds", "/api/paypal/transactions", undefined, [200, 503]);
  await probe("refund {} rejected", "/api/paypal/refund", post, [400, 403, 503]);
  await probe("webhook {} rejected", "/api/paypal/webhook", post, [400, 503]);

  report();
}

function report() {
  const pad = Math.max(...checks.map((c) => c.name.length));
  console.log(`\nMonte smoke — ${BASE}\n`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(pad)}  ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n  ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log(`\n  NOT SAFE TO PRESENT — fix these first:`);
    for (const f of failed) console.log(`    - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exit(1);
  }
  console.log(`  Demo path is intact.\n`);
}

void main();
