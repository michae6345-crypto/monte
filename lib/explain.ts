// One sentence on why choose() picked the card it did, in terms the person can check.
// Shared by the app's Pay screen and /api/best (the browser extension).
import type { Decision } from "@/lib/engine/interest";
import { shortName } from "@/lib/card-name";

const fmt = (n: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toFixed(2);

export function why(d: Decision): string {
  const p = d.pick;
  const name = shortName(p.cardId);
  if (d.mode === "all")
    return `Every card you have carries a balance, so this costs interest wherever it goes. The ${name} costs the least: it earns ${fmt(p.reward)} and adds about ${fmt(p.interest)} a month at ${p.apr}% APR.`;
  if (d.skipped) {
    const s = d.skipped;
    return `Your ${shortName(s.cardId)} would earn ${fmt(s.reward)}, but it carries a balance, so it has no grace period: this would start costing about ${fmt(s.interest)} a month in interest the day it posts. The ${name} is paid in full, so this costs nothing if you pay that statement.`;
  }
  const next = d.ranked.find((c) => c.cardId !== p.cardId && !c.carries);
  if (!next) return `It's the only card in your wallet${d.mode === "grace" ? " without a balance" : ""}.`;
  if (p.reward - next.reward > 0.004) return `${fmt(p.reward - next.reward)} more than your next-best card here, the ${shortName(next.cardId)}.`;
  return `It ties with your ${shortName(next.cardId)} here, so either works.`;
}
