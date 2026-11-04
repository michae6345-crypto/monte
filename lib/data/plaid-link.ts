"use client";

// Plaid Link in the browser: ask our server for a link_token, open Plaid's own window (their
// script, their UI: bank logins never touch Monte), hand the public_token back to the server to
// exchange, then read the mapped feed. Browser only.
//
//   const feed = await connectWithPlaid();   // { txns, wallet, ... } or throws PlaidUnavailable

import { fetchPlaidData, PlaidUnavailable, type PlaidFeed } from "@/lib/data/plaid-feed";

const SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

type LinkHandler = { open: () => void; exit: (o?: { force?: boolean }) => void; destroy: () => void };
type LinkMeta = { institution?: { name?: string; institution_id?: string } | null };
type PlaidGlobal = {
  create: (o: {
    token: string;
    onSuccess: (publicToken: string, meta: LinkMeta) => void;
    onExit: (err: { error_code?: string; display_message?: string } | null) => void;
  }) => LinkHandler;
};

let loading: Promise<PlaidGlobal> | null = null;
function loadLink(): Promise<PlaidGlobal> {
  const w = window as unknown as { Plaid?: PlaidGlobal };
  if (w.Plaid) return Promise.resolve(w.Plaid);
  return (loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (w.Plaid ? resolve(w.Plaid) : reject(new PlaidUnavailable("plaid_script_failed", 0)));
    s.onerror = () => {
      loading = null;
      reject(new PlaidUnavailable("plaid_script_failed", 0, "Couldn't load Plaid Link. Check the connection or an ad blocker."));
    };
    document.head.appendChild(s);
  }));
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new PlaidUnavailable(String(data.error ?? "plaid_failed"), res.status, typeof data.message === "string" ? data.message : undefined);
  return data;
}

/** Is Plaid set up on this deployment, and which environment ("sandbox", "production")? */
export async function plaidStatus(): Promise<{ ready: boolean; env?: string }> {
  try {
    const h = (await (await fetch("/api/health", { cache: "no-store" })).json()) as { plaid?: string };
    return h.plaid && h.plaid !== "not_configured" ? { ready: true, env: h.plaid } : { ready: false };
  } catch {
    return { ready: false };
  }
}

export type Linked = PlaidFeed & { institution?: string };

/** The full Link flow. Resolves with the feed, or null if the person closed Link. */
export async function connectWithPlaid(clientUserId: string): Promise<Linked | null> {
  const [{ link_token }, Plaid] = await Promise.all([post("/api/plaid/link-token", { clientUserId }) as Promise<{ link_token: string }>, loadLink()]);
  const got = await new Promise<{ publicToken: string; meta: LinkMeta } | null>((resolve, reject) => {
    const h = Plaid.create({
      token: link_token,
      onSuccess: (publicToken, meta) => {
        resolve({ publicToken, meta });
        h.destroy();
      },
      onExit: (err) => {
        h.destroy();
        if (err) reject(new PlaidUnavailable(err.error_code ?? "plaid_link_exit", 0, err.display_message ?? undefined));
        else resolve(null);
      },
    });
    h.open();
  });
  if (!got) return null;
  await post("/api/plaid/exchange", { public_token: got.publicToken });
  const feed = await fetchPlaidData();
  return { ...feed, institution: got.meta.institution?.name ?? undefined };
}

/** Sandbox only: Plaid's test bank with no Link window (First Platypus Bank). */
export async function connectSandboxBank(): Promise<Linked> {
  await post("/api/plaid/sandbox");
  const feed = await fetchPlaidData();
  return { ...feed, institution: "First Platypus Bank (Plaid sandbox)" };
}

/** Forget the linked bank: the server drops the item and the cookie. */
export async function disconnectPlaid(): Promise<void> {
  await fetch("/api/plaid/forget", { method: "POST", cache: "no-store" }).catch(() => undefined);
}
