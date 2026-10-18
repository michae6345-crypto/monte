// How Monte works under the hood: the engine, the backend and the tap. A separate,
// server-rendered page so it cannot affect the main walkthrough. The receipt figures are
// computed by the engine at build time, not typed in.

import Link from "next/link";
import { JORDAN, yearOf } from "@/lib/data/personas";
import { receipt } from "@/lib/engine";

export const metadata = { title: "Monte: the engine" };

const usd = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STEPS: { n: string; when: string; title: string; body: string; stat: string }[] = [
  {
    n: "01",
    when: "Once, when you connect",
    title: "Sync learns how you spend",
    body: "Monte reads your purchase history once. A small language model cleans messy bank strings into a real merchant and category. The engine then works out how much of every card's bonus limit you have already used this month, quarter and year, and stores those counters in your account.",
    stat: "one pass over your history",
  },
  {
    n: "02",
    when: "Every time you tap",
    title: "The tap reads, it doesn't recompute",
    body: "At the register Monte reads the stored counters, prices the purchase on every card you hold against its published terms, removes any card carrying a balance, and picks the winner. It never replays your history, so it stays fast however long you have been a customer.",
    stat: "about 3 microseconds per tap",
  },
  {
    n: "03",
    when: "Looking back",
    title: "The receipt",
    body: "Rewards plus the perks you actually used, minus annual fees, minus interest. Every line traces to the rule that produced it, the issuer page it came from and the date it was checked.",
    stat: "29 cards, sources checked 17 Oct 2026",
  },
  {
    n: "04",
    when: "Looking forward",
    title: "1,000 next years",
    body: "Monte rebuilds a thousand plausible years out of your own months and replays the whole engine on each one, so spending limits reset where they really would. You get odds, not a single guess.",
    stat: "about 58 ms for 1,000 years",
  },
];

const FACTS: [string, string][] = [
  ["No model prices anything", "Every dollar is arithmetic on published card terms. A model only labels merchants, where a mistake costs a category, never a dollar."],
  ["Same answer, much faster", "The stored-counter tap picks the same card with the same reward, to the cent, as a full replay of the year, several hundred times faster."],
  ["Greedy, then proved", "A whole-year linear program checks the purchase-by-purchase picks. On our wallets the gap is $0.00: the fast method is provably optimal there."],
  ["Never routes into debt", "A card carrying a balance is never chosen and no new card is suggested while one is carried. That rule lives in the engine, not the copy."],
];

const PRIVACY: [string, string][] = [
  ["No card numbers", "Monte stores which card it is, its balance and APR. Never a card number or a CVV."],
  ["Your rows only", "Every table is locked to its owner by row-level security in the database itself."],
  ["Tokens out of reach", "The bank-link token sits in a cookie scripts on the page can't read."],
  ["Statements stay local", "An uploaded statement is parsed in your browser."],
];

export default function Engine() {
  const r = receipt(JORDAN.wallet, yearOf(JORDAN));
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="mb-12">
        <Link href="/" className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)] hover:text-[var(--ace-ink)]">
          ← back to the walkthrough
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">The engine</h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--ace-dim)]">
          Connect once. Monte learns how you spend, keeps count of every card&apos;s bonus limits, and picks the
          right card the moment you tap.
        </p>
      </header>

      <section className="mb-14 grid gap-5 md:grid-cols-2">
        {STEPS.map((s) => (
          <article key={s.n} className="rounded-[14px] border border-[var(--ace-line)] bg-[var(--ace-panel)] p-6">
            <div className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">
              {s.n} · {s.when}
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{s.title}</h2>
            <p className="mt-3 text-[var(--ace-dim)]">{s.body}</p>
            <p className="mono mt-4 text-sm font-medium">{s.stat}</p>
          </article>
        ))}
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-semibold">At the register</h2>
        <p className="mt-2 max-w-2xl text-[var(--ace-dim)]">How one Monte card in your phone becomes the right card underneath.</p>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-[14px] bg-[var(--ace-line)] md:grid-cols-4">
          {[
            ["Tap", "You pay with the Monte card in your phone's wallet."],
            ["Ask", "The network asks Monte to approve, with the store and the amount."],
            ["Pick", "Monte reads your stored counters and ranks every card you hold."],
            ["Pay", "The best card pays. You earn its reward, not Monte's."],
          ].map(([t, d], i) => (
            <li key={t} className="bg-[var(--ace-panel)] p-5">
              <div className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">step {i + 1}</div>
              <div className="mt-1 text-lg font-semibold">{t}</div>
              <p className="mt-1 text-sm text-[var(--ace-dim)]">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mono mt-3 text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">
          Design for the phone app. The web demo runs the same engine; the in-wallet card is the next step.
        </p>
      </section>

      <section className="mb-14 rounded-[14px] border border-[var(--ace-line)] bg-[var(--ace-panel)] p-6">
        <div className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">Computed by the engine, not typed in</div>
        <h2 className="mt-2 text-2xl font-semibold">Jordan&apos;s year</h2>
        <p className="mt-3 text-lg tabular-nums">
          {usd(r.rewards)} rewards + {usd(r.credits)} perks − {usd(r.fees).replace("−", "")} fees −{" "}
          {usd(r.interest).replace("−", "")} interest ={" "}
          <span className="font-semibold" style={{ color: "var(--ace-loss)" }}>
            {usd(r.net)}
          </span>
        </p>
        <p className="mt-2 text-[var(--ace-dim)]">
          Across {yearOf(JORDAN).length} purchases, {usd(r.leftOnTable)} was left on the table by tapping the wrong card.
        </p>
      </section>

      <section className="mb-14 grid gap-5 md:grid-cols-2">
        {FACTS.map(([t, d]) => (
          <div key={t}>
            <h3 className="text-lg font-semibold">{t}</h3>
            <p className="mt-1 text-[var(--ace-dim)]">{d}</p>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold">What we keep</h2>
        <div className="mt-5 grid gap-px overflow-hidden rounded-[14px] bg-[var(--ace-line)] sm:grid-cols-2">
          {PRIVACY.map(([t, d]) => (
            <div key={t} className="bg-[var(--ace-panel)] p-5">
              <div className="font-semibold">{t}</div>
              <p className="mt-1 text-sm text-[var(--ace-dim)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">
        Built on Next.js, Postgres with row-level security, and Claude Haiku for merchant cleanup only · Demo people are
        synthetic · <Link href="/dashboard" className="underline">every wallet at once →</Link>
      </p>
    </main>
  );
}
