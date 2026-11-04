"use client";

// "How did this code?": a store's category, corrected by you once and kept (in this browser).
// The Pay screen uses it for that store, and your year of purchases is re-read with it.

import { useCallback, useSyncExternalStore } from "react";
import type { Txn } from "@/lib/engine";

const KEY = "monte.app.fixes.v1";
const listeners = new Set<() => void>();
let cache: Record<string, string> | undefined;
const EMPTY: Record<string, string> = {};

export const storeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

function read(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    cache = {};
  }
  return cache!;
}

export function useFixes() {
  const fixes = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
  const setFix = useCallback((store: string, category: string | null) => {
    const next = { ...read() };
    if (category) next[storeKey(store)] = category;
    else delete next[storeKey(store)];
    cache = next;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // private mode: the fix lasts this visit
    }
    listeners.forEach((l) => l());
  }, []);
  return { fixes, setFix };
}

/** "Forget everything" forgets these too. */
export function clearFixes() {
  cache = {};
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
  listeners.forEach((l) => l());
}

/** Purchases with your corrections applied (by store name). */
export function applyFixes(txns: Txn[], fixes: Record<string, string>): Txn[] {
  if (!Object.keys(fixes).length) return txns;
  return txns.map((t) => {
    const c = fixes[storeKey(t.merchant)];
    return c && c !== t.category ? { ...t, category: c } : t;
  });
}
