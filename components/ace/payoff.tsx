"use client";

// Pay this first: the balance is the card decision that matters most. Pick a monthly payment
// and see the payoff month by month against minimum payments, then what the wallet looks like
// once it's clear (Michael's engine, monteCarlo with assumePaidOff, labelled as a projection).

import { useMemo, useState } from "react";
import { card } from "@/lib/engine/catalog";
import { monteCarlo } from "@/lib/engine/montecarlo";
import { Bracketed, Expect, HandNote } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { Section } from "./section";
import { Stage } from "./stage";
import { money, useAce } from "./store";

type Debt = { cardId: string; balance: number; apr: number };
type Path = { months: number; interest: number; series: number[]; paid: number[] };

/** Avalanche: pay the highest APR first, the rest at minimum, interest monthly at APR/12. */
function payoff(debts: Debt[], monthly: number, cap = 600): Path {
  const b = debts.map((d) => d.balance);
  const order = debts.map((d, i) => i).sort((x, y) => debts[y].apr - debts[x].apr);
  const series = [b.reduce((a, x) => a + x, 0)];
  const paid = [0];
  let interest = 0;
  let m = 0;
  while (b.some((x) => x > 0.005) && m < cap) {
    m++;
    let pay = monthly;
    for (let i = 0; i < b.length; i++) {
      if (b[i] <= 0) continue;
      const int = (b[i] * debts[i].apr) / 100 / 12;
      b[i] += int;
      interest += int;
    }
    for (const i of order) {
      if (pay <= 0) break;
      const p = Math.min(pay, b[i]);
      b[i] -= p;
      pay -= p;
    }
    series.push(Math.max(0, b.reduce((a, x) => a + x, 0)));
    paid.push(interest);
  }
  return { months: m, interest, series, paid };
}

/** A typical card minimum: the month's interest plus 1% of the balance, at least $35. */
function minimums(debts: Debt[], cap = 600): Path {
  const b = debts.map((d) => d.balance);
  const series = [b.reduce((a, x) => a + x, 0)];
  let interest = 0;
  let m = 0;
  while (b.some((x) => x > 0.005) && m < cap) {
    m++;
    for (let i = 0; i < b.length; i++) {
      if (b[i] <= 0) continue;
      const int = (b[i] * debts[i].apr) / 100 / 12;
      const pay = Math.min(b[i] + int, Math.max(35, int + b[i] * 0.01));
      b[i] += int - pay;
      interest += int;
    }
    series.push(Math.max(0, b.reduce((a, x) => a + x, 0)));
  }
  return { months: m, interest, series, paid: [] };
}

const span = (m: number) => (m >= 24 ? `${Math.floor(m / 12)} yr ${m % 12 ? `${m % 12} mo` : ""}`.trim() : `${m} months`);

export function PayoffSection() {
  const { wallet, txns, persona, valuation } = useAce();
  const who = persona.id === "you" ? "You" : persona.name;
  const debts = useMemo<Debt[]>(
    () =>
      wallet
        .filter((h) => (h.balance ?? 0) > 0)
        .map((h) => ({ cardId: h.cardId, balance: h.balance!, apr: h.apr ?? card(h.cardId).purchase_apr_range[1] })),
    [wallet],
  );
  const total = debts.reduce((a, d) => a + d.balance, 0);
  const firstInterest = debts.reduce((a, d) => a + (d.balance * d.apr) / 1200, 0);
  const [monthly, setMonthly] = useState(250);

  const mine = useMemo(() => payoff(debts, Math.max(monthly, debts.reduce((a, d) => a + (d.balance * d.apr) / 1200, 0) + 5)), [debts, monthly]);
  const mins = useMemo(() => minimums(debts), [debts]);

  // the engine's projection of the paid-off wallet (explicitly hypothetical)
  const proj = useMemo(() => {
    if (!debts.length) return null;
    const now = monteCarlo(wallet, txns, { years: 1000, seed: 42 });
    const after = monteCarlo(wallet, txns, { years: 1000, seed: 42, assumePaidOff: true });
    if (!after.hypothetical) return null;
    const add = after.options.find((o) => o.id.startsWith("add:"));
    return { now, after, add };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, valuation]);

  if (!debts.length)
    return (
      <Section id="payoff" index="06½" kicker="Pay this first" title={<>Nothing to pay down.</>}>
        <div className="m-panel p-8 text-lg">
          {who} {who === "You" ? "pay" : "pays"} {wallet.length === 1 ? "the card" : "every card"} in full, so there is no interest to stop. The next move is in Keep or cancel and What to apply
          for.
        </div>
      </Section>
    );

  const W = 640;
  const H = 220;
  const months = Math.max(mine.months, Math.min(mins.months, 120));
  const x = (m: number) => 8 + (m / months) * (W - 16);
  const y = (v: number) => 12 + (1 - v / total) * (H - 36);
  const line = (s: number[]) => s.slice(0, months + 1).map((v, m) => `${m ? "L" : "M"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (s: number[]) => `${line(s)} L${x(Math.min(s.length - 1, months)).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
  const saved = mins.interest - mine.interest;
  const debtNames = debts.map((d) => shortName(d.cardId)).join(" and ");

  return (
    <Section
      id="payoff"
      index="06½"
      kicker="Pay this first"
      title={
        <>
          Clear the {debtNames} in <Bracketed>{span(mine.months)}</Bracketed>.
          <span className="m-second block">Before any new card.</span>
        </>
      }
      readout={
        <>
          {money(total)} at {debts.map((d) => `${d.apr}%`).join(", ")} APR · {money(firstInterest, { cents: true })} of interest this month
        </>
      }
      lede={`${who} carries ${money(total)}. Every month it costs ${money(firstInterest, { cents: true })} in interest, more than any card in the wallet earns. Pick a monthly payment and see how fast it goes.`}
    >
      <Stage vh={190}>
        {(p) => {
          const cur = Math.min(mine.months, Math.round(Math.min(1, Math.max(0, (p - 0.08) / 0.8)) * mine.months));
          const done = cur >= mine.months;
          return (
      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="m-panel relative p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label htmlFor="pay" className="m-label">
              pay each month
            </label>
            <input
              id="pay"
              type="range"
              min={Math.ceil((firstInterest + 10) / 25) * 25}
              max={1200}
              step={25}
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
              className="h-1 min-w-[160px] flex-1 cursor-pointer accent-[var(--m-ink)]"
            />
            <span className="m-num w-20 text-right text-xl">{money(monthly)}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Paying ${money(monthly)} a month clears it in ${span(mine.months)} with ${money(mine.interest)} of interest; minimum payments take ${span(mins.months)} and ${money(mins.interest)}.`}>
            <path d={area(mins.series)} style={{ fill: "var(--m-wash)" }} />
            <path d={line(mins.series)} fill="none" strokeWidth={1.25} strokeDasharray="4 4" style={{ stroke: "var(--m-slate)" }} />
            <path d={area(mine.series.slice(0, cur + 1))} style={{ fill: "color-mix(in oklab, var(--m-ink) 10%, transparent)" }} />
            <path d={line(mine.series.slice(0, cur + 1))} fill="none" strokeWidth={2.5} style={{ stroke: "var(--m-ink)" }} />
            <circle cx={x(cur)} cy={y(mine.series[cur] ?? 0)} r={6} style={{ fill: done ? "var(--m-accent)" : "var(--m-ink)" }} />
            {done && (
              <>
                <line x1={x(mine.months)} x2={x(mine.months)} y1={y(total)} y2={y(0)} strokeDasharray="2 3" style={{ stroke: "var(--m-accent)" }} />
                <text x={Math.min(x(mine.months) + 6, W - 90)} y={y(total * 0.85)} fontSize={11} className="m-mono" style={{ fill: "var(--m-accent)" }}>
                  paid off · {span(mine.months)}
                </text>
              </>
            )}
            <text x={8} y={H - 6} fontSize={11} className="m-mono" style={{ fill: "var(--m-ink)" }}>
              now
            </text>
            <text x={W - 8} y={H - 6} fontSize={11} textAnchor="end" className="m-mono" style={{ fill: "var(--m-ink)" }}>
              {span(months)}
              {mins.months > months ? " →" : ""}
            </text>
          </svg>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.02em" }}>
            <span className="text-2xl">{cur === 0 ? "Today" : `Month ${cur}`}</span>
            <span className="text-2xl">{money(mine.series[cur] ?? 0)} left</span>
            <span className="text-2xl text-ace-loss">{cur === 0 ? "no interest yet" : `${money(-(mine.paid[cur] ?? 0), { sign: true })} interest so far`}</span>
          </div>
          <dl className="m-num mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-[var(--m-line)] text-[12px] sm:grid-cols-4">
            {[
              ["your plan", span(mine.months), "ink"],
              ["interest", money(-mine.interest, { sign: true }), "loss"],
              ["minimums", mins.months >= 600 ? "50+ yr" : span(mins.months), "dim"],
              ["their interest", money(-mins.interest, { sign: true }), "loss"],
            ].map(([k, v, t]) => (
              <div key={k} className="bg-ace-panel px-3 py-2.5">
                <dt className="text-ace-dim">{k}</dt>
                <dd className={`mt-0.5 text-[15px] ${t === "loss" ? "text-ace-loss" : t === "dim" ? "text-ace-dim" : "text-ace-ink"}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {saved > 1 && (
            <HandNote dir="up-left" className="mt-3 hidden md:flex" delay={0.2}>
              {`${money(saved)} less interest than paying the minimum`}
            </HandNote>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-ace-dim">
            Interest charged monthly at the card&apos;s APR; the minimum is the month&apos;s interest plus 1% of the balance, at least $35 (a common
            issuer formula). Monte keeps new spending off the card while you pay it down.
          </p>
        </div>

        <div className={`m-panel p-5 transition-opacity duration-500 md:p-6 ${done ? "opacity-100" : "opacity-40"}`}>
          <p className="m-label">once it&apos;s clear</p>
          {proj && proj.after.hypothetical ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ace-dim">
                Projection, not today: the same purchases with {money(proj.after.hypothetical.clearedBalance)} cleared on the{" "}
                {proj.after.hypothetical.cards.map(shortName).join(" and ")}.
              </p>
              <div className="mt-5 space-y-2 text-xl">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ace-dim">today</span>
                  <Expect of="net" tone={proj.now.current.p50 >= 0 ? "gain" : "loss"}>
                    {money(proj.now.current.p50, { sign: true })}
                  </Expect>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ace-dim">paid off</span>
                  <Expect of="net" tone={proj.after.current.p50 >= 0 ? "gain" : "loss"}>
                    {money(proj.after.current.p50, { sign: true })}
                  </Expect>
                </div>
              </div>
              <div className="my-5 border-t border-ace-line" />
              {proj.add ? (
                <div className="flex items-center gap-4">
                  <CardArt id={proj.add.id.slice(4)} size="sm" className="w-20 shrink-0" />
                  <div className="min-w-0">
                    <p className="m-label">then the first card worth adding</p>
                    <p className="mt-1 font-medium">{shortName(proj.add.id.slice(4))}</p>
                    <p className="m-num mt-0.5 text-[12px] text-ace-dim">
                      {money(proj.add.p50 - proj.after.current.p50, { sign: true })}/yr median · ahead in{" "}
                      {Math.round(proj.add.winShare * proj.after.years).toLocaleString()} of {proj.after.years.toLocaleString()} years
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ace-dim">No new card beats this wallet on {who === "You" ? "your" : `${who}'s`} spending.</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-ace-dim">Projection unavailable.</p>
          )}
        </div>
      </div>
          );
        }}
      </Stage>
    </Section>
  );
}
