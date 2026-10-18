// POST /api/plaid/sandbox -> the demo shortcut: skip the Link UI entirely.
// sandboxPublicTokenCreate(ins_109508, [transactions, liabilities]) -> exchange -> cookie.
// This is the call we make on stage; /api/plaid/data is what we call next.
//
// Sandbox-only: sandboxPublicTokenCreate does not exist outside the sandbox environment,
// and the access_token it yields is stored in an httpOnly cookie (see PLAID_COOKIE).

import { cookies } from "next/headers";
import { Products } from "plaid";
import {
  accessTokenCookie,
  badRequest,
  jsonBody,
  notConfigured,
  plaidClient,
  plaidEnvName,
  plaidFailure,
} from "@/lib/data/plaid-server";

/** First Platypus Bank: the Plaid sandbox institution that supports both products. */
const DEFAULT_INSTITUTION = "ins_109508";

export async function POST(req: Request) {
  const client = plaidClient();
  if (!client) return notConfigured();
  if (plaidEnvName() !== "sandbox") {
    return badRequest("/api/plaid/sandbox only works when PLAID_ENV=sandbox; use /api/plaid/link-token instead");
  }

  const body = await jsonBody(req);
  const institutionId =
    typeof body.institution_id === "string" && body.institution_id ? body.institution_id : DEFAULT_INSTITUTION;

  try {
    const created = await client.sandboxPublicTokenCreate({
      institution_id: institutionId,
      initial_products: [Products.Transactions, Products.Liabilities],
    });
    const exchanged = await client.itemPublicTokenExchange({ public_token: created.data.public_token });
    (await cookies()).set(accessTokenCookie(req, exchanged.data.access_token));
    return Response.json(
      { linked: true, institution_id: institutionId, item_id: exchanged.data.item_id, source: "plaid-sandbox" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return plaidFailure(e);
  }
}
