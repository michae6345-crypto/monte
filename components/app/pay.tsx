"use client";

// Pay: where are you, roughly how much, and which card to hold up to the reader. The answer
// counts interest as well as points (lib/engine/interest.ts), and says why in a sentence.

import { useEffect, useMemo, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { Holding, Txn } from "@/lib/engine";
import { choose, type Decision } from "@/lib/engine/interest";
import { CATEGORY_LABEL, QUICK_CATEGORIES, nearbyPlaces, searchPlaces, type Nearby, type Place } from "@/lib/merchants";
import { CardArt, CardMini, shortName } from "@/components/ace/card-art";
import { MerchantLogo } from "@/components/ace/merchant-logo";
import { money } from "@/components/ace/store";
import { why } from "@/lib/explain";
import { perksAt } from "@/lib/perks";
import { storeKey, useFixes } from "./fixes";

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
  const { fixes, setFix } = useFixes();
  const fixed = place ? fixes[storeKey(place.name)] : undefined;
  const category = place ? (fixed ?? place.category) : cat;
  const merchant = place?.name ?? CATEGORY_LABEL[cat] ?? cat;
  // this calendar year's purchases, so caps already used this year/quarter are counted
  const history = useMemo(() => {
    const y = today().slice(0, 4);
    return txns.filter((t) => t.date.startsWith(y));
  }, [txns]);
  const d = useMemo(
    () => (wallet.length && amount > 0 ? choose(wallet, { date: today(), merchant, category, amount }, history, undefined, "actual") : null),
    [wallet, merchant, category, amount, history],
  );
  // the stores you go to most (not the bills that charge you on their own), with a typical amount
  const usual = useMemo(() => {
    const m = new Map<string, { name: string; category: string; n: number; total: number }>();
    for (const t of txns) {
      if (["streaming", "phone", "utilities", "rent"].includes(t.category)) continue;
      const e = m.get(t.merchant) ?? { name: t.merchant, category: t.category, n: 0, total: 0 };
      e.n++;
      e.total += t.amount;
      m.set(t.merchant, e);
    }
    return [...m.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map((e) => ({ name: e.name, category: e.category, typical: e.total / e.n }));
  }, [txns]);

  const pick = (p: Place) => {
    setPlace(p);
    setQ(p.name);
    setNear({ k: "idle" });
  };
  const [auto, setAuto] = useState<Nearby | null>(null);
  const findNear = (opts: { quiet?: boolean } = {}) => {
    if (!("geolocation" in navigator)) return opts.quiet ? undefined : setNear({ k: "error", msg: "This browser can't share a location. Type the store instead." });
    if (!opts.quiet) setNear({ k: "asking" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = await nearbyPlaces(pos.coords.latitude, pos.coords.longitude);
          if (opts.quiet) {
            // opened at a store: take it, if it's close enough to be the one you're standing in
            const here = list[0];
            if (here && here.meters <= 60) {
              setAuto(here);
              setPlace((cur) => cur ?? here);
              setQ((cur) => cur || here.name);
            }
            return;
          }
          setNear(list.length ? { k: "done", list } : { k: "error", msg: "No stores found within 250 m. Type the store instead." });
        } catch {
          if (!opts.quiet) setNear({ k: "error", msg: "OpenStreetMap didn't answer. Type the store instead." });
        }
      },
      () => (opts.quiet ? undefined : setNear({ k: "error", msg: "Location is off for this site. Type the store instead." })),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  // Like a wallet that knows where you are: if this site already has location permission (it
  // never asks on its own), look up the store you're at as the screen opens.
  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (live && s.state === "granted") findNear({ quiet: true });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

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
          <button type="button" onClick={() => findNear()} disabled={near.k === "asking"} className="btn btn-ghost btn-sm">
            <MapPin className="h-4 w-4" /> {near.k === "asking" ? "Finding stores…" : "Near me"}
          </button>
          {place && (
            <span className="flex flex-wrap items-center gap-1 text-xs text-ace-dim">
              {/* "how did this code?": wrong category, fix it once and Monte keeps it */}
              <label className="flex items-center gap-1">
                codes as
                <select
                  value={category}
                  onChange={(e) => setFix(place.name, e.target.value === place.category ? null : e.target.value)}
                  aria-label={`Category ${place.name} codes as`}
                  className="h-7 rounded-full bg-[var(--m-wash)] px-2 text-xs text-ace-ink"
                >
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {fixed ? "(your fix)" : place.via === "words" || place.via === "unknown" ? "(a guess from the name)" : ""}
              {auto && place.name === auto.name && (
                <>
                  {" "}
                  · you&apos;re {auto.meters} m away ·{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuto(null);
                      setPlace(null);
                      setQ("");
                      findNear();
                    }}
                    className="underline underline-offset-2"
                  >
                    not here?
                  </button>
                </>
              )}
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
            <li className="px-3 py-2 text-[11px] text-ace-dim">Stores from OpenStreetMap. Your location goes to komoot&apos;s Photon search (or OpenStreetMap&apos;s Overpass) for this one lookup and isn&apos;t kept by Monte.</li>
          </ul>
        )}

        {!place && usual.length > 0 && (
          <div className="mt-4">
            <p className="m-label mb-2">your usual</p>
            <div className="flex flex-wrap gap-1.5">
              {usual.map((u) => (
                <button
                  key={u.name}
                  type="button"
                  onClick={() => {
                    pick({ name: u.name, category: u.category, via: "known" });
                    setAmount(Math.max(1, Math.round(u.typical)));
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--m-wash)] py-1 pl-1.5 pr-3 text-sm hover:bg-[var(--m-line)]"
                >
                  <MerchantLogo name={u.name} size={20} className="rounded-full" />
                  {u.name}
                </button>
              ))}
            </div>
          </div>
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

      {place && <Perks wallet={wallet} merchant={place.name} />}
      {d && <Answer d={d} where={place ? `at ${place.name}` : `on ${(CATEGORY_LABEL[cat] ?? cat).toLowerCase()}`} />}
    </div>
  );
}

/** A credit one of your cards has at this store: free money that expires, so it comes first. */
function Perks({ wallet, merchant }: { wallet: Holding[]; merchant: string }) {
  const list = perksAt(wallet, merchant);
  if (!list.length) return null;
  return (
    <section className="m-panel border-l-4 border-[var(--m-gain)] p-4" aria-label="Perks here">
      <p className="m-label">use a perk first</p>
      {list.map((p) => (
        <div key={p.cardId + p.credit.name} className="mt-2 flex items-center gap-3">
          <CardMini id={p.cardId} width={40} />
          <p className="text-sm">
            Your {shortName(p.cardId)} has <b>{money(p.credit.amount, { cents: p.credit.amount % 1 !== 0 })} {p.per}</b> of {p.credit.name.replace(/ credit$/i, " credit")}.{" "}
            <span className="text-ace-dim">If this period&apos;s isn&apos;t used yet, pay with it before any card&apos;s points: it doesn&apos;t roll over.</span>
          </p>
        </div>
      ))}
    </section>
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
