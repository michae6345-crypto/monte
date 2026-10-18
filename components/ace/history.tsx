"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useBrand } from "./brands";
import { cardArt, shortName } from "./card-art";
import { CAT_COLOR, label } from "./money";
import { Section } from "./section";
import { money, useAce } from "./store";

export function HistorySection() {
  const { txns, r, wallet } = useAce();
  const { brand: b } = useBrand();
  const [q, setQ] = useState("");
  const [onlyMiss, setOnlyMiss] = useState(false);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [limit, setLimit] = useState(14);

  const rows = useMemo(() => {
    const a = new Map(r.actual.hits.map((h) => [h.txnId, h]));
    const bh = new Map(r.best.hits.map((h) => [h.txnId, h]));
    return [...txns]
      .sort((x, y) => y.date.localeCompare(x.date))
      .map((t) => {
        const ha = a.get(t.id)!;
        const hb = bh.get(t.id)!;
        return { t, used: ha.cardId, got: ha.reward, best: hb.cardId, could: hb.reward, rule: hb.rule, miss: hb.reward - ha.reward };
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
        <>
          Your purchase history, <span className="serif text-ace-gold">with a verdict.</span>
        </>
      }
      lede={`Every purchase you made, the card you paid with, and the card ${b.name} would have picked, with what the difference cost you. Search it, or click a merchant to see every visit.`}
    >
      <div className="rounded-3xl border border-ace-line bg-ace-panel/70 p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMerchant(null);
            }}
            placeholder="Search a merchant or category…"
            className="min-w-[220px] flex-1 rounded-full border border-ace-line bg-ace-bg px-4 py-2 text-sm outline-none placeholder:text-ace-dim focus:border-ace-gold"
          />
          <button
            onClick={() => setOnlyMiss((v) => !v)}
            className={`rounded-full border px-4 py-2 text-sm transition ${onlyMiss ? "border-ace-loss bg-ace-loss/10 text-ace-loss" : "border-ace-line text-ace-dim"}`}
          >
            Only the misses
          </button>
          {merchant && (
            <button onClick={() => setMerchant(null)} className="rounded-full border border-ace-gold bg-ace-gold/10 px-4 py-2 text-sm">
              {merchant} ✕
            </button>
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
                <span className="mono text-xs text-ace-dim">{new Date(x.t.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <button onClick={() => setMerchant(x.t.merchant)} className="truncate text-left font-medium hover:text-ace-gold">
                  {x.t.merchant}
                </button>
                <span className="flex items-center gap-1.5 text-xs capitalize text-ace-dim">
                  <span className="size-2 rounded-full" style={{ background: CAT_COLOR[x.t.category] }} />
                  {label(x.t.category)}
                </span>
                <span className="mono text-right">{money(x.t.amount, { cents: true })}</span>
                <CardTag id={x.used} />
                {x.best === x.used ? <span className="text-xs text-ace-gain">✓ right card</span> : <CardTag id={x.best} hint={x.rule} />}
                {x.miss > 0.005 ? (
                  <span className="mono text-right text-ace-loss">−{money(x.miss, { cents: true })}</span>
                ) : x.miss < -0.005 && balanceCards.has(x.used) ? (
                  <span className="text-right text-[11px] leading-tight text-ace-dim" title="This card carries a balance, so new purchases on it accrue interest from day one.">
                    no interest
                    <br />
                    <span className="mono">({money(x.miss, { cents: true })} pts)</span>
                  </span>
                ) : (
                  <span className="mono text-right text-ace-dim">—</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {filtered.length > limit && (
          <button onClick={() => setLimit((l) => l + 40)} className="mt-4 w-full rounded-full border border-ace-line py-2 text-sm text-ace-dim hover:text-ace-ink">
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
      <span className="h-3.5 w-5 shrink-0 rounded-[3px]" style={{ background: cardArt(id).bg }} />
      <span className="truncate text-xs">{shortName(id)}</span>
    </span>
  );
}
