"use client";

import type { ReactNode } from "react";
import { Chapter } from "./chapter";

type S = Record<
  "money" | "wrapped" | "receipt" | "replay" | "history" | "odd" | "tap" | "card" | "payoff" | "keep" | "apply" | "next" | "how" | "real" | "moat" | "chart",
  ReactNode
>;

/** The page after the hero, in the order of the pitch: the problem, the misses, the moment
 *  at the register, the plan, next year, and how it works. Views live as tabs. */
export function Chapters({ sections: s }: { sections: S }) {
  return (
    <>
      <Chapter
        id="receipt"
        index="01"
        kicker="The problem"
        title={
          <>
            What three cards
            <span className="m-second block">really cost in a year.</span>
          </>
        }
        tabs={[
          { key: "receipt", label: "The receipt", node: s.receipt },
          { key: "stores", label: "Where it went", node: s.money },
          { key: "wrapped", label: "Wrapped", node: s.wrapped },
        ]}
      />
      <Chapter
        id="misses"
        index="02"
        kicker="The misses"
        title={<>The wrong card, purchase by purchase.</>}
        tabs={[
          { key: "replay", label: "Replay", node: s.replay },
          { key: "purchases", label: "Every purchase", node: s.history },
          { key: "odd", label: "Odd charges", node: s.odd },
        ]}
      />
      <Chapter
        id="register"
        index="03"
        kicker="At the register"
        title={<>At the register.</>}
        tabs={[
          { key: "tap", label: "Tap", node: s.tap },
          { key: "card", label: "The Monte Card", node: s.card },
        ]}
      />
      <Chapter
        id="plan"
        index="04"
        kicker="The plan"
        title={
          <>
            What to do about it,
            <span className="m-second block">in the order that saves the most.</span>
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
        index="06"
        kicker="How it works"
        title={
          <>
            Open the engine.
            <span className="m-second block">Nothing here is a model&apos;s guess.</span>
          </>
        }
        tabs={[
          { key: "trace", label: "Trace a purchase", node: s.how },
          { key: "chart", label: "Strategy chart", node: s.chart },
          { key: "real", label: "Real vs simulated", node: s.real },
          { key: "moat", label: "Monte vs the rest", node: s.moat },
        ]}
      />
    </>
  );
}
