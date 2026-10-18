"use client";

// The simulated Monte Card (components/monte-card, built by the brand session; Adrian picked
// it). One card at the register, the engine picks which real card pays. Not real yet, and
// the explainer always sits with the demo to say why.

import { MonteCardDemo, WhyNotRealCard } from "@/components/monte-card/monte-card";
import { Section } from "./section";

export function MonteCardSection() {
  return (
    <Section
      id="monte-card"
      index="05½"
      kicker="The Monte Card"
      title={
        <>
          One card. The engine picks.
          <span className="m-second block">Not yet real.</span>
        </>
      }
      readout={<>simulation · no real card · the pick is the real engine</>}
    >
      <div className="space-y-10">
        <MonteCardDemo />
        <WhyNotRealCard />
      </div>
    </Section>
  );
}
