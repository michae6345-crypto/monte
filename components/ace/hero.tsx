"use client";

import { useBrand } from "./brands";
import { Solver, jordanStrategies } from "./solver";
import { DropHero } from "./drop";
import { Stage, StageSteps } from "./stage";
import { shortName } from "./card-art";
import { Lockup } from "@/components/brand";
import { PERSONAS } from "@/lib/data/personas";
import { useAce } from "./store";
import { useMemo } from "react";


export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ace-line bg-ace-bg/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="group flex items-center" aria-label="Monte, back to top">
          <Lockup size={20} />
        </a>
        <nav className="m-label hidden gap-5 lg:flex">
          <a href="#see" className="hover:underline">See it</a>
          <a href="#leaks" className="hover:underline">Leaks</a>
          <a href="#spend" className="hover:underline">Spend</a>
          <a href="#plan" className="hover:underline">Plan</a>
          <a href="#next" className="hover:underline">Next year</a>
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
  const { wallet, txns, persona } = useAce();
  const name = persona.id === "you" ? "You" : persona.name;
  const they = persona.id === "you" ? "you" : persona.id === "parks" ? "they" : persona.id === "maya" || persona.id === "rosa" ? "she" : "he";
  const strategies = useMemo(() => jordanStrategies(wallet, name), [wallet, name]);
  const carried = wallet.find((h) => (h.balance ?? 0) > 0);
  const words = [
    { h: `As ${they} ${they === "you" || they === "they" ? "play" : "plays"} today.`, d: `Every purchase on the card ${name === "You" ? "you" : name} actually reached for.${carried ? " The balance charges interest all year." : ""}` },
    { h: `Every purchase on ${b.name}'s pick.`, d: `Same cards, same spending, each purchase routed to the card that pays most${carried ? ", never the one with a balance" : ""}.` },
    ...(carried
      ? [{ h: "And the balance paid off.", d: `The same routing once the ${shortName(carried.cardId)} is clear: no interest, and it can earn again.` }]
      : []),
  ];
  const n = words.length;

  return (
    <section id="next" className="relative scroll-mt-16 border-y border-ace-line bg-ace-panel">
      <Stage vh={240}>
        {(p) => {
          const step = Math.min(n - 1, Math.floor(p * n * 0.999));
          return (
            <div className="mx-auto w-full max-w-6xl px-5 py-6">
              <div className="mb-5">
                <StageSteps steps={["today", `${b.name}'s routing`, ...(carried ? ["paid off"] : [])]} p={p} />
              </div>
              <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <p className="m-label mb-6">§05 · next year ×1000</p>
                  <h2 className="text-4xl md:text-[3.2rem]">
                    Same cards. Same spending.
                    <span className="m-second block">A thousand next years.</span>
                  </h2>
                  <div className="mt-6 min-h-[6rem]">
                    <p className="text-2xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.02em" }}>
                      <span className="m-num mr-3 text-base">{String(step + 1).padStart(2, "0")}</span>
                      {words[step].h}
                    </p>
                    <p className="mt-2 max-w-md text-lg leading-relaxed text-ace-dim">{words[step].d}</p>
                  </div>
                </div>
                <Solver strategies={strategies} txns={txns} step={step} title={`monte solve --wallet ${name.toLowerCase().replace(/^the /, "")} --next-year --runs 1000`} />
              </div>
            </div>
          );
        }}
      </Stage>
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
