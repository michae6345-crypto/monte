"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Vars = Record<string, string>;

export type Brand = {
  id: string;
  name: string;
  tagline: string;
  eyebrow: string;
  mood: string;
  vars: Vars;
  Mark: (p: { size?: number }) => ReactNode;
};

const common = (v: Vars): Vars => ({ ...v });

export const BRANDS: Brand[] = [
  {
    id: "ace",
    name: "Ace",
    tagline: "Play the right card.",
    eyebrow: "Your wallet, audited",
    mood: "Black and gold, a little casino. The best card in the deck.",
    vars: common({
      "--ace-bg": "#07070a",
      "--ace-panel": "#0f0f14",
      "--ace-line": "rgba(255,255,255,0.08)",
      "--ace-ink": "#f4f1ea",
      "--ace-dim": "rgba(244,241,234,0.55)",
      "--ace-gold": "#e9c46a",
      "--ace-on-accent": "#0b0a07",
      "--ace-gain": "#3ee58f",
      "--ace-loss": "#ff5a52",
      "--ace-paper": "#f3efe6",
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-geist-sans)",
      "--brand-accent": "var(--font-serif)",
      "--brand-accent-style": "italic",
      "--brand-accent-weight": "400",
    }),
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--ace-gold)" />
        <path d="M16 6c3 4.2 8 6.4 8 10.6a4.2 4.2 0 0 1-7 3.1l1.4 5.3h-4.8l1.4-5.3a4.2 4.2 0 0 1-7-3.1C8 12.4 13 10.2 16 6z" fill="var(--ace-on-accent)" />
      </svg>
    ),
  },
  {
    id: "tab",
    name: "Tab",
    tagline: "Know your real tab.",
    eyebrow: "The receipt for your wallet",
    mood: "Warm paper, ink and tomato red. Honest, printed, a bit editorial.",
    vars: common({
      "--ace-bg": "#f4efe4",
      "--ace-panel": "#fffdf8",
      "--ace-line": "rgba(28,24,18,0.12)",
      "--ace-ink": "#1c1812",
      "--ace-dim": "rgba(28,24,18,0.6)",
      "--ace-gold": "#e5462b",
      "--ace-on-accent": "#fffaf0",
      "--ace-gain": "#11845b",
      "--ace-loss": "#d2372a",
      "--ace-paper": "#ffffff",
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-geist-sans)",
      "--brand-accent": "var(--font-fraunces)",
      "--brand-accent-style": "italic",
      "--brand-accent-weight": "500",
    }),
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <path d="M6 3h20v24l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2L6 27z" fill="var(--ace-gold)" />
        <path d="M11 10h10M16 10v10" stroke="var(--ace-on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "kicker",
    name: "Kicker",
    tagline: "The card that tips it.",
    eyebrow: "Every tap, the winning card",
    mood: "Midnight and electric lime. Loud, quick, made for a student's first cards.",
    vars: common({
      "--ace-bg": "#090c18",
      "--ace-panel": "#10152a",
      "--ace-line": "rgba(200,255,46,0.12)",
      "--ace-ink": "#eef2ff",
      "--ace-dim": "rgba(238,242,255,0.58)",
      "--ace-gold": "#c8ff2e",
      "--ace-on-accent": "#0a0d02",
      "--ace-gain": "#2ee6a8",
      "--ace-loss": "#ff5c7a",
      "--ace-paper": "#f1f4ff",
      "--brand-body": "var(--font-grotesk)",
      "--brand-head": "var(--font-grotesk)",
      "--brand-accent": "var(--font-grotesk)",
      "--brand-accent-style": "normal",
      "--brand-accent-weight": "700",
    }),
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="8" width="22" height="15" rx="3" transform="rotate(-12 14 15)" fill="var(--ace-gold)" />
        <path d="M20 22l8-8m0 0h-6m6 0v6" stroke="var(--ace-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "netted",
    name: "Netted",
    tagline: "What your cards really net you.",
    eyebrow: "Rewards minus everything",
    mood: "Midnight blue and signal blue. Calm and precise, like a good bank.",
    vars: common({
      "--ace-bg": "#0a1020",
      "--ace-panel": "#101a33",
      "--ace-line": "rgba(140,170,255,0.12)",
      "--ace-ink": "#eaf0ff",
      "--ace-dim": "rgba(234,240,255,0.56)",
      "--ace-gold": "#5b8cff",
      "--ace-on-accent": "#ffffff",
      "--ace-gain": "#3ee58f",
      "--ace-loss": "#ff6b5a",
      "--ace-paper": "#f2f5ff",
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-bricolage)",
      "--brand-accent": "var(--font-bricolage)",
      "--brand-accent-style": "normal",
      "--brand-accent-weight": "700",
    }),
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="7" width="20" height="9" rx="2.5" fill="var(--ace-gold)" />
        <rect x="9" y="17" width="20" height="9" rx="2.5" fill="var(--ace-gold)" opacity="0.55" />
      </svg>
    ),
  },
];

const Ctx = createContext<{ brand: Brand; setBrand: (id: string) => void }>({ brand: BRANDS[0], setBrand: () => {} });

export function BrandProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState("ace");
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("brand");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("brand");
    } catch {}
    const pick = BRANDS.find((b) => b.id === (q ?? saved))?.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pick) setId(pick);
  }, []);
  const brand = BRANDS.find((b) => b.id === id) ?? BRANDS[0];
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(brand.vars)) root.style.setProperty(k, v);
    root.dataset.brand = brand.id;
    document.title = `${brand.name}: the right card, the real cost`;
  }, [brand]);
  const setBrand = (next: string) => {
    setId(next);
    try {
      localStorage.setItem("brand", next);
    } catch {}
    const u = new URL(location.href);
    u.searchParams.set("brand", next);
    history.replaceState(null, "", u);
  };
  return <Ctx.Provider value={{ brand, setBrand }}>{children}</Ctx.Provider>;
}

export const useBrand = () => useContext(Ctx);

export function BrandSwitcher() {
  const { brand, setBrand } = useBrand();
  const [open, setOpen] = useState(true);
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[min(94vw,640px)] -translate-x-1/2">
      <div className="rounded-2xl border border-ace-line bg-ace-panel/90 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-ace-dim">Brand options · pick one</span>
          <button onClick={() => setOpen((v) => !v)} className="mono text-[10px] uppercase tracking-[0.2em] text-ace-dim hover:text-ace-ink">
            {open ? "hide" : "show"}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BRANDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBrand(b.id)}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                b.id === brand.id ? "border-ace-gold bg-ace-gold/10" : "border-ace-line hover:border-ace-ink/30"
              }`}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: b.vars["--ace-bg"] }}>
                <span className="block size-3 rounded-full" style={{ background: b.vars["--ace-gold"] }} />
              </span>
              <span className="truncate text-sm font-medium">{b.name}</span>
            </button>
          ))}
        </div>
        {open && (
          <p className="mt-2 px-1 text-xs leading-relaxed text-ace-dim">
            <span className="font-semibold text-ace-ink">{brand.name}</span> · “{brand.tagline}” {brand.mood}
          </p>
        )}
      </div>
    </div>
  );
}
