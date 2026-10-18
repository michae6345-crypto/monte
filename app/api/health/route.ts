// GET /api/health -> Render's healthCheckPath. Cheap on purpose: no Plaid call, no engine
// run, no env required, so a missing Plaid key can never take the service down.

import { plaidConfigured, plaidEnvName } from "@/lib/data/plaid-server";

export async function GET() {
  return Response.json(
    {
      ok: true,
      app: "monte",
      // Handy on stage: tells us whether this instance has Plaid keys, without leaking them.
      plaid: plaidConfigured() ? plaidEnvName() : "not_configured",
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
