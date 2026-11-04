// capsUsed(): how much of each capped bonus is used this period, on the demo people's years
// (which end 17 Oct 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { capsUsed } from "@/lib/caps";
import { JORDAN, PARKS, SAM, yearOf } from "@/lib/data/personas";

const at = "2026-10-17";

test("caps: Jordan's Amex Gold, 4x groceries and dining toward their yearly caps", () => {
  const caps = capsUsed(JORDAN.wallet, yearOf(JORDAN), at);
  const groceries = caps.find((c) => c.cardId === "amex_gold" && c.label === "4x groceries")!;
  assert.equal(groceries.cap, 25000);
  assert.equal(groceries.when, "this year");
  assert.ok(groceries.used > 0 && groceries.used < groceries.cap);
  assert.ok(caps.some((c) => c.label === "4x dining" && c.cap === 50000));
});

test("caps: the Parks are past Blue Cash Everyday's $6,000 grocery cap", () => {
  const g = capsUsed(PARKS.wallet, yearOf(PARKS), at).find((c) => c.label === "3x groceries")!;
  assert.equal(g.cap, 6000);
  assert.ok(g.used > g.cap);
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
