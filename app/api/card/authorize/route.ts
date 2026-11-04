// POST /api/card/authorize: the Monte card's authorization responder.
//
// An issuing platform calls this for every purchase on a Monte card, before the terminal says
// approved: Lithic's Auth Stream Access posts { token, amount (cents), merchant: { descriptor,
// mcc, city, state }, card: { token, memo } } and waits for { result, token }. Monte reads the
// network's MCC, picks the card to play (lib/card/authorize.ts) and approves.
//
// Whose wallet: the card's memo carries it ("monte:w=<code>", the same code as the app's
// "copy to another device" link), else MONTE_CARD_WALLET (one demo card), else a `monte_wallet`
// array in the body (the /card page's simulator). Nothing is stored except a short in-memory log
// of recent decisions for the demo (GET), which resets whenever the server does.
//
// With LITHIC_WEBHOOK_SECRET set, requests must carry a valid Standard Webhooks signature
// (webhook-id, webhook-timestamp, webhook-signature: HMAC-SHA256 of "id.timestamp.body").
// Send `x-monte-debug: 1` to get Monte's decision in the response; Lithic gets the plain answer.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Holding } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { decide, fromLithic, type Decision } from "@/lib/card/authorize";
import { walletFromHash } from "@/components/app/share";

const KNOWN = new Set(CARDS.map((c) => c.id));
const LOG: (Decision & { at: string; via: string })[] = [];

function walletFromCode(s: string | undefined): Holding[] | null {
  if (!s) return null;
  const code = s.replace(/^monte:/, "").replace(/^.*#/, "");
  return walletFromHash("#" + (code.startsWith("w=") ? code : "w=" + code));
}

function verified(req: Request, body: string): boolean {
  const secret = process.env.LITHIC_WEBHOOK_SECRET;
  if (!secret) return true;
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sigs = req.headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const want = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const got = Buffer.from(s.replace(/^v1,/, ""), "base64");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

export async function POST(req: Request) {
  const text = await req.text();
  if (!verified(req, text)) return Response.json({ error: "bad_signature" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const auth = fromLithic(body);

  let via = "memo";
  let wallet = walletFromCode(auth.cardMemo);
  if (!wallet) {
    via = "env";
    wallet = walletFromCode(process.env.MONTE_CARD_WALLET);
  }
  if (!wallet && Array.isArray(body.monte_wallet)) {
    via = "request";
    wallet = (body.monte_wallet as Holding[])
      .filter((h) => h && KNOWN.has(h.cardId))
      .slice(0, 25)
      .map((h) => ({ cardId: h.cardId, ...(Number(h.balance) > 0 ? { balance: Number(h.balance) } : {}), ...(Number(h.apr) > 0 ? { apr: Number(h.apr) } : {}) }));
  }

  const d = decide(wallet, auth);
  LOG.unshift({ ...d, at: new Date().toISOString(), via: wallet ? via : "none" });
  LOG.length = Math.min(LOG.length, 50);

  // Lithic's answer shape (lithic-com/asa-demo-node): result, the request's token, AVS, balance
  const answer = { result: d.result, token: auth.token, avs_result: "MATCH", balance: { amount: 0, available: 0 } };
  return Response.json(req.headers.get("x-monte-debug") === "1" ? { ...answer, monte: d } : answer, {
    headers: { "cache-control": "no-store" },
  });
}

/** The recent decisions this server instance made, newest first (for the /card page). */
export function GET() {
  return Response.json({ decisions: LOG }, { headers: { "cache-control": "no-store" } });
}
