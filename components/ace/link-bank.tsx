"use client";

// Link a bank through Plaid's sandbox (Michael's /api/plaid/* routes). The feed comes back as
// the same (wallet, txns) pair the demo people use, so every section reruns on it.

import { useEffect, useState } from "react";
import { Bracketed, Sampler } from "@/components/brand";
import { loadPlaidSandbox, PlaidUnavailable } from "@/lib/data/plaid-feed";
import { useAce } from "./store";

type State = { k: "idle" } | { k: "linking" } | { k: "done"; n: number; cards: number } | { k: "error"; code: string };

export function LinkBank() {
  const { loadFeed } = useAce();
  const [s, setS] = useState<State>({ k: "idle" });
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: { plaid?: string }) => live && setConfigured(!!h.plaid && h.plaid !== "not_configured"))
      .catch(() => live && setConfigured(false));
    return () => {
      live = false;
    };
  }, []);

  const go = async () => {
    setS({ k: "linking" });
    try {
      const feed = await loadPlaidSandbox();
      loadFeed(feed.txns, feed.wallet, "Plaid sandbox");
      setS({ k: "done", n: feed.txns.length, cards: feed.wallet.length });
    } catch (e) {
      setS({ k: "error", code: e instanceof PlaidUnavailable ? e.code : "plaid_link_failed" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        onClick={go}
        disabled={s.k === "linking"}
        className="btn btn-ghost btn-sm"
      >
        Link a bank (sandbox)
      </button>
      {s.k === "linking" && <Sampler label="Reading the sandbox bank" />}
      {s.k === "done" && (
        <span className="text-xs text-ace-dim">
          Plaid sandbox read · <Bracketed>{s.n}</Bracketed> purchases on <Bracketed>{s.cards}</Bracketed> cards. Every section now runs on it.
        </span>
      )}
      {s.k === "error" && (
        <span className="text-xs text-ace-dim">
          <span className="m-num">
            [<span className="text-ace-loss">?</span>]
          </span>{" "}
          {s.code === "plaid_not_configured"
            ? "This deployment has no Plaid keys yet. The demo people and the CSV upload still work."
            : "Plaid didn't answer. Try the CSV export instead."}
        </span>
      )}
      {s.k === "idle" && configured === false && <span className="text-xs text-ace-dim">sandbox keys not set on this deployment</span>}
    </div>
  );
}
