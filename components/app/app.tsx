"use client";

// Monte, the app (/app): the product behind the story page. Four tabs:
//   Pay      where you are -> which card to hold up, counting interest as well as points
//   Cards    your wallet: what each card is best at, and which ones carry a balance
//   Year     with a bank or statement connected: what your cards made or cost you
//   Connect  Plaid, a statement, or a demo person; and forget everything
// Everything lives in this browser (use-wallet.ts). No account, nothing stored server-side.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, CreditCard, Link2, ScanLine } from "lucide-react";
import { Lockup } from "@/components/brand";
import { Pay } from "./pay";
import { Cards } from "./cards";
import { Year } from "./year";
import { Connect } from "./connect";
import { useWallet } from "./use-wallet";
import { QuickStart } from "./quick-start";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { walletFromHash } from "./share";
import { applyFixes, useFixes } from "./fixes";
import { shortName } from "@/lib/card-name";
import type { Holding } from "@/lib/engine";

type Tab = "pay" | "cards" | "year" | "connect";
const TABS: { k: Tab; label: string; Icon: typeof ScanLine }[] = [
  { k: "pay", label: "Pay", Icon: ScanLine },
  { k: "cards", label: "Cards", Icon: CreditCard },
  { k: "year", label: "Year", Icon: CalendarRange },
  { k: "connect", label: "Connect", Icon: Link2 },
];

export function MonteApp() {
  const { saved, save, update, clear } = useWallet();
  const [tab, setTab] = useState<Tab>("pay");
  // a link straight to a tab (/app#cards), e.g. from the extension or the story page
  // works with no signal inside a store: production builds cache the app (public/sw.js)
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  const [incoming, setIncoming] = useState<Holding[] | null>(null);
  useEffect(() => {
    const read = () => {
      // a link with cards in it (from "Copy to another device"): offer them, then tidy the address
      const shared = walletFromHash(window.location.hash);
      if (shared) {
        setIncoming(shared);
        history.replaceState(null, "", "/app");
        return;
      }
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.k === h)) setTab(h);
    };
    // after hydration (the server always renders Pay), and whenever the hash changes
    const id = window.setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(id);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  // a message that outlives the tab that made it (Connect switches to Pay as it finishes)
  const [notice, setNotice] = useState<string | null>(null);
  const go = (t: Tab, message?: string) => {
    setNotice(message ?? null);
    setTab(t);
    history.replaceState(null, "", t === "pay" ? "/app" : `/app#${t}`);
    window.scrollTo({ top: 0 });
  };

  const wallet = saved?.wallet ?? [];
  // your category corrections apply to your year too
  const { fixes } = useFixes();
  const txns = useMemo(() => applyFixes(saved?.txns ?? [], fixes), [saved, fixes]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--m-ground)_88%,transparent)] px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="Monte home">
          <Lockup size={20} state="resolved" />
        </Link>
        {saved && (
          <button type="button" onClick={() => go("connect")} className="flex min-w-0 max-w-[65%] items-baseline text-xs text-ace-dim">
            <span className="truncate">{saved.label}</span>
            <span className="shrink-0 whitespace-nowrap">
              &nbsp;· {wallet.length} card{wallet.length === 1 ? "" : "s"}
            </span>
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 pt-2">
        {notice && (
          <p role="status" className="mb-4 flex items-start justify-between gap-3 rounded-[12px] bg-[var(--m-accent-wash)] p-3 text-sm">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-ace-dim">
              ×
            </button>
          </p>
        )}
        {incoming && (
          <section role="status" className="m-panel mb-4 border-l-4 border-[var(--m-accent)] p-4 text-sm">
            <p>
              This link has {incoming.length} card{incoming.length === 1 ? "" : "s"}: {incoming.map((h) => shortName(h.cardId)).join(", ")}.
              {saved && saved.wallet.length ? " Using them replaces the cards in this browser." : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  save({ source: "manual", label: "Cards from a link", wallet: incoming, txns: [] });
                  setIncoming(null);
                  go("pay");
                }}
              >
                Use these cards
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIncoming(null)}>
                No thanks
              </button>
            </div>
          </section>
        )}
        {saved === undefined ? (
          <div className="m-panel h-64 animate-pulse" aria-busy />
        ) : !saved || !wallet.length ? (
          tab === "connect" ? (
            <Connect saved={saved} onSave={save} onClear={clear} onDone={(m) => go("pay", m)} />
          ) : tab === "cards" ? (
            <Cards wallet={[]} onChange={(w) => save({ source: "manual", label: "Added by hand", wallet: w, txns: [] })} />
          ) : (
            <QuickStart
              onStart={(w) => {
                save({ source: "manual", label: "Your cards", wallet: w, txns: [] });
                go("pay", `${w.length} card${w.length === 1 ? "" : "s"} added. If one carries a balance, add it on the Cards tab: Monte will keep purchases off it.`);
              }}
              onConnect={() => go("connect")}
              onDemo={() => {
                save({ source: "demo", label: "Jordan (demo)", wallet: JORDAN.wallet, txns: yearOf(JORDAN) });
                go("pay", "Showing Jordan's demo wallet: 24, first job in LA, three cards, one with a balance. Swap it for yours on Connect.");
              }}
            />
          )
        ) : tab === "pay" ? (
          <Pay wallet={wallet} txns={txns} />
        ) : tab === "cards" ? (
          <Cards wallet={wallet} txns={txns} bills={saved.bills} onChange={update} />
        ) : tab === "year" ? (
          <Year wallet={wallet} txns={txns} onConnect={() => go("connect")} />
        ) : (
          <Connect saved={saved} onSave={save} onClear={clear} onDone={(m) => go("pay", m)} />
        )}
      </main>

      <nav
        aria-label="Monte"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--m-line)] bg-[color-mix(in_oklab,var(--m-panel)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-[480px] grid-cols-4">
          {TABS.map(({ k, label, Icon }) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => go(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] ${tab === k ? "text-ace-ink" : "text-ace-dim"}`}
              >
                <Icon className="h-5 w-5" strokeWidth={tab === k ? 2.2 : 1.6} aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

