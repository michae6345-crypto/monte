"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useBrand } from "./brands";
import { CardMini, shortName } from "./card-art";
import { CAT_COLOR, label } from "./money";
import { Bracketed } from "@/components/brand";
import { MerchantLogo } from "./merchant-logo";
import { Trace } from "./trace";
import { provenanceFor } from "@/lib/engine/provenance";

const CATEGORIES = Object.keys(CAT_COLOR).filter((c) => c !== "other");
import { R, Section } from "./section";
import { money, useAce } from "./store";

export function HistorySection() {
  const { txns, r, wallet, overrides, setOverride, resetOverrides, persona } = useAce();
  const { brand: b } = useBrand();
  const [q, setQ] = useState("");
  const [onlyMiss, setOnlyMiss] = useState(false);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [limit, setLimit] = useState(14);
  // a new person starts with a clean table
  const [shownFor, setShownFor] = useState(persona.id);
  if (shownFor !== persona.id) {
    setShownFor(persona.id);
    setQ("");
    setOnlyMiss(false);
    setMerchant(null);
    setLimit(14);
  }

  const rows = useMemo(() => {
    const a = new Map(r.actual.hits.map((h) => [h.txnId, h]));
    const bh = new Map(r.best.hits.map((h) => [h.txnId, h]));
    return [...txns]
      .sort((x, y) => y.date.localeCompare(x.date))
      .map((t) => {
        const ha = a.get(t.id)!;
        const hb = bh.get(t.id)!;
        return { t, ha, hb, used: ha.cardId, got: ha.reward, best: hb.cardId, could: hb.reward, rule: hb.rule, miss: hb.reward - ha.reward };
      });
  }, [txns, r]);

  const filtered = rows.filter(
    (x) =>
      (!q || x.t.merchant.toLowerCase().includes(q.toLowerCase()) || x.t.category.includes(q.toLowerCase())) &&
      (!onlyMiss || x.miss > 0.005) &&
      (!merchant || x.t.merchant === merchant),
  );
  const missTotal = filtered.reduce((s, x) => s + x.miss, 0);
  const balanceCards = new Set(wallet.filter((h) => h.balance).map((h) => h.cardId));
  const spendTotal = filtered.reduce((s, x) => s + x.t.amount, 0);

  return (
    <Section
      id="history"
      index="03"
      kicker="Every purchase, judged"
      title={
        wallet.length === 1 ? (
          <>
            <Bracketed>{rows.length}</Bracketed> purchases,
            <span className="m-second block">every one on the {shortName(wallet[0].cardId)}.</span>
          </>
        ) : (
          <>
            <Bracketed>{rows.filter((x) => x.used !== x.best).length}</Bracketed> of {rows.length} purchases
            <span className="m-second block">went on the wrong card.</span>
          </>
        )
      }
      readout={
        wallet.length === 1 ? (
          <>
            <R>{rows.length}</R> purchases · <R tone="gain">{money(r.rewards, { cents: true })}</R> earned
          </>
        ) : (
          <>
            <R tone="loss">{rows.filter((x) => x.used !== x.best).length}</R> of <R>{rows.length}</R> not on {b.name}&apos;s pick · <R tone="loss">{money(r.leftOnTable)}</R> left on the table
          </>
        )
      }
      lede={
        wallet.length === 1
          ? "Every purchase, what it earned and the rule behind it. Search it, or click a merchant to see every visit. If a store is in the wrong category, fix it here."
          : `Every purchase you made, the card you paid with, and the card ${b.name} would have picked, with what the difference cost you. Search it, or click a merchant to see every visit.`
      }
    >
      <div className="m-panel p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMerchant(null);
            }}
            placeholder="Search a merchant or category…"
            className="h-9 min-w-[220px] flex-1 rounded-full bg-ace-panel px-4 text-sm shadow-[0_0_0_1px_var(--m-line-strong)] outline-none placeholder:text-ace-dim focus:shadow-[0_0_0_1.5px_var(--m-ink)]"
          />
          {Object.keys(overrides).length > 0 && (
            <button onClick={resetOverrides} className="btn btn-ghost btn-sm">
              {Object.keys(overrides).length} store{Object.keys(overrides).length > 1 ? "s" : ""} re-counted · reset
            </button>
          )}
          {wallet.length > 1 && (
            <button
              onClick={() => setOnlyMiss((v) => !v)}
              className={`btn btn-sm ${onlyMiss ? "btn-primary" : "btn-ghost"}`}
            >
              Only the misses
            </button>
          )}
          {merchant && (
            <button onClick={() => setMerchant(null)} className="btn btn-primary btn-sm">
              {merchant} ✕
            </button>
          )}
          {merchant && (
            <label className="flex items-center gap-2 text-sm text-ace-dim">
              count {merchant} as
              <select
                value={overrides[merchant] ?? txns.find((t) => t.merchant === merchant)?.category ?? ""}
                onChange={(e) => setOverride(merchant, e.target.value)}
                className="h-9 rounded-full bg-ace-panel px-3 text-sm text-ace-ink shadow-[0_0_0_1px_var(--m-line-strong)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
              {overrides[merchant] && (
                <button onClick={() => setOverride(merchant, null)} className="text-xs underline underline-offset-2">
                  undo
                </button>
              )}
            </label>
          )}
          <div className="mono ml-auto text-right text-xs text-ace-dim">
            {filtered.length} purchases · {money(spendTotal)} ·{" "}
            <span className={missTotal > 0.5 ? "text-ace-loss" : ""}>{money(missTotal, { cents: true })} left on the table (net)</span>
          </div>
        </div>

        <div className="mono hidden grid-cols-[88px_1.4fr_1fr_90px_1.3fr_1.3fr_80px] gap-3 border-b border-ace-line pb-2 text-[10px] uppercase tracking-[0.15em] text-ace-dim md:grid">
          <span>Date</span>
          <span>Merchant</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
          <span>Paid with</span>
          <span>Should have used</span>
          <span className="text-right">Missed</span>
        </div>
        <div>
          <AnimatePresence initial={false}>
            {filtered.slice(0, limit).map((x) => (
              <motion.div
                key={x.t.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-ace-line/60 py-2.5 text-sm md:grid-cols-[88px_1.4fr_1fr_90px_1.3fr_1.3fr_80px] md:items-center"
              >
                <span className="text-[13px] font-medium text-ace-dim" style={{ fontFamily: "var(--m-font-display)" }}>{new Date(x.t.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <button onClick={() => setMerchant(x.t.merchant)} className="flex min-w-0 items-center gap-2 text-left font-medium hover:underline">
                  <MerchantLogo name={x.t.merchant} size={20} />
                  <span className="truncate">{x.t.merchant}</span>
                </button>
                <span className="flex items-center gap-1.5 text-xs capitalize text-ace-dim">
                  <span className="size-2 rounded-full" style={{ background: CAT_COLOR[x.t.category] }} />
                  {label(x.t.category)}
                </span>
                <span className="tnum text-right font-semibold" style={{ fontFamily: "var(--m-font-display)" }}>{money(x.t.amount, { cents: true })}</span>
                <CardTag id={x.used} />
                {x.best === x.used ? <span className="text-[13px] font-medium text-ace-gain">✓ right card</span> : <CardTag id={x.best} hint={x.rule} />}
                {x.miss > 0.005 ? (
                  <span className="text-right text-ace-loss"><Trace lines={[provenanceFor(x.hb, x.t), provenanceFor(x.ha, x.t)]}><Bracketed state="rest">{money(-x.miss, { sign: true, cents: true })}</Bracketed></Trace></span>
                ) : x.miss < -0.005 && balanceCards.has(x.used) ? (
                  <span className="text-right text-[11px] leading-tight text-ace-dim" title="This card carries a balance, so new purchases on it accrue interest from day one.">
                    avoids interest
                    <br />
                    <span className="mono">earns {money(-x.miss, { cents: true })} less</span>
                  </span>
                ) : (
                  <span className="mono text-right text-ace-dim">—</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {filtered.length > limit && (
          <button onClick={() => setLimit((l) => l + 40)} className="mt-4 w-full rounded-md border border-ace-line py-2 text-sm text-ace-dim hover:text-ace-ink">
            Show more ({filtered.length - limit} left)
          </button>
        )}
      </div>
    </Section>
  );
}

function CardTag({ id, hint }: { id: string; hint?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2" title={hint}>
      <CardMini id={id} />
      <span className="truncate text-[13px] font-medium">{shortName(id)}</span>
    </span>
  );
}
