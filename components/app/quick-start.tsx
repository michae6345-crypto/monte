"use client";

// The first screen, made as easy as it can be: the cards themselves in a grid, most common first.
// Tap the ones in your wallet, tap Start, and you're on the Pay screen. Balances, a bank link or a
// statement can come later; none of them is needed to get the right card at the register.

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Holding } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { CardArt } from "@/components/ace/card-art";
import { shortName } from "@/lib/card-name";

// the cards most people carry, first (rough order of US popularity); the rest of the catalog after
const POPULAR = [
  "chase_sapphire_preferred",
  "chase_freedom_unlimited",
  "amex_gold",
  "citi_double_cash",
  "capital_one_venture_x",
  "apple_card",
  "capital_one_savor",
  "discover_it_cash_back",
  "amex_platinum",
  "wells_fargo_active_cash",
  "chase_freedom_flex",
  "amex_blue_cash_preferred",
  "capital_one_quicksilver",
  "chase_prime_visa",
  "citi_custom_cash",
  "bilt_blue",
];

export function QuickStart({ onStart, onConnect, onDemo }: { onStart: (w: Holding[]) => void; onConnect: () => void; onDemo: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const order = useMemo(() => {
    const rank = (id: string) => (POPULAR.includes(id) ? POPULAR.indexOf(id) : 100);
    return [...CARDS].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, []);
  const shown = order.filter((c) => !q.trim() || `${c.name} ${c.issuer}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className="pt-6">
      <h1 className="text-[2.3rem] leading-[1.03]" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.035em" }}>
        The right card,
        <span className="block text-ace-dim">every time you pay.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ace-dim">Tap the cards in your wallet. That&apos;s all Monte needs to tell you which one to use.</p>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ace-dim" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a card"
          aria-label="Find a card"
          className="h-10 w-full rounded-[12px] bg-[var(--m-wash)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
        />
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 pb-28" aria-label="Cards">
        {shown.map((c) => {
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className={`relative w-full rounded-[14px] p-1.5 text-left transition ${on ? "bg-[var(--m-accent-wash)] ring-2 ring-[var(--m-accent)]" : "hover:bg-[var(--m-wash)]"}`}
              >
                <CardArt id={c.id} size="sm" className={on ? "" : "opacity-90"} />
                <span className="mt-1.5 block truncate px-0.5 text-[12px] leading-tight">{shortName(c.id)}</span>
                {on && (
                  <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--m-accent)] text-white shadow">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="col-span-2 py-6 text-center text-sm text-ace-dim">No card by that name in Monte&apos;s {CARDS.length}-card catalog yet.</li>}
      </ul>

      {/* the action stays in reach: pinned above the tab bar */}
      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-[var(--m-line)] bg-[color-mix(in_oklab,var(--m-ground)_92%,transparent)] px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center gap-2">
          <button type="button" disabled={!picked.length} onClick={() => onStart(picked.map((cardId) => ({ cardId })))} className="btn btn-primary flex-1 justify-center disabled:opacity-40">
            {picked.length ? `Start with ${picked.length} card${picked.length === 1 ? "" : "s"}` : "Tap your cards"}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-[480px] text-center text-xs text-ace-dim">
          or{" "}
          <button type="button" onClick={onConnect} className="underline underline-offset-2">
            connect your bank
          </button>{" "}
          ·{" "}
          <button type="button" onClick={onDemo} className="underline underline-offset-2">
            try a demo wallet
          </button>
        </p>
      </div>
    </section>
  );
}
