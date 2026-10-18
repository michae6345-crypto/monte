"use client";

import { useBrand } from "./brands";
import { Solver, jordanStrategies } from "./solver";
import { DropHero } from "./drop";
import { Lockup } from "@/components/brand";
import { PERSONAS } from "@/lib/data/personas";
import { useAce } from "./store";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { useMemo } from "react";


export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ace-line bg-ace-bg/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="group flex items-center" aria-label="Monte, back to top">
          <Lockup size={20} />
        </a>
        <nav className="m-label hidden gap-6 md:flex">
          <a href="#money" className="hover:underline">Your year</a>
          <a href="#receipt" className="hover:underline">Receipt</a>
          <a href="#misses" className="hover:underline">Misses</a>
          <a href="#register" className="hover:underline">Register</a>
          <a href="#plan" className="hover:underline">Plan</a>
          <a href="#how" className="hover:underline">How</a>
        </nav>
        <HandPicker />
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <>
      <DropHero />
    </>
  );
}

/** Right under the cards: the same wallet, next year, simulated 1,000 times. */
export function NextYear() {
  const { brand: b } = useBrand();
  const txns = useMemo(() => yearOf(JORDAN), []);
  const strategies = useMemo(() => jordanStrategies(JORDAN.wallet, JORDAN.name), []);

  return (
    <section id="next" className="relative scroll-mt-16 border-y border-ace-line bg-ace-panel py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.22em] text-ace-dim">
            <span className="text-ace-ink">{b.name}</span> · next year, played 1,000 times
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

    </section>
  );
}

/** One switch for the whole page: whose year every section is showing. */
function HandPicker() {
  const { persona, setPersona } = useAce();
  return (
    <div className="mono flex items-center gap-1 rounded-md border border-ace-line bg-ace-panel p-0.5 text-[11px]" role="radiogroup" aria-label="Whose year">
      <span className="hidden px-1.5 text-ace-dim lg:inline">year of</span>
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={persona.id === p.id}
          onClick={() => setPersona(p.id)}
          className={`rounded px-2 py-1 transition ${persona.id === p.id ? "bg-ace-ink text-ace-bg" : "text-ace-dim hover:text-ace-ink"}`}
        >
          {p.name.replace("The ", "")}
        </button>
      ))}
      {persona.id === "you" && <span className="rounded bg-ace-ink px-2 py-1 text-ace-bg">You</span>}
    </div>
  );
}
