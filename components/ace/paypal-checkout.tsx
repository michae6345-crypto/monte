"use client";

// Pay for the purchase the Tap view just ranked, or type one to the checkout agent. Every
// number here is the engine's (lib/paypal/plan.ts). Nothing is charged until the person
// approves it in PayPal's window. Sandbox only.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Holding, Txn, Valuation } from "@/lib/engine";
import { capMoveLine, capRoomLine, orderValue, planCheckout, usd, type CheckoutPlan, type Purchase } from "@/lib/paypal/plan";
import { shortName } from "./card-art";

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
const EXAMPLE = "I'm spending $84 on groceries at Trader Joe's.";

// ---------- PayPal's JS SDK v6 ----------

type OrderHandle = { orderId: string };
type PayPalSession = { start(options: { presentationMode: "auto" }, order: Promise<OrderHandle>): Promise<void> };
type PayPalSdk = {
  findEligibleMethods(options: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(callbacks: {
    onApprove(data: OrderHandle): Promise<void> | void;
    onCancel(): void;
    onError(error: { code?: string; message?: string }): void;
  }): PayPalSession;
};
declare global {
  interface Window {
    paypal?: { createInstance(options: { clientId: string; components: string[]; pageType: string }): Promise<PayPalSdk> };
  }
}

let sdk: Promise<PayPalSdk | null> | null = null;

function loadSdk(): Promise<PayPalSdk | null> {
  sdk ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal's script didn't load"));
    document.head.appendChild(script);
  })
    .then(() => window.paypal!.createInstance({ clientId: CLIENT_ID, components: ["paypal-payments"], pageType: "checkout" }))
    .catch((e: Error) => {
      console.warn("paypal:", e.message);
      sdk = null; // a later mount can try again
      return null;
    });
  return sdk;
}

/** PayPal's own button. `order` runs on the click, so the window opens from the person's tap. */
function PayPalButton({ order, onApproved, onProblem }: { order: () => Promise<OrderHandle>; onApproved: (orderId: string) => Promise<void>; onProblem: (word: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ order, onApproved, onProblem });
  useEffect(() => {
    latest.current = { order, onApproved, onProblem };
  });
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let live = true;
    const slot = host.current;
    void loadSdk().then(async (paypal) => {
      if (!live || !slot) return;
      if (!paypal) return setState("unavailable");
      const eligible = await paypal.findEligibleMethods({ currencyCode: "USD" }).then(
        (m) => m.isEligible("paypal"),
        () => true, // can't tell: offer it, and let PayPal say no
      );
      if (!live) return;
      if (!eligible) return setState("unavailable");
      const session = paypal.createPayPalOneTimePaymentSession({
        onApprove: (data) => latest.current.onApproved(data.orderId),
        onCancel: () => latest.current.onProblem("cancelled"),
        onError: (e) => latest.current.onProblem(e.code === "ERR_DEV_UNABLE_TO_OPEN_POPUP" ? "popup_blocked" : e.message || "paypal_error"),
      });
      const button = document.createElement("paypal-button");
      button.setAttribute("type", "pay");
      button.className = "paypal-gold";
      button.addEventListener("click", () => {
        session.start({ presentationMode: "auto" }, latest.current.order()).catch((e: Error) => latest.current.onProblem(e.message));
      });
      slot.replaceChildren(button);
      setState("ready");
    });
    return () => {
      live = false;
      slot?.replaceChildren();
    };
  }, []);

  return (
    <>
      <div ref={host} className="max-w-[320px]" />
      {state === "unavailable" && <p className="mt-2 text-sm text-ace-dim">PayPal&apos;s button didn&apos;t load here. Check that the sandbox client ID is right.</p>}
    </>
  );
}

// ---------- paying ----------

const WORDS: Record<string, string> = {
  cancelled: "Checkout cancelled. Nothing was charged.",
  popup_blocked: "Your browser blocked PayPal's window. Allow pop-ups for this site and try again.",
  paypal_not_configured: "PayPal isn't connected on this deployment.",
  agent_not_configured: "The assistant isn't connected on this deployment.",
  agent_busy: "The assistant is busy. Try again in a minute.",
  already_captured: "That order was already paid.",
  not_approved: "PayPal hasn't approved that order yet.",
  instrument_declined: "PayPal declined that card. Nothing was charged.",
  not_completed: "PayPal didn't complete the payment, so no cap was updated.",
  no_card_without_balance: "Every card here carries a balance, so Monte won't recommend one.",
};
const say = (code: string) => WORDS[code] ?? "PayPal hit a problem. Nothing was charged. Try again.";

type Receipt = { merchant: string; value: string; captureId: string; card: string; reward: number; cap: string; store: string };

/** Capture an approved order, write the receipt line and hand the purchase to the Tap view. */
function useCapture(onPaid: (t: Txn) => void) {
  const [note, setNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const capture = async (orderId: string, plan: CheckoutPlan) => {
    setNote("Capturing the payment…");
    try {
      const res = await fetch("/api/paypal/capture-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await res.json();
      if (!res.ok) return setNote(say(data.error));
      setNote(null);
      setReceipt({
        merchant: data.txn.merchant,
        value: data.value,
        captureId: data.captureId,
        card: shortName(data.txn.cardUsed),
        reward: plan.pick?.reward ?? 0,
        cap: plan.capRoom ? `Cap room ${capMoveLine(plan.capRoom)}` : "No cap on this rule",
        store: data.cap.store,
      });
      onPaid(data.txn as Txn);
    } catch {
      setNote(say("paypal_error"));
    }
  };
  return { note, setNote, receipt, setReceipt, capture };
}

function ReceiptLine({ r }: { r: Receipt }) {
  return (
    <div className="mt-4 border-t border-dashed border-ace-line pt-3 text-sm" role="status">
      <div className="font-medium">
        Paid {usd(Number(r.value))} at {r.merchant}
      </div>
      <div className="mono mt-1 text-xs">
        {r.card} <span className="text-ace-gain">+{usd(r.reward)}</span> · {r.cap}
      </div>
      <div className="mono mt-1 text-[11px] text-ace-dim">
        PayPal sandbox capture {r.captureId} · counted on the card Monte picked · cap saved {r.store === "supabase" ? "to your account" : "for this demo session"}
      </div>
    </div>
  );
}

function Recommendation({ plan }: { plan: CheckoutPlan }) {
  const { pick, capRoom, orderValue: value, ranked } = plan;
  const blocked = ranked.filter((r) => r.blocked);
  if (!pick) return <p className="text-sm leading-relaxed">{say("no_card_without_balance")} Pay the balance down first.</p>;
  let host = "";
  try {
    host = pick.sourceUrl ? new URL(pick.sourceUrl).hostname.replace(/^www\./, "") : "";
  } catch {}
  return (
    <div>
      <div className="m-label">In your PayPal wallet, choose</div>
      <div className="mt-1 text-xl font-medium">{shortName(pick.cardId)}</div>
      <div className="mono mt-2 text-sm">
        <span className="text-ace-gain">+{usd(pick.reward)}</span> on this {usd(Number(value))} · {pick.rule}
      </div>
      <div className="mono mt-1 text-sm text-ace-dim">{capRoom ? capRoomLine(capRoom) : "No spending cap on this rule"}</div>
      {blocked.map((b) => (
        <p key={b.cardId} className="mt-2 text-sm leading-relaxed text-ace-dim">
          Not {shortName(b.cardId)}: {b.blocked}
        </p>
      ))}
      <p className="mono mt-3 text-[11px] leading-relaxed text-ace-dim">
        {pick.math}
        {pick.sourceUrl ? (
          <>
            {" · "}
            <a className="underline" href={pick.sourceUrl} target="_blank" rel="noreferrer">
              {host}
            </a>
          </>
        ) : null}
        {pick.checked ? ` · checked ${pick.checked}` : ""}
        {pick.unverified ? " · UNVERIFIED" : ""}
      </p>
    </div>
  );
}

// ---------- the section ----------

type Props = {
  purchase: Purchase;
  wallet: Holding[];
  history: Txn[];
  valuation: Valuation;
  stores: string[];
  selected: number;
  onSelect: (k: number) => void;
  onPaid: (t: Txn) => void;
};

export function PayPalCheckout({ purchase, wallet, history, valuation, stores, selected, onSelect, onPaid }: Props) {
  const context = useMemo(() => ({ wallet: wallet.map(({ cardId, balance, apr }) => ({ cardId, balance, apr })), history, date: purchase.date, valuation }), [wallet, history, purchase.date, valuation]);
  const plan = useMemo(
    () => (orderValue(purchase.amount) ? planCheckout(wallet, purchase, history) : null),
    // valuation is read inside the engine, so a change has to re-run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, purchase, history, valuation],
  );
  const { note, setNote, receipt, setReceipt, capture } = useCapture(onPaid);
  const orders = useRef(new Map<string, CheckoutPlan>());

  const order = async (): Promise<OrderHandle> => {
    setNote(null);
    setReceipt(null);
    const { merchant, category, amount } = purchase;
    const res = await fetch("/api/paypal/create-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purchase: { merchant, category, amount }, ...context }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "paypal_error");
    orders.current.set(data.id, data.plan);
    return { orderId: data.id };
  };

  return (
    // never id="paypal": an element's id lands on window and shadows PayPal's window.paypal
    <div id="checkout" className="mt-8 grid scroll-mt-20 gap-4 lg:grid-cols-2">
      <div className="m-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="m-label">Pay with PayPal</div>
          <Badge />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-ace-dim">At</span>
          <select value={selected} onChange={(e) => onSelect(Number(e.target.value))} className="h-9 rounded-[10px] bg-ace-panel px-2 font-medium shadow-[0_0_0_1px_var(--m-line)]">
            {stores.map((s, k) => (
              <option key={s} value={k}>
                {s}
              </option>
            ))}
          </select>
          {plan && <span className="mono">{usd(Number(plan.orderValue))}</span>}
        </label>
        <div className="mt-4">{plan ? <Recommendation plan={plan} /> : <p className="text-sm text-ace-dim">PayPal can&apos;t take this amount.</p>}</div>
        {plan?.pick &&
          (CLIENT_ID ? (
            <div className="mt-4">
              <PayPalButton
                order={order}
                onApproved={(id) => capture(id, orders.current.get(id) ?? plan)}
                onProblem={(w) => setNote(say(w))}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ace-dim">{say("paypal_not_configured")}</p>
          ))}
        {note && (
          <p className="mt-3 text-sm" role="status">
            {note}
          </p>
        )}
        {receipt && <ReceiptLine r={receipt} />}
        <p className="mt-4 text-[11px] leading-relaxed text-ace-dim">Monte assumes the store&apos;s category carries through PayPal. Some issuers code PayPal purchases differently.</p>
      </div>
      <Agent context={context} onPaid={onPaid} />
    </div>
  );
}

function Badge() {
  return <span className="m-mono rounded-full px-2.5 py-1 text-[11px] shadow-[0_0_0_1px_var(--m-line-strong)]">PayPal sandbox, no real money</span>;
}

type Turn = { role: "user" | "assistant"; text: string };
type AgentAnswer = { plan: CheckoutPlan | null; order: { id: string } | null };

function Agent({ context, onPaid }: { context: object; onPaid: (t: Txn) => void }) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AgentAnswer>({ plan: null, order: null });
  const { note, setNote, receipt, setReceipt, capture } = useCapture(onPaid);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setNote(null);
    setReceipt(null);
    setAnswer({ plan: null, order: null });
    try {
      const res = await fetch("/api/paypal/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.slice(-7), ...context }) });
      const data = await res.json();
      if (!res.ok) {
        setTurns(turns); // the question didn't land: let it be asked again
        setInput(text);
        return setNote(say(data.error));
      }
      setTurns([...next, { role: "assistant", text: data.reply }]);
      setAnswer({ plan: data.plan, order: data.order });
    } catch {
      setTurns(turns);
      setInput(text);
      setNote(say("agent_error"));
    } finally {
      setBusy(false);
    }
  };

  const { plan, order } = answer;
  return (
    <div className="m-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="m-label">Or tell Monte what you&apos;re buying</div>
        <Badge />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ace-dim">Claude reads your sentence and explains the result. The rules engine picks the card and does the math, and you approve the payment yourself.</p>
      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder={EXAMPLE}
          aria-label="Describe your purchase"
          className="h-9 min-w-0 flex-1 rounded-[10px] bg-ace-panel px-3 text-sm shadow-[0_0_0_1px_var(--m-line)] outline-none focus:shadow-[0_0_0_1.5px_var(--m-ink)]"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-sm btn-primary">
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>
      {!turns.length && (
        <button type="button" onClick={() => setInput(EXAMPLE)} className="mt-2 text-left text-xs text-ace-dim underline">
          Try: {EXAMPLE}
        </button>
      )}
      <div className="mt-4 space-y-2 text-sm leading-relaxed" aria-live="polite">
        {turns.slice(-2).map((t, k) => (
          <p key={k} className={t.role === "user" ? "text-ace-dim" : ""}>
            {t.text}
          </p>
        ))}
      </div>
      {plan?.pick && (
        <div className="mt-4 border-t border-ace-line pt-4">
          <Recommendation plan={plan} />
        </div>
      )}
      {plan && order && !receipt && (
        <div className="mt-4">
          <div className="mono mb-2 text-xs text-ace-dim">Approve {usd(Number(plan.orderValue))} in PayPal. Nothing is charged until you do.</div>
          {CLIENT_ID ? <PayPalButton key={order.id} order={() => Promise.resolve({ orderId: order.id })} onApproved={(id) => capture(id, plan)} onProblem={(w) => setNote(say(w))} /> : <p className="text-sm text-ace-dim">{say("paypal_not_configured")}</p>}
        </div>
      )}
      {note && (
        <p className="mt-3 text-sm" role="status">
          {note}
        </p>
      )}
      {receipt && <ReceiptLine r={receipt} />}
    </div>
  );
}
