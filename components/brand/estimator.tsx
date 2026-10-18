"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Expect } from "./brackets";
import { HandNote } from "./note";

// The brand's signature moment: samples land one batch at a time, the histogram fills, the
// running mean settles, and when the last sample is in the closing bracket turns blue.
// The samples here are illustrative (a normal around a given mean and spread). For a real
// answer, pass `samples` from the engine's Monte Carlo instead and the board draws those.

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normals(n: number, mean: number, sd: number, seed: number) {
  const r = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(r(), 1e-9);
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    out.push(mean + sd * m * Math.cos(2 * Math.PI * v), mean + sd * m * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}

const usd = (v: number) => `${v < 0 ? "−" : "+"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

export function Estimator({
  of = "net",
  mean = 104,
  sd = 38,
  n = 1000,
  samples,
  seed = 7,
  batch = 9,
  tickMs = 40,
  bins = 24,
  note,
  className,
}: {
  of?: string;
  mean?: number;
  sd?: number;
  n?: number;
  /** Real draws from the engine. When given, mean/sd/n/seed are ignored. */
  samples?: number[];
  seed?: number;
  batch?: number;
  tickMs?: number;
  bins?: number;
  /** A hand note beside the result, e.g. "after interest on the Apple Card". */
  note?: string;
  className?: string;
}) {
  const [roll, setRoll] = useState(seed);
  const draws = useMemo(() => samples ?? normals(n, mean, sd, roll), [samples, n, mean, sd, roll]);
  const total = draws.length;
  const [k, setK] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    // Reduced motion: everything lands on the first tick.
    const step = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? total : batch;
    const id = window.setInterval(() => {
      setK((c) => {
        const next = Math.min(total, c + step);
        if (next >= total) window.clearInterval(id);
        return next;
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [seen, draws, total, batch, tickMs]);

  const lo = useMemo(() => Math.min(...draws), [draws]);
  const hi = useMemo(() => Math.max(...draws), [draws]);
  const shown = draws.slice(0, k);
  const counts = new Array(bins).fill(0);
  for (const x of shown) counts[Math.min(bins - 1, Math.floor(((x - lo) / (hi - lo || 1)) * bins))]++;
  const peak = Math.max(1, ...counts);
  const runMean = shown.length ? shown.reduce((a, b) => a + b, 0) / shown.length : 0;
  const done = k >= total;

  // running-mean path, sampled every few draws, scaled to its own wobble around the final mean
  const path = useMemo(() => {
    const step = Math.max(1, Math.floor(total / 120));
    const ms: [number, number][] = [];
    let s = 0;
    for (let i = 0; i < total; i++) {
      s += draws[i];
      if (i % step === 0 || i === total - 1) ms.push([i, s / (i + 1)]);
    }
    const final = ms[ms.length - 1]?.[1] ?? 0;
    const range = Math.max(1e-9, ...ms.filter(([i]) => i >= 10).map(([, m]) => Math.abs(m - final)));
    return ms.map(([i, m]) => {
      const x = (i / Math.max(1, total - 1)) * 100;
      const y = 50 - ((m - final) / range) * 45;
      return `${x.toFixed(2)},${Math.max(1, Math.min(99, y)).toFixed(2)}`;
    });
  }, [draws, total]);
  const pathShown = path.slice(0, Math.max(1, Math.round((k / total) * path.length))).join(" ");
  const meanX = ((runMean - lo) / (hi - lo || 1)) * 100;

  return (
    <div ref={box} className={cn("m-panel flex flex-col gap-5 p-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Expect of={of} state={done ? "resolved" : "computing"} tone={done ? (runMean >= 0 ? "gain" : "loss") : undefined} className="whitespace-nowrap text-3xl">
          {usd(runMean)}
        </Expect>
        <span className="m-num whitespace-nowrap text-xs" style={{ color: "var(--m-slate)" }}>
          {k.toLocaleString("en-US")} of {total.toLocaleString("en-US")} years
        </span>
      </div>

      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" aria-hidden>
        {counts.map((c, i) => {
          const w = 100 / bins;
          const h = (c / peak) * 38;
          return <rect key={i} x={i * w + 0.3} y={40 - h} width={w - 0.6} height={h} fill={done ? "var(--m-ink)" : "var(--m-mute)"} style={{ transition: "fill .4s" }} />;
        })}
        {shown.length > 0 && <line x1={meanX} x2={meanX} y1={0} y2={40} stroke={done ? "var(--m-accent)" : "var(--m-slate)"} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>

      <div>
        <div className="m-label mb-2">running average</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
          <line x1={0} x2={100} y1={50} y2={50} stroke="var(--m-line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <polyline points={pathShown} fill="none" stroke="var(--m-ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="flex items-center justify-between gap-4">
        {note ? <HandNote dir="up-left">{note}</HandNote> : <span />}
        <button
          type="button"
          onClick={() => {
            setK(0);
            setRoll((s) => ((s * 1103515245 + 12345) >>> 8) || 1);
          }}
          disabled={!done}
          className="m-mono rounded-full px-4 py-2 text-xs disabled:opacity-40"
          style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}
        >
          [ run again ]
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {done ? `Typical ${of}: ${usd(runMean)}, averaged over ${total.toLocaleString("en-US")} simulated years.` : ""}
      </p>
    </div>
  );
}
