"use client";

// Trace: hover, focus or tap a dollar figure and see where it came from (BRAND.md §4, #21):
// the arithmetic, the card rule, the issuer page and the date it was checked. Built on the
// engine's provenance (lib/engine/provenance.ts, SPEC #19).

import { useId, useState, type ReactNode } from "react";
import type { ProvenanceLine } from "@/lib/engine/provenance";
import { cn } from "@/lib/utils";

const host = (u?: string) => {
  try {
    return new URL(u ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "no source on file";
  }
};

export function Trace({ lines, children, className, align = "right" }: { lines: ProvenanceLine[]; children: ReactNode; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!lines.length) return <>{children}</>;
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="cursor-help underline decoration-[var(--m-line-strong)] decoration-dotted underline-offset-[3px]"
      >
        {children}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "m-mono absolute top-full z-40 mt-2 w-[min(340px,80vw)] rounded-[10px] bg-ace-panel p-3 text-left text-[11px] leading-relaxed text-ace-ink shadow-[0_0_0_1px_var(--m-line-strong),0_12px_32px_-16px_rgba(14,15,18,.35)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {lines.map((l, i) => (
            <span key={i} className={cn("block", i > 0 && "mt-2 border-t border-[var(--m-line)] pt-2")}>
              <span className="block text-ace-ink">{l.math}</span>
              {"rule" in l && l.rule ? <span className="block text-ace-dim">rule: {l.rule}</span> : null}
              <span className="block text-ace-dim">
                {l.source.cardName} ·{" "}
                <a href={l.source.sourceUrls[0]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ace-ink">
                  {host(l.source.sourceUrls[0])}
                </a>{" "}
                · checked {l.source.checked ?? "unknown"}
                {l.source.unverified ? <span className="ml-1 rounded-full px-1.5 shadow-[0_0_0_1px_var(--m-line-strong)]">unverified</span> : null}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
