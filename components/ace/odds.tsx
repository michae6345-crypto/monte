"use client";

// Monte Carlo odds on the page: a hook that runs the simulation for the current wallet, and
// a fan chart of cumulative net over the next 12 months, your wallet against one option.

import { motion } from "framer-motion";
import { useMemo, useState, useSyncExternalStore } from "react";
import { monteCarlo, type MonteCarloResult, type Outcome } from "./mc";
import { money, useAce } from "./store";
import type { Holding, Txn } from "@/lib/engine";

// One run per wallet state, shared by every section that shows odds.
let last: { wallet: unknown; txns: unknown; valuation: string; drift: number; out: MonteCarloResult } | null = null;
function cachedRun(wallet: Holding[], txns: Txn[], valuation: string, drift: number): MonteCarloResult {
  if (last && last.wallet === wallet && last.txns === txns && last.valuation === valuation && last.drift === drift) return last.out;
  const out = monteCarlo(wallet, txns, { years: 1000, seed: 42, driftSd: drift });
  last = { wallet, txns, valuation, drift, out };
  return out;
}

// Spending drift between years is a stated choice, shared by every chart that simulates.
const driftSubs = new Set<() => void>();
let DRIFT = 0;
export const DRIFT_ON = 0.3;
export function setDrift(v: number) {
  DRIFT = v;
  driftSubs.forEach((f) => f());
}
const subscribeDrift = (f: () => void) => {
  driftSubs.add(f);
  return () => driftSubs.delete(f);
};
export function useDrift() {
  return useSyncExternalStore(subscribeDrift, () => DRIFT, () => 0);
}

export function DriftToggle() {
  const d = useDrift();
  return (
    <div className="mono inline-flex items-center gap-1 rounded-md border border-ace-line bg-ace-panel p-0.5 text-[11px]" role="radiogroup" aria-label="Spending drift">
      <span className="px-1.5 text-ace-dim">spending drift</span>
      {[0, DRIFT_ON].map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={d === v}
          onClick={() => setDrift(v)}
          className={`rounded px-2 py-0.5 transition ${d === v ? "bg-ace-ink text-ace-bg" : "text-ace-dim hover:text-ace-ink"}`}
          title={v ? "Each category drifts up or down by a log-normal factor (sd 0.3) each simulated year" : "Each simulated year redraws your real months, nothing else"}
        >
          {v ? "±30%" : "off"}
        </button>
      ))}
    </div>
  );
}

export function useMonteCarlo(): MonteCarloResult {
  const { wallet, txns, valuation } = useAce();
  const drift = useDrift();
  return useMemo(() => cachedRun(wallet, txns, valuation, drift), [wallet, txns, valuation, drift]);
}

/** "+$57/yr · ahead in all 1,000 years": dollars first, then how often. */
export function oddsLine(o: Outcome, base: Outcome, years: number) {
  const d = o.p50 - base.p50;
  const n = Math.round(o.winShare * years);
  const how = n >= years ? `ahead in all ${years.toLocaleString()} simulated years` : n === 0 ? `behind in every simulated year` : `ahead in ${n.toLocaleString()} of ${years.toLocaleString()} simulated years`;
  return `${money(d, { sign: true })}/yr median · ${how}`;
}

export const winLine = (o: Outcome) => o.label.replace(/^Add /, "");

const W = 640;
const H = 280;
const P = { l: 52, r: 16, t: 14, b: 26 };
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

export function FanChart({ mc, pick, kind = "add" }: { mc: MonteCarloResult; pick?: string; kind?: "add" | "drop" }) {
  const adds = mc.options.filter((o) => o.id.startsWith(`${kind}:`));
  const [sel, setSel] = useState<string | null>(null);
  const o = adds.find((x) => x.id === (sel ?? pick)) ?? adds[0];

  const { y, ticks } = (() => {
    const all = [mc.current, o].filter(Boolean).flatMap((x) => x!.bands.flatMap((b) => [b.p5, b.p95]));
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const step = nice((hi - lo) / 5);
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    return { y, ticks };
  })();

  if (!o) return <p className="mono text-[12px] text-ace-dim">No {kind === "add" ? "card to add" : "card worth cancelling"} for this wallet.</p>;
  const x = (m: number) => P.l + ((m - 0.5) / 12) * (W - P.l - P.r);
  const area = (out: Outcome, a: "p5" | "p25", b: "p95" | "p75") =>
    [
      `M${x(0.5)},${y(0)}`,
      ...out.bands.map((bd) => `L${x(bd.month)},${y(bd[b])}`),
      ...[...out.bands].reverse().map((bd) => `L${x(bd.month)},${y(bd[a])}`),
      `L${x(0.5)},${y(0)}Z`,
    ].join(" ");
  const edge = (out: Outcome, k: "p5" | "p50" | "p95") => [`M${x(0.5)},${y(0)}`, ...out.bands.map((bd) => `L${x(bd.month)},${y(bd[k])}`)].join(" ");
  const line = (out: Outcome) => edge(out, "p50");

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {adds.slice(0, 5).map((a) => (
          <button
            key={a.id}
            onClick={() => setSel(a.id)}
            className={`mono rounded-md border px-2.5 py-1 text-[11px] transition ${
              a.id === o.id ? "border-ace-gold bg-ace-gold/10 text-ace-ink" : "border-ace-line text-ace-dim hover:text-ace-ink"
            }`}
          >
            {a.label.replace(/^Add /, "+ ").replace(/^Cancel /, "− ").replace(/ Card| from American Express| Visa Signature/g, "")}
            <span className="ml-1.5 opacity-70">{money(a.p50 - mc.current.p50, { sign: true })}</span>
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${winLine(o)}: ${oddsLine(o, mc.current, mc.years)}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--ace-line)" strokeDasharray={t === 0 ? undefined : "2 5"} />
            <text x={P.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} className="mono" style={{ fill: "var(--ace-dim)" }}>
              {money(t)}
            </text>
          </g>
        ))}
        {MONTHS.map((m, i) =>
          i % 2 === 0 ? (
            <text key={m} x={x(i + 1)} y={H - 8} textAnchor="middle" fontSize={10} className="mono" style={{ fill: "var(--ace-dim)" }}>
              {m}
            </text>
          ) : null,
        )}
        <motion.path key={o.id + "a"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} d={area(o, "p5", "p95")} style={{ fill: "color-mix(in oklab, var(--ace-gold) 12%, transparent)" }} />
        <motion.path key={o.id + "b"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} d={area(o, "p25", "p75")} style={{ fill: "color-mix(in oklab, var(--ace-gold) 22%, transparent)" }} />
        <path d={edge(mc.current, "p5")} fill="none" strokeWidth={1} strokeDasharray="1 3" style={{ stroke: "var(--ace-dim)" }} />
        <path d={edge(mc.current, "p95")} fill="none" strokeWidth={1} strokeDasharray="1 3" style={{ stroke: "var(--ace-dim)" }} />
        <path d={line(mc.current)} fill="none" strokeWidth={1.5} strokeDasharray="5 4" style={{ stroke: "var(--ace-ink)" }} />
        <motion.path
          key={o.id}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          d={line(o)}
          fill="none"
          strokeWidth={2}
          style={{ stroke: "var(--ace-gold)" }}
        />
        <text x={x(12) - 4} y={y(o.bands[11].p50) - 8} textAnchor="end" fontSize={11} className="mono" style={{ fill: "var(--ace-gold)" }}>
          {money(o.bands[11].p50)}
        </text>
        <text x={x(12) - 4} y={y(mc.current.bands[11].p50) + 16} textAnchor="end" fontSize={11} className="mono" style={{ fill: "var(--ace-dim)" }}>
          {money(mc.current.bands[11].p50)} now
        </text>
      </svg>
      <div className="mono mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-ace-dim">
        <span>
          <span className="text-ace-gold">{winLine(o)}</span> · {oddsLine(o, mc.current, mc.years)}
        </span>
        <span>
          bands: middle 50% and 90% of {mc.years.toLocaleString()} years · seed {mc.seed}
        </span>
      </div>
    </div>
  );
}

function nice(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p;
}
