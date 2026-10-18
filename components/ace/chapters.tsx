"use client";

import type { ReactNode } from "react";
import { Chapter } from "./chapter";
import { People } from "./people";
import { WhatIfBar } from "./keep";
import { useAce } from "./store";

type S = Record<
  "money" | "wrapped" | "receipt" | "replay" | "history" | "odd" | "tap" | "card" | "payoff" | "keep" | "apply" | "next" | "how" | "real" | "moat" | "chart" | "leaks",
  ReactNode
>;

/** Monte for anyone with money moving through a bank: six things it does, card routing one of
 *  them. Each chapter is one headline with its views as tabs. */
export function Chapters({ sections: s }: { sections: S }) {
  const one = useAce().held.length === 1;
  return (
    <>
      <Chapter
        id="see"
        index="01"
        kicker="See where it goes"
        title={
          <>
            See where it goes.
            <span className="m-second block">Every store, every month, every fee.</span>
          </>
        }
        intro={<People />}
        tabs={[
          { key: "stores", label: "Where it went", node: s.money },
          { key: "receipt", label: one ? "What the card costs" : "What the cards cost", node: s.receipt },
        ]}
      />
      <Chapter
        id="leaks"
        index="02"
        kicker="Stop the leaks"
        title={
          <>
            Stop the leaks.
            <span className="m-second block">What slips out, and the fix for each.</span>
          </>
        }
        tabs={[
          { key: "leaks", label: "The leaks", node: s.leaks },
          { key: "odd", label: "Odd charges", node: s.odd },
        ]}
      />
      <Chapter
        id="spend"
        index="03"
        kicker="Spend it right"
        title={
          <>
            Spend it right.
            <span className="m-second block">{one ? "One card, and what a second would add." : "The right card for every purchase."}</span>
          </>
        }
        tabs={[
          { key: "replay", label: "Replay", node: s.replay },
          ...(one
            ? []
            : [
                { key: "tap", label: "Tap", node: s.tap },
                { key: "card", label: "The Monte Card", node: s.card },
              ]),
          { key: "purchases", label: "Every purchase", node: s.history },
        ]}
      />
      <Chapter
        id="plan"
        index="04"
        kicker="Plan the next move"
        title={
          <>
            Plan the next move,
            <span className="m-second block">in the order that saves the most.</span>
          </>
        }
        intro={<WhatIfBar />}
        tabs={[
          { key: "payoff", label: "Pay this first", node: s.payoff },
          { key: "keep", label: "Keep or cancel", node: s.keep },
          { key: "apply", label: "What to apply for", node: s.apply },
        ]}
      />
      {s.next}
      <Chapter
        id="look"
        index="06"
        kicker="Look back"
        title={
          <>
            Look back.
            <span className="m-second block">The year, wrapped.</span>
          </>
        }
        tabs={[{ key: "wrapped", label: "Wrapped", node: s.wrapped }]}
      />
      <Chapter
        id="how"
        index="07"
        kicker="How it works"
        title={
          <>
            How it works.
            <span className="m-second block">Every number is math on the card companies&apos; published terms.</span>
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
