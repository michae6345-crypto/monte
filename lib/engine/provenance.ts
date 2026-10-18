// Provenance (SPEC #19): every dollar Monte shows traces back to a published card rule in
// data/cards.json -- its label, the issuer's source URL(s) and the date we checked it --
// plus the transaction, balance or credit it was computed from. Purely additive: nothing
// in the engine imports this file. Deterministic and dependency-free; it only reads the
// catalog and the values the engine already returned.
//
// The catalog has no per-rule verification flag: `unverified` is a card-level field. So a
// rule, fee, credit or interest line is unverified exactly when its card is marked
// unverified, and the UNVERIFIED badge is a card badge that every line of that card
// inherits. If per-rule flags are ever added to data/cards.json, only ruleUnverified()
// below needs to change.

import { card, creditPerYear, CARDS, type CardCredit, type CatalogCard, type EarnRule, type Period } from "./catalog";
import { creditsUsed, interestFor, pointValue, receipt, type Hit, type Holding, type Txn } from "./index";

// ---------- shared shapes ----------

/** Where a card's numbers come from: the issuer pages we read and the day we read them. */
export type CardSource = {
  cardId: string;
  cardName: string;
  issuer: string;
  /** Issuer / terms pages backing this card's rules, in catalog order. */
  sourceUrls: string[];
  /** The catalog's `checked` date for this card (YYYY-MM-DD), if recorded. */
  checked?: string;
  /** True when data/cards.json marks this card `unverified`. */
  unverified: boolean;
  /** The catalog's free-text caveats for this card, if any. */
  notes?: string;
};

/** The four kinds of line a receipt can show. */
export type ProvenanceKind = "reward" | "fee" | "credit" | "interest";

type Base = { kind: ProvenanceKind; source: CardSource; amount: number; math: string };

/** A rewards line: this purchase, on this card, under this rule. */
export type RewardProvenance = Base & {
  kind: "reward";
  txnId: string;
  merchant: string;
  date: string;
  category: string;
  spend: number;
  /** Effective multiplier after caps (blended on the purchase that crosses a cap). */
  mult: number;
  /** The engine's human label for the rule that applied, e.g. "3x dining (cap $6,000/year)". */
  rule: string;
  /** Cents per point used to value this reward ("cash" vs "travel" valuation). */
  pointValueCents: number;
  /** The catalog rule behind the label, when it could be identified (null = the base rate). */
  catalogRule: EarnRule | null;
  /** The issuer's fine print on that rule, when the catalog records it. */
  conditions?: string;
  /** The rule's published cap, when it has one. */
  cap?: { amount: number; period: Period; afterCapMultiplier: number };
  /** True when the rule came from the card's rotating-category lineup (Q4 2026). */
  rotating: boolean;
  /** Only for a rotating rule: its published window, the issuer's category labels, and
   *  whether the cardholder had to activate the quarter for it to pay. */
  rotatingDetail?: { window: string; labels: string[]; activationRequired: boolean };
};

/** An annual-fee line: the card's published annual_fee. */
export type FeeProvenance = Base & { kind: "fee"; annualFee: number };

/** A credit line: a named credit in the catalog and how much of it was actually used. */
export type CreditProvenance = Base & {
  kind: "credit";
  creditName: string;
  /** Dollars of this credit the holding records as used (Holding.creditsUsed). */
  used: number;
  /** The catalog's per-period amount and period for this credit. */
  catalogAmount: number;
  period: Period;
  /** creditPerYear(): the catalog amount annualised, for "used $80 of $120". */
  perYear: number;
  howToUse?: string;
  /** True when creditsUsed names a credit the catalog does not list for this card. */
  unknownToCatalog: boolean;
};

/** An interest line: average revolving balance x purchase APR, and where the APR came from. */
export type InterestProvenance = Base & {
  kind: "interest";
  balance: number;
  aprPct: number;
  /** "holding" = the user's own APR (Holding.apr); "catalog_apr_range_max" = fallback to
   *  the top of the card's published purchase_apr_range, which interestFor() uses. */
  aprSource: "holding" | "catalog_apr_range_max";
  catalogAprRange: [number, number];
};

export type ProvenanceLine = RewardProvenance | FeeProvenance | CreditProvenance | InterestProvenance;

// ---------- formatting ----------

// Explicit locale so the strings are identical on every machine (they are asserted in tests).
const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${Number(n.toFixed(4))}%`;

// ---------- card-level ----------

/** The source block for one card: issuer URLs, checked date, UNVERIFIED flag. */
export function cardSource(cardId: string): CardSource {
  const c = card(cardId);
  return {
    cardId: c.id,
    cardName: c.name,
    issuer: c.issuer,
    sourceUrls: [...c.source_urls],
    checked: c.checked,
    unverified: c.unverified === true,
    notes: c.notes,
  };
}

/** Whether a rule on this card should carry the UNVERIFIED badge. The catalog flags whole
 *  cards, not rules, so every rule of an unverified card is treated as unverified. */
export function ruleUnverified(c: CatalogCard): boolean {
  return c.unverified === true;
}

// ---------- matching a Hit's rule label back to the catalog ----------

/** Find the catalog rule behind an engine rule label ("3x dining (cap $6,000/year)",
 *  "3x at Exxon, Mobil", "5x Q4 rotating dining", "1.5x base"). Mirrors the labels
 *  earnOptions() builds; returns rule: null for the card's base rate. */
export function matchCatalogRule(
  c: CatalogCard,
  t: Pick<Txn, "merchant" | "category">,
  ruleLabel: string,
): { rule: EarnRule | null; rotating: boolean } {
  if (/^[\d.]+x Q4 rotating /.test(ruleLabel) && c.rotating) {
    const r = c.rotating;
    return {
      rule: {
        category: t.category,
        multiplier: r.multiplier,
        cap: r.cap ? { amount: r.cap, period: r.cap_period ?? "quarter" } : undefined,
        after_cap_multiplier: r.after_cap_multiplier,
      },
      rotating: true,
    };
  }
  for (const r of c.earn_rules) {
    if (!ruleLabel.startsWith(`${r.multiplier}x `)) continue;
    const ok = r.merchants
      ? ruleLabel.startsWith(`${r.multiplier}x at ${r.merchants.join(", ")}`)
      : r.category === "everything_else"
        ? ruleLabel.startsWith(`${r.multiplier}x on everything`)
        : r.category === t.category && ruleLabel.startsWith(`${r.multiplier}x ${t.category.replace(/_/g, " ")}`);
    if (ok) return { rule: r, rotating: false };
  }
  return { rule: null, rotating: false };
}

// ---------- per-line provenance ----------

/** Provenance for one rewards row: call this per purchase row in the UI. */
export function provenanceFor(hit: Hit, txn: Txn): RewardProvenance {
  const c = card(hit.cardId);
  const pv = pointValue(c);
  const { rule, rotating } = matchCatalogRule(c, txn, hit.rule);
  const cap = rule?.cap
    ? { amount: rule.cap.amount, period: rule.cap.period, afterCapMultiplier: rule.after_cap_multiplier ?? c.base_multiplier }
    : undefined;
  const head = `${money(txn.amount)} x ${hit.mult}x`;
  return {
    kind: "reward",
    source: cardSource(hit.cardId),
    amount: hit.reward,
    math:
      c.currency === "cash"
        ? `${head} = ${money(hit.reward)}`
        : `${head} x ${pv}c/point = ${money(hit.reward)} (${(txn.amount * hit.mult).toFixed(2)} ${c.currency})`,
    txnId: hit.txnId,
    merchant: txn.merchant,
    date: txn.date,
    category: txn.category,
    spend: txn.amount,
    mult: hit.mult,
    rule: hit.rule,
    pointValueCents: pv,
    catalogRule: rule,
    conditions: rule?.conditions,
    cap,
    rotating,
    rotatingDetail:
      rotating && c.rotating
        ? {
            window: c.rotating.period ?? c.rotating.dates ?? "",
            labels: c.rotating.q4_2026_labels ?? c.rotating.q4_2026,
            activationRequired: c.rotating.activation_required === true,
          }
        : undefined,
  };
}

/** Provenance for a card's annual-fee line. Returns null for a no-fee card. */
export function feeProvenanceFor(cardId: string): FeeProvenance | null {
  const c = card(cardId);
  if (c.annual_fee === 0) return null;
  return {
    kind: "fee",
    source: cardSource(cardId),
    amount: c.annual_fee,
    math: `${c.name} annual fee ${money(c.annual_fee)} (published)`,
    annualFee: c.annual_fee,
  };
}

/** Provenance for every credit this holding used, one line per named credit. */
export function creditProvenanceFor(h: Holding): CreditProvenance[] {
  const c = card(h.cardId);
  const byName = new Map<string, CardCredit>(c.credits.map((x) => [x.name, x]));
  return Object.entries(h.creditsUsed ?? {}).map(([name, used]) => {
    const cc = byName.get(name);
    const perYear = cc ? creditPerYear(cc) : 0;
    return {
      kind: "credit" as const,
      source: cardSource(h.cardId),
      amount: used,
      math: cc
        ? `used ${money(used)} of ${money(cc.amount)}/${cc.period.replace(/_/g, " ")} (${money(perYear)}/yr) "${cc.name}"`
        : `used ${money(used)} of "${name}", which the catalog does not list for ${c.name}`,
      creditName: name,
      used,
      catalogAmount: cc?.amount ?? 0,
      period: cc?.period ?? "year",
      perYear,
      howToUse: cc?.how_to_use,
      unknownToCatalog: !cc,
    };
  });
}

/** Provenance for a holding's interest line: balance x APR, naming the APR's source.
 *  Returns null when the card is paid in full (interestFor() = 0). */
export function interestProvenanceFor(h: Holding): InterestProvenance | null {
  const c = card(h.cardId);
  if (!h.balance || h.balance <= 0) return null;
  const fromHolding = h.apr !== undefined;
  const apr = h.apr ?? c.purchase_apr_range[1];
  const amount = interestFor(h);
  return {
    kind: "interest",
    source: cardSource(h.cardId),
    amount,
    math:
      `${money(h.balance)} average balance x ${pct(apr)} APR = ${money(amount)} a year ` +
      (fromHolding
        ? "(APR from your account)"
        : `(no APR on file: top of the card's published range ${pct(c.purchase_apr_range[0])}-${pct(c.purchase_apr_range[1])})`),
    balance: h.balance,
    aprPct: apr,
    aprSource: fromHolding ? "holding" : "catalog_apr_range_max",
    catalogAprRange: [c.purchase_apr_range[0], c.purchase_apr_range[1]],
  };
}

// ---------- whole receipt ----------

export type ReceiptProvenance = {
  /** One line per purchase, in the order receipt().actual.hits came back (date order). */
  rewards: RewardProvenance[];
  fees: FeeProvenance[];
  credits: CreditProvenance[];
  interest: InterestProvenance[];
  /** rewards + fees + credits + interest, for a flat "show me everything" list. */
  lines: ProvenanceLine[];
  /** The signed total these lines add up to: rewards + credits - fees - interest. It must
   *  equal receipt().net; tests/engine.test.ts asserts that to the cent. */
  net: number;
  /** Cards on this receipt that carry the UNVERIFIED badge. */
  unverified: UnverifiedCard[];
};

/** Provenance for a whole receipt: pass the same wallet and transactions you passed to
 *  receipt(). Uses the "actual" policy -- the cards the purchases were really made on. */
export function receiptProvenance(wallet: Holding[], txns: Txn[], defaultCard?: string): ReceiptProvenance {
  const r = receipt(wallet, txns, defaultCard);
  const byId = new Map(txns.map((t) => [t.id, t]));
  const rewards = r.actual.hits.map((h) => provenanceFor(h, byId.get(h.txnId)!));
  const fees = wallet.map((h) => feeProvenanceFor(h.cardId)).filter((x): x is FeeProvenance => x !== null);
  const credits = wallet.flatMap(creditProvenanceFor);
  const interest = wallet.map(interestProvenanceFor).filter((x): x is InterestProvenance => x !== null);
  const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
  return {
    rewards,
    fees,
    credits,
    interest,
    lines: [...rewards, ...fees, ...credits, ...interest],
    net: sum(rewards) + sum(credits) - sum(fees) - sum(interest),
    unverified: unverifiedCards(wallet.map((h) => h.cardId)),
  };
}

// ---------- the UNVERIFIED badge ----------

export type UnverifiedCard = {
  cardId: string;
  cardName: string;
  issuer: string;
  sourceUrls: string[];
  checked?: string;
  notes?: string;
  /** Rule labels on this card that therefore carry the badge (card-level flag, see header). */
  rules: string[];
  /** Named credits on this card that therefore carry the badge. */
  credits: string[];
};

/** The cards the catalog marks `unverified`, with the rules and credits that inherit the
 *  badge. Pass card ids to narrow it to one wallet; omit for the whole catalog. */
export function unverifiedCards(cardIds?: string[]): UnverifiedCard[] {
  const pool = cardIds ? cardIds.map(card) : CARDS;
  const seen = new Set<string>();
  const out: UnverifiedCard[] = [];
  for (const c of pool) {
    if (!ruleUnverified(c) || seen.has(c.id)) continue;
    seen.add(c.id);
    const rules = c.earn_rules.map((r) =>
      r.merchants ? `${r.multiplier}x at ${r.merchants.join(", ")}` : `${r.multiplier}x ${r.category.replace(/_/g, " ")}`,
    );
    if (c.rotating) rules.push(`${c.rotating.multiplier}x Q4 rotating ${c.rotating.q4_2026.join(", ")}`);
    rules.push(`${c.base_multiplier}x base`);
    out.push({
      cardId: c.id,
      cardName: c.name,
      issuer: c.issuer,
      sourceUrls: [...c.source_urls],
      checked: c.checked,
      notes: c.notes,
      rules,
      credits: c.credits.map((x) => x.name),
    });
  }
  return out;
}

/** One-line "where this came from" string for any provenance line, for a tooltip. */
export function citation(line: ProvenanceLine): string {
  const s = line.source;
  const badge = s.unverified ? " [UNVERIFIED]" : "";
  return `${line.math} - ${s.cardName} (${s.issuer}), ${s.sourceUrls[0] ?? "no source on file"}, checked ${s.checked ?? "unknown"}${badge}`;
}

/** Total dollars of credits a holding used, so a UI row can show the sum next to its
 *  per-credit provenance without importing the engine as well. */
export function creditsUsedTotal(h: Holding): number {
  return creditsUsed(h);
}
