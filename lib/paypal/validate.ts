// Everything the browser sends about a checkout, checked before the engine or PayPal sees it.
// Server-only: it pulls the category list from the model module.

import type { Holding, Txn, Valuation } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { CATEGORIES } from "@/lib/model/categorize";
import { orderValue, type Purchase } from "@/lib/paypal/plan";

const CARD_IDS = new Set(CARDS.map((c) => c.id));
const CATEGORY_SET = new Set<string>(CATEGORIES);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HISTORY = 6000;

export type CheckoutContext = { wallet: Holding[]; history: Txn[]; valuation: Valuation; date: string };
type Bad = { error: string };

export const isBad = <T extends object>(x: T | Bad): x is Bad => "error" in x;

/** Merchant names end up in a PayPal description and in a prompt: plain text, short. */
export function safeText(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export function isCategory(raw: unknown): raw is string {
  return typeof raw === "string" && CATEGORY_SET.has(raw);
}

function parseHolding(raw: unknown): Holding | null {
  const h = raw as Holding | null;
  if (!h || typeof h.cardId !== "string" || !CARD_IDS.has(h.cardId)) return null;
  const balance = h.balance === undefined ? undefined : Number(h.balance);
  const apr = h.apr === undefined ? undefined : Number(h.apr);
  if (balance !== undefined && !(Number.isFinite(balance) && balance >= 0)) return null;
  if (apr !== undefined && !(Number.isFinite(apr) && apr >= 0 && apr <= 100)) return null;
  return { cardId: h.cardId, balance, apr };
}

function parseTxn(raw: unknown): Txn | null {
  const t = raw as Txn | null;
  if (!t || typeof t.id !== "string" || typeof t.date !== "string" || !DATE.test(t.date)) return null;
  if (typeof t.amount !== "number" || !Number.isFinite(t.amount)) return null;
  if (typeof t.category !== "string" || typeof t.merchant !== "string" || typeof t.cardUsed !== "string") return null;
  return { id: t.id.slice(0, 80), date: t.date, merchant: t.merchant.slice(0, 120), amount: t.amount, category: t.category, cardUsed: t.cardUsed };
}

export function parseContext(body: Record<string, unknown>): CheckoutContext | Bad {
  if (!Array.isArray(body.wallet) || body.wallet.length < 1 || body.wallet.length > 5) return { error: "wallet must list 1 to 5 cards" };
  const wallet = body.wallet.map(parseHolding);
  if (wallet.some((h) => !h)) return { error: "wallet has a card that isn't in the catalog" };
  const rawHistory = body.history ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY) return { error: "history must be a list of purchases" };
  const history = rawHistory.map(parseTxn);
  if (history.some((t) => !t)) return { error: "history has an invalid purchase" };
  if (typeof body.date !== "string" || !DATE.test(body.date)) return { error: "date must be YYYY-MM-DD" };
  return {
    wallet: wallet as Holding[],
    history: history as Txn[],
    valuation: body.valuation === "travel" ? "travel" : "cash",
    date: body.date,
  };
}

export function parsePurchase(raw: unknown, date: string): Purchase | Bad {
  const p = raw as { merchant?: unknown; category?: unknown; amount?: unknown } | null;
  const merchant = safeText(p?.merchant, 48);
  if (!merchant) return { error: "purchase.merchant is required" };
  if (!isCategory(p?.category)) return { error: "purchase.category isn't one Monte knows" };
  if (!orderValue(p?.amount)) return { error: "purchase.amount must be between $0.01 and $10,000, to the cent" };
  return { merchant, category: p.category, amount: p.amount as number, date };
}
