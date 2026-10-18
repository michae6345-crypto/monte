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
        ["The engine", "Routing, caps, the receipt, leaks, odd charges, the payoff plan, keep or cancel and the next card are arithmetic on those terms. Same input, same output."],
        ["Monte Carlo", "1,000 seeded years per wallet, from the person's own months. The odds are counts, not a model's opinion."],
        ["Optimality check", "A linear program checks the card routing against the best possible assignment, caps included. 35 engine tests pass."],
        ["Your statement", "A Chase, Amex or Capital One CSV is parsed in your browser. Nothing is uploaded."],
        ["Merchant corrections", "Re-categorise a store once in Every purchase and every purchase there is replayed."],
        ["Plaid code", "Four API routes for Plaid's sandbox. This deploy has no Plaid keys, so they answer 503 and the page stays on the five people."],
      ],
    },
    {
      tag: "Simulated",
      tone: "text-ace-dim",
      items: [
        ["Jordan, Maya, the Parks, Sam, Rosa", "Synthetic people with seeded spending at real LA merchants. Their numbers are reproducible."],
        ["Tap", "A web demo of the moment at the register, not an NFC wallet."],
        ["The Monte Card", "A simulation: no card is issued. The engine's pick is real; the authorization request is made up."],
        ["Point values", "Cash at 1¢ a point by default; travel values are The Points Guy's published estimates."],
      ],
    },
    {
      tag: "Next",
      tone: "text-ace-dim",
      items: [
        ["Bank linking", "Live Plaid with real keys: transactions and balances in, no card numbers ever. Production needs Plaid's review."],
        ["The merchant map", "Issuers don't publish which codes count as dining. Today a correction applies to every purchase at that store, in your browser; next, it improves the map for everyone."],
        ["At the register", `${b.name} in the phone's wallet, so the pick appears before you tap.`],
      ],
    },
  ];
  return (
    <Section id="real" index="10" kicker="Real vs simulated" title={<>What&apos;s real on this page, and what isn&apos;t.</>}>
      <div className="grid border-l border-t border-ace-line md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.tag} className="border-b border-r border-ace-line bg-ace-panel p-6">
            <div className={`text-3xl ${c.tone}`} style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.03em" }}>{c.tag}</div>
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
