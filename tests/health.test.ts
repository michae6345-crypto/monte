// GET /api/health: what this instance has connected, and never a key.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/health/route";

const KEYS = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_ENV", "ANTHROPIC_API_KEY", "VERCEL_GIT_COMMIT_SHA", "NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING"];

async function withEnv(env: Record<string, string>, run: () => Promise<void>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    await run();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("health: nothing configured reads as not_configured, no commit", async () => {
  await withEnv({}, async () => {
    const body = await (await GET()).json();
    assert.equal(body.ok, true);
    assert.equal(body.paypal, "not_configured");
    assert.equal(body.paypal_webhook, "not_configured");
    assert.equal(body.paypal_extra_funding, false);
    assert.equal(body.agent, "not_configured");
    assert.equal(body.commit, null);
  });
});

test("health: sandbox keys, webhook and commit show, and no secret leaks", async () => {
  const env = {
    PAYPAL_CLIENT_ID: "cid-AAAA",
    PAYPAL_CLIENT_SECRET: "secret-BBBB",
    PAYPAL_WEBHOOK_ID: "wh-CCCC",
    PAYPAL_ENV: "sandbox",
    ANTHROPIC_API_KEY: "sk-ant-DDDD",
    NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING: "1",
    VERCEL_GIT_COMMIT_SHA: "4b719265e0c0ffee",
  };
  await withEnv(env, async () => {
    const res = await GET();
    const text = await res.text();
    const body = JSON.parse(text);
    assert.equal(body.paypal, "sandbox");
    assert.equal(body.paypal_webhook, "verified");
    assert.equal(body.paypal_extra_funding, true);
    assert.equal(body.agent, "ready");
    assert.equal(body.commit, "4b71926");
    for (const secret of ["cid-AAAA", "secret-BBBB", "wh-CCCC", "sk-ant-DDDD"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });
});

test("health: an empty commit sha (Vercel CLI deploys) reads as null, not \"\"", async () => {
  await withEnv({ VERCEL_GIT_COMMIT_SHA: "" }, async () => {
    assert.equal((await (await GET()).json()).commit, null);
  });
});

test("health: live PayPal env never counts as configured", async () => {
  await withEnv({ PAYPAL_CLIENT_ID: "x", PAYPAL_CLIENT_SECRET: "y", PAYPAL_WEBHOOK_ID: "z", PAYPAL_ENV: "live" }, async () => {
    const body = await (await GET()).json();
    assert.equal(body.paypal, "not_configured");
    assert.equal(body.paypal_webhook, "not_configured");
  });
});
