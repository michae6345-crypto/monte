"use client";

import { useBrand } from "./brands";
import { motion, useInView } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { cardArt, shortName } from "./card-art";
import { Bracketed, HandNote } from "@/components/brand";
import { R, Section } from "./section";
import { money, nameOf, useAce } from "./store";
import { Stage, StageSteps } from "./stage";
import { OneCardView } from "./one-card";

const W = 1000;
const LANE = 64;

export function ReplaySection() {
  const { held: wallet, r, txns, persona } = useAce();
  const [mode, setModeRaw] = useState<"actual" | "best">("actual");
  // until someone clicks the toggle, scrolling sweeps the year from left to right
  const [manual, setManual] = useState(false);
  const setMode = (m: "actual" | "best") => {
    setManual(true);
    setModeRaw(m);
  };
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
    let off = 0;
    for (const d of dots)
      if (d.moved) {
        if (d.gain >= 0) m[d.cat] = (m[d.cat] ?? 0) + d.gain;
        else off += d.gain;
      }
    const rows = Object.entries(m)
      .filter(([, v]) => v >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    // purchases moved off a card carrying a balance earn less, but stop charging interest
    if (off < -0.5) rows.push(["off the card with a balance", off]);
    // whatever the small categories add, so the rows sum to the headline
    const all = dots.reduce((t, d) => t + (d.moved ? d.gain : 0), 0);
    const rest = all - rows.reduce((t, [, v]) => t + v, 0);
    if (Math.abs(rest) >= 0.5) rows.splice(rows.length - (off < -0.5 ? 1 : 0), 0, ["everything else", rest]);
    return rows;
  }, [dots]);

  const moved = dots.filter((d) => d.moved).length;

  if (wallet.length === 1)
    return (
      <Section id="replay" index="04" kicker="Replay" title={<>One card does everything.</>}>
        <OneCardView />
      </Section>
    );

  return (
    <Section
      id="replay"
      index="04"
      kicker="Replay"
      title={
        <>
          {nameOf(persona).Who} left <Bracketed>{money(r.leftOnTable)}</Bracketed> on the table.
          <span className="m-second block">Same purchases, cards already in the wallet.</span>
        </>
      }
      readout={
        <>
          <R>{moved}</R> of <R>{txns.length}</R> purchases move · <R tone="gain">{money(r.leftOnTable, { sign: true })}</R> back from the table
        </>
      }
      lede={`Each dot is one of ${nameOf(persona).whose} purchases, placed on the card that paid for it. Flip to ${b.name} and watch them move to the card that should have.`}
    >
      <Stage vh={190}>
        {(p) => {
          // the sweep: a line crosses the year; every purchase it passes moves to Monte's pick
          const f = manual ? (mode === "best" ? 1 : 0) : Math.min(1, Math.max(0, (p - 0.12) / 0.72));
          const shown = f >= 1 ? "best" : f <= 0 ? "actual" : "sweep";
          const passed = (x: number) => x / W <= f;
          const sofar = r.actual.total + dots.reduce((a, d) => a + (passed(d.x) ? d.gain : 0), 0);
          const view = shown === "sweep" ? (f > 0.5 ? "best" : "actual") : shown;
          const barsOn = shown === "best";
          return (
      <div ref={ref} className="m-panel p-5 md:p-8">
        <div className="mb-5">
          <StageSteps steps={["as paid", "the sweep", "on Monte's pick"]} p={p} />
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full p-1" style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}>
            {(["actual", "best"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-5 py-2 text-sm transition ${view === m ? "bg-ace-ink text-ace-bg" : "text-ace-dim hover:text-ace-ink"}`}
              >
                {m === "actual" ? `What ${nameOf(persona).who} did` : `What ${b.name} would do`}
              </button>
            ))}
          </div>
          {shown === "actual" && (
            <HandNote dir="left" className="hidden lg:flex" delay={0.3}>
              scroll, or flip it, and watch the dots move
            </HandNote>
          )}
          <div className="text-right">
            <div className="m-label">{shown === "actual" ? "Rewards, as played" : shown === "best" ? "Rewards, played right" : "Rewards, replayed so far"}</div>
            <div className="text-6xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.04em" }}>
              <span className="tnum">{money(shown === "best" ? r.best.total : shown === "actual" ? r.actual.total : sofar)}</span>
            </div>
            <div className={`mono mt-1 text-xs transition-opacity ${shown !== "actual" ? "text-ace-gain opacity-100" : "opacity-0"}`}>
              {money((shown === "best" ? r.best.total : sofar) - r.actual.total, { sign: true })} from the same purchases
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
            {f > 0 && f < 1 && (
              <line x1={f * W} x2={f * W} y1={0} y2={H - 6} strokeWidth={2} style={{ stroke: "var(--m-accent)" }} />
            )}
            {dots.map((d, i) => {
              const moveIt = passed(d.x);
              const y = moveIt ? d.yb : d.ya;
              const card = moveIt ? d.cb : d.ca;
              return (
                <motion.circle
                  key={d.id}
                  cx={d.x}
                  r={d.r}
                  initial={{ cy: d.ya, opacity: 0 }}
                  animate={inView ? { cy: y, opacity: 1 } : {}}
                  transition={{
                    cy: { type: "spring", stiffness: 90, damping: 14, delay: manual && d.moved ? (i % 60) * 0.012 : 0 },
                    opacity: { delay: (d.x / W) * 1.2, duration: 0.3 },
                  }}
                  fill={moveIt ? (d.moved ? "var(--m-ink)" : "var(--m-mute)") : card === "apple_card" ? "#8f949c" : extractColor(card)}
                  fillOpacity={moveIt && !d.moved ? 0.35 : 0.85}
                />
              );
            })}
          </svg>
        </div>

        <div className="mt-8 grid gap-6 border-t border-ace-line pt-6 md:grid-cols-[1fr_1.4fr]">
          <p className="text-ace-dim">
            {view === "best" ? (
              <>
                <span className="text-ace-ink">{moved} of {dots.length}</span> purchases should have gone on a different card. {b.name}{" "}
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
                    className={`h-full rounded-full ${v < 0 ? "bg-ace-loss" : "bg-ace-ink"}`}
                    initial={{ width: 0 }}
                    animate={{ width: barsOn ? `${(Math.abs(v) / byCat[0][1]) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className={`mono w-16 text-right ${v < 0 ? "text-ace-loss" : "text-ace-gain"}`}>{barsOn ? money(v, { sign: true }) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
          );
        }}
      </Stage>
    </Section>
  );
}

function extractColor(id: string) {
  const m = cardArt(id).bg.match(/#[0-9a-f]{6}/gi);
  return m ? m[1] ?? m[0] : "#888";
}
