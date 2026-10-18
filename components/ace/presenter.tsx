"use client";

// Presenter mode for the pitch. Press P (or open ?present) and the arrow keys walk the demo
// path section by section, with a 4:00 clock. C shows the speaker cue; Esc leaves.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAce } from "./store";

// persona: whose year the step shows (Jordan unless it says otherwise)
// play: seconds to scroll through the step's scroll stage by itself, so the screen does what the cue says
type Step = {
  id: string;
  title: string;
  cue: string;
  tap?: string;
  tab?: string;
  target?: string;
  persona?: string;
  block?: ScrollLogicalPosition;
  play?: number;
};

const STEPS: Step[] = [
  { id: "top", title: "Hook", cue: "Jordan, 24, first job in LA, three cards. Last year they cost him $427. Monte plays every dollar right, for anyone with money moving through a bank." },
  { id: "see", tab: "stores", target: "money-view", title: "See where it goes", cue: "A year of Jordan's spending: every store, sized by money, growing month by month.", play: 5 },
  { id: "see", tab: "receipt", target: "receipt-net", block: "center", title: "What his cards cost", cue: "$553 rewards, $80 perks, −$325 fee, −$735 interest. Net −$427." },
  { id: "leaks", tab: "leaks", target: "leaks-list", title: "Stop the leaks", cue: "Monte found $891 a year leaking: interest, a fee that doesn't pay, the wrong card. Each with its fix.", play: 4 },
  { id: "spend", tab: "replay", target: "replay-view", title: "Spend it right", cue: "The same purchases move to the right card. $104 back.", play: 5 },
  { id: "spend", tab: "tap", target: "tap-view", title: "Tap", cue: "At Mobil the Apple Card earns 3x, but it carries a balance. Not this one.", tap: "Mobil" },
  { id: "plan", tab: "payoff", target: "payoff-view", title: "Plan the next move", cue: "$250 a month clears it in 13 months, not 12 years. Then +$521 a year.", play: 5 },
  { id: "plan", tab: "keep", target: "keep-view", title: "Keep or cancel", cue: "The Amex Gold's $325 fee buys $273 of value. 1,000 of 1,000 simulated years say drop it: +$48 a year." },
  { id: "next", target: "next", title: "Next year ×1000", cue: "1,000 simulated next years: as paid, on the right card, and with the balance paid off.", play: 6 },
  { id: "spend", tab: "replay", target: "replay-view", persona: "sam", title: "Only one card", cue: "Sam, 19, one student card. Nothing to move, so Monte asks the next question: a Savor beside it would have added $131 last year." },
  { id: "plan", tab: "payoff", target: "payoff-view", persona: "rosa", title: "Income that swings", cue: "Rosa's spending runs from $738 to $3,792 a month. Her $1,900 balance costs her more in interest than her cards earned. Paying in step with her months, $76 to $391, clears it in 9 months for $6 more interest than a flat $250, which a slow month may not cover.", play: 4 },
  { id: "how", tab: "trace", target: "how-view", title: "How it works", cue: "The pipeline, and a solver checking live that no other way of using these cards earns more. Then one purchase traced to its rule and source." },
  { id: "how", tab: "real", target: "real-view", block: "center", title: "Real vs simulated", cue: "Card terms, engine, Monte Carlo, the solver check and 36 tests are real. The five people are synthetic. Plaid code is real; this deployment has no Plaid keys." },
];

const noop = () => () => {};
const fromUrl = () => new URLSearchParams(window.location.search).has("present");

// The scroll a stage needs, played by itself: from the stage's start to its end over `sec`.
let playing = 0;
function stopPlay() {
  playing++;
}
function playStage(el: HTMLElement, sec: number) {
  const stage = (el.matches("[data-stage]") ? el : el.querySelector<HTMLElement>("[data-stage]")) ?? el.closest<HTMLElement>("[data-stage]");
  if (!stage) return;
  const top = stage.getBoundingClientRect().top + window.scrollY;
  const end = top + stage.offsetHeight - window.innerHeight;
  if (end <= top) return;
  const me = ++playing;
  const from = window.scrollY;
  const t0 = performance.now();
  const tick = () => {
    if (me !== playing) return;
    const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    window.scrollTo(0, from + (end - from) * e);
    if (k < 1) window.setTimeout(tick, 16);
  };
  tick();
}

export function Presenter() {
  const urlOn = useSyncExternalStore(noop, fromUrl, () => false);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const on = toggled ?? urlOn;
  // the pitch always runs on the canonical numbers: no leftover store corrections
  const { resetOverrides, setPersona } = useAce();
  const [i, setI] = useState(0);
  // the cue is for the speaker; on a projector the pill stays small unless C opens it
  const [cue, setCue] = useState(false);
  const want = STEPS[i].persona ?? "jordan";
  // only when a step starts: the audience can still tap a person mid-step
  useEffect(() => {
    if (!on) return;
    resetOverrides();
    setPersona(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, i]);
  const [t0, setT0] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const go = (k: number) => {
      const n = Math.max(0, Math.min(STEPS.length - 1, k));
      setI(n);
      const s = STEPS[n];
      stopPlay();
      // open the tab first, then land on the view itself, not the chapter heading; a long jump
      // is instant so the step doesn't arrive late
      window.setTimeout(() => {
        const el = document.getElementById(s.target ?? s.id);
        if (!el) return;
        const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 2;
        el.scrollIntoView({ behavior: far || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: s.block ?? "start" });
        if (s.play) window.setTimeout(() => playStage(el, s.play!), far ? 300 : 900);
      }, s.tab || s.persona ? 160 : 0);
      if (s.tab) window.dispatchEvent(new CustomEvent("monte:tab", { detail: { chapter: s.id, tab: s.tab } }));
      if (s.tap) window.setTimeout(() => window.dispatchEvent(new CustomEvent("monte:tap", { detail: s.tap })), 450);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "p" || e.key === "P") {
        setToggled((v) => !(v ?? urlOn));
        return;
      }
      if (!on) return;
      if (e.key === "Escape") setToggled(false);
      if (e.key === "c" || e.key === "C") setCue((v) => !v);
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setT0((t) => t ?? Date.now());
        go(i + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(i - 1);
      }
      if (e.key === "Home") go(0);
    };
    window.addEventListener("keydown", onKey);
    // the presenter's own scroll takes over from the auto-play
    window.addEventListener("wheel", stopPlay, { passive: true });
    window.addEventListener("touchstart", stopPlay, { passive: true });
    window.addEventListener("pointerdown", stopPlay, { passive: true });
    const keyStop = (e: KeyboardEvent) => {
      if (!["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " ", "Home", "c", "C"].includes(e.key)) stopPlay();
    };
    window.addEventListener("keydown", keyStop);
    return () => {
      stopPlay();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", keyStop);
      window.removeEventListener("wheel", stopPlay);
      window.removeEventListener("touchstart", stopPlay);
      window.removeEventListener("pointerdown", stopPlay);
    };
  }, [on, i, urlOn]);

  useEffect(() => {
    if (!on || t0 === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [on, t0]);

  if (!on) return null;
  const s = STEPS[i];
  const left = t0 === null ? 240 : Math.max(-599, 240 - Math.floor((now - t0) / 1000));
  const clock = `${left < 0 ? "−" : ""}${Math.floor(Math.abs(left) / 60)}:${String(Math.abs(left) % 60).padStart(2, "0")}`;

  return (
    <div
      className={`mono fixed bottom-3 right-3 z-[80] flex items-center gap-3 bg-ace-ink px-3 py-1.5 text-[11px] text-ace-bg shadow-[0_8px_24px_-12px_rgba(14,15,18,.5)] ${cue ? "max-w-[min(440px,calc(100vw-24px))] rounded-2xl" : "rounded-full"}`}
    >
      <span className="shrink-0 tnum" style={{ color: "var(--ace-gold)" }}>
        {String(i + 1).padStart(2, "0")}/{STEPS.length}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{s.title}</span>
        {cue && <span> · {s.cue}</span>}
      </span>
      <span className={`shrink-0 tnum ${left < 30 ? "font-bold underline" : ""}`}>{clock}</span>
    </div>
  );
}
