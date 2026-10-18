"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { byCategory, byMonth, subscriptions, topMerchants } from "@/lib/engine/insights";
import { parseStatement } from "@/lib/engine/statement";
import { tap } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";
import { PERSONAS } from "@/lib/data/personas";
import { useBrand } from "./brands";
import { shortName } from "./card-art";
import { Num } from "./num";
import { Section } from "./section";
import { money, useAce } from "./store";

export const CAT_COLOR: Record<string, string> = {
  dining: "#ff7a59",
  groceries: "#7bd389",
  online_groceries: "#5fbf9b",
  gas: "#f2c14e",
  ev_charging: "#9be564",
  transit: "#6ec6ff",
  rideshare: "#4ea8de",
  airfare: "#8e7dff",
  hotels: "#b388eb",
  streaming: "#ff5d8f",
  drugstores: "#4dd0c1",
  home_improvement: "#d4a373",
  entertainment: "#f78fb3",
  rent: "#a0aec0",
  utilities: "#94a3b8",
  phone: "#7dd3fc",
  online_retail: "#fca311",
  wholesale_clubs: "#e76f51",
  everything_else: "#6b7280",
  other: "#6b7280",
};

export const label = (c: string) => c.replace(/_/g, " ");

export function MoneySection() {
  const { txns, persona, setPersona, useStatement, wallet } = useAce();
  const { brand: b } = useBrand();
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
          See your whole year <span className="serif text-ace-gold">at once.</span>
        </>
      }
      lede={`${b.name} reads a year of purchases and shows you what you actually spend on, where, and what keeps charging you every month. Try a demo person, or drop in your own statement.`}
    >
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPersona(p.id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${persona.id === p.id ? "border-ace-gold bg-ace-gold/10" : "border-ace-line text-ace-dim hover:text-ace-ink"}`}
          >
            {p.name}
          </button>
        ))}
        <StatementUpload onLoad={useStatement} defaultCard={wallet[0]?.cardId ?? "chase_freedom_unlimited"} active={persona.id === "you"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* treemap */}
        <div className="rounded-3xl border border-ace-line bg-ace-panel/70 p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">By category · {txns.length} purchases</div>
            <div className="text-right">
              <Num value={total} className="text-3xl font-semibold tnum" />
              <span className="mono ml-2 text-xs text-ace-dim">in a year</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
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
                    <rect x={t.x0} y={t.y0} width={w} height={h} rx={10} fill={CAT_COLOR[c] ?? "#6b7280"} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .25s" }} />
                    {w > 70 && h > 36 && (
                      <text x={t.x0 + 10} y={t.y0 + 22} fill="#0b0b0f" fontSize={w > 160 ? 15 : 12} fontWeight={700} style={{ textTransform: "capitalize" }}>
                        {label(c)}
                      </text>
                    )}
                    {w > 70 && h > 54 && (
                      <text x={t.x0 + 10} y={t.y0 + 40} fill="#0b0b0f" fontSize={12} opacity={0.75} className="mono">
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
        <div className="rounded-3xl border border-ace-line bg-ace-panel/70 p-5">
          <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">Top merchants</div>
          <div className="space-y-3">
            {merchants.map((m, i) => (
              <motion.div key={m.merchant} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{m.merchant}</span>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* months */}
        <div className="rounded-3xl border border-ace-line bg-ace-panel/70 p-5">
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
                <div className="mono mt-1.5 text-center text-[10px] text-ace-dim">{new Date(m.month + "-15").toLocaleString("en-US", { month: "short" })}</div>
              </div>
            ))}
          </div>
        </div>

        {/* subscriptions */}
        <div className="rounded-3xl border border-ace-line bg-ace-panel/70 p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Keeps charging you</div>
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
                  <div className="min-w-0">
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
        className={`rounded-full border px-4 py-2 text-sm transition ${active ? "border-ace-gold bg-ace-gold/10" : "border-dashed border-ace-gold/60 text-ace-gold hover:bg-ace-gold/10"}`}
      >
        ↑ Use my statement (CSV)
      </button>
      <select
        value={card}
        onChange={(e) => setCard(e.target.value)}
        className="rounded-full border border-ace-line bg-ace-panel px-3 py-2 text-xs text-ace-dim"
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
