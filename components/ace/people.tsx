"use client";

// Who Monte is for, as the people on this page: five kinds of wallet, one tap to switch every
// section to that person's year. Opens chapter 01, so the framing comes before any number.

import { PERSONAS, yearOf } from "@/lib/data/personas";
import { receipt, setValuation } from "@/lib/engine";
import { PERSONA_LINE, PersonaAvatar } from "./persona-avatar";
import { money, useAce } from "./store";

const SITUATION: Record<string, string> = {
  jordan: "three cards, a balance",
  maya: "travels for points",
  parks: "two cards, one with a balance",
  sam: "one student card",
  rosa: "income that swings, a balance",
};

// each person's year, net, at their own point value (Maya travel, everyone else cash): computed
// once, and the engine's setting put back to what the page is using
let NETS: Record<string, number> | null = null;
function nets(current: "cash" | "travel") {
  if (!NETS) {
    NETS = {};
    for (const p of PERSONAS) {
      setValuation(p.id === "maya" ? "travel" : "cash");
      NETS[p.id] = receipt(p.wallet, yearOf(p)).net;
    }
    setValuation(current);
  }
  return NETS;
}

/** Five people, five kinds of wallet. A tap switches every section to that person's year. */
export function People() {
  const { persona, setPersona, valuation, r } = useAce();
  const net = nets(valuation);
  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="radiogroup"
        aria-label="Whose year"
      >
        <span className="m-label mr-1">whose year</span>
        {PERSONAS.map((p) => {
          const on = persona.id === p.id;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={on}
              onClick={() => setPersona(p.id)}
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-left text-[13px] transition ${
                on
                  ? "bg-ace-ink text-ace-bg"
                  : "bg-ace-panel text-ace-ink shadow-[0_0_0_1px_var(--m-line-strong)] hover:shadow-[0_0_0_1px_var(--m-ink)]"
              }`}
            >
              <PersonaAvatar id={p.id} size={26} />
              <span className="font-medium">{p.name}</span>
              <span>· {SITUATION[p.id] ?? p.blurb} ·</span>
              <span className={`m-num ${on ? "" : net[p.id] < 0 ? "text-ace-loss" : "text-ace-gain"}`}>{money(on ? r.net : net[p.id], { sign: true })}</span>
              <span>net last year</span>
            </button>
          );
        })}
      </div>
      {PERSONA_LINE[persona.id] && (
        <p className="m-note mt-3 text-[15px]">
          &ldquo;{PERSONA_LINE[persona.id]}&rdquo;
        </p>
      )}
    </div>
  );
}
