// apportion(): the receipt's cents add up to its own total, for every demo person.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apportion } from "@/lib/apportion";
import { receipt } from "@/lib/engine";
import { PERSONAS, yearOf } from "@/lib/data/personas";

const cents = (n: number) => Math.round(n * 100);

test("apportion: parts sum to the rounded whole", () => {
  // 0.333 × 3 = 0.999 -> 1.00, split 0.34 / 0.33 / 0.33
  assert.deepEqual(apportion([0.333, 0.333, 0.333]), [0.34, 0.33, 0.33]);
  assert.deepEqual(apportion([1.005, 2]), [1.01, 2]);
  assert.deepEqual(apportion([]), []);
});

for (const p of PERSONAS) {
  test(`${p.name}: the printed card nets add up to the receipt's NET, to the cent`, () => {
    const r = receipt(p.wallet, yearOf(p));
    const rew = apportion(r.perCard.map((c) => c.rewards));
    const int = apportion(r.perCard.map((c) => c.interest));
    const nets = r.perCard.map((c, k) => cents(rew[k] + c.credits - c.fee - int[k]));
    assert.equal(nets.reduce((a, b) => a + b, 0), cents(r.net));
    assert.equal(rew.reduce((a, b) => a + cents(b), 0), cents(r.rewards));
  });
}
