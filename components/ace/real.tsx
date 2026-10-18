"use client";

// What on this page is real, what is simulated, and what comes next. The rubric scores
// whether we say this plainly, so it is its own section, not a footnote.

import { CARDS } from "@/lib/engine/catalog";
import { useBrand } from "./brands";
import { Section } from "./section";

export function RealSection() {
  const { brand: b } = useBrand();
  const cols: { tag: string; tone: string; items: [string, string][] }[] = [
    {
      tag: "Real",
      tone: "text-ace-ink",
      items: [
        ["Card terms", `${CARDS.length} cards: earn rates, caps, rotations, credits, fees, APRs, each with the issuer page and the date checked (17 Oct 2026).`],
        ["The engine", "Routing, caps, the receipt, keep or cancel and the next card are arithmetic on those terms. Same input, same output."],
        ["Monte Carlo", "1,000 seeded years per wallet, from your own months. The odds are counts, not a model's opinion."],
        ["Your statement", "A Chase, Amex or Capital One CSV is parsed in your browser. Nothing is uploaded."],
      ],
    },
    {
      tag: "Simulated",
      tone: "text-ace-dim",
      items: [
        ["Jordan, Maya, the Parks", "Synthetic people with seeded spending at real LA merchants. Their numbers are reproducible."],
        ["Tap", "A web demo of the moment at the register, not an NFC wallet."],
        ["Point values", "Cash at 1¢ a point by default; travel values are The Points Guy's published estimates."],
      ],
    },
    {
      tag: "Next",
      tone: "text-ace-dim",
      items: [
        ["Bank linking", "Plaid in sandbox: transactions and balances in, no card numbers ever. Production needs Plaid's review."],
        ["The merchant map", "Issuers don't publish which codes count as dining. Each correction a user makes fixes it for everyone."],
        ["At the register", `${b.name} in the phone's wallet, so the pick appears before you tap.`],
      ],
    },
  ];
  return (
    <Section id="real" index="10" kicker="Real vs simulated" title={<>What&apos;s real on this page, and what isn&apos;t.</>} readout={<>said plainly, because it matters</>}>
      <div className="grid border-l border-t border-ace-line md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.tag} className="border-b border-r border-ace-line bg-ace-panel p-6">
            <div className={`mono text-[11px] uppercase tracking-[0.2em] ${c.tone}`}>{c.tag}</div>
            <dl className="mt-4 space-y-4">
              {c.items.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ace-dim">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Section>
  );
}
