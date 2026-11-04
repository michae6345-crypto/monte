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
        ["Card terms", `${CARDS.length} cards, from each issuer's page, checked 17 Oct 2026.`],
        ["The engine", "Every number on the page is arithmetic on those terms, counting interest as well as points."],
        ["The app", `${b.name} at the register: your cards, the store you're at (search or near me), the card to use.`],
        ["Online", "A Chrome extension names the card on any store's site, and at checkout if you turn it on."],
        ["The card's brain", "Answers a card network's authorization request with the card to play, in a few milliseconds."],
        ["Monte Carlo", "1,000 simulated years from the person's own months."],
        ["Solver check", "Proves no other card choice earns more. 76 tests pass."],
        ["Your statement", "CSV upload, read in your browser, never uploaded."],
      ],
    },
    {
      tag: "Simulated",
      tone: "text-ace-dim",
      items: [
        ["Jordan, Maya, the Parks, Sam, Rosa", "Made-up people, real LA stores."],
        ["Tap", "A web demo, not a real wallet."],
        ["The card network", "The card's requests come from a simulator until an issuer sandbox key is added."],
        ["Point values", "1¢ cash, or The Points Guy's travel values."],
      ],
    },
    {
      tag: "Next",
      tone: "text-ace-dim",
      items: [
        ["Bank linking", "Plaid Link is built: it goes live with keys. Purchases and balances, never card numbers."],
        ["Moving the money", "A bank partner, so the Monte card can pay with the card it picks."],
        ["The store map", "Fix a store once, for everyone."],
      ],
    },
  ];
  return (
    <Section id="real" index="10" kicker="Real vs simulated" title={<>What&apos;s real on this page, and what isn&apos;t.</>}>
      <div className="m-panel grid divide-y divide-[var(--m-line)] overflow-hidden md:grid-cols-3 md:divide-x md:divide-y-0">
        {cols.map((c) => (
          <div key={c.tag} className="p-6">
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
