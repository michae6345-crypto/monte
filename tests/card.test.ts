// The Monte card's authorization responder: the network's MCC decides the category, choose()
// picks the card, and the answer is in Lithic's ASA shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { categoryForMcc, mccLabel } from "@/lib/card/mcc";
import { merchantName } from "@/lib/card/authorize";
import { walletLink } from "@/components/app/share";
import { POST } from "@/app/api/card/authorize/route";
import { POST as STRIPE } from "@/app/api/card/stripe/route";

test("MCC -> category: exact codes, airline and hotel blocks, and everything else", () => {
  assert.equal(categoryForMcc("5411"), "groceries");
  assert.equal(categoryForMcc("5812"), "dining");
  assert.equal(categoryForMcc("5541"), "gas");
  assert.equal(categoryForMcc("4121"), "rideshare");
  assert.equal(categoryForMcc("3058"), "airfare"); // Delta's own code
  assert.equal(categoryForMcc("3509"), "hotels"); // a hotel brand's code
  assert.equal(categoryForMcc("5310"), "everything_else"); // discount store: not groceries
  assert.equal(mccLabel("5411"), "Grocery stores, supermarkets");
});

test("descriptor -> merchant name", () => {
  assert.equal(merchantName("TRADER JOE'S #071"), "Trader Joe's");
  assert.equal(merchantName("UBER *TRIP"), "Uber");
  assert.equal(merchantName("SHELL OIL 57444"), "Shell");
  assert.equal(merchantName("CVS/PHARMACY #9213"), "CVS Pharmacy");
  assert.equal(merchantName("COSTCO WHSE #0479"), "Costco");
  assert.equal(merchantName("NETFLIX.COM"), "Netflix");
  assert.equal(merchantName("ZZYZX HARDWARE 0042"), "Zzyzx Hardware"); // unknown: cleaned up
  assert.equal(merchantName("REIGN BEVERAGE CO"), "Reign Beverage Co"); // not REI: whole words only
});

const ask = async (body: unknown, headers: Record<string, string> = { "x-monte-debug": "1" }) => {
  const res = await POST(new Request("http://x/api/card/authorize", { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, json: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

test("authorize: Lithic's shape in, Lithic's answer out, Monte's pick on the side", async () => {
  // Jordan's wallet in the card's memo, as an enrolled card would carry it
  const memo = "monte:" + walletLink([{ cardId: "chase_freedom_unlimited" }, { cardId: "amex_gold" }, { cardId: "apple_card", balance: 2800, apr: 26.24 }], "https://m").split("#")[1];
  const r = await ask({ token: "auth_123", amount: 6420, merchant: { descriptor: "TRADER JOE'S #071", mcc: "5411", state: "CA" }, card: { token: "card_1", memo } });
  assert.equal(r.status, 200);
  assert.equal(r.json.result, "APPROVED");
  assert.equal(r.json.token, "auth_123");
  assert.equal(r.json.monte.category, "groceries");
  // Gold 4x groceries: $64.20 × 4 × 1¢ = $2.57 (Apple Card, 2x, carries a balance)
  assert.equal(r.json.monte.play.cardId, "amex_gold");
  assert.ok(Math.abs(r.json.monte.play.reward - 2.568) < 0.005);
});

test("authorize: Lithic gets the plain answer; no wallet still approves", async () => {
  const r = await ask({ token: "auth_9", amount: 1000, merchant: { descriptor: "NETFLIX.COM", mcc: "4899" } }, {});
  assert.deepEqual(Object.keys(r.json).sort(), ["avs_result", "balance", "result", "token"]);
  assert.equal(r.json.result, "APPROVED");
});

test("stripe: issuing_authorization.request in, {approved: true} out, the same pick", async () => {
  const memo = walletLink([{ cardId: "chase_freedom_unlimited" }, { cardId: "amex_gold" }], "https://m").split("#")[1];
  const event = {
    type: "issuing_authorization.request",
    data: { object: { id: "iauth_1", pending_request: { amount: 1845 }, merchant_data: { name: "SWEETGREEN LA BREA", category_code: "5812", city: "Los Angeles", state: "CA" }, card: { id: "ic_1", metadata: { monte: memo } } } },
  };
  const body = JSON.stringify(event);
  const secret = "whsec_stripe_test";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    const t = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    const ok = await STRIPE(new Request("http://x", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${v1}`, "x-monte-debug": "1" } }));
    const json = (await ok.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.equal(json.approved, true);
    assert.equal(json.monte.category, "dining");
    // Gold 4x dining: $18.45 × 4 × 1¢ = $0.74 beats CFU 3x ($0.55)
    assert.equal(json.monte.play.cardId, "amex_gold");
    const forged = await STRIPE(new Request("http://x", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${"0".repeat(64)}` } }));
    assert.equal(forged.status, 400);
    const other = await STRIPE(new Request("http://x", { method: "POST", body: JSON.stringify({ type: "issuing_transaction.created" }), headers: { "stripe-signature": `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${JSON.stringify({ type: "issuing_transaction.created" })}`).digest("hex")}` } }));
    assert.deepEqual(await other.json(), { received: true });
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test("authorize: with a webhook secret, only signed requests get through", async () => {
  const secret = "whsec_" + Buffer.from("monte-test-secret").toString("base64");
  process.env.LITHIC_WEBHOOK_SECRET = secret;
  try {
    const body = JSON.stringify({ token: "a", amount: 500, merchant: { descriptor: "X", mcc: "5812" } });
    const unsigned = await POST(new Request("http://x", { method: "POST", body }));
    assert.equal(unsigned.status, 401);
    const id = "msg_1";
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", Buffer.from("monte-test-secret")).update(`${id}.${ts}.${body}`).digest("base64");
    const signed = await POST(new Request("http://x", { method: "POST", body, headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` } }));
    assert.equal(signed.status, 200);
  } finally {
    delete process.env.LITHIC_WEBHOOK_SECRET;
  }
});
