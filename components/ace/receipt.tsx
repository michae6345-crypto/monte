"use client";

import { useBrand } from "./brands";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CARDS } from "@/lib/engine/catalog";
import { CardArt, shortName } from "./card-art";
import { PaperReceipt } from "./paper-receipt";
import { R, Section } from "./section";
import { money, useAce } from "./store";

export function ReceiptSection() {
  const { persona, held: wallet, addCard, removeCard, toggleBalance, valuation, setValuationMode, r, txns } = useAce();
  const [picker, setPicker] = useState(false);
  const { brand: b } = useBrand();


  return (
    <Section
      id="receipt"
      index="02"
      kicker="The Receipt"
      title={<>{wallet.length === 1 ? "What the card did last year." : "What each card did last year."}</>}
      readout={
        <>
          {persona.name} · <R>{wallet.length}</R> cards · net <R tone={r.net < 0 ? "loss" : "gain"}>{money(r.net, { sign: true })}</R>
        </>
      }
      lede="Rewards and the perks you used, minus annual fees, minus interest. One number per card, and one for the wallet. Add a card or mark a balance and it reprints."
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_440px] [&>*]:min-w-0">
        {/* controls */}
        <div className="space-y-8">
          <div>
            <div className="mono mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-ace-dim">
              <span>Wallet · {wallet.length} card{wallet.length === 1 ? "" : "s"} · {txns.length} purchases · ${Math.round(r.spend).toLocaleString()} spent</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {wallet.map((h) => (
                  <motion.div
                    layout
                    key={h.cardId}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="group relative"
                  >
                    <CardArt id={h.cardId} />
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => toggleBalance(h.cardId)}
                        className={`mono rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wider transition ${
                          h.balance ? "border-ace-loss/50 bg-ace-loss/10 text-ace-loss" : "border-ace-line text-ace-dim hover:text-ace-ink"
                        }`}
                      >
                        {h.balance ? `$${h.balance.toLocaleString()} balance` : "paid in full"}
                      </button>
                      {wallet.length > 1 && (
                        <button onClick={() => removeCard(h.cardId)} className="text-ace-dim transition hover:text-ace-loss lg:opacity-0 lg:group-hover:opacity-100">
                          remove
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {wallet.length < 5 && (
                <button
                  onClick={() => setPicker((v) => !v)}
                  className="grid aspect-[1.586/1] place-items-center rounded-[7%/11%] border border-dashed border-ace-line text-ace-dim transition hover:border-ace-gold hover:text-ace-gold"
                >
                  + add a card
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {picker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid max-h-[340px] grid-cols-3 gap-3 overflow-y-auto rounded-[14px] border border-ace-line bg-ace-panel p-4 sm:grid-cols-4 md:grid-cols-5">
                  {CARDS.filter((c) => !wallet.some((h) => h.cardId === c.id)).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        addCard(c.id);
                        setPicker(false);
                      }}
                      className="text-left transition hover:-translate-y-1"
                      title={c.name}
                    >
                      <CardArt id={c.id} size="sm" />
                      <div className="mt-1 truncate text-[11px] text-ace-dim">{shortName(c.id)}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">Value points at</span>
            {(["cash", "travel"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setValuationMode(v)}
                className={`btn btn-sm ${valuation === v ? "btn-primary" : "btn-ghost"}`}
              >
                {v === "cash" ? "cash (1¢ a point)" : "travel (The Points Guy's values, Oct 2026)"}
              </button>
            ))}
          </div>
        </div>

        {/* the receipt */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[440px] lg:sticky lg:top-24 lg:self-start"
          style={{ filter: "drop-shadow(0 0 0.5px rgba(12,14,20,.35)) drop-shadow(0 18px 30px rgba(12,14,20,.12))" }}
        >
          <PaperReceipt name={persona.name} wallet={wallet} r={r} purchases={txns.length} brandName={b.name} />
        </motion.div>
      </div>
    </Section>
  );
}
