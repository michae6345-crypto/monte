// GET /api/cards: the catalog's card ids, for apps calling /api/best. Public card facts only
// (name, issuer, network, annual fee, the source page and when it was checked).
import { CARDS } from "@/lib/engine/catalog";
import { shortName } from "@/lib/card-name";

export function GET() {
  return Response.json(
    {
      cards: CARDS.map((c) => ({
        id: c.id,
        name: c.name,
        short: shortName(c.id),
        issuer: c.issuer,
        network: c.network,
        annual_fee: c.annual_fee,
        source: c.source_urls?.[0] ?? null,
        checked: c.checked ?? null,
      })),
    },
    { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } },
  );
}
