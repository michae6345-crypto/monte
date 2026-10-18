"use client";

import { useBrand } from "./brands";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { CardArt } from "./card-art";
import { Num } from "./num";
import { useAce } from "./store";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { receipt } from "@/lib/engine";
import { useMemo } from "react";

const STATS = [
  ["21.19%", "average credit card APR", "Fed G.19, Aug 2026"],
  ["45%", "of cardholders carried a balance last year", "Fed SHED, May 2026"],
  ["$160B", "paid in card interest in 2024", "CFPB, Dec 2025"],
  ["$31.3B", "paid in card fees in 2024", "CFPB, Dec 2025"],
  ["$1.263T", "of US credit card debt", "NY Fed, Q2 2026"],
  ["~$15B", "a year in rewards flows to people who already know the game", "Federal Reserve study"],
];

export function Nav() {
  const { brand: b } = useBrand();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ace-line/50 bg-ace-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2">
          <b.Mark size={28} />
          <span className="serif text-2xl leading-none">{b.name}</span>
        </a>
        <nav className="mono hidden gap-6 text-[11px] uppercase tracking-[0.18em] text-ace-dim md:flex">
          <a href="#receipt" className="hover:text-ace-ink">Receipt</a>
          <a href="#replay" className="hover:text-ace-ink">Replay</a>
          <a href="#tap" className="hover:text-ace-ink">Tap</a>
          <a href="#keep" className="hover:text-ace-ink">Keep or cancel</a>
          <a href="#moat" className="hover:text-ace-ink">Why {b.name}</a>
        </nav>
        <a href="#receipt" className="rounded-full bg-ace-ink px-4 py-1.5 text-sm font-medium text-ace-bg transition hover:bg-ace-gold">
          Audit a wallet
        </a>
      </div>
    </header>
  );
}

export function Hero() {
  const { persona } = useAce();
  const { brand: b } = useBrand();
  const jr = useMemo(() => receipt(JORDAN.wallet, yearOf(JORDAN)), []);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 18 });
  void persona;

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-24"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 size-[38rem] rounded-full bg-ace-gold/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 size-[34rem] rounded-full bg-ace-gain/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(var(--ace-line) 1px,transparent 1px),linear-gradient(90deg,var(--ace-line) 1px,transparent 1px)", backgroundSize: "56px 56px" }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 md:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mono mb-6 text-[11px] uppercase tracking-[0.25em] text-ace-gold"
          >
            {b.eyebrow}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-[13vw] font-semibold leading-[0.9] tracking-[-0.045em] md:text-[5.6rem]"
          >
            Your cards are <span className="serif text-ace-gold">costing</span> you.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-7 max-w-lg text-lg leading-relaxed text-ace-dim"
          >
            {b.name} picks the right card at every tap, and shows what your cards really cost you: after interest, annual fees
            and the perks you never use.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-9 flex flex-wrap gap-3">
            <a href="#receipt" className="rounded-full bg-ace-gold px-6 py-3 font-medium text-ace-on-accent transition hover:brightness-110">
              See Jordan&apos;s receipt
            </a>
            <a href="#tap" className="rounded-full border border-ace-line px-6 py-3 text-ace-ink transition hover:border-ace-ink/40">
              Try a tap
            </a>
          </motion.div>
        </div>

        <motion.div style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }} className="relative mx-auto h-[300px] w-[320px] md:h-[380px] md:w-[440px]">
          {JORDAN.wallet.map((h, i) => (
            <motion.div
              key={h.cardId}
              initial={{ opacity: 0, y: 60, rotate: 0 }}
              animate={{ opacity: 1, y: i * 34, rotate: -12 + i * 9, x: i * 26 }}
              transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 80, damping: 14 }}
              className="absolute left-0 top-6 w-[260px] md:w-[340px]"
              style={{ zIndex: i }}
            >
              <CardArt id={h.cardId} size="lg" />
            </motion.div>
          ))}
          <Chip className="-left-4 top-0 md:-left-10" tone="gain" delay={1.1}>
            <Num value={jr.rewards} sign /> rewards
          </Chip>
          <Chip className="-right-2 top-28 md:-right-8" tone="loss" delay={1.3}>
            <Num value={-jr.interest} sign /> interest
          </Chip>
          <Chip className="bottom-2 left-10" tone="loss" delay={1.5}>
            <Num value={-jr.fees} sign /> annual fee
          </Chip>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="relative mx-auto mt-14 max-w-6xl px-5 text-center text-ace-dim md:text-left"
      >
        Jordan&apos;s three cards paid him <span className="text-ace-gain">{`$${Math.round(jr.rewards + jr.credits)}`}</span> in
        rewards and perks last year, and charged him <span className="text-ace-loss">{`$${Math.round(jr.fees + jr.interest)}`}</span>{" "}
        in fees and interest.{" "}
        <span className="text-ace-ink">Net: {jr.net < 0 ? "−" : ""}${Math.abs(Math.round(jr.net))}.</span>
      </motion.p>

      <div className="relative mt-14 overflow-hidden border-y border-ace-line py-4">
        <div className="marquee flex w-max gap-12 whitespace-nowrap">
          {[...STATS, ...STATS].map(([n, label, src], i) => (
            <span key={i} className="flex items-baseline gap-3 text-sm">
              <span className="serif text-2xl text-ace-ink">{n}</span>
              <span className="text-ace-dim">{label}</span>
              <span className="mono text-[10px] uppercase tracking-wider text-ace-dim/60">{src}</span>
              <span className="text-ace-gold">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ children, className, tone, delay }: { children: React.ReactNode; className?: string; tone: "gain" | "loss"; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={{ delay, y: { repeat: Infinity, duration: 4, ease: "easeInOut", delay } }}
      className={`mono absolute z-10 rounded-full border px-3.5 py-1.5 text-sm backdrop-blur-md ${
        tone === "gain" ? "border-ace-gain/30 bg-ace-gain/10 text-ace-gain" : "border-ace-loss/30 bg-ace-loss/10 text-ace-loss"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}
