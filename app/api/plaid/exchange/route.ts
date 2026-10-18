// POST /api/plaid/exchange { public_token } -> exchanges it for an access_token and puts
// the token in an httpOnly cookie.
//
// Sandbox-only hackathon shortcut: the access_token lives in a cookie, not a database.
// See the comment on PLAID_COOKIE in lib/data/plaid-server.ts - a real deployment keeps
// access tokens server-side, encrypted, keyed by a user id.

import { cookies } from "next/headers";
import { accessTokenCookie, badRequest, jsonBody, notConfigured, plaidClient, plaidFailure } from "@/lib/data/plaid-server";

export async function POST(req: Request) {
  const client = plaidClient();
  if (!client) return notConfigured();

  const body = await jsonBody(req);
  const publicToken = body.public_token ?? body.publicToken;
  if (typeof publicToken !== "string" || !publicToken) return badRequest("public_token is required");

  try {
    const res = await client.itemPublicTokenExchange({ public_token: publicToken });
    (await cookies()).set(accessTokenCookie(req, res.data.access_token));
    return Response.json(
      { linked: true, item_id: res.data.item_id },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return plaidFailure(e);
  }
}
