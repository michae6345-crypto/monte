"use client";

// Pay: where are you, roughly how much, and which card to hold up to the reader. The answer
// counts interest as well as points (lib/engine/interest.ts), and says why in a sentence.

import { useMemo, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { Holding, Txn } from "@/lib/engine";
import { choose, type Decision } from "@/lib/engine/interest";
import { CATEGORY_LABEL, QUICK_CATEGORIES, nearbyPlaces, searchPlaces, type Nearby, type Place } from "@/lib/merchants";
import { CardArt, CardMini, shortName } from "@/components/ace/card-art";
import { MerchantLogo } from "@/components/ace/merchant-logo";
import { money } from "@/components/ace/store";

const fmt = (n: number) => money(n, { cents: true });
const today = () => new Date().toISOString().slice(0, 10);
const AMOUNTS = [10, 50, 200];

type Near = { k: "idle" } | { k: "asking" } | { k: "done"; list: Nearby[] } | { k: "error"; msg: string };

export function Pay({ wallet, txns }: { wallet: Holding[]; txns: Txn[] }) {
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [cat, setCat] = useState("groceries");
  const [amount, setAmount] = useState(50);
  const [near, setNear] = useState<Near>({ k: "idle" });

  const suggestions = useMemo(() => (q.trim() && !place ? searchPlaces(q) : []), [q, place]);
  const category = place?.category ?? cat;
  const merchant = place?.name ?? CATEGORY_LABEL[cat] ?? cat;
  // this calendar year's purchases, so caps already used this year/quarter are counted
  const history = useMemo(() => {
    const y = today().slice(0, 4);
    return txns.filter((t) => t.date.startsWith(y));
  }, [txns]);
  const d = useMemo(
    () => (wallet.length && amount > 0 ? choose(wallet, { date: today(), merchant, category, amount }, history) : null),
    [wallet, merchant, category, amount, history],
  );

  const pick = (p: Place) => {
    setPlace(p);
    setQ(p.name);
    setNear({ k: "idle" });
  };
  const findNear = () => {
    if (!("geolocation" in navigator)) return setNear({ k: "error", msg: "This browser can't share a location. Type the store instead." });
    setNear({ k: "asking" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = await nearbyPlaces(pos.coords.latitude, pos.coords.longitude);
          setNear(list.length ? { k: "done", list } : { k: "error", msg: "No stores found within 250 m. Type the store instead." });
        } catch {
          setNear({ k: "error", msg: "OpenStreetMap didn't answer. Type the store instead." });
        }
      },
      () => setNear({ k: "error", msg: "Location is off for this site. Type the store instead." }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-5">
      <section className="m-panel p-4">
        <label htmlFor="where" className="m-label">
          Where are you paying?
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ace-dim" aria-hidden />
          <input
            id="where"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPlace(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) pick(suggestions[0]);
            }}
            placeholder="Trader Joe's, Shell, Uber…"
            autoComplete="off"
            className="h-11 w-full rounded-[12px] bg-[var(--m-wash)] pl-9 pr-9 text-[15px] outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setQ("");
                setPlace(null);
              }}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ace-dim hover:bg-[var(--m-line)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--m-line)] overflow-hidden rounded-[12px] shadow-[0_0_0_1px_var(--m-line)]" role="listbox" aria-label="Stores">
            {suggestions.map((s) => (
              <li key={s.name + s.via}>
                <button type="button" role="option" aria-selected={false} onClick={() => pick(s)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--m-wash)]">
                  <MerchantLogo name={s.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                  <span className="mono shrink-0 text-[11px] text-ace-dim">{CATEGORY_LABEL[s.category]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={findNear} disabled={near.k === "asking"} className="btn btn-ghost btn-sm">
            <MapPin className="h-4 w-4" /> {near.k === "asking" ? "Finding stores…" : "Near me"}
          </button>
          {place && (
            <span className="text-xs text-ace-dim">
              {CATEGORY_LABEL[place.category]}
              {place.via === "words" || place.via === "unknown" ? " (a guess from the name)" : ""}
            </span>
          )}
        </div>
        {near.k === "error" && <p className="mt-2 text-xs text-ace-dim">{near.msg}</p>}
        {near.k === "done" && (
          <ul className="mt-3 max-h-64 divide-y divide-[var(--m-line)] overflow-auto rounded-[12px] shadow-[0_0_0_1px_var(--m-line)]">
            {near.list.map((n) => (
              <li key={n.osm}>
                <button type="button" onClick={() => pick(n)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--m-wash)]">
                  <MerchantLogo name={n.name} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{n.name}</span>
                    <span className="mono block text-[11px] text-ace-dim">
                      {CATEGORY_LABEL[n.category]} · {n.meters} m
                    </span>
                  </span>
                </button>
              </li>
            ))}
            <li className="px-3 py-2 text-[11px] text-ace-dim">Stores from OpenStreetMap. Your location goes to its Overpass service for this one search and isn&apos;t kept.</li>
          </ul>
        )}

        {!place && (
          <div className="mt-4">
            <p className="m-label mb-2">or pick what it is</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`btn btn-sm ${cat === c ? "btn-primary" : "btn-ghost"}`}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5">
          <label htmlFor="amount" className="m-label mr-1">
            About
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ace-dim">$</span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min={1}
              step="1"
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="h-9 w-[4.5rem] rounded-full bg-[var(--m-wash)] pl-6 pr-2 text-sm outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
            />
          </div>
          {AMOUNTS.map((a) => (
            <button key={a} type="button" onClick={() => setAmount(a)} className={`btn btn-sm !px-3 ${amount === a ? "btn-primary" : "btn-ghost"}`}>
              ${a}
            </button>
          ))}
        </div>
      </section>

      {d && <Answer d={d} where={place ? `at ${place.name}` : `on ${(CATEGORY_LABEL[cat] ?? cat).toLowerCase()}`} />}
    </div>
  );
}

function Answer({ d, where }: { d: Decision; where: string }) {
  const p = d.pick;
  return (
    <section className="m-panel overflow-hidden" aria-live="polite">
      <div className="p-5">
        <p className="m-label">pay with</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="w-32 shrink-0 sm:w-40">
            <CardArt id={p.cardId} size="sm" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl leading-tight" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.02em" }}>
              {shortName(p.cardId)}
            </div>
            <div className="mt-1 text-sm">
              <span className={p.net >= 0 ? "m-gain" : "m-loss"}>{p.interest > 0 ? `${fmt(p.net)} net` : `${fmt(p.reward)} back`}</span>
              <span className="text-ace-dim"> {where}</span>
            </div>
            <div className="mono mt-1 text-[11px] text-ace-dim">{p.rule}</div>
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed">{why(d)}</p>
        {d.capNotes.map((n) => (
          <p key={n} className="mt-2 text-xs text-ace-dim">
            {n}
          </p>
        ))}
      </div>
      <ul className="border-t border-[var(--m-line)]">
        {d.ranked.map((c) => (
          <li key={c.cardId} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${c.cardId === p.cardId ? "bg-[var(--m-accent-wash)]" : ""}`}>
            <CardMini id={c.cardId} width={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{shortName(c.cardId)}</span>
              <span className="mono block text-[11px] text-ace-dim">
                {c.mult % 1 ? c.mult.toFixed(1) : c.mult}× · {fmt(c.reward)} back
                {c.interest > 0 ? ` · ${fmt(c.interest)}/mo interest at ${c.apr}%` : ""}
              </span>
            </span>
            <span className={`mono shrink-0 text-xs ${c.carries && d.mode === "grace" ? "text-ace-dim line-through" : c.net >= 0 ? "m-gain" : "m-loss"}`}>{fmt(c.net)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One sentence: why this card, in the terms the person can check. */
export function why(d: Decision): string {
  const p = d.pick;
  const name = shortName(p.cardId);
  if (d.mode === "all")
    return `Every card you have carries a balance, so this costs interest wherever it goes. The ${name} costs the least: it earns ${fmt(p.reward)} and adds about ${fmt(p.interest)} a month at ${p.apr}% APR.`;
  if (d.skipped) {
    const s = d.skipped;
    return `Your ${shortName(s.cardId)} would earn ${fmt(s.reward)}, but it carries a balance, so it has no grace period: this would start costing about ${fmt(s.interest)} a month in interest the day it posts. The ${name} is paid in full, so this costs nothing if you pay that statement.`;
  }
  const next = d.ranked.find((c) => c.cardId !== p.cardId && !c.carries);
  if (!next) return `It's the only card in your wallet${d.mode === "grace" ? " without a balance" : ""}.`;
  if (p.reward - next.reward > 0.004) return `${fmt(p.reward - next.reward)} more than your next-best card here, the ${shortName(next.cardId)}.`;
  return `It ties with your ${shortName(next.cardId)} here, so either works.`;
}
