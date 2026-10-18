"use client";

// The wallet's strategy chart, read like a poker solver's: one row per spending category,
// one column per card, each cell the cents back per dollar there today. The solver's play
// is outlined; cards you shouldn't touch are hatched. Click a cell for the rule and source.

import { useMemo, useState } from "react";
import { tap } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { cardArt, shortName } from "./card-art";
import { label } from "./money";
import { money, nameOf, useAce } from "./store";

export const MCC: Record<string, string> = {
  dining: "5812",
  groceries: "5411",
  online_groceries: "5411",
  gas: "5541",
  ev_charging: "5552",
  transit: "4111",
  rideshare: "4121",
  travel_portal: "4722",
  airfare: "4511",
  hotels: "7011",
  streaming: "4899",
  drugstores: "5912",
  home_improvement: "5200",
  entertainment: "7832",
  rent: "6513",
  utilities: "4900",
  phone: "4814",
  online_retail: "5999",
  wholesale_clubs: "5300",
  everything_else: "····",
};

export const HATCH = "repeating-linear-gradient(135deg, color-mix(in oklab, var(--m-mute) 45%, transparent) 0 2px, transparent 2px 7px)";
const cap = (c: string) => label(c).replace(/^./, (x) => x.toUpperCase());

type Cell = { cardId: string; cpd: number; rule: string; blocked?: string; best: boolean };

export function StrategyChart() {
  const { wallet, txns, persona } = useAce();
  const [sel, setSel] = useState<{ cat: string; cardId: string } | null>(null);

  const rows = useMemo(() => {
    const spend: Record<string, { total: number; merchants: Record<string, number> }> = {};
    for (const t of txns) {
      const s = (spend[t.category] ??= { total: 0, merchants: {} });
      s.total += t.amount;
      s.merchants[t.merchant] = (s.merchants[t.merchant] ?? 0) + 1;
    }
    const quarter = txns.filter((t) => t.date >= "2026-10-01");
    return Object.entries(spend)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([cat, s]) => {
        const merchant = Object.entries(s.merchants).sort((a, b) => b[1] - a[1])[0][0];
        const res = tap(wallet, { date: "2026-10-18", merchant: "", category: cat, amount: 100 }, quarter);
        const cells: Cell[] = wallet.map((h) => {
          const o = res.ranked.find((x) => x.cardId === h.cardId)!;
          return { cardId: h.cardId, cpd: o.reward, rule: o.rule, blocked: o.blocked, best: o.cardId === res.pick.cardId };
        });
        const max = Math.max(...cells.map((c) => c.cpd), 0.01);
        return { cat, merchant, total: s.total, cells, max };
      });
  }, [wallet, txns]);

  const detail = sel && rows.find((r) => r.cat === sel.cat)?.cells.find((c) => c.cardId === sel.cardId);
  const detailCard = sel ? card(sel.cardId) : null;

  return (
    <div>
      <div className="mono mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-ace-dim">
        <span>Strategy chart · {nameOf(persona).whose} wallet · cents back per dollar, Oct 2026</span>
        <span className="flex items-center gap-4 normal-case tracking-normal">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm border-2 border-ace-ink" /> the right card
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm border border-ace-line" style={{ backgroundImage: HATCH }} /> off limits
          </span>
        </span>
      </div>
      <div className="overflow-x-auto m-panel">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="mono text-[11px] text-ace-dim">
              <th className="w-[38%] border-b border-ace-line px-3 py-2.5 text-left font-normal">Store code · category</th>
              {wallet.map((h) => (
                <th key={h.cardId} className="border-b border-l border-ace-line px-2 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-1 shrink-0 rounded-sm" style={{ background: cardArt(h.cardId).bg }} />
                    <span className="truncate text-ace-ink">{shortName(h.cardId)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cat} className="group">
                <td className="border-b border-ace-line px-3 py-2">
                  <span className="mono mr-2 text-[11px] text-ace-dim tnum">{MCC[r.cat] ?? "····"}</span>
                  <span>{cap(r.cat)}</span>
                  <span className="mono ml-2 text-[10px] text-ace-dim">{money(r.total)}/yr</span>
                </td>
                {r.cells.map((c) => {
                  const on = sel?.cat === r.cat && sel.cardId === c.cardId;
                  const heat = c.blocked ? 0 : c.cpd / r.max;
                  return (
                    <td key={c.cardId} className="border-b border-l border-ace-line p-0">
                      <button
                        onClick={() => setSel(on ? null : { cat: r.cat, cardId: c.cardId })}
                        className={`mono relative flex h-10 w-full items-center px-2 text-left tnum transition ${
                          on ? "ring-2 ring-inset ring-ace-gold" : ""
                        }`}
                        style={c.blocked ? { backgroundImage: HATCH } : { background: `color-mix(in oklab, var(--m-ink) ${Math.round(heat * heat * 7)}%, transparent)` }}
                        aria-label={`${shortName(c.cardId)} at ${label(r.cat)}: ${c.cpd.toFixed(1)} cents per dollar${c.best ? ", the right card" : ""}${c.blocked ? ", off limits" : ""}`}
                      >
                        {c.best && <span className="absolute inset-1 rounded-sm border-2 border-ace-ink" />}
                        <span className={c.best ? "font-semibold text-ace-ink" : c.blocked ? "text-ace-ink line-through" : "text-ace-ink"}>{c.cpd.toFixed(1)}¢</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mono mt-3 min-h-[3.5rem] rounded-[14px] border border-dashed border-ace-line px-4 py-3 text-[12px] leading-relaxed text-ace-dim">
        {detail && detailCard && sel ? (
          <>
            <span className="text-ace-ink">
              {shortName(sel.cardId)} · {label(sel.cat)}: {detail.cpd.toFixed(2)}¢ per dollar
            </span>{" "}
            · rule: {detail.rule}
            {detail.blocked ? <span className="text-ace-ink"> · {detail.blocked}</span> : null} · source:{" "}
            <a href={detailCard.source_urls[0]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ace-ink">
              {hostOf(detailCard.source_urls[0])}
            </a>
            , checked {detailCard.checked ?? "17 Oct 2026"}
            {detailCard.unverified ? <span className="text-ace-dim"> · UNVERIFIED</span> : null}
          </>
        ) : (
          <>Click any cell for the rule behind it and the issuer page it came from. Caps already used this quarter are counted.</>
        )}
      </div>
    </div>
  );
}

export function hostOf(u?: string) {
  try {
    return new URL(u ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "issuer terms";
  }
}
