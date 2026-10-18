import raw from "@/data/cards.json";

export type Period = "month" | "quarter" | "year" | "billing_cycle" | "half_year" | "every_4_years";

export type EarnRule = {
  category: string;
  multiplier: number;
  cap?: { amount: number; period: Period };
  after_cap_multiplier?: number;
  merchants?: string[];
  merchants_excluded?: string[];
  choice_group?: string;
  conditions?: string;
};

export type CardCredit = { name: string; amount: number; period: Period; how_to_use?: string };

export type Rotating = {
  q4_2026: string[];
  q4_2026_labels?: string[];
  period?: string; // "2026-10-01 to 2026-12-31"
  dates?: string; // same, on the Discover cards
  multiplier: number;
  after_cap_multiplier?: number;
  cap?: number;
  cap_period?: Period;
  activation_required?: boolean;
};

export type CatalogCard = {
  id: string;
  name: string;
  issuer: string;
  network?: string;
  annual_fee: number;
  foreign_tx_fee_pct?: number;
  purchase_apr_range: [number, number];
  currency: string;
  point_value_cents: number;
  point_value_source?: { name: string; url: string };
  earn_rules: EarnRule[];
  base_multiplier: number;
  rotating?: Rotating | null;
  credits: CardCredit[];
  signup_bonus?: unknown;
  source_urls: string[];
  checked?: string;
  unverified?: boolean;
  notes?: string;
};

type Catalog = { title: string; as_of: string; cards: CatalogCard[] };

export const catalog = raw as unknown as Catalog;
export const CARDS: CatalogCard[] = catalog.cards;
const byId = new Map(CARDS.map((c) => [c.id, c]));

export function card(id: string): CatalogCard {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

/** Dollars of annual value of a credit, for display. */
export function creditPerYear(c: CardCredit): number {
  const n = { month: 12, quarter: 4, half_year: 2, year: 1, billing_cycle: 12, every_4_years: 0.25 }[c.period] ?? 1;
  return c.amount * n;
}

/** Cards you can still apply for (the catalog notes when an issuer has closed a card). */
export function openToNewApplicants(c: CatalogCard): boolean {
  return !/closed to new applicants|no longer accepting appl/i.test(c.notes ?? "");
}

export function issuerShort(c: CatalogCard): string {
  return c.issuer.replace("American Express", "Amex").replace("Capital One", "Capital One");
}
