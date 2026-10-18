"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { byCategory, byMonth, subscriptions, topMerchants } from "@/lib/engine/insights";
import { parseStatement } from "@/lib/engine/statement";
import { tap } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { shortName } from "./card-art";
import { Num } from "./num";
import { Bracketed, HandNote } from "@/components/brand";
import { MerchantLogo } from "./merchant-logo";
import { R, Section } from "./section";
import { LinkBank } from "./link-bank";
import { money, useAce } from "./store";

// Four tones, grouped by what the money is for, not a rainbow: food in the accent, then
// getting around, bills, and shopping in steps of ink.
const TONE = {
  food: "var(--ace-gold)",
  move: "color-mix(in oklab, var(--ace-gold) 45%, var(--ace-panel))",
  bills: "color-mix(in oklab, var(--ace-ink) 20%, var(--ace-panel))",
  shop: "color-mix(in oklab, var(--ace-ink) 9%, var(--ace-panel))",
};
const GROUP: Record<string, keyof typeof TONE> = {
  dining: "food", groceries: "food", online_groceries: "food", wholesale_clubs: "food",
  gas: "move", ev_charging: "move", transit: "move", rideshare: "move", airfare: "move", hotels: "move", travel_portal: "move",
  streaming: "bills", rent: "bills", utilities: "bills", phone: "bills", drugstores: "bills",
  online_retail: "shop", home_improvement: "shop", entertainment: "shop", everything_else: "shop", other: "shop",
};
export const CAT_COLOR: Record<string, string> = Object.fromEntries(Object.entries(GROUP).map(([c, g]) => [c, TONE[g]]));
export const CAT_TEXT = (c: string) => (GROUP[c] === "food" ? "var(--ace-on-accent)" : "var(--ace-ink)");

export const label = (c: string) => c.replace(/_/g, " ");

export function MoneySection() {
  const { txns, persona, useStatement, wallet } = useAce();
  const [hover, setHover] = useState<string | null>(null);
  const cats = useMemo(() => byCategory(txns), [txns]);
  const total = cats.reduce((a, c) => a + c.total, 0);
  const top5 = cats.slice(0, 5).map((c) => c.category);
  const months = useMemo(() => byMonth(txns, top5), [txns, top5]);
  const merchants = useMemo(() => topMerchants(txns, 8), [txns]);
  const subs = useMemo(() => subscriptions(txns), [txns]);

  const W = 720;
  const H = 380;
  const tiles = useMemo(() => {
    const root = hierarchy({ children: cats.map((c) => ({ ...c, value: c.total })) } as { children: { category: string; value: number; share: number; count: number }[] })
      .sum((d) => (d as { value?: number }).value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    treemap<typeof root.data>().tile(treemapSquarify).size([W, H]).paddingInner(4).round(true)(root);
    return root.leaves() as unknown as { x0: number; y0: number; x1: number; y1: number; data: { category: string; value: number; share: number; count: number } }[];
  }, [cats]);

  const maxMonth = Math.max(...months.map((m) => m.total), 1);

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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {/* treemap */}
        <div className="m-panel relative p-5">
          {cats[0] && (
            <HandNote dir="down-left" className="absolute -top-9 right-28 hidden md:flex" delay={0.4}>
              {label(cats[0].category)} is {Math.round(cats[0].share * 100)}% of everything
            </HandNote>
          )}
          <div className="mb-4 flex items-baseline justify-between">
            <div className="m-label">By category · {txns.length} purchases</div>
            <div className="text-right">
              <Num value={total} className="text-3xl font-semibold tnum" />
              <span className="mono ml-2 text-xs text-ace-dim">in a year</span>
            </div>
          </div>
          <div className="space-y-2 sm:hidden">
            {cats.slice(0, 8).map((c) => (
              <div key={c.category} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate capitalize">{label(c.category)}</span>
                <div className="h-2 min-w-0 flex-1 rounded-sm bg-ace-line">
                  <div className="h-full rounded-sm" style={{ width: `${(c.total / cats[0].total) * 100}%`, background: CAT_COLOR[c.category] }} />
                </div>
                <span className="mono w-16 shrink-0 text-right text-xs text-ace-dim">{money(c.total)}</span>
              </div>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-auto w-full sm:block">
            <AnimatePresence>
              {tiles.map((t, i) => {
                const w = t.x1 - t.x0;
                const h = t.y1 - t.y0;
                const c = t.data.category;
                const dim = hover && hover !== c;
                return (
                  <motion.g
                    key={c}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.5 }}
                    style={{ transformOrigin: `${t.x0 + w / 2}px ${t.y0 + h / 2}px` }}
                    onMouseEnter={() => setHover(c)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <rect x={t.x0} y={t.y0} width={w} height={h} rx={3} opacity={dim ? 0.35 : 1} style={{ fill: CAT_COLOR[c] ?? TONE.shop, transition: "opacity .25s" }} />
                    {w > 70 && h > 36 && (
                      <text x={t.x0 + 10} y={t.y0 + 22} fontSize={w > 160 ? 15 : 12} fontWeight={700} style={{ textTransform: "capitalize", fill: CAT_TEXT(c) }}>
                        {label(c)}
                      </text>
                    )}
                    {w > 70 && h > 54 && (
                      <text x={t.x0 + 10} y={t.y0 + 40} fontSize={12} opacity={0.75} className="mono" style={{ fill: CAT_TEXT(c) }}>
                        {money(t.data.value)} · {Math.round(t.data.share * 100)}%
                      </text>
                    )}
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </svg>
        </div>

        {/* merchants */}
        <div className="m-panel p-5">
          <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">Top merchants</div>
          <div className="space-y-3">
            {merchants.map((m, i) => (
              <motion.div key={m.merchant} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <MerchantLogo name={m.merchant} size={20} />
                    <span className="truncate">{m.merchant}</span>
                  </span>
                  <span className="mono shrink-0 text-ace-dim">
                    {m.count}× · <span className="text-ace-ink">{money(m.total)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ace-line">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: CAT_COLOR[m.category] }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(m.total / merchants[0].total) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {/* months */}
        <div className="m-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Month by month</div>
            <div className="flex flex-wrap gap-3">
              {[...top5, "other"].map((c) => (
                <span key={c} className="flex items-center gap-1.5 text-xs capitalize text-ace-dim">
                  <span className="size-2 rounded-full" style={{ background: CAT_COLOR[c] }} />
                  {label(c)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-56 items-end gap-2">
            {months.map((m, i) => (
              <div key={m.month} className="group flex h-full flex-1 flex-col justify-end">
                <div className="mono mb-1 text-center text-[10px] text-ace-dim opacity-0 transition group-hover:opacity-100">{money(m.total)}</div>
                <motion.div
                  className="flex flex-col-reverse overflow-hidden rounded-md"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${(m.total / maxMonth) * 85}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  {[...top5, "other"].map((c) =>
                    m.parts[c] ? <div key={c} style={{ height: `${(m.parts[c] / m.total) * 100}%`, background: CAT_COLOR[c] }} /> : null,
                  )}
                </motion.div>
                <div className="mono mt-1.5 text-center text-[10px] text-ace-dim">{new Date(m.month + "-15").toLocaleString("en-US", { month: "short" })}
                  {i === 0 || i === months.length - 1 ? ` ’${m.month.slice(2, 4)}` : ""}</div>
              </div>
            ))}
          </div>
        </div>

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
                      {s.priceHike && <span className="mono ml-2 rounded bg-ace-loss/15 px-1.5 py-0.5 text-[10px] uppercase text-ace-loss">price up</span>}
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
        className={`rounded-md border px-4 py-2 text-sm transition ${active ? "border-ace-gold bg-ace-gold/10" : "border-dashed border-ace-gold/60 text-ace-gold hover:bg-ace-gold/10"}`}
      >
        ↑ Use my statement (CSV)
      </button>
      <select
        value={card}
        onChange={(e) => setCard(e.target.value)}
        className="rounded-md border border-ace-line bg-ace-panel px-3 py-2 text-xs text-ace-dim"
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
