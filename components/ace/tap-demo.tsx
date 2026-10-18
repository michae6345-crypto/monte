"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Arrow } from "@/components/brand";
import { tap } from "@/lib/engine";
import { CardArt, CardMini, shortName } from "./card-art";
import { MerchantLogo } from "./merchant-logo";
import { money, nameOf, useAce } from "./store";
import { spotsFor } from "./spots";

// The tap, played out on one stage: the store's reader and the phone in the middle, each step
// Monte takes marked beside them with a pencil arrow and a few words. The numbers are the
// engine's own `tap()` on the selected person's wallet.

const BASE = [
  { merchant: "Trader Joe's", category: "groceries", amount: 64.2, where: "Los Feliz", mcc: "5411" },
  { merchant: "Sweetgreen", category: "dining", amount: 16.5, where: "Silver Lake", mcc: "5812" },
  { merchant: "Mobil", category: "gas", amount: 52, where: "Sunset Blvd", mcc: "5541" },
  { merchant: "Uber", category: "rideshare", amount: 22.4, where: "to LAX", mcc: "4121" },
  { merchant: "Delta", category: "airfare", amount: 318, where: "LAX → JFK", mcc: "3058" },
  { merchant: "CVS Pharmacy", category: "drugstores", amount: 23.8, where: "Vermont Ave", mcc: "5912" },
  { merchant: "AMC Theatres", category: "entertainment", amount: 34, where: "The Grove", mcc: "7832" },
];

// side: where the step's note sits, so the notes alternate around the phone
const STEPS = [
  { k: "read", t: "reader sends the store code", short: "Store code", side: "right" },
  { k: "wallet", t: "opens your wallet", short: "Wallet", side: "left" },
  { k: "caps", t: "counts this month's caps", short: "Caps", side: "right" },
  { k: "rank", t: "ranks every card", short: "Rank", side: "left" },
  { k: "pay", t: "pays with the winner", short: "Pay", side: "right" },
] as const;
type StepKey = (typeof STEPS)[number]["k"];

// phase: -1 waiting for a tap, 0..4 the steps above, 5 paid. Nothing is timed: the presenter
// moves it on, so each step stays up as long as it takes to explain.

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

/** The reader's approval beep: two short tones, quiet. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.14].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1760;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.11);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.12);
    });
    window.setTimeout(() => ctx.close(), 600);
  } catch {}
}

function Dashboard({ onClose }: { onClose: () => void }) {
  const { wallet, txns, persona, valuation, r: year } = useAce();
  const nm = nameOf(persona);
  const spots = useMemo(() => spotsFor(BASE, txns, "Los Angeles"), [txns]);
  const [i, setI] = useState(0);
  const spot = spots[Math.min(i, spots.length - 1)];
  const [phase, setPhase] = useState(-1);

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
  const maxReward = Math.max(0.01, ...res.ranked.map((x) => x.reward));
  const offLimits = wallet.filter((h) => (h.balance ?? 0) > 0);
  const summary: Record<StepKey, string> = {
    read: `${spot.mcc} · ${spot.category.replace(/_/g, " ")}`,
    wallet: `${wallet.length - offLimits.length} of ${wallet.length} can play`,
    caps: `${history.length} purchases`,
    rank: shortName(pick.cardId),
    pay: `+${money(pick.reward, { cents: true })}`,
  };

  const reset = useCallback(() => setPhase(-1), []);
  const start = useCallback(() => setPhase(0), []);
  const next = useCallback(() => setPhase((p) => Math.min(5, p + 1)), []);
  const back = useCallback(() => setPhase((p) => Math.max(0, p - 1)), []);

  // the beep, once, when the reader approves
  const beeped = useRef(false);
  useEffect(() => {
    if (phase >= 5 && !beeped.current) {
      beeped.current = true;
      beep();
    }
    if (phase < 5) beeped.current = false;
  }, [phase]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === -1 || phase >= 5) start();
        else next();
      } else if (e.key === "ArrowRight") {
        if (phase === -1) start();
        else next();
      } else if (e.key === "ArrowLeft" && phase > 0) back();
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [onClose, phase, start, next, back]);

  const pickStore = (k: number) => {
    setI(k);
    reset();
  };

  const tapped = phase >= 0;
  const paid = phase >= 5;

  // each step's note: a few words and the one thing worth pointing at
  const body: Record<StepKey, ReactNode> = {
    read: (
      <div className="mono flex flex-wrap items-center gap-1.5 text-[12px] text-ace-ink">
        <Chip strong>{spot.mcc}</Chip>
        <span className="text-ace-dim">→</span>
        <Chip>{spot.category.replace(/_/g, " ")}</Chip>
        <Chip>{money(spot.amount, { cents: true })}</Chip>
      </div>
    ),
    wallet: (
      <div className="flex flex-wrap gap-2.5">
        {wallet.map((h) => (
          <div key={h.cardId} className="flex flex-col items-center gap-1">
            <span className={h.balance ? "opacity-40 grayscale" : ""}>
              <CardMini id={h.cardId} width={46} />
            </span>
            <span className={`mono text-[10px] ${h.balance ? "text-ace-loss" : "text-ace-gain"}`}>{h.balance ? "✕ balance" : "✓"}</span>
          </div>
        ))}
      </div>
    ),
    caps: (
      <div className="flex items-baseline gap-2">
        <span className="text-4xl text-ace-ink" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
          {history.length}
        </span>
        <span className="mono text-[11px] text-ace-dim">purchases this month, replayed</span>
      </div>
    ),
    rank: (
      <div className="w-full max-w-[300px] space-y-1.5">
        {res.ranked.map((x, r) => (
          <div key={x.cardId}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className={`truncate ${x.blocked ? "text-ace-dim line-through" : "text-ace-ink"}`}>{shortName(x.cardId)}</span>
              <span className={`mono shrink-0 ${x.cardId === pick.cardId ? "font-semibold text-ace-gain" : "text-ace-dim"}`}>{money(x.reward, { cents: true })}</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ace-line/60">
              <motion.div
                className={`h-full rounded-full ${x.blocked ? "bg-ace-loss/45" : x.cardId === pick.cardId ? "bg-ace-gain" : "bg-ace-dim/40"}`}
                initial={{ width: 0 }}
                animate={{ width: `${(x.reward / maxReward) * 100}%` }}
                transition={{ delay: 0.3 + r * 0.35, duration: 0.7 }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
    pay: (
      <div>
        <div className="flex items-center gap-2.5">
          <CardMini id={pick.cardId} width={46} />
          <span className="text-3xl text-ace-gain" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            +{money(pick.reward, { cents: true })}
          </span>
        </div>
        {usualOpt && usual !== pick.cardId && (
          <div className="mono mt-1.5 text-[11px] text-ace-dim">
            {nm.whose} usual card: {money(usualOpt.reward, { cents: true })}
          </div>
        )}
        {paid && year.leftOnTable > 0 && (
          <div className="mono mt-0.5 text-[11px] text-ace-dim">
            every tap right, last year: <span className="text-ace-gain">+{money(year.leftOnTable)}</span>
          </div>
        )}
      </div>
    ),
  };

  const notes = (side: "left" | "right") => (
    <div className={`flex min-h-0 flex-col justify-center gap-3 ${side === "left" ? "items-end" : "items-start"}`}>
      <AnimatePresence initial={false}>
        {STEPS.map((s, k) => {
          if (s.side !== side) return null;
          const state = paid || phase > k ? "done" : phase === k ? "now" : "todo";
          if (state === "todo") return null;
          // once paid, the last step stays open so the result is on screen
          const open = state === "now" || (paid && s.k === "pay");
          return (
            <motion.div
              key={s.k}
              layout
              initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              className="w-full max-w-[380px]"
            >
              <Note step={k} title={s.t} side={side} open={open} summary={summary[s.k]} onClick={() => setPhase(k)}>
                {body[s.k]}
              </Note>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  const current = phase >= 0 && phase < 5 ? STEPS[phase] : paid ? STEPS[4] : null;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[rgba(12,14,20,.6)] p-2 backdrop-blur-sm md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Tap to pay demo"
    >
      <motion.div
        className="relative my-auto w-full max-w-[1240px] overflow-hidden rounded-[22px] bg-ace-bg shadow-[0_40px_120px_-30px_rgba(12,14,20,.7)] ring-1 ring-ace-line"
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        {/* top bar */}
        <div className="flex items-center gap-3 border-b border-ace-line bg-ace-panel px-4 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ace-ink text-ace-bg">
            <Contactless className="h-4 w-4" />
          </span>
          <div className="min-w-0 shrink-0">
            <div className="text-sm font-semibold leading-tight">Tap to pay</div>
            <div className="mono truncate text-[11px] text-ace-dim">{nm.whose} wallet</div>
          </div>
          <div className="mx-2 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none]">
            {spots.map((s, k) => (
              <button
                key={s.merchant}
                onClick={() => pickStore(k)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition ${
                  k === i ? "bg-ace-ink text-ace-bg" : "bg-ace-bg shadow-[0_0_0_1px_var(--m-line)] hover:shadow-[0_0_0_1px_var(--m-line-strong)]"
                }`}
              >
                <MerchantLogo name={s.merchant} size={16} className="rounded-[4px]" />
                {s.merchant}
              </button>
            ))}
          </div>
          <a href="/dashboard" className="mono hidden shrink-0 text-[11px] text-ace-dim underline hover:text-ace-ink xl:inline">
            every wallet →
          </a>
          <button onClick={onClose} className="shrink-0 rounded-md px-2 py-1 text-xl leading-none text-ace-dim hover:bg-ace-line/40 hover:text-ace-ink" aria-label="Close">
            ×
          </button>
        </div>

        {/* the stage */}
        <div
          className="relative grid gap-4 px-4 py-5 lg:min-h-[580px] lg:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)] lg:gap-6"
          style={{ background: "radial-gradient(60% 70% at 50% 45%, color-mix(in oklab, var(--m-accent) 9%, transparent), transparent 70%)" }}
        >
          <div className="hidden lg:flex lg:flex-col lg:justify-center">{notes("left")}</div>

          <div className="relative flex flex-col items-center">
            <Reader merchant={spot.merchant} amount={spot.amount} phase={phase} />
            <motion.div
              className="relative z-10 -mt-4"
              animate={tapped && !paid ? { y: -34, rotateX: 18, scale: 0.97 } : paid ? { y: -6, rotateX: 0, scale: 1 } : { y: 0, rotateX: 0, scale: 1 }}
              style={{ transformPerspective: 900, transformOrigin: "50% 0%" }}
              transition={{ type: "spring", stiffness: 110, damping: 16 }}
            >
              <Phone wallet={wallet.map((h) => h.cardId)} pick={pick.cardId} reward={pick.reward} phase={phase} />
            </motion.div>
          </div>

          <div className="hidden lg:flex lg:flex-col lg:justify-center">{notes("right")}</div>

          {/* narrow screens: the current step's note under the phone */}
          {current && (
            <div className="lg:hidden">
              <Note step={STEPS.indexOf(current)} title={current.t} side="right" open summary="">
                {body[current.k]}
              </Note>
            </div>
          )}

          {phase === -1 && (
            <div className="pointer-events-none absolute inset-x-0 top-[44%] hidden justify-between px-12 lg:flex">
              <span className="flex items-center gap-1 text-ace-dim">
                <span className="m-note -rotate-2 text-[19px]">at the register</span>
                <Arrow dir="right" className="h-8 w-11" />
              </span>
              <span className="flex items-center gap-1 text-ace-dim">
                <Arrow dir="left" className="h-8 w-11" />
                <span className="m-note rotate-2 text-[19px]">tap to pay</span>
              </span>
            </div>
          )}
        </div>

        {/* timeline + controls */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ace-line bg-ace-panel px-4 py-3">
          <div className="flex items-center gap-1.5">
            {phase === -1 || paid ? (
              <button onClick={start} className="btn btn-primary btn-sm">
                <Contactless className="mr-1.5 h-3.5 w-3.5" /> {paid ? "Tap again" : "Tap"}
              </button>
            ) : (
              <>
                <Ctl label="Back" onClick={back} disabled={phase <= 0}>
                  ‹
                </Ctl>
                <button onClick={next} className="btn btn-primary btn-sm">
                  {phase === 4 ? "Pay" : "Next"} →
                </button>
              </>
            )}
            {paid && (
              <button onClick={() => pickStore((i + 1) % spots.length)} className="btn btn-ghost btn-sm">
                Next store →
              </button>
            )}
          </div>
          <ol className="flex min-w-[260px] flex-1 gap-1.5">
            {STEPS.map((s, k) => {
              const done = paid || phase > k;
              const now = phase === k;
              return (
                <li key={s.k} className="flex-1">
                  <button onClick={() => setPhase(k)} className="group block w-full text-left">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ace-line">
                      {done || now ? <div className={`h-full w-full rounded-full ${done ? "bg-ace-ink" : "bg-ace-gold"}`} /> : null}
                    </div>
                    <div className={`mono mt-1 truncate text-[10px] uppercase tracking-[0.14em] ${now ? "text-ace-ink" : "text-ace-dim group-hover:text-ace-ink"}`}>
                      {String(k + 1).padStart(2, "0")} {s.short}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** One step's mark: a handwritten label and a pencil arrow toward the phone, with the one thing
 *  worth pointing at under it. Folded to a single line once the next step starts. */
function Note({
  step,
  title,
  side,
  open,
  summary,
  onClick,
  children,
}: {
  step: number;
  title: string;
  side: "left" | "right";
  open: boolean;
  summary: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const right = side === "left";
  return (
    <div className={`flex items-center gap-1.5 ${right ? "flex-row" : "flex-row-reverse"}`}>
      <div onClick={open ? undefined : onClick} className={`min-w-0 flex-1 ${right ? "text-right" : "text-left"} ${open ? "" : "cursor-pointer opacity-60 hover:opacity-100"}`}>
        <div className={`flex items-baseline gap-2 ${right ? "justify-end" : ""}`}>
          <span className={`mono shrink-0 text-[11px] ${open ? "text-ace-ink" : "text-ace-gain"}`}>{open ? String(step + 1).padStart(2, "0") : "✓"}</span>
          <span className={`m-note leading-tight text-ace-ink ${open ? "text-[22px]" : "shrink-0 whitespace-nowrap text-[15px]"}`}>{title}</span>
          {!open && summary && <span className="mono min-w-0 truncate text-[11px] text-ace-dim">· {summary}</span>}
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`flex overflow-hidden ${right ? "justify-end" : ""}`}
            >
              <div className="pt-2.5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className={`hidden shrink-0 text-ace-dim lg:block ${open ? "" : "invisible"}`}>
        <Arrow dir={right ? "right" : "left"} className="h-9 w-12" />
      </span>
    </div>
  );
}

function Ctl({ label, onClick, disabled, wide, children }: { label: string; onClick: () => void; disabled?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 ${wide ? "w-11" : "w-8"} items-center justify-center rounded-md bg-ace-bg text-[15px] shadow-[0_0_0_1px_var(--m-line)] transition hover:shadow-[0_0_0_1px_var(--m-line-strong)] disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <span className={`rounded-md px-2 py-0.5 ${strong ? "bg-ace-ink text-ace-bg" : "bg-ace-panel ring-1 ring-ace-line"}`}>{children}</span>;
}

/** A countertop card reader: the four contactless lights light one by one while the phone is
 *  held there, then all four go green with the approval. */
function Reader({ merchant, amount, phase }: { merchant: string; amount: number; phase: number }) {
  const tapped = phase >= 0;
  const paid = phase >= 5;
  const lit = paid ? 4 : tapped ? Math.min(4, phase + 1) : 0;
  return (
    <div className="relative z-0 w-[240px]">
      <div className="rounded-[26px] bg-gradient-to-b from-[#30343d] via-[#1e2128] to-[#14161b] p-3 pb-4 shadow-[0_30px_50px_-24px_rgba(12,14,20,.75),inset_0_1px_0_rgba(255,255,255,.12),inset_0_-2px_0_rgba(0,0,0,.4)]">
        {/* contactless status lights */}
        <div className="mb-2.5 flex justify-center gap-2.5">
          {[0, 1, 2, 3].map((k) => (
            <span
              key={k}
              className="h-1.5 w-5 rounded-full transition-all duration-300"
              style={{
                background: k < lit ? (paid ? "#22c55e" : "#7aa7ff") : "#3a3f49",
                boxShadow: k < lit ? `0 0 10px ${paid ? "#22c55e" : "#7aa7ff"}` : "none",
              }}
            />
          ))}
        </div>
        <div className="rounded-[14px] bg-[#0b0d11] px-3 py-3 text-center ring-1 ring-white/5">
          <AnimatePresence mode="wait">
            {paid ? (
              <motion.div key="ok" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-[#8a93a6]">{merchant}</div>
                <div className="mono mt-1 text-xl text-[#86efac]">Approved</div>
                <div className="mono mt-0.5 text-[10px] text-[#8a93a6]">{money(amount, { cents: true })}</div>
              </motion.div>
            ) : (
              <motion.div key={merchant + tapped} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mono truncate text-[10px] uppercase tracking-[0.2em] text-[#8a93a6]">{merchant}</div>
                <div className="mono mt-1 text-[26px] leading-none text-white">{money(amount, { cents: true })}</div>
                <div className="mono mt-1.5 text-[10px] text-[#8a93a6]">{tapped ? "Processing… hold card" : "Tap, insert or swipe"}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* the tap target */}
        <div className="relative mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-white/10">
          {tapped &&
            !paid &&
            [0, 1, 2].map((k) => (
              <motion.span
                key={k}
                className="absolute inset-0 rounded-full border-2 border-[#7aa7ff]"
                initial={{ scale: 0.7, opacity: 0.8 }}
                animate={{ scale: 2.3, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.6, delay: k * 0.53 }}
              />
            ))}
          <Contactless className="h-5 w-5 text-white/80" />
        </div>
      </div>
    </div>
  );
}

/** The phone, Apple Pay style: Monte's card on top with "Hold Near Reader"; while the reader
 *  holds, Monte flips through the wallet; the winner lands on top, then the drawn check and Done. */
function Phone({ wallet, pick, reward, phase }: { wallet: string[]; pick: string; reward: number; phase: number }) {
  const working = phase >= 0 && phase <= 3;
  const settled = phase >= 4;
  const paid = phase >= 5;
  const n = wallet.length;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!working || phase < 1) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 650);
    return () => clearInterval(t);
  }, [working, phase]);
  // the card on top: Monte's own until the wallet opens, flipping through it while it ranks
  const top = settled ? pick : working && phase >= 1 ? wallet[tick % n] : "monte";
  const rest = settled ? wallet.filter((id) => id !== pick) : wallet;

  return (
    <div className="relative">
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[88px] h-6 w-[3px] rounded-l-sm bg-gradient-to-b from-[#a8adb6] to-[#7d838d]" />
      <span className="absolute -left-[3px] top-[124px] h-11 w-[3px] rounded-l-sm bg-gradient-to-b from-[#a8adb6] to-[#7d838d]" />
      <span className="absolute -left-[3px] top-[176px] h-11 w-[3px] rounded-l-sm bg-gradient-to-b from-[#a8adb6] to-[#7d838d]" />
      <motion.span
        className="absolute -right-[3px] top-[140px] h-16 w-[3px] rounded-r-sm bg-gradient-to-b from-[#a8adb6] to-[#7d838d]"
        animate={phase === 0 ? { x: [-0, -1.5, 0, -1.5, 0] } : { x: 0 }}
        transition={{ duration: 0.6 }}
      />
      {/* titanium frame */}
      <div className="relative h-[440px] w-[216px] rounded-[46px] bg-gradient-to-br from-[#d4d7dc] via-[#8f959e] to-[#c6c9cf] p-[2.5px] shadow-[0_44px_70px_-30px_rgba(12,14,20,.65),0_0_0_1px_rgba(12,14,20,.18)]">
        <div className="relative h-full w-full rounded-[43.5px] bg-[#050506] p-[6px]">
          {/* screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-black text-white">
            {/* status bar */}
            <div className="relative z-20 flex items-center justify-between px-6 pt-[11px] text-[11px] font-semibold tracking-tight">
              <span>12:04</span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 18 12" className="h-2.5 w-3.5" fill="currentColor" aria-hidden>
                  <rect x="0" y="8" width="3" height="4" rx="1" />
                  <rect x="5" y="5" width="3" height="7" rx="1" />
                  <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
                  <rect x="15" y="0" width="3" height="12" rx="1" />
                </svg>
                <svg viewBox="0 0 16 12" className="h-2.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.3L2.2 5.6a8.2 8.2 0 0 1 11.6 0l-1.6 1.6a5.9 5.9 0 0 0-8.4 0ZM.6 4 -.9 2.4a12.6 12.6 0 0 1 17.8 0L15.4 4A10.4 10.4 0 0 0 .6 4Z" />
                </svg>
                <span className="relative ml-0.5 h-[10px] w-[20px] rounded-[3px] border border-white/55 p-[1px]">
                  <span className="block h-full w-[78%] rounded-[1.5px] bg-white" />
                </span>
              </span>
            </div>
            {/* dynamic island */}
            <motion.div
              className="absolute left-1/2 top-[8px] z-30 flex h-[24px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2 ring-1 ring-white/[.04]"
              animate={{ width: working ? 96 : 76 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <AnimatePresence>
                {working && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Contactless className="h-3 w-3 text-[#7aa7ff]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            {/* top card */}
            <div className="relative mx-auto mt-8 w-[184px]" style={{ perspective: 800 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={top}
                  initial={{ rotateY: -70, opacity: 0, y: 6 }}
                  animate={{ rotateY: 0, opacity: 1, y: 0 }}
                  exit={{ rotateY: 70, opacity: 0, y: -4 }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                >
                  {top === "monte" ? <MonteCard /> : <CardArt id={top} size="sm" />}
                </motion.div>
              </AnimatePresence>
              {settled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mono absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22c55e] px-2 py-[2px] text-[9px] font-semibold text-black"
                >
                  +{money(reward, { cents: true })} rewards
                </motion.div>
              )}
            </div>

            {/* status: hold / choosing / done */}
            <div className="mt-9 flex h-[104px] flex-col items-center justify-start">
              <AnimatePresence mode="wait">
                {paid ? (
                  <motion.div key="done" className="flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <svg viewBox="0 0 52 52" className="h-14 w-14" aria-hidden>
                      <motion.circle cx="26" cy="26" r="23" fill="none" stroke="#0a84ff" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45 }} />
                      <motion.path
                        d="M15 27l7.5 7.5L38 19"
                        fill="none"
                        stroke="#0a84ff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                      />
                    </svg>
                    <div className="mt-1.5 text-[15px] font-semibold">Done</div>
                  </motion.div>
                ) : working || settled ? (
                  <motion.div key="busy" className="flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.span
                      className="block h-11 w-11 rounded-full border-[3px] border-white/15 border-t-[#0a84ff]"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                    />
                    <div className="mt-2.5 text-[13px] font-semibold">{settled ? shortName(pick) : "Choosing a card"}</div>
                  </motion.div>
                ) : (
                  <motion.div key="hold" className="flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}>
                      <HoldIcon />
                    </motion.div>
                    <div className="mt-2 text-[15px] font-semibold">Hold Near Reader</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* the rest of the wallet, peeking at the bottom */}
            <div className="absolute inset-x-0 bottom-6 mx-auto w-[184px]">
              {rest.slice(0, 4).map((id, k) => (
                <div key={id} className="h-[14px] overflow-hidden rounded-t-[8px] opacity-80" style={{ marginTop: k ? -2 : 0 }}>
                  <CardArt id={id} size="sm" />
                </div>
              ))}
            </div>
            {/* home bar + glass */}
            <div className="absolute bottom-[7px] left-1/2 z-50 h-[4px] w-[76px] -translate-x-1/2 rounded-full bg-white/70" />
            <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(118deg,rgba(255,255,255,.09),transparent_36%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Monte's own card, the one the phone presents before it knows which real card to route to. */
function MonteCard() {
  return (
    <div className="relative aspect-[1.586/1] overflow-hidden rounded-[7%/11%] bg-[linear-gradient(135deg,#1c3faa,#0b1a4a_60%,#05070f)] p-3 shadow-[0_14px_30px_-12px_rgba(0,0,0,.8)] ring-1 ring-white/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(255,255,255,.28),transparent_55%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="mono text-[12px] font-semibold tracking-tight text-white">[ monte ]</span>
          <Contactless className="h-3.5 w-3.5 text-white/80" />
        </div>
        <div className="h-4 w-6 rounded-[3px] bg-gradient-to-br from-[#e8d08a] via-[#b89a4a] to-[#f3e3a8]" />
        <div className="mono text-[8px] uppercase tracking-[0.2em] text-white/60">routes to your best card</div>
      </div>
    </div>
  );
}

/** Apple Pay's "hold near reader" glyph: the top of a phone with waves above it. */
function HoldIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 text-[#0a84ff]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <rect x="15" y="20" width="18" height="26" rx="4" />
      <path d="M17 13a10 10 0 0 1 14 0" />
      <path d="M12 8a17 17 0 0 1 24 0" />
    </svg>
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
