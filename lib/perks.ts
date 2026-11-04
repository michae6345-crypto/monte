// Perks first: a store where one of your cards has a credit (Uber Cash at Uber, the Dunkin'
// credit at Dunkin', Disney streaming credits on Disney+ or Hulu). The credit is free money
// that expires each period, so it comes before any card's points.
//
// Only credits a purchase at a named store triggers are listed here; portal bookings, fee
// credits and subscriptions that come with the card are left out. Amounts and periods are the
// catalog's (data/cards.json), never restated here.

import type { Holding } from "@/lib/engine";
import { card, type CardCredit } from "@/lib/engine/catalog";

/** credit name (as in cards.json, matched loosely) -> the stores it pays at */
const WHERE: [RegExp, RegExp][] = [
  // no trailing \b: a website gives "Ubereats" (ubereats.com), and Uber Cash pays for Uber Eats too
  [/^Uber Cash/i, /\buber/i],
  [/^Dining credit$/i, /grubhub|seamless|buffalo wild wings|five guys|cheesecake factory|goldbelly|wine\.com/i],
  [/^Dunkin/i, /dunkin/i],
  [/^Lyft credit/i, /\blyft\b/i],
  [/DoorDash/i, /doordash/i],
  [/^Digital entertainment credit/i, /disney|hulu|espn|nytimes|new york times|paramount|peacock|wsj|wall street journal/i],
  [/^Disney Streaming credit/i, /disney|hulu|espn/i],
  [/^lululemon credit/i, /lululemon/i],
  [/^Equinox credit/i, /equinox/i],
  [/^Home Chef credit/i, /home ?chef/i],
  [/^Peloton credit/i, /peloton/i],
  [/^StubHub/i, /stubhub|viagogo/i],
  [/^Oura Ring credit/i, /\boura\b/i],
  [/^CLEAR\+ credit/i, /\bclear\s*(\+|plus|me)\b/i],
  [/^Walmart\+ credit/i, /walmart\s*(\+|plus)/i],
];

const PER: Record<string, string> = {
  month: "a month",
  quarter: "a quarter",
  half_year: "every six months",
  year: "a year",
  billing_cycle: "a billing cycle",
};

export type Perk = { cardId: string; credit: CardCredit; per: string };

/** Credits on cards in this wallet that a purchase at `merchant` would use. */
export function perksAt(wallet: Holding[], merchant: string): Perk[] {
  const out: Perk[] = [];
  for (const h of wallet) {
    for (const credit of card(h.cardId).credits ?? []) {
      const hit = WHERE.find(([name, store]) => name.test(credit.name) && store.test(merchant));
      if (hit) out.push({ cardId: h.cardId, credit, per: PER[credit.period] ?? credit.period });
    }
  }
  return out.sort((a, b) => b.credit.amount - a.credit.amount);
}
