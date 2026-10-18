"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bracketed } from "@/components/brand";
import { tap } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { CardArt, CardMini, shortName } from "./card-art";
import { MerchantLogo } from "./merchant-logo";
import { money, nameOf, useAce } from "./store";
import { spotsFor } from "./spots";

// The tap, played out: a phone meets the store's reader and every step Monte takes is shown
// beside it. The numbers are the engine's own `tap()` on the selected person's wallet.

const BASE = [
  { merchant: "Trader Joe's", category: "groceries", amount: 64.2, where: "Los Feliz", mcc: "5411" },
  { merchant: "Sweetgreen", category: "dining", amount: 16.5, where: "Silver Lake", mcc: "5812" },
  { merchant: "Mobil", category: "gas", amount: 52, where: "Sunset Blvd", mcc: "5541" },
  { merchant: "Uber", category: "rideshare", amount: 22.4, where: "to LAX", mcc: "4121" },
  { merchant: "Delta", category: "airfare", amount: 318, where: "LAX → JFK", mcc: "3058" },
  { merchant: "CVS Pharmacy", category: "drugstores", amount: 23.8, where: "Vermont Ave", mcc: "5912" },
  { merchant: "AMC Theatres", category: "entertainment", amount: 34, where: "The Grove", mcc: "7832" },
];

const STEPS = [
  { k: "read", t: "The reader sends the store code" },
  { k: "wallet", t: "Monte opens your wallet" },
  { k: "caps", t: "It counts what this month already used" },
  { k: "rank", t: "It ranks every card for this purchase" },
  { k: "pay", t: "It pays with the winner" },
] as const;

// phase: -1 waiting for a tap, 0..4 the steps above, 5 paid
const STEP_MS = 1500;

export function TapDemo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("monte:tapdemo", on);
    // a link straight to the demo (?tap or #tap-demo) opens it once the page is up
    if (/[?&]tap(=|&|$)/.test(window.location.search) || window.location.hash === "#tap-demo") window.setTimeout(on, 0);
    return () => window.removeEventListener("monte:tapdemo", on);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[75] flex items-center gap-2 rounded-full bg-ace-ink px-4 py-2.5 text-sm font-medium text-ace-bg shadow-[0_12px_30px_-12px_rgba(12,14,20,.6)] transition hover:scale-[1.03]"
        aria-label="Open the tap-to-pay demo"
      >
        <Contactless className="h-4 w-4" />
        Try tap to pay
      </button>
      <AnimatePresence>{open && <Dashboard onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Dashboard({ onClose }: { onClose: () => void }) {
  const { wallet, txns, persona, valuation } = useAce();
  const nm = nameOf(persona);
  const spots = useMemo(() => spotsFor(BASE, txns, "Los Angeles"), [txns]);
  const [i, setI] = useState(0);
  const spot = spots[Math.min(i, spots.length - 1)];
  const [phase, setPhase] = useState(-1);
  const [auto, setAuto] = useState(true);
  const timer = useRef(0);

  const history = useMemo(() => txns.filter((t) => t.date >= "2026-10-01"), [txns]);
  const res = useMemo(
    () => tap(wallet, { date: "2026-10-18", merchant: spot.merchant, category: spot.category, amount: spot.amount }, history),
    // valuation is read inside the engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, spot, history, valuation],
  );
  const pick = res.pick;
  // the card this person reaches for most often, to show what the tap changed
  const usual = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of txns) if (wallet.some((h) => h.cardId === t.cardUsed)) n.set(t.cardUsed, (n.get(t.cardUsed) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? wallet[0]?.cardId;
  }, [txns, wallet]);
  const usualOpt = res.ranked.find((x) => x.cardId === usual);
  const gain = usualOpt ? pick.reward - usualOpt.reward : 0;
  const maxReward = Math.max(0.01, ...res.ranked.map((x) => x.reward));
  const offLimits = wallet.filter((h) => (h.balance ?? 0) > 0);
  const summary: Record<(typeof STEPS)[number]["k"], string> = {
    read: `${spot.mcc} · ${spot.category.replace(/_/g, " ")} · ${money(spot.amount, { cents: true })}`,
    wallet: `${wallet.length - offLimits.length} of ${wallet.length} cards eligible`,
    caps: `${history.length} purchases replayed`,
    rank: `${shortName(pick.cardId)} first`,
    pay: `+${money(pick.reward, { cents: true })}`,
  };

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setPhase(-1);
  }, []);

  // auto-play walks the steps; step-by-step waits for "Next"
  useEffect(() => {
    if (!auto || phase < 0 || phase >= 5) return;
    timer.current = window.setTimeout(() => setPhase((p) => p + 1), phase === 0 ? 1100 : STEP_MS);
    return () => clearTimeout(timer.current);
  }, [phase, auto]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.key === " " || e.key === "Enter") && phase === -1) {
        e.preventDefault();
        setPhase(0);
      }
      if (e.key === "ArrowRight" && phase >= 0 && phase < 5) setPhase((p) => p + 1);
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [onClose, phase]);

  const pickStore = (k: number) => {
    setI(k);
    reset();
  };

  const tapped = phase >= 0;
  const ranking = phase === 3;
  const picked = phase >= 4;
  const paid = phase >= 5;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[rgba(12,14,20,.55)] p-3 backdrop-blur-sm md:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Tap to pay demo"
    >
      <motion.div
        className="relative my-auto w-full max-w-6xl overflow-hidden rounded-[22px] bg-ace-bg shadow-[0_40px_120px_-30px_rgba(12,14,20,.7)] ring-1 ring-ace-line"
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        {/* top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-ace-line bg-ace-panel px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ace-ink text-ace-bg">
              <Contactless className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight">Tap to pay, step by step</div>
              <div className="mono text-[11px] text-ace-dim">
                {nm.whose} wallet · {wallet.length} cards · simulated reader, real card rules
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mono hidden items-center gap-1 rounded-md border border-ace-line p-0.5 text-[11px] sm:flex" role="radiogroup" aria-label="Playback">
              {[
                { v: true, l: "auto" },
                { v: false, l: "step by step" },
              ].map((o) => (
                <button
                  key={o.l}
                  role="radio"
                  aria-checked={auto === o.v}
                  onClick={() => setAuto(o.v)}
                  className={`rounded px-2 py-1 ${auto === o.v ? "bg-ace-ink text-ace-bg" : "text-ace-dim hover:text-ace-ink"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="rounded-md px-2 py-1 text-xl leading-none text-ace-dim hover:bg-ace-line/40 hover:text-ace-ink" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {/* store picker */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-ace-line px-5 py-3">
          <span className="mono mr-1 self-center text-[11px] uppercase tracking-[0.18em] text-ace-dim">You&apos;re at</span>
          {spots.map((s, k) => (
            <button
              key={s.merchant}
              onClick={() => pickStore(k)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                k === i ? "bg-ace-ink text-ace-bg" : "bg-ace-panel shadow-[0_0_0_1px_var(--m-line)] hover:shadow-[0_0_0_1px_var(--m-line-strong)]"
              }`}
            >
              <MerchantLogo name={s.merchant} size={18} className="rounded-[5px]" />
              {s.merchant}
            </button>
          ))}
        </div>

        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] lg:gap-8">
          {/* the scene: reader + phone */}
          <div className="relative flex flex-col items-center rounded-2xl bg-[#e9ebef] px-4 pb-4 pt-4 ring-1 ring-ace-line">
            <Reader merchant={spot.merchant} amount={spot.amount} mcc={spot.mcc} tapped={tapped} paid={paid} />
            <motion.div
              className="relative z-10 -mt-2"
              animate={tapped && !paid ? { y: -40, rotate: -4 } : { y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              <Phone
                wallet={wallet.map((h) => h.cardId)}
                ranked={res.ranked.map((x) => x.cardId)}
                pick={pick.cardId}
                reward={pick.reward}
                phase={phase}
              />
            </motion.div>
            <div className="mt-4 flex w-full max-w-[300px] flex-col items-stretch gap-2">
              {phase === -1 && (
                <motion.button
                  onClick={() => setPhase(0)}
                  className="btn btn-primary w-full justify-center py-3 text-base"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                >
                  <Contactless className="mr-2 h-4 w-4" /> Tap phone on the reader
                </motion.button>
              )}
              {tapped && !paid && !auto && (
                <button onClick={() => setPhase((p) => p + 1)} className="btn btn-primary w-full justify-center py-3">
                  Next step →
                </button>
              )}
              {tapped && !paid && auto && (
                <div className="mono py-3 text-center text-xs text-ace-dim">
                  <Bracketed state="computing">step {phase + 1} of 5</Bracketed>
                </div>
              )}
              {paid && (
                <div className="flex gap-2">
                  <button onClick={reset} className="btn btn-ghost flex-1 justify-center py-3">
                    Tap again
                  </button>
                  <button onClick={() => pickStore((i + 1) % spots.length)} className="btn btn-primary flex-1 justify-center py-3">
                    Next store →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* the why */}
          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">What happens in the half-second</div>
              {tapped && (
                <button onClick={reset} className="mono text-[11px] text-ace-dim underline hover:text-ace-ink">
                  restart
                </button>
              )}
            </div>
            <ol className="space-y-2.5">
              {STEPS.map((s, k) => {
                const state = phase > k || paid ? "done" : phase === k ? "now" : "todo";
                // the step being explained is open; finished ones fold to a line (all but rank and pay once paid)
                const expanded = state === "now" || (paid && (s.k === "rank" || s.k === "pay"));
                return (
                  <li
                    key={s.k}
                    className={`rounded-xl p-4 transition ${
                      state === "now"
                        ? "bg-ace-panel shadow-[0_0_0_1.5px_var(--m-ink)]"
                        : state === "done"
                          ? "bg-ace-panel shadow-[0_0_0_1px_var(--m-line)]"
                          : "bg-transparent shadow-[0_0_0_1px_var(--m-line)] opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          state === "done" ? "bg-ace-gain text-white" : state === "now" ? "bg-ace-ink text-ace-bg" : "bg-ace-line text-ace-dim"
                        }`}
                      >
                        {state === "done" ? "✓" : k + 1}
                      </span>
                      <span className="text-[15px] font-medium">{s.t}</span>
                      {state === "done" && !expanded && <span className="mono ml-auto truncate pl-2 text-[11px] text-ace-dim">{summary[s.k]}</span>}
                    </div>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-9"
                        >
                          <div className="pt-2.5 text-sm leading-relaxed text-ace-dim">
                            {s.k === "read" && (
                              <>
                                <div className="mono flex flex-wrap gap-1.5 text-[12px] text-ace-ink">
                                  <Chip>{spot.merchant}</Chip>
                                  <Chip>store code {spot.mcc}</Chip>
                                  <Chip>{spot.category.replace(/_/g, " ")}</Chip>
                                  <Chip>{money(spot.amount, { cents: true })}</Chip>
                                </div>
                                <p className="mt-2">Every card reader sends a four-digit merchant code. That code, not the store&apos;s name, decides which reward category a card pays.</p>
                              </>
                            )}
                            {s.k === "wallet" && (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  {wallet.map((h) => (
                                    <span
                                      key={h.cardId}
                                      className={`flex items-center gap-2 rounded-lg bg-ace-bg px-2 py-1 text-[13px] text-ace-ink ring-1 ring-ace-line ${h.balance ? "opacity-60" : ""}`}
                                    >
                                      <CardMini id={h.cardId} width={28} />
                                      {shortName(h.cardId)}
                                      {h.balance ? <span className="mono text-[11px] text-ace-loss">off limits</span> : null}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-2">
                                  {offLimits.length
                                    ? `${offLimits.map((h) => shortName(h.cardId)).join(" and ")} carries a balance, so Monte never routes a purchase there: new spending would charge interest from today.`
                                    : "Every card is paid in full, so all of them can compete."}
                                </p>
                              </>
                            )}
                            {s.k === "caps" && (
                              <>
                                <p>
                                  Monte replays {history.length} purchase{history.length === 1 ? "" : "s"} since 1 Oct on the best cards, so a spending cap
                                  that&apos;s already filled this month stops counting at the bonus rate.
                                </p>
                                {res.capNotes.map((n) => (
                                  <p key={n} className="mt-1.5 text-ace-ink">
                                    {n}
                                  </p>
                                ))}
                              </>
                            )}
                            {s.k === "rank" && (
                              <div className="space-y-1.5">
                                {res.ranked.map((x, r) => (
                                  <div key={x.cardId} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[175px_1fr_auto]">
                                    <span className={`truncate ${x.blocked ? "line-through" : "text-ace-ink"}`}>{shortName(x.cardId)}</span>
                                    <span className="h-2.5 overflow-hidden rounded-full bg-ace-line/60">
                                      <motion.span
                                        className={`block h-full rounded-full ${x.blocked ? "bg-ace-loss/50" : x.cardId === pick.cardId ? "bg-ace-gain" : "bg-ace-dim/40"}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(x.reward / maxReward) * 100}%` }}
                                        transition={{ delay: r * 0.12, duration: 0.5 }}
                                      />
                                    </span>
                                    <span className={`mono text-right ${x.cardId === pick.cardId ? "font-semibold text-ace-gain" : ""}`}>
                                      {x.mult.toFixed(x.mult % 1 ? 1 : 0)}× · {money(x.reward, { cents: true })}
                                    </span>
                                  </div>
                                ))}
                                <p className="pt-1">
                                  Each card&apos;s rules come from its issuer&apos;s terms ({new URL(card(pick.cardId).source_urls[0] ?? "https://example.com").hostname}
                                  {" "}for the winner). The math is the engine&apos;s, not an AI&apos;s.
                                </p>
                              </div>
                            )}
                            {s.k === "pay" && (
                              <>
                                <div className="flex items-center gap-3">
                                  <CardMini id={pick.cardId} width={44} />
                                  <div>
                                    <div className="text-[15px] font-semibold text-ace-ink">{shortName(pick.cardId)}</div>
                                    <div className="mono text-[12px]">{pick.rule}</div>
                                  </div>
                                  <div className="ml-auto text-right">
                                    <div className="text-2xl text-ace-gain" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
                                      +{money(pick.reward, { cents: true })}
                                    </div>
                                    <div className="mono text-[11px]">earned</div>
                                  </div>
                                </div>
                                <p className="mt-2">
                                  {usual && usual !== pick.cardId && gain > 0.004
                                    ? `${nm.Who} usually reaches for the ${shortName(usual)}${usualOpt?.blocked ? ", which carries a balance" : ""}. This tap earns ${money(gain, { cents: true })} more, with nothing to remember.`
                                    : usual === pick.cardId
                                      ? `That's the card ${nm.who} usually reaches for, and here it's the right one.`
                                      : "The phone hands this card to the reader. Nothing to remember at the register."}
                                </p>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
            {ranking || picked ? null : phase === -1 ? (
              <p className="mono mt-4 text-[11px] text-ace-dim">Press the button or the space bar to tap. Pick another store above to try it there.</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-ace-bg px-2 py-0.5 ring-1 ring-ace-line">{children}</span>;
}

/** The store's card reader: amount on its screen, contactless mark, a ring when the phone is near. */
function Reader({ merchant, amount, mcc, tapped, paid }: { merchant: string; amount: number; mcc: string; tapped: boolean; paid: boolean }) {
  return (
    <div className="relative z-0 w-[230px] rounded-[20px] bg-[#1b1e25] p-2.5 pb-3 shadow-[0_20px_40px_-20px_rgba(12,14,20,.6)]">
      <div className="rounded-xl bg-[#0f1116] px-3 py-2.5 text-center">
        <AnimatePresence mode="wait">
          {paid ? (
            <motion.div key="ok" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#22c55e] text-lg font-bold text-white">✓</div>
              <div className="mono mt-1.5 text-[11px] uppercase tracking-[0.2em] text-[#9ef0b8]">Approved</div>
            </motion.div>
          ) : (
            <motion.div key={merchant} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mono truncate text-[10px] uppercase tracking-[0.2em] text-[#8a93a6]">
                {merchant} · {mcc}
              </div>
              <div className="mono mt-1 text-2xl text-white">{money(amount, { cents: true })}</div>
              <div className="mono mt-0.5 text-[10px] text-[#8a93a6]">{tapped ? "reading…" : "tap to pay"}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative mx-auto mt-2 flex h-9 w-9 items-center justify-center">
        {tapped && !paid &&
          [0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute inset-0 rounded-full border-2 border-[#7aa7ff]"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, delay: k * 0.5 }}
            />
          ))}
        <Contactless className="h-6 w-6 text-white/80" />
      </div>
    </div>
  );
}

/** The phone: the wallet fans, shuffles while ranking, then the winner rises and pays. */
function Phone({ wallet, ranked, pick, reward, phase }: { wallet: string[]; ranked: string[]; pick: string; reward: number; phase: number }) {
  const status =
    phase < 0
      ? "Hold near reader"
      : phase === 0
        ? "Reading the terminal"
        : phase === 1
          ? "Opening your wallet"
          : phase === 2
            ? "Checking this month's caps"
            : phase === 3
              ? "Ranking your cards"
              : phase === 4
                ? "Paying with"
                : "Paid";
  const shuffling = phase >= 1 && phase <= 3;
  return (
    <div className="relative h-[372px] w-[214px] rounded-[38px] border border-ace-line bg-[#d9dce2] p-2.5 shadow-[0_30px_60px_-30px_rgba(12,14,20,.45)]">
      <div className="absolute left-1/2 top-4 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0c0e14]" />
      <div className="relative h-full overflow-hidden rounded-[32px] bg-ace-panel px-3 pt-11 ring-1 ring-ace-line">
        <div className="mono text-center text-[10px] uppercase tracking-[0.22em] text-ace-dim">Monte</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-1 text-center text-[15px] font-semibold"
          >
            {status}
          </motion.div>
        </AnimatePresence>
        <div className="relative mt-3 h-[190px]">
          {wallet.map((id, k) => {
            const isPick = id === pick;
            const r = Math.max(0, ranked.indexOf(id));
            const n = wallet.length;
            const settled = phase >= 4;
            // idle: a neat stack; ranking: cards jostle; settled: the winner lifts out on top
            const y = settled ? (isPick ? 0 : 96 + r * 9) : shuffling ? 20 + ((k + phase) % n) * 24 : 30 + k * 20;
            const rotate = settled ? (isPick ? 0 : (r % 2 ? 3 : -3)) : shuffling ? ((k + phase) % 2 ? 4 : -4) : 0;
            return (
              <motion.div
                key={id}
                className="absolute inset-x-0 mx-auto w-[176px]"
                animate={{ y, rotate, scale: settled && !isPick ? 0.86 : 1, zIndex: settled ? (isPick ? 30 : 20 - r) : shuffling ? ((k + phase) % n) : k }}
                transition={{ type: "spring", stiffness: 160, damping: 17 }}
              >
                <CardArt id={id} size="sm" dim={settled && !isPick} />
              </motion.div>
            );
          })}
        </div>
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-3 bottom-4 z-40 rounded-2xl bg-ace-panel p-3 shadow-[0_0_0_1px_var(--m-line-strong),0_10px_24px_-14px_rgba(12,14,20,.4)]"
            >
              <div className="truncate text-[13px] font-semibold">{shortName(pick)}</div>
              <div className="text-2xl text-ace-gain" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
                +{money(reward, { cents: true })}
              </div>
              <div className="mono text-[10px] text-ace-dim">{phase >= 5 ? "earned · paid in full" : "best card for this purchase"}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Contactless({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M8.5 9.5a4 4 0 0 1 0 5" />
      <path d="M12 7a7.5 7.5 0 0 1 0 10" />
      <path d="M15.5 4.5a11 11 0 0 1 0 15" />
      <path d="M5 11.2a1.2 1.2 0 0 1 0 1.6" />
    </svg>
  );
}
