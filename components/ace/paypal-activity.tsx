"use client";

// PayPal activity: every purchase paid through PayPal this session, with the card Monte
// picked, what it earned, the cap after it and whether it was returned. Plus, on request,
// the sandbox account's history from PayPal Transaction Search in the same table.
//
// Read-only on the store. The store lowers or removes a purchase when it's refunded, so the
// first amount seen for each purchase is kept here to tell what was returned. Every dollar
// comes from planCheckout()/evaluate(), the same engine path the checkout panel uses.

import { useMemo, useState } from "react";
import { Sampler } from "@/components/brand";
import { chooseOptions, evaluate, setValuation, type Txn } from "@/lib/engine";
import { card } from "@/lib/engine/catalog";
import { capMoveLine, DEMO_TAP_DATE, planAtValuation, usd } from "@/lib/paypal/plan";
import { activityCsv } from "@/lib/paypal/csv";
import { loadPayPalPurchases, PayPalImportError } from "@/lib/paypal/transactions-feed";
import { shortName } from "./card-art";
import { useAce } from "./store";

type Row = {
  id: string;
  source: "session" | "paypal";
  date: string;
  merchant: string;
  amount: number;
  cardId: string;
  reward: number;
  /** Reward still standing after any refund. */
  rewardKept: number;
  cap: string;
  refunded: number;
  refund: string;
};

type Load = { k: "idle" } | { k: "loading" } | { k: "done"; txns: Txn[] } | { k: "error"; code: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

function safeName(id: string) {
  try {
    return shortName(id);
  } catch {
    return id;
  }
}

export function PayPalActivity() {
  const { txns, wallet, valuation, checkoutTxns } = useAce();
  const [load, setLoad] = useState<Load>({ k: "idle" });

  // First amount seen per purchase: the store only keeps what's left after a refund.
  // Updated during render (React's "state from previous renders" pattern), never in an effect.
  const [seen, setSeen] = useState<Txn[]>([]);
  const unseen = checkoutTxns.filter((t) => !seen.some((s) => s.id === t.id));
  if (unseen.length) setSeen([...seen, ...unseen]);

  const sessionRows = useMemo<Row[]>(() => {
    const now = new Map(checkoutTxns.map((t) => [t.id, t]));
    const base = txns.filter((t) => t.date.startsWith(DEMO_TAP_DATE.slice(0, 4)) && t.date <= DEMO_TAP_DATE);
    const before: Txn[] = [];
    const rows: Row[] = [];
    for (const t of seen) {
      const left = now.get(t.id)?.amount ?? 0;
      const refunded = round2(t.amount - left);
      let reward = 0;
      let rewardKept = 0;
      let cap = "—";
      try {
        const purchase = { merchant: t.merchant, category: t.category, amount: t.amount, date: t.date };
        const plan = planAtValuation(valuation, wallet, purchase, [...base, ...before]);
        const mine = plan.ranked.find((r) => r.cardId === t.cardUsed);
        reward = mine?.reward ?? 0;
        if (plan.pick?.cardId === t.cardUsed) cap = plan.capRoom ? capMoveLine(plan.capRoom) : "No cap on this rule";
        rewardKept = left > 0 ? round2((reward * left) / t.amount) : 0;
      } catch {
        // an amount the planner can't price: show the purchase without a reward
      }
      rows.push({
        id: t.id,
        source: "session",
        date: t.date,
        merchant: t.merchant,
        amount: t.amount,
        cardId: t.cardUsed,
        reward,
        rewardKept,
        cap,
        refunded,
        refund: left <= 0 ? "Refunded in full" : refunded > 0.004 ? `Partly refunded (${usd(refunded)})` : "Not refunded",
      });
      if (left > 0) before.push({ ...t, amount: left });
    }
    return rows;
  }, [seen, checkoutTxns, txns, wallet, valuation]);

  const importedRows = useMemo<Row[]>(() => {
    if (load.k !== "done") return [];
    setValuation(valuation);
    try {
      return load.txns.map((t) => {
        let reward = 0;
        try {
          reward = evaluate(card(t.cardUsed), t, new Map(), chooseOptions(t.cardUsed, [])).reward;
        } catch {
          // a card the catalog doesn't know: no reward to show
        }
        return {
          id: t.id,
          source: "paypal" as const,
          date: t.date,
          merchant: t.merchant,
          amount: t.amount,
          cardId: t.cardUsed,
          reward,
          rewardKept: reward,
          cap: "—",
          refunded: 0,
          refund: "—",
        };
      });
    } finally {
      setValuation("cash");
    }
  }, [load, valuation]);

  const rows = [...sessionRows, ...importedRows];
  const totals = rows.reduce(
    (a, r) => ({ spent: a.spent + r.amount, rewards: a.rewards + r.rewardKept, refunded: a.refunded + r.refunded }),
    { spent: 0, rewards: 0, refunded: 0 },
  );

  /** The table as it stands, as a CSV file the browser saves. Built from the same rows. */
  const downloadCsv = () => {
    const csv = activityCsv(rows.map((r) => ({ ...r, card: safeName(r.cardId) })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `monte-paypal-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const loadHistory = async () => {
    setLoad({ k: "loading" });
    try {
      const feed = await loadPayPalPurchases({ months: 12 });
      setLoad({ k: "done", txns: feed.txns });
    } catch (e) {
      setLoad({ k: "error", code: e instanceof PayPalImportError ? e.code : "paypal_import_failed" });
    }
  };

  return (
    <section aria-labelledby="paypal-activity-title" className="m-panel mt-8 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 id="paypal-activity-title" className="text-lg font-medium">
            PayPal activity
          </h3>
          <p className="text-sm text-ace-dim">Every purchase paid through PayPal this session, and the card Monte played on it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadHistory} disabled={load.k === "loading"} aria-busy={load.k === "loading"} className="btn btn-ghost btn-sm h-10">
            {load.k === "loading" ? "Loading PayPal history…" : load.k === "done" ? "Reload PayPal history" : "Load PayPal history"}
          </button>
          {rows.length > 0 && (
            <button type="button" onClick={downloadCsv} aria-label="Download PayPal activity as CSV" className="btn btn-ghost btn-sm h-10">
              Download CSV
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 min-h-5 text-xs text-ace-dim">
        {load.k === "loading" && <Sampler label="Reading PayPal sandbox" />}
        {load.k === "error" && (
          <span role="alert">
            {load.code === "paypal_not_configured" ? "PayPal sandbox isn't connected on this deployment." : "PayPal didn't answer. Try again in a moment."}
          </span>
        )}
        <span role="status" className="tabular-nums">
          {load.k === "done" &&
          (load.txns.length
            ? `${load.txns.length} purchase${load.txns.length === 1 ? "" : "s"} from PayPal Transaction Search (sandbox), last 12 months.`
              : "PayPal Transaction Search (sandbox) has no purchases in the last 12 months.")}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ace-dim">No PayPal purchases yet. Pay for one at the register in the walkthrough, or load the sandbox history.</p>
      ) : (
        // scrolls inside its own box on a phone; focusable so keyboard users can scroll it too
        <div className="mt-4 overflow-x-auto overscroll-x-contain rounded-[6px] outline-none focus-visible:shadow-[0_0_0_1.5px_var(--m-accent)]" role="region" aria-labelledby="paypal-activity-title" tabIndex={0}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              PayPal purchases: this session&apos;s checkouts and any history loaded from PayPal Transaction Search (sandbox)
            </caption>
            <thead>
              <tr className="mono border-b border-ace-line text-[11px] uppercase tracking-wider text-ace-dim">
                <th scope="col" className="py-2 pr-3 font-normal">Merchant</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Amount</th>
                <th scope="col" className="py-2 pr-3 font-normal">Card</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Reward</th>
                <th scope="col" className="py-2 pr-3 font-normal">Cap after</th>
                <th scope="col" className="py-2 font-normal">Refund</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.source}:${r.id}`} className="border-b border-ace-line align-top">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {r.merchant}
                    <div className="mono text-[11px] tabular-nums text-ace-dim">
                      {r.date} · {r.source === "session" ? "Monte checkout, this session" : "from PayPal Transaction Search (sandbox)"}
                    </div>
                  </th>
                  <td className="mono py-2 pr-3 text-right tabular-nums">{usd(r.amount)}</td>
                  <td className="py-2 pr-3">
                    {safeName(r.cardId)}
                    {r.source === "paypal" && <div className="text-[11px] text-ace-dim">funding card (PayPal doesn&apos;t say which)</div>}
                  </td>
                  <td className="mono py-2 pr-3 text-right tabular-nums text-ace-gain">+{usd(r.reward)}</td>
                  <td className="mono py-2 pr-3 text-xs tabular-nums text-ace-dim">{r.cap}</td>
                  <td className={`py-2 text-xs tabular-nums ${r.refunded > 0 ? "text-ace-loss" : "text-ace-dim"}`}>{r.refund}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <th scope="row" className="py-2 pr-3 text-left">Totals</th>
                <td className="mono py-2 pr-3 text-right tabular-nums">
                  {usd(totals.spent)}
                  <div className="text-[11px] font-normal text-ace-dim">spent through PayPal</div>
                </td>
                <td className="py-2 pr-3" />
                <td className="mono py-2 pr-3 text-right tabular-nums text-ace-gain">
                  +{usd(totals.rewards)}
                  <div className="text-[11px] font-normal text-ace-dim">rewards kept</div>
                </td>
                <td className="py-2 pr-3" />
                <td className="mono py-2 tabular-nums text-ace-loss">
                  {usd(totals.refunded)}
                  <div className="text-[11px] font-normal text-ace-dim">refunded</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
