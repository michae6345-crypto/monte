"use client";

// The annual receipt, printed like a thermal till receipt: one block per card with its real
// art, every line in cents, the net bracketed, and a barcode that encodes the wallet. Lines
// feed in as the receipt prints; changing the wallet reprints it.

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { Holding, Receipt } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { Bracketed, HandNote, MonteMark } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { money } from "./store";
import { Trace } from "./trace";
import { creditProvenanceFor, feeProvenanceFor, interestProvenanceFor, type ProvenanceLine } from "@/lib/engine/provenance";

const c2 = (v: number) => (Math.abs(v) < 0.005 ? "$0.00" : money(v, { sign: true, cents: true }));

function Row({ k, v, sub, i, strong, trace }: { k: string; v: number; sub?: string; i: number; strong?: boolean; trace?: ProvenanceLine[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ delay: (i % 4) * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-baseline justify-between gap-4"
    >
      <span className="min-w-0">
        <span className={`block truncate ${strong ? "text-ace-ink font-medium" : "text-ace-ink"}`}>{k}</span>
        {sub && <span className="block text-[10.5px] text-ace-dim">{sub}</span>}
      </span>
      <span className={`m-num shrink-0 ${v < 0 ? "text-ace-loss" : v > 0 ? "text-ace-gain" : "text-ace-dim"} ${strong ? "font-semibold" : ""}`}>
        {trace && trace.length ? <Trace lines={trace}>{c2(v)}</Trace> : c2(v)}
      </span>
    </motion.div>
  );
}

/** A barcode drawn from the wallet itself: same wallet, same bars. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 2166136261;
    const out: number[] = [];
    for (let i = 0; i < 64; i++) {
      h ^= seed.charCodeAt(i % seed.length) + i;
      h = Math.imul(h, 16777619) >>> 0;
      out.push(1 + (h % 3));
    }
    return out;
  }, [seed]);
  let x = 0;
  return (
    <svg viewBox="0 0 260 44" className="mx-auto h-11 w-[260px]" aria-hidden>
      {bars.map((w, i) => {
        const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={44} fill="currentColor" /> : null;
        x += w + (i % 3 === 0 ? 2 : 1);
        return r;
      })}
    </svg>
  );
}

export function PaperReceipt({
  name,
  wallet,
  r,
  purchases,
  brandName,
}: {
  name: string;
  wallet: Holding[];
  r: Receipt;
  purchases: number;
  brandName: string;
}) {
  const seed = wallet.map((h) => `${h.cardId}:${h.balance ?? 0}`).join("|") + name;
  const carried = wallet.find((h) => h.balance && h.balance > 0);
  let i = 0;

  return (
    <div className="relative">
      <div
        className="receipt-edge relative bg-ace-paper px-6 pb-10 pt-7 text-[12.5px] text-ace-ink sm:px-7"
      >
        {/* header */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <MonteMark size={26} mono className="text-ace-ink" />
          <div className="m-mono text-[11px] uppercase tracking-[0.28em] text-ace-dim">{brandName} · annual receipt</div>
          <div className="text-[1.65rem] font-medium tracking-[-0.03em]" style={{ fontFamily: "var(--m-font-display)" }}>
            {name}
          </div>
          <div className="m-mono text-[10.5px] uppercase tracking-[0.18em] text-ace-dim">
            18 Oct 2025 – 17 Oct 2026 · {purchases} purchases · as used
          </div>
        </div>

        <div className="m-mono my-4 overflow-hidden whitespace-nowrap text-[11px] leading-none text-ace-dim/60">{"- ".repeat(60)}</div>

        {/* one block per card */}
        <div className="m-mono space-y-5">
          <AnimatePresence mode="popLayout" initial={false}>
            {r.perCard.map((c) => {
              const h = wallet.find((x) => x.cardId === c.cardId)!;
              const k = card(c.cardId);
              return (
                <motion.div key={c.cardId + (h.balance ?? 0)} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
                  <div className="mb-2 flex items-center gap-2.5">
                    <CardArt id={c.cardId} size="sm" className="w-11 shrink-0 shadow-none" />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold uppercase tracking-[0.04em]">{shortName(c.cardId)}</div>
                      <div className="text-[10.5px] text-ace-dim">
                        {k.issuer.replace(/\s*\(.*\)\s*/, "")} · {h.balance ? `carries $${h.balance.toLocaleString()} at ${h.apr}%` : "paid in full"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 pl-[3.4rem]">
                    <Row k="rewards earned" v={c.rewards} i={i++} />
                    {c.credits > 0 && <Row k="perks used" v={c.credits} i={i++} trace={creditProvenanceFor(h)} />}
                    {c.fee > 0 && <Row k="annual fee" v={-c.fee} i={i++} trace={[feeProvenanceFor(c.cardId)].filter((x): x is NonNullable<typeof x> => !!x)} />}
                    {c.interest > 0 && (
                      <Row
                        k="interest"
                        v={-c.interest}
                        sub={`$${(h.balance ?? 0).toLocaleString()} × ${h.apr}% APR`}
                        i={i++}
                        trace={[interestProvenanceFor(h)].filter((x): x is NonNullable<typeof x> => !!x)}
                      />
                    )}
                    <div className="border-t border-dotted border-ace-line pt-1">
                      <Row k="card net" v={c.net} i={i++} strong />
                    </div>
                  </div>
                  {c.interest > c.rewards && carried?.cardId === c.cardId && (
                    <div className="mt-1 flex justify-end pr-1">
                      <HandNote dir="up-left" delay={0.6}>
                        the balance eats every reward
                      </HandNote>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="m-mono my-4 overflow-hidden whitespace-nowrap text-[11px] leading-none text-ace-dim/60">{"= ".repeat(60)}</div>

        {/* totals */}
        <div className="m-mono space-y-1">
          <Row k="rewards + perks" v={r.rewards + r.credits} i={i++} />
          <Row k="fees" v={-r.fees} i={i++} />
          <Row k="interest" v={-r.interest} i={i++} />
        </div>
        <div id="receipt-net" className="mt-4 flex scroll-mt-40 items-end justify-between gap-3">
          <span className="m-label">net, last 12 months</span>
          <span className={`text-[2.6rem] leading-none ${r.net < 0 ? "text-ace-loss" : "text-ace-gain"}`}>
            <Bracketed>{c2(r.net)}</Bracketed>
          </span>
        </div>

        {r.leftOnTable >= 0.5 && (
        <div className="m-mono mt-5 rounded-[10px] bg-[var(--m-wash)] px-3.5 py-3 text-[11.5px] leading-relaxed">
          <div className="flex items-baseline justify-between gap-3">
            <span className="uppercase tracking-[0.12em] text-ace-dim">left on the table</span>
            <span className="text-ace-ink">{c2(r.leftOnTable)}</span>
          </div>
          <p className="mt-1 text-ace-dim">
            Same purchases, the right card in this same wallet{carried ? `, never the ${shortName(carried.cardId)}` : ""}.{" "}
            <a href="#spend" className="text-ace-ink underline underline-offset-2">
              replay ↓
            </a>
          </p>
        </div>
        )}

        <div className="mt-6 text-ace-ink">
          <Barcode seed={seed} />
          <div className="m-mono mt-3 text-center text-[10px] uppercase tracking-[0.22em] text-ace-dim">hover any line for its rule and source</div>
        </div>
      </div>
    </div>
  );
}
