"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { interestFor, marginalValue, pointValue, tap, type Txn } from "@/lib/engine";
import { CARDS, card } from "@/lib/engine/catalog";
import { optimalReplay } from "@/lib/engine/lp";
import { Section } from "./section";
import { MCC, hostOf } from "./strategy";
import { Lockup, PenMark } from "@/components/brand";
import { money, nameOf, useAce } from "./store";
import { CardArt, shortName } from "./card-art";
import { MerchantLogo } from "./merchant-logo";
import { bestSecondCard } from "./one-card";

const ROWS: [string, string, string, string][] = [
  ["Best card at the register", "yes", "yes", "no"],
  ["Useful with one card, or with a balance", "yes", "not advertised", "sells a new card"],
  ["Finds double charges and price rises", "yes", "not advertised", "no"],
  ["Counts interest on a carried balance", "yes", "not advertised", "no"],
  ["Paid by card referrals", "no", "unknown", "yes"],
];

export function MoatSection() {
  const { brand: b } = useBrand();
  return (
    <Section
      id="moat"
      index="08"
      kicker={`Why ${b.name}`}
      title={<>Uno picks the card. {b.name} plays every dollar.</>}
      readout={<>compared on what each one advertises, Oct 2026</>}
    >
      <TwoAnswers />
      <div className="overflow-x-auto m-panel">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mono text-[11px] uppercase tracking-[0.15em] text-ace-dim">
            <tr className="border-b border-ace-line">
              <th className="px-5 py-3 font-normal"></th>
              <th className="px-5 py-3 font-normal text-ace-ink">{b.name}</th>
              <th className="px-5 py-3 font-normal">Uno Wallet</th>
              <th className="px-5 py-3 font-normal">Comparison sites</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, r) => (
              <motion.tr
                key={row[0]}
                className="border-b border-ace-line/70 last:border-b-0"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                transition={{ delay: r * 0.07, duration: 0.4 }}
              >
                {row.map((c, k) => (
                  <td key={k} className={`px-5 py-3 ${k === 0 ? "text-ace-ink" : k === 1 ? "mono font-medium text-ace-ink" : "mono text-ace-dim"}`}>
                    {/* Monte's answers are circled by hand as each row lands, Monte's "no" to referral fees included */}
                    {k === 1 ? <PenMark delay={0.3 + r * 0.07}>{c}</PenMark> : c}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-lg">
        45% of cardholders carried a balance last year (Federal Reserve, May 2026). For them, interest beats any reward.
      </p>
      <p className="mono mt-3 text-[11px] uppercase tracking-wider text-ace-dim">Uno Wallet: from its site. Comparison sites: e.g. NerdWallet.</p>
    </Section>
  );
}

// ---------- Same purchase, two answers ----------

type Answer = { merchant?: string; picker: ReactNode; pickerCard?: string; monte: ReactNode; monteCard?: string };

/** The selected person's own purchase, answered by a card picker (best points, nothing else)
 *  and by Monte. Every figure is the engine's: tap() for the register, marginalValue() for fees. */
function TwoAnswers() {
  const { held: wallet, txns, persona } = useAce();
  const nm = useMemo(() => nameOf(persona), [persona]);
  const a = useMemo<Answer | null>(() => {
    const visits = new Map<string, { t: Txn; n: number }>();
    for (const t of txns) {
      const v = visits.get(t.merchant);
      visits.set(t.merchant, { t: v?.t ?? t, n: (v?.n ?? 0) + 1 });
    }
    const often = [...visits.values()].sort((x, y) => y.n - x.n);
    if (wallet.length === 1) {
      const best = bestSecondCard(wallet, txns);
      return {
        picker: <>Nothing to pick: {nm.who} {nm.plural ? "have" : "has"} one card.</>,
        pickerCard: wallet[0].cardId,
        monte: best && best.w.net > 1 && !wallet[0].balance
          ? <>A {shortName(best.id)} beside it would have added {money(best.w.net)} on last year&apos;s purchases, if both are paid in full.</>
          : wallet[0].balance
            ? <>Pay down the {money(wallet[0].balance)} on it first: at {wallet[0].apr}% it costs {money(interestFor(wallet[0]))} a year. A second card waits until then.</>
            : <>One card is the right call on this spending. Monte still checks it for interest, price rises and double charges.</>,
        monteCard: best && best.w.net > 1 && !wallet[0].balance ? best.id : wallet[0].cardId,
      };
    }
    // a store where the most points sit on a card carrying a balance
    for (const { t } of often) {
      const res = tap(wallet, { date: t.date, merchant: t.merchant, category: t.category, amount: t.amount });
      const top = [...res.ranked].sort((x, y) => y.reward - x.reward)[0];
      const h = wallet.find((x) => x.cardId === top.cardId);
      if (top.blocked && top.cardId !== res.pick.cardId && h?.balance)
        return {
          merchant: t.merchant,
          picker: <>Use the {shortName(top.cardId)}: {top.mult % 1 ? top.mult.toFixed(1) : top.mult}×, +{money(top.reward, { cents: true })} on {money(t.amount, { cents: true })}.</>,
          pickerCard: top.cardId,
          monte: (
            <>
              Use the {shortName(res.pick.cardId)}. The {shortName(top.cardId)} has a {money(h.balance)} balance at {h.apr}%.
            </>
          ),
          monteCard: res.pick.cardId,
        };
    }
    // no balance: the picker is right at the register; Monte also asks whether the card pays for itself
    for (const { t } of often) {
      const res = tap(wallet, { date: t.date, merchant: t.merchant, category: t.category, amount: t.amount });
      const c = card(res.pick.cardId);
      if (c.annual_fee <= 0) continue;
      const m = marginalValue(wallet, txns, res.pick.cardId);
      return {
        merchant: t.merchant,
        picker: <>Use the {shortName(res.pick.cardId)}, +{money(res.pick.reward, { cents: true })}.</>,
        pickerCard: res.pick.cardId,
        monte: (
          <>
            Same card. And its {money(c.annual_fee)} fee bought {money(m.rewardsAdded + m.credits)} of value last year, so it{" "}
            {m.net >= 0 ? `pays for itself by ${money(m.net)}` : `costs ${money(-m.net)} more than it returns`}.
          </>
        ),
        monteCard: res.pick.cardId,
      };
    }
    // the picker is right at the register; what it can't see is the balance or the rest of the year
    const t = often[0]?.t;
    if (!t) return null;
    const res = tap(wallet, { date: t.date, merchant: t.merchant, category: t.category, amount: t.amount });
    const owed = wallet.find((h) => (h.balance ?? 0) > 0);
    return {
      merchant: t.merchant,
      picker: <>Use the {shortName(res.pick.cardId)}, +{money(res.pick.reward, { cents: true })}.</>,
      pickerCard: res.pick.cardId,
      monte: owed ? (
        <>
          Same card. And the {money(owed.balance ?? 0)} on the {shortName(owed.cardId)} costs {money(interestFor(owed))} a year in interest: pay
          that down first.
        </>
      ) : (
        <>Same card. Monte also checks the year for fees, price rises and double charges.</>
      ),
      monteCard: owed?.cardId ?? res.pick.cardId,
    };
  }, [wallet, txns, nm]);
  if (!a) return null;
  return (
    <div className="mb-8">
      <p className="m-label mb-3 flex items-center gap-2">
        {a.merchant && <MerchantLogo name={a.merchant} size={20} />}
        {a.merchant ? `${nm.whose} purchase at ${a.merchant}` : `${nm.whose} wallet`} · two answers
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { who: "A card picker", body: a.picker, card: a.pickerCard, ink: false },
          { who: "Monte", body: a.monte, card: a.monteCard, ink: true },
        ].map((x) => (
          <div key={x.who} className={`flex gap-4 p-5 ${x.ink ? "m-panel-ink rounded-[16px]" : "m-panel"}`}>
            {x.card && <CardArt id={x.card} size="sm" className="w-20 shrink-0 self-start" />}
            <div>
              <div className="m-label" style={x.ink ? { color: "#c3cbff" } : undefined}>
                {x.who}
              </div>
              <p className="mt-2 text-lg leading-snug">{x.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- How it works: the pipeline, and the optimality check run live ----------

/** The engine end to end for the selected person, and the linear program checking that the
 *  routing shown everywhere else is the best possible assignment (lib/engine/lp.ts). */
function Proof() {
  const { held: wallet, txns, r, valuation } = useAce();
  // run after paint, and timed: the milliseconds shown are this browser's
  const [checked, setCheck] = useState<{ bound: number; method: string; ms: number; txns: unknown; wallet: unknown; valuation: unknown } | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const t0 = performance.now();
      const o = optimalReplay(wallet, txns);
      setCheck({ bound: o.bound ?? o.total, method: o.method, ms: performance.now() - t0, txns, wallet, valuation });
    }, 120);
    return () => clearTimeout(id);
  }, [wallet, txns, valuation]);
  const check = checked && checked.txns === txns && checked.wallet === wallet && checked.valuation === valuation ? checked : null;
  const cats = new Set(txns.map((t) => t.category)).size;
  const routed = r.best.total;
  const gap = check ? check.bound - routed : 0;
  const steps: [string, string][] = [
    [txns.length.toLocaleString(), "purchases"],
    [String(cats), "categories"],
    [String(CARDS.length), "card rulebooks"],
    [money(routed, { cents: true }), "rewards, right card"],
    [money(r.net, { cents: true, sign: true }), "net last year"],
  ];
  return (
    <div className="mb-10">
      <ol className="grid gap-px overflow-hidden rounded-[14px] bg-[var(--m-line)] sm:grid-cols-5">
        {steps.map(([n, l], k) => (
          <li key={l} className="bg-ace-panel px-4 py-3">
            <div className="m-num text-[11px]">{String(k + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
              {n}
            </div>
            <div className="text-xs">{l}</div>
          </li>
        ))}
      </ol>
      <p className="m-mono mt-3 min-h-[2.5em] text-[12px] leading-relaxed">
        {check ? (
          <>
            ✓ solver check: no other way of using these cards earns more.{" "}
            {Math.abs(gap) < 0.005 ? "" : `(best possible ${money(check.bound, { cents: true })}) `}
            {Math.max(1, Math.round(check.ms))} ms.
          </>
        ) : (
          "check: running…"
        )}
      </p>
    </div>
  );
}

// ---------- How it works: one real purchase, traced ----------

const STEPS: [string, string][] = [
  ["Sort each purchase", "A year of bank transactions, each tagged with its merchant category code."],
  ["Price it on every card", "Each card's multipliers, caps, credits and annual fee, from the issuer's published terms."],
  ["Route it", "A linear program assigns every purchase to a card and checks that no other assignment earns more."],
  ["Simulate the year", "1,000 seeded runs of the spending give each recommendation the share of years it comes out ahead."],
];

const PICKS = ["Sweetgreen", "Mobil", "Uber", "Trader Joe's"];

export function HowSection() {
  const { brand: b } = useBrand();
  const { txns, held: wallet, r, persona } = useAce();
  const options = useMemo(() => {
    const out: Txn[] = [];
    for (const m of PICKS) {
      const t = [...txns].reverse().find((x) => x.merchant === m);
      if (t) out.push(t);
    }
    if (out.length < 3) out.push(...txns.slice(-3 + out.length));
    return out;
  }, [txns]);
  const [k, setK] = useState(0);
  const t = options[Math.min(k, options.length - 1)];

  const trace = useMemo(() => {
    if (!t) return null;
    const ha = r.actual.hits.find((h) => h.txnId === t.id);
    const hb = r.best.hits.find((h) => h.txnId === t.id);
    const res = tap(wallet, { date: t.date, merchant: t.merchant, category: t.category, amount: t.amount });
    return { ha, hb, res };
  }, [t, r, wallet]);

  return (
    <Section
      id="how"
      index="09"
      kicker="How it works"
      title={<>Four steps from a purchase to a recommendation.</>}
      readout={<>no model decides a dollar amount</>}
      lede={`Pick one of ${nameOf(persona).whose} purchases below to see the numbers at each step.`}
    >
      <ol className="mb-8 grid gap-4 md:grid-cols-2">
        {STEPS.map(([h, body], i) => (
          <li key={h} className="m-panel p-5">
            <div className="m-num text-[11px]">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-lg font-medium text-ace-ink">{h}</div>
            <p className="mt-1 text-sm leading-relaxed">{body}</p>
          </li>
        ))}
      </ol>
      <Proof />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => setK(i)}
            className={`btn btn-sm ${i === k ? "btn-primary" : "btn-ghost"}`}
          >
            {o.merchant} {money(o.amount, { cents: true })}
          </button>
        ))}
      </div>
      {t && trace && (
        <div className="overflow-x-auto m-panel-ink text-[13px]">
          <div className="mono flex items-center justify-between border-b border-white/10 px-5 py-2.5 text-[11px] text-white">
            <span>
              <span className="text-white">$</span> {b.name.toLowerCase()} trace {t.id}
            </span>
          </div>
          <motion.dl key={t.id} className="mono min-w-[640px] space-y-1.5 px-5 py-4" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.09 } } }}>
            <Line k="purchase">
              {t.date} · {t.merchant} · {money(t.amount, { cents: true })}
            </Line>
            <Line k="store code">
              {MCC[t.category] ?? "····"} → category <span className="text-white">{t.category.replace(/_/g, " ")}</span>
            </Line>
            {trace.res.ranked.map((o) => (
              <Line key={o.cardId} k={o.cardId === trace.res.pick.cardId ? "right card" : "card"}>
                <span className={o.cardId === trace.res.pick.cardId ? "font-semibold text-white" : "text-white"}>
                  {shortName(o.cardId)}: {o.rule} → {money(t.amount, { cents: true })} × {o.mult.toFixed(o.mult % 1 ? 1 : 0)} × {cents(o.cardId)}¢ ={" "}
                  {money(o.reward, { cents: true })}
                </span>
                {o.blocked ? <span style={{ color: "#c3cbff" }}> · off limits: carries a balance</span> : null}
                <span className="text-white"> · source {hostOf(card(o.cardId).source_urls[0])}, checked <span className="whitespace-nowrap">{card(o.cardId).checked ?? "2026-10-17"}</span></span>
              </Line>
            ))}
            {trace.ha && trace.hb && (
              <>
                <Line k="as paid">
                  on the {shortName(trace.ha.cardId)} → {money(trace.ha.reward, { cents: true })}
                </Line>
                <Line k="verdict">
                  <span className="text-white">
                    {trace.hb.cardId === trace.ha.cardId
                      ? "right card, nothing left on the table"
                      : trace.hb.reward - trace.ha.reward > 0.004
                        ? `${money(trace.hb.reward - trace.ha.reward, { cents: true })} left on the table: the ${shortName(trace.hb.cardId)} was the right card`
                        : `the ${shortName(trace.hb.cardId)} was the right card: the card used carries a balance, so this purchase started charging interest`}
                  </span>
                </Line>
              </>
            )}
          </motion.dl>
        </div>
      )}
    </Section>
  );
}

function cents(id: string) {
  const v = pointValue(card(id));
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function Line({ k, children }: { k: string; children: ReactNode }) {
  return (
    <motion.div variants={{ h: { opacity: 0, x: -6 }, s: { opacity: 1, x: 0 } }} className="flex gap-4">
      <dt className="w-24 shrink-0 text-white">{k}</dt>
      <dd className="min-w-0 break-words text-white">{children}</dd>
    </motion.div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ace-line py-12">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 text-sm text-ace-dim md:flex-row">
        <Lockup size={28} state="resolved" />
      </div>
    </footer>
  );
}
