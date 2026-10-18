"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MonteMark } from "./mark";

/** Wraps a computed value in the brand's brackets. Brackets replace bold on this site: a
 *  bracketed figure is always one the engine computed, never a number typed into copy.
 *  - `computing`: brackets blink while the value is being sampled or solved
 *  - `resolved`: the closing bracket turns blue once the value is final */
export function Bracketed({
  children,
  state = "resolved",
  className,
  mono = true,
}: {
  children: ReactNode;
  state?: "rest" | "computing" | "resolved";
  className?: string;
  /** The inside is mono (numbers) by default; set false for words. */
  mono?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      <span className="m-br" data-state={state === "rest" ? undefined : state} aria-hidden>
        [
      </span>
      <span className={cn(mono && "m-num", "px-[0.04em]")}>{children}</span>
      <span className="m-br m-br-close" data-state={state === "rest" ? undefined : state} aria-hidden>
        ]
      </span>
    </span>
  );
}

/** [···] — every wait on the site. Three samples landing. Give it a label for screen readers. */
export function Sampler({ label = "Computing", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline", className)} role="status" aria-label={label}>
      <span className="m-br" aria-hidden>
        [
      </span>
      <span aria-hidden className="inline-flex gap-[0.12em] px-[0.1em] font-bold" style={{ color: "var(--m-ink)" }}>
        <span className="m-dot">·</span>
        <span className="m-dot">·</span>
        <span className="m-dot">·</span>
      </span>
      <span className="m-br" aria-hidden>
        ]
      </span>
    </span>
  );
}

/** 𝔼[net] = +$104 — an expectation written the way the brand writes it. Use it for any
 *  Monte Carlo answer: 𝔼[net], 𝔼[rewards], 𝔼[interest], P[ahead]. */
export function Expect({
  of,
  children,
  op = "𝔼",
  state = "resolved",
  tone,
  className,
}: {
  /** The quantity inside the brackets, lower case: "net", "rewards", "interest". */
  of: string;
  /** The value, already formatted. Omit it to show the expectation alone. */
  children?: ReactNode;
  op?: "𝔼" | "P" | "σ";
  state?: "computing" | "resolved";
  tone?: "gain" | "loss";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.3em]", className)}>
      <span style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.04em" }}>
        {op === "𝔼" ? <MonteMark size="0.72em" className="mr-[0.06em]" /> : op}
        <span className="m-br" data-state={state}>
          [
        </span>
        {of}
        <span className="m-br m-br-close" data-state={state}>
          ]
        </span>
      </span>
      {children !== undefined && (
        <>
          <span className="m-num" style={{ color: "var(--m-slate)" }}>
            =
          </span>
          <span className={cn("m-num", tone === "gain" && "m-gain", tone === "loss" && "m-loss")}>
            {state === "computing" ? <Sampler /> : children}
          </span>
        </>
      )}
    </span>
  );
}
