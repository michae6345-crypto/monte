"use client";

// A scroll stage, the way spacefs tells its story: a tall block whose content stays pinned
// while you scroll through it, and the scroll position drives the product forward.

import { useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

export function Stage({ vh = 240, children, className }: { vh?: number; children: (p: number) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const q = Math.round(v * 100) / 100;
    setP((old) => (old === q ? old : q));
  });
  return (
    <div ref={ref} className={className} style={{ height: `${vh}vh` }}>
      <div className="sticky top-0 flex min-h-[100svh] items-center">
        <div className="w-full">{children(p)}</div>
      </div>
    </div>
  );
}

/** A thin progress rail with labelled steps, so the visitor knows scrolling does something. */
export function StageSteps({ steps, p }: { steps: string[]; p: number }) {
  const at = Math.min(steps.length - 1, Math.floor(p * steps.length));
  return (
    <div className="m-label flex flex-wrap items-center gap-3">
      {steps.map((s, i) => (
        <span key={s} className={`flex items-center gap-2 transition-opacity ${i <= at ? "opacity-100" : "opacity-35"}`}>
          <span className={`inline-block h-[3px] w-8 rounded-full ${i <= at ? "bg-ace-ink" : "bg-[var(--m-line-strong)]"}`} />
          {s}
        </span>
      ))}
      <span className="ml-auto normal-case tracking-normal">{at < steps.length - 1 ? "keep scrolling ↓" : ""}</span>
    </div>
  );
}
