"use client";

// Connect: three ways in, and one way out.
//  - Plaid: the real Link window (and in sandbox, Plaid's test bank with no login). Cards,
//    balances, APRs and a year of purchases come back already mapped to the engine's types.
//  - A card statement (CSV), parsed in the browser.
//  - A demo wallet (the five synthetic people from the story page).
//  - Forget: drops the Plaid item server-side and clears this browser.

import { useEffect, useRef, useState } from "react";
import { Building2, FileUp, Puzzle, RefreshCw, Share2, Sparkles, Trash2 } from "lucide-react";
import { fetchPlaidData } from "@/lib/data/plaid-feed";
import { walletLink } from "./share";
import { clearFixes } from "./fixes";
import { merchantName } from "@/lib/card/authorize";
import { PERSONAS, yearOf } from "@/lib/data/personas";
import { connectSandboxBank, connectWithPlaid, disconnectPlaid, plaidStatus, type Linked } from "@/lib/data/plaid-link";
import { PlaidUnavailable } from "@/lib/data/plaid-feed";
import { parseStatement } from "@/lib/engine/statement";
import { CARDS } from "@/lib/engine/catalog";
import { shortName } from "@/components/ace/card-art";
import type { Saved } from "./use-wallet";

type Busy = null | "plaid" | "sandbox" | "file";

export function Connect({ saved, onSave, onClear, onDone }: { saved: Saved | null; onSave: (s: Omit<Saved, "v" | "at">) => void; onClear: () => void; onDone: (message?: string) => void }) {
  const [plaid, setPlaid] = useState<{ ready: boolean; env?: string } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    plaidStatus().then((s) => live && setPlaid(s));
    return () => {
      live = false;
    };
  }, []);

  const took = (feed: Linked, label: string) => {
    onSave({ source: "plaid", label, wallet: feed.wallet, txns: feed.txns, bills: feed.bills });
    const d = feed.dropped;
    onDone(
      `${feed.wallet.length} card${feed.wallet.length === 1 ? "" : "s"} and ${feed.txns.length.toLocaleString()} purchases from ${feed.institution ?? "your bank"}.` +
        (d ? ` Left out ${d.refundOrPayment + d.excluded + d.pending} that aren't purchases (payments, refunds, transfers, pending).` : ""),
    );
  };
  const fail = (e: unknown) => {
    const code = e instanceof PlaidUnavailable ? e.code : "plaid_failed";
    setMsg(
      code === "plaid_not_configured"
        ? "Plaid isn't set up on this server yet."
        : e instanceof Error && e.message && e.message !== code
          ? `Plaid: ${e.message}`
          : `Plaid didn't connect (${code}). Try again, or upload a statement.`,
    );
  };

  const link = async () => {
    setBusy("plaid");
    setMsg(null);
    try {
      const feed = await connectWithPlaid(clientId());
      if (feed) took(feed, feed.institution ? `${feed.institution} via Plaid` : "Bank via Plaid");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const sandbox = async () => {
    setBusy("sandbox");
    setMsg(null);
    try {
      took(await connectSandboxBank(), "Plaid sandbox test bank");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="m-panel p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-medium">Connect your bank</h2>
        </div>
        <p className="mt-2 text-sm text-ace-dim">
          Through Plaid, the way most finance apps do. You log in to your bank in Plaid&apos;s window, never Monte&apos;s. Monte reads your cards, their balances and APRs, and a year of purchases. It can&apos;t move money.
        </p>
        {plaid?.ready ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={link} disabled={busy !== null} className="btn btn-primary">
              {busy === "plaid" ? "Opening Plaid…" : "Connect with Plaid"}
            </button>
            {plaid.env === "sandbox" && (
              <button type="button" onClick={sandbox} disabled={busy !== null} className="btn btn-ghost">
                {busy === "sandbox" ? "Reading the test bank…" : "Use Plaid's test bank"}
              </button>
            )}
          </div>
        ) : plaid ? (
          <p className="mt-4 rounded-[12px] bg-[var(--m-wash)] p-3 text-sm">
            Bank linking is coming to this site soon. Until then, upload a statement or add your cards by hand: the card picks work the same.
          </p>
        ) : (
          <p className="mt-4 text-sm text-ace-dim">Checking…</p>
        )}
        {plaid?.env === "sandbox" && (
          <p className="mt-3 text-xs text-ace-dim">
            Sandbox: Plaid&apos;s test banks only. In the Link window, pick any bank and sign in with Plaid&apos;s published test login, user_good / pass_good.
          </p>
        )}
      </section>

      <Statement
        busy={busy}
        setBusy={setBusy}
        onLoad={(txns, cardId) => {
          const wallet = saved?.wallet.some((h) => h.cardId === cardId) ? saved.wallet : [...(saved?.wallet ?? []), { cardId }];
          // bank descriptors ("TRADER JOE S #071") become store names, so logos, "your usual" and perks work
          const named = txns.map((t) => ({ ...t, merchant: merchantName(t.merchant) }));
          onSave({ source: "statement", label: `${shortName(cardId)} statement`, wallet, txns: named });
          onDone(`${txns.length.toLocaleString()} purchases loaded from the statement. They stay in this browser.`);
        }}
        onError={setMsg}
      />

      <section className="m-panel p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-medium">Or try someone else&apos;s year</h2>
        </div>
        <p className="mt-2 text-sm text-ace-dim">Five made-up people with real cards and a synthetic year of purchases.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSave({ source: "demo", label: `${p.name} (demo)`, wallet: p.wallet, txns: yearOf(p) });
                onDone(`Now showing ${p.name}'s wallet: ${p.blurb}.`);
              }}
              className="btn btn-ghost btn-sm"
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="m-panel p-5">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-medium">Shopping online?</h2>
        </div>
        <p className="mt-2 text-sm text-ace-dim">
          The Monte extension for Chrome names the card on any store&apos;s website. It picks up the cards you set up here, so there&apos;s nothing to enter twice.
        </p>
        <a href="/monte-extension.zip" download className="btn btn-ghost btn-sm mt-3">
          Download the extension (15 KB)
        </a>
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-ace-dim">
          <li>Unzip it.</li>
          <li>In Chrome, open chrome://extensions and turn on Developer mode.</li>
          <li>Load unpacked, and pick the monte-extension folder.</li>
          <li>Open Monte once in that browser so it picks up your cards.</li>
        </ol>
      </section>

      {msg && (
        <p role="status" className="rounded-[12px] bg-[var(--m-accent-wash)] p-3 text-sm">
          {msg}
        </p>
      )}

      {saved && (
        <section className="p-1 text-sm">
          <p className="text-ace-dim">
            Showing: <span className="text-ace-ink">{saved.label}</span>, saved in this browser only.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.source === "plaid" && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("plaid");
                  try {
                    const feed = await fetchPlaidData();
                    onSave({ source: "plaid", label: saved.label, wallet: feed.wallet, txns: feed.txns, bills: feed.bills });
                    setMsg(`Refreshed: ${feed.txns.length.toLocaleString()} purchases on ${feed.wallet.length} cards.`);
                  } catch (e) {
                    setMsg(e instanceof PlaidUnavailable && e.code === "plaid_not_linked" ? "The bank link has expired. Connect with Plaid again to refresh." : "Plaid didn't answer. Try again in a minute.");
                  } finally {
                    setBusy(null);
                  }
                }}
                className="btn btn-ghost btn-sm"
              >
                <RefreshCw className="h-4 w-4" /> Refresh from bank
              </button>
            )}
            {saved.wallet.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const url = walletLink(saved.wallet);
                  try {
                    if (navigator.share) await navigator.share({ title: "My cards in Monte", url });
                    else {
                      await navigator.clipboard.writeText(url);
                      setMsg("Link copied. Open it on your phone or another browser to bring these cards over (just the cards: no purchases).");
                    }
                  } catch {
                    setMsg(url);
                  }
                }}
                className="btn btn-ghost btn-sm"
              >
                <Share2 className="h-4 w-4" /> Copy to another device
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (saved.source === "plaid") await disconnectPlaid();
              onClear();
              clearFixes();
              setMsg("Forgotten. Nothing about your cards is left in this browser or on our server.");
            }}
            className="btn btn-ghost btn-sm mt-2"
          >
            <Trash2 className="h-4 w-4" /> Forget everything
          </button>
        </section>
      )}
    </div>
  );
}

function Statement({ busy, setBusy, onLoad, onError }: { busy: Busy; setBusy: (b: Busy) => void; onLoad: (t: import("@/lib/engine").Txn[], cardId: string) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [cardId, setCardId] = useState("chase_freedom_unlimited");
  return (
    <section className="m-panel p-5">
      <div className="flex items-center gap-2">
        <FileUp className="h-5 w-5" aria-hidden />
        <h2 className="text-lg font-medium">Upload a card statement</h2>
      </div>
      <p className="mt-2 text-sm text-ace-dim">A CSV export from Chase, Amex or Capital One. It&apos;s read in your browser and never uploaded.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          aria-label="Which card is this statement from"
          className="h-9 max-w-full rounded-full bg-[var(--m-wash)] px-3 text-sm"
        >
          {CARDS.map((c) => (
            <option key={c.id} value={c.id}>
              {shortName(c.id)}
            </option>
          ))}
        </select>
        <button type="button" disabled={busy !== null} onClick={() => ref.current?.click()} className="btn btn-ghost btn-sm">
          {busy === "file" ? "Reading…" : "Choose CSV"}
        </button>
        <input
          ref={ref}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy("file");
            try {
              const res = parseStatement(await f.text(), cardId);
              if (!res.txns.length) throw new Error("No purchases found in that file.");
              onLoad(res.txns, cardId);
            } catch (err) {
              onError((err as Error).message);
            } finally {
              setBusy(null);
            }
          }}
        />
      </div>
    </section>
  );
}

/** A random id for Plaid's client_user_id, kept for this browser. Not tied to any person. */
function clientId() {
  try {
    const k = "monte.uid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = "m-" + crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "m-anon";
  }
}
