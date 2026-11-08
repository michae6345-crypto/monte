// After a capture: add the purchase to the signed-in person's cap counters, through the same
// applyPurchase() the register path was built around.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Txn } from "@/lib/engine";
import { applyPurchase, type CapRow } from "@/lib/db/cap-state";

/** false when this person doesn't hold the card: their counters have nothing to update. */
export async function persistCapture(db: SupabaseClient, userId: string, txn: Txn): Promise<boolean> {
  const { data: holding, error: hErr } = await db
    .from("holdings")
    .select("card_id, balance, apr, credits_used")
    .eq("user_id", userId)
    .eq("card_id", txn.cardUsed)
    .maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (!holding) return false;

  const { data: rows, error: cErr } = await db
    .from("cap_state")
    .select("card_id, pool_key, period_key, consumed")
    .eq("user_id", userId)
    .eq("card_id", txn.cardUsed);
  if (cErr) throw new Error(cErr.message);

  const before = ((rows ?? []) as CapRow[]).map((r) => ({ ...r, consumed: Number(r.consumed) }));
  const next = applyPurchase(before, { cardId: txn.cardUsed }, txn);
  if (next.length) {
    const { error } = await db
      .from("cap_state")
      .upsert(next.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,card_id,pool_key,period_key" });
    if (error) throw new Error(error.message);
  }
  return true;
}
