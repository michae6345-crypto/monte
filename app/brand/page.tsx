import type { Metadata } from "next";
import { Bracketed, Estimator, Expect, HandNote, Lockup, MonteMark, PenMark, Sampler } from "@/components/brand";
import { AceProvider } from "@/components/ace/store";
import { MonteCardDemo, WhyNotRealCard } from "@/components/monte-card/monte-card";

export const metadata: Metadata = { title: "𝔼[monte] · brand", robots: { index: false } };

// The living brand sheet. Every pattern in docs/BRAND.md, rendered with the real components.
// Web agents: look here first, copy from here, and add a block when you invent a new pattern.

function Block({ n, title, children, note }: { n: string; title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="m-rule grid gap-6 py-12 md:grid-cols-[220px_1fr]">
      <div>
        <div className="m-label">{n}</div>
        <h2 className="m-display mt-2 text-2xl">{title}</h2>
        {note && <p className="mt-3 text-sm leading-relaxed text-m-slate">{note}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Cell({ label, children, ink, className }: { label: string; children: React.ReactNode; ink?: boolean; className?: string }) {
  return (
    <div className={`${ink ? "m-panel-ink" : "m-panel"} flex min-h-40 flex-col justify-between gap-4 p-5 ${className ?? ""}`}>
      <span className="m-label" style={ink ? { color: "#8a8f98" } : undefined}>
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  );
}

const SWATCHES = [
  ["ground", "#F7F8FA", "page"],
  ["panel", "#FFFFFF", "cards"],
  ["ink", "#0E0F12", "text, 𝔼 bars"],
  ["accent", "#2F45FF", "𝔼 stem, resolved ], primary"],
  ["accent-wash", "#EEF0FF", "selected, highlight"],
  ["slate", "#6B6F78", "hand notes, second voice"],
  ["mute", "#A3A7AF", "brackets at rest"],
  ["line", "#E4E6EA", "hairlines"],
  ["wash", "#EEF0F3", "hover, selected"],
  ["gain", "#1F7A4D", "+$ only"],
  ["loss", "#C2412D", "−$ only"],
] as const;

export default function BrandPage() {
  return (
    <main className="min-h-screen bg-m-ground text-m-ink">
      <div className="m-body mx-auto max-w-6xl px-5 pb-32">
        <header className="flex items-center justify-between py-6">
          <Lockup size={22} />
          <span className="m-label">brand sheet · docs/BRAND.md</span>
        </header>

        <div className="py-16">
          <h1 className="m-display text-6xl md:text-8xl">
            No app icon. <span className="m-second">The brackets are the brand.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-m-slate">
            White and blue. Ink does the work, slate writes the margin notes, and one blue marks a computed answer: a bracket that opens while
            Monte is computing and closes blue when the answer is in.
          </p>
        </div>

        <Block n="01" title="Logo" note="Mark + [monte]. The 𝔼's stem is hollow on purpose. Never recolour it, never put a word other than monte inside.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Cell label="lockup · light">
              <Lockup size={44} />
            </Cell>
            <Cell label="lockup · dark" ink>
              <div className="dark">
                <Lockup size={44} />
              </div>
            </Cell>
            <Cell label="breathing (hero, idle)">
              <Lockup size={44} state="breathe" />
            </Cell>
            <Cell label="computing">
              <Lockup size={44} state="computing" />
            </Cell>
            <Cell label="resolved">
              <Lockup size={44} state="resolved" />
            </Cell>
            <Cell label="mark alone · sizes">
              <div className="flex items-end gap-5">
                <MonteMark size={64} title="Monte" />
                <MonteMark size={40} />
                <MonteMark size={24} />
                <MonteMark size={16} />
              </div>
            </Cell>
            <Cell label="mono (stamps, receipts)">
              <span className="text-m-slate">
                <MonteMark size={48} mono />
              </span>
            </Cell>
            <Cell label="in a nav bar" className="lg:col-span-2">
              <div className="m-panel flex w-full items-center justify-between rounded-full px-5 py-3">
                <Lockup size={18} />
                <div className="hidden gap-6 text-sm text-m-slate lg:flex">
                  <span>Tap</span>
                  <span>Money</span>
                  <span>Keep or cancel</span>
                  <span>Apply</span>
                </div>
                <span className="whitespace-nowrap rounded-full bg-m-accent px-4 py-1.5 text-sm text-white">Try Jordan&apos;s year</span>
              </div>
            </Cell>
          </div>
        </Block>

        <Block n="02" title="Brackets" note="Brackets replace bold. A bracketed number was computed by the engine, never typed. Open bracket stays light; the close bracket carries the state.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Cell label="emphasis in a sentence">
              <p className="m-display text-center text-3xl leading-tight">
                You left <Bracketed>$104</Bracketed> on the table.
              </p>
            </Cell>
            <Cell label="loading = sampling">
              <span className="text-5xl">
                <Sampler label="Simulating your year" />
              </span>
            </Cell>
            <Cell label="expectation">
              <Expect of="net" tone="gain" className="text-4xl">
                +$104
              </Expect>
            </Cell>
            <Cell label="still computing">
              <Expect of="interest" state="computing" className="text-4xl">
                $0
              </Expect>
            </Cell>
            <Cell label="probability">
              <Expect of="ahead" op="P" className="text-4xl">
                0.93
              </Expect>
            </Cell>
            <Cell label="as a button">
              <div className="flex gap-3">
                <button className="m-mono whitespace-nowrap rounded-full bg-m-accent px-5 py-2.5 text-sm text-white">[ run 1,000 years ]</button>
                <button className="m-mono whitespace-nowrap rounded-full px-5 py-2.5 text-sm" style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}>
                  [ re-roll ]
                </button>
              </div>
            </Cell>
            <Cell label="section heading">
              <h3 className="m-display text-4xl">
                <span className="m-br">[</span>keep or cancel<span className="m-br">]</span>
              </h3>
            </Cell>
            <Cell label="empty state">
              <div className="text-center">
                <div className="m-display text-5xl text-m-mute">[ ]</div>
                <p className="mt-3 text-sm text-m-slate">No purchases yet. Drop a statement CSV here.</p>
              </div>
            </Cell>
          </div>
        </Block>

        <Block n="03" title="Type" note="Google Sans Flex for display, Geist for reading, Geist Mono for every number, Shantell only for hand notes.">
          <div className="space-y-8">
            <div>
              <div className="m-label mb-2">display · Google Sans Flex 500 · −0.045em</div>
              <div className="m-display text-6xl">
                Every card. <span className="m-second">Played right.</span>
              </div>
            </div>
            <div>
              <div className="m-label mb-2">body · Geist 400</div>
              <p className="max-w-xl text-lg leading-relaxed">
                Monte replays your year with every card you hold, picks the right one at each tap, and shows what each card really cost after interest, fees
                and the perks you never used.
              </p>
            </div>
            <div>
              <div className="m-label mb-2">numbers · Geist Mono, tabular</div>
              <div className="m-num text-4xl">
                <span className="m-gain">+$1,284.10</span> <span className="text-m-mute">·</span> <span className="m-loss">−$427.00</span>{" "}
                <span className="text-m-mute">·</span> 26.24% APR
              </div>
            </div>
            <div>
              <div className="m-label mb-2">label · Geist Mono 11 · 0.14em caps</div>
              <div className="m-label">§03 · what your cards really cost</div>
            </div>
            <div>
              <div className="m-label mb-2">note · Shantell Sans, slate</div>
              <div className="m-note text-xl">the Apple Card balance eats every reward you earn</div>
            </div>
          </div>
        </Block>

        <Block n="04" title="Colour" note="One blue, used sparingly: the 𝔼 stem, a resolved bracket, the primary action. Slate is for hand notes. Green and red mean the sign of a dollar figure and nothing else.">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            {SWATCHES.map(([name, hex, use]) => (
              <div key={name} className="m-panel overflow-hidden">
                <div className="h-20" style={{ background: hex, boxShadow: "inset 0 -1px 0 var(--m-line)" }} />
                <div className="p-3">
                  <div className="text-sm font-medium">{name}</div>
                  <div className="m-num text-xs text-m-slate">{hex}</div>
                  <div className="mt-1 text-xs text-m-slate">{use}</div>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block n="05" title="Hand notes" note="Annotations explain a number the way a person would in the margin. Slate, slightly tilted, an arrow that draws in. Decorative: say it in real copy too.">
          <div className="m-panel relative grid gap-10 p-10 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="m-num text-5xl m-loss">−$427</span>
              <HandNote dir="left" width={180}>
                that&apos;s after interest on the Apple Card balance
              </HandNote>
            </div>
            <div className="flex flex-col items-start gap-2">
              <HandNote dir="down-right" width={200}>
                you use $60 of the $120 Uber Cash
              </HandNote>
              <span className="m-num ml-24 text-3xl">$60 / $120</span>
            </div>
            <div className="m-display text-3xl">
              Monte picks <PenMark>Amex Gold</PenMark> at Trader Joe&apos;s.
            </div>
            <div className="m-display text-3xl">
              Switching saves <PenMark kind="underline">$104 a year</PenMark>.
            </div>
          </div>
        </Block>

        <Block n="06" title="The estimator" note="The signature moment. Samples land, the histogram fills, the mean settles, the bracket closes. Use it wherever the answer is an expectation.">
          <div className="grid gap-4 md:grid-cols-2">
            <Estimator of="net" mean={104} sd={38} note="Jordan, if he moves dining to the Gold" />
            <Estimator of="rewards" mean={612} sd={140} seed={21} />
          </div>
        </Block>

        <Block n="07" title="UI pieces" note="White panels on a light ground, hairlines not shadows, pill buttons, mono for data.">
          <div className="grid gap-4 md:grid-cols-2">
            <Cell label="receipt row">
              <div className="w-full">
                {[
                  ["Trader Joe's", "Amex Gold", "4×", "+$3.12"],
                  ["Shell", "Freedom Unlimited", "1.5×", "+$0.71"],
                  ["Netflix", "Apple Card", "1%", "−$0.49"],
                ].map(([m, c, r, v]) => (
                  <div key={m} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 border-b border-m-line py-2.5 text-sm last:border-0">
                    <span>
                      {m} <span className="text-m-slate">· {c}</span>
                    </span>
                    <span className="m-num text-m-slate">{r}</span>
                    <span className={`m-num ${v.startsWith("+") ? "m-gain" : "m-loss"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </Cell>
            <Cell label="toast">
              <div className="m-panel-ink flex items-center gap-3 rounded-full px-5 py-3 text-sm">
                <MonteMark size={16} mono />
                Statement read · <span className="m-num">212</span> purchases
              </div>
            </Cell>
            <Cell label="chip / filter">
              <div className="flex flex-wrap gap-2">
                {["all", "dining", "groceries", "travel"].map((t, i) => (
                  <span
                    key={t}
                    className={`m-mono rounded-full px-3 py-1 text-xs ${i === 0 ? "bg-m-ink text-m-on-ink" : "text-m-slate"}`}
                    style={i === 0 ? undefined : { boxShadow: "0 0 0 1px var(--m-line-strong)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Cell>
            <Cell label="error">
              <div className="text-center">
                <div className="m-display text-3xl">
                  <span className="m-br">[</span>
                  <span className="m-loss">?</span>
                  <span className="m-br">]</span>
                </div>
                <p className="mt-2 text-sm text-m-slate">That file isn&apos;t a statement we can read. Try the CSV export.</p>
              </div>
            </Cell>
            <Cell label="section opening" className="md:col-span-2">
              <div className="w-full">
                <div className="m-label flex justify-between border-t border-m-ink/25 pt-3">
                  <span>§04 · keep or cancel</span>
                  <span className="normal-case tracking-normal">
                    n = 1,000 · <span className="text-m-accent">P[ahead] 0.93</span>
                  </span>
                </div>
                <h3 className="m-display mt-6 text-5xl">
                  The Gold pays for itself. <span className="m-second">Barely.</span>
                </h3>
              </div>
            </Cell>
          </div>
        </Block>
        <Block n="08" title="Monte Card (simulated)" note="One card in Apple Pay; at the tap, the engine picks which real card pays. The request is made up; the pick is the real engine. Always shown with the explainer beside it.">
          <AceProvider>
            <div className="space-y-4">
              <MonteCardDemo />
              <WhyNotRealCard />
            </div>
          </AceProvider>
        </Block>
      </div>
    </main>
  );
}
