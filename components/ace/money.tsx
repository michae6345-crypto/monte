"use client";

import { useMemo, useRef, useState } from "react";
import { byCategory, subscriptions } from "@/lib/engine/insights";
import { parseStatement } from "@/lib/engine/statement";
import { tap } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { shortName } from "./card-art";
import { Num } from "./num";
import { Bracketed } from "@/components/brand";
import { MerchantLogo } from "./merchant-logo";
import { R, Section } from "./section";
import { MonthStrip, StorePack } from "./store-pack";
import { LinkBank } from "./link-bank";
import { money, useAce } from "./store";

// Four tones, grouped by what the money is for, not a rainbow: food in the accent, then
// getting around, bills, and shopping in steps of ink.
const TONE = {
  food: "var(--m-ink)",
  move: "color-mix(in oklab, var(--m-ink) 70%, var(--m-panel))",
  bills: "color-mix(in oklab, var(--m-ink) 45%, var(--m-panel))",
  shop: "color-mix(in oklab, var(--m-ink) 22%, var(--m-panel))",
};
const GROUP: Record<string, keyof typeof TONE> = {
  dining: "food", groceries: "food", online_groceries: "food", wholesale_clubs: "food",
  gas: "move", ev_charging: "move", transit: "move", rideshare: "move", airfare: "move", hotels: "move", travel_portal: "move",
  streaming: "bills", rent: "bills", utilities: "bills", phone: "bills", drugstores: "bills",
  online_retail: "shop", home_improvement: "shop", entertainment: "shop", everything_else: "shop", other: "shop",
};
export const CAT_COLOR: Record<string, string> = Object.fromEntries(Object.entries(GROUP).map(([c, g]) => [c, TONE[g]]));
export const CAT_TEXT = (c: string) => (GROUP[c] === "food" || GROUP[c] === "move" ? "var(--m-ground)" : "var(--ace-ink)");

export const label = (c: string) => c.replace(/_/g, " ");

export function MoneySection() {
  const { txns, persona, useStatement, wallet } = useAce();
  const cats = useMemo(() => byCategory(txns), [txns]);
  const total = cats.reduce((a, c) => a + c.total, 0);
  const subs = useMemo(() => subscriptions(txns), [txns]);

  return (
    <Section
      id="money"
      index="01"
      kicker="Where your money goes"
      title={
        <>
          {persona.id === "you" ? "You" : persona.name} spent <Bracketed>{money(total)}</Bracketed> last year.
          <span className="m-second block">Here is where it went.</span>
        </>
      }
      readout={
        <>
          <R>{txns.length}</R> purchases · <R>{cats.length}</R> categories · <R>{subs.length}</R> recurring
        </>
      }
      lede="A year of purchases by category, merchant and month, and the subscriptions still billing. Switch person in the bar above, or drop in your own statement."
    >
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <StatementUpload onLoad={useStatement} defaultCard={wallet[0]?.cardId ?? "chase_freedom_unlimited"} active={persona.id === "you"} />
        <LinkBank />
      </div>

      <StorePack txns={txns} wallet={wallet} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <MonthStrip txns={txns} />
        {/* subscriptions */}
        <div className="m-panel p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="m-label">Keeps charging you</div>
            <span className="mono text-sm">
              <Num value={subs.reduce((a, s) => a + s.perYear, 0)} />
              <span className="text-ace-dim">/yr</span>
            </span>
          </div>
          {subs.length === 0 && <p className="text-sm text-ace-dim">No recurring charges found.</p>}
          <div className="space-y-3">
            {subs.slice(0, 7).map((s) => {
              const best = tap(wallet, { date: "2026-10-18", merchant: s.merchant, category: s.category, amount: s.amount }).pick;
              return (
                <div key={s.merchant} className="flex items-center justify-between gap-3 text-sm">
                  <MerchantLogo name={s.merchant} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {s.merchant}
                      {s.priceHike && <span className="m-label ml-2 rounded-full px-1.5 py-0.5 shadow-[0_0_0_1px_var(--m-line-strong)]">price up</span>}
                    </div>
                    <div className="mono truncate text-[10px] text-ace-dim">
                      every {s.cadenceDays}d · best on {shortName(best.cardId)}
                    </div>
                  </div>
                  <span className="mono shrink-0">{money(s.amount, { cents: true })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}

function StatementUpload({ onLoad, defaultCard, active }: { onLoad: (t: import("@/lib/engine").Txn[], card: string) => void; defaultCard: string; active: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [card, setCard] = useState(defaultCard);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => ref.current?.click()}
        className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}
      >
        Upload a statement (CSV)
      </button>
      <select
        value={card}
        onChange={(e) => setCard(e.target.value)}
        className="btn-sm h-9 rounded-full bg-ace-panel px-3 text-xs text-ace-dim shadow-[0_0_0_1px_var(--m-line-strong)]"
        aria-label="Which card is this statement from"
      >
        {CARDS.map((c) => (
          <option key={c.id} value={c.id}>
            from: {shortName(c.id)}
          </option>
        ))}
      </select>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const res = parseStatement(await f.text(), card);
            if (res.txns.length === 0) throw new Error("No purchases found in that file.");
            onLoad(res.txns, card);
            setMsg(`${res.txns.length} purchases loaded (${res.skipped} payments, refunds or fees skipped). Stays in your browser.`);
          } catch (err) {
            setMsg((err as Error).message);
          }
          e.target.value = "";
        }}
      />
      {msg && <span className="text-xs text-ace-dim">{msg}</span>}
    </div>
  );
}
