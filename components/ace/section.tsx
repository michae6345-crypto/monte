"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Section({
  id,
  index,
  kicker,
  title,
  lede,
  children,
}: {
  id: string;
  index: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative scroll-mt-16 border-t border-ace-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 max-w-3xl"
        >
          <p className="mono mb-5 text-[11px] uppercase tracking-[0.25em] text-ace-dim">
            <span className="text-ace-gold">{index}</span> · {kicker}
          </p>
          <h2 className="text-4xl font-semibold leading-[1] tracking-[-0.035em] md:text-6xl">{title}</h2>
          {lede && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ace-dim">{lede}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  );
}
