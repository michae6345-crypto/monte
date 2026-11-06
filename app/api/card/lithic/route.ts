// /api/card/lithic: the Monte card on Lithic's sandbox network (see lib/card/lithic.ts).
//   GET                                   -> { configured, env }
//   POST { action: "issue", wallet }      -> a virtual card whose memo carries the wallet
//   POST { action: "simulate", pan, amount, descriptor, mcc } -> a test purchase on that card;
//        Lithic then calls /api/card/authorize, and the decision shows in GET /api/card/authorize
//   POST { action: "enroll" }             -> points Lithic's ASA at this deployment's responder
// 503 {"error":"issuer_not_configured"} without LITHIC_API_KEY.

import { lithicConfigured, enrollResponder, issueCard, simulateAuthorization } from "@/lib/card/lithic";
import { walletLink } from "@/components/app/share";
import { CARDS } from "@/lib/engine/catalog";

const KNOWN = new Set(CARDS.map((c) => c.id));
const no = () => Response.json({ error: "issuer_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });

export function GET() {
  return Response.json({ configured: lithicConfigured(), env: process.env.LITHIC_ENV === "production" ? "production" : "sandbox" }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!lithicConfigured()) return no();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "issue") {
      const wallet = (Array.isArray(body.wallet) ? body.wallet : []).filter((h: { cardId?: string }) => h && KNOWN.has(String(h.cardId)));
      if (!wallet.length) return Response.json({ error: "wallet required" }, { status: 400 });
      const memo = "monte:" + walletLink(wallet, "x").split("#")[1];
      const card = await issueCard(memo);
      return Response.json({ token: card.token, last_four: card.last_four, pan: card.pan, state: card.state });
    }
    if (body.action === "simulate") {
      const r = await simulateAuthorization({ pan: String(body.pan ?? ""), amountCents: Math.round(Number(body.amount ?? 0) * 100), descriptor: String(body.descriptor ?? ""), mcc: String(body.mcc ?? "") });
      return Response.json(r);
    }
    if (body.action === "enroll") {
      const url = new URL("/api/card/authorize", req.url).toString();
      return Response.json({ ...(await enrollResponder(url)), url });
    }
    return Response.json({ error: "action must be issue, simulate or enroll" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: "lithic_error", message: (e as Error).message }, { status: 502 });
  }
}
