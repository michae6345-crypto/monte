"use client";

// /developers: Monte's API for apps that already hold their users' cards. The reference, code to
// copy, and a live console that calls the real endpoint.

import { useState } from "react";
import Link from "next/link";
import { Lockup } from "@/components/brand";

const SAMPLE = {
  wallet: [
    { cardId: "amex_gold" },
    { cardId: "chase_freedom_unlimited", balance: 1200, apr: 27.99 },
    { cardId: "citi_double_cash" },
  ],
  domain: "www.doordash.com",
  amount: 42,
};

const CURL = `curl -X POST https://ace-eta-beryl.vercel.app/api/best \\
  -H "content-type: application/json" \\
  -d '{"wallet":[{"cardId":"amex_gold"},{"cardId":"chase_freedom_unlimited","balance":1200,"apr":27.99}],
       "merchant":"Trader Joe\\'s","amount":64.20}'`;

const FETCH = `const res = await fetch("https://ace-eta-beryl.vercel.app/api/best", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    wallet: user.cards.map((c) => ({ cardId: c.monteId, balance: c.revolving, apr: c.apr })),
    domain: location.hostname,   // or merchant: "Trader Joe's", or category: "groceries"
    amount: cart.total,
  }),
});
const { pick, why, perks } = await res.json();
show(\`Pay with \${pick.name}: \${why}\`);`;

const REQUEST: [string, string, string][] = [
  ["wallet", "array, 1 to 25", "The user's cards: { cardId, balance?, apr? }. cardId from GET /api/cards. balance is what revolves (not this month's purchases); apr in percent."],
  ["domain", "string", "A website (\"www.costco.com\"): Monte finds the store and its category, with online acceptance rules."],
  ["merchant", "string", "A store name (\"Trader Joe's\"), placed by the same rules Plaid transactions go through."],
  ["category", "string", "Or the category directly: groceries, dining, gas, online_retail, rideshare, ... (one of the three is required)."],
  ["amount", "number", "Dollars. Default 50. Caps and interest scale with it."],
];

const RESPONSE: [string, string][] = [
  ["place", "{ name, category, via, label }: what the store codes as, and how sure (rule, known, words, map)."],
  ["pick", "The card to use: { cardId, name, mult, rule, reward, interest, net, apr, carries }."],
  ["ranked", "Every card, the pick first; cards skipped for a balance last."],
  ["mode", "none: no balances. grace: some cards carry one and are skipped. all: every card does, so the cheapest net wins."],
  ["skipped", "The higher earner that was skipped for its balance, with what it would have cost, or null."],
  ["why", "One sentence to show the user."],
  ["perks", "Credits one of the cards has at this store (Uber Cash...): use them first."],
];

export function DevDocs() {
  const [body, setBody] = useState(JSON.stringify(SAMPLE, null, 2));
  const [out, setOut] = useState<{ status: number; ms: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/best", { method: "POST", headers: { "content-type": "application/json" }, body });
      const json = await res.json();
      setOut({ status: res.status, ms: performance.now() - t0, text: JSON.stringify(json, null, 2) });
    } catch (e) {
      setOut({ status: 0, ms: performance.now() - t0, text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Monte home">
          <Lockup size={20} state="resolved" />
        </Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/app" className="btn btn-ghost btn-sm">
            The app
          </Link>
          <Link href="/card" className="btn btn-ghost btn-sm">
            The card
          </Link>
        </nav>
      </header>

      <section className="py-8">
        <p className="m-label">monte for developers · beta</p>
        <h1 className="mt-3 text-[2.4rem] leading-[1.05] md:text-[3.2rem]" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500, letterSpacing: "-0.035em" }}>
          The right card,
          <span className="block text-ace-dim">in one API call.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ace-dim">
          For apps that already hold their users&apos; cards: budgeting apps, neobanks, credit unions, wallets. Send the cards, the store and the amount; get back the card to use and a sentence saying why. It counts each card&apos;s caps, rotating categories and credits, and the interest a purchase adds on a card that carries a balance. Every rule traces to the issuer&apos;s published terms.
        </p>
        <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
          <li className="m-panel p-3">
            <b>Stateless.</b> Nothing is stored or logged; no names, account numbers or purchases needed.
          </li>
          <li className="m-panel p-3">
            <b>Fast.</b> A few milliseconds of work per call; open CORS, so it works from a browser.
          </li>
          <li className="m-panel p-3">
            <b>Free in beta.</b> No key yet. Write to us before you ship to many users.
          </li>
        </ul>
      </section>

      <section className="m-panel overflow-hidden">
        <div className="border-b border-[var(--m-line)] p-5">
          <p className="mono text-sm">
            <span className="rounded bg-ace-ink px-1.5 py-0.5 text-[11px] text-ace-bg">POST</span> /api/best
          </p>
          <p className="mt-2 text-sm text-ace-dim">Which card to use for this purchase.</p>
        </div>
        <div className="grid gap-px bg-[var(--m-line)] md:grid-cols-2">
          <div className="bg-ace-panel p-5">
            <p className="m-label mb-2">request body</p>
            <dl className="space-y-2.5 text-sm">
              {REQUEST.map(([k, t, d]) => (
                <div key={k}>
                  <dt>
                    <code className="mono text-[13px]">{k}</code> <span className="mono text-[11px] text-ace-dim">{t}</span>
                  </dt>
                  <dd className="text-ace-dim">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-ace-panel p-5">
            <p className="m-label mb-2">response</p>
            <dl className="space-y-2.5 text-sm">
              {RESPONSE.map(([k, d]) => (
                <div key={k}>
                  <dt>
                    <code className="mono text-[13px]">{k}</code>
                  </dt>
                  <dd className="text-ace-dim">{d}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ace-dim">Errors: 400 with {"{ error, message }"} for a bad body; never a 500 for bad input.</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Code title="curl" code={CURL} />
        <Code title="In your app" code={FETCH} />
      </section>

      <section className="m-panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--m-line)] p-5">
          <div>
            <p className="font-medium">Try it</p>
            <p className="text-xs text-ace-dim">Edit the body and send it to the live endpoint.</p>
          </div>
          <button type="button" onClick={send} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="grid gap-px bg-[var(--m-line)] md:grid-cols-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            aria-label="Request body"
            className="mono min-h-72 w-full resize-y bg-ace-panel p-4 text-[12px] leading-relaxed outline-none"
          />
          <div className="min-w-0 bg-ace-panel p-4">
            {out ? (
              <>
                <p className="mono mb-2 text-[11px] text-ace-dim">
                  HTTP {out.status} · {out.ms.toFixed(0)} ms round trip
                </p>
                <pre className="mono max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">{out.text}</pre>
              </>
            ) : (
              <p className="text-sm text-ace-dim">The response shows here.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            Card ids
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ace-dim">
            <code className="mono">GET /api/cards</code> lists the {`catalog's`} cards with their id, name, issuer, network, annual fee, and the issuer page each rule came from. Map your users&apos; cards to these ids once.
          </p>
        </div>
        <div>
          <h2 className="text-xl" style={{ fontFamily: "var(--m-font-display)", fontWeight: 500 }}>
            Issuing a card?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ace-dim">
            If you run a card program on Lithic or Stripe Issuing, point its real-time authorization at <code className="mono">/api/card/authorize</code> or <code className="mono">/api/card/stripe</code>: Monte reads the network&apos;s merchant code and answers in the platform&apos;s format.{" "}
            <Link href="/card" className="underline underline-offset-4">
              See it work
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

function Code({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="m-panel-ink overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] text-white/70">
        <span className="mono">{title}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })}
          className="mono text-white/70 hover:text-white"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="mono overflow-x-auto p-4 text-[11.5px] leading-relaxed text-white">{code}</pre>
    </div>
  );
}
