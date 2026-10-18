"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { marginalValue, interestFor, pointValue } from "@/lib/engine";
import { CARDS, card, creditPerYear } from "@/lib/engine/catalog";
import { CardArt, shortName } from "./card-art";
import { R, Section } from "./section";
import { money, nameOf, useAce, v } from "./store";
import { DriftToggle, FanChart, useDrift, useMonteCarlo } from "./odds";
import { addMedians, addShortlist } from "./adds";
import { Estimator } from "@/components/brand";
import { monteCarloSamples } from "@/lib/engine/montecarlo";

export function KeepSection() {
  const { held: wallet, txns, valuation, r, persona } = useAce();
  const who = nameOf(persona);
  const mc = useMonteCarlo(wallet);
  const drift = useDrift();
  const rows = useMemo(
    () => wallet.map((h) => ({ h, m: marginalValue(wallet, txns, h.cardId), interest: interestFor(h) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, txns, valuation],
  );
  const span = Math.max(60, ...rows.flatMap(({ m, interest }) => [m.fee + interest, m.rewardsAdded + m.credits]));

  // The biggest fee in the wallet, played both ways over the engine's 1,000 resampled years:
  // each sample is next year's net with the card minus without it.
  const keepCase = useMemo(() => {
    const fee = rows.filter((x) => x.m.fee > 0).sort((a, b) => b.m.fee - a.m.fee)[0];
    if (!fee) return null;
    const s = monteCarloSamples(wallet, txns, { years: 1000, seed: 42, driftSd: drift });
    const cur = s.options.find((o) => o.id === "current");
    const drop = s.options.find((o) => o.id === `drop:${fee.h.cardId}`);
    if (!cur || !drop) return null;
    const diff = Array.from(cur.net, (v, i) => v - drop.net[i]);
    return { cardId: fee.h.cardId, diff, p: diff.filter((d) => d > 0).length / diff.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, wallet, txns, valuation, drift]);

  return (
    <Section
      id="keep"
      index="06"
      kicker="Keep or cancel"
      title={<>{wallet.length === 1 ? `Is the ${shortName(wallet[0].cardId)} earning its spot?` : "Is each card earning its spot?"}</>}
      readout={
        <>
          <R tone="loss">{money(rows.reduce((a, x) => a + x.m.fee, 0))}</R> in fees a year · <R>{rows.length}</R> cards · {mc.years.toLocaleString()} years simulated
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
          const issuer = card(h.cardId).issuer.replace("American Express", "Amex");
          const verdict =
            interest > 0
              ? { label: "Pay it down", tone: "loss", why: `The balance costs ${money(interest)} a year in interest${interest > r.rewards ? ", more than the whole wallet earned" : ""}. Clear it before anything else.` }
              : wallet.length === 1 && m.fee <= 0
                ? { label: "Keep", tone: "gain", why: `${who.Whose} only card, no annual fee: nothing to cancel.` }
                : m.net >= 25
                ? { label: "Keep", tone: "gain", why: `Adds ${money(m.rewardsAdded)}${wallet.length > 1 ? ` over ${who.whose} other cards` : ""}${m.credits ? ` plus ${money(m.credits)} of perks ${who.who} ${v(who, "uses", "use")}` : ""}.` }
                : m.fee > 0
                  ? { label: "Downgrade", tone: "loss", why: `The ${money(m.fee)} fee buys ${money(value)} of value for ${who.who}. Ask for a retention offer, or move to a no-fee ${issuer} card and keep the credit history.` }
                  : { label: "Keep", tone: "dim", why: `No annual fee, so keeping it costs nothing. It adds ${money(m.rewardsAdded)} over ${who.whose} other cards.` };
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
                  <span className="text-lg font-semibold text-ace-ink">
                    {verdict.label}
                  </span>
                  <span className="text-right">
                    <span className={`m-num block text-sm ${value - cost >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>{money(value - cost, { sign: true })}/yr</span>
                    <span className="block text-[11px] text-ace-dim">last year, played right</span>
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ace-dim">{verdict.why}</p>
                {drop && (
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <span>
                      pays for itself in{" "}
                      <span className="m-num">
                        {Math.round((1 - drop.winShare) * mc.years).toLocaleString()} of {mc.years.toLocaleString()}
                      </span>{" "}
                      simulated years
                    </span>
                    <span>
                      next year&apos;s median without it:{" "}
                      <span className={`m-num ${drop.p50 - mc.current.p50 >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>
                        {money(drop.p50 - mc.current.p50, { sign: true })}/yr
                      </span>
                    </span>
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      {keepCase && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="m-label">the {shortName(keepCase.cardId)}, played both ways</p>
            <h3 className="mt-3 text-3xl md:text-4xl">
              Keep it or cancel it?
              <span className="m-second block">
                {keepCase.p >= 0.5
                  ? `${Math.round(keepCase.p * 1000).toLocaleString()} of 1,000 years say keep it.`
                  : `${Math.round((1 - keepCase.p) * 1000).toLocaleString()} of 1,000 years say drop it.`}
              </span>
            </h3>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ace-dim">
              Each sample is one simulated year of {shortName(keepCase.cardId)} in the wallet minus the same year without it, fee and perks
              included. The engine replays every purchase through the card rules both ways.
            </p>
          </div>
          <Estimator of="net of keeping" samples={keepCase.diff} bins={28} />
        </div>
      )}
    </Section>
  );
}

function Bar({ label, v, span, tone }: { label: string; v: number; span: number; tone: "gain" | "loss" }) {
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
      <span className="w-14 shrink-0 text-right tnum text-ace-ink">{money(v)}</span>
    </div>
  );
}

// ---------------- For you: preferences, next card, nudges ----------------

export function ForYouSection() {
  const { wallet, txns, valuation, setValuationMode, tryCard, removeCard, persona } = useAce();
  const [noFee, setNoFee] = useState(false);
  const { held } = useAce();
  const triedNow = wallet.filter((h) => !held.includes(h)).map((h) => h.cardId);
  const drift = useDrift();
  const { brand: b } = useBrand();
  const [perks, setPerks] = useState<0 | 0.5 | 1>(0);
  const [horizon, setHorizon] = useState<"year" | "first">("year");
  const mc = useMonteCarlo();

  const spend = useMemo(() => {
    const m: Record<string, number> = {};
    let total = 0;
    for (const t of txns) {
      m[t.category] = (m[t.category] ?? 0) + t.amount;
      total += t.amount;
    }
    return { top: Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3), total };
  }, [txns]);

  // ranked on last year's purchases, then priced with 1,000 simulated years (the same run
  // Pay this first and the fan chart use), so every view shows one value per card
  const pre = useMemo(() => {
    return addShortlist(wallet, txns, noFee)
      .map(({ c, w }) => {
        const perkValue = c.credits.reduce((a, cr) => a + creditPerYear(cr), 0) * perks;
        const sb = c.signup_bonus as { amount: number; unit: string; spend: number; months: number } | null | undefined;
        const monthly = spend.total / 12;
        const match = sb?.unit === "cashback_match";
        const bonus = match
          ? { value: Math.max(0, w.rewardsAdded), spend: 0, months: 12, need: 0, label: "Cashback Match" }
          : sb && typeof sb.amount === "number" && typeof sb.spend === "number" && typeof sb.months === "number"
          ? {
              value: /^(dollars|cash)/.test(sb.unit) ? sb.amount : (sb.amount * pointValue(c)) / 100,
              spend: sb.spend,
              months: sb.months,
              need: monthly > 0 ? sb.spend / monthly : Infinity,
              label: /^(dollars|cash)/.test(sb.unit) ? `$${sb.amount}` : `${sb.amount.toLocaleString()} pts`,
            }
          : null;
        const hits = bonus ? bonus.need <= bonus.months : false;
        const lastYear = w.net + perkValue + (horizon === "first" && bonus && hits ? bonus.value : 0);
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
      return { ...x, total, firstYear, win: g?.win, score: horizon === "first" ? firstYear : total };
    })
    .sort((a, b) => b.score - a.score);
  // a wallet carrying a balance gets the engine's paid-off projection, clearly labelled
  const paidOff = wallet.some((h) => h.balance) ? priced.mc : null;

  const nudges = useMemo(() => {
    const out: { tag: string; tone: "gain" | "loss" | "gold"; text: string }[] = [];
    for (const h of wallet) {
      const c = card(h.cardId);
      if (h.balance && h.balance > 0) {
        const apr = (h.apr ?? c.purchase_apr_range[1]) / 100 / 12;
        const pay = 250;
        let left = h.balance;
        let months = 0;
        let interestPaid = 0;
        while (left > 0.005 && months < 600) {
          const i = left * apr;
          interestPaid += i;
          left = Math.max(0, left + i - pay);
          months++;
        }
        out.push({
          tag: "Pay this first",
          tone: "loss",
          text: `${shortName(h.cardId)}: ${money(h.balance)} at ${h.apr}% costs about ${money(interestFor(h))} a year. $${pay}/month clears it in ${months} months with ${money(interestPaid)} of interest.`,
        });
      }
      if (c.rotating?.activation_required)
        out.push({ tag: "Activate", tone: "gold", text: `${shortName(h.cardId)}: 5% on ${(c.rotating.q4_2026_labels ?? c.rotating.q4_2026).slice(0, 2).join(" and ").toLowerCase()} this quarter, up to $${c.rotating.cap?.toLocaleString()}. Only after activation.` });
      const unused = c.credits.filter((cr) => cr.period === "month" && (h.creditsUsed?.[cr.name] ?? 0) < creditPerYear(cr));
      if (unused.length)
        out.push({
          tag: "Monthly perks",
          tone: "gold",
          text: `${shortName(h.cardId)}: ${unused
            .map((cr) => `${cr.name} used $${Math.round(h.creditsUsed?.[cr.name] ?? 0)} of $${creditPerYear(cr)} this year`)
            .join("; ")}. Each month's credit expires at month end.`,
        });
      const m = marginalValue(wallet, txns, h.cardId);
      if (c.annual_fee > 0 && m.net < 25)
        out.push({ tag: "Before it renews", tone: "loss", text: `${shortName(h.cardId)} is worth ${money(m.net)} a year to ${nameOf(persona).who} after its ${money(c.annual_fee)} fee. Call for a retention offer, or downgrade.` });
    }
    if (recs[0] && recs[0].total > 40 && !wallet.some((h) => h.balance))
      out.push({ tag: "Opportunity", tone: "gain", text: `${shortName(recs[0].id)} would add about ${money(recs[0].total)} a year on ${nameOf(persona).whose} spending${card(recs[0].id).annual_fee ? ", after its fee" : ""}.` });
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, recs, valuation]);

  return (
    <Section
      id="foryou"
      index="07"
      kicker="What to apply for"
      title={<>Ranked on {nameOf(persona).whose} spending, not on referral fees.</>}
      readout={
        <>
          <R>{CARDS.length}</R> cards scored on <R>{txns.length}</R> of {nameOf(persona).whose} purchases
        </>
      }
      lede={`Set four preferences. ${b.name} replays your year through every card it knows and ranks them by what they would have added, after fees. No issuer pays for a spot here. Every number assumes the card is paid in full each month.`}
    >
      <div className="grid gap-8 lg:grid-cols-[320px_1fr] [&>*]:min-w-0">
        <div className="space-y-6 self-start m-panel p-6 lg:sticky lg:top-20">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Where the money goes</div>
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
              if worth it
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
            {triedNow.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-ace-ink px-4 py-3 text-sm text-ace-bg">
                <span>
                  What-if: {triedNow.map(shortName).join(", ")} added to next year&apos;s projections. Last year&apos;s receipt, replay and leaks still show the cards held.
                </span>
                <button
                  onClick={() => {
                    triedNow.forEach((id) => removeCard(id));
                  }}
                  className="btn btn-sm bg-ace-bg text-ace-ink"
                >
                  undo
                </button>
              </div>
            )}
            <div className="m-label mb-4">
              Best next card for {nameOf(persona).who}
              {wallet.some((h) => h.balance) ? " · once the balance is paid" : ""}
            </div>
            {wallet.some((h) => h.balance) && (
              <div className="mb-3 rounded-[10px] bg-[var(--m-wash)] p-4 text-sm leading-relaxed">
                <span className="m-mono text-ace-dim">[ no new card yet ]</span> {nameOf(persona).Who} {v(nameOf(persona), "carries", "carry")} a balance, and the interest outweighs any card
                below. Pay it down first; this list is what to apply for after.
              </div>
            )}
            <div className="space-y-3">
              {recs.map((x, k) => (
                <motion.div
                  layout
                  key={x.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-ace-line p-3 pr-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="mono w-4 text-ace-dim">{k + 1}</span>
                  <CardArt id={x.id} size="sm" className="w-16 shrink-0" />
                  <div className="min-w-0 flex-1 basis-[calc(100%-7.5rem)] sm:basis-0">
                    <div className="text-sm font-medium leading-snug">{shortName(x.id)}</div>
                    <div className="mono text-[11px] text-ace-dim">
                      {money(x.rewardsAdded, { sign: true })} rewards · {x.fee ? `${money(-x.fee, { sign: true })} fee` : "no annual fee"}
                      {x.perkValue ? ` · ${money(x.perkValue, { sign: true })} perks` : ""}
                    </div>
                    {x.bonus && (
                      <div className="mono mt-0.5 text-[11px] text-ace-ink">
                        bonus {x.bonus.label}{x.bonus.label.startsWith("$") ? "" : ` ≈ ${money(x.bonus.value)}`} ·{" "}
                        {x.hits
                          ? x.bonus.spend
                            ? `${nameOf(persona).Who} would hit $${x.bonus.spend.toLocaleString()} in ${x.bonus.need.toFixed(1)} of ${x.bonus.months} months ✓`
                            : "first-year cash back matched, no minimum ✓"
                          : `needs $${x.bonus.spend.toLocaleString()} in ${x.bonus.months} months; at ${nameOf(persona).whose} pace it takes ${x.bonus.need.toFixed(1)}`}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                  <span className="sm:text-right">
                    <span className={`mono block text-sm ${x.score >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>{money(x.score, { sign: true })}</span>
                    <span className="mono block text-[11px] text-ace-dim">
                      {horizon === "first" ? "first year, median" : "next year, median"}
                      {x.win !== undefined ? ` · ahead ${Math.round(x.win * priced.mc.years).toLocaleString()}/${priced.mc.years.toLocaleString()}` : ""}
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
          <div>
            <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">Do next</div>
            <div className="space-y-3">
              {nudges.map((n, k) => (
                <motion.div
                  key={n.text}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: k * 0.08 }}
                  className="rounded-md border border-ace-line bg-ace-panel p-4"
                >
                  <div
                    className="m-label"
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

      <div className="mt-10 m-panel p-5 md:p-6">
        <div className="mono mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-ace-dim">
          <span>Next year, played {mc.years.toLocaleString()} times</span>
          <DriftToggle />
        </div>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ace-dim">
          Each simulated year redraws twelve of {nameOf(persona).whose} months; turn drift on to let each category move up or down too.{" "}
          {nameOf(persona).Whose} wallet is dashed; the card added is blue. A card with no fee can only help; a card with a fee has to earn it.
        </p>
        {paidOff && paidOff.hypothetical ? (
          <>
            <p className="mb-4 rounded-[10px] bg-[var(--m-wash)] px-3 py-2 text-sm">
              Projection: once {nameOf(persona).who} {v(nameOf(persona), "clears", "clear")} {money(paidOff.hypothetical.clearedBalance)} on the{" "}
              {paidOff.hypothetical.cards.map(shortName).join(" and ")}. Until then, {b.name} recommends no new card.
            </p>
            <FanChart mc={paidOff} kind="add" pick={recs[0] && `add:${recs[0].id}`} />
          </>
        ) : (
          <FanChart mc={priced.mc} kind="add" pick={recs[0] && `add:${recs[0].id}`} />
        )}
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
      className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`}
    >
      {children}
    </button>
  );
}
