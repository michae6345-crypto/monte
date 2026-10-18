"use client";

// The art layer of Monte Wrapped: each story card gets its own blue, a handful of hand-drawn
// doodles that draw themselves in and drift, a tilted sticker in the note hand, and a scribble
// under the number. Decoration only: every figure on the card still comes from the engine.

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Shape = "star" | "sparkle" | "heart" | "squiggle" | "swirl" | "coin" | "loop" | "dots" | "burst";
export type Doodle = { shape: Shape; x: number; y: number; size: number; rot?: number; fill?: boolean };
export type Theme = { bg: string; fg: string; accent: string; sticker: string; doodles: Doodle[]; pattern?: "dots" | "grid" };

const PATHS: Record<Shape, string> = {
  star: "M50 8 L61 38 L93 39 L67 58 L77 90 L50 71 L23 90 L33 58 L7 39 L39 38 Z",
  sparkle: "M50 5 C53 40 60 47 95 50 C60 53 53 60 50 95 C47 60 40 53 5 50 C40 47 47 40 50 5 Z",
  heart: "M50 86 C22 64 8 47 14 31 C20 15 41 13 50 31 C59 13 80 15 86 31 C92 47 78 64 50 86 Z",
  squiggle: "M4 52 C14 30 24 74 34 52 S54 30 64 52 S84 74 96 52",
  swirl: "M52 50 C52 46 46 46 46 51 C46 58 58 59 59 50 C60 38 42 36 39 49 C36 64 56 72 66 61 C78 47 68 26 49 26 C28 26 20 46 24 60",
  coin: "M50 12 C71 12 88 29 88 50 C88 71 71 88 50 88 C29 88 12 71 12 50 C12 29 29 12 50 12 Z M58 36 C54 31 40 31 40 40 C40 50 60 47 60 58 C60 68 44 68 40 62 M50 26 L50 74",
  loop: "M8 72 C28 18 72 18 62 50 C56 66 40 60 45 44 C52 22 84 28 92 40 M84 30 L92 40 L80 44",
  dots: "M20 50 L21 50 M50 50 L51 50 M80 50 L81 50",
  burst: "M50 10 L50 28 M50 72 L50 90 M10 50 L28 50 M72 50 L90 50 M22 22 L35 35 M65 65 L78 78 M78 22 L65 35 M35 65 L22 78",
};

const ink = "#0e0f12";
const blue = "#2f45ff";
const sky = "#e8ecff";
const peri = "#c3cbff";
const navy = "#0f1a5c";

/** One look per story card, keyed by the slide. */
export const THEMES: Record<string, Theme> = {
  open: {
    bg: blue,
    fg: "#ffffff",
    accent: peri,
    sticker: "hello, year ✦",
    pattern: "dots",
    doodles: [
      { shape: "sparkle", x: 78, y: 14, size: 54, rot: 8, fill: true },
      { shape: "star", x: 10, y: 72, size: 40, rot: -14 },
      { shape: "squiggle", x: 58, y: 84, size: 90 },
      { shape: "dots", x: 14, y: 20, size: 48 },
    ],
  },
  merchant: {
    bg: sky,
    fg: ink,
    accent: blue,
    sticker: "♥ fave spot",
    doodles: [
      { shape: "heart", x: 80, y: 18, size: 46, rot: 12, fill: true },
      { shape: "heart", x: 90, y: 30, size: 22, rot: -10 },
      { shape: "loop", x: 12, y: 80, size: 80, rot: -6 },
      { shape: "sparkle", x: 18, y: 16, size: 30 },
    ],
  },
  category: {
    bg: peri,
    fg: navy,
    accent: blue,
    sticker: "the big one",
    pattern: "grid",
    doodles: [
      { shape: "swirl", x: 80, y: 20, size: 64, rot: 0 },
      { shape: "star", x: 14, y: 82, size: 36, rot: 18, fill: true },
      { shape: "dots", x: 78, y: 86, size: 50 },
    ],
  },
  subs: {
    bg: "#ffffff",
    fg: ink,
    accent: blue,
    sticker: "on repeat ↻",
    pattern: "dots",
    doodles: [
      { shape: "loop", x: 78, y: 16, size: 70, rot: 160 },
      { shape: "sparkle", x: 14, y: 80, size: 34, fill: true },
      { shape: "squiggle", x: 64, y: 86, size: 70, rot: -8 },
    ],
  },
  miss: {
    bg: navy,
    fg: "#ffffff",
    accent: "#9db0ff",
    sticker: "oops",
    doodles: [
      { shape: "burst", x: 80, y: 18, size: 56 },
      { shape: "squiggle", x: 20, y: 84, size: 80, rot: 6 },
      { shape: "star", x: 86, y: 80, size: 28, rot: -20 },
    ],
  },
  table: {
    bg: blue,
    fg: "#ffffff",
    accent: peri,
    sticker: "so close",
    doodles: [
      { shape: "coin", x: 78, y: 18, size: 58, rot: -10 },
      { shape: "coin", x: 88, y: 32, size: 30, rot: 14 },
      { shape: "sparkle", x: 14, y: 82, size: 34, fill: true },
      { shape: "dots", x: 70, y: 88, size: 44 },
    ],
  },
  cards: {
    bg: sky,
    fg: ink,
    accent: blue,
    sticker: "mvp vs. meh",
    pattern: "grid",
    doodles: [
      { shape: "star", x: 82, y: 16, size: 44, rot: 10, fill: true },
      { shape: "loop", x: 14, y: 86, size: 70, rot: 4 },
    ],
  },
  net: {
    bg: ink,
    fg: "#ffffff",
    accent: "#9db0ff",
    sticker: "that's a wrap",
    doodles: [
      { shape: "sparkle", x: 18, y: 18, size: 40, fill: true },
      { shape: "star", x: 84, y: 22, size: 34, rot: 16 },
      { shape: "heart", x: 82, y: 84, size: 30, rot: -12, fill: true },
      { shape: "squiggle", x: 22, y: 86, size: 70 },
    ],
  },
};

/** The doodles for one card: each draws itself in, then drifts a little. */
export function Doodles({ theme, k }: { theme: Theme; k: string }) {
  const still = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {theme.doodles.map((d, n) => (
        <motion.svg
          key={k + n}
          viewBox="0 0 100 100"
          className="absolute"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size * 1.35, height: d.size * 1.35, x: "-50%", y: "-50%", rotate: d.rot ?? 0, overflow: "visible" }}
          animate={still ? undefined : { y: ["-50%", "-58%", "-50%"], rotate: [(d.rot ?? 0) - 3, (d.rot ?? 0) + 3, (d.rot ?? 0) - 3] }}
          transition={{ duration: 4 + n, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.path
            d={PATHS[d.shape]}
            fill={d.fill ? theme.accent : "none"}
            stroke={theme.accent}
            strokeWidth={d.shape === "dots" ? 9 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, fillOpacity: 0 }}
            animate={{ pathLength: 1, fillOpacity: d.fill ? 0.9 : 0 }}
            transition={{ pathLength: { duration: 0.9, delay: 0.15 + n * 0.12, ease: [0.65, 0, 0.35, 1] }, fillOpacity: { duration: 0.4, delay: 0.9 + n * 0.12 } }}
          />
        </motion.svg>
      ))}
    </div>
  );
}

/** A tilted sticker in the note hand, slapped on as the card arrives. */
export function Sticker({ theme, k }: { theme: Theme; k: string }) {
  return (
    <motion.span
      key={k}
      className="absolute right-5 top-12 z-10 rounded-[12px] px-3 py-1.5 text-[15px] shadow-[0_6px_14px_-6px_rgba(12,14,20,.4)]"
      style={{ background: theme.fg, color: theme.bg === "#ffffff" ? blue : theme.bg, fontFamily: "var(--m-font-note)", fontWeight: 600 }}
      initial={{ scale: 0.4, rotate: -24, opacity: 0 }}
      animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.35 }}
      aria-hidden
    >
      {theme.sticker}
    </motion.span>
  );
}

/** The card's number, with a hand-drawn scribble under it. */
export function Scribble({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span className="relative z-10">{children}</span>
      <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.18em] left-[-4%] h-[0.32em] w-[108%]" aria-hidden>
        <motion.path
          d="M3 12 C40 4 80 4 110 9 S170 17 197 7"
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </span>
  );
}

/** A small pop of confetti for the last card. */
export function Confetti({ color, k }: { color: string; k: string }) {
  const still = useReducedMotion();
  if (still) return null;
  const bits = Array.from({ length: 18 }, (_, n) => {
    const a = (n / 18) * Math.PI * 2;
    return { x: Math.cos(a) * (90 + (n % 3) * 30), y: Math.sin(a) * (90 + (n % 4) * 22), r: n * 40, sq: n % 3 === 0 };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden key={k}>
      {bits.map((b, n) => (
        <motion.span
          key={n}
          className="absolute block"
          style={{ width: b.sq ? 8 : 6, height: b.sq ? 8 : 12, background: n % 2 ? color : "#ffffff", borderRadius: b.sq ? 2 : 6 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: b.x, y: b.y, opacity: 0, rotate: b.r, scale: 1 }}
          transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/** A faint printed texture behind the card. */
export function patternFor(theme: Theme): string | undefined {
  const c = theme.fg === "#ffffff" ? "rgba(255,255,255,.13)" : "rgba(47,69,255,.10)";
  if (theme.pattern === "dots") return `radial-gradient(${c} 1.4px, transparent 1.6px) 0 0 / 16px 16px`;
  if (theme.pattern === "grid") return `linear-gradient(${c} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / 22px 22px`;
  return undefined;
}
