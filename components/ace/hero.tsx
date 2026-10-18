"use client";

import { useBrand } from "./brands";
import { Solver, jordanStrategies } from "./solver";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { receipt } from "@/lib/engine";
import { useMemo } from "react";

const STATS = [
  ["21.19%", "average credit card APR", "Fed G.19, Aug 2026"],
  ["45%", "of cardholders carried a balance last year", "Fed SHED, May 2026"],
  ["$160B", "paid in card interest in 2024", "CFPB, Dec 2025"],
  ["$31.3B", "paid in card fees in 2024", "CFPB, Dec 2025"],
  ["$1.263T", "of US credit card debt", "NY Fed, Q2 2026"],
  ["~$15B", "a year moved by rewards from less to more savvy cardholders", "Fed FEDS 2023-007"],
];

export function Nav() {
  const { brand: b } = useBrand();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ace-line/50 bg-ace-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2">
          <b.Mark size={28} />
          <span className="text-xl font-bold leading-none tracking-tight" style={{ fontFamily: "var(--brand-head)" }}>{b.wordmark}</span>
        </a>
        <nav className="mono hidden gap-6 text-[11px] uppercase tracking-[0.18em] text-ace-dim md:flex">
          <a href="#money" className="hover:text-ace-ink">Money</a>
          <a href="#receipt" className="hover:text-ace-ink">Receipt</a>
          <a href="#history" className="hover:text-ace-ink">Purchases</a>
          <a href="#tap" className="hover:text-ace-ink">Tap</a>
          <a href="#foryou" className="hover:text-ace-ink">Apply</a>
          <a href="#moat" className="hover:text-ace-ink">Why {b.name}</a>
        </nav>
        <a href="#money" className="rounded-md bg-ace-ink px-4 py-1.5 text-sm font-medium text-ace-bg transition hover:bg-ace-gold">
          Audit a wallet
        </a>
      </div>
    </header>
  );
}

export function Hero() {
  const { brand: b } = useBrand();
  const txns = useMemo(() => yearOf(JORDAN), []);
  const jr = useMemo(() => receipt(JORDAN.wallet, txns), [txns]);
  const strategies = useMemo(() => jordanStrategies(JORDAN.wallet, JORDAN.name), []);
  const lost = Math.round(-jr.net);

  return (
    <section id="top" className="relative pt-28 md:pt-36">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.05fr] lg:items-end">
        <div>
          <p className="mono mb-8 text-[11px] uppercase tracking-[0.22em] text-ace-dim">
            <span className="text-ace-gold">{b.name}</span> · a solver for your wallet
          </p>
          <h1 className="text-[12vw] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-6xl md:text-[4.6rem]">
            {JORDAN.name}&apos;s cards cost him{" "}
            <span className="tnum text-ace-loss">${lost.toLocaleString()}</span> last year.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-ace-dim">
            {b.name} reads a year of your purchases, plays each one on the right card, tells you which cards to keep, and
            simulates next year a thousand times before you change anything.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#receipt" className="rounded-md bg-ace-gold px-5 py-3 font-medium text-ace-on-accent transition hover:brightness-110">
              Read {JORDAN.name}&apos;s receipt
            </a>
            <a href="#tap" className="rounded-md border border-ace-line px-5 py-3 text-ace-ink transition hover:border-ace-ink/40">
              Try a tap
            </a>
          </div>
          <dl className="mono mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-ace-line pt-5 text-[11px] text-ace-dim">
            <div>
              <dt>rewards + perks</dt>
              <dd className="mt-1 text-base tnum text-ace-gain">+${Math.round(jr.rewards + jr.credits)}</dd>
            </div>
            <div>
              <dt>fees</dt>
              <dd className="mt-1 text-base tnum text-ace-loss">−${Math.round(jr.fees)}</dd>
            </div>
            <div>
              <dt>interest</dt>
              <dd className="mt-1 text-base tnum text-ace-loss">−${Math.round(jr.interest)}</dd>
            </div>
          </dl>
        </div>

        <Solver strategies={strategies} txns={txns} title={`monte solve --wallet ${JORDAN.name.toLowerCase()} --years 1000`} />
      </div>

      <div className="mx-auto mt-20 max-w-6xl px-5">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.22em] text-ace-dim">The house edge</p>
        <div className="grid grid-cols-2 border-l border-t border-ace-line md:grid-cols-3 lg:grid-cols-6">
          {STATS.map(([n, label, src]) => (
            <div key={n} className="border-b border-r border-ace-line p-4">
              <div className="text-2xl font-semibold tracking-tight tnum">{n}</div>
              <div className="mt-1 text-[13px] leading-snug text-ace-dim">{label}</div>
              <div className="mono mt-2 text-[10px] uppercase tracking-wider text-ace-dim/60">{src}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
