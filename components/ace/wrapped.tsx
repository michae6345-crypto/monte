"use client";

// Monte Wrapped: the year in review as a short story you tap through, the way people share
// their music year. Every figure is the engine's, for whichever person is selected; the
// colours, doodles and stickers around them come from wrapped-art.tsx.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode, useSyncExternalStore, useRef } from "react";
import { byCategory, subscriptions, topMerchants } from "@/lib/engine/insights";
import { Lockup } from "@/components/brand";
import { CardArt, shortName } from "./card-art";
import { label } from "./money";
import { MerchantLogo } from "./merchant-logo";
import { PersonaAvatar } from "./persona-avatar";
import { Section } from "./section";
import { money, nameOf, useAce } from "./store";
import { Confetti, Doodles, Scribble, Sticker, THEMES, patternFor } from "./wrapped-art";

type Slide = { key: string; kicker: string; body: ReactNode; foot?: ReactNode };

/** the second line of a card: lighter, same colour as the card's text */
const Second = ({ children }: { children: ReactNode }) => <span className="mt-3 block text-[1.45rem] font-light leading-[1.15]">{children}</span>;

export function WrappedSection() {
  const { txns, r, held: wallet, persona } = useAce();
  const nm = nameOf(persona);
  const [i, setI] = useState(0);
  // stopped by the button (held), or for a moment by hover or focus
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduce = useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // it starts when it's on screen, so it opens on slide 1, not wherever it got to while scrolled past
  const card = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const still = held || paused || reduce || !inView;

  const slides = useMemo<Slide[]>(() => {
    const top = topMerchants(txns, 1)[0];
    const cat = byCategory(txns)[0];
    const subs = subscriptions(txns);
    const subYear = subs.reduce((a, s) => a + s.perYear, 0);
    const worst = [...r.perCard].sort((a, b) => a.net - b.net)[0];
    const best = [...r.perCard].sort((a, b) => b.net - a.net)[0];
    // the single purchase where the wrong card cost the most
    const a = new Map(r.actual.hits.map((h) => [h.txnId, h]));
    let miss = { gap: 0, merchant: "", used: "", pick: "", amount: 0 };
    for (const h of r.best.hits) {
      const x = a.get(h.txnId);
      const t = txns.find((q) => q.id === h.txnId);
      if (x && t && h.reward - x.reward > miss.gap) miss = { gap: h.reward - x.reward, merchant: t.merchant, used: x.cardId, pick: h.cardId, amount: t.amount };
    }
    const mark = (key: string, c: ReactNode) => <Scribble color={THEMES[key].accent}>{c}</Scribble>;
    const out: Slide[] = [
      {
        key: "open",
        kicker: `${nm.Whose} year`,
        body: (
          <>
            {persona.id !== "you" && (
              <span className="mb-5 block w-fit rounded-full bg-white p-1 shadow-[0_8px_20px_-8px_rgba(12,14,20,.5)]">
                <PersonaAvatar id={persona.id} size={72} />
              </span>
            )}
            {mark("open", txns.length.toLocaleString())} purchases.
            <Second>
              {money(r.spend)} on {wallet.length} card{wallet.length === 1 ? "" : "s"}.
            </Second>
          </>
        ),
      },
    ];
    if (top)
      out.push({
        key: "merchant",
        kicker: "top store, by money spent",
        body: (
          <>
            <motion.span
              className="mb-5 block w-fit"
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: -4, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.1 }}
            >
              <MerchantLogo name={top.merchant} size={76} className="rounded-[20px] shadow-[0_10px_24px_-10px_rgba(12,14,20,.45)]" />
            </motion.span>
            {top.count} purchases at {top.merchant}.
            <Second>{mark("merchant", money(top.total))} all year.</Second>
          </>
        ),
      });
    if (cat)
      out.push({
        key: "category",
        kicker: "where it went",
        body: (
          <>
            <span className="block text-[4.5rem] leading-none tracking-[-0.05em]">{mark("category", `${Math.round(cat.share * 100)}%`)}</span>
            <span className="mt-3 block">went to {label(cat.category)}.</span>
            <Second>
              {cat.count} purchases, {money(cat.total)}.
            </Second>
          </>
        ),
      });
    if (subs.length)
      out.push({
        key: "subs",
        kicker: "still billing",
        body: (
          <>
            <span className="mb-5 flex -space-x-3">
              {subs.slice(0, 4).map((s, k) => (
                <motion.span key={s.merchant} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + k * 0.1 }} style={{ rotate: (k - 1.5) * 6 }}>
                  <MerchantLogo name={s.merchant} size={46} className="rounded-[14px] shadow-[0_6px_14px_-6px_rgba(12,14,20,.4)] ring-2 ring-white" />
                </motion.span>
              ))}
            </span>
            {subs.length} subscriptions.
            <Second>{mark("subs", money(subYear))} a year in recurring charges.</Second>
          </>
        ),
      });
    if (miss.gap > 0.01)
      out.push({
        key: "miss",
        kicker: "biggest single miss",
        body: (
          <>
            {money(miss.amount, { cents: true })} at {miss.merchant} went on the {shortName(miss.used)}.
            <Second>
              The {shortName(miss.pick)} would have paid {mark("miss", money(miss.gap, { sign: true, cents: true }))} more.
            </Second>
          </>
        ),
      });
    if (r.leftOnTable >= 1)
      out.push({
        key: "table",
        kicker: "left on the table",
        body: (
          <>
            <span className="block text-[4.5rem] leading-none tracking-[-0.05em]">{mark("table", money(r.leftOnTable))}</span>
            <Second>from the same purchases, on the right card.</Second>
          </>
        ),
      });
    if (worst && best && worst.cardId !== best.cardId)
      out.push({
        key: "cards",
        kicker: "best and worst card, net last year",
        body: (
          <>
            <span className="relative mb-6 block h-[118px]">
              <motion.span className="absolute left-0 top-0 w-36" initial={{ rotate: 0, x: 30 }} animate={{ rotate: -8, x: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
                <CardArt id={best.cardId} size="sm" />
              </motion.span>
              <motion.span className="absolute left-28 top-6 w-32" initial={{ rotate: 0, x: -30 }} animate={{ rotate: 7, x: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.08 }}>
                <CardArt id={worst.cardId} size="sm" />
              </motion.span>
            </span>
            {shortName(best.cardId)}: {mark("cards", money(best.net, { sign: true }))}.
            <Second>
              {shortName(worst.cardId)}: {money(worst.net, { sign: true })}.
            </Second>
          </>
        ),
      });
    out.push({
      key: "net",
      kicker: "net, last year",
      body: (
        <>
          <span className="block text-[4.5rem] leading-none tracking-[-0.05em]">{mark("net", money(r.net, { sign: true }))}</span>
          <Second>after every reward, perk, fee and interest charge.</Second>
        </>
      ),
      foot: (
        <span className="rounded-full bg-white px-2.5 py-1">
          <Lockup size={16} state="resolved" />
        </span>
      ),
    });
    return out;
  }, [txns, r, wallet, nm.Whose, persona.id]);

  const n = slides.length;
  const cur = Math.min(i, n - 1);

  useEffect(() => {
    if (still) return;
    const id = window.setTimeout(() => setI((x) => (x + 1) % n), 4200);
    return () => clearTimeout(id);
  }, [cur, still, n]);

  const s = slides[cur];
  const theme = THEMES[s.key] ?? THEMES.open;
  // the last card's sticker answers the number
  const sticker = s.key === "net" ? { ...theme, sticker: r.net < 0 ? "ouch. fixable, though" : "nice year ✦" } : theme;

  return (
    <Section id="wrapped" index="07½" kicker="Wrapped" title={<>Tap through {nm.whose} year.</>} readout={<>{n} cards · every figure from the engine</>}>
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_380px]">
        {/* the story's contents, big enough to read across a room; the current card in bold */}
        <ol className="hidden space-y-1 lg:block">
          {slides.map((x, k) => (
            <li key={x.key}>
              <button
                onClick={() => setI(k)}
                className="flex items-baseline gap-4 text-left text-[1.9rem] leading-tight tracking-[-0.03em] text-ace-ink hover:underline"
                style={{ fontFamily: "var(--m-font-display)", fontWeight: k === cur ? 600 : 300 }}
              >
                <span className="m-num w-6 text-[12px] tracking-normal">{String(k + 1).padStart(2, "0")}</span>
                {x.kicker}
                {k === cur && (
                  <span className="text-[1.3rem] text-[var(--m-accent)]" style={{ fontFamily: "var(--m-font-note)" }}>
                    ← you are here
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>

        <motion.div
          className="relative mx-auto aspect-[9/16] w-full max-w-[380px] cursor-pointer select-none overflow-hidden rounded-[28px] p-7 shadow-[0_30px_60px_-28px_rgba(15,26,92,.55)]"
          animate={{ backgroundColor: theme.bg, color: theme.fg, rotate: reduce ? 0 : cur % 2 ? 0.6 : -0.6 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
            if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setI((x) => (e.clientX - rect.left < rect.width / 3 ? (x - 1 + n) % n : (x + 1) % n));
          }}
          ref={card}
          role="region"
          aria-label={`${nm.Whose} year in review, card ${cur + 1} of ${n}`}
        >
          {/* printed texture, then the doodles, under everything else */}
          {patternFor(theme) && <div className="pointer-events-none absolute inset-0" style={{ background: patternFor(theme) }} aria-hidden />}
          <Doodles theme={theme} k={s.key + persona.id} />
          {s.key === "net" && <Confetti color={theme.accent} k={persona.id} />}

          <div className="absolute inset-x-5 top-5 z-10 flex gap-1">
            {slides.map((x, k) => (
              <span key={x.key} className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: theme.fg === "#ffffff" ? "rgba(255,255,255,.3)" : "rgba(15,26,92,.15)" }}>
                <motion.span
                  key={k === cur ? `on${cur}` : `off${k}`}
                  className="block h-full rounded-full"
                  style={{ background: theme.fg }}
                  initial={{ width: k < cur ? "100%" : "0%" }}
                  animate={{ width: k < cur ? "100%" : k === cur ? "100%" : "0%" }}
                  transition={{ duration: k === cur && !still ? 4.2 : 0, ease: "linear" }}
                />
              </span>
            ))}
          </div>
          <div className="relative z-10 mt-7 text-[17px]" style={{ fontFamily: "var(--m-font-note)", fontWeight: 600 }}>
            {s.kicker}
          </div>
          <Sticker theme={sticker} k={s.key + persona.id} />
          <AnimatePresence mode="wait">
            <motion.div
              key={s.key + persona.id}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-7 top-1/2 z-10 -translate-y-1/2 text-[2.1rem] leading-[1.05] tracking-[-0.035em]"
              style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}
            >
              {s.body}
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-7 bottom-7 z-10 flex items-center justify-between text-[13px]" style={{ fontFamily: "var(--m-font-note)" }}>
            <span className="flex items-center gap-3">
              {cur + 1} / {n}
              {/* under reduced motion the story never plays by itself, so there is nothing to pause */}
              {!reduce && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeld((h) => !h);
                  }}
                  className="underline decoration-wavy underline-offset-4"
                  aria-pressed={held}
                >
                  {held ? "play" : "pause"}
                </button>
              )}
            </span>
            {s.foot ?? <span>tap →</span>}
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
