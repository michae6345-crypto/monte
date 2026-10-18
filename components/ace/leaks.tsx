"use client";

// Stop the leaks: every way money quietly drains out of this wallet in a year, each from the
// engine, each with the place on the page that fixes it. Works for any wallet: one card, a
// balance, no balance, a pile of subscriptions.

import { motion } from "framer-motion";
import { useMemo } from "react";
import { creditsUsed, interestFor, marginalValue } from "@/lib/engine";
import { card, creditPerYear } from "@/lib/engine/catalog";
import { subscriptions } from "@/lib/engine/insights";
import { Bracketed } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { MerchantLogo } from "./merchant-logo";
import { findOddCharges } from "./odd";
import { bestSecondCard } from "./one-card";
import { money, useAce } from "./store";

type Leak = {
  key: string;
  amount: number; // dollars a year
  counts: boolean; // added to the headline total
  title: string;
  why: string;
  fix: { label: string; chapter: string; tab?: string };
  art?: { card?: string; merchant?: string };
};

const go = (chapter: string, tab?: string) => {
  if (tab) window.dispatchEvent(new CustomEvent("monte:tab", { detail: { chapter, tab } }));
  window.setTimeout(() => document.getElementById(chapter)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
};

export function LeaksSection() {
  const { wallet, txns, r, persona, valuation } = useAce();
  const who = persona.id === "you" ? "you" : persona.name;

  const leaks = useMemo<Leak[]>(() => {
    const out: Leak[] = [];
    // interest on carried balances
    for (const h of wallet) {
      const i = interestFor(h);
      if (i > 0.5)
        out.push({
          key: `int-${h.cardId}`,
          amount: i,
          counts: true,
          title: `Interest on the ${shortName(h.cardId)}`,
          why: `$${(h.balance ?? 0).toLocaleString()} carried at ${h.apr ?? card(h.cardId).purchase_apr_range[1]}% APR. More than any card earns back.`,
          fix: { label: "Pay this first", chapter: "plan", tab: "payoff" },
          art: { card: h.cardId },
        });
    }
    // annual fees that cost more than the card returns
    for (const h of wallet) {
      const c = card(h.cardId);
      if (c.annual_fee <= 0) continue;
      const m = marginalValue(wallet, txns, h.cardId);
      if (m.net < -0.5)
        out.push({
          key: `fee-${h.cardId}`,
          amount: -m.net,
          counts: true,
          title: `The ${shortName(h.cardId)}'s fee`,
          why: `${money(c.annual_fee)} a year buys ${money(m.rewardsAdded + m.credits)} of value for ${who === "you" ? "you" : who}, over the next-best card already held.`,
          fix: { label: "Keep or cancel", chapter: "plan", tab: "keep" },
          art: { card: h.cardId },
        });
      // perks paid for and left on the table (shown, not added: only a loss if you'd use them)
      const unused = c.credits.reduce((a, cr) => a + creditPerYear(cr), 0) - creditsUsed(h);
      if (unused > 1)
        out.push({
          key: `perk-${h.cardId}`,
          amount: unused,
          counts: false,
          title: `Unused ${shortName(h.cardId)} credits`,
          why: `${c.credits.map((cr) => cr.name).join(", ")}: ${money(unused)} a year of credits the fee pays for, not used. Only a loss if you'd have spent there anyway.`,
          fix: { label: "Keep or cancel", chapter: "plan", tab: "keep" },
          art: { card: h.cardId },
        });
    }
    // the wrong card at the register
    if (r.leftOnTable > 0.5)
      out.push({
        key: "routing",
        amount: r.leftOnTable,
        counts: true,
        title: wallet.length > 1 ? "The wrong card at the register" : "One card for everything",
        why: `The same purchases on the right card in this wallet would have earned ${money(r.leftOnTable)} more.`,
        fix: { label: "Spend it right", chapter: "spend", tab: "replay" },
      });
    // one card: what a second card would add (an opportunity, not counted as a leak)
    if (wallet.length === 1 && !wallet[0].balance) {
      const best = bestSecondCard(wallet, txns);
      if (best && best.w.net > 1)
        out.push({
          key: "second",
          amount: best.w.net,
          counts: false,
          title: `One card for everything`,
          why: `A ${shortName(best.id)} beside it would have added ${money(best.w.net)} a year on the same purchases, after its fee.`,
          fix: { label: "Spend it right", chapter: "spend", tab: "replay" },
          art: { card: best.id },
        });
    }
    // subscriptions that went up
    for (const s of subscriptions(txns).filter((x) => x.priceHike))
      out.push({
        key: `rise-${s.merchant}`,
        amount: s.perYear * 0.12,
        counts: true,
        title: `${s.merchant} went up`,
        why: `A recurring charge that rose; it bills ${money(s.perYear)} a year now.`,
        fix: { label: "Odd charges", chapter: "leaks", tab: "odd" },
        art: { merchant: s.merchant },
      });
    // odd charges: doubles and card tests are money out
    for (const f of findOddCharges(txns).filter((f) => f.kind === "double" || f.kind === "test"))
      out.push({
        key: f.id,
        amount: f.kind === "double" ? f.txns[1].amount : f.txns[0].amount,
        counts: true,
        title: f.title,
        why: f.why,
        fix: { label: "Odd charges", chapter: "leaks", tab: "odd" },
        art: { merchant: f.txns[0].merchant },
      });
    // everything still billing, as a check-in (not added)
    const subs = subscriptions(txns);
    if (subs.length)
      out.push({
        key: "subs",
        amount: subs.reduce((a, s) => a + s.perYear, 0),
        counts: false,
        title: `${subs.length} subscriptions still billing`,
        why: `${subs.map((s) => s.merchant).slice(0, 5).join(", ")}${subs.length > 5 ? "…" : ""}. Not a leak if you use them; worth a look once a year.`,
        fix: { label: "Where it went", chapter: "see", tab: "stores" },
        art: { merchant: subs[0].merchant },
      });
    return out.sort((a, b) => Number(b.counts) - Number(a.counts) || b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, r, valuation, who]);

  const total = leaks.filter((l) => l.counts).reduce((a, l) => a + l.amount, 0);

  return (
    <div id="leaks-list" className="scroll-mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <h3 className="max-w-2xl text-3xl md:text-[2.6rem]">
          {total >= 1 ? (
            <>
              Monte found <Bracketed>{money(total)}</Bracketed> a year leaking
              <span className="m-second block">out of {who === "you" ? "your" : `${who}'s`} wallet.</span>
            </>
          ) : (
            <>
              Nothing is leaking
              <span className="m-second block">from {who === "you" ? "your" : `${who}'s`} wallet. Here&apos;s what&apos;s worth a look.</span>
            </>
          )}
        </h3>
        <p className="max-w-xs text-sm leading-relaxed">
          Interest, fees that cost more than they return, the wrong card, price rises and double charges. Every number from the engine, each with
          the fix.
        </p>
      </div>
      <div className="m-panel divide-y divide-[var(--m-line)] overflow-hidden">
        {leaks.length === 0 && <p className="p-8 text-lg">No leaks found. Every dollar here is already played right.</p>}
        {leaks.map((l, i) => (
          <motion.div
            key={l.key}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="grid items-center gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-8"
          >
            <div className="flex min-w-0 items-center gap-4">
              {l.art?.card ? (
                <CardArt id={l.art.card} size="sm" className="w-14 shrink-0" />
              ) : l.art?.merchant ? (
                <MerchantLogo name={l.art.merchant} size={36} className="rounded-[10px]" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--m-wash)] m-num text-sm">↯</span>
              )}
              <div className="min-w-0">
                <div className="text-lg font-medium">{l.title}</div>
                <p className="text-sm leading-relaxed">{l.why}</p>
              </div>
            </div>
            <div className="text-right" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.03em" }}>
              <div className={`text-3xl ${l.counts ? "text-ace-loss" : "text-ace-ink"}`}>
                {l.counts ? money(-l.amount, { sign: true }) : money(l.amount)}
              </div>
              <div className="text-xs" style={{ fontFamily: "var(--m-font-body)", fontWeight: 400, letterSpacing: 0 }}>
                {l.counts ? "a year" : "a year · not counted"}
              </div>
            </div>
            <button onClick={() => go(l.fix.chapter, l.fix.tab)} className="btn btn-ghost btn-sm justify-self-start md:justify-self-end">
              {l.fix.label} <span aria-hidden>→</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
