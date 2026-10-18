// Merchant labeling: the ONE place a model is used in Monte.
//
// The model labels merchants; it never prices anything. It turns a messy bank string
// ("SQ *BLUE BOTTLE COF 0417 LOS ANGELES CA") into a clean name and one of our 20
// categories. A wrong label costs a category, and the engine downstream stays exact:
// every dollar is still computed deterministically from card rules in data/cards.json.
//
// No API key, a network error, or an off-list category all degrade to a deterministic
// fallback (category "everything_else", confidence "review"). This never throws.

import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "@/lib/contract";

export const CATEGORIES: readonly Category[] = [
  "dining", "groceries", "online_groceries", "gas", "ev_charging", "transit", "rideshare",
  "travel_portal", "airfare", "hotels", "streaming", "drugstores", "home_improvement",
  "entertainment", "rent", "utilities", "phone", "online_retail", "wholesale_clubs",
  "everything_else",
];
const CATEGORY_SET = new Set<string>(CATEGORIES);

export const MODEL = "claude-haiku-5-5";

export type Labeled = {
  raw: string;
  merchant: string;
  category: Category;
  confidence: "high" | "review";
};

/** Deterministic cleanup of a bank descriptor. No model involved. */
export function cleanMerchant(raw: string): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/^(SQ\s*\*|TST\s*\*|POS\s+|SP\s*\*|PP\s*\*|PAYPAL\s*\*)\s*/i, "");
  s = s.replace(/\*.*$/, ""); // "AMZN Mktp US*2K3" -> "AMZN Mktp US", "UBER *TRIP" -> "UBER "
  s = s.replace(/\s+\S+\.(COM|NET|ORG)\b.*$/i, "");
  s = s.replace(/\s+#?\d{2,}.*$/, ""); // trailing store numbers and anything after
  s = s.replace(/\s+[A-Z]{2}$/, ""); // trailing state code
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || String(raw ?? "").trim();
}

export function fallback(raw: string[]): Labeled[] {
  return raw.map((r) => ({ raw: r, merchant: cleanMerchant(r), category: "everything_else", confidence: "review" }));
}

const SYSTEM =
  "You label credit-card transaction descriptors. For each input string, return the clean " +
  "merchant brand name and the single best category from the allowed list. Use " +
  "everything_else when unsure. Return one result per input, same order, echoing index.";

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          merchant: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          sure: { type: "boolean" },
        },
        required: ["index", "merchant", "category", "sure"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

export async function categorize(raw: string[]): Promise<{ results: Labeled[]; model: string }> {
  const base = fallback(raw);
  if (!process.env.ANTHROPIC_API_KEY || raw.length === 0) return { results: base, model: "fallback" };
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: Math.min(4000, 200 + raw.length * 60),
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: raw.map((r, i) => `${i}\t${r}`).join("\n") }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { results: base, model: "fallback" };
    const parsed = JSON.parse(text.text) as { results?: { index: number; merchant: string; category: string; sure: boolean }[] };
    const out = base.slice();
    for (const r of parsed.results ?? []) {
      if (!Number.isInteger(r.index) || r.index < 0 || r.index >= out.length) continue;
      const ok = CATEGORY_SET.has(r.category);
      out[r.index] = {
        raw: raw[r.index],
        merchant: typeof r.merchant === "string" && r.merchant.trim() ? r.merchant.trim() : out[r.index].merchant,
        category: ok ? (r.category as Category) : "everything_else",
        confidence: ok && r.sure === true ? "high" : "review",
      };
    }
    return { results: out, model: MODEL };
  } catch (e) {
    console.warn("categorize: model call failed, using fallback:", (e as Error).message);
    return { results: base, model: "fallback" };
  }
}
