"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { tap } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { CardArt, shortName } from "./card-art";
import { R, Section } from "./section";
import { StrategyChart } from "./strategy";
import { money, useAce } from "./store";

const SPOTS = [
  { merchant: "Sweetgreen", category: "dining", amount: 16.5, where: "Silver Lake", mcc: "5812" },
  { merchant: "Trader Joe's", category: "groceries", amount: 64.2, where: "Los Feliz", mcc: "5411" },
  { merchant: "Mobil", category: "gas", amount: 52, where: "Sunset Blvd", mcc: "5541" },
  { merchant: "Uber", category: "rideshare", amount: 22.4, where: "to LAX", mcc: "4121" },
  { merchant: "Netflix", category: "streaming", amount: 15.49, where: "monthly", mcc: "4899" },
  { merchant: "Delta", category: "airfare", amount: 318, where: "LAX → JFK", mcc: "3058" },
  { merchant: "CVS Pharmacy", category: "drugstores", amount: 23.8, where: "Vermont Ave", mcc: "5912" },
  { merchant: "AMC Theatres", category: "entertainment", amount: 34, where: "The Grove", mcc: "7832" },
];

const CREDIT_HINTS: Record<string, { cardId: string; credit: string; note: string }> = {
  Uber: { cardId: "amex_gold", credit: "Uber Cash", note: "Pay with your $10 monthly Uber Cash first: it expires at month end." },
};

export function TapSection() {
  const { wallet, txns } = useAce();
  const [i, setI] = useState(0);
  // presenter mode jumps straight to a merchant
  useEffect(() => {
    const on = (e: Event) => {
      const k = SPOTS.findIndex((s) => s.merchant === (e as CustomEvent<string>).detail);
      if (k >= 0) setI(k);
    };
    window.addEventListener("monte:tap", on);
    return () => window.removeEventListener("monte:tap", on);
  }, []);
  const spot = SPOTS[i];
  const history = useMemo(() => txns.filter((t) => t.date >= "2026-10-01"), [txns]);
  const res = useMemo(
    () => tap(wallet, { date: "2026-10-18", merchant: spot.merchant, category: spot.category, amount: spot.amount }, history),
    [wallet, spot, history],
  );
  const pick = res.pick;
  const runner = res.ranked.find((x) => x.cardId !== pick.cardId && !x.blocked);
  const blocked = res.ranked.find((x) => x.blocked && x.reward > pick.reward);
  const hint = CREDIT_HINTS[spot.merchant];
  const showHint = hint && wallet.some((h) => h.cardId === hint.cardId);

  return (
    <Section
      id="tap"
      index="05"
      kicker="Tap"
      title={<>The right card, at the register.</>}
      readout={
        <>
          <R>{wallet.length}</R> cards · <R tone={wallet.some((h) => h.balance) ? "loss" : "ink"}>{wallet.filter((h) => h.balance).length}</R> off limits
        </>
      }
      lede="Pick a store. Monte ranks your cards for that purchase, counting caps already used, this quarter's categories, perks about to expire, and any card carrying a balance."
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto_1fr]">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
          {SPOTS.map((s, k) => (
            <button
              key={s.merchant}
              onClick={() => setI(k)}
              className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left transition ${
                k === i ? "border-ace-gold bg-ace-gold/10" : "border-ace-line hover:border-ace-ink/30"
              }`}
            >
              <span className={`mono w-10 shrink-0 text-[11px] tnum ${k === i ? "text-ace-gold" : "text-ace-dim"}`} title="Merchant category code: what the issuer sees">{s.mcc}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.merchant}</span>
                <span className="mono block text-[10px] uppercase tracking-wider text-ace-dim">{s.where}</span>
              </span>
              <span className="mono text-sm text-ace-dim">{money(s.amount, { cents: true })}</span>
            </button>
          ))}
        </div>

        {/* phone */}
        <div className="relative mx-auto h-[600px] w-[300px] rounded-[48px] border border-ace-line bg-[#e9ebef] p-3 shadow-[0_1px_2px_rgba(12,14,20,.06),0_30px_60px_-30px_rgba(12,14,20,.28)]">
          <div className="absolute left-1/2 top-5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0c0e14]" />
          <div className="relative h-full overflow-hidden rounded-[38px] bg-ace-panel px-4 pt-12 ring-1 ring-ace-line">
            <div className="mono text-center text-[10px] uppercase tracking-[0.25em] text-ace-dim">You&apos;re at</div>
            <AnimatePresence mode="wait">
              <motion.div key={spot.merchant} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="mt-1 text-center text-2xl font-semibold">{spot.merchant}</div>
                <div className="mono text-center text-xs text-ace-dim">
                  MCC {spot.mcc} · {spot.category.replace(/_/g, " ")} · {money(spot.amount, { cents: true })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* wallet fan */}
            <div className="relative mt-6 h-[270px]">
              {wallet.map((h, k) => {
                const isPick = h.cardId === pick.cardId;
                const rank = res.ranked.findIndex((x) => x.cardId === h.cardId);
                return (
                  <motion.div
                    key={h.cardId}
                    className="absolute inset-x-0 mx-auto w-[240px]"
                    animate={{
                      y: isPick ? 0 : 92 + rank * 16,
                      scale: isPick ? 1 : 0.86,
                      rotate: isPick ? 0 : (k - 1) * 4,
                      zIndex: isPick ? 20 : 10 - rank,
                    }}
                    transition={{ type: "spring", stiffness: 140, damping: 18 }}
                  >
                    <CardArt id={h.cardId} dim={!isPick} />
                    {h.balance ? (
                      <div className="mono absolute right-2 top-2 rotate-6 rounded border-2 border-ace-loss px-1.5 text-[10px] font-bold uppercase text-ace-loss">
                        balance
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={spot.merchant + pick.cardId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-4 bottom-5 rounded-2xl border border-ace-gain/30 bg-ace-gain/10 p-3.5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{shortName(pick.cardId)}</span>
                  <span className="mono text-lg text-ace-gain">+{money(pick.reward, { cents: true })}</span>
                </div>
                <div className="mono mt-0.5 text-[11px] text-ace-dim">{pick.rule}</div>
                {runner && (
                  <div className="mono mt-1 text-[11px] text-ace-dim">
                    vs {shortName(runner.cardId)} +{money(runner.reward, { cents: true })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* the why */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {blocked && (
              <motion.div
                key={"b" + spot.merchant}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-md border border-ace-loss/40 bg-ace-loss/10 p-5"
              >
                <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-loss">Not this one</div>
                <div className="mt-2 text-lg font-medium">{shortName(blocked.cardId)} would earn {money(blocked.reward, { cents: true })}</div>
                <p className="mt-1 text-sm leading-relaxed text-ace-dim">{blocked.blocked}</p>
              </motion.div>
            )}
            {showHint && (
              <motion.div key="hint" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-md border border-ace-gold/40 bg-ace-gold/10 p-5">
                <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-gold">Perk first</div>
                <p className="mt-2 text-sm leading-relaxed">{hint.note}</p>
              </motion.div>
            )}
            {res.capNotes.map((n) => (
              <motion.div key={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-md border border-ace-line p-5 text-sm text-ace-dim">
                {n}
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="rounded-md border border-ace-line p-5">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Every card, ranked</div>
            <div className="mt-3 space-y-2">
              {res.ranked.map((x) => (
                <div key={x.cardId} className={`flex items-center justify-between text-sm ${x.blocked ? "text-ace-dim line-through" : ""}`}>
                  <span>{shortName(x.cardId)}</span>
                  <span className="mono">
                    {x.mult.toFixed(x.mult % 1 ? 1 : 0)}x · {money(x.reward, { cents: true })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mono mt-4 text-[10px] uppercase tracking-wider text-ace-dim">
              Source: {new URL(card(pick.cardId).source_urls[0] ?? "https://example.com").hostname}
            </p>
          </div>
        </div>
      </div>
      <StrategyChart />
    </Section>
  );
}
