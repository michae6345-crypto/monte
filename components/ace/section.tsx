"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useBare } from "./chapter";

/** A section opens like a solver printout: a ruled header line with the section's number
 *  and name on the left and a live readout of real numbers on the right. */
export function Section({
  id,
  index,
  kicker,
  title,
  lede,
  readout,
  children,
}: {
  id: string;
  index: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  readout?: ReactNode;
  children: ReactNode;
}) {
  const bare = useBare();
  if (bare)
    return (
      <div id={id} className="scroll-mt-24">
        <h3 className="mb-8 max-w-3xl text-3xl md:text-[2.4rem]">{title}</h3>
        {children}
      </div>
    );
  return (
    <section id={id} className="relative scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="m-label mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ace-ink/25 pt-3">
          <span className="text-ace-dim">
            <span className="text-ace-ink">§{index}</span> · {kicker.toLowerCase()}
          </span>
          {readout && <span className="m-num normal-case tracking-normal text-ace-dim">{readout}</span>}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 max-w-3xl"
        >
          <h2 className="text-[2.5rem] md:text-[3.5rem]">{title}</h2>
          {lede && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ace-dim">{lede}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  );
}

/** A readout value: mono, tabular, coloured by sign when asked. */
export function R({ children, tone }: { children: ReactNode; tone?: "gain" | "loss" | "ink" | "gold" }) {
  const c = tone === "gain" ? "text-ace-gain" : tone === "loss" ? "text-ace-loss" : tone === "gold" ? "text-ace-gold" : "text-ace-ink";
  return <span className={c}>{children}</span>;
}
