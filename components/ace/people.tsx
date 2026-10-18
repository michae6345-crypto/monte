"use client";

// Who Monte is for, as the people on this page: five kinds of wallet, one tap to switch every
// section to that person's year. Opens chapter 01, so the framing comes before any number.

import { PERSONAS } from "@/lib/data/personas";
import { PersonaAvatar } from "./persona-avatar";
import { useAce } from "./store";

const SITUATION: Record<string, string> = {
  jordan: "three cards, a balance",
  maya: "travels for points",
  parks: "family of four",
  sam: "one student card",
  rosa: "income that swings",
};

/** Five people, five kinds of wallet. A tap switches every section to that person's year. */
export function People() {
  const { persona, setPersona } = useAce();
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Whose year"
    >
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
            <span>· {SITUATION[p.id] ?? p.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
