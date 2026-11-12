// GET /api/health -> Render's healthCheckPath. Cheap on purpose: no Plaid call, no engine
// run, no env required, so a missing Plaid key can never take the service down.

import { plaidConfigured, plaidEnvName } from "@/lib/data/plaid-server";
import { paypalConfigured } from "@/lib/paypal/client";
import { webhookConfigured } from "@/lib/paypal/webhook";

export async function GET() {
  return Response.json(
    {
      ok: true,
      app: "monte",
      // Handy on stage: tells us whether this instance has Plaid keys, without leaking them.
      plaid: plaidConfigured() ? plaidEnvName() : "not_configured",
      paypal: paypalConfigured() ? "sandbox" : "not_configured",
      agent: process.env.ANTHROPIC_API_KEY ? "ready" : "not_configured",
      // Whether PayPal events reach /api/paypal/webhook (verified with PayPal before use), and
      // whether the Venmo and Pay Later buttons are switched on for this build.
      paypal_webhook: webhookConfigured() ? "verified" : "not_configured",
      paypal_extra_funding: process.env.NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING === "1",
      // Which commit is live, so "is the judges' URL on the latest build?" has an answer.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
