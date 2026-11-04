// Your cards, in a link: /app#w=<cards>. The part after # never leaves the browser (it isn't sent
// to any server), and it carries only the cards, any balance and APR: no purchases, no names.
import type { Holding } from "@/lib/engine";
import { CARDS } from "@/lib/engine/catalog";

const KNOWN = new Set(CARDS.map((c) => c.id));

type Packed = { c: string; b?: number; a?: number }[];

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function walletLink(wallet: Holding[], origin = window.location.origin): string {
  const packed: Packed = wallet.map((h) => ({ c: h.cardId, ...(h.balance ? { b: h.balance } : {}), ...(h.apr ? { a: h.apr } : {}) }));
  return `${origin}/app#w=${b64url(JSON.stringify(packed))}`;
}

/** The cards in a #w= hash, or null if there are none (or it isn't one of ours). */
export function walletFromHash(hash: string): Holding[] | null {
  const m = /(?:^#|&)w=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const packed = JSON.parse(unb64url(m[1])) as Packed;
    if (!Array.isArray(packed)) return null;
    const wallet = packed
      .filter((p) => p && typeof p.c === "string" && KNOWN.has(p.c))
      .slice(0, 25)
      .map((p) => ({ cardId: p.c, ...(Number(p.b) > 0 ? { balance: Number(p.b) } : {}), ...(Number(p.a) > 0 ? { apr: Number(p.a) } : {}) }));
    return wallet.length ? wallet : null;
  } catch {
    return null;
  }
}
