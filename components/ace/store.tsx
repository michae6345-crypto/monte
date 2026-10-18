"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  r: Receipt;
  version: number;
};

const Ctx = createContext<Store | null>(null);

const YEARS = new Map(PERSONAS.map((p) => [p.id, yearOf(p)]));

export function AceProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [custom, setCustom] = useState<Txn[] | null>(null);
  const persona: Persona =
    personaId === "you"
      ? { id: "you", name: "You", blurb: "your own statement", wallet: [], habit: () => "", lines: [], seed: 0 }
      : PERSONAS.find((p) => p.id === personaId)!;
  const [wallet, setWallet] = useState<Holding[]>(PERSONAS[0].wallet);
  const [valuation, setVal] = useState<Valuation>("cash");
  const txns = personaId === "you" && custom ? custom : YEARS.get(personaId) ?? YEARS.get(PERSONAS[0].id)!;

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
      setPersonaId("you");
      setWallet([{ cardId }]);
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
