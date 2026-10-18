// Shared types between the engine (lib/engine) and the screens (app/, components/).
// Change only after a heads-up: both sides build against this file.

export type Category =
  | "dining"
  | "groceries"
  | "online_groceries"
  | "gas"
  | "ev_charging"
  | "transit"
  | "rideshare"
  | "travel_portal"
  | "airfare"
  | "hotels"
  | "streaming"
  | "drugstores"
  | "home_improvement"
  | "entertainment"
  | "rent"
  | "utilities"
  | "phone"
  | "online_retail"
  | "wholesale_clubs"
  | "everything_else";

export type Period = "month" | "quarter" | "year" | "cycle";

export type Source = { url: string; checked: string };

export type EarnRule = {
  category: Category;
  mult: number;
  cap?: { amount: number; period: Period };
  afterCap?: number;
  conditions?: string;
  merchants?: string[];
};

export type Credit = { name: string; amount: number; period: Period; merchants?: string[] };

export type Card = {
  id: string;
  name: string;
  issuer: string;
  annualFee: number;
  aprRange: [number, number];
  pointValueCents: number;
  base: number;
  earn: EarnRule[];
  credits: Credit[];
  sources: Source[];
  unverified?: boolean;
};

export type Txn = {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number; // dollars, positive = purchase
  category: Category;
  cardUsed: string; // Card.id
};

export type Holding = {
  cardId: string;
  aprPct: number;
  balances?: { statementDate: string; balance: number }[];
  creditsUsed?: Record<string, number>; // credit name -> dollars used in the year
};

export type ReceiptLine = { label: string; amount: number; txnIds?: string[]; ruleRef?: string };

export type Receipt = {
  rewards: number;
  credits: number;
  fees: number;
  interest: number;
  otherFees: number;
  net: number; // rewards + credits - fees - interest - otherFees
  perCard: Record<string, Omit<Receipt, "perCard">>;
  lines: ReceiptLine[];
};

export type Assignment = {
  txnId: string;
  actualCard: string;
  actualReward: number;
  bestCard: string;
  bestReward: number;
}[];

export type TapPick = {
  card: string;
  reward: number;
  reason: string; // e.g. "4x dining × $70 × 1.0¢"
  runnerUp?: { card: string; reward: number };
  warnings: string[]; // e.g. "Carries a $2,800 balance at 26% APR"
  capMeters: { card: string; used: number; cap: number; period: Period }[];
};
