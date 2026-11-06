// POST /api/plaid/forget -> removes the linked Plaid item (so Plaid stops pulling its data)
// and clears the access-token cookie. Safe to call when nothing is linked.

import { cookies } from "next/headers";
import { PLAID_COOKIE, plaidClient } from "@/lib/data/plaid-server";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(PLAID_COOKIE)?.value;
  let removed = false;
  const client = plaidClient();
  if (token && client) {
    try {
      await client.itemRemove({ access_token: token });
      removed = true;
    } catch {
      // the item may already be gone (or the keys rotated); the cookie goes either way
    }
  }
  jar.delete(PLAID_COOKIE);
  return Response.json({ forgotten: true, removed }, { headers: { "cache-control": "no-store" } });
}
