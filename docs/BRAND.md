# 𝔼[monte] brand book

For every agent and person working on Monte's web design. Read this before you style anything.
**See it rendered at `/brand`** (`app/brand/page.tsx`): every pattern below, built with the real
components. When you invent a new pattern, add a block there and a line here.

- Tokens and fonts: `styles/brand.css` (imported once from `app/globals.css`)
- Components: `components/brand/` → `import { Lockup, Bracketed, Expect, Sampler, Estimator, HandNote, PenMark, MonteMark } from "@/components/brand"`
- Files: `public/brand/` (`monte-mark.svg`, `monte-mark-dark.svg`, `monte-mark-mono.svg`, `favicon.svg`, `monte-loader.svg`), `public/fonts/` (Google Sans Flex, Shantell Sans, OFL licence)

---

## 1. The idea in one line

**Monte is an expectation.** 𝔼[x] is how a mathematician writes "the average of x over every way
the future could go". Monte replays your year with every card, a thousand times, and tells you the
expected value. So the brand is the notation itself: the 𝔼, and **brackets that open while Monte is
computing and close when the answer is in.**

Everything else follows from that:
- Brackets are our emphasis. We don't bold numbers; we bracket them.
- A bracketed number was **computed by the engine**. Never bracket a number typed into copy.
- Loading is sampling: `[···]`, three samples landing.
- The one colour (blue) means "this is the answer". It appears when the bracket closes.

## 2. References, and what to take from each

| Reference | Take | Don't take |
|---|---|---|
| **spacefs.com** | A light ground, big confident type, product mockups scaled like real windows, generous whitespace, scroll that reveals one idea at a time | Its colours |
| **Hivemind** (`~/hivemind`, our own SEPHacks site) | The hand notes (Shantell Sans + a pencil arrow that draws itself in), the `Fit` scaled canvases, two-tone headlines, the fonts | Its honey/rose accents |
| **Fuser** | Motion that explains a mechanism: things move *because* the product is doing something, never for decoration | Dark-mode glow |
| **Uno Wallet** (the YC company we copy) | Real card art, the tap moment, the "right card" answer front and centre | Its app-icon-in-a-gradient look |

**Banned (Adrian has rejected all of these):** tilted floating cards for decoration, gradients
(except the issuers' own card art), glows, glassmorphism, generic app icons in rounded squares,
emoji as icons, orange, "AI slop" stock layouts (three feature cards with icons in a row, a purple
hero blob). If it would look at home on a template site, it's wrong.

## 3. Logo

### Construction
- **The mark** is a double-struck 𝔼 drawn in a 70×100 box: a **hollow stem** (a 7-unit outline,
  in the blue accent) and **three solid bars** (ink). The stem is hollow on purpose: it's the
  "double strike" of the blackboard letter, and you can see through it.
- **The lockup** is mark + `[monte]`: brackets in Google Sans Flex 300, mute grey; `monte` in
  Google Sans Flex 500 at −0.05em tracking, lower case, ink.
- Gap between mark and `[` is ~0.12 em. The mark's height is 0.8× the wordmark's font size.

```tsx
<Lockup size={22} />                       // nav
<Lockup size={44} state="breathe" />       // hero, idle: the bracket gap breathes
<Lockup size={44} state="computing" />     // while something runs
<Lockup size={44} state="resolved" />      // the closing bracket turns blue
<MonteMark size={32} title="Monte" />      // the mark alone (favicon, avatar, stamp)
<MonteMark size={24} mono />               // single colour (currentColor): receipts, stamps, toasts
```

### Rules
- Clearspace: one bracket's width on every side.
- Minimum: lockup 14px font size; the mark alone 16px tall. Below that, use `favicon.svg`.
- On dark: put the lockup inside `.dark` (or `[data-theme=dark]`); the tokens swap themselves.
- Never: recolour the bars, fill the stem, put any word but `monte` inside the brackets, capitalise
  it (`[Monte]`), set it in another font, add a tagline inside the lockup, rotate it, outline it,
  or put it in a rounded-square "app icon".
- In running text the product is **Monte** (capital M, no brackets). The brackets belong to the
  logo and to computed numbers.

## 4. The bracket system (the core of the brand)

The open bracket is always light (weight 300) and mute. **The closing bracket carries the state.**

| State | Looks like | Use it for | Component |
|---|---|---|---|
| rest | `[ monte ]`, both mute | Static logo, section headings | `<Lockup />` |
| breathe | gap widens and narrows over 3.2 s | The hero logo while idle; "the gap is the spread of the samples" | `state="breathe"` |
| computing | brackets blink | Any value being solved or sampled | `state="computing"` |
| loading | `[···]`, dots bounce | Every wait: page data, a statement upload, the LP solver, Monte Carlo | `<Sampler label="…" />` |
| resolved | `]` turns blue | The moment an answer lands | `state="resolved"` |
| emphasis | `You left [$104] on the table.` | The single number a sentence is about | `<Bracketed>$104</Bracketed>` |
| expectation | `𝔼[net] = +$104` | Any Monte Carlo answer | `<Expect of="net" tone="gain">+$104</Expect>` |
| probability | `P[ahead] = 0.93` | Odds: "chance the card pays for itself" | `<Expect op="P" of="ahead">0.93</Expect>` |
| empty | `[ ]` large, mute | Empty states: no purchases, no cards | see `/brand` §02 |
| error | `[?]` with `?` in loss red | A failed upload, an unreadable statement | see `/brand` §07 |

### 30 places the brackets go

1. **Nav logo**: `<Lockup size={18} />`. Hover: the gap breathes once.
2. **Hero logo**: big, `state="breathe"` until the visitor scrolls, then it closes (`resolved`) as the first card lands.
3. **Hero headline**: "Every card, [played right]." The bracketed phrase is the only word group in brackets on the page that isn't a number. This is the one exception; don't add a second.
4. **Primary button**: `[ try Jordan's year ]`, mono, blue pill. Secondary: `[ re-roll ]`, a hairline pill.
5. **Loading the page's data**: `<Sampler label="Loading your year" />` centred where the content will appear.
6. **Statement upload**: drop zone shows `[ ]`; while parsing, `[···]`; on success the toast reads "Statement read · [212] purchases".
7. **Tap moment**: the merchant appears, brackets blink around the reward while the engine ranks the cards, then close blue on the winner: `Amex Gold · [4×] · +$3.12`.
8. **Money section headline**: "You spent [$38,410] last year." The number counts up, then the bracket closes.
9. **Category treemap**: hovered tile shows its total bracketed; the rest plain.
10. **Subscriptions list**: each recurring charge's yearly total bracketed (it's computed: 12 × monthly).
11. **Receipt / true cost**: each card's net cost line ends in a bracketed figure: `Apple Card ... [−$427]`.
12. **"Left on the table"**: the one number of the whole site. `You left [$104] on the table.` Huge, with a hand note.
13. **Purchase history rows**: the verdict column brackets the missed value: `[−$0.49]`. A correct pick shows a plain check, no brackets.
14. **Replay**: the year replays month by month; the running total sits in computing brackets until December, then resolves.
15. **Keep or cancel**: `P[pays for itself] = 0.93` and `𝔼[net] = +$212` per premium card.
16. **Apply / for you**: each recommended card's `𝔼[first-year value]`; a carried balance shows `[ no new card yet ]` in slate.
17. **Signup-bonus planner**: "Hit the $4,000 minimum by [Mar 12]": dates the engine computed get brackets too.
18. **Monte Carlo estimator**: `<Estimator />`, the signature moment (§9).
19. **Section openings**: `§04 · keep or cancel` on the left, a live readout on the right: `n = 1,000 · P[ahead] 0.93`.
20. **Section headings** (optional): `[keep or cancel]` in display type for a sub-page or a slide title.
21. **Tooltips on numbers**: hovering a bracketed number opens a mono tooltip with its trace: rule, rate, transactions, source date. This is how "every dollar traces to a card rule" shows on screen.
22. **Comparison table**: the best value in each row gets the brackets and the blue `]`; nothing else is coloured.
23. **Chips/filters**: no brackets. Brackets are for computed things; filters are choices.
24. **Toasts**: `MonteMark mono` + a sentence; a computed count inside it is bracketed.
25. **Empty states**: big mute `[ ]` and one sentence that says what to do.
26. **Errors**: `[?]`, one sentence, one way out ("Try the CSV export").
27. **404**: `𝔼[page] = undefined`, with a link home.
28. **Slides**: every slide title in display type; the key number per slide in brackets; the final slide is the lockup resolving.
29. **Demo video**: open on `[···]` sampling, end on `𝔼[monte]` with the `]` turning blue.
30. **Favicon / OG image**: the mark alone (favicon); the OG card is the lockup + `You left [$104] on the table.`

## 5. Typography

| Role | Font | Settings | Class |
|---|---|---|---|
| Display: headlines, the wordmark, big numbers in sentences | **Google Sans Flex** | 500 weight, −0.045em tracking, 0.98 line height | `.m-display` |
| Second voice of a headline | same | slate colour | `.m-second` |
| Body | **Geist** | 400, 16–18px, 1.6 line height | `.m-body` |
| Every number, every data label | **Geist Mono** | tabular figures | `.m-num` / `.m-mono` |
| Small caps labels | Geist Mono | 11px, 0.14em tracking, upper case, slate | `.m-label` |
| Hand notes | **Shantell Sans** | slate, tilted −1.5°, 15–20px | `.m-note` / `<HandNote>` |

Scale (desktop / phone): hero 96/56 · section 56/40 · sub 32/26 · body 18/16 · small 14 · label 11.

**Two-tone headlines** (from Hivemind): say it in ink, finish it in slate.
```tsx
<h2 className="m-display text-6xl">The Gold pays for itself. <span className="m-second">Barely.</span></h2>
```
Rules: one two-tone headline per section. Numbers are never in Google Sans Flex alone; in a headline,
wrap them in `<Bracketed>` (which sets them in mono). Shantell never sets a number that matters,
body copy, a button or a label.

## 6. Colour

White and blue. Ink does the work, slate writes in the margin, one blue marks the answer.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--m-ground` | `#F7F8FA` | `#0B0C0E` | page |
| `--m-panel` | `#FFFFFF` | `#141518` | cards, panels |
| `--m-ink` | `#0E0F12` | `#F2F3F5` | text, 𝔼 bars, chart bars when final |
| `--m-accent` | `#2F45FF` | `#7D8BFF` | 𝔼 stem, resolved `]`, primary button, focus ring, the winning value |
| `--m-accent-wash` | `#EEF0FF` | `#1A1F45` | selected row, highlighted tile |
| `--m-slate` | `#6B6F78` | `#9AA0AA` | hand notes, secondary text, `.m-second`, labels |
| `--m-mute` | `#A3A7AF` | `#5D6270` | brackets at rest, axes, placeholders, bars while sampling |
| `--m-line` | `#E4E6EA` | `#23252B` | hairlines |
| `--m-line-strong` | `#D5D8DE` | `#30333A` | table rules, chart frames, secondary button outline |
| `--m-wash` | `#EEF0F3` | `#1B1D21` | hover fill |
| `--m-gain` | `#1F7A4D` | `#4FBF86` | **+$ only** |
| `--m-loss` | `#C2412D` | `#EF7A64` | **−$ only** |

Tailwind: `bg-m-ground`, `text-m-slate`, `border-m-line`, `bg-m-accent`, etc.

Rules:
- Blue is rare. If more than ~3 things on a screen are blue, remove some. It means "answer" or "do this".
- Green/red only on signed dollar figures, never on text, icons or backgrounds.
- No gradients. The only colourful things on the page are the issuers' real card art (`public/cards/`).
- The live site's older `--ace-*` tokens map like this: `--ace-bg → --m-ground`, `--ace-panel → --m-panel`,
  `--ace-ink → --m-ink`, `--ace-dim → --m-slate`, `--ace-gold` (the blue accent) `→ --m-accent`,
  `--ace-gain/loss → --m-gain/loss`, `--ace-line → --m-line`.

## 7. Numbers

- Mono, tabular. Always `money()` from `components/ace/store.tsx` or the same rules:
  `+$1,284` / `−$427` (true minus sign U+2212, not a hyphen); cents only in receipts and tap rows.
- Sign shown whenever the number is a gain or loss; no sign for plain totals ("You spent $38,410").
- Rates: `4×` for points multipliers, `1.5%` for cash back, `26.24% APR`.
- Uncertainty: `+$104 ± $1.19` in the estimator, or the readout `n = 1,000 · ±$1.19`.
- Numbers count up when they first appear (`<Num>` in `components/ace/num.tsx`), 0.9 s, ease `[0.16, 1, 0.3, 1]`. They render their real value on the server first.
- Every number on screen comes from the engine. If you need a number for a design, run the engine
  or use a persona from `lib/data/personas.ts`. Never invent one: Jordan's net is −$427 and he left
  $104 on the table; use those.

## 8. Motion

Motion explains the mechanism. Every animation answers "what is Monte doing right now?"

| Moment | Motion | Timing |
|---|---|---|
| Sampling | samples land in batches; histogram bars fill in mute | 9 samples / 40 ms; 1,000 in ~4.5 s |
| Convergence | the running-mean line draws left to right and flattens | in step with sampling |
| Resolve | `]` fades mute → blue; bars go mute → ink; value gets its sign colour | 0.4 s, `--m-ease` |
| Computing | brackets blink | 0.9 s steps |
| Loading | `[···]` dots bounce, staggered 0.15 s | 1.2 s loop |
| Idle logo | bracket gap breathes | 3.2 s loop |
| Hand note | text fades up with −1.5° tilt; arrow draws stem then head | 0.5 s + 0.6 s + 0.25 s |
| Pen mark | circle/underline draws itself | 0.7 s, `--m-ease-draw` |
| Section reveal | 24px rise + fade, once | 0.7 s |
| Cards (hero) | real card art falls into place with physics on scroll (matter-js) | physics |

- `--m-ease: cubic-bezier(0.16, 1, 0.3, 1)` for everything that settles;
  `--m-ease-draw: cubic-bezier(0.65, 0, 0.35, 1)` for lines that draw.
- Respect `prefers-reduced-motion`: brand.css already stops the loops; the estimator lands every sample on the first tick.
- No parallax, no hover tilts, no bouncing buttons, no confetti.

## 9. The estimator (signature component)

`<Estimator of="net" mean={104} sd={38} note="Jordan, if he moves dining to the Gold" />`

A white panel: `𝔼[net] = [···]` at the top-left, `n = 0` at the top-right. On scroll-in, samples
land, the histogram fills in mute, the running mean draws below it. At n = 1,000: bars turn ink,
the mean line turns blue, the `]` turns blue, the value takes its sign colour. `[ re-roll ]`
reseeds it.

- **For the real site, pass `samples`** from the engine's Monte Carlo (`lib/engine`, Michael's) so
  the histogram is the real distribution. The `mean`/`sd` props draw an illustrative normal, fine for
  slides and the brand page, not for a claim.
- Where it goes: Keep or cancel (per premium card), Apply (per recommendation), the "how it works"
  explainer, the last slide of the pitch.

## 10. Hand notes and pen marks

Annotations are the brand's human voice: a person explaining a number in the margin. Slate,
Shantell Sans, a pencil arrow.

```tsx
<HandNote dir="left" width={180}>that's after interest on the Apple Card balance</HandNote>
<HandNote dir="down-right">you use $60 of the $120 Uber Cash</HandNote>
Monte picks <PenMark>Amex Gold</PenMark> at Trader Joe's.
Switching saves <PenMark kind="underline">$104 a year</PenMark>.
```

- `dir` is where the arrow points: `left | right | up | down | up-left | up-right | down-left | down-right`.
- Lower case, no full stop, short (≤ 10 words), conversational: "the balance eats every reward".
- At most two notes per screen. Notes are `aria-hidden`; anything a note says must also be in
  the real copy, a label or a tooltip.
- Good places: next to the "left on the table" number; on the treemap's biggest tile; pointing at
  the winning card in the tap demo; on the estimator's result; on a chart's inflection point
  ("Q4 5% on Amazon kicks in here"); on the hero's first card.
- Pen marks (circle, underline) for the one word or number a sentence turns on. One per section.

## 11. Layout and surfaces

- Ground `--m-ground`, content on white panels (`.m-panel`: 18px radius, a 1px `--m-line` ring,
  **no drop shadow**). Dark feature panels use `.m-panel-ink`.
- Max width 1152px (`max-w-6xl`), 20px side gutter on phones, sections 80–112px apart.
- Hairlines, not boxes, between rows. Tables have no vertical rules.
- Buttons are pills: primary blue with white mono text in brackets; secondary a `--m-line-strong` ring.
- Section opening ("solver printout", already in `components/ace/section.tsx`): a ruled line,
  `§04 · keep or cancel` in `.m-label` on the left, a live readout of real numbers on the right.
- Product mockups (the phone, the tap screen) are drawn at a fixed size and scaled to their column
  (Hivemind's `Fit`, the way spacefs scales its Finder windows), never rebuilt responsively.
- Real card art only from `public/cards/*.webp`, upright, with the issuer's own shadow; never tilted
  for decoration. They may move when physics moves them.

## 12. Copy voice

Precise, plain, short. Say what Monte does with a number in it.

- Yes: "You left $104 on the table." "The Gold pays for itself. Barely." "No new card yet: pay
  down the Apple Card first." "Every card, played right."
- No: "Unlock your financial potential." "Supercharge your rewards." "AI-powered insights."
  "Seamless." "Revolutionary." Any sentence without a fact in it.
- Talk about the persona by name in demos ("Jordan"), "you" in product copy.
- Never "AI" as a selling point. The engine is deterministic; the AI never does the math.

## 13. Per-section guidance (the Monte site)

| Section | The one thing it shows | Brand moves |
|---|---|---|
| Hero | Real cards fall into a wallet; Monte picks the right one | `Lockup state="breathe"` → resolves as the first card lands; headline "Every card, [played right]."; blue primary `[ try Jordan's year ]` |
| Tap | A purchase happens; the right card wins | brackets blink around the reward while ranking, resolve blue on the winner; hand note on the runner-up's gap |
| Money | Where the money went | treemap in ink/wash tones (no rainbow), hovered tile bracketed; subscriptions with yearly totals bracketed |
| Receipt / true cost | Each card's net after interest, fees, unused perks | receipt rows, signed colours, `[−$427]`; hand note on the interest line |
| Purchases | Every purchase's verdict | table rows, a check or a bracketed miss; filter chips (no brackets) |
| Replay | The year replayed with the best card each time | running total in computing brackets until December, then resolved; "You left [$104] on the table." |
| Keep or cancel | Does each fee card pay for itself? | `P[pays for itself]`, `𝔼[net]`, an `<Estimator>` per card |
| Apply / for you | What to apply for, or "no new card yet" | `𝔼[first-year value]`; a carried balance gets `[ no new card yet ]` in slate |
| Moat / how it works | Deterministic engine, sourced rules | a rule card with its source URL and checked date in mono; the estimator explaining Monte Carlo |
| Footer | The lockup, resolved | `<Lockup state="resolved" />`, team, GitHub |

## 14. Recipes

**Inline computed number**
```tsx
<p className="m-display text-5xl">You left <Bracketed>$104</Bracketed> on the table.</p>
```

**A value that's still being solved**
```tsx
<Bracketed state={solving ? "computing" : "resolved"}>{solving ? "···" : money(v, { sign: true })}</Bracketed>
```

**Any wait**
```tsx
{loading ? <Sampler label="Reading your statement" /> : <Purchases />}
```

**A Monte Carlo answer**
```tsx
<Expect of="net" tone={v >= 0 ? "gain" : "loss"} className="text-4xl">{money(v, { sign: true })}</Expect>
<Expect op="P" of="pays for itself">{p.toFixed(2)}</Expect>
```

**Primary and secondary buttons**
```tsx
<button className="m-mono whitespace-nowrap rounded-full bg-m-accent px-5 py-2.5 text-sm text-white">[ try Jordan's year ]</button>
<button className="m-mono whitespace-nowrap rounded-full px-5 py-2.5 text-sm" style={{ boxShadow: "0 0 0 1px var(--m-line-strong)" }}>[ re-roll ]</button>
```

**Panel with a note**
```tsx
<div className="m-panel relative p-8">
  <span className="m-num m-loss text-5xl">−$427</span>
  <HandNote dir="left" className="absolute left-48 top-10">after interest on the Apple Card balance</HandNote>
</div>
```

**Section opening**
```tsx
<div className="m-label flex justify-between border-t border-m-ink/25 pt-3">
  <span>§04 · keep or cancel</span>
  <span className="normal-case tracking-normal">n = 1,000 · <span className="text-m-accent">P[ahead] 0.93</span></span>
</div>
```

## 15. Data visualisation

- Bars: mute while sampling, ink when final. Highlight one bar or tile with `--m-accent`; never a palette.
- Categories (treemap, sankey): ink at stepped opacities (100/70/45/25%) on white, labels in mono.
  If a chart truly needs to tell categories apart, use hairline patterns or direct labels, not hues.
- Lines: 1.5px ink; the reference line (mean, break-even) dashed in slate, blue when it's the answer.
- Axes: mute, 11px mono, no gridlines except a single zero line in `--m-line-strong`.
- Annotate the chart with a hand note instead of a legend wherever possible.
- Fan charts (Monte Carlo over time): the median in ink, the 50% band in `--m-wash`, the 90% band in a lighter wash; no colour.

## 16. Checklist before you ship a screen

- [ ] Every number traces to the engine (no typed numbers), in mono, with the right sign.
- [ ] At most one blue thing that isn't a button, and at most two hand notes.
- [ ] Brackets only around computed values (and the one hero phrase).
- [ ] No gradients, glows, tilts, emoji icons or app-icon squares.
- [ ] Headlines in Google Sans Flex, body in Geist, notes in Shantell, nothing else.
- [ ] Works at 375px wide with a 20px gutter; reduced motion still shows the answers.
- [ ] Looks right on `/brand` next to the specimens.
