"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bracketed, HandNote, MonteMark, Sampler } from "@/components/brand";
import { CardArt, nick, shortName } from "@/components/ace/card-art";
import { MerchantLogo } from "@/components/ace/merchant-logo";
import { money, nameOf, useAce } from "@/components/ace/store";
import { spotsFor } from "@/components/ace/spots";
import { tap, type TapOption } from "@/lib/engine";

// The Monte Card, simulated. One card in Apple Pay; at the tap, the authorization request
// (merchant, category code, amount, place) reaches Monte, and the real engine picks which of
// your cards should pay. Everything after the request is the engine's actual output. The
// request itself is made up, because no real card exists: see <WhyNotRealCard> for why.

type Spot = { merchant: string; category: string; amount: number; where: string; mcc: string; mccName: string };

const BASE: Spot[] = [
  { merchant: "Trader Joe's", category: "groceries", amount: 64.2, where: "Los Feliz, CA", mcc: "5411", mccName: "Grocery Stores, Supermarkets" },
  { merchant: "Sweetgreen", category: "dining", amount: 16.5, where: "Silver Lake, CA", mcc: "5812", mccName: "Eating Places, Restaurants" },
  { merchant: "Mobil", category: "gas", amount: 52, where: "Sunset Blvd, CA", mcc: "5541", mccName: "Service Stations" },
  { merchant: "Uber", category: "rideshare", amount: 22.4, where: "Los Angeles, CA", mcc: "4121", mccName: "Taxicabs, Limousines" },
  { merchant: "Delta", category: "airfare", amount: 318, where: "online", mcc: "3058", mccName: "Delta Air Lines" },
  { merchant: "CVS Pharmacy", category: "drugstores", amount: 23.8, where: "Vermont Ave, CA", mcc: "5912", mccName: "Drug Stores, Pharmacies" },
];

type Phase = "idle" | "request" | "ranking" | "done";

/** Runs f once and returns its result with how long it took, in ms. Called from a click. */
function timed<T>(f: () => T): [T, number] {
  const t0 = performance.now();
  const out = f();
  return [out, performance.now() - t0];
}

export function MonteCardDemo() {
  const { wallet, txns, persona, valuation } = useAce();
  const SPOTS = useMemo(() => spotsFor(BASE, txns, "Los Angeles, CA"), [txns]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [res, setRes] = useState<{ ranked: TapOption[]; pick: TapOption; ms: number } | null>(null);
  const timers = useRef<number[]>([]);
  const spot = SPOTS[Math.min(i, SPOTS.length - 1)];

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = (k: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    k = Math.min(k, SPOTS.length - 1);
    setI(k);
    const s = SPOTS[k];
    const history = txns.filter((t) => t.date >= "2026-10-01");
    const [out, ms] = timed(() => tap(wallet, { date: "2026-10-18", merchant: s.merchant, category: s.category, amount: s.amount }, history));
    setRes({ ranked: out.ranked, pick: out.pick, ms });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setPhase("done");
    setPhase("request");
    timers.current.push(window.setTimeout(() => setPhase("ranking"), 900));
    timers.current.push(window.setTimeout(() => setPhase("done"), 1600));
  };
  // open on the first tap's result instead of an empty pane (UI session, audit #15)
  useEffect(() => {
    const id = window.setTimeout(() => run(0), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a new person or point value: re-run the request shown, so the ranking is never someone else's
  useEffect(() => {
    if (phase === "idle") return;
    const id = window.setTimeout(() => run(i), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, valuation]);

  const shown = phase !== "idle";
  const pick = res?.pick;

  return (
    <div className="m-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-m-line px-5 py-3">
        <span className="m-label">monte card · simulated authorization</span>
        <span className="m-mono rounded-full px-2.5 py-0.5 text-[11px] text-m-slate" style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}>
          simulation · no real card
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left: the one card and where you are */}
        <div className="flex flex-col gap-6 border-b border-m-line p-6 md:border-b-0 md:border-r">
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="m-panel-ink relative flex aspect-[1.586/1] flex-col justify-between rounded-[16px] p-5">
              <div className="flex items-start justify-between">
                <span className="m-label" style={{ color: "#c3cbff" }}>
                  monte card
                </span>
                <span className="m-mono text-[10px] text-[#c3cbff]">virtual</span>
              </div>
              <span className="dark">
                <MonteMark size={34} />
              </span>
            </div>
            <AnimatePresence>
              {phase === "done" && pick && (
                <motion.div
                  key={pick.cardId + i}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 14 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute -bottom-8 right-[-8%] w-[44%]"
                >
                  <CardArt id={pick.cardId} size="sm" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="m-mono mt-4 text-center text-[11px] text-m-slate">one card in Apple Pay · charges your best card</p>
          <div>
            <div className="m-label mb-2">the store</div>
            <div className="flex flex-wrap gap-2">
              {SPOTS.map((s, k) => (
                <button
                  key={s.merchant}
                  type="button"
                  onClick={() => run(k)}
                  aria-pressed={k === i && shown}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    k === i && shown ? "bg-m-ink text-m-on-ink" : "text-m-ink hover:bg-m-wash"
                  }`}
                  style={k === i && shown ? undefined : { boxShadow: "0 0 0 1px var(--m-line-strong)" }}
                >
                  <MerchantLogo name={s.merchant} size={16} />
                  {s.merchant}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => run(i)}
            className="m-mono self-start whitespace-nowrap rounded-full bg-m-accent px-5 py-2.5 text-sm text-white"
          >
            [ tap to pay at {spot.merchant} ]
          </button>
        </div>

        {/* right: what Monte receives, and what it decides */}
        <div className="m-mono min-h-[420px] min-w-0 break-words p-6 text-[13px] leading-[1.7]">
          {!shown && (
            <div className="flex h-full flex-col items-start justify-center gap-4 text-m-slate">
              <span className="m-display text-5xl text-m-accent">[ ]</span>
              <p className="m-body max-w-sm text-sm">
                Pick a place and tap. You&apos;ll see the request the card network would send Monte, and the card Monte&apos;s engine would charge.
              </p>
            </div>
          )}

          {shown && res && (
            <div key={`${i}-${res.ms}`} className="space-y-5">
              <div>
                <div className="m-label mb-1.5">1 · authorization request</div>
                {[
                  ["merchant", spot.merchant.toUpperCase()],
                  ["store code", `${spot.mcc} · ${spot.mccName}`],
                  ["amount", money(spot.amount, { cents: true })],
                  ["location", spot.where],
                  ["card", "Monte Card (virtual)"],
                ].map(([k, v], n) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: n * 0.12, duration: 0.3 }}
                    className="grid grid-cols-[90px_1fr] gap-3"
                  >
                    <span className="text-m-slate">{k}</span>
                    <span className="text-m-ink">{v}</span>
                  </motion.div>
                ))}
              </div>

              <div>
                <div className="m-label mb-1.5">2 · ranking {nameOf(persona).whose} cards</div>
                {phase === "request" && <span>waiting for the request…</span>}
                {phase === "ranking" && <Sampler label={`Ranking ${nameOf(persona).whose} cards`} className="text-xl" />}
                {phase === "done" &&
                  res.ranked.map((r, n) => (
                    <motion.div
                      key={r.cardId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: n * 0.08 }}
                      className={`grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] items-baseline gap-x-4 ${r.blocked ? "line-through" : ""}`}
                    >
                      <span className={r.cardId === pick?.cardId ? "text-m-ink" : "text-m-slate"}>
                        {r.cardId === pick?.cardId ? "→ " : "  "}
                        {shortName(r.cardId)}
                        {r.blocked && <span className="font-semibold"> · skipped: carries a balance</span>}
                      </span>
                      <span className="text-m-slate">{r.rule}</span>
                      <span className={r.reward > 0 && !r.blocked ? "m-gain" : ""}>{money(r.reward, { cents: true, sign: true })}</span>
                    </motion.div>
                  ))}
              </div>

              <div>
                <div className="m-label mb-1.5">3 · decision</div>
                {phase !== "done" ? (
                  <Bracketed state="computing">···</Bracketed>
                ) : (
                  pick && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                      <div className="m-display text-2xl text-m-ink">
                        Charge <Bracketed>{nick(pick.cardId)}</Bracketed>{" "}
                        <span className="m-num m-gain">{money(pick.reward, { cents: true, sign: true })}</span>
                      </div>
                      <div className="text-m-slate">
                        approved · engine decided in {res.ms < 1 ? res.ms.toFixed(2) : res.ms.toFixed(1)} ms · a card company allows about 2 seconds to approve
                      </div>
                    </motion.div>
                  )
                )}
              </div>

              {phase === "done" && (
                <HandNote dir="up-left" width={260} delay={0.3}>
                  the request is made up. the pick is the real engine on {nameOf(persona).whose} cards
                </HandNote>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const WHY = [
  {
    t: "The bonus disappears",
    d: "Card rewards follow the store's category code. Trader Joe's charges carry 5411, so a grocery card pays 4×. If Monte paid Trader Joe's and then charged your Amex, Amex would see a charge from Monte, not a grocery store, and pay the base rate. That undoes the reason to pick a card.",
  },
  {
    t: "It can count as a cash advance",
    d: "Some card companies treat loading money into another card or wallet as a cash advance: a fee up front and interest from the first day, with no grace period.",
  },
  {
    t: "The money runs backwards",
    d: "Monte would pay roughly 2–3% in card fees every time it charged your real card, and earn less than that from the store's side of the Monte Card purchase. Every tap would lose money.",
  },
  {
    t: "It takes a bank and months",
    d: "Issuing a card needs a partner bank, approval from Visa or Mastercard, and identity checks on every user. Curve runs this model in the UK and Europe, and card companies have pushed back on it, some by blocking it.",
  },
];

const INSTEAD = [
  { when: "Before you tap", what: "Monte shows the right card for the place you're at, so you pick it in Apple Pay." },
  { when: "After you tap", what: "Every purchase gets a verdict: right card, or what the right one would have earned." },
  { when: "Once a year", what: "Monte replays the year to show what each card really cost, and whether to keep it." },
];

/** The honest part: why the Monte Card is a simulation, and what Monte does today. */
export function WhyNotRealCard() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="m-panel p-6">
        <div className="m-label">why it&apos;s a simulation</div>
        <h3 className="m-display mt-2 text-3xl">
          Monte can pick the card. <span className="m-second">It can&apos;t pay with it yet.</span>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-m-slate">
          No app can choose the card inside Apple Pay or Google Wallet. Only you can. The workaround is one Monte card that charges your best card behind the
          scenes, and that breaks in four places:
        </p>
        <ol className="mt-5 space-y-4">
          {WHY.map((w, n) => (
            <li key={w.t} className="grid grid-cols-[28px_1fr] gap-2">
              <span className="m-num text-m-accent">{String(n + 1).padStart(2, "0")}</span>
              <div>
                <div className="font-medium">{w.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-m-slate">{w.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="m-mono mt-6 rounded-[10px] bg-m-wash p-4 text-[12px] leading-[1.8]">
          <div className="m-label mb-1">for example, with an Amex Gold</div>
          <div>
            <span className="text-m-slate">you tap  </span>Trader Joe&apos;s · mcc <span className="text-m-ink">5411</span> → Monte Card
          </div>
          <div>
            <span className="text-m-slate">monte    </span>charges Amex Gold · merchant <span className="text-m-ink">MONTE</span> · not 5411
          </div>
          <div>
            <span className="text-m-slate">amex     </span>sees no grocery store → <span className="font-semibold underline">1× instead of 4×</span>
          </div>
        </div>
      </div>

      <div className="m-panel-ink flex flex-col p-6">
        <div className="m-label" style={{ color: "#c3cbff" }}>
          what monte does instead
        </div>
        <h3 className="m-display mt-2 text-3xl">
          You tap the card. <span style={{ color: "#c3cbff" }}>Monte makes sure it&apos;s the right one.</span>
        </h3>
        <ul className="mt-6 space-y-5">
          {INSTEAD.map((x) => (
            <li key={x.when} className="grid grid-cols-[120px_1fr] gap-3 border-t border-white/10 pt-4">
              <span className="m-label" style={{ color: "#c3cbff" }}>
                {x.when}
              </span>
              <span className="text-[15px] leading-relaxed">{x.what}</span>
            </li>
          ))}
        </ul>
              </div>
    </div>
  );
}
