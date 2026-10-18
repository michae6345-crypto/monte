// POST /api/categorize: messy bank merchant strings -> clean name + one of our categories.
//
// The model labels merchants; it never prices anything. A wrong label costs a category,
// and the engine downstream stays exact. Without ANTHROPIC_API_KEY this returns the
// deterministic fallback (everything_else, confidence "review") instead of failing.
//
// Body: { merchants: string[] } (max 100)
// Returns: { results, model, ms }

import { NextResponse } from "next/server";
import { categorize } from "@/lib/model/categorize";

const MAX = 100;

export async function POST(req: Request) {
  const t0 = performance.now();
  let body: { merchants?: unknown };
  try {
    body = (await req.json()) as { merchants?: unknown };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const m = body.merchants;
  if (!Array.isArray(m) || m.length === 0 || m.length > MAX || !m.every((s) => typeof s === "string" && s.trim())) {
    return NextResponse.json({ error: `merchants must be 1-${MAX} non-empty strings` }, { status: 400 });
  }
  const { results, model } = await categorize(m as string[]);
  return NextResponse.json({ results, model, ms: Math.round((performance.now() - t0) * 100) / 100 });
}
