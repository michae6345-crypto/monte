"use client";

// Year: once a bank or a statement is connected, what the cards actually made or cost, the
// biggest single misses, and what keeps charging. The same engine as the story page, on your data.

import { useMemo } from "react";
import { receipt, type Holding, type Txn } from "@/lib/engine";
import { subscriptions } from "@/lib/engine/insights";
import { CardMini, shortName } from "@/components/ace/card-art";
import { MerchantLogo } from "@/components/ace/merchant-logo";
import { money } from "@/components/ace/store";
import { Share2 } from "lucide-react";
import { shareYear } from "./share-image";

// nothing is "$0.00", not "+$0.00" (Maya has no interest and no perks)
const day = (iso?: string) => (iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");
const fmt = (n: number, sign = false) => (Math.abs(n) < 0.005 ? "$0.00" : money(n, { cents: true, sign }));

export function Year({ wallet, txns, onConnect }: { wallet: Holding[]; txns: Txn[]; onConnect: () => void }) {
  const r = useMemo(() => (txns.length && wallet.length ? receipt(wallet, txns) : null), [wallet, txns]);
  const misses = useMemo(() => {
    if (!r) return [];
    const best = new Map(r.best.hits.map((h) => [h.txnId, h]));
    const byId = new Map(txns.map((t) => [t.id, t]));
    return r.actual.hits
      .map((a) => ({ a, b: best.get(a.txnId)!, t: byId.get(a.txnId)! }))
      .filter((x) => x.b && x.t && x.b.reward - x.a.reward > 0.005)
      .sort((x, y) => y.b.reward - y.a.reward - (x.b.reward - x.a.reward))
      .slice(0, 5);
  }, [r, txns]);
  const subs = useMemo(() => subscriptions(txns).slice(0, 6), [txns]);
  // Fees, perks and interest are yearly; purchases may cover less (a one-month statement). Scale
  // the yearly items to the days the purchases cover, so a month isn't set against a year.
  const span = useMemo(() => {
    if (!txns.length) return { days: 0, f: 1 };
    const d = (s: string) => Date.parse(s + "T12:00:00Z");
    const days = Math.round((d(txns[txns.length - 1].date) - d(txns[0].date)) / 864e5) + 1;
    return { days, f: days >= 330 ? 1 : Math.max(1, days) / 365 };
  }, [txns]);
  const y = useMemo(() => {
    if (!r) return null;
    const f = span.f;
    const perCard = r.perCard.map((c) => ({ ...c, credits: c.credits * f, fee: c.fee * f, interest: c.interest * f, net: c.rewards + (c.credits - c.fee - c.interest) * f }));
    return { rewards: r.rewards, credits: r.credits * f, fees: r.fees * f, interest: r.interest * f, net: r.rewards + (r.credits - r.fees - r.interest) * f, perCard };
  }, [r, span]);

  if (!r || !y)
    return (
      <section className="m-panel p-5 text-center">
        <p className="text-lg" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
          Your year shows up here
        </p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ace-dim">
          Connect a bank with Plaid or upload a card statement, and Monte adds up what each card earned and what it cost you.
        </p>
        <button type="button" onClick={onConnect} className="btn btn-primary mt-4">
          Connect
        </button>
      </section>
    );

  const first = txns[0]?.date;
  const last = txns[txns.length - 1]?.date;
  return (
    <div className="space-y-4">
      <section className="m-panel p-5">
        <p className="m-label">
          {txns.length.toLocaleString()} purchases · <span className="whitespace-nowrap">{day(first)}</span> to <span className="whitespace-nowrap">{day(last)}</span>
        </p>
        <div className={`mt-2 text-5xl ${y.net >= 0 ? "m-gain" : "m-loss"}`} style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.03em" }}>
          {fmt(y.net, true)}
        </div>
        <p className="mt-1 text-sm text-ace-dim">
          {y.net >= 0 ? "what your cards made you" : "what your cards cost you"}, after fees and interest
          {span.f < 1 ? `, over these ${span.days} days (fees, perks and interest prorated)` : ""}
        </p>
        <dl className="mono mt-4 grid grid-cols-2 gap-y-1.5 text-[13px]">
          <dt className="text-ace-dim">rewards</dt>
          <dd className={`text-right ${y.rewards > 0.005 ? "m-gain" : "text-ace-dim"}`}>{fmt(y.rewards, true)}</dd>
          <dt className="text-ace-dim">credits used</dt>
          <dd className={`text-right ${y.credits > 0.005 ? "m-gain" : "text-ace-dim"}`}>{fmt(y.credits, true)}</dd>
          <dt className="text-ace-dim">{span.f < 1 ? "annual fees (prorated)" : "annual fees"}</dt>
          <dd className={`text-right ${y.fees > 0.005 ? "m-loss" : "text-ace-dim"}`}>{fmt(-y.fees, true)}</dd>
          <dt className="text-ace-dim">{span.f < 1 ? "interest (prorated)" : "interest (a year at today’s balance)"}</dt>
          <dd className={`text-right ${y.interest > 0.005 ? "m-loss" : "text-ace-dim"}`}>{fmt(-y.interest, true)}</dd>
        </dl>
        {r.leftOnTable > 0.005 && (
          <p className="mt-4 rounded-[12px] bg-[var(--m-accent-wash)] p-3 text-sm">
            The right card every time would have earned <b>{fmt(r.leftOnTable)}</b> more on the same purchases, with the cards you already have.
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            shareYear({ net: y.net, rewards: y.rewards, credits: y.credits, fees: y.fees, interest: y.interest, left: r.leftOnTable, purchases: txns.length, cards: wallet.length }).catch(() => undefined)
          }
          className="btn btn-ghost btn-sm mt-4"
        >
          <Share2 className="h-4 w-4" /> Share my year
        </button>
        <p className="mt-1 text-[11px] text-ace-dim">An image of these totals only: no stores, no purchases, no card details.</p>
      </section>

      <section className="m-panel p-5">
        <p className="m-label mb-3">each card</p>
        <ul className="space-y-3">
          {y.perCard.map((c) => (
            <li key={c.cardId} className="flex items-center gap-3 text-sm">
              <CardMini id={c.cardId} width={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{shortName(c.cardId)}</span>
                <span className="mono block text-[11px] text-ace-dim">
                  {fmt(c.rewards + c.credits)} in · {fmt(c.fee + c.interest)} out
                </span>
              </span>
              <span className={`mono ${c.net >= 0 ? "m-gain" : "m-loss"}`}>{fmt(c.net, true)}</span>
            </li>
          ))}
        </ul>
      </section>

      {misses.length > 0 && (
        <section className="m-panel p-5">
          <p className="m-label mb-3">biggest misses</p>
          <ul className="space-y-3">
            {misses.map(({ a, b, t }) => (
              <li key={t.id} className="flex items-center gap-3 text-sm">
                <MerchantLogo name={t.merchant} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {t.merchant} · {fmt(t.amount)}
                  </span>
                  <span className="mono block text-[11px] text-ace-dim">
                    {day(t.date)} · {shortName(a.cardId)} → {shortName(b.cardId)}
                  </span>
                </span>
                <span className="mono m-gain">{fmt(b.reward - a.reward, true)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {subs.length > 0 && (
        <section className="m-panel p-5">
          <p className="m-label mb-3">keeps charging you</p>
          <ul className="space-y-2.5">
            {subs.map((s) => (
              <li key={s.merchant} className="flex items-center gap-3 text-sm">
                <MerchantLogo name={s.merchant} size={24} />
                <span className="min-w-0 flex-1 truncate">
                  {s.merchant}
                  {s.priceHike && <span className="ml-2 text-[11px] m-loss">price went up</span>}
                </span>
                <span className="mono text-[13px]">{fmt(s.perYear)}/yr</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
