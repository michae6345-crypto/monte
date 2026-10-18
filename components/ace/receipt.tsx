"use client";

import { useBrand } from "./brands";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CARDS, card } from "@/lib/engine/catalog";
import { PERSONAS } from "@/lib/data/personas";
import { CardArt, shortName } from "./card-art";
import { Num } from "./num";
import { Section } from "./section";
import { money, useAce } from "./store";

export function ReceiptSection() {
  const { persona, setPersona, wallet, addCard, removeCard, toggleBalance, valuation, setValuationMode, r, txns } = useAce();
  const [picker, setPicker] = useState(false);
  const { brand: b } = useBrand();

  const lines: { label: string; sub?: string; value: number }[] = [
    ...r.perCard.map((c) => ({ label: `${shortName(c.cardId)} rewards`, value: c.rewards })),
    ...r.perCard.filter((c) => c.credits > 0).map((c) => ({ label: `${shortName(c.cardId)} perks used`, value: c.credits })),
    ...r.perCard.filter((c) => c.fee > 0).map((c) => ({ label: `${shortName(c.cardId)} annual fee`, value: -c.fee })),
    ...r.perCard
      .filter((c) => c.interest > 0)
      .map((c) => {
        const h = wallet.find((x) => x.cardId === c.cardId)!;
        return { label: `${shortName(c.cardId)} interest`, sub: `$${h.balance?.toLocaleString()} balance at ${h.apr}% APR`, value: -c.interest };
      }),
  ];

  return (
    <Section
      id="receipt"
      index="01"
      kicker="The Receipt"
      title={
        <>
          What your cards <span className="serif text-ace-gold">really</span> did last year.
        </>
      }
      lede={`Every rewards app shows the points. ${b.name} shows the net: rewards and perks you actually used, minus annual fees, minus interest. Pick a person, or build your own wallet.`}
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_440px]">
        {/* controls */}
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={`rounded-full border px-4 py-2 text-left transition ${
                  persona.id === p.id ? "border-ace-gold bg-ace-gold/10" : "border-ace-line hover:border-ace-ink/30"
                }`}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className="mono text-[10px] uppercase tracking-wider text-ace-dim">{p.blurb}</div>
              </button>
            ))}
          </div>

          <div>
            <div className="mono mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-ace-dim">
              <span>Wallet · {wallet.length} cards · {txns.length} purchases · ${Math.round(r.spend).toLocaleString()} spent</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {wallet.map((h) => (
                  <motion.div
                    layout
                    key={h.cardId}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="group relative"
                  >
                    <CardArt id={h.cardId} />
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => toggleBalance(h.cardId)}
                        className={`mono rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
                          h.balance ? "border-ace-loss/50 bg-ace-loss/10 text-ace-loss" : "border-ace-line text-ace-dim hover:text-ace-ink"
                        }`}
                      >
                        {h.balance ? `$${h.balance.toLocaleString()} balance` : "paid in full"}
                      </button>
                      {wallet.length > 1 && (
                        <button onClick={() => removeCard(h.cardId)} className="text-ace-dim opacity-0 transition hover:text-ace-loss group-hover:opacity-100">
                          remove
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {wallet.length < 5 && (
                <button
                  onClick={() => setPicker((v) => !v)}
                  className="grid aspect-[1.586/1] place-items-center rounded-[7%/11%] border border-dashed border-ace-line text-ace-dim transition hover:border-ace-gold hover:text-ace-gold"
                >
                  + add a card
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {picker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid max-h-[340px] grid-cols-3 gap-3 overflow-y-auto rounded-2xl border border-ace-line bg-ace-panel p-4 sm:grid-cols-4 md:grid-cols-5">
                  {CARDS.filter((c) => !wallet.some((h) => h.cardId === c.id)).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        addCard(c.id);
                        setPicker(false);
                      }}
                      className="text-left transition hover:-translate-y-1"
                      title={c.name}
                    >
                      <CardArt id={c.id} size="sm" />
                      <div className="mt-1 truncate text-[10px] text-ace-dim">{shortName(c.id)}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Value points at</span>
            {(["cash", "travel"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setValuationMode(v)}
                className={`rounded-full border px-3 py-1 transition ${valuation === v ? "border-ace-ink bg-ace-ink text-ace-bg" : "border-ace-line text-ace-dim"}`}
              >
                {v === "cash" ? "cash (1¢ a point)" : "travel (TPG, Oct 2026)"}
              </button>
            ))}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-ace-dim">
            Every rule comes from the issuer&apos;s own terms for {CARDS.length} cards, checked {card("amex_gold").checked ?? "17 Oct 2026"}.
            Purchases are a synthetic year at real LA merchants. Interest uses the average balance × APR.
          </p>
        </div>

        {/* the receipt */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: -1.5 }}
          whileInView={{ opacity: 1, y: 0, rotate: -1.5 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[440px] lg:sticky lg:top-24 lg:self-start"
        >
          <div className="receipt-edge rounded-t-sm bg-ace-paper px-7 pb-12 pt-8 text-[#1d1b16] shadow-[0_40px_80px_-20px_rgba(0,0,0,.8)]">
            <div className="mono text-center text-[11px] uppercase tracking-[0.3em] text-black/50">{b.name} · annual receipt</div>
            <div className="serif mt-1 text-center text-3xl">{persona.name}</div>
            <div className="mono mt-1 text-center text-[10px] uppercase tracking-widest text-black/40">18 Oct 2025 – 17 Oct 2026</div>
            <div className="my-5 border-t border-dashed border-black/25" />
            <div className="mono space-y-2.5 text-[13px]">
              <AnimatePresence initial={false}>
                {lines.map((l, i) => (
                  <motion.div
                    key={l.label}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{l.label}</span>
                      {l.sub && <span className="block text-[10px] text-black/45">{l.sub}</span>}
                    </span>
                    <Num value={l.value} sign className={`tnum shrink-0 ${l.value < 0 ? "text-[#c23a2f]" : "text-[#1a7a48]"}`} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="my-5 border-t border-dashed border-black/25" />
            <div className="flex items-end justify-between">
              <span className="mono text-[11px] uppercase tracking-[0.25em] text-black/50">Net</span>
              <Num value={r.net} sign className={`serif tnum text-6xl leading-none ${r.net < 0 ? "text-[#c23a2f]" : "text-[#1a7a48]"}`} />
            </div>
            <div className="mt-6 rounded-md bg-black/[0.06] p-3 text-[12px] leading-relaxed">
              <span className="font-semibold">Left on the table: </span>
              <Num value={r.leftOnTable} className="mono font-semibold tnum" /> more rewards from the same purchases, just by tapping the
              right card in this same wallet{wallet.some((h) => h.balance) ? ", and never the one with a balance" : ""}.{" "}
              <a href="#replay" className="underline underline-offset-2">Watch the replay ↓</a>
            </div>
            <div className="mono mt-5 text-center text-[10px] uppercase tracking-[0.3em] text-black/35">
              {money(r.spend)} spent · {txns.length} purchases
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
