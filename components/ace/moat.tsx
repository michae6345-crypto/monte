"use client";

import { useBrand } from "./brands";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { pointValue, tap, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { Section } from "./section";
import { MCC, hostOf } from "./strategy";
import { money, useAce } from "./store";

const ROWS: [string, string, string, string][] = [
  ["Best card at the register", "yes", "yes", "no"],
  ["Counts interest on a carried balance", "yes", "not advertised", "no"],
  ["Values perks at what you actually use", "yes", "lists perks", "lists perks"],
  ["Ranks cards on your own year of spending", "yes", "not advertised", "on a profile"],
  ["Card rules linked to the issuer page, with the date checked", "yes", "not advertised", "not advertised"],
  ["Paid by card referrals", "no", "unknown", "yes"],
];

const NOTES = [
  "Referral-funded comparison sites earn a fee on each approval. Monte ranks by what a card adds to your year after fees, and says so when the answer is no new card.",
  "45% of cardholders carried a balance last year (Fed SHED, May 2026). For them, interest outweighs any reward, so a points-only ranking points the wrong way.",
  "Issuers decide categories by merchant code and don't publish the map. Each merchant a user re-categorises improves the map for everyone.",
];

export function MoatSection() {
  const { brand: b } = useBrand();
  return (
    <Section
      id="moat"
      index="08"
      kicker={`Why ${b.name}`}
      title={<>Uno picks the card. {b.name} also counts the fees and the interest.</>}
      readout={<>compared on what each one advertises, Oct 2026</>}
    >
      <div className="overflow-x-auto rounded-lg border border-ace-line bg-ace-panel">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mono text-[11px] uppercase tracking-[0.15em] text-ace-dim">
            <tr className="border-b border-ace-line">
              <th className="px-5 py-3 font-normal"></th>
              <th className="px-5 py-3 font-normal text-ace-gold">{b.name}</th>
              <th className="px-5 py-3 font-normal">Uno Wallet</th>
              <th className="px-5 py-3 font-normal">Comparison sites</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row[0]} className="border-b border-ace-line/70 last:border-b-0">
                {row.map((c, k) => (
                  <td key={k} className={`px-5 py-3 ${k === 0 ? "text-ace-ink" : k === 1 ? "mono font-medium text-ace-gold" : "mono text-ace-dim"}`}>
                    {c}
                    {k === 0 && i < NOTES.length ? <sup className="mono ml-1 text-[10px] text-ace-dim">{i + 1}</sup> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="mt-5 grid gap-3 text-[13px] leading-relaxed text-ace-dim md:grid-cols-3">
        {NOTES.map((n, i) => (
          <li key={i} className="flex gap-2">
            <span className="mono text-ace-ink">{i + 1}</span>
            <span>{n}</span>
          </li>
        ))}
      </ol>
      <p className="mono mt-5 text-[10px] uppercase tracking-wider text-ace-dim">
        Uno Wallet (YC Spring 2026) from what its site advertises; it is waitlist-only. Comparison sites means referral-funded sites such as NerdWallet.
      </p>
    </Section>
  );
}

// ---------- How it works: one real purchase, traced ----------

const PICKS = ["Sweetgreen", "Mobil", "Uber", "Trader Joe's"];

export function HowSection() {
  const { brand: b } = useBrand();
  const { txns, wallet, r, persona } = useAce();
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
      title={<>Every number is arithmetic on published terms.</>}
      readout={<>no model decides a dollar amount</>}
      lede={`Pick one of ${persona.name}'s purchases and follow it through: merchant, merchant code, category, every card's published rule, and the cents.`}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => setK(i)}
            className={`mono rounded-md border px-3 py-1.5 text-[12px] transition ${
              i === k ? "border-ace-ink bg-ace-ink text-ace-bg" : "border-ace-line bg-ace-panel text-ace-dim hover:text-ace-ink"
            }`}
          >
            {o.merchant} {money(o.amount, { cents: true })}
          </button>
        ))}
      </div>
      {t && trace && (
        <div className="overflow-x-auto rounded-lg border border-ace-line bg-ace-ink text-[13px] text-ace-bg">
          <div className="mono flex items-center justify-between border-b border-white/10 px-5 py-2.5 text-[11px] text-white/50">
            <span>
              <span style={{ color: "var(--ace-gold)" }}>$</span> {b.name.toLowerCase()} trace {t.id}
            </span>
            <span>deterministic · same input, same output</span>
          </div>
          <motion.dl key={t.id} className="mono min-w-[640px] space-y-1.5 px-5 py-4" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.09 } } }}>
            <Line k="purchase">
              {t.date} · {t.merchant} · {money(t.amount, { cents: true })}
            </Line>
            <Line k="mcc">
              {MCC[t.category] ?? "····"} → category <span className="text-white">{t.category}</span>
            </Line>
            {trace.res.ranked.map((o) => (
              <Line key={o.cardId} k={o.cardId === trace.res.pick.cardId ? "pick" : "card"}>
                <span className={o.cardId === trace.res.pick.cardId ? "text-white" : "text-white/60"}>
                  {o.cardId}: {o.rule} → {money(t.amount, { cents: true })} × {o.mult.toFixed(o.mult % 1 ? 1 : 0)} × {cents(o.cardId)}¢ ={" "}
                  {money(o.reward, { cents: true })}
                </span>
                {o.blocked ? <span style={{ color: "var(--ace-loss)" }}> · off limits: carries a balance</span> : null}
                <span className="text-white/35"> · src {hostOf(card(o.cardId).source_urls[0])}, checked {card(o.cardId).checked ?? "2026-10-17"}</span>
              </Line>
            ))}
            {trace.ha && trace.hb && (
              <>
                <Line k="actual">
                  paid on {trace.ha.cardId} → {money(trace.ha.reward, { cents: true })}
                </Line>
                <Line k="verdict">
                  <span style={{ color: trace.hb.reward - trace.ha.reward > 0.004 ? "var(--ace-loss)" : "var(--ace-gain)" }}>
                    {trace.hb.cardId === trace.ha.cardId
                      ? "right card, nothing left on the table"
                      : trace.hb.reward - trace.ha.reward > 0.004
                        ? `${money(trace.hb.reward - trace.ha.reward, { cents: true })} left on the table: ${trace.hb.cardId} was the play`
                        : `${trace.hb.cardId} was the play: the card used carries a balance, so this purchase started charging interest`}
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
    <motion.div variants={{ h: { opacity: 0, x: -6 }, s: { opacity: 1, x: 0 } }} className="flex gap-4 whitespace-nowrap">
      <dt className="w-16 shrink-0 text-white/40">{k}</dt>
      <dd className="text-white/80">{children}</dd>
    </motion.div>
  );
}

export function Footer() {
  const { brand: b } = useBrand();
  return (
    <footer className="border-t border-ace-line py-12">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 text-sm text-ace-dim md:flex-row">
        <p>
          <span className="font-medium text-ace-ink">{b.name}</span> · built at ACM@USC TrojanHacks 2026 by Adrian Erlikhman and Michael Tarekegn, with
          Claude Code.
        </p>
        <p className="mono text-[11px] uppercase tracking-wider">Card terms checked 17 Oct 2026 · Demo people are synthetic · Not financial advice</p>
      </div>
    </footer>
  );
}
