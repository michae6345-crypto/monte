"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { marginalValue, whatIf, interestFor, pointValue } from "@/lib/engine";
import { CARDS, card, creditPerYear, openToNewApplicants } from "@/lib/engine/catalog";
import { CardArt, shortName } from "./card-art";
import { R, Section } from "./section";
import { money, useAce } from "./store";
import { FanChart, useMonteCarlo } from "./odds";

export function KeepSection() {
  const { wallet, txns, valuation } = useAce();
  const mc = useMonteCarlo();
  const rows = useMemo(
    () => wallet.map((h) => ({ h, m: marginalValue(wallet, txns, h.cardId), interest: interestFor(h) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, txns, valuation],
  );
  const span = Math.max(60, ...rows.flatMap(({ m, interest }) => [m.fee + interest, m.rewardsAdded + m.credits]));

  return (
    <Section
      id="keep"
      index="06"
      kicker="Keep or cancel"
      title={<>Is each card earning its spot?</>}
      readout={
        <>
          <R tone="loss">{money(rows.reduce((a, x) => a + x.m.fee, 0))}</R> in fees a year · <R>{rows.length}</R> cards · {mc.years.toLocaleString()} years simulated
        </>
      }
      lede="A card is worth what it adds over the next-best card you already carry, plus the perks you actually use, minus its fee. Then Monte replays next year a thousand times with and without it."
    >
      <div className="overflow-hidden rounded-lg border border-ace-line">
        <div className="mono hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.4fr)] gap-6 border-b border-ace-line px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ace-dim md:grid">
          <span>Card</span>
          <span>What it adds vs what it costs, per year</span>
          <span>Verdict</span>
        </div>
        {rows.map(({ h, m, interest }, i) => {
          const value = m.rewardsAdded + m.credits;
          const cost = m.fee + interest;
          const drop = mc.options.find((o) => o.id === `drop:${h.cardId}`);
          const issuer = card(h.cardId).issuer.replace("American Express", "Amex");
          const verdict =
            interest > 0
              ? { label: "Pay it down", tone: "loss", why: `The balance costs ${money(interest)} a year in interest, more than any card in the wallet earns. Clear it before anything else.` }
              : m.net >= 25
                ? { label: "Keep", tone: "gain", why: `Adds ${money(m.rewardsAdded)} over your other cards${m.credits ? ` plus ${money(m.credits)} of perks you use` : ""}.` }
                : m.fee > 0
                  ? { label: "Downgrade", tone: "loss", why: `The ${money(m.fee)} fee buys ${money(value)} of value for you. Ask for a retention offer, or move to a no-fee ${issuer} card and keep the credit history.` }
                  : { label: "Keep, quietly", tone: "dim", why: "No fee, so it costs nothing to keep open, and it helps your credit age. Your other cards out-earn it." };
          return (
            <motion.div
              key={h.cardId}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="grid gap-4 border-b border-ace-line px-5 py-5 last:border-b-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.4fr)] md:items-center md:gap-6"
            >
              <div className="flex items-center gap-3">
                <CardArt id={h.cardId} size="sm" className="w-16 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{shortName(h.cardId)}</div>
                  <div className="mono text-[11px] text-ace-dim">
                    {m.fee ? `${money(m.fee)} fee` : "no annual fee"}
                    {interest > 0 ? ` · ${money(h.balance ?? 0)} at ${h.apr}%` : ""}
                  </div>
                </div>
              </div>
              <div className="mono space-y-1.5 text-[11px]">
                <Bar label="adds" v={value} span={span} tone="gain" />
                <Bar label={interest > 0 ? "fee + interest" : "fee"} v={cost} span={span} tone="loss" />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-lg font-semibold ${verdict.tone === "gain" ? "text-ace-gain" : verdict.tone === "loss" ? "text-ace-loss" : "text-ace-ink"}`}>
                    {verdict.label}
                  </span>
                  <span className={`mono text-sm tnum ${value - cost >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>{money(value - cost, { sign: true })}/yr</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ace-dim">{verdict.why}</p>
                {drop && (
                  <p className="mono mt-2 text-[11px] text-ace-dim">
                    Cancelling it comes out ahead in <span className="text-ace-ink">{Math.round(drop.winShare * 100)}%</span> of {mc.years.toLocaleString()} simulated years.
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function Bar({ label, v, span, tone }: { label: string; v: number; span: number; tone: "gain" | "loss" }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-ace-dim">{label}</span>
      <div className="h-2.5 min-w-0 flex-1 bg-ace-line/60">
        <motion.div
          className={`h-full ${tone === "gain" ? "bg-ace-gain" : "bg-ace-loss"}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, (v / span) * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-14 shrink-0 text-right tnum text-ace-ink">{money(v)}</span>
    </div>
  );
}

// ---------------- For you: preferences, next card, nudges ----------------

export function ForYouSection() {
  const { wallet, txns, valuation, setValuationMode, addCard, persona } = useAce();
  const [noFee, setNoFee] = useState(false);
  const { brand: b } = useBrand();
  const [perks, setPerks] = useState<0 | 0.5 | 1>(0);
  const [horizon, setHorizon] = useState<"year" | "first">("year");
  const mc = useMonteCarlo();
  const odds = new Map(mc.options.map((o) => [o.id.replace(/^add:/, ""), o.winShare]));

  const spend = useMemo(() => {
    const m: Record<string, number> = {};
    let total = 0;
    for (const t of txns) {
      m[t.category] = (m[t.category] ?? 0) + t.amount;
      total += t.amount;
    }
    return { top: Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3), total };
  }, [txns]);

  const recs = useMemo(() => {
    return CARDS.filter((c) => !wallet.some((h) => h.cardId === c.id))
      .filter((c) => !noFee || c.annual_fee === 0)
      .filter((c) => !/secured|student/i.test(c.id) && openToNewApplicants(c))
      .map((c) => {
        const w = whatIf(wallet, txns, c.id)!;
        const perkValue = c.credits.reduce((a, cr) => a + creditPerYear(cr), 0) * perks;
        const sb = c.signup_bonus as { amount: number; unit: string; spend: number; months: number } | null | undefined;
        const monthly = spend.total / 12;
        const match = sb?.unit === "cashback_match";
        const bonus = match
          ? { value: Math.max(0, w.rewardsAdded), spend: 0, months: 12, need: 0, label: "Cashback Match" }
          : sb && typeof sb.amount === "number" && typeof sb.spend === "number" && typeof sb.months === "number"
          ? {
              value: sb.unit === "dollars" || sb.unit === "cash" ? sb.amount : (sb.amount * pointValue(c)) / 100,
              spend: sb.spend,
              months: sb.months,
              need: monthly > 0 ? sb.spend / monthly : Infinity,
              label: sb.unit === "dollars" || sb.unit === "cash" ? `$${sb.amount}` : `${sb.amount.toLocaleString()} pts`,
            }
          : null;
        const hits = bonus ? bonus.need <= bonus.months : false;
        const total = w.net + perkValue;
        const firstYear = total + (bonus && hits ? bonus.value : 0);
        return { id: c.id, ...w, perkValue, total, bonus, hits, firstYear, score: horizon === "first" ? firstYear : total };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, noFee, perks, valuation, horizon, spend]);

  const nudges = useMemo(() => {
    const out: { tag: string; tone: "gain" | "loss" | "gold"; text: string }[] = [];
    for (const h of wallet) {
      const c = card(h.cardId);
      if (h.balance && h.balance > 0) {
        const apr = (h.apr ?? c.purchase_apr_range[1]) / 100 / 12;
        const pay = 250;
        const months = Math.ceil(-Math.log(1 - (apr * h.balance) / pay) / Math.log(1 + apr));
        const interestPaid = months * pay - h.balance;
        out.push({
          tag: "Pay this first",
          tone: "loss",
          text: `${shortName(h.cardId)}: ${money(h.balance)} at ${h.apr}% costs about ${money(interestFor(h))} a year. $${pay}/month clears it in ${months} months with ${money(interestPaid)} of interest.`,
        });
      }
      if (c.rotating?.activation_required)
        out.push({ tag: "Activate", tone: "gold", text: `${shortName(h.cardId)}: 5% on ${(c.rotating.q4_2026_labels ?? c.rotating.q4_2026).slice(0, 2).join(" and ").toLowerCase()} this quarter, up to $${c.rotating.cap?.toLocaleString()}. Only if you activate it.` });
      const unused = c.credits.filter((cr) => cr.period === "month" && (h.creditsUsed?.[cr.name] ?? 0) < creditPerYear(cr));
      if (unused.length)
        out.push({
          tag: "Expires Oct 31",
          tone: "gold",
          text: `${shortName(h.cardId)}: $${unused.reduce((a, cr) => a + cr.amount, 0)} of October perks unused (${unused.map((cr) => `${cr.name} $${cr.amount}`).join(", ")}).`,
        });
      const m = marginalValue(wallet, txns, h.cardId);
      if (c.annual_fee > 0 && m.net < 25)
        out.push({ tag: "Before it renews", tone: "loss", text: `${shortName(h.cardId)} is worth ${money(m.net)} a year to you after its ${money(c.annual_fee)} fee. Call for a retention offer, or downgrade.` });
    }
    if (recs[0] && recs[0].total > 40 && !wallet.some((h) => h.balance))
      out.push({ tag: "Opportunity", tone: "gain", text: `${shortName(recs[0].id)} would add about ${money(recs[0].total)} a year on your actual spending, after its fee.` });
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, recs, valuation]);

  return (
    <Section
      id="foryou"
      index="07"
      kicker="What to apply for"
      title={<>Ranked on your spending, not on referral fees.</>}
      readout={
        <>
          <R>{CARDS.length}</R> cards scored on <R>{txns.length}</R> of {persona.name}&apos;s purchases
        </>
      }
      lede={`Set four preferences. ${b.name} replays your year through every card it knows and ranks them by what they would have added, after fees. No issuer pays for a spot on this list.`}
    >
      <div className="grid gap-8 lg:grid-cols-[320px_1fr] [&>*]:min-w-0">
        <div className="space-y-6 rounded-lg border border-ace-line bg-ace-panel/70 p-6">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">What {b.name} learned</div>
            <ul className="mt-3 space-y-2 text-sm">
              {spend.top.map(([cat, v]) => (
                <li key={cat} className="flex justify-between">
                  <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                  <span className="mono text-ace-dim">{Math.round((v / spend.total) * 100)}% of spend</span>
                </li>
              ))}
              {wallet.some((h) => h.creditsUsed) && (
                <li className="text-ace-dim">
                  Uses ${Object.values(wallet.find((h) => h.creditsUsed)!.creditsUsed!).reduce((a, b) => a + b, 0)} of{" "}
                  ${card(wallet.find((h) => h.creditsUsed)!.cardId).credits.reduce((a, c) => a + creditPerYear(c), 0)} in perks
                </li>
              )}
            </ul>
          </div>
          <Pref label="Redeems points as">
            {(["cash", "travel"] as const).map((v) => (
              <Pill key={v} on={valuation === v} onClick={() => setValuationMode(v)}>
                {v}
              </Pill>
            ))}
          </Pref>
          <Pref label="Annual fees">
            <Pill on={!noFee} onClick={() => setNoFee(false)}>
              ok if worth it
            </Pill>
            <Pill on={noFee} onClick={() => setNoFee(true)}>
              never
            </Pill>
          </Pref>
          <Pref label="Rank by">
            <Pill on={horizon === "year"} onClick={() => setHorizon("year")}>
              every year
            </Pill>
            <Pill on={horizon === "first"} onClick={() => setHorizon("first")}>
              first year + bonus
            </Pill>
          </Pref>
          <Pref label="Perks I'd actually use">
            {([0, 0.5, 1] as const).map((v) => (
              <Pill key={v} on={perks === v} onClick={() => setPerks(v)}>
                {v === 0 ? "none" : v === 0.5 ? "half" : "all"}
              </Pill>
            ))}
          </Pref>
        </div>

        <div className="grid gap-8 2xl:grid-cols-2 [&>*]:min-w-0">
          <div>
            <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">Best next card for {persona.name}</div>
            {wallet.some((h) => h.balance) && (
              <div className="mb-3 rounded-md border border-ace-loss/40 bg-ace-loss/10 p-4 text-sm leading-relaxed">
                <span className="font-semibold text-ace-loss">{b.name}&apos;s advice: no new card yet.</span> {persona.name} carries a balance, and
                the interest outweighs any card below. Pay it down first; this list is what to apply for after.
              </div>
            )}
            <div className="space-y-3">
              {recs.map((x, k) => (
                <motion.div
                  layout
                  key={x.id}
                  className="flex items-center gap-4 rounded-md border border-ace-line p-3 pr-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="mono w-4 text-ace-dim">{k + 1}</span>
                  <CardArt id={x.id} size="sm" className="w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{shortName(x.id)}</div>
                    <div className="mono text-[10px] text-ace-dim">
                      {money(x.rewardsAdded, { sign: true })} rewards · {money(-x.fee, { sign: true })} fee
                      {x.perkValue ? ` · ${money(x.perkValue, { sign: true })} perks` : ""}
                    </div>
                    {x.bonus && (
                      <div className={`mono mt-0.5 text-[10px] ${x.hits ? "text-ace-gain" : "text-ace-dim"}`}>
                        bonus {x.bonus.label} ≈ {money(x.bonus.value)} ·{" "}
                        {x.hits
                          ? x.bonus.spend
                            ? `you'd hit $${x.bonus.spend.toLocaleString()} in ${x.bonus.need.toFixed(1)} of ${x.bonus.months} months ✓`
                            : "first-year cash back matched, no minimum ✓"
                          : `needs $${x.bonus.spend.toLocaleString()} in ${x.bonus.months} months, you'd take ${x.bonus.need.toFixed(1)}`}
                      </div>
                    )}
                  </div>
                  <span className="text-right">
                    <span className={`mono block text-sm ${x.score >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>{money(x.score, { sign: true })}</span>
                    <span className="mono block text-[10px] text-ace-dim">
                      {odds.has(x.id) ? `wins ${Math.round(odds.get(x.id)! * 100)}% of yrs` : horizon === "first" ? "first year" : "per year"}
                    </span>
                  </span>
                  <button
                    onClick={() => addCard(x.id)}
                    className="rounded-md border border-ace-line px-2.5 py-1 text-xs text-ace-dim transition hover:border-ace-gold hover:text-ace-gold"
                  >
                    try it
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
          <div>
            <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">This week</div>
            <div className="space-y-3">
              {nudges.map((n, k) => (
                <motion.div
                  key={n.text}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: k * 0.08 }}
                  className="rounded-md border border-ace-line bg-ace-panel/60 p-4"
                >
                  <div
                    className={`mono text-[10px] uppercase tracking-[0.2em] ${n.tone === "gain" ? "text-ace-gain" : n.tone === "loss" ? "text-ace-loss" : "text-ace-gold"}`}
                  >
                    {n.tag}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{n.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-lg border border-ace-line p-5 md:p-6">
        <div className="mono mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-ace-dim">
          <span>Next year, played {mc.years.toLocaleString()} times</span>
          <span className="normal-case tracking-normal">cumulative net · your wallet dashed · with the new card in the accent</span>
        </div>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ace-dim">
          Each simulated year redraws {persona.name}&apos;s months and lets each category drift up or down, the way real spending does. A card
          with no fee can only help. A card with a fee has to earn it, and the odds say how often it does.
        </p>
        <FanChart mc={mc} />
      </div>
    </Section>
  );
}

function Pref({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono mb-2 text-[11px] uppercase tracking-[0.2em] text-ace-dim">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1 text-sm capitalize transition ${on ? "border-ace-ink bg-ace-ink text-ace-bg" : "border-ace-line text-ace-dim hover:text-ace-ink"}`}
    >
      {children}
    </button>
  );
}
