// bestTransfer(): a 0% balance-transfer offer from another issuer, figured at the worst-case fee.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestTransfer, transferMonths } from "@/lib/transfer";

test("transferMonths reads the catalog's intro text", () => {
  assert.equal(transferMonths("0% for 18 months on balance transfers only; no purchase intro APR"), 18);
  assert.equal(transferMonths("0% for 15 months on purchases and balance transfers, then 17.74%-26.74% variable"), 15);
  assert.equal(transferMonths("0% for 6 months on purchases, then 16.74%-25.74% variable"), null); // purchases only
  assert.equal(transferMonths(undefined), null);
});

test("Jordan's Apple Card balance: Citi Double Cash, 18 months, at least $411 saved", () => {
  const t = bestTransfer({ cardId: "apple_card", balance: 2800, apr: 26.24 })!;
  assert.equal(t.toCardId, "citi_double_cash");
  assert.equal(t.months, 18);
  // $2,800 / 18 = $155.56 a month; staying: $2,800 × 26.24%/12 × 18 × ½ = $551.04; fee at 5% = $140
  assert.ok(Math.abs(t.monthly - 155.56) < 0.01);
  assert.ok(Math.abs(t.interestStaying - 551.04) < 0.01);
  assert.ok(Math.abs(t.saved - 411.04) < 0.01);
});

test("no transfer to the same issuer, none for a card paid in full", () => {
  // a Citi balance can't go to another Citi card: the best offer must come from elsewhere
  const t = bestTransfer({ cardId: "citi_custom_cash", balance: 2000, apr: 28 });
  assert.ok(t && !t.toCardId.startsWith("citi_"));
  assert.equal(bestTransfer({ cardId: "apple_card" }), null);
});
