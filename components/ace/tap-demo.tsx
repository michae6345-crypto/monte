"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Arrow } from "@/components/brand";
import { tap } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { CardArt, CardMini, shortName } from "./card-art";
import { MerchantLogo } from "./merchant-logo";
import { money, nameOf, useAce } from "./store";
import { spotsFor } from "./spots";

// The tap, played out on one stage: the store's reader and the phone in the middle, and each
// step Monte takes annotated beside them, slow enough to talk over. The numbers are the engine's
// own `tap()` on the selected person's wallet.

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
  { k: "read", t: "The reader sends a store code", short: "Store code", side: "right", phone: "Reading the reader" },
  { k: "wallet", t: "Monte opens your wallet", short: "Wallet", side: "left", phone: "Opening your wallet" },
  { k: "caps", t: "It counts what this month already used", short: "Caps", side: "right", phone: "Checking this month" },
  { k: "rank", t: "It ranks every card for this purchase", short: "Rank", side: "left", phone: "Ranking your cards" },
  { k: "pay", t: "It pays with the winner", short: "Pay", side: "right", phone: "Paying with" },
] as const;
type StepKey = (typeof STEPS)[number]["k"];

// phase: -1 waiting for a tap, 0..4 the steps above, 5 paid. Slow on purpose: each step is
// held long enough to explain it out loud.
const STEP_MS = 5200;

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
  const { wallet, txns, persona, valuation, r: year } = useAce();
  const nm = nameOf(persona);
  const spots = useMemo(() => spotsFor(BASE, txns, "Los Angeles"), [txns]);
  const [i, setI] = useState(0);
  const spot = spots[Math.min(i, spots.length - 1)];
  const [phase, setPhase] = useState(-1);
  const [playing, setPlaying] = useState(true);

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
  const summary: Record<StepKey, string> = {
    read: `${spot.mcc} · ${spot.category.replace(/_/g, " ")} · ${money(spot.amount, { cents: true })}`,
    wallet: `${wallet.length - offLimits.length} of ${wallet.length} cards can play`,
    caps: `${history.length} purchases replayed`,
    rank: `${shortName(pick.cardId)} first`,
    pay: `+${money(pick.reward, { cents: true })} earned`,
  };

  const reset = useCallback(() => setPhase(-1), []);
  const start = useCallback(() => {
    setPhase(0);
    setPlaying(true);
  }, []);
  const next = useCallback(() => setPhase((p) => Math.min(5, p + 1)), []);
  const back = useCallback(() => setPhase((p) => Math.max(0, p - 1)), []);

  useEffect(() => {
    if (!playing || phase < 0 || phase >= 5) return;
    const t = window.setTimeout(() => setPhase((p) => p + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, playing]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === -1 || phase >= 5) start();
        else setPlaying((x) => !x);
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

  // what each step's note says, in full
  const body: Record<StepKey, ReactNode> = {
    read: (
      <>
        <div className="mono flex flex-wrap gap-1.5 text-[12px] text-ace-ink">
          <Chip>{spot.merchant}</Chip>
          <Chip strong>store code {spot.mcc}</Chip>
          <Chip>{spot.category.replace(/_/g, " ")}</Chip>
          <Chip>{money(spot.amount, { cents: true })}</Chip>
        </div>
        <p className="mt-2.5">
          Every reader sends a four-digit merchant code with the amount. That code, not the store&apos;s name, decides which reward category each card pays.
        </p>
      </>
    ),
    wallet: (
      <>
        <div className="space-y-1.5">
          {wallet.map((h) => (
            <div key={h.cardId} className={`flex items-center gap-2.5 text-[13px] text-ace-ink ${h.balance ? "opacity-60" : ""}`}>
              <CardMini id={h.cardId} width={32} />
              <span className="flex-1 truncate">{shortName(h.cardId)}</span>
              {h.balance ? (
                <span className="mono rounded bg-ace-loss/10 px-1.5 py-0.5 text-[11px] text-ace-loss">off limits</span>
              ) : (
                <span className="mono text-[11px] text-ace-gain">can play</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2.5">
          {offLimits.length
            ? `${offLimits.map((h) => shortName(h.cardId)).join(" and ")} carries a balance. New spending there charges interest from today, so Monte never picks it.`
            : "Every card is paid in full, so all of them compete."}
        </p>
      </>
    ),
    caps: (
      <>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl text-ace-ink" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            {history.length}
          </span>
          <span className="mono text-[12px]">purchase{history.length === 1 ? "" : "s"} since 1 Oct, replayed</span>
        </div>
        <p className="mt-2">Bonus categories have spending caps. Monte replays this month on the best cards first, so a cap that&apos;s already full stops paying the bonus rate.</p>
        {res.capNotes.map((n) => (
          <p key={n} className="mt-1.5 text-ace-ink">
            {n}
          </p>
        ))}
      </>
    ),
    rank: (
      <div className="space-y-2">
        {res.ranked.map((x, r) => (
          <div key={x.cardId}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className={`truncate ${x.blocked ? "line-through" : "text-ace-ink"}`}>{shortName(x.cardId)}</span>
              <span className={`mono shrink-0 ${x.cardId === pick.cardId ? "font-semibold text-ace-gain" : ""}`}>
                {x.mult.toFixed(x.mult % 1 ? 1 : 0)}× · {money(x.reward, { cents: true })}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ace-line/60">
              <motion.div
                className={`h-full rounded-full ${x.blocked ? "bg-ace-loss/45" : x.cardId === pick.cardId ? "bg-ace-gain" : "bg-ace-dim/40"}`}
                initial={{ width: 0 }}
                animate={{ width: `${(x.reward / maxReward) * 100}%` }}
                transition={{ delay: 0.3 + r * 0.35, duration: 0.7 }}
              />
            </div>
          </div>
        ))}
        <p className="pt-1">
          Each card&apos;s rate comes from its issuer&apos;s published terms ({new URL(card(pick.cardId).source_urls[0] ?? "https://example.com").hostname} for the winner). The
          engine does the math, not an AI.
        </p>
      </div>
    ),
    pay: (
      <>
        <div className="flex items-center gap-3">
          <CardMini id={pick.cardId} width={48} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ace-ink">{shortName(pick.cardId)}</div>
            <div className="mono truncate text-[11px]">{pick.rule}</div>
          </div>
          <div className="ml-auto text-2xl text-ace-gain" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            +{money(pick.reward, { cents: true })}
          </div>
        </div>
        <p className="mt-2.5">
          {usual && usual !== pick.cardId && gain > 0.004
            ? `${nm.Who} usually reaches for the ${shortName(usual)}${usualOpt?.blocked ? ", which carries a balance" : ""}. This tap earns ${money(gain, { cents: true })} more, with nothing to remember.`
            : usual === pick.cardId
              ? `That's the card ${nm.who} usually reaches for, and here it's the right one.`
              : "The phone hands this card to the reader. Nothing to remember at the register."}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-ace-bg p-2.5 ring-1 ring-ace-line">
          <YearStat label="every tap right, last year" value={`+${money(year.leftOnTable)}`} tone="gain" />
          <YearStat label="interest paid" value={`−${money(year.interest)}`} tone={year.interest > 0 ? "loss" : "ink"} />
          <YearStat label="net from the cards" value={money(year.net, { sign: true })} tone={year.net < 0 ? "loss" : "gain"} />
        </div>
      </>
    ),
  };

  const notes = (side: "left" | "right") => (
    <div className={`flex min-h-0 flex-col justify-center gap-2.5 ${side === "left" ? "items-end" : "items-start"}`}>
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
              className="w-full max-w-[400px]"
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
            <div className="text-sm font-semibold leading-tight">Tap to pay, step by step</div>
            <div className="mono truncate text-[11px] text-ace-dim">{nm.whose} wallet · simulated reader, real card rules</div>
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
          className="relative grid gap-4 px-4 py-5 lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)] lg:gap-6"
          style={{ background: "radial-gradient(60% 70% at 50% 45%, color-mix(in oklab, var(--m-accent) 9%, transparent), transparent 70%)" }}
        >
          <div className="hidden lg:flex lg:flex-col lg:justify-center">{notes("left")}</div>

          <div className="relative flex flex-col items-center">
            <Reader merchant={spot.merchant} amount={spot.amount} mcc={spot.mcc} tapped={tapped} paid={paid} />
            <motion.div
              className="relative z-10 -mt-3"
              animate={tapped && !paid ? { y: -30, rotateX: 14, scale: 0.98 } : { y: 0, rotateX: 0, scale: 1 }}
              style={{ transformPerspective: 900 }}
              transition={{ type: "spring", stiffness: 110, damping: 16 }}
            >
              <Phone wallet={wallet.map((h) => h.cardId)} blocked={offLimits.map((h) => h.cardId)} ranked={res.ranked.map((x) => x.cardId)} pick={pick.cardId} reward={pick.reward} phase={phase} />
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
            <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-10 lg:flex">
              <p className="m-note max-w-[260px] -rotate-2 text-[17px] text-ace-dim">You&apos;re at the register at {spot.merchant}, about to pay {money(spot.amount, { cents: true })}.</p>
              <p className="m-note max-w-[240px] rotate-2 text-right text-[17px] text-ace-dim">Tap, and watch what Monte does before the beep.</p>
            </div>
          )}
        </div>

        {/* timeline + controls */}
        <div className="flex flex-wrap items-center gap-3 border-t border-ace-line bg-ace-panel px-4 py-3">
          <div className="flex items-center gap-1.5">
            {phase === -1 || paid ? (
              <button onClick={start} className="btn btn-primary btn-sm">
                <Contactless className="mr-1.5 h-3.5 w-3.5" /> {paid ? "Tap again" : "Tap to pay"}
              </button>
            ) : (
              <>
                <Ctl label="Back" onClick={back} disabled={phase <= 0}>
                  ‹
                </Ctl>
                <Ctl label={playing ? "Pause" : "Play"} onClick={() => setPlaying((x) => !x)} wide>
                  {playing ? "❚❚" : "▶"}
                </Ctl>
                <Ctl label="Next" onClick={next}>
                  ›
                </Ctl>
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
                  <button onClick={() => (phase === -1 ? (setPlaying(false), setPhase(k)) : setPhase(k))} className="group block w-full text-left">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ace-line">
                      {done ? (
                        <div className="h-full w-full rounded-full bg-ace-ink" />
                      ) : now ? (
                        <motion.div
                          key={`${phase}-${playing}`}
                          className="h-full rounded-full bg-ace-ink"
                          initial={{ width: playing ? "0%" : "35%" }}
                          animate={{ width: playing ? "100%" : "35%" }}
                          transition={{ duration: playing ? STEP_MS / 1000 : 0, ease: "linear" }}
                        />
                      ) : null}
                    </div>
                    <div className={`mono mt-1 truncate text-[10px] uppercase tracking-[0.14em] ${now ? "text-ace-ink" : "text-ace-dim group-hover:text-ace-ink"}`}>
                      {String(k + 1).padStart(2, "0")} {s.short}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mono hidden text-[10px] text-ace-dim md:block">space play/pause · ← → step</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** One step's annotation: a numbered card with a pencil arrow toward the phone. Open while it
 *  is being explained, folded to one line after. */
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
  const arrow = (
    <span className="hidden text-ace-dim lg:block">
      <Arrow dir={side === "left" ? "right" : "left"} className="h-8 w-11" />
    </span>
  );
  return (
    <div className={`flex items-center gap-1 ${side === "left" ? "flex-row" : "flex-row-reverse"}`}>
      <div
        onClick={open ? undefined : onClick}
        className={`min-w-0 flex-1 rounded-2xl bg-ace-panel transition ${
          open ? "p-4 shadow-[0_0_0_1.5px_var(--m-ink),0_18px_40px_-24px_rgba(12,14,20,.45)]" : "cursor-pointer px-3.5 py-2.5 shadow-[0_0_0_1px_var(--m-line)] hover:shadow-[0_0_0_1px_var(--m-line-strong)]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${open ? "bg-ace-ink text-ace-bg" : "bg-ace-gain text-white"}`}
          >
            {open ? String(step + 1).padStart(2, "0") : "✓"}
          </span>
          <span className={`font-medium ${open ? "text-[16px]" : "text-[13px]"}`}>{title}</span>
          {!open && summary && <span className="mono ml-auto truncate pl-2 text-[11px] text-ace-dim">{summary}</span>}
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-3 text-[13.5px] leading-relaxed text-ace-dim">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {open && arrow}
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

function YearStat({ label, value, tone }: { label: string; value: string; tone: "gain" | "loss" | "ink" }) {
  return (
    <div>
      <div className={`text-[15px] font-semibold ${tone === "gain" ? "text-ace-gain" : tone === "loss" ? "text-ace-loss" : "text-ace-ink"}`}>{value}</div>
      <div className="mono text-[10px] leading-tight text-ace-dim">{label}</div>
    </div>
  );
}

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <span className={`rounded-md px-2 py-0.5 ${strong ? "bg-ace-ink text-ace-bg" : "bg-ace-bg ring-1 ring-ace-line"}`}>{children}</span>;
}

/** The store's card reader: amount on its screen, contactless mark, rings while the phone is near. */
function Reader({ merchant, amount, mcc, tapped, paid }: { merchant: string; amount: number; mcc: string; tapped: boolean; paid: boolean }) {
  return (
    <div className="relative z-0 w-[230px] rounded-[22px] bg-gradient-to-b from-[#2a2e37] to-[#16181e] p-2.5 pb-3 shadow-[0_24px_44px_-22px_rgba(12,14,20,.7),inset_0_1px_0_rgba(255,255,255,.08)]">
      <div className="rounded-[14px] bg-[#0b0d11] px-3 py-2.5 text-center ring-1 ring-white/5">
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
        {tapped &&
          !paid &&
          [0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute inset-0 rounded-full border-2 border-[#7aa7ff]"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.6, delay: k * 0.53 }}
            />
          ))}
        <Contactless className="h-6 w-6 text-white/80" />
      </div>
    </div>
  );
}

/** The phone: a dark wallet screen whose cards stack, jostle while Monte works, then the winner
 *  lifts out and pays. */
function Phone({
  wallet,
  blocked,
  ranked,
  pick,
  reward,
  phase,
}: {
  wallet: string[];
  blocked: string[];
  ranked: string[];
  pick: string;
  reward: number;
  phase: number;
}) {
  const status = phase < 0 ? "Hold near reader" : phase >= 5 ? "Done" : STEPS[phase].phone;
  const working = phase >= 0 && phase <= 3;
  const settled = phase >= 4;
  const n = wallet.length;
  return (
    <div className="relative">
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[96px] h-7 w-[3px] rounded-l bg-[#9aa0aa]" />
      <span className="absolute -left-[3px] top-[136px] h-12 w-[3px] rounded-l bg-[#9aa0aa]" />
      <span className="absolute -left-[3px] top-[192px] h-12 w-[3px] rounded-l bg-[#9aa0aa]" />
      <span className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r bg-[#9aa0aa]" />
      {/* titanium frame */}
      <div className="relative h-[430px] w-[214px] rounded-[44px] bg-gradient-to-br from-[#c9cdd4] via-[#8d939d] to-[#c3c7ce] p-[3px] shadow-[0_40px_70px_-30px_rgba(12,14,20,.6),0_0_0_1px_rgba(12,14,20,.15)]">
        <div className="relative h-full w-full rounded-[41px] bg-[#0a0b0e] p-[7px]">
          {/* screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-[radial-gradient(120%_70%_at_50%_0%,#1d2230,#0b0d12_60%)] text-white">
            {/* status bar */}
            <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold">
              <span>12:04</span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 18 12" className="h-2.5 w-3.5" fill="currentColor" aria-hidden>
                  <rect x="0" y="8" width="3" height="4" rx="1" />
                  <rect x="5" y="5" width="3" height="7" rx="1" />
                  <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
                  <rect x="15" y="0" width="3" height="12" rx="1" />
                </svg>
                <span className="relative h-2.5 w-5 rounded-[3px] border border-white/60 p-[1px]">
                  <span className="block h-full w-[70%] rounded-[1.5px] bg-white" />
                </span>
              </span>
            </div>
            {/* dynamic island */}
            <div className="absolute left-1/2 top-2 z-30 flex h-[22px] w-[74px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2">
              <AnimatePresence>
                {working && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.3, 1] }}
                    exit={{ scale: 0 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="h-1.5 w-1.5 rounded-full bg-[#7aa7ff]"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 text-center">
              <div className="mono text-[9px] uppercase tracking-[0.3em] text-white/45">Monte</div>
              <AnimatePresence mode="wait">
                <motion.div key={status} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-0.5 text-[14px] font-semibold">
                  {status}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* cards */}
            <div className="relative mx-auto mt-4 h-[210px] w-[176px]">
              {wallet.map((id, k) => {
                const isPick = id === pick;
                const r = Math.max(0, ranked.indexOf(id));
                const off = blocked.includes(id);
                // idle: a neat stack; working: cards jostle; settled: the winner lifts out on top
                const y = settled ? (isPick ? 4 : 112 + r * 10) : working ? 14 + ((k + Math.max(phase, 0)) % n) * 30 : 20 + k * 26;
                const rotate = settled ? (isPick ? 0 : r % 2 ? 4 : -4) : working ? ((k + phase) % 2 ? 3 : -3) : 0;
                return (
                  <motion.div
                    key={id}
                    className="absolute inset-x-0"
                    animate={{
                      y,
                      rotate,
                      scale: settled && !isPick ? 0.84 : 1,
                      opacity: phase >= 1 && off && !settled ? 0.45 : 1,
                      zIndex: settled ? (isPick ? 30 : 20 - r) : working ? (k + Math.max(phase, 0)) % n : k,
                    }}
                    transition={{ type: "spring", stiffness: 140, damping: 17 }}
                  >
                    <CardArt id={id} size="sm" dim={settled && !isPick} />
                    {phase >= 1 && phase < 4 && off && (
                      <span className="mono absolute right-1.5 top-1.5 rounded-full bg-[#ef4444] px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-wider text-white">
                        balance
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* bottom: hint, then the result sheet */}
            <AnimatePresence mode="wait">
              {settled ? (
                <motion.div
                  key="sheet"
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 60, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 170, damping: 20 }}
                  className="absolute inset-x-2 bottom-2 z-40 rounded-[26px] bg-white/[.09] p-3.5 backdrop-blur-md ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[12px] font-semibold">{shortName(pick)}</span>
                    {phase >= 5 && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-[11px] font-bold">
                        ✓
                      </motion.span>
                    )}
                  </div>
                  <div className="text-[26px] leading-tight text-[#6ee7a0]" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
                    +{money(reward, { cents: true })}
                  </div>
                  <div className="mono text-[9.5px] text-white/55">{phase >= 5 ? "earned · paid in full" : "the best card for this purchase"}</div>
                </motion.div>
              ) : (
                <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-1.5">
                  <motion.span animate={phase < 0 ? { y: [0, -4, 0] } : { rotate: 360 }} transition={{ repeat: Infinity, duration: phase < 0 ? 1.6 : 1.4, ease: phase < 0 ? "easeInOut" : "linear" }}>
                    {phase < 0 ? <Contactless className="h-6 w-6 text-white/70" /> : <span className="block h-5 w-5 rounded-full border-2 border-white/20 border-t-[#7aa7ff]" />}
                  </motion.span>
                  <span className="mono text-[9.5px] text-white/50">{phase < 0 ? "hold the top near the reader" : "picking before the beep"}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {/* home bar + glass */}
            <div className="absolute bottom-1.5 left-1/2 z-50 h-1 w-20 -translate-x-1/2 rounded-full bg-white/40" />
            <div className="pointer-events-none absolute inset-0 z-50 bg-[linear-gradient(115deg,rgba(255,255,255,.10),transparent_38%)]" />
          </div>
        </div>
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
