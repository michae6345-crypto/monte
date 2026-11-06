// POST /api/card/stripe: the Monte card's responder on Stripe Issuing.
//
// Stripe sends `issuing_authorization.request` synchronously for every purchase on an issued card
// and waits up to 2 seconds for {"approved": true|false}. Same decision as /api/card/authorize
// (lib/card/authorize.ts); the wallet code rides in the card's metadata.monte.
//
// With STRIPE_WEBHOOK_SECRET set, the Stripe-Signature header must verify (t=<ts>,v1=<hex HMAC-
// SHA256 of "ts.body">, five-minute window). Built to Stripe's documented shapes, not yet run
// against Stripe: there's no key on this project. `x-monte-debug: 1` adds Monte's decision.

import { createHmac, timingSafeEqual } from "node:crypto";
import { decide, fromStripe, walletFromCode } from "@/lib/card/authorize";
import { record } from "@/lib/card/log";

function verified(header: string | null, body: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest();
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = Buffer.from(p.slice(3), "hex");
      return got.length === want.length && timingSafeEqual(got, want);
    });
}

export async function POST(req: Request) {
  const text = await req.text();
  if (!verified(req.headers.get("stripe-signature"), text)) return Response.json({ error: "bad_signature" }, { status: 400 });
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(text || "{}");
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  // every other event (authorization.created, transaction.created...) is acknowledged and ignored
  if (event.type !== "issuing_authorization.request") return Response.json({ received: true });

  const auth = fromStripe(event);
  const wallet = walletFromCode(auth.cardMemo) ?? walletFromCode(process.env.MONTE_CARD_WALLET);
  const d = decide(wallet, auth);
  record({ ...d, at: new Date().toISOString(), via: wallet ? (auth.cardMemo ? "metadata" : "env") : "none", issuer: "stripe" });
  const body = req.headers.get("x-monte-debug") === "1" ? { approved: true, monte: d } : { approved: true };
  return Response.json(body, { headers: { "cache-control": "no-store", ...(process.env.STRIPE_API_VERSION ? { "Stripe-Version": process.env.STRIPE_API_VERSION } : {}) } });
}
