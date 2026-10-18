"use client";

import { useBrand } from "./brands";
import { Solver, jordanStrategies } from "./solver";
import { DropHero } from "./drop";
import { JORDAN, yearOf } from "@/lib/data/personas";
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ace-line bg-ace-bg/90">
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
  return (
    <>
      <DropHero />
      <SolverBand />
    </>
  );
}

/** Right under the cards: the same wallet, next year, simulated 1,000 times. */
function SolverBand() {
  const { brand: b } = useBrand();
  const txns = useMemo(() => yearOf(JORDAN), []);
  const strategies = useMemo(() => jordanStrategies(JORDAN.wallet, JORDAN.name), []);

  return (
    <section className="relative border-t border-ace-line bg-ace-panel py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.22em] text-ace-dim">
            <span className="text-ace-gold">{b.name}</span> · next year, played 1,000 times
          </p>
          <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-5xl">
            Same cards. Same spending.
            <span className="block text-ace-dim">A different year.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ace-dim">
            Each dot is one simulated year of {JORDAN.name}&apos;s spending, redrawn from his real months. Switch the strategy and watch the
            same thousand years move.
          </p>
          <ol className="mono mt-8 space-y-2 text-[12px] text-ace-dim">
            <li>
              <span className="text-ace-ink">01</span> as {JORDAN.name} plays today
            </li>
            <li>
              <span className="text-ace-ink">02</span> every purchase on the card {b.name} picks
            </li>
            <li>
              <span className="text-ace-ink">03</span> and the balance paid off first
            </li>
          </ol>
        </div>
        <Solver strategies={strategies} txns={txns} title={`monte solve --wallet ${JORDAN.name.toLowerCase()} --next-year --runs 1000`} />
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
