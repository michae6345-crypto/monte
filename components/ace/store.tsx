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
  /** A what-if: the card joins the wallet for projections only, never last year's numbers. */
  tryCard: (id: string) => void;
  /** The cards actually held: the wallet without what-if cards. Last year's sections use this. */
  held: Holding[];
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
  const [trials, setTrials] = useState<string[]>([]);
  const held = useMemo(() => (trials.length ? wallet.filter((h) => !trials.includes(h.cardId)) : wallet), [wallet, trials]);
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
  const r = useMemo(() => receipt(held, txns), [held, txns, valuation]);

  const store: Store = {
    persona,
    setPersona: (id) => {
      const p = PERSONAS.find((x) => x.id === id)!;
      setPersonaId(id);
      setWallet(p.wallet);
      setTrials([]);
    },
    wallet,
    setWallet,
    addCard: (id) => setWallet((w) => (w.some((h) => h.cardId === id) || w.length >= 5 ? w : [...w, { cardId: id }])),
    tryCard: (id) => {
      if (wallet.some((h) => h.cardId === id) || wallet.length >= 5) return;
      setTrials((t) => [...t, id]);
      setWallet((w) => [...w, { cardId: id }]);
    },
    held,
    removeCard: (id) => {
      setTrials((t) => t.filter((x) => x !== id));
      setWallet((w) => (w.length <= 1 ? w : w.filter((h) => h.cardId !== id)));
    },
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

/** How to say a person's name in a sentence. "The Parks" and "you" are plural and take
 *  "the Parks'" / "your"; everyone else is "Maya" / "Maya's". */
export function nameOf(p: { id: string; name: string }) {
  if (p.id === "you") return { Who: "You", who: "you", Whose: "Your", whose: "your", plural: true };
  const mid = p.name.replace(/^The /, "the ");
  const plural = /s$/.test(p.name) && /^The /.test(p.name);
  return { Who: p.name, who: mid, Whose: plural ? `${p.name}'` : `${p.name}'s`, whose: plural ? `${mid}'` : `${mid}'s`, plural };
}
/** verb agreement: v(n, "carries", "carry") */
export const v = (n: { plural: boolean }, one: string, many: string) => (n.plural ? many : one);

export const money = (n: number, opts: { sign?: boolean; cents?: boolean } = {}) => {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
  if (opts.sign) return `${n < 0 ? "−" : "+"}$${s}`;
  return `${n < 0 ? "−" : ""}$${s}`;
};
