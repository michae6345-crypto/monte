"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Kicker brand kit: the name is fixed; logo, theme and type are separate choices so
// they can be mixed on the live page. ?logo=&theme=&type= links pick a combination.

type Vars = Record<string, string>;
type MarkProps = { size?: number };

export type Logo = { id: string; label: string; note: string; lower: boolean; Mark: (p: MarkProps) => ReactNode };
export type Theme = { id: string; label: string; note: string; vars: Vars };
export type TypeSet = { id: string; label: string; note: string; vars: Vars };

export const NAME = "Kicker";
export const TAGLINE = "The card that tips it.";
export const EYEBROW = "Every tap, the winning card";

export const LOGOS: Logo[] = [
  {
    id: "kick",
    label: "Kick card",
    note: "A tilted card with an arrow off its corner: the card that gets kicked forward.",
    lower: false,
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="8" width="21" height="14" rx="3" transform="rotate(-12 14 15)" fill="var(--ace-gold)" />
        <path d="M19 23l8.5-8.5m0 0h-6.5m6.5 0V21" stroke="var(--ace-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "stack",
    label: "Winning card",
    note: "Three cards in a stack, the top one pulled out and raised. The pick, as a picture.",
    lower: true,
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="5" y="15" width="18" height="11" rx="2.5" fill="var(--ace-ink)" opacity="0.25" />
        <rect x="7" y="11" width="18" height="11" rx="2.5" fill="var(--ace-ink)" opacity="0.45" />
        <rect x="10" y="5" width="18" height="11" rx="2.5" transform="rotate(8 19 10)" fill="var(--ace-gold)" />
      </svg>
    ),
  },
  {
    id: "k",
    label: "k monogram",
    note: "A lowercase k whose leg runs out as an arrow, on an accent tile. Works as an app icon.",
    lower: true,
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--ace-gold)" />
        <path d="M11 7v18M11 18l8-7M14.5 15l8 10" stroke="var(--ace-on-accent)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M22.5 25h-4M22.5 25v-4" stroke="var(--ace-on-accent)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "chip",
    label: "Chip",
    note: "A poker chip with a tick in the middle: the right call, every hand.",
    lower: false,
    Mark: ({ size = 28 }) => (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="var(--ace-gold)" />
        <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--ace-on-accent)" strokeWidth="2" strokeDasharray="3.2 2.6" />
        <path d="M11.5 16.4l3 3 6-6.4" stroke="var(--ace-on-accent)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

const base = { "--ace-paper": "#f3efe6" };

export const THEMES: Theme[] = [
  {
    id: "night",
    label: "Night lime",
    note: "Midnight navy and electric lime. Loud, young, unmistakable on a phone.",
    vars: {
      ...base,
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
    },
  },
  {
    id: "turf",
    label: "Turf",
    note: "Pitch green and kick-off orange: the kicker on a football field. Sporty and warm.",
    vars: {
      ...base,
      "--ace-bg": "#06231a",
      "--ace-panel": "#0b3125",
      "--ace-line": "rgba(240,247,236,0.12)",
      "--ace-ink": "#f0f7ec",
      "--ace-dim": "rgba(240,247,236,0.6)",
      "--ace-gold": "#ff6a2b",
      "--ace-on-accent": "#1a0700",
      "--ace-gain": "#a6ff7a",
      "--ace-loss": "#ff5a5a",
      "--ace-paper": "#f6f2e6",
    },
  },
  {
    id: "arcade",
    label: "Arcade",
    note: "Ink black and hot pink. Game-show energy; the receipt is the high score.",
    vars: {
      ...base,
      "--ace-bg": "#0b0613",
      "--ace-panel": "#170c26",
      "--ace-line": "rgba(255,62,165,0.15)",
      "--ace-ink": "#f7f0ff",
      "--ace-dim": "rgba(247,240,255,0.58)",
      "--ace-gold": "#ff3ea5",
      "--ace-on-accent": "#ffffff",
      "--ace-gain": "#3cf0c5",
      "--ace-loss": "#ff8a5c",
      "--ace-paper": "#fbf4ff",
    },
  },
  {
    id: "daylight",
    label: "Daylight",
    note: "White, ink and electric blue. Clean and bank-like, closest to Ramp or Mercury.",
    vars: {
      ...base,
      "--ace-bg": "#f5f6f1",
      "--ace-panel": "#ffffff",
      "--ace-line": "rgba(12,14,20,0.1)",
      "--ace-ink": "#0c0e14",
      "--ace-dim": "rgba(12,14,20,0.58)",
      "--ace-gold": "#2f45ff",
      "--ace-on-accent": "#ffffff",
      "--ace-gain": "#0f8a55",
      "--ace-loss": "#d8342b",
      "--ace-paper": "#ffffff",
    },
  },
];

export const TYPES: TypeSet[] = [
  {
    id: "grotesk",
    label: "Space Grotesk",
    note: "Techy grotesk throughout; the highlight word goes bold.",
    vars: {
      "--brand-body": "var(--font-grotesk)",
      "--brand-head": "var(--font-grotesk)",
      "--brand-accent": "var(--font-grotesk)",
      "--brand-accent-style": "normal",
      "--brand-accent-weight": "700",
    },
  },
  {
    id: "unbounded",
    label: "Unbounded",
    note: "Wide, chunky display type for headlines; plain sans for reading.",
    vars: {
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-unbounded)",
      "--brand-accent": "var(--font-unbounded)",
      "--brand-accent-style": "normal",
      "--brand-accent-weight": "700",
    },
  },
  {
    id: "condensed",
    label: "Barlow Condensed",
    note: "Tall, condensed sports-jersey type; italic for the highlight.",
    vars: {
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-barlow)",
      "--brand-accent": "var(--font-barlow)",
      "--brand-accent-style": "italic",
      "--brand-accent-weight": "700",
    },
  },
  {
    id: "editorial",
    label: "Bricolage + serif",
    note: "Characterful grotesk headlines with an elegant italic serif for the highlight.",
    vars: {
      "--brand-body": "var(--font-geist-sans)",
      "--brand-head": "var(--font-bricolage)",
      "--brand-accent": "var(--font-serif)",
      "--brand-accent-style": "italic",
      "--brand-accent-weight": "400",
    },
  },
];

type Choice = { logo: string; theme: string; type: string };
const DEFAULT: Choice = { logo: "kick", theme: "night", type: "grotesk" };

type Brand = { name: string; tagline: string; eyebrow: string; Mark: Logo["Mark"]; wordmark: string };

const Ctx = createContext<{ brand: Brand; choice: Choice; set: (k: keyof Choice, v: string) => void }>({
  brand: { name: NAME, tagline: TAGLINE, eyebrow: EYEBROW, Mark: LOGOS[0].Mark, wordmark: NAME },
  choice: DEFAULT,
  set: () => {},
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>(DEFAULT);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    let saved: Partial<Choice> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kicker-brand") ?? "{}");
    } catch {}
    const pick = (k: keyof Choice, list: { id: string }[]) => {
      const v = q.get(k) ?? saved[k];
      return list.some((x) => x.id === v) ? (v as string) : DEFAULT[k];
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice({ logo: pick("logo", LOGOS), theme: pick("theme", THEMES), type: pick("type", TYPES) });
  }, []);

  const logo = LOGOS.find((l) => l.id === choice.logo)!;
  const theme = THEMES.find((t) => t.id === choice.theme)!;
  const type = TYPES.find((t) => t.id === choice.type)!;

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries({ ...theme.vars, ...type.vars })) root.style.setProperty(k, v);
    root.dataset.theme = theme.id;
  }, [theme, type]);

  const set = (k: keyof Choice, v: string) => {
    const next = { ...choice, [k]: v };
    setChoice(next);
    try {
      localStorage.setItem("kicker-brand", JSON.stringify(next));
    } catch {}
    const u = new URL(location.href);
    for (const [kk, vv] of Object.entries(next)) u.searchParams.set(kk, vv);
    history.replaceState(null, "", u);
  };

  const brand: Brand = {
    name: NAME,
    tagline: TAGLINE,
    eyebrow: EYEBROW,
    Mark: logo.Mark,
    wordmark: logo.lower ? NAME.toLowerCase() : NAME,
  };
  return <Ctx.Provider value={{ brand, choice, set }}>{children}</Ctx.Provider>;
}

export const useBrand = () => useContext(Ctx);

export function BrandSwitcher() {
  const { choice, set } = useBrand();
  const [open, setOpen] = useState(true);
  const rows: { key: keyof Choice; label: string; items: { id: string; label: string; note: string }[] }[] = [
    { key: "logo", label: "Logo", items: LOGOS },
    { key: "theme", label: "Theme", items: THEMES },
    { key: "type", label: "Fonts", items: TYPES },
  ];
  const notes = rows.map((r) => r.items.find((x) => x.id === choice[r.key])!.note);
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[min(96vw,760px)] -translate-x-1/2">
      <div className="rounded-2xl border border-ace-line bg-ace-panel/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-ace-dim">Kicker brand kit · mix and match</span>
          <button onClick={() => setOpen((v) => !v)} className="mono text-[10px] uppercase tracking-[0.2em] text-ace-dim hover:text-ace-ink">
            {open ? "hide" : "show"}
          </button>
        </div>
        {open && (
          <>
            <div className="mt-2 space-y-1.5">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="mono w-12 shrink-0 text-[10px] uppercase tracking-[0.15em] text-ace-dim">{r.label}</span>
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    {r.items.map((x) => {
                      const on = choice[r.key] === x.id;
                      const L = r.key === "logo" ? LOGOS.find((l) => l.id === x.id)!.Mark : null;
                      const T = r.key === "theme" ? THEMES.find((t) => t.id === x.id)! : null;
                      return (
                        <button
                          key={x.id}
                          onClick={() => set(r.key, x.id)}
                          className={`flex items-center gap-1.5 truncate rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                            on ? "border-ace-gold bg-ace-gold/10 text-ace-ink" : "border-ace-line text-ace-dim hover:text-ace-ink"
                          }`}
                        >
                          {L && <L size={16} />}
                          {T && (
                            <span className="grid size-4 shrink-0 place-items-center rounded" style={{ background: T.vars["--ace-bg"] }}>
                              <span className="block size-2 rounded-full" style={{ background: T.vars["--ace-gold"] }} />
                            </span>
                          )}
                          <span className="truncate">{x.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-ace-dim">{notes.join(" ")}</p>
          </>
        )}
      </div>
    </div>
  );
}
