"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bracketed, HandNote } from "@/components/brand";
import { MerchantLogo } from "./merchant-logo";
import { tap, type Holding } from "@/lib/engine";
import { CARDS, card, openToNewApplicants } from "@/lib/engine/catalog";
import { CardArt, nick, shortName } from "./card-art";
import { R, Section } from "./section";
import { Stage } from "./stage";
import { money, nameOf, useAce } from "./store";
import { spotsFor } from "./spots";

const BASE = [
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
  const { wallet: theirs, txns, valuation, persona } = useAce();
  // a judge's own cards, for Tap only: the rest of the page stays on the selected person
  const [own, setOwn] = useState<string[] | null>(null);
  const [ownFor, setOwnFor] = useState(persona.id);
  if (ownFor !== persona.id) {
    setOwnFor(persona.id);
    setOwn(null);
  }
  const wallet = useMemo<Holding[]>(() => (own && own.length ? own.map((cardId) => ({ cardId })) : theirs), [own, theirs]);
  const SPOTS = useMemo(() => spotsFor(BASE, txns, "Los Angeles"), [txns]);
  const [i, setI] = useState(0);
  // brackets blink while the engine ranks the cards, then resolve on the winner
  const [solving, setSolving] = useState(false);
  const timer = useRef(0);
  const [manual, setManual] = useState(false);
  const choose = (k: number) => {
    setI(k);
    setSolving(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSolving(false), 650);
  };
  // presenter mode jumps straight to a merchant
  useEffect(() => {
    const on = (e: Event) => {
      const k = SPOTS.findIndex((s) => s.merchant === (e as CustomEvent<string>).detail);
      if (k >= 0) {
        // hold it: the scroll tour mustn't swap the store mid-pitch
        setManual(true);
        choose(k);
      }
    };
    window.addEventListener("monte:tap", on);
    return () => window.removeEventListener("monte:tap", on);
  }, [SPOTS]);
  const spot = SPOTS[Math.min(i, SPOTS.length - 1)];
  // caps already used this month come from the person's purchases, so a judge's own cards start fresh
  const history = useMemo(() => (own && own.length ? [] : txns.filter((t) => t.date >= "2026-10-01")), [txns, own]);
  const res = useMemo(
    () => tap(wallet, { date: "2026-10-18", merchant: spot.merchant, category: spot.category, amount: spot.amount }, history),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, spot, history, valuation],
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
      <Stage vh={260}>
        {(p) => (
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto_1fr]">
        {!manual && <AutoPick k={Math.min(SPOTS.length - 1, Math.floor(Math.max(0, (p - 0.06) / 0.88) * SPOTS.length))} current={i} onPick={choose} />}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          {SPOTS.map((s, k) => (
            <button
              key={s.merchant}
              onClick={() => {
                setManual(true);
                choose(k);
              }}
              className={`flex items-center gap-3 rounded-[10px] px-4 py-3 text-left transition ${
                k === i ? "bg-ace-panel shadow-[0_0_0_1.5px_var(--m-ink)]" : "bg-ace-panel shadow-[0_0_0_1px_var(--m-line)] hover:shadow-[0_0_0_1px_var(--m-line-strong)]"
              }`}
            >
              <span className={`m-num w-10 shrink-0 text-[11px] ${k === i ? "text-ace-ink" : "text-ace-dim"}`} title="Merchant category code: what the issuer sees">{s.mcc}</span>
              <MerchantLogo name={s.merchant} size={26} />
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
                <div className="mt-3 flex justify-center">
                  <MerchantLogo name={spot.merchant} size={44} className="rounded-[12px]" />
                </div>
                <div className="mt-2 text-center text-2xl font-semibold">{spot.merchant}</div>
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
                      y: isPick ? 40 : 40 - rank * 14,
                      scale: isPick ? 1 : 1 - rank * 0.04,
                      rotate: isPick ? 0 : (k - 1) * 2,
                      zIndex: isPick ? 20 : 10 - rank,
                    }}
                    transition={{ type: "spring", stiffness: 140, damping: 18 }}
                  >
                    <CardArt id={h.cardId} dim={!isPick} />
                    {h.balance && isPick ? (
                      <div className="m-mono absolute right-2 top-2 rounded-full bg-ace-panel px-2 py-0.5 text-[10px] text-ace-ink shadow-[0_0_0_1px_var(--m-line-strong)]">
                        carries a balance
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={spot.merchant + pick.cardId + (solving ? "s" : "")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-4 bottom-5 z-30 rounded-2xl bg-ace-panel p-3.5 shadow-[0_0_0_1px_var(--m-line-strong)]"
              >
                <div className="text-sm font-semibold leading-tight">{solving ? "ranking the cards" : shortName(pick.cardId)}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className={`text-3xl ${solving ? "text-ace-dim" : "text-ace-gain"}`} style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
                    <Bracketed state={solving ? "computing" : "resolved"}>{solving ? "···" : `+${money(pick.reward, { cents: true })}`}</Bracketed>
                  </span>
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
                className="m-panel relative p-5"
              >
                <div className="m-label">Not this one</div>
                <div className="mt-2 text-lg font-medium">
                  {shortName(blocked.cardId)} would earn <span className="m-num text-ace-dim line-through">{money(blocked.reward, { cents: true })}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ace-dim">{blocked.blocked}</p>
                <HandNote dir="up-left" className="mt-3 hidden lg:flex" delay={0.2}>
                  {`${blocked.mult % 1 ? blocked.mult.toFixed(1) : blocked.mult}× here, but the balance charges interest from today`}
                </HandNote>
              </motion.div>
            )}
            {showHint && (
              <motion.div key="hint" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="m-panel p-5">
                <div className="m-label">Perk first</div>
                <p className="mt-2 text-sm leading-relaxed">{hint.note}</p>
              </motion.div>
            )}
            {res.capNotes.map((n) => (
              <motion.div key={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="m-panel p-5 text-sm text-ace-dim">
                {n}
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="m-panel p-5">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Every card, ranked</div>
            <div className="mt-3 space-y-2">
              {res.ranked.map((x) => (
                <div key={x.cardId} className={`flex items-center justify-between text-sm ${x.blocked ? "text-ace-dim line-through" : ""}`}>
                  <span>
                    {shortName(x.cardId)}
                    {x.blocked ? <span className="ml-1 text-[11px] no-underline"> · carries a balance</span> : null}
                  </span>
                  <span className="mono">
                    {x.mult.toFixed(x.mult % 1 ? 1 : 0)}× · {money(x.reward, { cents: true })}
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
        )}
      </Stage>
      <div className="m-panel mt-8 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-lg font-medium">Try it with your own cards.</p>
          <span className="text-sm">
            {own && own.length ? (
              <button onClick={() => setOwn(null)} className="underline">
                back to {nameOf(persona).whose} cards
              </button>
            ) : (
              <>Tap the ones in your wallet; the phone above ranks them for each store.</>
            )}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CARDS.filter((c) => openToNewApplicants(c)).map((c) => {
            const on = !!own?.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => {
                  setManual(true);
                  setOwn((o) => {
                    const cur = o ?? [];
                    return cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id];
                  });
                }}
                aria-pressed={on}
                className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`}
              >
                {nick(c.id)}
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

/** While nobody has clicked, the scroll position picks the store. */
function AutoPick({ k, current, onPick }: { k: number; current: number; onPick: (k: number) => void }) {
  useEffect(() => {
    if (k !== current) onPick(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return null;
}
