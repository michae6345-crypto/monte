"use client";

// Where the money went, as the stores themselves: one bubble per store, its own logo inside,
// sized by what was spent there and packed into its category. Hover or tap a store for the
// year there and the card Monte would use. Months below as a strip led by each month's top store.

import { hierarchy, pack } from "d3-hierarchy";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { tap, type Holding, type Txn } from "@/lib/engine";
import { CardArt, shortName } from "./card-art";
import { MERCHANT_LOGOS } from "./merchant-logos";
import { merchantSlug, MerchantLogo } from "./merchant-logo";
import { label } from "./money";
import { money } from "./store";

type Store = { merchant: string; category: string; total: number; count: number };
type Node = { name: string; children?: Node[]; store?: Store; value?: number };

const W = 760;
const H = 560;
const display = { fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.03em" } as const;
const hand = { fontFamily: "var(--m-font-note)", fontVariationSettings: '"INFM" 100, "BNCE" 30', fontWeight: 600 } as const;

/** month: 0..12 — how many months of the year have "happened" (12 = the whole year). */
export function StorePack({ txns, wallet, month = 12 }: { txns: Txn[]; wallet: Holding[]; month?: number }) {
  const stores = useMemo(() => {
    const m = new Map<string, Store>();
    for (const t of txns) {
      const s = m.get(t.merchant) ?? { merchant: t.merchant, category: t.category, total: 0, count: 0 };
      s.total += t.amount;
      s.count++;
      m.set(t.merchant, s);
    }
    return [...m.values()];
  }, [txns]);

  const monthKeys = useMemo(() => [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort().slice(-12), [txns]);
  const upTo = useMemo(() => {
    const keep = new Set(monthKeys.slice(0, month));
    const m = new Map<string, number>();
    let total = 0;
    for (const t of txns)
      if (keep.has(t.date.slice(0, 7))) {
        m.set(t.merchant, (m.get(t.merchant) ?? 0) + t.amount);
        total += t.amount;
      }
    return { m, total, label: monthKeys[Math.max(0, month - 1)] };
  }, [txns, monthKeys, month]);

  const layout = useMemo(() => {
    const byCat = new Map<string, Store[]>();
    for (const s of stores) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
    const data: Node = {
      name: "year",
      children: [...byCat.entries()].map(([c, list]) => ({ name: c, children: list.map((s) => ({ name: s.merchant, store: s, value: s.total })) })),
    };
    const root = hierarchy<Node>(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    pack<Node>().size([W, H]).padding((d) => (d.depth === 0 ? 10 : 3))(root);
    type P = { x: number; y: number; r: number; data: Node; value?: number };
    const cats = (root.children ?? []) as unknown as P[];
    const leaves = root.leaves() as unknown as P[];
    return { cats, leaves, total: root.value ?? 1 };
  }, [stores]);

  const top = [...stores].sort((a, b) => b.total - a.total)[0];
  const [sel, setSel] = useState<string | null>(null);
  const cur = stores.find((s) => s.merchant === (sel ?? top?.merchant)) ?? top;
  const pick = useMemo(() => (cur ? tap(wallet, { date: "2026-10-18", merchant: cur.merchant, category: cur.category, amount: cur.total / cur.count }).pick : null), [cur, wallet]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
      <div className="m-panel relative overflow-hidden p-3 md:p-5">
        {month < 12 && upTo.label && (
          <div className="pointer-events-none absolute left-5 top-4 z-10" style={display}>
            <div className="text-4xl">{money(upTo.total)}</div>
            <div className="text-sm" style={{ fontFamily: "var(--m-font-body)", fontWeight: 400, letterSpacing: 0 }}>
              spent by the end of {new Date(upTo.label + "-15T12:00:00Z").toLocaleString("en-US", { month: "long", timeZone: "UTC" })}
            </div>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${stores.length} stores, sized by spend and grouped by category.`}>
          {layout.cats.map((c) => (
            <g key={c.data.name}>
              <circle cx={c.x} cy={c.y} r={c.r} style={{ fill: "var(--m-ground)", stroke: "var(--m-line)" }} />
            </g>
          ))}
          {layout.leaves.map((l, k) => {
            const s = l.data.store!;
            const on = cur?.merchant === s.merchant;
            const file = MERCHANT_LOGOS[merchantSlug(s.merchant)];
            // a bubble grows as the year's spending there happens
            const grown = month >= 12 ? l.r : l.r * Math.sqrt((upTo.m.get(s.merchant) ?? 0) / s.total);
            if (grown < 0.5) return null;
            const logo = grown * 1.05;
            return (
              <motion.g
                key={s.merchant}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(1.2, k * 0.012), type: "spring", stiffness: 160, damping: 16 }}
                style={{ transformOrigin: `${l.x}px ${l.y}px`, cursor: "pointer" }}
                onMouseEnter={() => setSel(s.merchant)}
                onClick={() => setSel(s.merchant)}
              >
                <circle
                  cx={l.x}
                  cy={l.y}
                  r={grown}
                  style={{ fill: "var(--m-panel)", stroke: on ? "var(--m-ink)" : "var(--m-line-strong)", strokeWidth: on ? 2.5 : 1 }}
                />
                {file && grown > 9 ? (
                  <image href={`/merchants/${file}`} x={l.x - logo / 2} y={l.y - logo / 2} width={logo} height={logo} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} />
                ) : grown > 9 ? (
                  <text x={l.x} y={l.y + grown * 0.18} textAnchor="middle" fontSize={grown * 0.6} style={{ ...display, fill: "var(--m-slate)" }}>
                    {s.merchant.charAt(0)}
                  </text>
                ) : null}
              </motion.g>
            );
          })}
          {layout.cats
            .filter((c) => c.r > 46)
            .map((c) => (
              <text key={"t" + c.data.name} x={c.x} y={c.y - c.r - 6} textAnchor="middle" fontSize={17} style={{ ...hand, fill: "var(--m-slate)" }}>
                {label(c.data.name)} {Math.round(((c.value ?? 0) / layout.total) * 100)}%
              </text>
            ))}
        </svg>
      </div>

      <div className="m-panel flex flex-col p-6">
        <p className="m-label">hover a store</p>
        <AnimatePresence mode="wait">
          {cur && (
            <motion.div key={cur.merchant} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="mt-4 flex flex-1 flex-col">
              <div className="flex items-center gap-4">
                <MerchantLogo name={cur.merchant} size={56} className="rounded-[14px]" />
                <div className="min-w-0">
                  <div className="truncate text-2xl" style={display}>
                    {cur.merchant}
                  </div>
                  <div className="text-sm capitalize text-ace-dim">{label(cur.category)}</div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-4xl" style={display}>
                    {money(cur.total)}
                  </div>
                  <div className="mt-1 text-sm text-ace-dim">this year</div>
                </div>
                <div>
                  <div className="text-4xl" style={display}>
                    {cur.count}
                  </div>
                  <div className="mt-1 text-sm text-ace-dim">visits · {money(cur.total / cur.count)} each</div>
                </div>
              </div>
              {pick && (
                <div className="mt-auto flex items-center gap-3 rounded-[14px] bg-[var(--m-wash)] p-3 pt-3">
                  <CardArt id={pick.cardId} size="sm" className="w-16 shrink-0 shadow-none" />
                  <div className="min-w-0 text-sm">
                    <div className="text-ace-dim">Monte pays here with</div>
                    <div className="truncate font-medium">
                      {shortName(pick.cardId)} · {pick.mult % 1 ? pick.mult.toFixed(1) : pick.mult}×
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MONTH = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** Twelve months as a strip: the month's total in the display face, a hairline bar, and the
 *  store it spent the most at. */
export function MonthStrip({ txns }: { txns: Txn[] }) {
  const months = useMemo(() => {
    const by = new Map<string, { total: number; stores: Map<string, number> }>();
    for (const t of txns) {
      const k = t.date.slice(0, 7);
      const e = by.get(k) ?? { total: 0, stores: new Map() };
      e.total += t.amount;
      e.stores.set(t.merchant, (e.stores.get(t.merchant) ?? 0) + t.amount);
      by.set(k, e);
    }
    const all = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // drop a partial first or last month (fewer than 10 days of data) so it doesn't read as a dip
    const days = (k: string) => new Set(txns.filter((t) => t.date.startsWith(k)).map((t) => t.date)).size;
    const kept = all.filter(([k], i) => !((i === 0 || i === all.length - 1) && days(k) < 10));
    // a month the data only partly covers is shown, marked, and left out of biggest/slowest
    const dates = txns.map((t) => t.date).sort();
    const firstDay = Number(dates[0]?.slice(8, 10) ?? 1);
    const lastDay = Number(dates[dates.length - 1]?.slice(8, 10) ?? 31);
    return kept.slice(-12).map(([k, e], i, arr) => ({
      k,
      total: e.total,
      top: [...e.stores.entries()].sort((a, b) => b[1] - a[1])[0][0],
      partial: (k === all[0][0] && firstDay > 3) || (i === arr.length - 1 && k === all[all.length - 1][0] && lastDay < 26),
    }));
  }, [txns]);
  const full = months.filter((m) => !m.partial);
  const max = Math.max(...months.map((m) => m.total), 1);
  const peak = full.reduce<(typeof months)[number] | undefined>((a, m) => (!a || m.total > a.total ? m : a), undefined);
  const low = full.reduce<(typeof months)[number] | undefined>((a, m) => (!a || m.total < a.total ? m : a), undefined);
  // spending that swings (seasonal or irregular income) is worth saying out loud
  const swing = peak && low && low.total > 0 ? peak.total / low.total : 1;

  return (
    <div className="m-panel overflow-x-auto p-5 md:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <p className="m-label">month by month · top store each month</p>
        {peak && (
          <p className="text-right text-sm text-ace-dim" style={hand}>
            biggest month: {MONTH(peak.k)}, {money(peak.total)}
            {swing >= 2.5 && low && (
              <span className="block" style={{ color: "var(--m-accent)" }}>
                slowest: {MONTH(low.k)}, {money(low.total)}. {swing.toFixed(1)}× apart
              </span>
            )}
          </p>
        )}
      </div>
      <div className="grid min-w-[640px] grid-cols-12 gap-2 lg:min-w-0">
        {months.map((m) => (
          <div key={m.k} className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end">
              <motion.div
                className="w-full rounded-t-[8px]"
                style={{
                  background:
                    m === peak ? "var(--m-ink)" : swing >= 2.5 && m === low ? "var(--m-accent)" : "color-mix(in oklab, var(--m-ink) 14%, var(--m-panel))",
                }}
                initial={{ height: 0 }}
                whileInView={{ height: `${(m.total / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <MerchantLogo name={m.top} size={26} />
            <div className="text-[15px]" style={display}>
              {money(m.total)}
            </div>
            <div className="m-label">
              {MONTH(m.k)}
              {m.partial ? <span title="the data covers only part of this month">*</span> : null}
            </div>
          </div>
        ))}
      </div>
      {months.some((m) => m.partial) && <p className="mt-3 text-xs">* only part of this month is in the year shown</p>}
    </div>
  );
}
