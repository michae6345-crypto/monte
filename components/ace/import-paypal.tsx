"use client";

// Import the PayPal sandbox account's purchases (GET /api/paypal/transactions) into the
// current person's year. Deduped by id in the store, so pressing it twice adds nothing.

import { useState } from "react";
import { Bracketed, Sampler } from "@/components/brand";
import { droppedCount, loadPayPalPurchases, PayPalImportError } from "@/lib/paypal/transactions-feed";
import { shortName } from "./card-art";
import { useAce } from "./store";

type State =
  | { k: "idle" }
  | { k: "loading" }
  | { k: "done"; added: number; skipped: number; found: number }
  | { k: "error"; code: string };

export function ImportPayPal() {
  const { held, importTxns } = useAce();
  const [card, setCard] = useState("");
  const [s, setS] = useState<State>({ k: "idle" });
  // the picked card, if it's still held; else the server's default funding card
  const funding = held.some((h) => h.cardId === card) ? card : "";

  const go = async () => {
    setS({ k: "loading" });
    try {
      const feed = await loadPayPalPurchases({ months: 12, card: funding || undefined });
      const { added, duplicates } = importTxns(feed.txns);
      setS({ k: "done", added, skipped: droppedCount(feed.dropped) + duplicates, found: feed.txns.length });
    } catch (e) {
      setS({ k: "error", code: e instanceof PayPalImportError ? e.code : "paypal_import_failed" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={go} disabled={s.k === "loading"} aria-busy={s.k === "loading"} className="btn btn-ghost btn-sm h-10">
        {s.k === "loading" ? "Importing PayPal purchases…" : "Import PayPal purchases (sandbox)"}
      </button>
      {held.length > 0 && (
        <select
          value={funding}
          onChange={(e) => setCard(e.target.value)}
          className="btn-sm h-10 max-w-full min-w-0 rounded-full bg-ace-panel px-3 text-xs text-ace-dim shadow-[0_0_0_1px_var(--m-line-strong)]"
          aria-label="Which card funds PayPal purchases"
        >
          <option value="">paid with: default card</option>
          {held.map((h) => (
            <option key={h.cardId} value={h.cardId}>
              paid with: {shortName(h.cardId)}
            </option>
          ))}
        </select>
      )}
      {s.k === "loading" && <Sampler label="Reading PayPal sandbox" />}
      <span role="status" className={s.k === "done" ? "text-xs tabular-nums text-ace-dim" : "sr-only"}>
        {s.k === "done" &&
          (s.found === 0 ? (
            <>No PayPal purchases in the last 12 months{s.skipped ? ` (${s.skipped} skipped)` : ""}. Nothing changed.</>
          ) : (
            <>
              Imported <Bracketed>{s.added}</Bracketed> PayPal purchase{s.added === 1 ? "" : "s"} (
              <Bracketed>{s.skipped}</Bracketed> skipped).
            </>
          ))}
      </span>
      {s.k === "error" && (
        <span role="alert" className="text-xs text-ace-dim">
          <span className="m-num" aria-hidden>
            [<span className="text-ace-loss">?</span>]
          </span>{" "}
          {s.code === "paypal_not_configured"
            ? "PayPal sandbox isn't set up on this deployment"
            : s.code === "transaction_search_not_enabled"
              ? "Transaction Search isn't turned on for this PayPal sandbox app yet."
            : "PayPal didn't answer. Try again in a moment."}
        </span>
      )}
    </div>
  );
}
