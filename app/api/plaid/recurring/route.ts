// GET /api/plaid/recurring -> { recurring, totalPerYear, source: "plaid-recurring" }
//
// The bank's own recurring-charge detection (Plaid /transactions/recurring/get), outflow
// streams only, tombstoned streams dropped, each tied to the card it bills to and
// normalized to a yearly cost. Same shape as the engine's Subscription, so the Leaks view
// can use it in place of subscriptions(txns). Sandbox only: 503 without keys, 409 when
// no item is linked (POST /api/plaid/sandbox first).

import { mapRecurring } from "@/lib/data/plaid-recurring";
import { PLAID_COOKIE, notConfigured, notLinked, plaidClient, plaidEnvName, plaidFailure } from "@/lib/data/plaid-server";
import { fetchRecurringStreams } from "@/lib/data/plaid-sync";

/** The access-token cookie, read off the request itself (no next/headers, so the route
 *  also runs under plain node in tests). */
function accessTokenFrom(req: Request): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === PLAID_COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export async function GET(req: Request) {
  if (plaidEnvName() !== "sandbox") return notConfigured();
  const client = plaidClient();
  if (!client) return notConfigured();

  const accessToken = accessTokenFrom(req);
  if (!accessToken) return notLinked();

  try {
    const { accounts, recurring } = await fetchRecurringStreams(client, accessToken);
    const charges = mapRecurring(recurring, { accounts });
    const totalPerYear = Math.round(charges.reduce((a, c) => a + c.perYear, 0) * 100) / 100;
    return Response.json(
      { recurring: charges, totalPerYear, source: "plaid-recurring" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return plaidFailure(e);
  }
}
