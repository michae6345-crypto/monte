// capsUsed(): how much of each capped bonus is used this period, counting what was actually
// charged to each card (the demo people's years end 17 Oct 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { capsUsed } from "@/lib/caps";
import { JORDAN, PARKS, SAM, yearOf } from "@/lib/data/personas";

const at = "2026-10-17";

test("caps count what was charged: Jordan's Amex Gold has dining on it, not groceries", () => {
  const caps = capsUsed(JORDAN.wallet, yearOf(JORDAN), at);
  const dining = caps.find((c) => c.cardId === "amex_gold" && c.label === "4× dining")!;
  assert.equal(dining.cap, 50000);
  assert.equal(dining.when, "this year");
  assert.ok(dining.used > 0 && dining.used < dining.cap);
  // he buys groceries on the Apple Card, so nothing counts toward the Gold's grocery cap
  assert.equal(caps.find((c) => c.label === "4× groceries"), undefined);
});

test("caps: the Parks' Blue Cash Everyday groceries, $2,659 of $6,000 (most of their groceries go on the Discover)", () => {
  const g = capsUsed(PARKS.wallet, yearOf(PARKS), at).find((c) => c.label === "3× groceries")!;
  assert.equal(g.cap, 6000);
  assert.ok(Math.abs(g.used - 2659.49) < 0.01);
});

test("caps: a card with no purchases on it has used none of its caps", () => {
  // a statement from one card, with a second card added by hand
  const txns = yearOf(JORDAN).filter((t) => t.cardUsed === "chase_freedom_unlimited");
  const caps = capsUsed([{ cardId: "chase_freedom_unlimited" }, { cardId: "amex_gold" }], txns, at);
  assert.equal(caps.filter((c) => c.cardId === "amex_gold").length, 0);
});

test("caps: a rotating card counts this quarter only", () => {
  const sam = capsUsed(SAM.wallet, yearOf(SAM), at).find((c) => c.label.includes("this quarter"))!;
  assert.equal(sam.cap, 1500);
  assert.equal(sam.when, "this quarter");
  // only 1-17 Oct is in Q4: well under the cap
  assert.ok(sam.used > 0 && sam.used < 1500);
  // the same year, read in mid-September: Q3's categories aren't on file, and Q4 hasn't started
  assert.equal(capsUsed(SAM.wallet, yearOf(SAM), "2026-09-15").filter((c) => c.label.includes("this quarter")).length, 0);
});
