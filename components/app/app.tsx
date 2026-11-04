"use client";

// Monte, the app (/app): the product behind the story page. Four tabs:
//   Pay      where you are -> which card to hold up, counting interest as well as points
//   Cards    your wallet: what each card is best at, and which ones carry a balance
//   Year     with a bank or statement connected: what your cards made or cost you
//   Connect  Plaid, a statement, or a demo person; and forget everything
// Everything lives in this browser (use-wallet.ts). No account, nothing stored server-side.

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, CreditCard, Link2, ScanLine } from "lucide-react";
import { Lockup } from "@/components/brand";
import { Pay } from "./pay";
import { Cards } from "./cards";
import { Year } from "./year";
import { Connect } from "./connect";
import { useWallet } from "./use-wallet";

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
  useEffect(() => {
    const read = () => {
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
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "pay" ? "/app" : `/app#${t}`);
    window.scrollTo({ top: 0 });
  };

  const wallet = saved?.wallet ?? [];
  const txns = saved?.txns ?? [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--m-ground)_88%,transparent)] px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="Monte home">
          <Lockup size={20} state="resolved" />
        </Link>
        {saved && (
          <button type="button" onClick={() => go("connect")} className="max-w-[60%] truncate text-right text-xs text-ace-dim">
            {saved.label} · {wallet.length} card{wallet.length === 1 ? "" : "s"}
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 pt-2">
        {saved === undefined ? (
          <div className="m-panel h-64 animate-pulse" aria-busy />
        ) : !saved || !wallet.length ? (
          tab === "connect" ? (
            <Connect saved={saved} onSave={save} onClear={clear} onDone={() => go("pay")} />
          ) : tab === "cards" ? (
            <Cards wallet={[]} onChange={(w) => save({ source: "manual", label: "Added by hand", wallet: w, txns: [] })} />
          ) : (
            <Welcome onConnect={() => go("connect")} onAdd={() => go("cards")} />
          )
        ) : tab === "pay" ? (
          <Pay wallet={wallet} txns={txns} />
        ) : tab === "cards" ? (
          <Cards wallet={wallet} onChange={update} />
        ) : tab === "year" ? (
          <Year wallet={wallet} txns={txns} onConnect={() => go("connect")} />
        ) : (
          <Connect saved={saved} onSave={save} onClear={clear} onDone={() => go("pay")} />
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

function Welcome({ onConnect, onAdd }: { onConnect: () => void; onAdd: () => void }) {
  return (
    <section className="pt-8">
      <h1 className="text-[2.6rem] leading-[1.02]" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.035em" }}>
        The right card,
        <span className="block text-ace-dim">every time you pay.</span>
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ace-dim">
        Tell Monte where you are and it names the card to use: the one that earns the most there, unless a balance means it would cost you more in interest than it pays back.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li>· Counts interest, not just points</li>
        <li>· Knows the store before you tap: search, or use where you are</li>
        <li>· Shows what each card made or cost you this year</li>
      </ul>
      <div className="mt-8 flex flex-col gap-2">
        <button type="button" onClick={onConnect} className="btn btn-primary justify-center">
          Connect your bank
        </button>
        <button type="button" onClick={onAdd} className="btn btn-ghost justify-center">
          Add my cards by hand
        </button>
      </div>
      <p className="mt-6 text-xs text-ace-dim">
        No account. Your cards stay in this browser. <Link href="/" className="underline underline-offset-4">How Monte works</Link>
      </p>
    </section>
  );
}
