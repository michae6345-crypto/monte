// Where are you paying? A store name -> the spending category the card networks will see.
//
// Order of trust: data/category_map.json's merchant rules (the same ones every Plaid
// transaction goes through), then the merchants the demo people shop at, then a short list
// of common US chains, then words in the name ("cafe", "market", "fuel"), then "everything
// else". Each answer says which of those it came from, so the app can say how sure it is.

import { categorize } from "@/lib/data/plaid";
import { PERSONAS, yearOf } from "@/lib/data/personas";

export type Place = { name: string; category: string; via: "rule" | "known" | "words" | "unknown" };

export const CATEGORY_LABEL: Record<string, string> = {
  groceries: "Groceries",
  dining: "Dining",
  gas: "Gas",
  online_retail: "Online shopping",
  airfare: "Flights",
  hotels: "Hotels",
  rideshare: "Rideshare",
  transit: "Transit",
  streaming: "Streaming",
  drugstores: "Pharmacy",
  wholesale_clubs: "Warehouse club",
  home_improvement: "Home improvement",
  entertainment: "Entertainment",
  phone: "Phone bill",
  utilities: "Utilities",
  rent: "Rent",
  ev_charging: "EV charging",
  online_groceries: "Grocery delivery",
  travel_portal: "Travel portal",
  everything_else: "Anything else",
};

/** The chips on the Pay screen, most common first. */
export const QUICK_CATEGORIES = ["groceries", "dining", "gas", "online_retail", "rideshare", "drugstores", "airfare", "hotels", "streaming", "everything_else"];

// Common chains the demo data doesn't cover. Only ones whose category is not in doubt.
const CHAINS: [string, string][] = [
  ["Walmart", "everything_else"],
  ["Safeway", "groceries"],
  ["Kroger", "groceries"],
  ["Albertsons", "groceries"],
  ["Publix", "groceries"],
  ["Aldi", "groceries"],
  ["Wegmans", "groceries"],
  ["H-E-B", "groceries"],
  ["Stater Bros.", "groceries"],
  ["Gelson's", "groceries"],
  ["Erewhon", "groceries"],
  ["McDonald's", "dining"],
  ["Chick-fil-A", "dining"],
  ["Panera Bread", "dining"],
  ["Subway", "dining"],
  ["Domino's", "dining"],
  ["Taco Bell", "dining"],
  ["Shake Shack", "dining"],
  ["Cava", "dining"],
  ["Dunkin'", "dining"],
  ["Peet's Coffee", "dining"],
  ["Exxon", "gas"],
  ["Valero", "gas"],
  ["BP", "gas"],
  ["Circle K", "gas"],
  ["Lowe's", "home_improvement"],
  ["Best Buy", "everything_else"],
  ["Apple Store", "everything_else"],
  ["Sephora", "everything_else"],
  ["Nordstrom", "everything_else"],
  ["Macy's", "everything_else"],
  ["TJ Maxx", "everything_else"],
  ["eBay", "online_retail"],
  ["Etsy", "online_retail"],
  ["Instacart", "online_groceries"],
  ["American Airlines", "airfare"],
  ["JetBlue", "airfare"],
  ["Expedia", "travel_portal"],
  ["Booking.com", "hotels"],
  ["Holiday Inn", "hotels"],
  ["Regal Cinemas", "entertainment"],
  ["Cinemark", "entertainment"],
  ["Sam's Club", "wholesale_clubs"],
  ["Rite Aid", "drugstores"],
];

let directory: Map<string, string> | null = null;
function known(): Map<string, string> {
  if (directory) return directory;
  directory = new Map();
  for (const p of PERSONAS) for (const t of yearOf(p)) if (!directory.has(t.merchant)) directory.set(t.merchant, t.category);
  for (const [n, c] of CHAINS) if (!directory.has(n)) directory.set(n, c);
  return directory;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Words in a store's own name that say what it is, checked last.
const WORDS: [RegExp, string][] = [
  [/\b(fuel|gas station|petrol|chevron|shell)\b/i, "gas"],
  [/\b(supermarket|grocer|grocery|market|mercado|foods?\b)/i, "groceries"],
  [/\b(cafe|café|coffee|bakery|pizza|pizzeria|grill|kitchen|taco|tacos|taqueria|burger|sushi|ramen|bbq|restaurant|diner|bistro|bar|pub|tea|boba|deli|eatery|noodle|pho|thai|wings)\b/i, "dining"],
  [/\b(pharmacy|drug ?store|apothecary)\b/i, "drugstores"],
  [/\b(hotel|inn|resort|motel|suites)\b/i, "hotels"],
  [/\b(airlines?|airways)\b/i, "airfare"],
  [/\b(hardware|lumber)\b/i, "home_improvement"],
  [/\b(cinema|theatre|theater|bowling|arcade)\b/i, "entertainment"],
  [/\b(charging|supercharger)\b/i, "ev_charging"],
];

/** Which category a purchase at this store will be coded as. */
export function placeFor(name: string): Place {
  const n = name.trim();
  if (!n) return { name: n, category: "everything_else", via: "unknown" };
  // 1. the Plaid rules (they catch "UBER EATS" vs "UBER", gas at Costco, and so on)
  const d = categorize({ transaction_id: "lookup", account_id: "", date: "2026-01-01", amount: 1, name: n, merchant_name: n });
  if (d.via === "override" && d.category) return { name: n, category: d.category, via: "rule" };
  // 2. a merchant we know, by exact (normalised) name
  const k = key(n);
  for (const [m, c] of known()) if (key(m) === k) return { name: m, category: c, via: "known" };
  // 3. words in the name
  for (const [re, c] of WORDS) if (re.test(n)) return { name: n, category: c, via: "words" };
  return { name: n, category: "everything_else", via: "unknown" };
}

/** Type-ahead over the stores we know, best match first. */
export function searchPlaces(q: string, limit = 6): Place[] {
  const k = key(q);
  if (!k) return [];
  const hits: { p: Place; score: number }[] = [];
  for (const [m] of known()) {
    const mk = key(m);
    const at = mk.indexOf(k);
    if (at < 0) continue;
    hits.push({ p: { name: m, category: placeFor(m).category, via: "known" }, score: (at === 0 ? 0 : 10) + mk.length / 100 });
  }
  hits.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
  const out = hits.slice(0, limit).map((h) => h.p);
  // whatever they typed is always an option too, categorised as best we can
  if (!out.some((p) => key(p.name) === k)) out.push(placeFor(q));
  return out.slice(0, limit);
}

// ---------- near me: OpenStreetMap, through the public Overpass API ----------

export type Nearby = Place & { meters: number; osm: string };

/** OpenStreetMap tags -> category, for stores the name alone doesn't place. */
function categoryFromTags(tags: Record<string, string>): string {
  const shop = tags.shop ?? "";
  const amenity = tags.amenity ?? "";
  if (/^(supermarket|grocery|greengrocer|butcher|deli|health_food|organic)$/.test(shop)) return "groceries";
  if (shop === "wholesale") return "wholesale_clubs";
  if (/^(chemist|pharmacy)$/.test(shop) || amenity === "pharmacy") return "drugstores";
  if (/^(doityourself|hardware|trade)$/.test(shop)) return "home_improvement";
  if (/^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream|biergarten)$/.test(amenity)) return "dining";
  if (amenity === "fuel") return "gas";
  if (amenity === "charging_station") return "ev_charging";
  if (/^(cinema|theatre)$/.test(amenity)) return "entertainment";
  if (/^(hotel|motel|guest_house|hostel)$/.test(tags.tourism ?? "")) return "hotels";
  return "everything_else";
}

const metersBetween = (a: [number, number], b: [number, number]) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** Named stores within `radius` meters, nearest first. Browser only; throws on network errors. */
export async function nearbyPlaces(lat: number, lon: number, radius = 250): Promise<Nearby[]> {
  const around = `(around:${radius},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const q = `[out:json][timeout:12];(nwr${around}["shop"]["name"];nwr${around}["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream|fuel|pharmacy|charging_station|cinema|theatre)$"]["name"];nwr${around}["tourism"~"^(hotel|motel)$"]["name"];);out center 60;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`OpenStreetMap answered ${res.status}`);
  const data = (await res.json()) as { elements?: OsmElement[] };
  const seen = new Set<string>();
  const out: Nearby[] = [];
  for (const e of data.elements ?? []) {
    const tags = e.tags ?? {};
    const name = tags.brand ?? tags.name;
    const pos = e.center ?? (e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : null);
    if (!name || !pos) continue;
    const meters = Math.round(metersBetween([lat, lon], [pos.lat, pos.lon]));
    const dedupe = key(name) + Math.round(meters / 40);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    // the name first (a Costco's tags say "wholesale", its name says Costco; a Shell is gas)
    const byName = placeFor(name);
    const category = byName.via === "rule" || byName.via === "known" ? byName.category : categoryFromTags(tags);
    out.push({ name, category, via: byName.via === "unknown" ? "words" : byName.via, meters, osm: `${e.type}/${e.id}` });
  }
  return out.sort((a, b) => a.meters - b.meters).slice(0, 20);
}
