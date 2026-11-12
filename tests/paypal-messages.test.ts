// The PayPal reference appended to failure notes: only PayPal's plain debug_id, never other text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { withPayPalRef } from "@/lib/paypal/messages";

test("messages: PayPal's debug_id is quoted after the note", () => {
  assert.equal(withPayPalRef("PayPal hit a problem.", { error: "paypal_error", debug_id: "f1a2b3c4d5e6f" }), "PayPal hit a problem. PayPal reference: f1a2b3c4d5e6f.");
});

test("messages: no id, or anything that isn't a plain id, leaves the note alone", () => {
  for (const data of [null, undefined, "x", {}, { debug_id: 42 }, { debug_id: "" }, { debug_id: "<script>" }, { debug_id: "a b c d e f" }, { debug_id: "x".repeat(41) }]) {
    assert.equal(withPayPalRef("Note.", data), "Note.");
  }
});
