"use client";

// The hero's solver: 1,000 simulated next years for one wallet, drawn as a dot histogram.
// Every dot is one year. Switching strategy replays the same 1,000 years, so each dot moves
// to where that same year lands under the new play.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Holding, Txn } from "@/lib/engine";
import { draws, ledger, paths } from "./mc";
import { money } from "./store";
import { shortName } from "./card-art";

export type Strategy = { id: string; label: string; short: string; wallet: Holding[]; policy: "actual" | "best" };

const YEARS = 1000;

/** requestAnimationFrame, with a timer fallback for tabs or panes that never paint
 *  (background tabs, some projector setups), so the chart always ends up drawn. */
function nextFrame(cb: (now: number) => void): () => void {
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    cb(performance.now());
  };
  const a = requestAnimationFrame(run);
  const b = window.setTimeout(run, 50);
  return () => {
    cancelAnimationFrame(a);
    clearTimeout(b);
  };
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function useSolver(strategies: Strategy[], txns: Txn[], seed = 42) {
  return useMemo(() => {
    const ds = draws(YEARS, seed);
    return strategies.map((s) => {
      const finals = paths(ledger(s.wallet, txns, s.policy), ds).map((p) => p[11]);
      const sorted = [...finals].sort((a, b) => a - b);
      return { ...s, finals, p5: sorted[50], p50: sorted[500], p95: sorted[949] };
    });
  }, [strategies, txns, seed]);
}

export function Solver({ strategies, txns, title }: { strategies: Strategy[]; txns: Txn[]; title: string }) {
  const runs = useSolver(strategies, txns);
  const [k, setK] = useState(0);
  const [shown, setShown] = useState(YEARS);
  const [hover, setHover] = useState<{ lo: number; hi: number; n: number; x: number; w: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const state = useRef<{ from: Float32Array | null; to: Float32Array | null; t0: number; cancel: () => void; size: number }>({
    from: null,
    to: null,
    t0: 0,
    cancel: () => {},
    size: 4,
  });

  // shared x domain and bins across strategies, so moving between them is a real shift
  const geo = useMemo(() => {
    const all = runs.flatMap((r) => r.finals).sort((a, b) => a - b);
    let lo = all[Math.floor(all.length * 0.005)];
    let hi = all[Math.ceil(all.length * 0.995) - 1];
    const pad = (hi - lo) * 0.06 + 10;
    lo -= pad;
    hi += pad;
    const step = niceStep((hi - lo) / 46);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const nb = Math.round((hi - lo) / step);
    const counts = runs.map((r) => {
      const c = new Array(nb).fill(0);
      for (const v of r.finals) c[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / step)))]++;
      return c;
    });
    const maxCount = Math.max(...counts.flat());
    return { lo, hi, step, nb, counts, maxCount };
  }, [runs]);

  // target positions (unit square: x 0..1, y = stack slot) for strategy k
  const target = (idx: number) => {
    const r = runs[idx];
    const slot = new Array(geo.nb).fill(0);
    const out = new Float32Array(YEARS * 2);
    r.finals.forEach((v, i) => {
      const b = Math.min(geo.nb - 1, Math.max(0, Math.floor((v - geo.lo) / geo.step)));
      out[i * 2] = (b + 0.5) / geo.nb;
      out[i * 2 + 1] = slot[b]++;
    });
    return out;
  };

  // draw loop
  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const st = state.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = target(k);
    st.from = st.to ?? null;
    st.to = next;
    st.t0 = performance.now();
    const firstRun = !st.from;

    const colors = {
      dot: k === 0 ? cssVar("--ace-loss", "#ff5c7a") : cssVar("--ace-gain", "#2ee6a8"),
      ink: cssVar("--ace-ink", "#eef2ff"),
      dim: cssVar("--ace-dim", "rgba(238,242,255,.58)"),
      line: cssVar("--ace-line", "rgba(255,255,255,.12)"),
    };

    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const W = w.clientWidth;
      const H = w.clientHeight;
      if (c.width !== Math.round(W * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const base = H - 22;
      const colW = W / geo.nb;
      // largest square dot such that the tallest bin still fits, packing k dots per row
      let size = 2;
      let per = 1;
      for (let d = 9; d >= 2; d -= 0.5) {
        const k = Math.max(1, Math.floor((colW - 1) / d));
        if (Math.ceil(geo.maxCount / k) * d <= base - 14) {
          size = d;
          per = k;
          break;
        }
      }
      st.size = size;
      const place = (bx: number, slot: number) => {
        const sub = slot % per;
        const row = Math.floor(slot / per);
        const left = bx * W - (per * size) / 2;
        return [left + (sub + 0.5) * size, base - (row + 0.5) * size] as const;
      };

      // zero line
      const x0 = ((0 - geo.lo) / (geo.hi - geo.lo)) * W;
      if (x0 > 0 && x0 < W) {
        ctx.strokeStyle = colors.dim;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(x0, 6);
        ctx.lineTo(x0, base);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.dim;
        ctx.font = "10px var(--font-geist-mono), ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("$0", x0, H - 6);
      }
      // axis
      ctx.strokeStyle = colors.line;
      ctx.beginPath();
      ctx.moveTo(0, base + 0.5);
      ctx.lineTo(W, base + 0.5);
      ctx.stroke();
      ctx.fillStyle = colors.dim;
      ctx.font = "10px var(--font-geist-mono), ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(money(geo.lo), 0, H - 6);
      ctx.textAlign = "right";
      ctx.fillText(money(geo.hi), W, H - 6);

      const T = reduce ? 1 : 900;
      let done = true;
      let visible = 0;
      ctx.fillStyle = colors.dot;
      for (let i = 0; i < YEARS; i++) {
        const delay = firstRun ? i * 1.4 : (i % 97) * 3;
        const t = Math.min(1, Math.max(0, (now - st.t0 - delay) / T));
        if (t < 1) done = false;
        if (firstRun && t <= 0) continue;
        visible++;
        const e = 1 - Math.pow(1 - t, 3);
        const [tx, ty] = place(st.to![i * 2], st.to![i * 2 + 1]);
        let x: number;
        let y: number;
        if (st.from) {
          const [fx, fy] = place(st.from[i * 2], st.from[i * 2 + 1]);
          x = fx + (tx - fx) * e;
          y = fy + (ty - fy) * e - Math.sin(Math.PI * e) * 40 * (Math.abs(tx - fx) / W);
        } else {
          x = tx;
          y = -10 + (ty + 10) * e;
        }
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - size * 0.4, y - size * 0.4, size * 0.8, size * 0.8);
      }
      ctx.globalAlpha = 1;

      // median marker
      const r = runs[k];
      const xm = ((r.p50 - geo.lo) / (geo.hi - geo.lo)) * W;
      ctx.strokeStyle = colors.ink;
      ctx.beginPath();
      ctx.moveTo(xm, 4);
      ctx.lineTo(xm, base);
      ctx.stroke();

      setShown((s) => (s === visible ? s : visible));
      if (!done) st.cancel = nextFrame(frame);
    };
    st.cancel();
    st.cancel = nextFrame(frame);
    const ro = new ResizeObserver(() => {
      st.cancel();
      st.cancel = nextFrame(frame);
    });
    ro.observe(w);
    return () => {
      st.cancel();
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, geo, runs]);

  const r = runs[k];
  const beats = k === 0 ? null : r.finals.filter((v, i) => v > runs[0].finals[i] + 0.5).length / YEARS;
  const gain = r.p50 - runs[0].p50;

  return (
    <div className="overflow-hidden rounded-xl border border-ace-line bg-ace-panel/80 shadow-[0_30px_80px_-30px_rgba(0,0,0,.7)]">
      <div className="mono flex items-center justify-between gap-3 border-b border-ace-line px-4 py-2.5 text-[11px] text-ace-dim">
        <span className="truncate">
          <span className="text-ace-gold">$</span> {title}
        </span>
        <span className="shrink-0 tnum">
          {shown.toLocaleString()} / {YEARS.toLocaleString()} years · seed 42
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-ace-line px-4 py-3" role="tablist" aria-label="Strategy">
        {runs.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === k}
            onClick={() => setK(i)}
            className={`mono rounded-md border px-2.5 py-1 text-[11px] transition ${
              i === k ? "border-ace-ink bg-ace-ink text-ace-bg" : "border-ace-line text-ace-dim hover:border-ace-ink/40 hover:text-ace-ink"
            }`}
          >
            <span className="opacity-60">{String(i + 1).padStart(2, "0")}</span> {s.short}
          </button>
        ))}
      </div>

      <div
        ref={wrap}
        className="relative h-[230px] px-4 pt-3 md:h-[260px]"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fx = (e.clientX - rect.left) / rect.width;
          const b = Math.min(geo.nb - 1, Math.max(0, Math.floor(fx * geo.nb)));
          const n = geo.counts[k][b];
          setHover(n ? { lo: geo.lo + b * geo.step, hi: geo.lo + (b + 1) * geo.step, n, x: e.clientX - rect.left, w: rect.width } : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`${YEARS} simulated years. ${r.label}: median ${money(r.p50)}, 90% of years between ${money(r.p5)} and ${money(r.p95)}.`}
        />
        {hover && (
          <div
            className="mono pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-ace-line bg-ace-bg/95 px-2 py-1 text-[10px] text-ace-ink"
            style={{ left: Math.max(70, Math.min(hover.x, hover.w - 70)) }}
          >
            {hover.n} years net {money(hover.lo)} to {money(hover.hi)}
          </div>
        )}
      </div>

      <dl className="mono grid grid-cols-3 border-t border-ace-line text-[11px]">
        <div className="border-r border-ace-line px-4 py-3">
          <dt className="text-ace-dim">median year</dt>
          <dd className={`mt-0.5 text-base tnum ${r.p50 < 0 ? "text-ace-loss" : "text-ace-gain"}`}>{money(r.p50, { sign: true })}</dd>
        </div>
        <div className="border-r border-ace-line px-4 py-3">
          <dt className="text-ace-dim">90% of years</dt>
          <dd className="mt-0.5 text-base tnum text-ace-ink">
            {money(r.p5)} … {money(r.p95)}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-ace-dim">{k === 0 ? "baseline" : `vs ${runs[0].short}`}</dt>
          <dd className="mt-0.5 text-base tnum text-ace-ink">
            {beats === null ? "—" : `${money(gain, { sign: true })} · ${Math.round(beats * 100)}%`}
          </dd>
        </div>
      </dl>
      <p className="border-t border-ace-line px-4 py-2.5 text-[12px] leading-relaxed text-ace-dim">{r.label}</p>
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p;
}

export function jordanStrategies(wallet: Holding[], name: string): Strategy[] {
  const carried = wallet.filter((h) => h.balance && h.balance > 0);
  const cleared = wallet.map((h) => ({ ...h, balance: 0 }));
  const out: Strategy[] = [
    { id: "habit", short: `${name}'s habits`, label: `Every purchase on the card ${name} actually reached for.`, wallet, policy: "actual" },
    {
      id: "routed",
      short: "Monte's routing",
      label: `Same cards, same spending: each purchase on the card Monte picks, caps respected${carried.length ? ", never the card carrying a balance" : ""}.`,
      wallet,
      policy: "best",
    },
  ];
  if (carried.length)
    out.push({
      id: "cleared",
      short: `+ clear the ${shortName(carried[0].cardId)}`,
      label: `Monte's routing, and the ${shortName(carried[0].cardId)} balance already paid off: no interest. (Paying it off takes cash or months; see "Pay this first" below.)`,
      wallet: cleared,
      policy: "best",
    });
  return out;
}
