// The Monte card, at the moment of payment.
//
// Every card purchase is an authorization request the network sends to the card's issuer before
// the terminal says "approved": the store's descriptor, its merchant category code (MCC) and the
// amount. On an issuing platform (Lithic's Auth Stream Access, Stripe Issuing's real-time
// authorizations, Marqeta's JIT funding), the program's own server answers that request. That is
// where Monte runs: the network has already said which store and which category, and Monte picks
// which of your cards to play, with the same choose() as the app (rewards minus the interest a
// purchase adds on a card with a balance).
//
// What this does not do yet is move the money to the chosen card: that needs an issuing partner
// and a funding model (see docs/CARD.md). Monte approves every purchase; it routes, it doesn't
// police spending.

import type { Holding } from "@/lib/engine";
import { choose, type Choice, type Mode } from "@/lib/engine/interest";
import { stripDescriptorPrefix } from "@/lib/data/plaid";
import { perksAt, type Perk } from "@/lib/perks";
import { why } from "@/lib/explain";
import { categoryForMcc, mccLabel } from "./mcc";

/** The parts of an authorization request Monte reads, whatever platform sent it. */
export type Auth = {
  /** the platform's id for this authorization, echoed in the answer */
  token: string;
  /** in cents, as the networks send it */
  amountCents: number;
  descriptor: string;
  mcc: string;
  city?: string;
  state?: string;
  cardToken?: string;
  cardMemo?: string;
};

/** Lithic's ASA request (as in lithic-com/asa-demo-node: token, amount in cents, merchant{...}),
 *  read leniently: any field may be missing. */
export function fromLithic(body: Record<string, unknown>): Auth {
  const m = (body.merchant ?? {}) as Record<string, unknown>;
  const card = (body.card ?? {}) as Record<string, unknown>;
  const amount = Number(body.amount ?? body.authorization_amount ?? body.merchant_amount ?? 0);
  return {
    token: String(body.token ?? ""),
    amountCents: Number.isFinite(amount) ? Math.round(amount) : 0,
    descriptor: String(m.descriptor ?? body.descriptor ?? ""),
    mcc: String(m.mcc ?? ""),
    city: m.city ? String(m.city) : undefined,
    state: m.state ? String(m.state) : undefined,
    cardToken: card.token ? String(card.token) : undefined,
    cardMemo: card.memo ? String(card.memo) : undefined,
  };
}

/** "TRADER JOE'S #071" -> "Trader Joe's"; "UBER *TRIP" -> "Uber"; "SQ *BLUE BOTTLE" -> "Blue Bottle". */
export function merchantName(descriptor: string): string {
  let s = stripDescriptorPrefix(descriptor);
  s = s.split("*")[0]; // "UBER *TRIP": the brand comes before the star
  s = s.replace(/#?\s*\d{2,}.*$/, "").replace(/\s{2,}/g, " ").trim();
  if (!s) s = descriptor.trim();
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/'S\b/g, "'s");
}

export type Decision = {
  result: "APPROVED";
  token: string;
  merchant: string;
  mcc: string;
  mccLabel: string;
  category: string;
  amount: number;
  /** the card Monte plays for this purchase, or null if no wallet is enrolled for this card */
  play: Choice | null;
  ranked: Choice[];
  mode: Mode | null;
  why: string;
  perks: Perk[];
  ms: number;
};

export function decide(wallet: Holding[] | null, auth: Auth): Decision {
  const t0 = performance.now();
  const merchant = merchantName(auth.descriptor);
  const category = categoryForMcc(auth.mcc);
  const amount = auth.amountCents / 100;
  const base = { result: "APPROVED" as const, token: auth.token, merchant, mcc: auth.mcc, mccLabel: mccLabel(auth.mcc), category, amount };
  if (!wallet?.length || !(amount > 0))
    return { ...base, play: null, ranked: [], mode: null, why: wallet?.length ? "Nothing to route: a $0 authorization (a card check)." : "No wallet is enrolled for this card yet.", perks: [], ms: performance.now() - t0 };
  const d = choose(wallet, { date: new Date().toISOString().slice(0, 10), merchant, category, amount });
  return { ...base, play: d.pick, ranked: d.ranked, mode: d.mode, why: why(d), perks: perksAt(wallet, merchant), ms: performance.now() - t0 };
}
