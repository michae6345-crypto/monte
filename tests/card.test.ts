// The Monte card's authorization responder: the network's MCC decides the category, choose()
// picks the card, and the answer is in Lithic's ASA shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { categoryForMcc, mccLabel } from "@/lib/card/mcc";
import { merchantName } from "@/lib/card/authorize";
import { walletLink } from "@/components/app/share";
import { POST } from "@/app/api/card/authorize/route";

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
