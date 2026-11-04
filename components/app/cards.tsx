"use client";

// Cards: what's in the wallet, what each card is best at, and whether it carries a balance
// (which is what decides whether Monte will put new spending on it). Editable by hand: Plaid
// fills it in, but a card can also be added from the catalog or a balance corrected.

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { evaluate, type Holding, type Txn } from "@/lib/engine";
import { CARDS, card } from "@/lib/engine/catalog";
import { aprOf } from "@/lib/engine/interest";
import { CATEGORY_LABEL } from "@/lib/merchants";
import { CardMini, shortName } from "@/components/ace/card-art";
import { money } from "@/components/ace/store";

const SAMPLE_CATS = Object.keys(CATEGORY_LABEL).filter((c) => c !== "travel_portal");

/** A card's three best categories, by what $100 there earns (at 1¢ a point unless travel is set). */
export function bestFor(cardId: string): { category: string; mult: number }[] {
  const c = card(cardId);
  const rows = SAMPLE_CATS.map((category) => {
    const t: Txn = { id: "s", date: "2026-11-01", merchant: "", amount: 100, category, cardUsed: cardId };
    const e = evaluate(c, t, new Map(), null);
    return { category, mult: e.mult, reward: e.reward };
  }).sort((a, b) => b.reward - a.reward);
  const base = rows[rows.length - 1]?.reward ?? 0;
  const top = rows.filter((r) => r.reward > base + 0.001 && r.category !== "everything_else").slice(0, 3);
  return top.length ? top : [{ category: "everything_else", mult: rows[0]?.mult ?? 1 }];
}

export function Cards({ wallet, onChange }: { wallet: Holding[]; onChange: (w: Holding[]) => void }) {
  const [adding, setAdding] = useState(wallet.length === 0);
  const [q, setQ] = useState("");
  const have = new Set(wallet.map((h) => h.cardId));
  const matches = useMemo(() => {
    const k = q.toLowerCase().trim();
    return CARDS.filter((c) => !have.has(c.id) && (!k || `${c.name} ${c.issuer}`.toLowerCase().includes(k))).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, wallet]);

  const set = (id: string, patch: Partial<Holding>) => onChange(wallet.map((h) => (h.cardId === id ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-3">
      {wallet.map((h) => (
        <CardRow key={h.cardId} h={h} onSet={(p) => set(h.cardId, p)} onRemove={() => onChange(wallet.filter((x) => x.cardId !== h.cardId))} />
      ))}

      {adding ? (
        <section className="m-panel p-4">
          <label htmlFor="addcard" className="m-label">
            Add a card you have
          </label>
          <input
            id="addcard"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sapphire, Amex Gold, Discover…"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-[12px] bg-[var(--m-wash)] px-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
          />
          <ul className="mt-2 divide-y divide-[var(--m-line)]">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...wallet, { cardId: c.id }]);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[var(--m-wash)]"
                >
                  <CardMini id={c.id} width={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{shortName(c.id)}</span>
                    <span className="mono block text-[11px] text-ace-dim">
                      {c.issuer} · {c.annual_fee ? `$${c.annual_fee}/yr` : "no annual fee"}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 text-ace-dim" />
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="py-3 text-sm text-ace-dim">No card by that name in Monte&apos;s {CARDS.length}-card catalog yet.</li>}
          </ul>
          {wallet.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost btn-sm mt-3">
              Done
            </button>
          )}
        </section>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost w-full justify-center">
          <Plus className="h-4 w-4" /> Add a card
        </button>
      )}
    </div>
  );
}

function CardRow({ h, onSet, onRemove }: { h: Holding; onSet: (p: Partial<Holding>) => void; onRemove: () => void }) {
  const c = card(h.cardId);
  const best = useMemo(() => bestFor(h.cardId), [h.cardId]);
  const [edit, setEdit] = useState(false);
  const carries = !!h.balance && h.balance > 0;
  return (
    <section className="m-panel p-4">
      <div className="flex items-start gap-3">
        <CardMini id={h.cardId} width={64} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-tight">{shortName(h.cardId)}</div>
          <div className="mono mt-0.5 text-[11px] text-ace-dim">{c.annual_fee ? `$${c.annual_fee}/yr` : "no annual fee"}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {best.map((b) => (
              <span key={b.category} className="rounded-full bg-[var(--m-wash)] px-2 py-0.5 text-[11px]">
                {b.mult % 1 ? b.mult.toFixed(1) : b.mult}× {CATEGORY_LABEL[b.category]?.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${shortName(h.cardId)}`} className="grid h-8 w-8 place-items-center rounded-full text-ace-dim hover:bg-[var(--m-wash)]">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--m-line)] pt-3 text-sm">
        <span className={carries ? "m-loss" : "text-ace-dim"}>
          {carries ? `Carries ${money(h.balance!)} at ${aprOf(h)}% APR` : "Paid in full"}
        </span>
        <button type="button" onClick={() => setEdit((v) => !v)} className="text-xs underline decoration-[var(--m-line-strong)] underline-offset-4">
          {edit ? "Close" : "Edit balance"}
        </button>
      </div>
      {edit && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="m-label">Balance carried</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={h.balance ?? 0}
              onChange={(e) => onSet({ balance: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-[10px] bg-[var(--m-wash)] px-3 outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="m-label">Purchase APR %</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={h.apr ?? c.purchase_apr_range[1]}
              onChange={(e) => onSet({ apr: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-[10px] bg-[var(--m-wash)] px-3 outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
            />
          </label>
          <p className="col-span-2 text-xs text-ace-dim">
            Only a balance you didn&apos;t pay off last statement counts. This month&apos;s purchases don&apos;t, if you pay the statement in full.
          </p>
        </div>
      )}
    </section>
  );
}
