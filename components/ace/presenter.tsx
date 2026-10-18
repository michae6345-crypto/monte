"use client";

// Presenter mode for the pitch. Press P (or open ?present) and the arrow keys walk the demo
// path section by section, with a one-line cue and a 4:00 clock. Esc leaves.

import { useEffect, useState, useSyncExternalStore } from "react";

type Step = { id: string; title: string; cue: string; tap?: string };

const STEPS: Step[] = [
  { id: "top", title: "Hook", cue: "Jordan's three cards cost him $427 last year. Scroll: deal the hand." },
  { id: "solver", title: "Next year", cue: "Same 1,000 years, three strategies. Routing alone moves every dot right." },
  { id: "money", title: "Money", cue: "Where $23k went: food first, and what keeps charging him." },
  { id: "receipt", title: "Receipt", cue: "$553 rewards, $80 perks, −$325 fee, −$735 interest. Net −$427." },
  { id: "history", title: "Purchases", cue: "Every purchase, the card he used, the card Monte picks." },
  { id: "replay", title: "Replay", cue: "Flip it: same purchases, better cards, $104 back." },
  { id: "tap", title: "Tap", cue: "At Mobil the Apple Card earns 3x, but it carries a balance. Not this one.", tap: "Mobil" },
  { id: "keep", title: "Keep or cancel", cue: "Amex Gold: $325 fee buys less than it costs him. Downgrade." },
  { id: "foryou", title: "Apply", cue: "No new card while he carries a balance. After that, the odds." },
  { id: "how", title: "How it works", cue: "One purchase traced: merchant code, rule, cents, source. No model does the math." },
  { id: "real", title: "Real vs simulated", cue: "Card terms and engine are real. Jordan is synthetic. Plaid is sandbox." },
];

const noop = () => () => {};
const fromUrl = () => new URLSearchParams(window.location.search).has("present");

export function Presenter() {
  const urlOn = useSyncExternalStore(noop, fromUrl, () => false);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const on = toggled ?? urlOn;
  const [i, setI] = useState(0);
  const [t0, setT0] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const go = (k: number) => {
      const n = Math.max(0, Math.min(STEPS.length - 1, k));
      setI(n);
      const s = STEPS[n];
      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (s.tap) window.dispatchEvent(new CustomEvent("monte:tap", { detail: s.tap }));
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
    <div className="mono fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-3xl items-center gap-4 rounded-lg border border-ace-line bg-ace-ink px-4 py-3 text-[12px] text-ace-bg shadow-2xl">
      <span className="shrink-0 tnum" style={{ color: "var(--ace-gold)" }}>
        {String(i + 1).padStart(2, "0")}/{STEPS.length}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{s.title}</span> <span className="opacity-70">· {s.cue}</span>
      </span>
      <span className={`shrink-0 tnum ${left < 30 ? "text-red-400" : "opacity-70"}`}>{clock}</span>
      <span className="hidden shrink-0 opacity-50 sm:inline">← → · P</span>
    </div>
  );
}
