"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { CARDS } from "@/lib/engine/catalog";
import { Section } from "./section";

const MOATS_RAW = [
  {
    n: "01",
    title: "Paid by you, not the banks.",
    body: "Card comparison sites earn a referral fee on every approval, so their rankings lean toward the cards that pay them. Ace ranks only by what a card does for your spending, after fees and interest, and says when the right move is no new card at all. In a category built on conflicts, trust is the product.",
  },
  {
    n: "02",
    title: "The net, not the points.",
    body: "Points apps compete on multipliers. Ace is the only one that counts what actually moves people's money: the 21% APR on a carried balance, the $325 fee, and the $120 credit nobody remembers. That is a different question, and it changes the answer for 45% of cardholders.",
  },
  {
    n: "03",
    title: "A rules graph that compounds.",
    body: `${CARDS.length} cards, every earn rule, cap, pick-one category, quarterly rotation and perk, each with its source and the date we checked it, run by a cap-aware optimizer. Issuers decide categories by merchant code and don't publish the map. Every time a user fixes a merchant, the map gets better for everyone.`,
  },
  {
    n: "04",
    title: "At the register, with your context.",
    body: "Uno and the points apps know which card wins in general. Ace knows how much of your cap is gone this quarter, which perk expires this week, and which card you shouldn't touch today. Once a year of your spending is linked, a static list can't compete.",
  },
];

export function MoatSection() {
  const { brand: b } = useBrand();
  const MOATS = MOATS_RAW.map((m) => ({ ...m, body: m.body.replace(/\bAce\b/g, b.name) }));
  return (
    <Section
      id="moat"
      index="08"
      kicker={`Why ${b.name} wins`}
      title={
        <>
          Uno picks the card. <span className="serif text-ace-gold">{b.name} shows the bill.</span>
        </>
      }
      lede={`Inspired by Uno Wallet (YC Spring 2026), which picks the best card at tap time. ${b.name} adds what every rewards app leaves out: the cost side.`}
    >
      <div className="grid gap-px overflow-hidden rounded-3xl border border-ace-line bg-ace-line md:grid-cols-2">
        {MOATS.map((m, i) => (
          <motion.div
            key={m.n}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
            className="group relative bg-ace-bg p-8 md:p-10"
          >
            <div className="mono text-[11px] tracking-[0.2em] text-ace-gold">{m.n}</div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">{m.title}</h3>
            <p className="mt-4 leading-relaxed text-ace-dim">{m.body}</p>
            <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100" style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(233,196,106,.08), transparent)" }} />
          </motion.div>
        ))}
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mono text-[11px] uppercase tracking-[0.15em] text-ace-dim">
            <tr className="border-b border-ace-line">
              <th className="py-3 font-normal"></th>
              <th className="py-3 font-normal text-ace-gold">{b.name}</th>
              <th className="py-3 font-normal">Uno Wallet</th>
              <th className="py-3 font-normal">Card comparison sites</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Best card at the register", "✓", "✓", "no"],
              ["Counts interest on a carried balance", "✓", "not advertised", "no"],
              ["Perks valued at what you actually use", "✓", "lists perks", "lists perks"],
              ["Ranks on your own year of spending", "✓", "not advertised", "on a profile"],
              ["Paid by card referrals", "no", "unknown", "yes"],
              ["Every number traced to a dated source", "✓", "not advertised", "not advertised"],
            ].map((row) => (
              <tr key={row[0]} className="border-b border-ace-line/60">
                {row.map((c, k) => (
                  <td key={k} className={`py-3 ${k === 0 ? "text-ace-ink" : k === 1 ? "text-ace-gain" : "text-ace-dim"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mono mt-3 text-[10px] uppercase tracking-wider text-ace-dim/60">
          Uno column from what its site advertises, Oct 2026 (it is waitlist-only). “Card comparison sites” means referral-funded sites such as NerdWallet.
        </p>
      </div>
    </Section>
  );
}

const STEPS = [
  ["Transactions", "Plaid (sandbox) or a statement upload. No card numbers, ever."],
  ["Category map", "130 Plaid categories mapped to 20 reward categories, plus merchant overrides."],
  ["Rules graph", `${CARDS.length} cards of issuer terms: caps, rotations, perks, each sourced and dated.`],
  ["Optimizer", "Plays your year through every card under every cap. Never a card with a balance."],
  ["Your receipt", "Net value, money left on the table, keep or cancel, the next card, the tap."],
];

export function HowSection() {
  return (
    <Section
      id="how"
      index="09"
      kicker="How it works"
      title={
        <>
          The AI never does <span className="serif text-ace-gold">the math.</span>
        </>
      }
      lede="Every dollar on this page comes from a published card term and an optimizer you can audit. Click through any number and you reach the rule and the purchases behind it."
    >
      <div className="relative grid gap-4 md:grid-cols-5">
        <motion.div
          className="absolute left-0 right-0 top-[38px] hidden h-px origin-left bg-gradient-to-r from-ace-gold via-ace-gain to-ace-gold md:block"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        />
        {STEPS.map(([t, d], i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.18 }}
            className="relative"
          >
            <div className="relative z-10 grid size-[76px] place-items-center rounded-2xl border border-ace-line bg-ace-panel">
              <span className="mono text-xl text-ace-gold">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="mt-5 font-medium">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-ace-dim">{d}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

export function Footer() {
  const { brand: b } = useBrand();
  return (
    <footer className="border-t border-ace-line py-16">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-[18vw] font-semibold leading-none tracking-[-0.06em] text-ace-ink/[0.06] md:text-[12rem]">{b.name}</div>
        <div className="mt-6 flex flex-col justify-between gap-4 text-sm text-ace-dim md:flex-row">
          <p>Built at ACM@USC TrojanHacks 2026 by Adrian Erlikhman and Michael Tarekegn, with Claude Code.</p>
          <p className="mono text-[11px] uppercase tracking-wider">Card terms checked 17 Oct 2026 · Demo data is synthetic · Not financial advice</p>
        </div>
      </div>
    </footer>
  );
}
