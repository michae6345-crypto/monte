// /api/best: the endpoint the browser extension calls. The route handler is a plain function of a
// Request, so it's called directly here, no server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPTIONS, POST } from "@/app/api/best/route";

const call = async (body: unknown) => {
  const res = await POST(new Request("http://x/api/best", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, cors: res.headers.get("access-control-allow-origin"), json: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

test("/api/best: a website is placed by its domain, and a card with a balance is skipped", async () => {
  const r = await call({
    wallet: [{ cardId: "amex_gold", balance: 1200, apr: 30 }, { cardId: "chase_freedom_unlimited" }],
    domain: "www.doordash.com",
    amount: 40,
  });
  assert.equal(r.status, 200);
  assert.equal(r.cors, "*");
  assert.equal(r.json.place.category, "dining");
  assert.equal(r.json.mode, "grace");
  // CFU 3x dining: $40 × 3 × 1¢ = $1.20; Gold would earn $1.60 but adds $40 × 30% / 12 = $1.00
  assert.equal(r.json.pick.cardId, "chase_freedom_unlimited");
  assert.equal(r.json.pick.reward, 1.2);
  assert.equal(r.json.skipped.cardId, "amex_gold");
  assert.equal(r.json.skipped.interest, 1);
  assert.match(r.json.why, /no grace period/);
});

test("/api/best: an unknown shop counts as online shopping; perks come back", async () => {
  const shop = await call({ wallet: [{ cardId: "amex_blue_cash_everyday" }, { cardId: "citi_double_cash" }], domain: "shop.example-boutique.com", amount: 100 });
  assert.equal(shop.json.place.category, "online_retail");
  // BCE 3% online retail beats Double Cash 2%
  assert.equal(shop.json.pick.cardId, "amex_blue_cash_everyday");
  const uber = await call({ wallet: [{ cardId: "amex_gold" }], domain: "ubereats.com" });
  assert.equal(uber.json.perks[0].credit, "Uber Cash");
});

test("/api/best: bad input is a 400, never a crash", async () => {
  assert.equal((await call({ wallet: [] })).status, 400);
  assert.equal((await call({ wallet: [{ cardId: "not_a_card" }], domain: "x.com" })).status, 400);
  assert.equal((await call({ wallet: [{ cardId: "amex_gold" }] })).status, 400);
  assert.equal((await call({ wallet: [{ cardId: "amex_gold" }], domain: "x.com", amount: -5 })).status, 400);
  const bad = await POST(new Request("http://x/api/best", { method: "POST", body: "{not json" }));
  assert.equal(bad.status, 400);
  assert.equal(OPTIONS().status, 204);
});
