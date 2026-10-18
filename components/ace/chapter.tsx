"use client";

// A chapter of the pitch: one header, then the related views as tabs, so the page reads in
// seven beats instead of fifteen sections. A section rendered inside a chapter drops its own
// big header (see Section's "bare" mode) and keeps its punchline as a sub-heading.

import { motion } from "framer-motion";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const Bare = createContext(false);
export const useBare = () => useContext(Bare);

export type Tab = { key: string; label: string; node: ReactNode };

export function Chapter({
  id,
  index,
  kicker,
  title,
  lede,
  tabs,
}: {
  id: string;
  index: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  tabs: Tab[];
}) {
  const [key, setKey] = useState(tabs[0].key);
  // presenter mode can open a specific tab
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ chapter: string; tab: string }>).detail;
      if (d?.chapter !== id) return;
      if (tabs.some((t) => t.key === d.tab)) setKey(d.tab);
    };
    window.addEventListener("monte:tab", on);
    return () => window.removeEventListener("monte:tab", on);
  }, [id, tabs]);
  const cur = tabs.find((t) => t.key === key) ?? tabs[0];

  return (
    <section id={id} className="relative scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="m-label mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ace-ink/25 pt-3">
          <span>
            <span>§{index}</span> · {kicker.toLowerCase()}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 max-w-3xl"
        >
          <h2 className="text-[2.5rem] md:text-[3.5rem]">{title}</h2>
          {lede && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ace-dim">{lede}</p>}
        </motion.div>
        {tabs.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2" role="tablist" aria-label={kicker}>
            {tabs.map((t, i) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={t.key === cur.key}
                onClick={() => setKey(t.key)}
                className={`btn btn-sm ${t.key === cur.key ? "btn-primary" : "btn-ghost"}`}
              >
                <span className="m-num text-[11px]">{String(i + 1).padStart(2, "0")}</span> {t.label}
              </button>
            ))}
          </div>
        )}
        <motion.div
          key={cur.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="tabpanel"
        >
          <Bare.Provider value={true}>{cur.node}</Bare.Provider>
        </motion.div>
      </div>
    </section>
  );
}
