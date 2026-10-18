"use client";

// Monte Wrapped: the year in review as a short story you tap through, the way people share
// their music year. Every figure is the engine's, for whichever person is selected.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { byCategory, subscriptions, topMerchants } from "@/lib/engine/insights";
import { Bracketed, Lockup } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { label } from "./money";
import { MerchantLogo } from "./merchant-logo";
import { Section } from "./section";
import { money, nameOf, useAce } from "./store";

type Slide = { key: string; kicker: string; body: ReactNode; foot?: ReactNode };

export function WrappedSection() {
  const { txns, r, wallet, persona } = useAce();
  const nm = nameOf(persona);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const top = topMerchants(txns, 1)[0];
    const cat = byCategory(txns)[0];
    const subs = subscriptions(txns);
    const subYear = subs.reduce((a, s) => a + s.perYear, 0);
    const worst = [...r.perCard].sort((a, b) => a.net - b.net)[0];
    const best = [...r.perCard].sort((a, b) => b.net - a.net)[0];
    // the single purchase where the wrong card cost the most
    const a = new Map(r.actual.hits.map((h) => [h.txnId, h]));
    let miss = { gap: 0, merchant: "", used: "", pick: "", amount: 0 };
    for (const h of r.best.hits) {
      const x = a.get(h.txnId);
      const t = txns.find((q) => q.id === h.txnId);
      if (x && t && h.reward - x.reward > miss.gap) miss = { gap: h.reward - x.reward, merchant: t.merchant, used: x.cardId, pick: h.cardId, amount: t.amount };
    }
    const out: Slide[] = [
      {
        key: "open",
        kicker: `${nm.Whose} year`,
        body: (
          <>
            <Bracketed>{txns.length}</Bracketed> purchases.
            <span className="m-second block">
              {money(r.spend)} on {wallet.length} card{wallet.length === 1 ? "" : "s"}.
            </span>
          </>
        ),
      },
    ];
    if (top)
      out.push({
        key: "merchant",
        kicker: "top store, by money spent",
        body: (
          <>
            <span className="mb-5 block">
              <MerchantLogo name={top.merchant} size={64} className="rounded-[16px]" />
            </span>
            {top.count} trips to {top.merchant}.
            <span className="m-second block">
              <Bracketed>{money(top.total)}</Bracketed> all year.
            </span>
          </>
        ),
      });
    if (cat)
      out.push({
        key: "category",
        kicker: "where it went",
        body: (
          <>
            {Math.round(cat.share * 100)}% went to {label(cat.category)}.
            <span className="m-second block">{cat.count} purchases, {money(cat.total)}.</span>
          </>
        ),
      });
    if (subs.length)
      out.push({
        key: "subs",
        kicker: "still billing",
        body: (
          <>
            {subs.length} subscriptions.
            <span className="m-second block">
              <Bracketed>{money(subYear)}</Bracketed> a year, on autopay.
            </span>
          </>
        ),
      });
    if (miss.gap > 0.01)
      out.push({
        key: "miss",
        kicker: "the one that got away",
        body: (
          <>
            {money(miss.amount, { cents: true })} at {miss.merchant} went on the {shortName(miss.used)}.
            <span className="m-second block">
              The {shortName(miss.pick)} would have paid <Bracketed>{money(miss.gap, { sign: true, cents: true })}</Bracketed> more.
            </span>
          </>
        ),
      });
    if (r.leftOnTable >= 1)
    out.push({
      key: "table",
      kicker: "left on the table",
      body: (
        <>
          <Bracketed>{money(r.leftOnTable)}</Bracketed>
          <span className="m-second block">from the same purchases, on the right card.</span>
        </>
      ),
    });
    if (worst && best && worst.cardId !== best.cardId)
      out.push({
        key: "cards",
        kicker: "best and worst card",
        body: (
          <>
            <span className="mb-5 flex gap-3">
              <span className="w-28">
                <CardArt id={best.cardId} size="sm" />
              </span>
              <span className="w-28 opacity-60">
                <CardArt id={worst.cardId} size="sm" />
              </span>
            </span>
            {shortName(best.cardId)}: <span className={best.net >= 0 ? "text-ace-gain" : "text-ace-loss"}>{money(best.net, { sign: true })}</span>.
            <span className="m-second block">
              {shortName(worst.cardId)}: <span className="text-ace-loss">{money(worst.net, { sign: true })}</span>.
            </span>
          </>
        ),
      });
    out.push({
      key: "net",
      kicker: "the net",
      body: (
        <>
          <span className={r.net < 0 ? "text-ace-loss" : "text-ace-gain"}>
            <Bracketed>{money(r.net, { sign: true })}</Bracketed>
          </span>
          <span className="m-second block">after every reward, perk, fee and interest charge.</span>
        </>
      ),
      foot: <Lockup size={18} state="resolved" />,
    });
    return out;
  }, [txns, r, wallet, nm.Whose]);

  const n = slides.length;
  const cur = Math.min(i, n - 1);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setI((x) => (x + 1) % n), 3600);
    return () => clearTimeout(id);
  }, [cur, paused, n]);

  const s = slides[cur];

  return (
    <Section
      id="wrapped"
      index="07½"
      kicker="Wrapped"
      title={
        <>
          Tap through {nm.whose} year.
        </>
      }
      readout={<>{n} cards · every figure from the engine</>}
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_380px]">
        <ol className="m-mono hidden space-y-2 text-[13px] lg:block">
          {slides.map((x, k) => (
            <li key={x.key}>
              <button onClick={() => setI(k)} className={`transition ${k === cur ? "text-ace-ink" : "text-ace-dim hover:text-ace-ink"}`}>
                <span className="mr-3 text-ace-dim">{String(k + 1).padStart(2, "0")}</span>
                {x.kicker}
              </button>
            </li>
          ))}
        </ol>

        <div
          className="m-panel relative mx-auto aspect-[9/16] w-full max-w-[380px] cursor-pointer select-none overflow-hidden p-7"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setI((x) => (e.clientX - rect.left < rect.width / 3 ? (x - 1 + n) % n : (x + 1) % n));
          }}
          role="region"
          aria-label={`${nm.Whose} year in review, card ${cur + 1} of ${n}`}
        >
          <div className="absolute inset-x-5 top-5 flex gap-1">
            {slides.map((x, k) => (
              <span key={x.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--m-line)]">
                <motion.span
                  key={k === cur ? `on${cur}` : `off${k}`}
                  className="block h-full bg-ace-ink"
                  initial={{ width: k < cur ? "100%" : "0%" }}
                  animate={{ width: k < cur ? "100%" : k === cur ? "100%" : "0%" }}
                  transition={{ duration: k === cur && !paused ? 3.6 : 0, ease: "linear" }}
                />
              </span>
            ))}
          </div>
          <div className="m-label mt-6">{s.kicker}</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={s.key + persona.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-7 top-1/2 -translate-y-1/2 text-[2.1rem] leading-[1.05] tracking-[-0.035em]"
              style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}
            >
              {s.body}
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-7 bottom-7 flex items-center justify-between">
            <span className="m-label">
              {cur + 1} / {n}
            </span>
            {s.foot ?? <span className="m-label">tap →</span>}
          </div>
        </div>
      </div>
    </Section>
  );
}
