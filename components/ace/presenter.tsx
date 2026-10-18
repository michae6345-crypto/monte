"use client";

// Presenter mode for the pitch. Press P (or open ?present) and the arrow keys walk the demo
// path section by section, with a 4:00 clock. C shows the speaker cue; Esc leaves.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAce } from "./store";

// persona: whose year the step shows (Jordan unless it says otherwise)
type Step = { id: string; title: string; cue: string; tap?: string; tab?: string; target?: string; persona?: string; block?: ScrollLogicalPosition };

const STEPS: Step[] = [
  { id: "top", title: "Hook", cue: "Every dollar, played right. For anyone with money moving through a bank, not just card collectors." },
  { id: "see", tab: "stores", target: "money-view", title: "See where it goes", cue: "A year of Jordan's spending: every store, sized by money, growing month by month." },
  { id: "see", tab: "receipt", target: "receipt-net", block: "center", title: "What his cards cost", cue: "$553 rewards, $80 perks, −$325 fee, −$735 interest. Net −$427." },
  { id: "leaks", tab: "leaks", target: "leaks-list", title: "Stop the leaks", cue: "Monte found $891 a year leaking: interest, a fee that doesn't pay, the wrong card. Each with its fix." },
  { id: "spend", tab: "replay", target: "replay-view", title: "Spend it right", cue: "Scroll: the same purchases move to the right card. $104 back." },
  { id: "spend", tab: "tap", target: "tap-view", title: "Tap", cue: "At Mobil the Apple Card earns 3x, but it carries a balance. Not this one.", tap: "Mobil" },
  { id: "plan", tab: "payoff", target: "payoff-view", title: "Plan the next move", cue: "$250 a month clears it in 13 months, not 12 years. Then +$521 a year." },
  { id: "next", title: "Next year ×1000", cue: "1,000 simulated years: today, played right, paid off." },
  { id: "spend", tab: "replay", target: "replay-view", persona: "sam", title: "Only one card", cue: "Sam, 19, one student card. Nothing to re-route, so Monte asks the next question: a Savor beside it would have added $131 last year; +$114 a year median, simulated." },
  { id: "see", tab: "stores", target: "month-strip", block: "center", persona: "rosa", title: "Income that swings", cue: "Rosa's biggest month is 5.1× her slowest (Feb $3,792, Nov $738). Her $1,900 balance costs $546 a year; her two cards earned $458." },
  { id: "how", tab: "trace", target: "how-view", title: "How it works", cue: "One purchase traced: merchant code, rule, cents, source. No model does the math." },
  { id: "how", tab: "real", target: "real-view", title: "Real vs simulated", cue: "Card terms and engine are real. Jordan is synthetic. Plaid is sandbox." },
];

const noop = () => () => {};
const fromUrl = () => new URLSearchParams(window.location.search).has("present");

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
      // open the tab first, then land on the view itself, not the chapter heading
      window.setTimeout(() => document.getElementById(s.target ?? s.id)?.scrollIntoView({ behavior: "smooth", block: s.block ?? "start" }), s.tab ? 120 : 0);
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
    return () => window.removeEventListener("keydown", onKey);
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
