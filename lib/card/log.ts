// The last 50 decisions this server instance made, for the /card page. In memory only: it resets
// whenever the server does, and holds no card numbers (only what's in a Decision).
import type { Decision } from "./authorize";

export type Logged = Decision & { at: string; via: string; issuer: "lithic" | "stripe" | "simulator" };

const LOG: Logged[] = [];

export function record(d: Logged) {
  LOG.unshift(d);
  LOG.length = Math.min(LOG.length, 50);
}

export const recent = () => LOG.slice();
