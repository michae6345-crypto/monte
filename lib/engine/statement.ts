// Turn a bank or card statement CSV into transactions, in the browser. Nothing is uploaded.
// Categories come from data/category_map.json's merchant rules first, then the issuer's
// own category column if the export has one, then keyword rules.

import map from "@/data/category_map.json";
import type { Txn } from "./index";

type Override = { pattern: string; category: string };
const OVERRIDES: { re: RegExp; category: string }[] = (map as unknown as { merchant_overrides: Override[] }).merchant_overrides.map((o) => ({
  re: new RegExp(o.pattern, "i"),
  category: o.category,
}));

const KEYWORDS: [RegExp, string][] = [
  [/restaurant|cafe|coffee|pizza|taco|burger|grill|kitchen|sushi|ramen|bistro|bar\b|diner|bakery|chipotle|sweetgreen|mcdonald|in-n-out|tst\*|chick-fil|panda express|boba|tea\b/i, "dining"],
  [/wholefds|trader joe|ralphs|vons|safeway|kroger|albertsons|sprouts|aldi|h mart|99 ranch|food 4 less|smart & final|grocery|market\b|supermarket|erewhon|gelson/i, "groceries"],
  [/\bgas\b|fuel|76\b|circle k|7-eleven|marathon|bp\b|texaco|citgo|sinclair|phillips 66/i, "gas"],
  [/airline|airways|delta|united|southwest|american air|alaska air|jetblue|spirit|frontier|aa\.com/i, "airfare"],
  [/hotel|marriott|hilton|hyatt|ihg|airbnb|vrbo|motel|inn\b|resort|booking\.com|expedia/i, "hotels"],
  [/metro|tap card|parking|toll|amtrak|metrolink|transit|bus\b|train/i, "transit"],
  [/pharmacy|drug/i, "drugstores"],
  [/cinema|theat(er|re)|concert|museum|bowling|golf|ticket/i, "entertainment"],
  [/electric|water|power|gas co|socalgas|ladwp|edison|internet|cable/i, "utilities"],
  [/wireless|mobile|at&t|cellular/i, "phone"],
  [/\.com|online|etsy|ebay|shop|store/i, "online_retail"],
];

// Category columns in Chase / Amex / Capital One / Discover exports.
const ISSUER_CATS: [RegExp, string][] = [
  [/restaurant|dining|food & drink|food and drink/i, "dining"],
  [/grocer|supermarket/i, "groceries"],
  [/gas|fuel|automotive/i, "gas"],
  [/airfare|airline/i, "airfare"],
  [/lodging|hotel/i, "hotels"],
  [/travel/i, "transit"],
  [/entertainment/i, "entertainment"],
  [/bills|utilit/i, "utilities"],
  [/health|pharmac|drug/i, "drugstores"],
  [/home/i, "home_improvement"],
  [/merchandise|shopping|retail/i, "online_retail"],
];

const SKIP = /payment|autopay|thank you|transfer|interest charge|late fee|annual fee|credit balance|refund|reversal|cash advance/i;

export function categorize(description: string, issuerCategory?: string): string | null {
  const d = description.replace(/^(SQ \*|TST\*|PAYPAL \*|SP |DD \*|PY \*)\s*/i, "");
  if (SKIP.test(d)) return null;
  for (const o of OVERRIDES) if (o.re.test(d)) return o.category;
  if (issuerCategory) for (const [re, c] of ISSUER_CATS) if (re.test(issuerCategory)) return c;
  for (const [re, c] of KEYWORDS) if (re.test(d)) return c;
  return "everything_else";
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function toISO(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type ParsedStatement = { txns: Txn[]; skipped: number; columns: string[] };

export function parseStatement(text: string, cardId: string): ParsedStatement {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("That file has no rows.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: RegExp[]) => head.findIndex((h) => names.some((n) => n.test(h)));
  const iDate = col(/^transaction date$/, /^trans(action)?\.? date/, /^date$/, /posted|post date/);
  const iDesc = col(/description/, /merchant/, /^name$/, /payee/, /details/);
  const iAmt = col(/^amount$/, /amount/);
  const iDebit = col(/^debit/);
  const iCredit = col(/^credit/);
  const iCat = col(/categor/);
  if (iDate < 0 || iDesc < 0 || (iAmt < 0 && iDebit < 0)) throw new Error("Couldn't find date, description and amount columns.");

  const raw = rows.slice(1).map((r) => {
    const amt = iAmt >= 0 ? parseFloat((r[iAmt] ?? "").replace(/[$,\s]/g, "")) : parseFloat((r[iDebit] || "0").replace(/[$,\s]/g, "")) - parseFloat((r[iCredit] || "0").replace(/[$,\s]/g, ""));
    return { date: toISO(r[iDate] ?? ""), desc: (r[iDesc] ?? "").trim(), amt, cat: iCat >= 0 ? r[iCat] : undefined };
  });
  // Chase exports purchases as negative numbers, Amex as positive: go with the majority.
  const neg = raw.filter((x) => x.amt < 0).length;
  const flip = iAmt >= 0 && neg > raw.length / 2;
  let skipped = 0;
  const txns: Txn[] = [];
  raw.forEach((x, i) => {
    const amount = flip ? -x.amt : x.amt;
    const category = x.date && amount > 0 ? categorize(x.desc, x.cat) : null;
    if (!x.date || !(amount > 0) || !category) {
      skipped++;
      return;
    }
    txns.push({ id: `you-${i}`, date: x.date, merchant: x.desc.replace(/\s{2,}/g, " ").slice(0, 40), amount: Math.round(amount * 100) / 100, category, cardUsed: cardId });
  });
  return { txns: txns.sort((a, b) => a.date.localeCompare(b.date)), skipped, columns: head };
}
