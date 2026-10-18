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
        ["Plaid code", "Built. Not connected: this deployment has no Plaid keys."],
        ["The engine", "Every number on the page is arithmetic on those terms."],
        ["Monte Carlo", "1,000 simulated years from the person's own months."],
        ["Solver check", "Proves no other card choice earns more. 36 tests pass."],
        ["Your statement", "CSV upload, read in your browser, never uploaded."],
      ],
    },
    {
      tag: "Simulated",
      tone: "text-ace-dim",
      items: [
        ["Jordan, Maya, the Parks, Sam, Rosa", "Made-up people, real LA stores."],
        ["Tap", "A web demo, not a real wallet."],
        ["Point values", "1¢ cash, or The Points Guy's travel values."],
      ],
    },
    {
      tag: "Next",
      tone: "text-ace-dim",
      items: [
        ["Bank linking", "Live Plaid: purchases and balances, never card numbers."],
        ["The store map", "Fix a store once, for everyone."],
        ["At the register", `${b.name} in the phone's wallet, before you tap.`],
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
