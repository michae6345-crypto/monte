"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { marginalValue, interestFor, pointValue } from "@/lib/engine";
import { CARDS, card, creditPerYear } from "@/lib/engine/catalog";
import { CardArt, nick, shortName } from "./card-art";
import { R, Section } from "./section";
import { money, nameOf, useAce, v } from "./store";
import { useDrift, useMonteCarlo } from "./odds";
import { addMedians, addShortlist } from "./adds";
import { Estimator } from "@/components/brand";
import { monteCarloSamples } from "@/lib/engine/montecarlo";

export function KeepSection() {
  const { held: wallet, txns, valuation } = useAce();
  const mc = useMonteCarlo(wallet);
  const drift = useDrift();
  const rows = useMemo(
    () =>
      wallet.map((h) => ({
        h,
        m: marginalValue(wallet, txns, h.cardId),
        interest: interestFor(h),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, txns, valuation],
  );
  const span = Math.max(
    60,
    ...rows.flatMap(({ m, interest }) => [
      m.fee + interest,
      m.rewardsAdded + m.credits,
    ]),
  );

  // The biggest fee in the wallet, played both ways over the engine's 1,000 resampled years:
  // each sample is next year's net with the card minus without it.
  const keepCase = useMemo(() => {
    const fee = rows
      .filter((x) => x.m.fee > 0)
      .sort((a, b) => b.m.fee - a.m.fee)[0];
    if (!fee) return null;
    const s = monteCarloSamples(wallet, txns, {
      years: 1000,
      seed: 42,
      driftSd: drift,
    });
    const cur = s.options.find((o) => o.id === "current");
    const drop = s.options.find((o) => o.id === `drop:${fee.h.cardId}`);
    if (!cur || !drop) return null;
    const diff = Array.from(cur.net, (v, i) => v - drop.net[i]);
    return {
      cardId: fee.h.cardId,
      diff,
      p: diff.filter((d) => d > 0).length / diff.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, wallet, txns, valuation, drift]);

  return (
    <Section
      id="keep"
      index="06"
      kicker="Keep or cancel"
      title={
        <>
          {wallet.length === 1
            ? `Is the ${shortName(wallet[0].cardId)} earning its spot?`
            : "Is each card earning its spot?"}
        </>
      }
      readout={
        <>
          <R tone="loss">{money(rows.reduce((a, x) => a + x.m.fee, 0))}</R> in
          fees a year · <R>{rows.length}</R> cards · {mc.years.toLocaleString()}{" "}
          years simulated
        </>
      }
      lede="A card is worth what it adds over the next-best card you already carry, plus the perks you actually use, minus its fee. Then Monte replays next year a thousand times with and without it."
    >
      <div className="overflow-hidden m-panel">
        <div className="mono hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.4fr)] gap-6 border-b border-ace-line px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ace-dim md:grid">
          <span>Card</span>
          <span>What it adds vs what it costs, per year</span>
          <span>Verdict</span>
        </div>
        {rows.map(({ h, m, interest }, i) => {
          const value = m.rewardsAdded + m.credits;
          const cost = m.fee + interest;
          const drop = mc.options.find((o) => o.id === `drop:${h.cardId}`);
          const issuer = card(h.cardId).issuer.replace(
            "American Express",
            "Amex",
          );
          const verdict =
            interest > 0
              ? {
                  label: "Pay it down",
                  tone: "loss",
                  why: `${money(interest)} a year in interest. Clear it first.`,
                }
              : wallet.length === 1 && m.fee <= 0
                ? {
                    label: "Keep",
                    tone: "gain",
                    why: "Only card, no fee.",
                  }
                : m.net >= 25
                  ? {
                      label: "Keep",
                      tone: "gain",
                      why: `Adds ${money(m.rewardsAdded + m.credits)}.`,
                    }
                  : m.fee > 0
                    ? {
                        label: "Downgrade",
                        tone: "loss",
                        why: `${money(m.fee)} fee, ${money(value)} of value. Switch to a no-fee ${issuer} card.`,
                      }
                    : {
                        label: "Keep",
                        tone: "dim",
                        why: `No fee. Adds ${money(m.rewardsAdded)}.`,
                      };
          return (
            <motion.div
              key={h.cardId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="grid gap-4 border-b border-ace-line px-5 py-5 last:border-b-0 [&>*]:min-w-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.4fr)] md:items-center md:gap-6"
            >
              <div className="flex items-center gap-3">
                <CardArt id={h.cardId} size="sm" className="w-16 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium leading-snug">
                    {shortName(h.cardId)}
                  </div>
                  <div className="mono text-[11px] text-ace-dim">
                    {m.fee ? `${money(m.fee)} fee` : "no annual fee"}
                    {interest > 0
                      ? ` · ${money(h.balance ?? 0)} at ${h.apr}%`
                      : ""}
                  </div>
                </div>
              </div>
              <div className="mono space-y-1.5 text-[11px]">
                <Bar label="adds" v={value} span={span} tone="gain" />
                <Bar
                  label={interest > 0 ? "fee + interest" : "fee"}
                  v={cost}
                  span={span}
                  tone="loss"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-semibold text-ace-ink">
                    {verdict.label}
                  </span>
                  <span className="text-right">
                    <span
                      className={`m-num block text-sm ${value - cost >= 0 ? "text-ace-gain" : "text-ace-loss"}`}
                    >
                      {money(value - cost, { sign: true })}/yr
                    </span>
                    <span className="block text-[11px] text-ace-dim">
                      last year
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ace-dim">
                  {verdict.why}
                </p>
                {drop && (
                  <p className="mt-2 text-[13px]">
                    drop it:{" "}
                    <span className={`m-num ${drop.p50 - mc.current.p50 >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>
                      {money(drop.p50 - mc.current.p50, { sign: true })}
                    </span>{" "}
                    a typical year
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      {keepCase && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center [&>*]:min-w-0">
          <div>
            <p className="m-label">
              the {shortName(keepCase.cardId)}, kept vs dropped
            </p>
            <h3 className="mt-3 text-3xl md:text-4xl">
              Keep it or cancel it?
              <span className="m-second block">
                {keepCase.p >= 0.5
                  ? `${Math.round(keepCase.p * 1000).toLocaleString()} of 1,000 years say keep it.`
                  : `${Math.round((1 - keepCase.p) * 1000).toLocaleString()} of 1,000 years say drop it.`}
              </span>
            </h3>
          </div>
          <Estimator of={`keeping the ${nick(keepCase.cardId)}, a year`} samples={keepCase.diff} bins={28} />
        </div>
      )}
    </Section>
  );
}

function Bar({
  label,
  v,
  span,
  tone,
}: {
  label: string;
  v: number;
  span: number;
  tone: "gain" | "loss";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-ace-dim">{label}</span>
      <div className="h-2.5 min-w-0 flex-1 bg-ace-line/60">
        <motion.div
          key={Math.round(v)}
          className={`h-full ${tone === "gain" ? "bg-ace-ink" : "bg-ace-loss"}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, (v / span) * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-14 shrink-0 text-right tnum text-ace-ink">
        {money(v)}
      </span>
    </div>
  );
}

// ---------------- For you: preferences, next card, nudges ----------------

export function ForYouSection() {
  const { wallet, txns, valuation, setValuationMode, tryCard, persona } =
    useAce();
  const [noFee, setNoFee] = useState(false);
  const drift = useDrift();
  const { brand: b } = useBrand();
  const [perks, setPerks] = useState<0 | 0.5 | 1>(0);
  const [horizon, setHorizon] = useState<"year" | "first">("year");

  const spend = useMemo(() => {
    const m: Record<string, number> = {};
    let total = 0;
    for (const t of txns) {
      m[t.category] = (m[t.category] ?? 0) + t.amount;
      total += t.amount;
    }
    return {
      top: Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
      total,
    };
  }, [txns]);

  // ranked on last year's purchases, then priced with 1,000 simulated years (the same run
  // Pay this first and the fan chart use), so every view shows one value per card
  const pre = useMemo(() => {
    return addShortlist(wallet, txns, noFee)
      .map(({ c, w }) => {
        const perkValue =
          c.credits.reduce((a, cr) => a + creditPerYear(cr), 0) * perks;
        const sb = c.signup_bonus as
          | { amount: number; unit: string; spend: number; months: number }
          | null
          | undefined;
        const monthly = spend.total / 12;
        const match = sb?.unit === "cashback_match";
        const bonus = match
          ? {
              value: Math.max(0, w.rewardsAdded),
              spend: 0,
              months: 12,
              need: 0,
              label: "Cashback Match",
            }
          : sb &&
              typeof sb.amount === "number" &&
              typeof sb.spend === "number" &&
              typeof sb.months === "number"
            ? {
                value: /^(dollars|cash)/.test(sb.unit)
                  ? sb.amount
                  : (sb.amount * pointValue(c)) / 100,
                spend: sb.spend,
                months: sb.months,
                need: monthly > 0 ? sb.spend / monthly : Infinity,
                label: /^(dollars|cash)/.test(sb.unit)
                  ? `$${sb.amount}`
                  : `${sb.amount.toLocaleString()} pts`,
              }
            : null;
        const hits = bonus ? bonus.need <= bonus.months : false;
        const lastYear =
          w.net +
          perkValue +
          (horizon === "first" && bonus && hits ? bonus.value : 0);
        return { id: c.id, ...w, perkValue, bonus, hits, lastYear };
      })
      .sort((a, b) => b.lastYear - a.lastYear)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, noFee, perks, valuation, horizon, spend]);
  const ids = pre.map((x) => x.id).join(",");
  const priced = useMemo(
    () => addMedians(wallet, txns, ids ? ids.split(",") : [], drift),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, txns, ids, valuation, drift],
  );
  const recs = pre
    .map((x) => {
      const g = priced.gain.get(x.id);
      const total = (g?.gain ?? x.net) + x.perkValue;
      const firstYear = total + (x.bonus && x.hits ? x.bonus.value : 0);
      return {
        ...x,
        total,
        firstYear,
        win: g?.win,
        score: horizon === "first" ? firstYear : total,
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <Section
      id="foryou"
      index="07"
      kicker="What to apply for"
      title={
        <>Ranked on {nameOf(persona).whose} spending, not on referral fees.</>
      }
      readout={
        <>
          <R>{CARDS.length}</R> cards scored on <R>{txns.length}</R> of{" "}
          {nameOf(persona).whose} purchases
        </>
      }
      lede={`Set four preferences. ${b.name} replays your year through every card it knows and ranks them by what they would have added, after fees. No issuer pays for a spot here. Every number assumes the card is paid in full each month.`}
    >
      <div className="space-y-8">
        {/* the four preferences as one sentence: each underlined word cycles, and the list re-ranks */}
        <p
          className="max-w-4xl text-xl leading-relaxed md:text-2xl"
          style={{ fontFamily: "var(--m-font-display)", fontWeight: 400 }}
        >
          Ranked for {nameOf(persona).who}, who{" "}
          {v(nameOf(persona), "spends", "spend")} most on{" "}
          {spend.top.map(([cat, val], k) => (
            <span key={cat}>
              {k ? (k === spend.top.length - 1 ? " and " : ", ") : ""}
              {cat.replace(/_/g, " ")}{" "}
              <span className="m-num text-base">
                ({Math.round((val / spend.total) * 100)}%)
              </span>
            </span>
          ))}
          ; points redeemed as{" "}
          <Cycle
            value={valuation}
            options={[
              ["cash", "cash"],
              ["travel", "travel"],
            ]}
            onChange={(x) => setValuationMode(x as "cash" | "travel")}
          />
          ,{" "}
          <Cycle
            value={noFee ? "never" : "ok"}
            options={[
              ["ok", "an annual fee only if it pays for itself"],
              ["never", "no annual fee, ever"],
            ]}
            onChange={(x) => setNoFee(x === "never")}
          />
          ,{" "}
          <Cycle
            value={String(perks)}
            options={[
              ["0", "none"],
              ["0.5", "half"],
              ["1", "all"],
            ]}
            onChange={(x) => setPerks(Number(x) as 0 | 0.5 | 1)}
          />{" "}
          of a card&apos;s perks used, counted over{" "}
          <Cycle
            value={horizon}
            options={[
              ["year", "every year"],
              ["first", "the first year, with the sign-up bonus"],
            ]}
            onChange={(x) => setHorizon(x as "year" | "first")}
          />
          .
        </p>

        <div className="grid gap-8 2xl:grid-cols-2 [&>*]:min-w-0">
          <div>
            <div className="m-label mb-4">
              Best next card for {nameOf(persona).who}
            </div>
            {wallet.some((h) => h.balance) && (
              <div className="mb-3 rounded-[10px] bg-[var(--m-wash)] p-4 text-sm leading-relaxed">
                <span className="font-medium">Pay the balance first.</span> Then:
              </div>
            )}
            <div className="space-y-3">
              {recs.map((x, k) => (
                <motion.div
                  layout
                  key={x.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-ace-line p-3 pr-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="mono w-4 text-ace-dim">{k + 1}</span>
                  <CardArt id={x.id} size="sm" className="w-16 shrink-0" />
                  <div className="min-w-0 flex-1 basis-[calc(100%-7.5rem)] sm:basis-0">
                    <div className="text-sm font-medium leading-snug">
                      {shortName(x.id)}
                    </div>
                    <div className="mono text-[11px] text-ace-dim">
                      {x.fee ? `${money(x.fee)} fee` : "no fee"}
                      {x.bonus ? ` · ${x.bonus.label.startsWith("$") ? x.bonus.label : money(x.bonus.value)} bonus${x.hits ? " ✓" : ""}` : ""}
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                    <span className="sm:text-right">
                      <span
                        className={`mono block text-sm ${x.score >= 0 ? "text-ace-gain" : "text-ace-loss"}`}
                      >
                        {money(x.score, { sign: true })}
                      </span>
                      <span className="mono block text-[11px] text-ace-dim">
                        {horizon === "first" ? "first year" : "a year"}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        tryCard(x.id);
                      }}
                      className="btn btn-ghost btn-sm"
                      title="Adds this card to the wallet as a what-if; every section reruns with it"
                    >
                      what if?
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </Section>
  );
}

function Cycle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  const k = Math.max(
    0,
    options.findIndex(([v]) => v === value),
  );
  return (
    <button
      type="button"
      onClick={() => onChange(options[(k + 1) % options.length][0])}
      className="text-[var(--m-accent)] underline decoration-dotted decoration-2 underline-offset-[6px] hover:decoration-solid"
      title="Click to change"
    >
      {options[k][1]}
    </button>
  );
}

/** What-if cards, said once wherever projections show them (every Plan tab, Next year). */
export function WhatIfBar() {
  const { wallet, held, removeCard, persona } = useAce();
  const tried = wallet.filter((h) => !held.includes(h)).map((h) => h.cardId);
  if (!tried.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-ace-ink px-4 py-3 text-sm text-ace-bg">
      <span>
        What-if: {tried.map(shortName).join(", ")} added to next year&apos;s
        projections. Last year&apos;s receipt, replay and leaks still show {nameOf(persona).whose} own cards.
      </span>
      <button
        onClick={() => tried.forEach((id) => removeCard(id))}
        className="btn btn-sm bg-ace-bg text-ace-ink"
      >
        undo
      </button>
    </div>
  );
}
