// placeFor / searchPlaces: a store name -> the category its purchases are coded as.
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeFor, searchPlaces } from "@/lib/merchants";

test("placeFor: the Plaid rules first, so look-alike names split the way issuers code them", () => {
  assert.equal(placeFor("Costco").category, "wholesale_clubs");
  assert.equal(placeFor("Costco Gas").category, "gas");
  assert.equal(placeFor("Uber Eats").category, "dining");
  assert.equal(placeFor("Uber").category, "rideshare");
  assert.equal(placeFor("Target").category, "everything_else"); // a discount store, not groceries
  assert.equal(placeFor("Whole Foods").via, "rule");
});

test("placeFor: known merchants, then words in the name, then everything else", () => {
  assert.deepEqual(placeFor("trader joes"), { name: "Trader Joe's", category: "groceries", via: "known" });
  assert.equal(placeFor("Joe's Corner Coffee").category, "dining");
  assert.equal(placeFor("Westside Pharmacy").category, "drugstores");
  assert.deepEqual(placeFor("Zzyzx Supply Co"), { name: "Zzyzx Supply Co", category: "everything_else", via: "unknown" });
});

test("searchPlaces: prefix matches first, and what was typed is always an option", () => {
  const r = searchPlaces("trad");
  assert.equal(r[0].name, "Trader Joe's");
  assert.ok(r.some((p) => p.name === "trad"));
  assert.deepEqual(searchPlaces("  "), []);
});
