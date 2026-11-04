"use client";

// The Monte card, working: a purchase on the card becomes the authorization request a card network
// would send (Lithic's ASA shape), posted to Monte's real responder (/api/card/authorize), which
// answers like an issuer and says which of your cards it played. Every number on screen comes back
// from that server round trip.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lockup, MonteMark } from "@/components/brand";
import { CardArt, CardMini } from "@/components/ace/card-art";
import { MerchantLogo } from "@/components/ace/merchant-logo";
import { money } from "@/components/ace/store";
import { useWallet } from "@/components/app/use-wallet";
import { JORDAN } from "@/lib/data/personas";
import { shortName } from "@/lib/card-name";
import { SAMPLE_MERCHANTS, mccLabel } from "@/lib/card/mcc";
import { merchantName, type Decision } from "@/lib/card/authorize";
import { CATEGORY_LABEL } from "@/lib/merchants";

type Run = { request: Record<string, unknown>; answer: Record<string, unknown>; monte: Decision; roundTripMs: number };

const fmt = (n: number) => money(n, { cents: true });

export function CardLab() {
  const { saved } = useWallet();
  const wallet = saved?.wallet?.length ? saved.wallet : JORDAN.wallet;
  const whose = saved?.wallet?.length ? saved.label : "Jordan (demo)";
  const [k, setK] = useState(0);
  const [amount, setAmount] = useState(SAMPLE_MERCHANTS[0].amount);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issuer, setIssuer] = useState<{ configured: boolean; env: string } | null>(null);
  useEffect(() => {
    fetch("/api/card/lithic", { cache: "no-store" })
      .then((r) => r.json())
      .then(setIssuer)
      .catch(() => setIssuer({ configured: false, env: "sandbox" }));
  }, []);
  const m = SAMPLE_MERCHANTS[k];

  const tapIt = async () => {
    setBusy(true);
    setErr(null);
    const request = {
      token: "auth_" + Math.random().toString(36).slice(2, 10),
      amount: Math.round(amount * 100),
      merchant: { descriptor: m.descriptor, mcc: m.mcc, city: "LOS ANGELES", state: "CA", country: "USA" },
      card: { token: "card_monte_demo", last_four: "4142" },
      // simulator only: an enrolled card carries this in its memo instead
      monte_wallet: wallet.map((h) => ({ cardId: h.cardId, balance: h.balance, apr: h.apr })),
    };
    const t0 = performance.now();
    try {
      const res = await fetch("/api/card/authorize", {
        method: "POST",
        headers: { "content-type": "application/json", "x-monte-debug": "1" },
        body: JSON.stringify(request),
      });
      const json = (await res.json()) as Record<string, unknown> & { monte: Decision };
      if (!res.ok) throw new Error(String(json.error ?? res.status));
      const { monte, ...answer } = json;
      setRun({ request, answer, monte, roundTripMs: performance.now() - t0 });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shownRequest = useMemo(() => {
    if (!run) return null;
    const r = { ...run.request };
    delete r.monte_wallet;
    return r;
  }, [run]);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Monte home">
          <Lockup size={20} state="resolved" />
        </Link>
        <Link href="/app" className="btn btn-ghost btn-sm">
          Open the app
        </Link>
      </header>

      <section className="grid items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="m-label">the monte card · working MVP</p>
          <h1 className="mt-3 text-[2.6rem] leading-[1.03] md:text-[3.4rem]" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.035em" }}>
            One card.
            <span className="block text-ace-dim">Every purchase played right.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ace-dim">
            When you tap a card, the network asks its issuer to approve the purchase, and that request already names the store and its category code. A Monte card&apos;s request comes to Monte, which picks the card in your wallet that earns the most there, unless a balance means it would cost you more in interest. Tap it below: each tap is a real request to Monte&apos;s server, in the format card networks use.
          </p>
        </div>
        <MonteCardFace />
      </section>

      <section className="m-panel overflow-hidden">
        <div className="border-b border-[var(--m-line)] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="m-label">where are you tapping?</p>
            <p className="text-xs text-ace-dim">
              Wallet: <span className="text-ace-ink">{whose}</span> ·{" "}
              {wallet.map((h) => shortName(h.cardId)).join(", ")} ·{" "}
              <Link href="/app#cards" className="underline underline-offset-2">
                change
              </Link>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLE_MERCHANTS.map((s, i) => (
              <button
                key={s.descriptor}
                type="button"
                onClick={() => {
                  setK(i);
                  setAmount(s.amount);
                  setRun(null);
                }}
                aria-pressed={i === k}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${i === k ? "bg-ace-ink text-ace-bg" : "bg-[var(--m-wash)] hover:bg-[var(--m-line)]"}`}
              >
                <MerchantLogo name={merchantName(s.descriptor)} size={18} />
                {merchantName(s.descriptor)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="m-label">amount</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ace-dim">$</span>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="h-9 w-28 rounded-full bg-[var(--m-wash)] pl-6 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
                />
              </span>
            </label>
            <span className="mono text-[11px] text-ace-dim">
              MCC {m.mcc} · {mccLabel(m.mcc)}
            </span>
            <button type="button" onClick={tapIt} disabled={busy || !(amount > 0)} className="btn btn-primary ml-auto">
              {busy ? "Authorizing…" : "Tap the Monte card"}
            </button>
          </div>
          {err && <p className="mt-3 text-sm m-loss">The responder didn&apos;t answer: {err}</p>}
        </div>

        {run ? (
          <div className="grid gap-px bg-[var(--m-line)] lg:grid-cols-3">
            <Step n="01" title="The network asks Monte" sub="the authorization request (Lithic's ASA format)">
              <pre className="mono overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">{JSON.stringify(shownRequest, null, 2)}</pre>
            </Step>
            <Step n="02" title="Monte plays a card" sub={`decided in ${run.monte.ms.toFixed(1)} ms · ${run.roundTripMs.toFixed(0)} ms round trip`}>
              <Played d={run.monte} />
            </Step>
            <Step n="03" title="Monte answers the network" sub="approve, in the issuer's format">
              <pre className="mono overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">{JSON.stringify(run.answer, null, 2)}</pre>
              <p className="mt-3 text-xs text-ace-dim">The terminal says approved. Monte never declines: it routes purchases, it doesn&apos;t police them.</p>
            </Step>
          </div>
        ) : (
          <p className="p-5 text-sm text-ace-dim">Pick a store and tap. The request, Monte&apos;s pick and the answer show here.</p>
        )}
      </section>

      <RecentDecisions bump={run?.request.token as string | undefined} />

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            What&apos;s real
          </h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
            <li>· The decision runs on the network&apos;s own message: the store&apos;s category code and the amount, not a guess from where you are.</li>
            <li>· Monte answers in an issuing platform&apos;s format (Lithic&apos;s Auth Stream Access), checks its signature, and decides in a few milliseconds, well inside the few seconds a terminal waits.</li>
            <li>· The pick counts interest as well as points, and perks like Uber Cash first.</li>
            <li>
              ·{" "}
              {issuer?.configured
                ? `Connected to Lithic's ${issuer.env}: cards can be issued and test purchases run on its network.`
                : "Wiring to a real card network's sandbox is built (Lithic): it switches on with an issuer key."}
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            What isn&apos;t yet
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed">
            Moving the money. If Monte simply charged your chosen card, that card&apos;s issuer would see Monte as the store, not Trader Joe&apos;s, and pay 1× instead of 4×. Doing this properly needs a bank partner and either network tokens for your existing cards or Monte issuing the card and paying the rewards itself. That&apos;s partnerships and compliance, not code.{" "}
            <Link href="/app" className="underline underline-offset-4">
              Until then, the app and the browser extension tell you which card to use
            </Link>
            , with the same decision.
          </p>
        </div>
      </section>
    </div>
  );
}

type Logged = Decision & { at: string; via: string; issuer: string };

/** Every decision this server made recently: from this page's taps, and from a card network once a
 *  Lithic or Stripe sandbox is pointed at it. Refreshes every few seconds while the tab is open. */
function RecentDecisions({ bump }: { bump?: string }) {
  const [list, setList] = useState<Logged[]>([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/card/authorize", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { decisions?: Logged[] }) => live && setList(j.decisions ?? []))
        .catch(() => undefined);
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [bump]);
  if (!list.length) return null;
  return (
    <section className="m-panel mt-6 p-5">
      <p className="m-label">recent decisions on this server</p>
      <ul className="mt-3 divide-y divide-[var(--m-line)]">
        {list.slice(0, 8).map((d) => (
          <li key={d.token + d.at} className="flex items-center gap-3 py-2.5 text-sm">
            <MerchantLogo name={d.merchant} size={26} />
            {/* two lines, so it fits a phone: the store and amount, then when, the code and the card played */}
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {d.merchant} · {fmt(d.amount)}
              </span>
              <span className="mono block truncate text-[11px] text-ace-dim">
                {new Date(d.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })} · MCC {d.mcc} · {d.play ? shortName(d.play.cardId) : "no wallet"}
              </span>
            </span>
            <span className="mono shrink-0 rounded-full bg-[var(--m-wash)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ace-dim">{d.issuer}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Step({ n, title, sub, children }: { n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-ace-panel p-5">
      <p className="mono text-[11px] text-ace-dim">{n}</p>
      <p className="mt-1 font-medium">{title}</p>
      <p className="mb-3 text-xs text-ace-dim">{sub}</p>
      {children}
    </div>
  );
}

function Played({ d }: { d: Decision }) {
  if (!d.play) return <p className="text-sm">{d.why}</p>;
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="w-28 shrink-0">
          <CardArt id={d.play.cardId} size="sm" />
        </div>
        <div className="min-w-0">
          <div className="font-medium leading-tight">{shortName(d.play.cardId)}</div>
          <div className="text-sm">
            <span className={d.play.net >= 0 ? "m-gain" : "m-loss"}>{fmt(d.play.reward)} back</span>
            <span className="text-ace-dim"> on {fmt(d.amount)}</span>
          </div>
          <div className="mono text-[11px] text-ace-dim">
            {d.merchant} · {CATEGORY_LABEL[d.category]?.toLowerCase()}
          </div>
        </div>
      </div>
      {d.perks[0] && (
        <p className="mt-3 rounded-[10px] bg-[var(--m-wash)] p-2 text-xs">
          First: your {shortName(d.perks[0].cardId)}&apos;s {money(d.perks[0].credit.amount)} {d.perks[0].per} {d.perks[0].credit.name}.
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed">{d.why}</p>
      <ul className="mt-3 space-y-1.5 border-t border-[var(--m-line)] pt-3">
        {d.ranked.map((c) => (
          <li key={c.cardId} className="flex items-center gap-2 text-xs">
            <CardMini id={c.cardId} width={28} />
            <span className="min-w-0 flex-1 truncate">{shortName(c.cardId)}</span>
            <span className={`mono ${c.carries && d.mode === "grace" ? "text-ace-dim line-through" : c.net >= 0 ? "m-gain" : "m-loss"}`}>{fmt(c.net)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The card itself: Monte's mark, ink on accent. */
function MonteCardFace() {
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div
        className="relative aspect-[1.586/1] overflow-hidden rounded-[7%/11%] p-6 text-white shadow-[0_30px_60px_-24px_rgba(12,14,20,.6)]"
        style={{ background: "radial-gradient(120% 90% at 15% 0%, #4a5cff 0%, #2f45ff 35%, #0e0f12 100%)" }}
        aria-label="The Monte card"
      >
        <div className="flex items-start justify-between">
          <MonteMark size={30} mono className="text-white" />
          <span className="mono text-[10px] uppercase tracking-[0.2em] opacity-80">every dollar, played right</span>
        </div>
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
          <div>
            <div className="h-7 w-10 rounded-[5px] bg-[linear-gradient(135deg,#e8d08a,#b89a4a_60%,#f3e3a8)]" />
            <div className="mono mt-3 text-sm tracking-[0.2em]">•••• 4142</div>
          </div>
          <span className="text-2xl font-medium tracking-[-0.03em]" style={{ fontFamily: "var(--m-font-display)" }}>
            monte
          </span>
        </div>
      </div>
    </div>
  );
}
