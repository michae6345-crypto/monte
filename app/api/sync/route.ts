// POST /api/sync — the one slow thing, done once.
//
// This is the "when you download the app" moment. It walks the history, writes the
// purchases, works out what every cap pool has already consumed, and stores those
// counters. After this runs, a tap never touches the history again.
//
// Auth: Authorization: Bearer <supabase jwt>
// Body: { source?: "plaid" | "upload", txns?, wallet? }
// Returns: { purchases, capRows, ms }

import { NextResponse } from "next/server";
import type { Holding, Txn } from "@/lib/engine";
import { capStateFrom } from "@/lib/db/cap-state";
import { serviceDb, notConfigured, requestUser, unauthorized } from "@/lib/db/client";


type Body = { txns?: Txn[]; wallet?: Holding[]; itemId?: string };

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
  const { txns, wallet, itemId } = body;
  if (!Array.isArray(txns) || !Array.isArray(wallet)) {
    return NextResponse.json({ error: "txns and wallet are required" }, { status: 400 });
  }

  // 1. the cards they hold. Balance and APR come from the account, not a guess.
  const holdingRows = wallet.map((h) => ({
    user_id: userId,
    card_id: h.cardId,
    item_id: itemId ?? null,
    balance: h.balance ?? 0,
    apr: h.apr ?? null,
    credits_used: h.creditsUsed ?? {},
  }));
  const { error: hErr } = await db.from("holdings").upsert(holdingRows, { onConflict: "user_id,card_id" });
  if (hErr) return NextResponse.json({ error: "db_error", detail: hErr.message }, { status: 502 });

  // 2. the purchases. external_id makes a re-sync idempotent rather than duplicating.
  const txnRows = txns.map((t) => ({
    user_id: userId,
    item_id: itemId ?? null,
    external_id: t.id,
    posted_on: t.date,
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    card_id: t.cardUsed || null,
  }));
  for (let i = 0; i < txnRows.length; i += 500) {
    const { error } = await db.from("transactions").upsert(txnRows.slice(i, i + 500), { onConflict: "user_id,external_id" });
    if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 502 });
  }

  // 3. the expensive part, done exactly once: how much of every cap is already spent.
  const caps = capStateFrom(wallet, txns).map((r) => ({ ...r, user_id: userId }));
  if (caps.length) {
    const { error } = await db.from("cap_state").upsert(caps, { onConflict: "user_id,card_id,pool_key,period_key" });
    if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 502 });
  }

  if (itemId) await db.from("bank_items").update({ last_synced: new Date().toISOString() }).eq("id", itemId).eq("user_id", userId);

  return NextResponse.json({
    purchases: txnRows.length,
    cards: holdingRows.length,
    capRows: caps.length,
    ms: Math.round((performance.now() - t0) * 100) / 100,
    note: "Caps are now cached. Every tap from here is a lookup, not a replay.",
  });
}
