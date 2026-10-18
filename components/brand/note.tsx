"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Hand annotations, after the Hivemind site's: Shantell Sans in slate, with a pencil arrow that
// draws itself in. They explain a number or a chart the way a person would in the margin.

export type ArrowDir = "left" | "right" | "down-left" | "down-right" | "up-left" | "up-right" | "down" | "up";

// Each arrow lives in a 48x36 box and is drawn from the end nearest the text to the head.
const ARROWS: Record<"side" | "down" | "up" | "vdown", { stem: string; head: string }> = {
  side: { stem: "M46 17c-9-7-22 8-40 2", head: "M12 13L5 19l8 4" },
  down: { stem: "M44 5C30 3 14 11 8 30", head: "M3 22l5 9 7-6" },
  up: { stem: "M44 31C30 33 14 25 8 6", head: "M3 14l5-9 7 6" },
  vdown: { stem: "M24 2c-7 10 6 20 0 31", head: "M18 26l6 8 5-8" },
};

export function Arrow({ dir = "left", delay = 0, className }: { dir?: ArrowDir; delay?: number; className?: string }) {
  const kind = dir === "left" || dir === "right" ? "side" : dir === "down" || dir === "up" ? "vdown" : dir.startsWith("down") ? "down" : "up";
  const a = ARROWS[kind];
  const flip = dir === "right" || dir.endsWith("-right");
  const vflip = dir === "up";
  const draw = {
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, amount: 0.6 },
  };
  return (
    <svg
      viewBox="0 0 48 36"
      className={cn("h-7 w-9 shrink-0 overflow-visible", flip && "-scale-x-100", vflip && "-scale-y-100", className)}
      fill="none"
      aria-hidden
    >
      <motion.path d={a.stem} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...draw} transition={{ duration: 0.6, delay, ease: "easeInOut" }} />
      <motion.path
        d={a.head}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw}
        transition={{ duration: 0.25, delay: delay + 0.55, ease: "easeOut" }}
      />
    </svg>
  );
}

/** A margin note with an arrow. `dir` is where the arrow points; the text sits on the other
 *  side. Decorative (aria-hidden): whatever a note says must also be in the real copy or a label. */
export function HandNote({
  children,
  dir = "left",
  delay = 0,
  width,
  className,
}: {
  children: ReactNode;
  dir?: ArrowDir;
  delay?: number;
  width?: number;
  className?: string;
}) {
  const arrowFirst = dir === "left" || dir.endsWith("-left") || dir === "up";
  const vertical = dir === "up" || dir === "down";
  return (
    <span
      className={cn(
        "pointer-events-none flex gap-1",
        vertical ? "flex-col items-center text-center" : dir.startsWith("down") ? "items-start" : dir.startsWith("up") ? "items-end" : "items-center",
        className,
      )}
      style={{ color: "var(--m-slate)" }}
      aria-hidden
    >
      {arrowFirst && <Arrow dir={dir} delay={delay + 0.2} />}
      <motion.span
        initial={{ opacity: 0, y: 4, rotate: -1.5 }}
        whileInView={{ opacity: 1, y: 0, rotate: -1.5 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, delay }}
        className="m-note text-[15px]"
        style={{ width }}
      >
        {children}
      </motion.span>
      {!arrowFirst && <Arrow dir={dir} delay={delay + 0.2} />}
    </span>
  );
}

/** A circled or underlined call-out drawn over a number, in slate, like a pen mark. Wrap the
 *  thing being marked. */
export function PenMark({ children, kind = "circle", delay = 0.3 }: { children: ReactNode; kind?: "circle" | "underline"; delay?: number }) {
  const d = kind === "circle" ? "M8 30C4 14 30 3 62 5s52 10 50 26-36 22-64 20S4 42 10 26" : "M2 6c30-4 70-4 108 0";
  return (
    <span className="relative inline-block">
      {children}
      <svg
        viewBox={kind === "circle" ? "0 0 120 56" : "0 0 112 10"}
        preserveAspectRatio="none"
        className={cn(
          "pointer-events-none absolute overflow-visible",
          kind === "circle" ? "-inset-x-[14%] -inset-y-[30%] h-[160%] w-[128%]" : "-bottom-[0.25em] left-0 h-[0.4em] w-full",
        )}
        fill="none"
        aria-hidden
        style={{ color: "var(--m-slate)" }}
      >
        <motion.path
          d={d}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.7, delay, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </span>
  );
}
