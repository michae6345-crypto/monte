// What Monte says before you pay: which card to choose in your PayPal wallet, what it earns
// on this purchase, and how much cap room it has left.
//
// Deterministic, with no model and no network. Every number comes from evaluate() and the
// cap state (the same pair /api/tap uses), and every rule traces to data/cards.json through
// provenance. The Tap view and the server run this same function, so the panel and the order
// can't disagree. Nothing in the engine imports this file.

import { chooseOptions, earnOptions, evaluate, type Holding, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { citation, provenanceFor } from "@/lib/engine/provenance";
import { capMapFrom, capStateFrom } from "@/lib/db/cap-state";

/** The day the Tap demo happens on: the people's histories end just before it. */
export const DEMO_TAP_DATE = "2026-10-18";

/** Sandbox orders only need to look like purchases. */
const MAX_ORDER_CENTS = 1_000_000;

export type Purchase = { merchant: string; category: string; amount: number; date: string };

export type RankedCard = {
  cardId: string;
  name: string;
  reward: number;
  mult: number;
  rule: string;
  /** Set when the card carries a balance. A blocked card is never the pick. */
  blocked?: string;
  math: string;
  citation: string;
  sourceUrl: string | null;
  checked: string | null;
  unverified: boolean;
};

export type CapRoom = {
  cap: number;
  period: string;
  usedBefore: number;
  thisPurchase: number;
  leftBefore: number;
  leftAfter: number;
};

export type CheckoutPlan = {
  purchase: Purchase;
  /** The exact string the PayPal order is created for. */
  orderValue: string;
  ranked: RankedCard[];
  /** null when every card in the wallet carries a balance: Monte recommends nothing. */
  pick: RankedCard | null;
  runnerUp: { name: string; reward: number; gap: number } | null;
  capRoom: CapRoom | null;
};

/** Dollars as Orders v2 wants them: two decimals, positive. null if it can't be an order. */
export function orderValue(amount: unknown): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (cents < 1 || cents > MAX_ORDER_CENTS || Math.abs(amount * 100 - cents) > 1e-6) return null;
  return (cents / 100).toFixed(2);
}

function quarterStart(date: string): string {
  const q = Math.floor((Number(date.slice(5, 7)) - 1) / 3);
  return `${date.slice(0, 4)}-${String(q * 3 + 1).padStart(2, "0")}-01`;
}

/** Rank the wallet for one purchase and work out what to tell the person.
 *  `history` is this calendar year's purchases so far, with each card actually used. */
export function planCheckout(wallet: Holding[], purchase: Purchase, history: Txn[]): CheckoutPlan {
  const value = orderValue(purchase.amount);
  if (!value) throw new RangeError(`Not an order amount: ${purchase.amount}`);

  // Caps come from the whole year (a $25,000 yearly cap remembers January). The pick-one
  // card categories come from this quarter, the way the phone in the Tap view picks them.
  const year = history.filter((t) => t.date.slice(0, 4) === purchase.date.slice(0, 4) && t.date <= purchase.date);
  const quarter = history.filter((t) => t.date >= quarterStart(purchase.date));
  const used = capMapFrom(capStateFrom(wallet, year));
  const txn: Txn = { id: "checkout", cardUsed: "", ...purchase };

  const rows = wallet
    .map((h) => {
      const c = card(h.cardId);
      const choice = chooseOptions(h.cardId, quarter);
      const ev = evaluate(c, txn, used, choice);
      const line = provenanceFor({ txnId: txn.id, cardId: h.cardId, reward: ev.reward, mult: ev.mult, rule: ev.rule }, { ...txn, cardUsed: h.cardId });
      const ranked: RankedCard = {
        cardId: h.cardId,
        name: c.name,
        reward: ev.reward,
        mult: ev.mult,
        rule: ev.rule,
        blocked:
          h.balance && h.balance > 0
            ? `Carries a $${Math.round(h.balance).toLocaleString("en-US")} balance at ${h.apr ?? c.purchase_apr_range[1]}% APR: new purchases start charging interest today.`
            : undefined,
        math: line.math,
        citation: citation(line),
        sourceUrl: line.source.sourceUrls[0] ?? null,
        checked: line.source.checked ?? null,
        unverified: line.source.unverified,
      };
      // the one place the cap pool is needed: how much of it this purchase would take
      const pool = ev.consume[0];
      const option = pool ? earnOptions(c, txn, choice).find((o) => o.cap?.key === pool.pool) : undefined;
      const room: CapRoom | null =
        pool && option?.cap
          ? (() => {
              const usedBefore = used.get(pool.pool) ?? 0;
              const leftBefore = Math.max(0, option.cap.amount - usedBefore);
              return {
                cap: option.cap.amount,
                period: line.cap?.period ?? "period",
                usedBefore,
                thisPurchase: pool.amount,
                leftBefore,
                leftAfter: Math.max(0, leftBefore - pool.amount),
              };
            })()
          : null;
      return { ranked, room };
    })
    .sort((a, b) => b.ranked.reward - a.ranked.reward);

  const ranked = rows.map((r) => r.ranked);
  // Never a card with a balance, even if that leaves nothing to recommend.
  const top = rows.find((r) => !r.ranked.blocked) ?? null;
  const pick = top?.ranked ?? null;
  const next = pick ? ranked.find((r) => r.cardId !== pick.cardId && !r.blocked) : undefined;
  return {
    purchase,
    orderValue: value,
    ranked,
    pick,
    runnerUp: pick && next ? { name: next.name, reward: next.reward, gap: pick.reward - next.reward } : null,
    capRoom: top?.room ?? null,
  };
}

// ---------- words, for the panel and the agent's fallback ----------

export const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const THIS_PERIOD: Record<string, string> = {
  month: "this month",
  quarter: "this quarter",
  half_year: "this half-year",
  year: "this year",
  billing_cycle: "this billing cycle",
  every_4_years: "this 4-year period",
};

/** "$24,916.00 of $25,000 left this year after this purchase" */
export function capRoomLine(room: CapRoom): string {
  return `${usd(room.leftAfter)} of ${whole(room.cap)} left ${THIS_PERIOD[room.period] ?? "this period"} after this purchase`;
}

/** "$25,000.00 → $24,916.00 of $25,000 this year", for the receipt. */
export function capMoveLine(room: CapRoom): string {
  return `${usd(room.leftBefore)} → ${usd(room.leftAfter)} of ${whole(room.cap)} ${THIS_PERIOD[room.period] ?? "this period"}`;
}

/** Plain English built only from the plan's own numbers. Shown when the agent's words can't
 *  be checked against the engine, so a wrong sentence never reaches the screen. */
export function explainPlan(plan: CheckoutPlan): string {
  const { pick, capRoom, orderValue: value, purchase } = plan;
  const blocked = plan.ranked.filter((r) => r.blocked);
  if (!pick) return `Every card in this wallet carries a balance, so Monte won't recommend one for ${usd(Number(value))} at ${purchase.merchant}.`;
  const parts = [`Choose ${pick.name} in your PayPal wallet: ${pick.rule} earns ${usd(pick.reward)} on this ${usd(Number(value))} at ${purchase.merchant}.`];
  parts.push(capRoom ? `That leaves ${capRoomLine(capRoom)}.` : "That rule has no spending cap.");
  for (const b of blocked) parts.push(`Skip ${b.name}. ${b.blocked}`);
  parts.push("Nothing is charged until you approve it in the PayPal window.");
  return parts.join(" ");
}

// ---------- what an order remembers ----------

const REF_VERSION = "monte1";

export type OrderRef = { cardId: string; category: string; date: string; merchant: string };

/** Stored in the order's custom_id when Monte creates it, so capture needs no database and
 *  can't be told a different card or store by the browser. */
export function encodeOrderRef(plan: CheckoutPlan): string {
  if (!plan.pick) throw new Error("No card to remember");
  const { category, date, merchant } = plan.purchase;
  return [REF_VERSION, plan.pick.cardId, category, date, merchant].join("|").slice(0, 127);
}

export function decodeOrderRef(raw: string | null | undefined): OrderRef | null {
  const parts = (raw ?? "").split("|");
  if (parts.length < 5 || parts[0] !== REF_VERSION) return null;
  const [, cardId, category, date, ...merchant] = parts;
  return { cardId, category, date, merchant: merchant.join("|") };
}

/** The purchase a completed capture adds to the person's history. PayPal doesn't say which
 *  card funded it, so it's counted on the card Monte told them to choose. */
export function capturedTxn(ref: OrderRef, captureId: string, value: string): Txn {
  return { id: `paypal-${captureId}`, date: ref.date, merchant: ref.merchant, amount: Number(value), category: ref.category, cardUsed: ref.cardId };
}
