// next.config.ts: every route gets the security headers, and none of them would block PayPal.

import { test } from "node:test";
import assert from "node:assert/strict";
import config from "@/next.config";

async function headerMap() {
  assert.ok(config.headers, "next.config.ts sets headers()");
  const rules = await config.headers();
  const all = rules.find((r) => r.source === "/:path*");
  assert.ok(all, "one rule covers every path");
  return new Map(all.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

test("headers: nosniff, strict referrer and no framing by other sites", async () => {
  const h = await headerMap();
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(h.get("content-security-policy"), "frame-ancestors 'self'");
  assert.equal(config.poweredByHeader, false);
});

test("headers: nothing that would stop the PayPal JS SDK", async () => {
  const h = await headerMap();
  const csp = h.get("content-security-policy") ?? "";
  // A script-src or default-src here would block https://www.paypal.com/web-sdk/... and its frames.
  for (const directive of ["script-src", "default-src", "frame-src", "connect-src"]) assert.ok(!csp.includes(directive), `no ${directive}`);
  const perms = h.get("permissions-policy") ?? "";
  assert.ok(!/payment=\(\)/.test(perms), "payment stays allowed");
});
