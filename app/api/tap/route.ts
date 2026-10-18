// POST /api/tap — which card should pay, right now.
//
// This is the production shape of the register moment. It does NOT replay your history.
// It reads the cap counters that sync already wrote, ranks the wallet against them, and
// returns a winner. The cost does not grow with how long you have been a customer.
//
// Auth: Authorization: Bearer <supabase jwt>
// Body: { merchant, amount, category, date? }
// Returns: { pick, ranked, capNotes, blocked, ms }

import { NextResponse } from "next/server";
import { evaluate, pointValue, type Holding, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { capMapFrom, type CapRow } from "@/lib/db/cap-state";
import { serviceDb, notConfigured, requestUser, unauthorized } from "@/lib/db/client";


type Body = { merchant?: string; amount?: number; category?: string; date?: string };

export async function POST(req: Request) {
  const t0 = performance.now();
  const db = serviceDb();
  if (!db) return NextResponse.json(notConfigured, { status: 503 });
  // who this is comes from the verified JWT, never the body
  const userId = await requestUser(req, db);
  if (!userId) return NextResponse.json(unauthorized, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { merchant, amount, category, date } = body;
  if (!merchant || typeof amount !== "number" || !category) {
    return NextResponse.json({ error: "merchant, amount and category are required" }, { status: 400 });
  }

  // Two reads, both indexed: the wallet, and only the cap rows for the periods this
  // purchase could touch. Never the transaction history.
  const [{ data: holdings, error: hErr }, { data: capRows, error: cErr }] = await Promise.all([
    db.from("holdings").select("card_id, balance, apr, credits_used").eq("user_id", userId),
    db.from("cap_state").select("card_id, pool_key, period_key, consumed").eq("user_id", userId),
  ]);
  if (hErr || cErr) return NextResponse.json({ error: "db_error", detail: (hErr ?? cErr)?.message }, { status: 502 });
  if (!holdings?.length) return NextResponse.json({ error: "no_wallet" }, { status: 404 });

  const wallet: Holding[] = holdings.map((h) => ({
    cardId: h.card_id as string,
    balance: Number(h.balance ?? 0),
    apr: h.apr == null ? undefined : Number(h.apr),
    creditsUsed: (h.credits_used ?? {}) as Record<string, number>,
  }));

  const used = capMapFrom((capRows ?? []) as CapRow[]);
  const txn: Txn = { id: "tap", date: date ?? new Date().toISOString().slice(0, 10), merchant, amount, category, cardUsed: "" };

  const ranked = wallet
    .map((h) => {
      const c = card(h.cardId);
      const ev = evaluate(c, txn, used, null);
      // The one rule the engine never breaks: a card carrying a balance is not a
      // candidate. New spending on it accrues interest from the day it posts, so any
      // reward it pays is a discount on a loan you are losing.
      const blocked =
        h.balance && h.balance > 0
          ? `Carries $${Math.round(h.balance).toLocaleString()} at ${h.apr ?? c.purchase_apr_range[1]}% APR`
          : undefined;
      return {
        cardId: h.cardId,
        name: c.name,
        reward: Math.round(ev.reward * 100) / 100,
        mult: ev.mult,
        rule: ev.rule,
        centsPerPoint: pointValue(c),
        blocked,
      };
    })
    .sort((a, b) => b.reward - a.reward);

  const pick = ranked.find((r) => !r.blocked) ?? null;

  return NextResponse.json({
    pick,
    ranked,
    blocked: ranked.filter((r) => r.blocked).map((r) => ({ cardId: r.cardId, why: r.blocked })),
    ms: Math.round((performance.now() - t0) * 100) / 100,
  });
}
