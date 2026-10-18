"use client";

// Odd charges: a plain, deterministic check for the charges worth a second look, from the
// Finance prompt's "recognise suspicious transactions". Four rules, each flag traced to the
// purchases behind it. The demo people's synthetic years are clean, so a clearly labelled
// switch plants three test charges to show what the check catches.

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Txn } from "@/lib/engine";
import { Bracketed } from "@/components/brand";
import { MerchantLogo } from "./merchant-logo";
import { Section } from "./section";
import { money, nameOf, useAce } from "./store";

type Flag = { id: string; kind: "double" | "rise" | "test" | "far"; title: string; why: string; txns: Txn[]; planted: boolean };

const day = (d: string) => new Date(d + "T12:00:00Z").getTime() / 864e5;
const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function findOddCharges(txns: Txn[], planted: Set<string> = new Set()): Flag[] {
  const flags: Flag[] = [];
  const by = new Map<string, Txn[]>();
  for (const t of txns) by.set(t.merchant, [...(by.get(t.merchant) ?? []), t]);
  for (const [m, list] of by) {
    const s = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // 1. charged twice: same store, same amount, within two days
    for (let i = 1; i < s.length; i++)
      if (Math.abs(s[i].amount - s[i - 1].amount) < 0.005 && day(s[i].date) - day(s[i - 1].date) <= 2)
        flags.push({
          id: `double-${s[i].id}`,
          kind: "double",
          title: `Charged twice at ${m}`,
          why: (() => {
            const gap = Math.round(day(s[i].date) - day(s[i - 1].date));
            const when = gap === 0 ? `twice on ${fmt(s[i].date)}` : `on ${fmt(s[i - 1].date)} and again on ${fmt(s[i].date)}`;
            return `${money(s[i].amount, { cents: true })} ${when}. Same store, same amount${gap === 0 ? ", same day" : `, ${gap} day${gap === 1 ? "" : "s"} apart`}.`;
          })(),
          txns: [s[i - 1], s[i]],
          planted: planted.has(s[i].id) || planted.has(s[i - 1].id),
        });
    // 2. a recurring charge went up
    if (s.length >= 3) {
      const last = s[s.length - 1];
      const prev = s.slice(0, -1);
      const usual = prev[prev.length - 1].amount;
      const steady = prev.slice(-3).every((t) => Math.abs(t.amount - usual) < 0.01);
      if (steady && last.amount > usual * 1.05 + 0.5)
        flags.push({
          id: `rise-${last.id}`,
          kind: "rise",
          title: `${m} went up`,
          why: `${money(usual, { cents: true })} every time, then ${money(last.amount, { cents: true })} on ${fmt(last.date)}: ${money((last.amount - usual) * 12)} more a year if it stays.`,
          txns: [prev[prev.length - 1], last],
          planted: planted.has(last.id),
        });
    }
    // 3. card testing: a tiny charge at a store never seen before
    if (s.length === 1 && s[0].amount < 2)
      flags.push({
        id: `test-${s[0].id}`,
        kind: "test",
        title: `${money(s[0].amount, { cents: true })} at ${m}`,
        why: `First charge ever at this store, under $2: the amount used to test a stolen card number.`,
        txns: [s[0]],
        planted: planted.has(s[0].id),
      });
    // 4. far above what this store usually charges
    if (s.length >= 5) {
      const am = s.map((t) => t.amount).sort((a, b) => a - b);
      const med = am[Math.floor(am.length / 2)];
      for (const t of s)
        if (t.amount > med * 4 && t.amount > 50)
          flags.push({
            id: `far-${t.id}`,
            kind: "far",
            title: `${money(t.amount, { cents: true })} at ${m}`,
            why: `${(t.amount / med).toFixed(1)}× the ${money(med, { cents: true })} it usually charges (${s.length} purchases).`,
            txns: [t],
            planted: planted.has(t.id),
          });
    }
  }
  const order = { test: 0, double: 1, rise: 2, far: 3 };
  return flags.sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Three test charges, planted into a copy of the year and marked as planted. */
function plant(txns: Txn[]): { txns: Txn[]; ids: Set<string> } {
  const out = [...txns];
  const ids = new Set<string>();
  const last = txns[txns.length - 1]?.date ?? "2026-10-15";
  const dine = [...txns].reverse().find((t) => t.category === "dining") ?? txns[0];
  if (dine) {
    const d = { ...dine, id: `${dine.id}-dup`, date: dine.date };
    out.push(d);
    ids.add(d.id);
  }
  const sub = (() => {
    const by = new Map<string, Txn[]>();
    for (const t of txns) by.set(t.merchant, [...(by.get(t.merchant) ?? []), t]);
    return [...by.values()].find((l) => l.length >= 4 && l.every((t) => Math.abs(t.amount - l[0].amount) < 0.01));
  })();
  if (sub) {
    const t = sub[sub.length - 1];
    const d = { ...t, id: `${t.id}-rise`, amount: Math.round(t.amount * 1.29 * 100) / 100, date: last };
    out.push(d);
    ids.add(d.id);
  }
  const probe: Txn = { id: "planted-probe", date: last, merchant: "SQ *PAYMENT 8821", amount: 1, category: "everything_else", cardUsed: txns[0]?.cardUsed ?? "" };
  out.push(probe);
  ids.add(probe.id);
  return { txns: out, ids };
}

export function OddChargesSection() {
  const { txns, persona } = useAce();
  const who = nameOf(persona).whose;
  const [planted, setPlanted] = useState(false);
  const run = useMemo(() => {
    if (!planted) return { flags: findOddCharges(txns), n: txns.length };
    const p = plant(txns);
    return { flags: findOddCharges(p.txns, p.ids), n: p.txns.length };
  }, [txns, planted]);

  return (
    <Section
      id="odd"
      index="03½"
      kicker="Odd charges"
      title={
        <>
          {run.flags.length ? (
            <>
              <Bracketed>{run.flags.length}</Bracketed> charge{run.flags.length === 1 ? "" : "s"} worth a second look.
            </>
          ) : (
            <>No odd charges in {nameOf(persona).whose} year.</>
          )}
          <span className="m-second block">Four plain rules, every flag traced to the purchases.</span>
        </>
      }
      readout={
        <>
          {run.n} purchases checked · charged twice · price rises · card testing · far above usual
        </>
      }
      lede={`${nameOf(persona).Whose} year is synthetic and clean, so turn on the test charges to watch the check work. On your own statement it runs as soon as you load it.`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => setPlanted((v) => !v)} className={`btn btn-sm ${planted ? "btn-primary" : "btn-ghost"}`}>
          {planted ? "Remove the 3 test charges" : "Plant 3 test charges"}
        </button>
        <span className="text-sm text-ace-dim">
          {planted ? "Planted for this demo, marked below. Nothing else in the year changes." : `Checking ${who} ${txns.length} purchases.`}
        </span>
      </div>

      <div className="m-panel divide-y divide-[var(--m-line)] overflow-hidden">
        <AnimatePresence initial={false}>
          {run.flags.length === 0 && (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-5 p-8">
              <span className="m-num text-5xl">[ ]</span>
              <p>Checked for double charges, price rises, test charges and anything far above a store&apos;s usual. Turn on the test charges to see a catch.</p>
            </motion.div>
          )}
          {run.flags.map((f, k) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: k * 0.05 }}
              className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 items-start gap-4">
                <MerchantLogo name={f.txns[0].merchant} size={36} className="mt-0.5 rounded-[10px]" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">{f.title}</span>
                    <span className="m-label">
                      {f.kind === "double" ? "charged twice" : f.kind === "rise" ? "price rise" : f.kind === "test" ? "card testing" : "far above usual"}
                    </span>
                    {f.planted && <span className="m-label rounded-full px-2 py-0.5 shadow-[0_0_0_1px_var(--m-line-strong)]">planted test</span>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ace-dim">{f.why}</p>
                </div>
              </div>
              <div className="m-num flex flex-wrap gap-2 text-[12px] text-ace-dim md:justify-end">
                {f.txns.map((t) => (
                  <span key={t.id} className="rounded-full px-2.5 py-1 shadow-[0_0_0_1px_var(--m-line)]">
                    {fmt(t.date)} · {money(t.amount, { cents: true })}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Section>
  );
}
