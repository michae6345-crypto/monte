"use client";

// Cards: what's in the wallet, what each card is best at, and whether it carries a balance
// (which is what decides whether Monte will put new spending on it). Editable by hand: Plaid
// fills it in, but a card can also be added from the catalog or a balance corrected.

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { evaluate, marginalValue, type Holding, type Txn } from "@/lib/engine";
import { CARDS, card } from "@/lib/engine/catalog";
import { aprOf } from "@/lib/engine/interest";
import { capsUsed, type CapUse } from "@/lib/caps";
import type { CardBill } from "@/lib/data/plaid";
import { bestTransfer } from "@/lib/transfer";
import { CATEGORY_LABEL } from "@/lib/merchants";
import { CardMini, shortName } from "@/components/ace/card-art";
import { money } from "@/components/ace/store";

const SAMPLE_CATS = Object.keys(CATEGORY_LABEL).filter((c) => c !== "travel_portal");

/** A card's three best categories, by what $100 there earns (at 1¢ a point unless travel is set). */
export function bestFor(cardId: string): { category: string; mult: number }[] {
  const c = card(cardId);
  const rows = SAMPLE_CATS.map((category) => {
    const t: Txn = { id: "s", date: "2026-11-01", merchant: "", amount: 100, category, cardUsed: cardId };
    const e = evaluate(c, t, new Map(), null);
    return { category, mult: e.mult, reward: e.reward };
  }).sort((a, b) => b.reward - a.reward);
  const base = rows[rows.length - 1]?.reward ?? 0;
  const top = rows.filter((r) => r.reward > base + 0.001 && r.category !== "everything_else").slice(0, 3);
  return top.length ? top : [{ category: "everything_else", mult: rows[0]?.mult ?? 1 }];
}

/** Cards with a balance, highest APR first: the order to pay them down (the avalanche method,
 *  which costs the least interest). */
function PayFirst({ wallet }: { wallet: Holding[] }) {
  const owed = wallet.filter((h) => h.balance && h.balance > 0).sort((a, b) => aprOf(b) - aprOf(a));
  if (!owed.length) return null;
  const yearly = owed.reduce((a, h) => a + (h.balance! * aprOf(h)) / 100, 0);
  return (
    <section className="m-panel border-l-4 border-[var(--m-loss)] p-4">
      <p className="m-label">pay {owed.length > 1 ? "these down in this order" : "this down first"}</p>
      <ol className="mt-2 space-y-1.5 text-sm">
        {owed.map((h, k) => (
          <li key={h.cardId} className="flex items-baseline justify-between gap-3">
            <span>
              {owed.length > 1 ? `${k + 1}. ` : ""}
              {shortName(h.cardId)}
            </span>
            <span className="mono text-xs text-ace-dim">
              {money(h.balance!)} at {aprOf(h)}%
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ace-dim">
        About {money(yearly)} a year in interest at today&apos;s balances. Each extra dollar paid on the {shortName(owed[0].cardId)} saves {aprOf(owed[0])}¢ a year, more than any card pays back. While a card carries a balance, Monte keeps new purchases off it.
      </p>
      {owed.map((h) => {
        const t = bestTransfer(h, wallet);
        if (!t) return null;
        return (
          <p key={h.cardId} className="mt-3 rounded-[10px] bg-[var(--m-wash)] p-3 text-xs leading-relaxed">
            <span className="font-medium">Or move the balance on the {shortName(h.cardId)}.</span> A new {shortName(t.toCardId)} takes balance transfers at 0% for {t.months} months. Paying {money(t.monthly)} a month clears it with no interest; the same payoff at {aprOf(h)}% costs about {money(t.interestStaying)}. With a 3-5% transfer fee ({money(t.feeLow)}-{money(t.feeHigh)}), that&apos;s at least {money(t.saved)} saved, if you&apos;re approved. Keep new purchases off it until it&apos;s paid.
          </p>
        );
      })}
    </section>
  );
}

/** This quarter's 5% categories on a rotating card, and the activation it needs: 5% only starts
 *  once activated, and isn't backdated. Shown while the catalog's quarter is current. */
function Rotating({ cardId }: { cardId: string }) {
  const r = card(cardId).rotating as
    | { q4_2026_labels?: string[]; multiplier: number; cap?: number; activation_required?: boolean; activation_deadline?: string; period?: string; dates?: string }
    | undefined;
  if (!r?.q4_2026_labels?.length) return null;
  const span = r.period ?? r.dates ?? "";
  const end = span.split(" to ")[1];
  const today = new Date().toISOString().slice(0, 10);
  if (end && today > end) return null; // the catalog's quarter is over; next quarter's isn't on file yet
  const deadline = r.activation_deadline ? new Date(r.activation_deadline + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : null;
  return (
    <p className="mt-2 rounded-[10px] bg-[var(--m-accent-wash)] px-2.5 py-1.5 text-xs">
      <span className="font-medium">
        {r.multiplier}% this quarter: {r.q4_2026_labels.join(", ")}
      </span>
      {r.cap ? ` (first ${money(r.cap)})` : ""}.{" "}
      {r.activation_required && <span>Activate it with the issuer first{deadline ? `, by ${deadline}` : ""}: it isn&apos;t backdated.</span>}
    </p>
  );
}

// Card-linked offers (Amex Offers, BankAmeriDeals...) are per-account and change weekly, and the
// issuers don't let apps add them for you without your login, so Monte links you to them instead.
// Only pages that resolved on 3 Nov 2026 are linked; the rest say where the offers live.
const OFFERS: { match: RegExp; name: string; url?: string; where?: string }[] = [
  { match: /^amex_/, name: "Amex Offers", url: "https://global.americanexpress.com/offers/eligible" },
  { match: /^bofa_/, name: "BankAmeriDeals", url: "https://www.bankofamerica.com/deals/" },
  { match: /^citi_/, name: "Citi Merchant Offers", url: "https://www.citi.com/credit-cards/citi-merchant-offers" },
  { match: /^chase_/, name: "Chase Offers", where: "in the Chase app, under Offers" },
  { match: /^capital_one_/, name: "Capital One Offers", where: "in the Capital One app" },
  { match: /^wells_fargo_/, name: "Wells Fargo Deals", where: "in the Wells Fargo app" },
  { match: /^discover_/, name: "Discover Deals", where: "in the Discover app" },
  { match: /^us_bank_/, name: "U.S. Bank's offers", where: "in the U.S. Bank app" },
];

function Offers({ cardId }: { cardId: string }) {
  const o = OFFERS.find((x) => x.match.test(cardId));
  if (!o) return null;
  return (
    <p className="mt-2 text-xs text-ace-dim">
      Card offers:{" "}
      {o.url ? (
        <a href={o.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ace-ink">
          {o.name}
        </a>
      ) : (
        <>
          {o.name}, {o.where}
        </>
      )}
      . Add the ones you&apos;d use; they stack with the card&apos;s points.
    </p>
  );
}

/** From the bank (Plaid Liabilities): what's due and when, and how much of the limit is in use. */
function Bill({ bill }: { bill?: CardBill }) {
  if (!bill) return null;
  const due = bill.dueDate ? new Date(bill.dueDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : null;
  const used = bill.limit && bill.owedNow != null ? bill.owedNow / bill.limit : null;
  return (
    <div className="mt-2 space-y-1 text-xs">
      {(due || bill.minimum != null) && (
        <p className={bill.overdue ? "font-medium m-loss" : ""}>
          {bill.overdue ? "Overdue: " : ""}
          {bill.statement != null ? `statement ${money(bill.statement, { cents: true })}` : ""}
          {bill.minimum != null ? `${bill.statement != null ? " · " : ""}minimum ${money(bill.minimum, { cents: true })}` : ""}
          {due ? ` due ${due}` : ""}
          {bill.statement ? <span className="text-ace-dim"> · pay the statement in full and new purchases cost no interest</span> : null}
        </p>
      )}
      {used != null && (
        <p className={used >= 0.3 ? "m-loss" : "text-ace-dim"}>
          {money(bill.owedNow!)} of a {money(bill.limit!)} limit in use ({Math.round(used * 100)}%)
          {used >= 0.3 ? ": over 30% can lower your credit score; paying before the statement closes brings it down" : ""}
        </p>
      )}
    </div>
  );
}

/** Each capped bonus on this card: how much of the cap is used this period. */
function Caps({ uses }: { uses: CapUse[] }) {
  if (!uses.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {uses.map((u) => {
        const full = u.used >= u.cap;
        const pct = Math.min(100, (u.used / u.cap) * 100);
        return (
          <div key={u.label} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span>{u.label}</span>
              <span className={`mono ${full ? "m-loss" : "text-ace-dim"}`}>
                {full ? `cap reached ${u.when}` : `${money(u.used)} of ${money(u.cap)} ${u.when}`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--m-wash)]" role="img" aria-label={`${Math.round(pct)}% of the cap used`}>
              <div className={`h-full rounded-full ${full ? "bg-[var(--m-loss)]" : pct > 85 ? "bg-[var(--m-accent)]" : "bg-ace-ink"}`} style={{ width: `${pct}%` }} />
            </div>
            {full && <p className="mt-0.5 text-ace-dim">Past the cap it earns this card&apos;s base rate; the Pay screen already counts that.</p>}
          </div>
        );
      })}
    </div>
  );
}

/** With a year of purchases: what this card adds over the rest of the wallet, after its fee. */
function Worth({ wallet, txns, cardId }: { wallet: Holding[]; txns: Txn[]; cardId: string }) {
  const m = useMemo(() => (txns.length && wallet.length > 1 ? marginalValue(wallet, txns, cardId) : null), [wallet, txns, cardId]);
  if (!m) return null;
  // a card with a balance earns nothing here (Monte keeps purchases off it), and closing it
  // wouldn't erase what's owed: the only advice is the payoff
  if (wallet.find((h) => h.cardId === cardId)?.balance)
    return (
      <p className="mt-2 text-xs">
        <span className="font-medium m-loss">Pay it off before deciding:</span>{" "}
        <span className="text-ace-dim">closing a card doesn&apos;t clear its balance, and it would lower your available credit.</span>
      </p>
    );
  const verdict =
    m.net >= 1
      ? { t: "Worth keeping", c: "m-gain" }
      : m.fee > 0
        ? { t: "Costs more than it adds", c: "m-loss" }
        : { t: "Keep as a backup", c: "text-ace-dim" };
  return (
    <p className="mt-2 text-xs">
      <span className={`font-medium ${verdict.c}`}>{verdict.t}:</span>{" "}
      <span className="text-ace-dim">
        on your year it adds {money(m.rewardsAdded)} over your other cards
        {m.credits ? `, plus ${money(m.credits)} of perks used` : ""}
        {m.fee ? `, against its ${money(m.fee)} fee` : ""}.
      </span>
    </p>
  );
}

export function Cards({ wallet, txns = [], bills, onChange }: { wallet: Holding[]; txns?: Txn[]; bills?: Record<string, CardBill>; onChange: (w: Holding[]) => void }) {
  const [adding, setAdding] = useState(wallet.length === 0);
  const [q, setQ] = useState("");
  const have = new Set(wallet.map((h) => h.cardId));
  const matches = useMemo(() => {
    const k = q.toLowerCase().trim();
    return CARDS.filter((c) => !have.has(c.id) && (!k || `${c.name} ${c.issuer}`.toLowerCase().includes(k))).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, wallet]);

  const set = (id: string, patch: Partial<Holding>) => onChange(wallet.map((h) => (h.cardId === id ? { ...h, ...patch } : h)));
  // the demo years end 17 Oct 2026; a real feed ends today. Count caps up to the last purchase.
  const caps = useMemo(() => (txns.length ? capsUsed(wallet, txns, txns[txns.length - 1].date) : []), [wallet, txns]);

  return (
    <div className="space-y-3">
      <PayFirst wallet={wallet} />
      {wallet.map((h) => (
        <CardRow key={h.cardId} h={h} onSet={(p) => set(h.cardId, p)} onRemove={() => onChange(wallet.filter((x) => x.cardId !== h.cardId))}>
          <Bill bill={bills?.[h.cardId]} />
          <Caps uses={caps.filter((u) => u.cardId === h.cardId)} />
          <Worth wallet={wallet} txns={txns} cardId={h.cardId} />
          <Offers cardId={h.cardId} />
        </CardRow>
      ))}

      {adding ? (
        <section className="m-panel p-4">
          <label htmlFor="addcard" className="m-label">
            Add a card you have
          </label>
          <input
            id="addcard"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sapphire, Amex Gold, Discover…"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-[12px] bg-[var(--m-wash)] px-3 text-[15px] outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
          />
          <ul className="mt-2 divide-y divide-[var(--m-line)]">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...wallet, { cardId: c.id }]);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[var(--m-wash)]"
                >
                  <CardMini id={c.id} width={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{shortName(c.id)}</span>
                    <span className="mono block text-[11px] text-ace-dim">
                      {c.issuer} · {c.annual_fee ? `$${c.annual_fee}/yr` : "no annual fee"}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 text-ace-dim" />
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="py-3 text-sm text-ace-dim">No card by that name in Monte&apos;s {CARDS.length}-card catalog yet.</li>}
          </ul>
          {wallet.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost btn-sm mt-3">
              Done
            </button>
          )}
        </section>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost w-full justify-center">
          <Plus className="h-4 w-4" /> Add a card
        </button>
      )}
    </div>
  );
}

function CardRow({ h, onSet, onRemove, children }: { h: Holding; onSet: (p: Partial<Holding>) => void; onRemove: () => void; children?: React.ReactNode }) {
  const c = card(h.cardId);
  const best = useMemo(() => bestFor(h.cardId), [h.cardId]);
  const [edit, setEdit] = useState(false);
  const carries = !!h.balance && h.balance > 0;
  return (
    <section className="m-panel p-4">
      <div className="flex items-start gap-3">
        <CardMini id={h.cardId} width={64} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-tight">{shortName(h.cardId)}</div>
          <div className="mono mt-0.5 text-[11px] text-ace-dim">{c.annual_fee ? `$${c.annual_fee}/yr` : "no annual fee"}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {best.map((b) => (
              <span key={b.category} className="rounded-full bg-[var(--m-wash)] px-2 py-0.5 text-[11px]">
                {b.mult % 1 ? b.mult.toFixed(1) : b.mult}× {b.category === "everything_else" ? "on everything" : CATEGORY_LABEL[b.category]?.toLowerCase()}
              </span>
            ))}
          </div>
          <Rotating cardId={h.cardId} />
          {children}
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${shortName(h.cardId)}`} className="grid h-8 w-8 place-items-center rounded-full text-ace-dim hover:bg-[var(--m-wash)]">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--m-line)] pt-3 text-sm">
        <span className={carries ? "m-loss" : "text-ace-dim"}>
          {carries ? `Carries ${money(h.balance!)} at ${aprOf(h)}% APR` : "Paid in full"}
        </span>
        <button type="button" onClick={() => setEdit((v) => !v)} className="text-xs underline decoration-[var(--m-line-strong)] underline-offset-4">
          {edit ? "Close" : "Edit balance"}
        </button>
      </div>
      {edit && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="m-label">Balance carried</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={h.balance ?? 0}
              onChange={(e) => onSet({ balance: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-[10px] bg-[var(--m-wash)] px-3 outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="m-label">Purchase APR %</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={h.apr ?? c.purchase_apr_range[1]}
              onChange={(e) => onSet({ apr: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9 rounded-[10px] bg-[var(--m-wash)] px-3 outline-none focus:ring-2 focus:ring-[var(--m-accent)]"
            />
          </label>
          <p className="col-span-2 text-xs text-ace-dim">
            Only a balance you didn&apos;t pay off last statement counts. This month&apos;s purchases don&apos;t, if you pay the statement in full.
          </p>
        </div>
      )}
    </section>
  );
}
