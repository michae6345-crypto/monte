// POST /api/plaid/link-token -> { link_token } for Plaid Link (transactions + liabilities).
// 503 {"error":"plaid_not_configured"} when PLAID_CLIENT_ID / PLAID_SECRET are unset.

import { CountryCode, Products } from "plaid";
import { jsonBody, notConfigured, plaidClient, plaidEnvName, plaidFailure } from "@/lib/data/plaid-server";

export async function POST(req: Request) {
  const client = plaidClient();
  if (!client) return notConfigured();

  const body = await jsonBody(req);
  const clientUserId = typeof body.clientUserId === "string" && body.clientUserId ? body.clientUserId : "monte-demo";

  try {
    const res = await client.linkTokenCreate({
      client_name: "Monte",
      language: "en",
      country_codes: [CountryCode.Us],
      user: { client_user_id: clientUserId },
      products: [Products.Transactions, Products.Liabilities],
    });
    return Response.json(
      { link_token: res.data.link_token, expiration: res.data.expiration, env: plaidEnvName() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return plaidFailure(e);
  }
}
