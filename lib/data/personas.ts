// Seeded, synthetic spending years for the demo people. Real LA merchants, made-up
// people. Deterministic: the same seed always produces the same year.

import type { Holding, Txn } from "@/lib/engine";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Line = {
  category: string;
  merchants: string[];
  perMonth: number; // purchases a month (fractional = some months)
  amount: [number, number]; // min, max dollars
  fixed?: boolean; // same merchant and amount each month (subscriptions, bills)
};

export type Persona = {
  id: string;
  name: string;
  blurb: string;
  wallet: Holding[];
  /** Which card this person actually reaches for, by category. Probabilities per card. */
  habit: (category: string, merchant: string, r: () => number) => string;
  lines: Line[];
  seed: number;
};

const START = new Date("2025-10-18T12:00:00Z");
const DAYS = 365;

export function yearOf(p: Persona): Txn[] {
  const r = rng(p.seed);
  const out: Txn[] = [];
  let n = 0;
  for (let m = 0; m < 12; m++) {
    for (const line of p.lines) {
      const count = Math.floor(line.perMonth) + (r() < line.perMonth % 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const day = line.fixed ? 3 + (line.merchants[0].length % 20) : Math.floor(r() * 30);
        const d = new Date(START.getTime() + (m * 30.4 + day) * 86400000);
        if ((d.getTime() - START.getTime()) / 86400000 >= DAYS) continue;
        const merchant = line.fixed ? line.merchants[i % line.merchants.length] : line.merchants[Math.floor(r() * line.merchants.length)];
        const [lo, hi] = line.amount;
        const amount = line.fixed ? lo : Math.round((lo + (hi - lo) * Math.pow(r(), 1.4)) * 100) / 100;
        out.push({
          id: `${p.id}-${n++}`,
          date: d.toISOString().slice(0, 10),
          merchant,
          amount,
          category: line.category,
          cardUsed: p.habit(line.category, merchant, r),
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const LA_DINING = ["Sweetgreen", "Tacos 1986", "Howlin' Ray's", "Blue Bottle Coffee", "Erewhon Cafe", "In-N-Out Burger", "Joe's Pizza", "Sugarfish", "Philz Coffee", "Guisados", "Uber Eats", "DoorDash"];
const LA_GROCERY = ["Trader Joe's", "Ralphs", "Whole Foods Market", "Vons", "Sprouts Farmers Market", "H Mart"];
const LA_GAS = ["Mobil", "Shell", "Chevron", "Arco", "76"];

export const JORDAN: Persona = {
  id: "jordan",
  name: "Jordan",
  blurb: "24 · first job in LA · three cards",
  seed: 24,
  wallet: [
    { cardId: "chase_freedom_unlimited" },
    { cardId: "amex_gold", creditsUsed: { "Uber Cash": 60, "Dining credit": 20 } },
    { cardId: "apple_card", balance: 2800, apr: 26.24 },
  ],
  habit: (category, merchant, r) => {
    // Apple Pay for almost everything; the Amex comes out at nicer restaurants.
    if (category === "dining" && r() < 0.35) return "amex_gold";
    if (category === "airfare" || category === "hotels") return "chase_freedom_unlimited";
    if (r() < 0.15) return "chase_freedom_unlimited";
    return "apple_card";
  },
  lines: [
    { category: "dining", merchants: LA_DINING, perMonth: 18, amount: [9, 58] },
    { category: "groceries", merchants: LA_GROCERY, perMonth: 6, amount: [28, 110] },
    { category: "gas", merchants: LA_GAS, perMonth: 3, amount: [38, 62] },
    { category: "rideshare", merchants: ["Uber", "Lyft"], perMonth: 4, amount: [12, 34] },
    { category: "streaming", merchants: ["Netflix", "Spotify", "Hulu"], perMonth: 3, amount: [15.49, 15.49], fixed: true },
    { category: "online_retail", merchants: ["Amazon", "Target.com", "Apple", "Nike"], perMonth: 4, amount: [14, 120] },
    { category: "drugstores", merchants: ["CVS Pharmacy", "Walgreens"], perMonth: 1.5, amount: [8, 40] },
    { category: "entertainment", merchants: ["AMC Theatres", "Ticketmaster", "The Comedy Store"], perMonth: 1.2, amount: [18, 95] },
    { category: "phone", merchants: ["T-Mobile"], perMonth: 1, amount: [70, 70], fixed: true },
    { category: "utilities", merchants: ["Spectrum"], perMonth: 1, amount: [65, 65], fixed: true },
    { category: "transit", merchants: ["Metro TAP"], perMonth: 2, amount: [5, 20] },
    { category: "airfare", merchants: ["Delta", "Southwest Airlines"], perMonth: 0.2, amount: [180, 420] },
    { category: "hotels", merchants: ["Marriott", "Hilton"], perMonth: 0.1, amount: [240, 520] },
    { category: "everything_else", merchants: ["Home Depot", "Urban Outfitters", "Planet Fitness", "Venmo"], perMonth: 3, amount: [12, 90] },
  ],
};

export const MAYA: Persona = {
  id: "maya",
  name: "Maya",
  blurb: "29 · freelance designer · travels for work",
  seed: 29,
  wallet: [{ cardId: "chase_sapphire_preferred" }, { cardId: "citi_double_cash" }],
  habit: (category, _m, r) => (r() < 0.8 ? "chase_sapphire_preferred" : "citi_double_cash"),
  lines: [
    { category: "dining", merchants: LA_DINING, perMonth: 14, amount: [10, 70] },
    { category: "groceries", merchants: LA_GROCERY, perMonth: 5, amount: [30, 120] },
    { category: "airfare", merchants: ["United Airlines", "Delta", "Alaska Airlines"], perMonth: 1.2, amount: [160, 560] },
    { category: "hotels", merchants: ["Marriott", "Hyatt", "Airbnb"], perMonth: 0.8, amount: [180, 700] },
    { category: "rideshare", merchants: ["Uber", "Lyft"], perMonth: 6, amount: [14, 48] },
    { category: "online_retail", merchants: ["Amazon", "Adobe", "Figma", "B&H Photo"], perMonth: 4, amount: [15, 300] },
    { category: "streaming", merchants: ["Spotify", "Netflix"], perMonth: 2, amount: [15.49, 15.49], fixed: true },
    { category: "phone", merchants: ["Verizon"], perMonth: 1, amount: [85, 85], fixed: true },
    { category: "everything_else", merchants: ["WeWork", "Equinox", "REI"], perMonth: 2, amount: [30, 220] },
  ],
};

export const PARKS: Persona = {
  id: "parks",
  name: "The Parks",
  blurb: "family of four · Koreatown · one card does everything",
  seed: 4,
  wallet: [
    { cardId: "amex_blue_cash_everyday" },
    { cardId: "discover_it_cash_back", balance: 1200, apr: 24.24 },
  ],
  habit: (_c, _m, r) => (r() < 0.75 ? "discover_it_cash_back" : "amex_blue_cash_everyday"),
  lines: [
    { category: "groceries", merchants: ["H Mart", "Ralphs", "Zion Market", "Vons", "Trader Joe's"], perMonth: 10, amount: [40, 210] },
    { category: "wholesale_clubs", merchants: ["Costco"], perMonth: 2, amount: [120, 320] },
    { category: "gas", merchants: LA_GAS, perMonth: 6, amount: [45, 80] },
    { category: "dining", merchants: ["BCD Tofu House", "Kang Ho-dong Baekjeong", "Jollibee", "In-N-Out Burger"], perMonth: 7, amount: [18, 110] },
    { category: "utilities", merchants: ["LADWP", "SoCalGas", "Spectrum"], perMonth: 3, amount: [60, 180] },
    { category: "online_retail", merchants: ["Amazon", "Target.com"], perMonth: 5, amount: [12, 140] },
    { category: "drugstores", merchants: ["CVS Pharmacy", "Rite Aid"], perMonth: 2, amount: [10, 60] },
    { category: "streaming", merchants: ["Netflix", "Disney+", "YouTube TV"], perMonth: 3, amount: [17.99, 17.99], fixed: true },
    { category: "everything_else", merchants: ["Kumon", "Big 5 Sporting Goods", "Daiso"], perMonth: 3, amount: [20, 160] },
  ],
};

export const PERSONAS = [JORDAN, MAYA, PARKS];
