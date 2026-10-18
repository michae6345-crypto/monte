// A single screen that answers "what do my cards actually cost me" for every kind of
// wallet at once. Server-rendered straight from the engine: no client state, no store,
// so nothing here can affect the main demo path.

import Link from "next/link";
import { PERSONAS, yearOf } from "@/lib/data/personas";
import { receipt, marginalValue, setValuation, type Holding, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { monteCarlo } from "@/lib/engine/montecarlo";

export const metadata = { title: "Monte: the dashboard" };

const usd = (n: number, cents = false) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;

type Row = {
  id: string;
  name: string;
  blurb: string;
  cards: number;
  spend: number;
  net: number;
  rewards: number;
  credits: number;
  fees: number;
  interest: number;
  leftOnTable: number;
  carriesBalance: boolean;
  worstCard: { name: string; net: number } | null;
  nextMove: string;
};

function build(): Row[] {
  return PERSONAS.map((p) => {
    // Maya is the one person the site values at travel; everyone else at cash.
    setValuation(p.id === "maya" ? "travel" : "cash");
    const txns: Txn[] = yearOf(p);
    const r = receipt(p.wallet, txns);
    const carriesBalance = p.wallet.some((h: Holding) => (h.balance ?? 0) > 0);

    // The card that costs more than it returns, if there is one.
    let worstCard: Row["worstCard"] = null;
    for (const h of p.wallet) {
      const m = marginalValue(p.wallet, txns, h.cardId);
      if (m.net < 0 && (!worstCard || m.net < worstCard.net)) worstCard = { name: card(h.cardId).name, net: m.net };
    }

    // What to do next. While a balance stands the engine refuses to suggest a card.
    let nextMove: string;
    if (carriesBalance) {
      const owed = p.wallet.reduce((a, h) => a + (h.balance ?? 0), 0);
      nextMove = `Clear ${usd(owed)} first — no new card while a balance stands`;
    } else {
      const mc = monteCarlo(p.wallet, txns);
      const best = mc.options.find((o) => o.id.startsWith("add:"));
      nextMove = best
        ? `${best.label} · ${usd(best.mean - mc.current.mean)}/yr in 1,000 simulated years`
        : "Wallet is already the best play";
    }

    setValuation("cash");
    return {
      id: p.id,
      name: p.name,
      blurb: p.blurb,
      cards: p.wallet.length,
      spend: r.spend,
      net: r.net,
      rewards: r.rewards,
      credits: r.credits,
      fees: r.fees,
      interest: r.interest,
      leftOnTable: r.leftOnTable,
      carriesBalance,
      worstCard,
      nextMove,
    };
  });
}

export default function Dashboard() {
  const rows = build();
  const losing = rows.filter((r) => r.net < 0);
  const totalInterest = rows.reduce((a, r) => a + r.interest, 0);
  const totalLeft = rows.reduce((a, r) => a + r.leftOnTable, 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <header className="mb-10">
        <Link href="/" className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)] hover:text-[var(--ace-ink)]">
          ← back to the walkthrough
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">The dashboard</h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--ace-dim)]">
          Every kind of wallet on one screen. Each number is the engine on that person&apos;s real year of
          purchases and the card companies&apos; published terms.
        </p>
      </header>

      {/* the three facts the whole product exists for */}
      <section className="mb-10 grid gap-px overflow-hidden rounded-[14px] bg-[var(--ace-line)] sm:grid-cols-3">
        {[
          { k: "Paying to hold their cards", v: `${losing.length} of ${rows.length}`, s: "net negative over the year" },
          { k: "Interest paid", v: usd(totalInterest), s: "across these wallets, in one year" },
          { k: "Left on the table", v: usd(totalLeft), s: "same purchases, wrong card" },
        ].map((c) => (
          <div key={c.k} className="bg-[var(--ace-panel)] p-5">
            <div className="mono text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">{c.k}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{c.v}</div>
            <div className="mt-1 text-sm text-[var(--ace-dim)]">{c.s}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {rows.map((r) => (
          <article key={r.id} className="rounded-[14px] border border-[var(--ace-line)] bg-[var(--ace-panel)] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{r.name}</h2>
                <p className="text-sm text-[var(--ace-dim)]">{r.blurb}</p>
              </div>
              <div className="text-right">
                <div
                  className="text-3xl font-semibold tabular-nums"
                  style={{ color: r.net < 0 ? "var(--ace-loss)" : "var(--ace-gain)" }}
                >
                  {usd(r.net, true)}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-[var(--ace-dim)]">net, one year</div>
              </div>
            </div>

            {/* the arithmetic, in the open */}
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              {[
                ["Rewards", usd(r.rewards, true)],
                ["Perks used", usd(r.credits, true)],
                ["Annual fees", `−${usd(r.fees, true).replace("−", "")}`],
                ["Interest", `−${usd(r.interest, true).replace("−", "")}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="mono text-[10px] uppercase tracking-wider text-[var(--ace-dim)]">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 space-y-2 border-t border-[var(--ace-line)] pt-4 text-sm">
              <p>
                <span className="text-[var(--ace-dim)]">Spent </span>
                <span className="tabular-nums">{usd(r.spend)}</span>
                <span className="text-[var(--ace-dim)]"> on {r.cards} card{r.cards === 1 ? "" : "s"} · left </span>
                <span className="tabular-nums">{usd(r.leftOnTable, true)}</span>
                <span className="text-[var(--ace-dim)]"> on the table</span>
              </p>
              {r.worstCard && (
                <p className="text-[var(--ace-dim)]">
                  {r.worstCard.name} costs {usd(Math.abs(r.worstCard.net), true)} more than it returns
                </p>
              )}
              <p className="font-medium">{r.nextMove}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="mono mt-10 text-[11px] uppercase tracking-wider text-[var(--ace-dim)]">
        Card terms checked 17 Oct 2026 · Demo people are synthetic · Not financial advice
      </p>
    </main>
  );
}
