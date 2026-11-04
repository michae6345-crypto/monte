// POST /api/best — which card for this store, counting interest as well as points.
// Stateless: the wallet comes with the request (card ids, and any balance and APR) and nothing
// is stored or logged. Used by the browser extension at online checkout.
//
// Body: { wallet: [{ cardId, balance?, apr? }], domain? | merchant?, category?, amount? }
// Returns: { place, pick, ranked, mode, skipped, why }

import { CARDS } from "@/lib/engine/catalog";
import type { Holding } from "@/lib/engine";
import { choose } from "@/lib/engine/interest";
import { CATEGORY_LABEL, placeFor, type Place } from "@/lib/merchants";
import { shortName } from "@/lib/card-name";
import { why } from "@/lib/explain";
import { perksAt } from "@/lib/perks";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};
const KNOWN = new Set(CARDS.map((c) => c.id));

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const bad = (message: string) => Response.json({ error: "bad_request", message }, { status: 400, headers: CORS });

/** "www.amazon.com" -> "amazon"; "shop.lululemon.com" -> "lululemon"; "uber.com" -> "uber". */
function storeFromDomain(domain: string): string {
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts[0] ?? host;
  // co.uk-style endings keep one more label; otherwise the label before the TLD is the brand
  const sld = parts[parts.length - 2];
  return sld.length <= 3 && parts.length > 2 ? parts[parts.length - 3] : sld;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("JSON body required");
  }
  if (!Array.isArray(body.wallet) || body.wallet.length === 0 || body.wallet.length > 25) return bad("wallet: 1 to 25 cards");
  const wallet: Holding[] = [];
  for (const h of body.wallet as Record<string, unknown>[]) {
    if (!h || typeof h.cardId !== "string" || !KNOWN.has(h.cardId)) continue;
    const balance = Number(h.balance ?? 0);
    const apr = h.apr == null ? undefined : Number(h.apr);
    wallet.push({ cardId: h.cardId, ...(balance > 0 ? { balance } : {}), ...(apr && apr > 0 ? { apr } : {}) });
  }
  if (!wallet.length) return bad("none of those card ids are in the catalog");

  const amount = Number(body.amount ?? 50);
  if (!(amount > 0 && amount < 1e6)) return bad("amount must be a positive number");

  let place: Place;
  if (typeof body.category === "string" && CATEGORY_LABEL[body.category]) {
    const name = typeof body.merchant === "string" && body.merchant ? body.merchant : CATEGORY_LABEL[body.category];
    place = { name, category: body.category, via: "rule" };
  } else if (typeof body.merchant === "string" && body.merchant.trim()) {
    place = placeFor(body.merchant);
  } else if (typeof body.domain === "string" && body.domain.trim()) {
    const raw = storeFromDomain(body.domain);
    const store = raw.charAt(0).toUpperCase() + raw.slice(1);
    const p = placeFor(store);
    // a shop we can't place is still a website: most cards code that as online shopping
    place = p.via === "unknown" ? { name: store, category: "online_retail", via: "words" } : p;
  } else return bad("one of domain, merchant or category is required");

  const d = choose(wallet, { date: new Date().toISOString().slice(0, 10), merchant: place.name, category: place.category, amount });
  const view = (c: (typeof d.ranked)[number]) => ({
    cardId: c.cardId,
    name: shortName(c.cardId),
    mult: c.mult,
    rule: c.rule,
    reward: Math.round(c.reward * 100) / 100,
    interest: Math.round(c.interest * 100) / 100,
    net: Math.round(c.net * 100) / 100,
    apr: c.apr,
    carries: c.carries,
  });
  return Response.json(
    {
      place: { ...place, label: CATEGORY_LABEL[place.category] },
      amount,
      pick: view(d.pick),
      ranked: d.ranked.map(view),
      mode: d.mode,
      skipped: d.skipped ? view(d.skipped) : null,
      why: why(d),
      capNotes: d.capNotes,
      // a credit one of the cards has here (Uber Cash, the Dunkin' credit...): use it before any points
      perks: perksAt(wallet, place.name).map((p) => ({ cardId: p.cardId, name: shortName(p.cardId), credit: p.credit.name, amount: p.credit.amount, per: p.per })),
    },
    { headers: CORS },
  );
}
