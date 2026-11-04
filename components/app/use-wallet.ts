"use client";

// The app's one piece of state: your cards (and, once a bank or statement is connected, a year
// of purchases). It lives in this browser's localStorage and nowhere else; the Plaid access
// token sits in an httpOnly cookie the server reads (see lib/data/plaid-server.ts).

import { useCallback, useSyncExternalStore } from "react";
import type { Holding, Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import type { CardBill } from "@/lib/data/plaid";

export type Source = "plaid" | "statement" | "manual" | "demo";

export type Saved = {
  v: 1;
  source: Source;
  /** "Plaid sandbox", "Chase statement", "Jordan (demo)", "Added by hand" */
  label: string;
  wallet: Holding[];
  txns: Txn[];
  /** from Plaid Liabilities: due dates, minimums, limits, per card id */
  bills?: Record<string, CardBill>;
  at: string;
};

const KEY = "monte.app.v1";
const listeners = new Set<() => void>();
let cache: Saved | null | undefined;

function read(): Saved | null {
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    // drop anything this build can't price (a card id no longer in the catalog would crash the engine)
    cache = s && s.v === 1 && Array.isArray(s.wallet) ? { ...s, wallet: s.wallet.filter((h) => known(h.cardId)) } : null;
  } catch {
    cache = null;
  }
  return cache;
}

function known(id: string) {
  try {
    card(id);
    return true;
  } catch {
    return false;
  }
}

function write(s: Saved | null) {
  cache = s;
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {
    // private mode or full storage: the app still works for this visit
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = undefined;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

/** undefined while the server renders and on the first client paint, then the saved wallet or null. */
export function useWallet() {
  const saved = useSyncExternalStore(subscribe, read, () => undefined);
  const save = useCallback((s: Omit<Saved, "v" | "at">) => write({ ...s, v: 1, at: new Date().toISOString() }), []);
  const update = useCallback((wallet: Holding[]) => {
    const cur = read();
    write({ v: 1, source: cur?.source ?? "manual", label: cur?.label ?? "Added by hand", txns: cur?.txns ?? [], bills: cur?.bills, wallet, at: new Date().toISOString() });
  }, []);
  const clear = useCallback(() => write(null), []);
  return { saved, save, update, clear };
}
