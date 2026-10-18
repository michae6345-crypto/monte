"use client";

// One card for everything: the replay has nothing to re-route, so instead Monte shows what a
// second card would have added on the very same purchases. A balance comes first, as always.

import { useMemo } from "react";
import { whatIf } from "@/lib/engine";
import { CARDS, card, openToNewApplicants } from "@/lib/engine/catalog";
import { Bracketed } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { money, nameOf, useAce, v } from "./store";
import { cached } from "./adds";

export function bestSecondCard(wallet: ReturnType<typeof useAce>["wallet"], txns: ReturnType<typeof useAce>["txns"]) {
  return cached(txns, `second|${JSON.stringify(wallet)}`, () => secondCard(wallet, txns));
}
function secondCard(wallet: ReturnType<typeof useAce>["wallet"], txns: ReturnType<typeof useAce>["txns"]) {
  return CARDS.filter((c) => openToNewApplicants(c) && !wallet.some((h) => h.cardId === c.id) && !/secured/i.test(c.id))
    .map((c) => ({ id: c.id, w: whatIf(wallet, txns, c.id) }))
    .filter((x): x is { id: string; w: NonNullable<ReturnType<typeof whatIf>> } => !!x.w)
    .sort((a, b) => b.w.net - a.w.net)[0];
}

export function OneCardView() {
  const { held: wallet, txns, persona, r } = useAce();
  const nm = nameOf(persona);
  const only = wallet[0];
  const best = useMemo(() => bestSecondCard(wallet, txns), [wallet, txns]);
  const carrying = (only?.balance ?? 0) > 0;
  if (!only) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="m-panel p-6">
        <p className="m-label">last year, as paid</p>
        <div className="mt-4 flex items-center gap-4">
          <CardArt id={only.cardId} size="sm" className="w-24 shrink-0" />
          <div>
            <div className="text-2xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
              {shortName(only.cardId)}
            </div>
            <p className="mt-1 text-sm">Every one of {txns.length} purchases. Nothing to move: it&apos;s already the only card.</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] bg-[var(--m-line)] text-sm">
          {[
            ["spent", money(r.spend)],
            ["earned", money(r.rewards + r.credits, { cents: true })],
            ["back", r.spend ? `${(((r.rewards + r.credits) / r.spend) * 100).toFixed(1)}%` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="bg-ace-panel px-3 py-2.5">
              <div className="m-label">{k}</div>
              <div className="m-num mt-0.5 text-lg">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="m-panel p-6">
        <p className="m-label">a second card</p>
        {carrying ? (
          <p className="mt-4 text-lg">
            Not yet. {`${nm.Who} ${v(nm, "carries", "carry")}`} a balance, and its interest outweighs anything a new card earns. Pay it down
            first, then come back.
          </p>
        ) : best && best.w.net > 1 ? (
          <div className="mt-4 flex items-center gap-4">
            <CardArt id={best.id} size="sm" className="w-24 shrink-0" />
            <div>
              <div className="text-2xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
                {shortName(best.id)}
              </div>
              <p className="mt-1 text-sm">
                On last year&apos;s purchases it would have added <Bracketed>{money(best.w.net, { sign: true })}</Bracketed>{card(best.id).annual_fee ? " after its fee" : ""}, used only
                where it beats the {shortName(only.cardId)}.
              </p>
              <p className="mt-2 text-xs">Only if both are paid in full each month. A carried balance costs more than this earns.</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-lg">No second card beats this one on {nm.whose} spending. One card is the right call.</p>
        )}
      </div>
    </div>
  );
}
