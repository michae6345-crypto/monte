"use client";

// What this deployment has connected, read from /api/health, so anyone opening /paypal knows
// before clicking whether the PayPal button, the agent and webhooks will work here. Read-only;
// /api/health never returns a key.

import { useEffect, useState } from "react";

type Health = { paypal?: string; agent?: string; paypal_webhook?: string; commit?: string | null };

const PARTS: { key: "paypal" | "agent" | "paypal_webhook"; label: string; on: string }[] = [
  { key: "paypal", label: "PayPal sandbox", on: "sandbox" },
  { key: "agent", label: "Checkout agent", on: "ready" },
  { key: "paypal_webhook", label: "PayPal webhooks", on: "verified" },
];

export function PayPalStatus() {
  const [health, setHealth] = useState<Health | "error" | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`health ${r.status}`))))
      .then((d: Health) => setHealth(d))
      .catch(() => {
        if (!ctl.signal.aborted) setHealth("error");
      });
    return () => ctl.abort();
  }, []);

  if (health === null) return <p className="mono mt-4 text-xs text-ace-dim">Checking what this deployment has connected…</p>;
  if (health === "error") return <p className="mono mt-4 text-xs text-ace-dim">Couldn&apos;t read /api/health on this deployment.</p>;

  return (
    <ul aria-label="What this deployment has connected" className="mono mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ace-dim">
      {PARTS.map(({ key, label, on }) => {
        const ok = health[key] === on;
        return (
          <li key={key}>
            <span aria-hidden="true" className={ok ? "text-ace-gain" : ""}>
              {ok ? "●" : "○"}
            </span>{" "}
            {label}: {ok ? "connected" : "not connected"}
          </li>
        );
      })}
      {health.commit && <li>build {health.commit}</li>}
    </ul>
  );
}
