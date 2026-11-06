// The "copy to another device" link: cards in, the same cards out; nothing else gets through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { walletFromHash, walletLink } from "@/components/app/share";

test("share link: round-trips cards, balances and APRs", () => {
  const wallet = [{ cardId: "amex_gold" }, { cardId: "apple_card", balance: 2800, apr: 26.24 }];
  const url = walletLink(wallet, "https://monte.example");
  assert.ok(url.startsWith("https://monte.example/app#w="));
  assert.deepEqual(walletFromHash(new URL(url).hash), wallet);
});

test("share link: unknown cards, junk and other hashes are ignored", () => {
  const url = walletLink([{ cardId: "not_a_card" }, { cardId: "citi_double_cash" }], "https://m.example");
  assert.deepEqual(walletFromHash(new URL(url).hash), [{ cardId: "citi_double_cash" }]);
  assert.equal(walletFromHash("#cards"), null);
  assert.equal(walletFromHash("#w=%%%"), null);
  assert.equal(walletFromHash("#w=bm90IGpzb24"), null); // base64 of "not json"
});
