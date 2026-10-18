"use client";

import { useBrand } from "./brands";
import { motion, useInView } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { cardArt, shortName } from "./card-art";
import { Num } from "./num";
import { Bracketed, HandNote } from "@/components/brand";
import { R, Section } from "./section";
import { money, useAce } from "./store";

const W = 1000;
const LANE = 64;

export function ReplaySection() {
  const { wallet, r, txns, persona } = useAce();
  const [mode, setMode] = useState<"actual" | "best">("actual");
  const { brand: b } = useBrand();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });

  const ids = wallet.map((h) => h.cardId);
  const H = ids.length * LANE + 24;
  const t0 = new Date(txns[0]?.date ?? "2025-10-18").getTime();
  const span = 365 * 86400000;

  const dots = useMemo(() => {
    const a = new Map(r.actual.hits.map((h) => [h.txnId, h]));
    const b = new Map(r.best.hits.map((h) => [h.txnId, h]));
    return txns.map((t, i) => {
      const ha = a.get(t.id)!;
      const hb = b.get(t.id)!;
      const x = 16 + ((new Date(t.date).getTime() - t0) / span) * (W - 32);
      const jitter = ((i * 37) % 23) - 11;
      return {
        id: t.id,
        x,
        ya: 12 + ids.indexOf(ha.cardId) * LANE + LANE / 2 + jitter,
        yb: 12 + ids.indexOf(hb.cardId) * LANE + LANE / 2 + jitter,
        r: Math.max(2, Math.min(7, Math.sqrt(t.amount) / 2.2)),
        moved: ha.cardId !== hb.cardId,
        gain: hb.reward - ha.reward,
        ca: ha.cardId,
        cb: hb.cardId,
        cat: t.category,
      };
    });
  }, [r, txns, ids, t0, span]);

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of dots) if (d.moved) m[d.cat] = (m[d.cat] ?? 0) + d.gain;
    return Object.entries(m)
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [dots]);

  const moved = dots.filter((d) => d.moved).length;

  return (
    <Section
      id="replay"
      index="04"
      kicker="Replay"
      title={
        <>
          {persona.id === "you" ? "You" : persona.name} left <Bracketed>{money(r.leftOnTable)}</Bracketed> on the table.
          <span className="m-second block">Same purchases, better cards.</span>
        </>
      }
      readout={
        <>
          <R>{moved}</R> of <R>{txns.length}</R> purchases move · <R tone="gain">{money(r.leftOnTable, { sign: true })}</R> back from the table
        </>
      }
      lede={`Each dot is one of ${persona.name}'s purchases, placed on the card that paid for it. Flip to ${b.name} and watch them move to the card that should have.`}
    >
      <div ref={ref} className="m-panel p-5 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full p-1" style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}>
            {(["actual", "best"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-5 py-2 text-sm transition ${mode === m ? "bg-ace-ink text-ace-bg" : "text-ace-dim hover:text-ace-ink"}`}
              >
                {m === "actual" ? `What ${persona.name} did` : `What ${b.name} would do`}
              </button>
            ))}
          </div>
          {mode === "actual" && (
            <HandNote dir="left" className="hidden lg:flex" delay={0.3}>
              flip it and watch the dots move
            </HandNote>
          )}
          <div className="text-right">
            <div className="m-label">{mode === "best" ? "Rewards, played right" : "Rewards, as played"}</div>
            <div className="m-num text-5xl">
              <Num value={mode === "best" ? r.best.total : r.actual.total} />
            </div>
            <div className={`mono mt-1 text-xs transition-opacity ${mode === "best" ? "text-ace-gain opacity-100" : "opacity-0"}`}>
              {money(r.leftOnTable, { sign: true })} from the same purchases
            </div>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 sm:hidden">
          {ids.map((id) => (
            <span key={id} className="mono flex items-center gap-1.5 text-[11px] text-ace-dim">
              <span className="h-3 w-1 rounded-sm" style={{ background: cardArt(id).bg }} />
              {shortName(id)}
            </span>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="hidden w-36 shrink-0 sm:block">
            {ids.map((id) => (
              <div key={id} style={{ height: LANE }} className="flex items-center gap-2">
                <span className="h-6 w-1.5 rounded-full" style={{ background: cardArt(id).bg }} />
                <span className="text-sm leading-tight">{shortName(id)}</span>
              </div>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="min-w-0 flex-1 overflow-visible" style={{ height: "auto" }}>
            {ids.map((id, i) => (
              <line key={id} x1={0} x2={W} y1={12 + i * LANE + LANE / 2} y2={12 + i * LANE + LANE / 2} stroke="var(--ace-line)" strokeDasharray="2 6" />
            ))}
            {["Nov", "Jan", "Mar", "May", "Jul", "Sep"].map((m, i) => (
              <text key={m} x={16 + (i * 2 + 0.5) * ((W - 32) / 12)} y={H + 2} className="mono" fontSize={11} fill="var(--ace-dim)">
                {m}
              </text>
            ))}
            {dots.map((d, i) => {
              const y = mode === "actual" ? d.ya : d.yb;
              const card = mode === "actual" ? d.ca : d.cb;
              return (
                <motion.circle
                  key={d.id}
                  cx={d.x}
                  r={d.r}
                  initial={{ cy: d.ya, opacity: 0 }}
                  animate={inView ? { cy: y, opacity: 1 } : {}}
                  transition={{
                    cy: { type: "spring", stiffness: 70, damping: 13, delay: d.moved ? (i % 60) * 0.012 : 0 },
                    opacity: { delay: (d.x / W) * 1.2, duration: 0.3 },
                  }}
                  fill={mode === "best" && d.moved ? "var(--ace-gain)" : card === "apple_card" ? "#d9d9de" : extractColor(card)}
                  fillOpacity={mode === "best" && !d.moved ? 0.35 : 0.85}
                />
              );
            })}
          </svg>
        </div>

        <div className="mt-8 grid gap-6 border-t border-ace-line pt-6 md:grid-cols-[1fr_1.4fr]">
          <p className="text-ace-dim">
            {mode === "best" ? (
              <>
                <span className="text-ace-ink">{moved} of {dots.length}</span> purchases should have gone on a different card. {b.name}
                respects every cap and quarter{wallet.some((h) => h.balance) ? ", and never routes new spending to a card carrying a balance: those purchases start charging interest the day you make them" : ""}.
              </>
            ) : (
              <>Flip to “What {b.name} would do” to re-route the year.</>
            )}
          </p>
          <div className="space-y-2">
            {byCat.map(([cat, v]) => (
              <div key={cat} className="flex items-center gap-3 text-sm">
                <span className="mono w-28 shrink-0 text-[11px] uppercase tracking-wider text-ace-dim">{cat.replace(/_/g, " ")}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ace-line">
                  <motion.div
                    className="h-full rounded-full bg-ace-gain"
                    initial={{ width: 0 }}
                    animate={{ width: mode === "best" ? `${(v / byCat[0][1]) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className="mono w-14 text-right text-ace-gain">{mode === "best" ? `+$${Math.round(v)}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function extractColor(id: string) {
  const m = cardArt(id).bg.match(/#[0-9a-f]{6}/gi);
  return m ? m[1] ?? m[0] : "#888";
}
