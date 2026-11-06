// Lithic's sandbox, for a real Monte card on a real (test) card network. Server only.
//
// Not yet run against Lithic: there's no LITHIC_API_KEY on this project. The calls follow
// Lithic's public API and its asa-demo-node example (cards.create, transactions.
// simulateAuthorization, responderEndpoints.create). Every route that uses this answers
// 503 {"error":"issuer_not_configured"} without the key, the same pattern as Plaid.
//
//   LITHIC_API_KEY          sandbox API key (dashboard, free)
//   LITHIC_WEBHOOK_SECRET   the ASA responder's signing secret (checked in /api/card/authorize)

const BASE = process.env.LITHIC_ENV === "production" ? "https://api.lithic.com/v1" : "https://sandbox.lithic.com/v1";

export const lithicConfigured = () => Boolean(process.env.LITHIC_API_KEY);

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: process.env.LITHIC_API_KEY ?? "", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`Lithic ${path}: ${res.status} ${data.message ?? ""}`.trim());
  return data;
}

/** A virtual card whose memo carries the wallet ("monte:w=..."), so the responder knows whose it is. */
export function issueCard(memo: string) {
  return call<{ token: string; last_four: string; pan?: string; state: string }>("/cards", { type: "VIRTUAL", memo: memo.slice(0, 255), state: "OPEN" });
}

/** A test purchase on the sandbox network: Lithic sends it to the enrolled ASA responder. */
export function simulateAuthorization(p: { pan: string; amountCents: number; descriptor: string; mcc: string }) {
  return call<{ token: string; debugging_request_id?: string }>("/simulate/authorize", { pan: p.pan, amount: p.amountCents, descriptor: p.descriptor, mcc: p.mcc });
}

/** Point Lithic's Auth Stream Access at this deployment's /api/card/authorize. */
export function enrollResponder(url: string) {
  return call<{ enrolled: boolean }>("/responder_endpoints", { type: "AUTH_STREAM_ACCESS", url });
}
