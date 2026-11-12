"use client";

// Pay for the purchase the Tap view just ranked, or type one to the checkout agent. Every
// number here is the engine's (lib/paypal/plan.ts). Nothing is charged until the person
// approves it in PayPal's window. Sandbox only.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Holding, Txn, Valuation } from "@/lib/engine";
import { capMoveLine, capRoomLine, orderValue, planCheckout, usd, type CheckoutPlan, type Purchase } from "@/lib/paypal/plan";
import { comparePayLater, PAY_LATER_FINE_PRINT, payLaterLine } from "@/lib/paypal/paylater";
import { confirmAgentRefund, refundProposalLine, rememberCapture, type RefundProposal, type SessionCapture } from "@/lib/paypal/agent-refund-client";
import { shortName } from "./card-art";

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
const EXAMPLE = "I'm spending $84 on groceries at Trader Joe's.";
const RETURN_EXAMPLE = "return the Trader Joe's purchase.";
// Venmo and Pay Later buttons. Off unless NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING=1 at build time, so the
// PayPal button loads exactly as before when it's off.
const EXTRA_FUNDING = process.env.NEXT_PUBLIC_PAYPAL_EXTRA_FUNDING === "1";

// ---------- PayPal's JS SDK v6 ----------

type OrderHandle = { orderId: string };
type PayPalSession = { start(options: { presentationMode: "auto" }, order: Promise<OrderHandle>): Promise<void> };
type SessionCallbacks = {
  onApprove(data: OrderHandle): Promise<void> | void;
  onCancel(): void;
  onError(error: { code?: string; message?: string }): void;
};
type EligibleMethods = {
  isEligible(method: string): boolean;
  getDetails?(method: string): { productCode?: string; countryCode?: string } | undefined;
};
type PayPalSdk = {
  findEligibleMethods(options: { currencyCode: string }): Promise<EligibleMethods>;
  createPayPalOneTimePaymentSession(callbacks: SessionCallbacks): PayPalSession;
  // only with EXTRA_FUNDING; optional because we never assume the loaded SDK has them
  createVenmoOneTimePaymentSession?(callbacks: SessionCallbacks): PayPalSession;
  createPayLaterOneTimePaymentSession?(callbacks: SessionCallbacks): PayPalSession;
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
    .then(() => window.paypal!.createInstance({ clientId: CLIENT_ID, components: EXTRA_FUNDING ? ["paypal-payments", "venmo-payments"] : ["paypal-payments"], pageType: "checkout" }))
    .catch((e: Error) => {
      console.warn("paypal:", e.message);
      sdk = null; // a later mount can try again
      return null;
    });
  return sdk;
}

/** PayPal's own button. `order` runs on the click, so the window opens from the person's tap. */
function PayPalButton({
  order,
  onApproved,
  onProblem,
  busy,
}: {
  order: () => Promise<OrderHandle>;
  onApproved: (orderId: string) => Promise<void>;
  onProblem: (word: string) => void;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ order, onApproved, onProblem, busy });
  useEffect(() => {
    latest.current = { order, onApproved, onProblem, busy };
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
        if (latest.current.busy) return; // a capture is still running
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
      <div ref={host} className={`max-w-[320px] ${busy ? "pointer-events-none opacity-50" : ""}`} />
      {state === "unavailable" && <p className="mt-2 text-sm text-ace-dim">PayPal&apos;s button didn&apos;t load here. Check that the sandbox client ID is right.</p>}
    </>
  );
}

/**
 * Venmo or Pay Later, from the same SDK instance and the same server order as the PayPal button.
 * Shown only when PayPal's findEligibleMethods says yes; if eligibility can't be read, or the SDK
 * lacks the session for it, it renders nothing rather than a button that can't work.
 */
function ExtraFundingButton({
  method,
  order,
  onApproved,
  onProblem,
  busy,
}: {
  method: "venmo" | "paylater";
  order: () => Promise<OrderHandle>;
  onApproved: (orderId: string) => Promise<void>;
  onProblem: (word: string) => void;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ order, onApproved, onProblem, busy });
  useEffect(() => {
    latest.current = { order, onApproved, onProblem, busy };
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const slot = host.current;
    void loadSdk().then(async (paypal) => {
      if (!live || !slot || !paypal) return;
      try {
        const methods = await paypal.findEligibleMethods({ currencyCode: "USD" });
        if (!live || !methods.isEligible(method)) return;
        const callbacks: SessionCallbacks = {
          onApprove: (data) => latest.current.onApproved(data.orderId),
          onCancel: () => latest.current.onProblem("cancelled"),
          onError: (e) => latest.current.onProblem(e.code === "ERR_DEV_UNABLE_TO_OPEN_POPUP" ? "popup_blocked" : e.message || "paypal_error"),
        };
        let session: PayPalSession | undefined;
        let button: HTMLElement;
        if (method === "venmo") {
          session = paypal.createVenmoOneTimePaymentSession?.(callbacks);
          button = document.createElement("venmo-button");
          button.setAttribute("type", "pay");
        } else {
          const details = methods.getDetails?.("paylater");
          if (!details?.productCode || !details.countryCode) return;
          session = paypal.createPayLaterOneTimePaymentSession?.(callbacks);
          button = document.createElement("paypal-pay-later-button");
          Object.assign(button, { productCode: details.productCode, countryCode: details.countryCode });
        }
        if (!session || !live) return;
        const s = session;
        button.addEventListener("click", () => {
          if (latest.current.busy) return;
          s.start({ presentationMode: "auto" }, latest.current.order()).catch((e: Error) => latest.current.onProblem(e.message));
        });
        slot.replaceChildren(button);
        setReady(true);
      } catch (e) {
        console.warn(`paypal ${method}:`, (e as Error).message); // hide it, leave PayPal's button alone
      }
    });
    return () => {
      live = false;
      slot?.replaceChildren();
    };
  }, [method]);

  return <div ref={host} hidden={!ready} className={`mt-2 max-w-[320px] ${busy ? "pointer-events-none opacity-50" : ""}`} />;
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
  agent_error: "The assistant hit a problem. Try again.",
};
const say = (code: string) => WORDS[code] ?? "PayPal hit a problem. Nothing was charged. Try again.";
// After approval the money may already have moved, so never claim it didn't.
const CAPTURE_UNSURE = "You approved this, but Monte couldn't confirm the payment. Check your PayPal sandbox activity before paying again.";

type Receipt = { merchant: string; value: string; captureId: string; txnId: string; card: string; reward: number; cap: string; store: string };

/** Capture an approved order, write the receipt line and hand the purchase to the Tap view. */
function useCapture(onPaid: (t: Txn) => void, replan: (p: CheckoutPlan) => CheckoutPlan, onCaptured: (c: SessionCapture) => void) {
  const [note, setNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [capturing, setCapturing] = useState(false);
  const capture = async (orderId: string, ordered: CheckoutPlan) => {
    setCapturing(true);
    setNote("Capturing the payment…");
    try {
      const res = await fetch("/api/paypal/capture-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await res.json();
      if (!res.ok) return setNote(WORDS[data.error] ?? CAPTURE_UNSURE);
      setNote(null);
      // another payment may have used the cap since this order was made
      const now = replan(ordered);
      const plan = now.pick?.cardId === data.txn.cardUsed ? now : ordered;
      setReceipt({
        merchant: data.txn.merchant,
        value: data.value,
        captureId: data.captureId,
        txnId: data.txn.id,
        card: shortName(data.txn.cardUsed),
        reward: plan.pick?.reward ?? 0,
        cap: plan.capRoom ? `Cap room ${capMoveLine(plan.capRoom)}` : "No cap on this rule",
        store: data.cap.store,
      });
      onPaid(data.txn as Txn);
      onCaptured({ captureId: data.captureId, merchant: ordered.purchase.merchant, amount: data.value });
    } catch {
      setNote(CAPTURE_UNSURE);
    } finally {
      setCapturing(false);
    }
  };
  return { note, setNote, receipt, setReceipt, capture, capturing };
}

const REFUND_WORDS: Record<string, string> = {
  already_refunded: "That payment was already returned in full.",
  not_refundable: "PayPal says this payment can't be returned right now.",
  paypal_not_configured: "PayPal isn't connected on this deployment, so nothing was returned.",
  not_a_monte_order: "That payment wasn't made through Monte, so Monte can't return it.",
};
// The money may have moved even when the answer didn't arrive, so never claim it didn't.
const REFUND_UNSURE = "Monte couldn't confirm the return. Check your PayPal sandbox activity before trying again.";

type Refund = { status: string; refunded: string; txnId: string; rollback: { capReleased: number; rewardReversed: number } | null; cap: { store: string } };

/** The "Return it" control: refund all or part of a capture and give the cap room back. */
function ReturnIt({ r, onRefunded }: { r: Receipt; onRefunded: (txnId: string, amount: number) => void }) {
  const [left, setLeft] = useState(Number(r.value));
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const refund = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const typed = amount.trim().replace(/^\$/, "");
    if (typed && (!/^\d+(\.\d{1,2})?$/.test(typed) || Number(typed) <= 0 || Number(typed) > left + 0.004)) {
      return setProblem(`Enter an amount up to ${usd(left)}, or leave it blank to return it all.`);
    }
    setPending(true);
    setProblem(null);
    try {
      const body = { captureId: r.captureId, requestId: crypto.randomUUID(), ...(typed ? { amount: Number(typed).toFixed(2) } : {}) };
      const res = await fetch("/api/paypal/refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setProblem(REFUND_WORDS[data.error] ?? REFUND_UNSURE);
      const d = data as Refund;
      const back = Number(d.refunded);
      if (d.status !== "COMPLETED") {
        setLines((l) => [...l, `PayPal has the return of ${usd(back)} as ${d.status.toLowerCase()}. The cap moves once it completes.`]);
        return;
      }
      const roll = d.rollback;
      setLines((l) => [...l, `Refunded ${usd(back)}${roll ? ` · −${usd(roll.rewardReversed)} rewards · ${usd(roll.capReleased)} cap room back` : ""}`]);
      setLeft((v) => Math.max(0, Math.round((v - back) * 100) / 100));
      setAmount("");
      if (d.cap.store === "memory") onRefunded(d.txnId || r.txnId, back);
    } catch {
      setProblem(REFUND_UNSURE);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3">
      {lines.map((l, k) => (
        <div key={k} className="mono mt-1 text-xs">
          {l}
        </div>
      ))}
      {left > 0 && (
        <form onSubmit={refund} className="mt-2 flex items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={`${left.toFixed(2)} (all)`}
            aria-label="Amount to return"
            disabled={pending}
            className="mono h-8 w-32 min-w-0 rounded-[10px] bg-ace-panel px-2 text-xs shadow-[0_0_0_1px_var(--m-line)] outline-none focus:shadow-[0_0_0_1.5px_var(--m-ink)]"
          />
          <button type="submit" disabled={pending} className="btn btn-sm btn-ghost">
            {pending ? "Returning…" : "Return it"}
          </button>
        </form>
      )}
      {problem && <p className="mt-2 text-sm">{problem}</p>}
    </div>
  );
}

function ReceiptLine({ r, onRefunded }: { r: Receipt; onRefunded: (txnId: string, amount: number) => void }) {
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
      <ReturnIt key={r.captureId} r={r} onRefunded={onRefunded} />
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

/** Pay in 4 next to the card that carries a balance. Every number is lib/paypal/paylater.ts. */
function PayLater({ purchase, wallet }: { purchase: Purchase; wallet: Holding[] }) {
  const c = comparePayLater(purchase.amount, purchase.date, wallet);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="mt-4 border-t border-ace-line pt-3">
      <div className="m-label">Pay Later vs. your card&apos;s interest</div>
      <p className="mt-2 text-sm leading-relaxed">{payLaterLine(c)}</p>
      {c.eligible && (
        <ol className="mono mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
          {c.schedule.map((i) => (
            <li key={i.n}>
              {date(i.date)} <span className="text-ace-dim">·</span> {usd(i.amount)}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ace-dim">{PAY_LATER_FINE_PRINT}</p>
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
  onRefunded: (txnId: string, amount: number) => void;
};

export function PayPalCheckout({ purchase, wallet, history, valuation, stores, selected, onSelect, onPaid, onRefunded }: Props) {
  const context = useMemo(() => ({ wallet: wallet.map(({ cardId, balance, apr }) => ({ cardId, balance, apr })), history, date: purchase.date, valuation }), [wallet, history, purchase.date, valuation]);
  const plan = useMemo(
    () => (orderValue(purchase.amount) ? planCheckout(wallet, purchase, history) : null),
    // valuation is read inside the engine, so a change has to re-run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, purchase, history, valuation],
  );
  const replan = (p: CheckoutPlan) => (orderValue(p.purchase.amount) ? planCheckout(wallet, p.purchase, history) : p);
  const [captures, setCaptures] = useState<SessionCapture[]>([]);
  const remember = (c: SessionCapture) => setCaptures((list) => rememberCapture(list, c));
  const { note, setNote, receipt, setReceipt, capture, capturing } = useCapture(onPaid, replan, remember);
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
                busy={capturing}
              />
              {EXTRA_FUNDING && (
                <>
                  {(["venmo", "paylater"] as const).map((m) => (
                    <ExtraFundingButton
                      key={m}
                      method={m}
                      order={order}
                      onApproved={(id) => capture(id, orders.current.get(id) ?? plan)}
                      onProblem={(w) => setNote(say(w))}
                      busy={capturing}
                    />
                  ))}
                  <p className="mt-2 text-[11px] leading-relaxed text-ace-dim">
                    Venmo and Pay Later appear only when PayPal says they&apos;re available here. Sandbox: Venmo/Pay Later approval is simulated by PayPal&apos;s sandbox.
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ace-dim">{say("paypal_not_configured")}</p>
          ))}
        {note && (
          <p className="mt-3 text-sm" role="status">
            {note}
          </p>
        )}
        {receipt && <ReceiptLine r={receipt} onRefunded={onRefunded} />}
        {plan && <PayLater purchase={purchase} wallet={wallet} />}
        <p className="mt-4 text-[11px] leading-relaxed text-ace-dim">Monte assumes the store&apos;s category carries through PayPal. Some issuers code PayPal purchases differently.</p>
      </div>
      <Agent context={context} onPaid={onPaid} onRefunded={onRefunded} replan={replan} captures={captures} remember={remember} />
    </div>
  );
}

function Badge() {
  return <span className="m-mono rounded-full px-2.5 py-1 text-[11px] shadow-[0_0_0_1px_var(--m-line-strong)]">PayPal sandbox, no real money</span>;
}

/** Says whether Claude's wording was kept: every number in it had to come from the engine or
 *  the person's own sentence, and it had to name the engine's card. */
function EngineCheck({ turn }: { turn: Turn | undefined }) {
  if (turn?.role !== "assistant" || turn.checked == null) return null;
  return (
    <p className="mono text-[11px] text-ace-dim">
      {turn.checked
        ? "✓ Checked: every number in Claude's reply comes from Monte's engine."
        : "Claude's wording didn't match the engine, so Monte shows the engine's own summary instead."}
    </p>
  );
}

/** checked: for an answer that priced a purchase or a refund, whether Claude's own sentence
 *  passed the engine check (true) or was replaced by the engine's summary (false). */
type Turn = { role: "user" | "assistant"; text: string; checked?: boolean | null };
type AgentAnswer = { plan: CheckoutPlan | null; order: { id: string } | null; proposal: RefundProposal | null };

/** The agent's refund proposal. Nothing is refunded until Confirm; one requestId per proposal makes a double click safe. */
function RefundConfirm({ proposal, onRefunded, onDone }: { proposal: RefundProposal; onRefunded: (txnId: string, amount: number) => void; onDone: () => void }) {
  const requestId = useMemo(() => crypto.randomUUID(), []);
  const [pending, setPending] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const confirm = async () => {
    if (pending || line) return;
    setPending(true);
    setProblem(null);
    try {
      const d = await confirmAgentRefund(proposal, { requestId });
      const back = Number(d.refunded);
      if (d.status !== "COMPLETED") {
        setLine(`PayPal has the return of ${usd(back)} as ${d.status.toLowerCase()}. The cap moves once it completes.`);
        return;
      }
      const roll = d.rollback;
      setLine(`Refunded ${usd(back)}${roll ? ` · −${usd(roll.rewardReversed)} rewards · ${usd(roll.capReleased)} cap room back` : ""}`);
      if (d.cap.store === "memory") onRefunded(d.txnId || `paypal-${proposal.captureId}`, back);
    } catch (e) {
      const msg = e instanceof TypeError ? "" : (e as Error).message;
      setProblem(REFUND_WORDS[msg] ?? (!msg || msg.startsWith("refund failed") || msg === "paypal_error" ? REFUND_UNSURE : `PayPal didn't return it: ${msg}.`));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 rounded-[10px] p-3 text-sm shadow-[0_0_0_1px_var(--m-line)]" role="status">
      <div className="m-label">Confirm the return</div>
      <p className="mono mt-2 text-xs leading-relaxed">{refundProposalLine(proposal)}</p>
      {line ? (
        <div className="mono mt-2 text-xs">{line}</div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={confirm} disabled={pending} className="btn btn-sm btn-primary">
            {pending ? "Returning…" : "Confirm"}
          </button>
          <button type="button" onClick={onDone} disabled={pending} className="btn btn-sm btn-ghost">
            Cancel
          </button>
        </div>
      )}
      {problem && <p className="mt-2 text-sm">{problem}</p>}
    </div>
  );
}

function Agent({
  context,
  onPaid,
  onRefunded,
  replan,
  captures,
  remember,
}: {
  context: object;
  onPaid: (t: Txn) => void;
  onRefunded: (txnId: string, amount: number) => void;
  replan: (p: CheckoutPlan) => CheckoutPlan;
  captures: SessionCapture[];
  remember: (c: SessionCapture) => void;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AgentAnswer>({ plan: null, order: null, proposal: null });
  const { note, setNote, receipt, setReceipt, capture, capturing } = useCapture(onPaid, replan, remember);

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
    setAnswer({ plan: null, order: null, proposal: null });
    try {
      const res = await fetch("/api/paypal/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.slice(-7), ...context, captures }) });
      const data = await res.json();
      if (!res.ok) {
        setTurns(turns); // the question didn't land: let it be asked again
        setInput(text);
        return setNote(say(data.error));
      }
      setTurns([...next, { role: "assistant", text: data.reply, checked: data.plan || data.proposal ? data.replyChecked === true : null }]);
      setAnswer({ plan: data.plan, order: data.order, proposal: data.proposal ?? null });
    } catch {
      setTurns(turns);
      setInput(text);
      setNote(say("agent_error"));
    } finally {
      setBusy(false);
    }
  };

  const { plan, order, proposal } = answer;
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
      {(!turns.length || captures.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {!turns.length && (
            <button type="button" onClick={() => setInput(EXAMPLE)} className="text-left text-xs text-ace-dim underline">
              Try: {EXAMPLE}
            </button>
          )}
          {captures.length > 0 && (
            <button type="button" onClick={() => setInput(RETURN_EXAMPLE)} className="text-left text-xs text-ace-dim underline">
              Try: {RETURN_EXAMPLE}
            </button>
          )}
        </div>
      )}
      <div className="mt-4 space-y-2 text-sm leading-relaxed" aria-live="polite">
        {turns.slice(-2).map((t, k) => (
          <p key={k} className={t.role === "user" ? "text-ace-dim" : ""}>
            {t.text}
          </p>
        ))}
        <EngineCheck turn={turns[turns.length - 1]} />
      </div>
      {plan?.pick && (
        <div className="mt-4 border-t border-ace-line pt-4">
          <Recommendation plan={plan} />
        </div>
      )}
      {plan && order && !receipt && (
        <div className="mt-4">
          <div className="mono mb-2 text-xs text-ace-dim">Approve {usd(Number(plan.orderValue))} in PayPal. Nothing is charged until you do.</div>
          {CLIENT_ID ? <PayPalButton key={order.id} order={() => Promise.resolve({ orderId: order.id })} onApproved={(id) => capture(id, plan)} onProblem={(w) => setNote(say(w))} busy={capturing} /> : <p className="text-sm text-ace-dim">{say("paypal_not_configured")}</p>}
        </div>
      )}
      {proposal && <RefundConfirm key={`${proposal.captureId}:${proposal.amount}:${turns.length}`} proposal={proposal} onRefunded={onRefunded} onDone={() => setAnswer((a) => ({ ...a, proposal: null }))} />}
      {note && (
        <p className="mt-3 text-sm" role="status">
          {note}
        </p>
      )}
      {receipt && <ReceiptLine r={receipt} onRefunded={onRefunded} />}
    </div>
  );
}
