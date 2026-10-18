"use client";

import type { ReactNode } from "react";
import { Chapter } from "./chapter";
import { useAce } from "./store";

type S = Record<
  "money" | "wrapped" | "receipt" | "replay" | "history" | "odd" | "tap" | "card" | "payoff" | "keep" | "apply" | "next" | "how" | "real" | "moat",
  ReactNode
>;

/** The page after the hero: seven chapters, each a headline and its views as tabs. */
export function Chapters({ sections: s }: { sections: S }) {
  const { persona } = useAce();
  const who = persona.id === "you" ? "You" : persona.name;
  return (
    <>
      <Chapter
        id="money"
        index="01"
        kicker="Your year"
        title={
          <>
            Where the money went.
            <span className="m-second block">Every store, every month.</span>
          </>
        }
        tabs={[
          { key: "stores", label: "Stores", node: s.money },
          { key: "wrapped", label: "Wrapped", node: s.wrapped },
        ]}
      />
      {s.receipt}
      <Chapter
        id="misses"
        index="03"
        kicker="The misses"
        title={
          <>
            Where the wrong card
            <span className="m-second block">cost {who === "You" ? "you" : who} money.</span>
          </>
        }
        tabs={[
          { key: "replay", label: "Replay", node: s.replay },
          { key: "purchases", label: "Every purchase", node: s.history },
          { key: "odd", label: "Odd charges", node: s.odd },
        ]}
      />
      <Chapter
        id="register"
        index="04"
        kicker="At the register"
        title={
          <>
            The right card,
            <span className="m-second block">at the moment you pay.</span>
          </>
        }
        tabs={[
          { key: "tap", label: "Tap", node: s.tap },
          { key: "card", label: "The Monte Card", node: s.card },
        ]}
      />
      <Chapter
        id="plan"
        index="05"
        kicker="The plan"
        title={
          <>
            What to do about it.
            <span className="m-second block">In the order that saves the most.</span>
          </>
        }
        tabs={[
          { key: "payoff", label: "Pay this first", node: s.payoff },
          { key: "keep", label: "Keep or cancel", node: s.keep },
          { key: "apply", label: "What to apply for", node: s.apply },
        ]}
      />
      {s.next}
      <Chapter
        id="how"
        index="07"
        kicker="How it works"
        title={
          <>
            Every number is arithmetic
            <span className="m-second block">on the issuers&apos; published terms.</span>
          </>
        }
        tabs={[
          { key: "trace", label: "Trace a purchase", node: s.how },
          { key: "real", label: "Real vs simulated", node: s.real },
          { key: "moat", label: "Monte vs the rest", node: s.moat },
        ]}
      />
    </>
  );
}
