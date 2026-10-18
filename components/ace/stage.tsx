"use client";

// A scroll stage, the way spacefs tells its story: a tall block whose content stays pinned
// while you scroll through it, and the scroll position drives the product forward.

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Stage({ vh = 240, children, className }: { vh?: number; children: (p: number) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  // pinning only where there's room for it; phones and small screens get the finished view
  const [pin, setPin] = useState(true);
  // the pinned block is as tall as its content and centred by its sticky offset, so there is
  // no empty band between a heading and the stage (audit 2, #15)
  const inner = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(56);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const fit = () => {
      const room = window.innerHeight - 56 - el.offsetHeight;
      setTop(room >= 0 ? 56 + room / 2 : 56 + room - 16);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // and once now: observers wait for a paint, which a background tab may never do
    const t = window.setTimeout(fit, 0);
    window.addEventListener("resize", fit);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [pin]);
  // plain scroll events (not animation frames), so it tracks in every browser state
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px) and (min-height: 640px)");
    const on = () => {
      if (!mq.matches) {
        setPin(false);
        setP(1);
        return;
      }
      setPin(true);
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const v = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : r.top < 0 ? 1 : 0;
      const q = Math.round(v * 100) / 100;
      setP((old) => (old === q ? old : q));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  if (!pin)
    return (
      <div ref={ref} className={className}>
        {children(p)}
      </div>
    );
  return (
    <div ref={ref} data-stage className={className} style={{ height: `${vh}vh` }}>
      <div ref={inner} className="sticky" style={{ top }}>
        {children(p)}
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
        <span key={s} className={`flex items-center gap-2 ${i === at ? "font-semibold" : ""}`}>
          <span className={`inline-block h-[3px] w-8 rounded-full ${i <= at ? "bg-ace-ink" : "bg-[var(--m-line-strong)]"}`} />
          {s}
        </span>
      ))}
      <span className="ml-auto normal-case tracking-normal">{at < steps.length - 1 ? "keep scrolling ↓" : ""}</span>
    </div>
  );
}
