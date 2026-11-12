// Checks that the sandbox keys in .env.local work end to end, using the app's own code paths
// (lib/paypal/*, lib/data/plaid-*, the agent's model id). Real sandbox calls, no mocks.
//
//   npm run sandbox:check
//   node --env-file-if-exists=.env.local --import ./scripts/_alias.mjs scripts/sandbox-check.ts
//
// Each service is skipped when its keys are unset. Exits 1 if any check FAILs, else 0.
// Secrets are never printed: values show as ****abcd (last 4 characters only).

import Anthropic from "@anthropic-ai/sdk";
import { Products } from "plaid";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { DEMO_TAP_DATE, planCheckout, type Purchase } from "@/lib/paypal/plan";
import { PAYPAL_API, PayPalError, accessToken, createOrderForPlan, getOrder, paypalConfigured } from "@/lib/paypal/client";
import { fetchPayPalTransactions } from "@/lib/paypal/transactions";
import { plaidClient, plaidEnvName } from "@/lib/data/plaid-server";
import { fetchRecurringStreams, syncAllTransactions } from "@/lib/data/plaid-sync";
import { mapRecurring } from "@/lib/data/plaid-recurring";
import { AGENT_MODEL } from "@/lib/paypal/agent";

type Status = "PASS" | "FAIL" | "SKIP" | "WARN";
type Row = { status: Status; name: string; detail: string };
const rows: Row[] = [];
const add = (status: Status, name: string, detail = "") => rows.push({ status, name, detail });

const env = (k: string) => process.env[k]?.trim() ?? "";
const mask = (v: string) => (v ? `****${v.slice(-4)}` : "(unset)");
const missing = (keys: string[]) => keys.filter((k) => !env(k));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Scrub anything that looks like one of our secrets out of an error message. */
function clean(msg: string): string {
  let out = msg;
  for (const k of ["PAYPAL_CLIENT_SECRET", "PLAID_SECRET", "ANTHROPIC_API_KEY", "PAYPAL_CLIENT_ID", "PLAID_CLIENT_ID"]) {
    const v = env(k);
    if (v.length >= 8) out = out.split(v).join(mask(v));
  }
  return out.replace(/\s+/g, " ").slice(0, 200);
}

function paypalErr(e: unknown): string {
  if (e instanceof PayPalError) return clean(`HTTP ${e.status} ${e.name}${e.issue ? ` ${e.issue}` : ""}: ${e.message}${e.debugId ? ` (debug_id ${e.debugId})` : ""}`);
  return clean((e as Error)?.message ?? String(e));
}

type PlaidErr = { response?: { status?: number; data?: { error_code?: string; error_message?: string } } };
const plaidCode = (e: unknown) => (e as PlaidErr).response?.data?.error_code ?? null;
function plaidErr(e: unknown): string {
  const d = (e as PlaidErr).response?.data;
  if (d?.error_code) return clean(`${d.error_code}: ${d.error_message ?? ""}`);
  return clean((e as Error)?.message ?? String(e));
}

// ---------- keys ----------

function checkKeys() {
  const id = env("PAYPAL_CLIENT_ID");
  const pub = env("NEXT_PUBLIC_PAYPAL_CLIENT_ID");
  if (!id && !pub) add("SKIP", "NEXT_PUBLIC_PAYPAL_CLIENT_ID", "neither PayPal client id is set");
  else if (!pub) add("WARN", "NEXT_PUBLIC_PAYPAL_CLIENT_ID", "unset: the PayPal button will not render in the browser");
  else if (pub !== id) add("WARN", "NEXT_PUBLIC_PAYPAL_CLIENT_ID", `${mask(pub)} differs from PAYPAL_CLIENT_ID ${mask(id)}; they must be the same app`);
  else add("PASS", "NEXT_PUBLIC_PAYPAL_CLIENT_ID", `present, equals PAYPAL_CLIENT_ID (${mask(id)})`);
}

// ---------- PayPal ----------

const PAYPAL_NAMES = ["paypal: access token", "paypal: create itemized order", "paypal: read order back", "paypal: transaction search (31 days)", "paypal: webhook id"];

async function checkPayPal() {
  const miss = missing(["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"]);
  if (miss.length || !paypalConfigured()) {
    const why = miss.length ? `missing ${miss.join(", ")}` : `PAYPAL_ENV=${env("PAYPAL_ENV")} (only sandbox is allowed)`;
    for (const n of PAYPAL_NAMES) add("SKIP", n, why);
    add("SKIP", "paypal: capture + refund", why);
    return;
  }

  // 1. OAuth
  try {
    const t = await accessToken();
    add("PASS", PAYPAL_NAMES[0], `got a token (${mask(t)}) from ${PAYPAL_API}`);
  } catch (e) {
    const hint = e instanceof PayPalError && e.status === 401 ? " -> check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are the sandbox app's pair" : "";
    add("FAIL", PAYPAL_NAMES[0], paypalErr(e) + hint);
    for (const n of PAYPAL_NAMES.slice(1)) add("SKIP", n, "no access token");
    add("SKIP", "paypal: capture + refund", "no access token");
    return;
  }

  // 2. The order the app creates for Jordan at Trader Joe's, built exactly as tests/paypal.test.ts does.
  const purchase: Purchase = { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE };
  const history = yearOf(JORDAN).filter((t) => t.date.startsWith("2026") && t.date <= DEMO_TAP_DATE);
  const plan = planCheckout(JORDAN.wallet, purchase, history);
  let orderId: string | null = null;
  try {
    const order = await createOrderForPlan(plan);
    orderId = order.id;
    add(order.status === "CREATED" ? "PASS" : "FAIL", PAYPAL_NAMES[1], `order ${order.id} status ${order.status}, $${order.value}, pick ${plan.pick?.name ?? "none"}`);
  } catch (e) {
    add("FAIL", PAYPAL_NAMES[1], paypalErr(e));
  }

  // 3. Read it back.
  if (!orderId) add("SKIP", PAYPAL_NAMES[2], "no order to read");
  else {
    try {
      const o = await getOrder(orderId);
      const itemTotal = o.items.reduce((s, i) => s + Math.round(Number(i.value ?? 0) * 100) * Number(i.quantity || 1), 0);
      const amountCents = Math.round(Number(o.value ?? 0) * 100);
      const ok = o.items.length > 0 && itemTotal === amountCents && o.value === plan.orderValue;
      add(ok ? "PASS" : "FAIL", PAYPAL_NAMES[2], `status ${o.status}, amount ${o.value} ${o.currency}, items ${o.items.length}, item total ${(itemTotal / 100).toFixed(2)}`);
    } catch (e) {
      add("FAIL", PAYPAL_NAMES[2], paypalErr(e));
    }
  }

  // 4. Transaction Search.
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 31 * 24 * 3600 * 1000);
    const found = await fetchPayPalTransactions({ start, end });
    add("PASS", PAYPAL_NAMES[3], `HTTP 200, ${found.length} transactions`);
  } catch (e) {
    const hint =
      e instanceof PayPalError && e.status === 403
        ? " -> enable 'Transaction search' on the sandbox app (developer.paypal.com > Apps & Credentials > your app > Features), then wait a few minutes for it to apply"
        : "";
    add("FAIL", PAYPAL_NAMES[3], paypalErr(e) + hint);
  }

  // 5. Webhook id.
  const hookId = env("PAYPAL_WEBHOOK_ID");
  if (!hookId) add("SKIP", PAYPAL_NAMES[4], "PAYPAL_WEBHOOK_ID unset: add a webhook to the sandbox app pointing at /api/paypal/webhook, then copy its id");
  else {
    try {
      const res = await fetch(`${PAYPAL_API}/v1/notifications/webhooks/${encodeURIComponent(hookId)}`, {
        headers: { authorization: `Bearer ${await accessToken()}` },
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; event_types?: unknown[]; name?: string; message?: string };
      if (res.ok) add("PASS", PAYPAL_NAMES[4], `${mask(hookId)} -> ${body.url ?? "?"} (${body.event_types?.length ?? 0} event types)`);
      else add("FAIL", PAYPAL_NAMES[4], clean(`HTTP ${res.status} ${body.name ?? ""}: ${body.message ?? ""}`));
    } catch (e) {
      add("FAIL", PAYPAL_NAMES[4], clean((e as Error).message));
    }
  }

  add("SKIP", "paypal: capture + refund", "needs a buyer to approve the order: test in the browser");
}

// ---------- Plaid ----------

const PLAID_NAMES = ["plaid: sandbox link (ins_109508)", "plaid: transactions sync", "plaid: recurring streams"];

/** Sandbox can answer PRODUCT_NOT_READY for a few seconds after linking. */
async function retryNotReady<T>(fn: () => Promise<T>, deadline: number): Promise<T> {
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (plaidCode(e) !== "PRODUCT_NOT_READY" || Date.now() > deadline) throw e;
      await sleep(2000);
    }
  }
}

async function checkPlaid() {
  const miss = missing(["PLAID_CLIENT_ID", "PLAID_SECRET"]);
  const client = plaidClient();
  if (miss.length || !client) {
    for (const n of PLAID_NAMES) add("SKIP", n, `missing ${miss.join(", ")}`);
    return;
  }
  if (plaidEnvName() !== "sandbox") {
    for (const n of PLAID_NAMES) add("SKIP", n, `PLAID_ENV=${plaidEnvName()}; this check only links sandbox items`);
    return;
  }

  let token: string;
  try {
    const created = await client.sandboxPublicTokenCreate({
      institution_id: "ins_109508",
      initial_products: [Products.Transactions, Products.Liabilities],
    });
    const exchanged = await client.itemPublicTokenExchange({ public_token: created.data.public_token });
    token = exchanged.data.access_token;
    add("PASS", PLAID_NAMES[0], `item ${exchanged.data.item_id}`);
  } catch (e) {
    add("FAIL", PLAID_NAMES[0], plaidErr(e));
    for (const n of PLAID_NAMES.slice(1)) add("SKIP", n, "no linked item");
    return;
  }

  const deadline = Date.now() + 20_000;
  try {
    const sync = await retryNotReady(() => syncAllTransactions(client, token, { retries: 6, retryDelayMs: 2000 }), deadline);
    add(sync.transactions.length > 0 ? "PASS" : "FAIL", PLAID_NAMES[1], `${sync.transactions.length} transactions, ${sync.accounts.length} accounts, status ${sync.status || "?"}`);
  } catch (e) {
    add("FAIL", PLAID_NAMES[1], plaidErr(e));
  }

  try {
    const { accounts, recurring } = await retryNotReady(() => fetchRecurringStreams(client, token), Math.max(deadline, Date.now() + 5000));
    const charges = mapRecurring(recurring, { accounts });
    add("PASS", PLAID_NAMES[2], `${recurring.outflow_streams?.length ?? 0} outflow streams -> ${charges.length} recurring charges`);
  } catch (e) {
    add("FAIL", PLAID_NAMES[2], plaidErr(e));
  }
}

// ---------- Anthropic ----------

async function checkAnthropic() {
  const name = `anthropic: ${AGENT_MODEL}`;
  if (!env("ANTHROPIC_API_KEY")) {
    add("SKIP", name, "missing ANTHROPIC_API_KEY");
    return;
  }
  try {
    const res = await new Anthropic({ timeout: 30_000, maxRetries: 0 }).messages.create({
      model: AGENT_MODEL,
      max_tokens: 5,
      messages: [{ role: "user", content: "Say ok." }],
    });
    add("PASS", name, `key ${mask(env("ANTHROPIC_API_KEY"))}, stop_reason ${res.stop_reason}`);
  } catch (e) {
    add("FAIL", name, clean((e as Error).message));
  }
}

// ---------- report ----------

function report() {
  const w = Math.max(...rows.map((r) => r.name.length));
  console.log("");
  for (const r of rows) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(w)}  ${r.detail}`);
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  console.log(`\n${count("PASS")} pass, ${count("FAIL")} fail, ${count("SKIP")} skip, ${count("WARN")} warn`);
  if (count("PASS") === 0 && count("FAIL") === 0) console.log("No keys found. Put them in .env.local (see .env.example) and run again.");
  process.exitCode = count("FAIL") > 0 ? 1 : 0;
}

async function main() {
  const t0 = Date.now();
  checkKeys();
  // Independent services run side by side so the whole check stays near 30 seconds.
  await Promise.all([checkPayPal(), checkPlaid(), checkAnthropic()]);
  // Keep the table in a stable order regardless of which service answered first.
  const order = (n: string) => (n.startsWith("NEXT_PUBLIC") ? 0 : n.startsWith("paypal") ? 1 : n.startsWith("plaid") ? 2 : 3);
  rows.sort((a, b) => order(a.name) - order(b.name));
  report();
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch((e) => {
  console.error("sandbox-check crashed:", clean((e as Error)?.stack ?? String(e)));
  process.exit(1);
});
