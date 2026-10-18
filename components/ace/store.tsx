"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { receipt, setValuation, type Holding, type Receipt, type Txn, type Valuation } from "@/lib/engine";
import { PERSONAS, yearOf, type Persona } from "@/lib/data/personas";

type Store = {
  persona: Persona;
  setPersona: (id: string) => void;
  wallet: Holding[];
  setWallet: (w: Holding[]) => void;
  addCard: (id: string) => void;
  removeCard: (id: string) => void;
  toggleBalance: (id: string) => void;
  valuation: Valuation;
  setValuationMode: (v: Valuation) => void;
  txns: Txn[];
  /** Run everything on the user's own statement (parsed in the browser). */
  useStatement: (txns: Txn[], cardId: string) => void;
  /** Merchant corrections: a merchant re-categorised once applies to every purchase there. */
  overrides: Record<string, string>;
  setOverride: (merchant: string, category: string | null) => void;
  resetOverrides: () => void;
  /** Run everything on a linked bank's feed (Plaid sandbox): its purchases and its cards. */
  loadFeed: (txns: Txn[], wallet: Holding[], label: string) => void;
  r: Receipt;
  version: number;
};

const Ctx = createContext<Store | null>(null);

const YEARS = new Map(PERSONAS.map((p) => [p.id, yearOf(p)]));

export function AceProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [custom, setCustom] = useState<Txn[] | null>(null);
  const [customLabel, setCustomLabel] = useState("your own statement");
  const persona: Persona =
    personaId === "you"
      ? { id: "you", name: "You", blurb: customLabel, wallet: [], habit: () => "", lines: [], seed: 0 }
      : PERSONAS.find((p) => p.id === personaId)!;
  const [wallet, setWallet] = useState<Holding[]>(PERSONAS[0].wallet);
  const [valuation, setVal] = useState<Valuation>("cash");
  const base = personaId === "you" && custom ? custom : YEARS.get(personaId) ?? YEARS.get(PERSONAS[0].id)!;
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("monte-overrides") ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && typeof saved === "object") setOverrides(saved);
    } catch {}
  }, []);
  const txns = useMemo(
    () => (Object.keys(overrides).length ? base.map((t) => (overrides[t.merchant] ? { ...t, category: overrides[t.merchant] } : t)) : base),
    [base, overrides],
  );

  setValuation(valuation);
  // valuation is read inside the engine, so it must re-run when it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => receipt(wallet, txns), [wallet, txns, valuation]);

  const store: Store = {
    persona,
    setPersona: (id) => {
      const p = PERSONAS.find((x) => x.id === id)!;
      setPersonaId(id);
      setWallet(p.wallet);
    },
    wallet,
    setWallet,
    addCard: (id) => setWallet((w) => (w.some((h) => h.cardId === id) || w.length >= 5 ? w : [...w, { cardId: id }])),
    removeCard: (id) => setWallet((w) => (w.length <= 1 ? w : w.filter((h) => h.cardId !== id))),
    toggleBalance: (id) =>
      setWallet((w) =>
        w.map((h) => (h.cardId === id ? (h.balance ? { ...h, balance: 0 } : { ...h, balance: 2000, apr: h.apr ?? 24.99 }) : h)),
      ),
    valuation,
    setValuationMode: setVal,
    txns,
    useStatement: (t, cardId) => {
      setCustom(t);
      setCustomLabel("your own statement");
      setPersonaId("you");
      setWallet([{ cardId }]);
    },
    overrides,
    resetOverrides: () => {
      setOverrides({});
      try {
        localStorage.removeItem("monte-overrides");
      } catch {}
    },
    setOverride: (m, c) =>
      setOverrides((o) => {
        const next = { ...o };
        if (c) next[m] = c;
        else delete next[m];
        try {
          localStorage.setItem("monte-overrides", JSON.stringify(next));
        } catch {}
        return next;
      }),
    loadFeed: (t, w, label) => {
      if (!t.length || !w.length) return;
      setCustom(t);
      setCustomLabel(label);
      setPersonaId("you");
      setWallet(w);
    },
    r,
    version: wallet.length * 100 + (valuation === "cash" ? 0 : 1),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useAce() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useAce outside AceProvider");
  return s;
}

export const money = (n: number, opts: { sign?: boolean; cents?: boolean } = {}) => {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
  if (opts.sign) return `${n < 0 ? "−" : "+"}$${s}`;
  return `${n < 0 ? "−" : ""}$${s}`;
};
