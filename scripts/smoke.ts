// Walks the demo path against a deployment and fails loudly if anything the pitch
// depends on is missing. No dependencies, no browser: the page is server-rendered, so
// the numbers we present are in the HTML and we can check them with fetch.
//
//   node --import ./scripts/_alias.mjs scripts/smoke.ts
//   node --import ./scripts/_alias.mjs scripts/smoke.ts https://monte-rm86.onrender.com
//
// Exits 0 if the demo is safe to present, 1 if it is not.

const BASE = (process.argv[2] ?? process.env.MONTE_URL ?? "https://ace-eta-beryl.vercel.app").replace(/\/$/, "");

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });

async function main() {
  // --- the page itself -----------------------------------------------------
  let html = "";
  let status = 0;
  let ms = 0;
  try {
    const t0 = Date.now();
    const res = await fetch(BASE, { headers: { "user-agent": "monte-smoke" } });
    ms = Date.now() - t0;
    status = res.status;
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
