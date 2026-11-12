"use client";

// The bank's own recurring charges (GET /api/plaid/recurring) for a linked Plaid feed.
// Returns null until they arrive, and stays null for demo people and on any failure
// (503 not configured, 409 not linked, network, empty list), so the caller falls back to
// the engine's subscriptions(txns) without saying anything.

import { useEffect, useState } from "react";
import type { RecurringCharge } from "@/lib/data/plaid-recurring";

/** `linked`: the current data came from a linked bank. `key`: changes when the feed does
 *  (a relink), so the list is fetched once per feed. */
export function useRecurring(linked: boolean, key: unknown): RecurringCharge[] | null {
  const [got, setGot] = useState<{ key: unknown; list: RecurringCharge[] } | null>(null);

  useEffect(() => {
    if (!linked) return;
    let live = true;
    fetch("/api/plaid/recurring", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { recurring?: RecurringCharge[] } | null) => {
        const list = Array.isArray(body?.recurring) ? body.recurring : [];
        if (live && list.length) setGot({ key, list });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [linked, key]);

  return linked && got && got.key === key ? got.list : null;
}
