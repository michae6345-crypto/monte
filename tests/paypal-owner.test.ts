// Only the browser that paid can refund: capture-order sets a signed monte_captures cookie, and
// the refund route (and the agent's refund lookup) refuses a captureId that isn't in it. PayPal
// is mocked.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { JORDAN } from "@/lib/data/personas";
import { DEMO_TAP_DATE, encodeOrderRef, planCheckout } from "@/lib/paypal/plan";
import { MAX_OWNED, OWNER_COOKIE, addCapture, ownedCaptures, signCaptures, verifyCaptures } from "@/lib/paypal/owner";
import { POST as refundRoute } from "@/app/api/paypal/refund/route";
import { POST as captureRoute } from "@/app/api/paypal/capture-order/route";

const ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "MONTE_SESSION_SECRET"] as const;
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};
let calls: string[] = [];
let clientCount = 0;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  calls = [];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});
function setKeys() {
  process.env.PAYPAL_CLIENT_ID = `sb-owner-client-${++clientCount}`;
  process.env.PAYPAL_CLIENT_SECRET = "sb-secret";
  process.env.PAYPAL_ENV = "sandbox";
}

const ref = () => encodeOrderRef(planCheckout(JORDAN.wallet, { merchant: "Trader Joe's", category: "groceries", amount: 84, date: DEMO_TAP_DATE }, []));
function mockPayPal(refundId: string) {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push(url);
    let body: unknown;
    if (url.endsWith("/v1/oauth2/token")) body = { access_token: "sandbox-token", expires_in: 32400 };
    else if (url.endsWith("/capture"))
      body = {
        id: "ORDER123",
        status: "COMPLETED",
        purchase_units: [{ custom_id: ref(), payments: { captures: [{ id: "CAPTURE9", status: "COMPLETED", custom_id: ref(), amount: { currency_code: "USD", value: "84.00" } }] } }],
      };
    else if (init.method === "GET") body = { id: "CAPTURE9", status: "COMPLETED", custom_id: ref(), amount: { currency_code: "USD", value: "84.00" } };
    else if (url.endsWith("/refund")) body = { id: refundId, status: "COMPLETED", amount: { currency_code: "USD", value: "84.00" } };
    else assert.fail(`unexpected ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}
const refund = (cookie?: string) =>
  new Request("http://localhost/api/paypal/refund", { method: "POST", headers: cookie ? { cookie } : {}, body: JSON.stringify({ captureId: "CAPTURE9" }) });

// ---------- sign / verify ----------

test("sign/verify round-trips; MONTE_SESSION_SECRET wins over the PayPal secret", () => {
  setKeys();
  const v = signCaptures(["CAPTURE9", "CAPTURE8"]);
  assert.ok(v);
  assert.deepEqual(verifyCaptures(v), ["CAPTURE9", "CAPTURE8"]);
  process.env.MONTE_SESSION_SECRET = "a-different-secret";
  assert.deepEqual(verifyCaptures(v), [], "signed with another key");
  assert.deepEqual(verifyCaptures(signCaptures(["CAPTURE9"])), ["CAPTURE9"]);
});

test("no secret: nothing signs and nothing verifies", () => {
  assert.equal(signCaptures(["CAPTURE9"]), null);
  assert.deepEqual(verifyCaptures("anything.at.all"), []);
});

test("a tampered or malformed cookie verifies as empty", () => {
  setKeys();
  const v = signCaptures(["CAPTURE9"])!;
  const [, sig] = v.split(".");
  const forged = `${Buffer.from(JSON.stringify(["CAPTURE9", "VICTIM1"])).toString("base64url")}.${sig}`;
  assert.deepEqual(verifyCaptures(forged), []);
  assert.deepEqual(verifyCaptures(`${v}x`), []);
  assert.deepEqual(verifyCaptures(v.split(".")[0]), []);
  assert.deepEqual(verifyCaptures(""), []);
  assert.deepEqual(verifyCaptures(null), []);
});

test("addCapture: newest first, no duplicates, capped at 20", () => {
  let ids: string[] = [];
  for (let i = 0; i < 25; i++) ids = addCapture(ids, `CAPTURE${i}`);
  assert.equal(ids.length, MAX_OWNED);
  assert.equal(ids[0], "CAPTURE24");
  assert.ok(!ids.includes("CAPTURE4"), "the oldest fall off");
  assert.deepEqual(addCapture(ids, "CAPTURE10").slice(0, 2), ["CAPTURE10", "CAPTURE24"]);
  assert.equal(addCapture(ids, "CAPTURE10").length, MAX_OWNED);
});

// ---------- the routes ----------

test("refund without the cookie: 403 not_your_capture, PayPal never asked", async () => {
  setKeys();
  mockPayPal("OWNER-REFUND-A");
  const res = await refundRoute(refund());
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "not_your_capture" });
  assert.equal(calls.length, 0);

  // a validly signed cookie for other captures doesn't help either
  const other = await refundRoute(refund(`${OWNER_COOKIE}=${signCaptures(["CAPTURE8"])}`));
  assert.equal(other.status, 403);
  assert.equal(calls.length, 0);
});

test("capture sets the cookie, and the same browser can refund with it", async () => {
  setKeys();
  mockPayPal("OWNER-REFUND-B");
  const cap = await captureRoute(new Request("http://localhost/api/paypal/capture-order", { method: "POST", body: JSON.stringify({ orderId: "ORDER123" }) }));
  assert.equal(cap.status, 200);
  assert.equal((await cap.json()).captureId, "CAPTURE9");
  const setCookie = cap.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(`^${OWNER_COOKIE}=`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  const cookie = setCookie.split(";")[0];
  assert.deepEqual(ownedCaptures(new Request("http://localhost/", { headers: { cookie: `other=1; ${cookie}` } })), ["CAPTURE9"]);

  const res = await refundRoute(refund(cookie));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).refundId, "OWNER-REFUND-B");
});

test("a second capture keeps the earlier ones in the cookie", async () => {
  setKeys();
  mockPayPal("unused");
  const earlier = `${OWNER_COOKIE}=${signCaptures(["CAPTURE7"])}`;
  const cap = await captureRoute(new Request("http://localhost/api/paypal/capture-order", { method: "POST", headers: { cookie: earlier }, body: JSON.stringify({ orderId: "ORDER123" }) }));
  const cookie = (cap.headers.get("set-cookie") ?? "").split(";")[0];
  assert.deepEqual(ownedCaptures(new Request("http://localhost/", { headers: { cookie } })), ["CAPTURE9", "CAPTURE7"]);
});
