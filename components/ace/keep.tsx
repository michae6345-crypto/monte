"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { marginalValue, whatIf, interestFor } from "@/lib/engine";
import { CARDS, card, creditPerYear, openToNewApplicants } from "@/lib/engine/catalog";
import { CardArt, shortName } from "./card-art";
import { Num } from "./num";
import { Section } from "./section";
import { money, useAce } from "./store";

export function KeepSection() {
  const { wallet, txns, valuation } = useAce();
  const rows = useMemo(
    () => wallet.map((h) => ({ h, m: marginalValue(wallet, txns, h.cardId), interest: interestFor(h) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, txns, valuation],
  );

  return (
    <Section
      id="keep"
      index="04"
      kicker="Keep or cancel"
      title={
        <>
          Is each card <span className="serif italic text-ace-gold">earning its spot?</span>
        </>
      }
      lede="A card is worth what it adds over the next-best card you already carry, plus the perks you actually use, minus its fee. Not the number on the brochure."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ h, m, interest }, i) => {
          const verdict =
            interest > 0
              ? { label: "Pay it down", tone: "loss", why: `Carrying a balance costs ${money(interest)} a year, more than any card earns.` }
              : m.net >= 25
                ? { label: "Keep", tone: "gain", why: `Adds ${money(m.rewardsAdded)} over your other cards${m.credits ? ` plus ${money(m.credits)} of perks you use` : ""}.` }
                : m.fee > 0
                  ? { label: "Downgrade", tone: "loss", why: `The ${money(m.fee)} fee buys ${money(m.rewardsAdded + m.credits)} of value for you. Ask for a retention offer or switch to a no-fee card from ${card(h.cardId).issuer.replace("American Express", "Amex")}, which keeps your credit history.` }
                  : { label: "Keep, quietly", tone: "dim", why: "No fee, so it costs nothing to keep open, and it helps your credit age. Your other cards out-earn it." };
          const tilt = Math.max(-14, Math.min(14, (m.net / Math.max(60, m.fee || 60)) * 10));
          return (
            <motion.div
              key={h.cardId}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl border border-ace-line bg-ace-panel/70 p-6"
            >
              <div className="flex items-center gap-4">
                <CardArt id={h.cardId} size="sm" className="w-20" />
                <div>
                  <div className="font-medium">{shortName(h.cardId)}</div>
                  <div className="mono text-[11px] uppercase tracking-wider text-ace-dim">{m.fee ? `${money(m.fee)} a year` : "no annual fee"}</div>
                </div>
              </div>
              {/* the scale */}
              <div className="relative mx-auto mt-8 h-24 w-full max-w-[260px]">
                <div className="absolute bottom-0 left-1/2 h-14 w-1 -translate-x-1/2 rounded bg-ace-line" />
                <div className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded bg-ace-line" />
                <motion.div
                  className="absolute left-0 right-0 top-6 flex items-start justify-between"
                  initial={{ rotate: 0 }}
                  whileInView={{ rotate: tilt }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 40, damping: 7, delay: 0.3 + i * 0.1 }}
                >
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-ace-ink/40" />
                  <div className="mono -mt-7 text-center text-xs text-ace-loss">
                    fee
                    <div className="text-sm">{money(m.fee)}</div>
                  </div>
                  <div className="mono -mt-7 text-center text-xs text-ace-gain">
                    value
                    <div className="text-sm">{money(m.rewardsAdded + m.credits)}</div>
                  </div>
                </motion.div>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-ace-line pt-4">
                <span
                  className={`text-lg font-semibold ${verdict.tone === "gain" ? "text-ace-gain" : verdict.tone === "loss" ? "text-ace-loss" : "text-ace-ink"}`}
                >
                  {verdict.label}
                </span>
                <Num value={interest > 0 ? -interest : m.net} sign className="mono text-ace-dim" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ace-dim">{verdict.why}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------- For you: preferences, next card, nudges ----------------

export function ForYouSection() {
  const { wallet, txns, valuation, setValuationMode, addCard, persona } = useAce();
  const [noFee, setNoFee] = useState(false);
  const [perks, setPerks] = useState<0 | 0.5 | 1>(0);

  const spend = useMemo(() => {
    const m: Record<string, number> = {};
    let total = 0;
    for (const t of txns) {
      m[t.category] = (m[t.category] ?? 0) + t.amount;
      total += t.amount;
    }
    return { top: Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3), total };
  }, [txns]);

  const recs = useMemo(() => {
    return CARDS.filter((c) => !wallet.some((h) => h.cardId === c.id))
      .filter((c) => !noFee || c.annual_fee === 0)
      .filter((c) => !/secured|student/i.test(c.id) && openToNewApplicants(c))
      .map((c) => {
        const w = whatIf(wallet, txns, c.id)!;
        const perkValue = c.credits.reduce((a, cr) => a + creditPerYear(cr), 0) * perks;
        return { id: c.id, ...w, perkValue, total: w.net + perkValue };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, noFee, perks, valuation]);

  const nudges = useMemo(() => {
    const out: { tag: string; tone: "gain" | "loss" | "gold"; text: string }[] = [];
    for (const h of wallet) {
      const c = card(h.cardId);
      if (h.balance && h.balance > 0) {
        const apr = (h.apr ?? c.purchase_apr_range[1]) / 100 / 12;
        const pay = 250;
        const months = Math.ceil(-Math.log(1 - (apr * h.balance) / pay) / Math.log(1 + apr));
        const interestPaid = months * pay - h.balance;
        out.push({
          tag: "Pay this first",
          tone: "loss",
          text: `${shortName(h.cardId)}: ${money(h.balance)} at ${h.apr}% costs about ${money(interestFor(h))} a year. $${pay}/month clears it in ${months} months with ${money(interestPaid)} of interest.`,
        });
      }
      if (c.rotating?.activation_required)
        out.push({ tag: "Activate", tone: "gold", text: `${shortName(h.cardId)}: 5% on ${(c.rotating.q4_2026_labels ?? c.rotating.q4_2026).slice(0, 2).join(" and ").toLowerCase()} this quarter, up to $${c.rotating.cap?.toLocaleString()}. Only if you activate it.` });
      const unused = c.credits.filter((cr) => cr.period === "month" && (h.creditsUsed?.[cr.name] ?? 0) < creditPerYear(cr));
      if (unused.length)
        out.push({
          tag: "Expires Oct 31",
          tone: "gold",
          text: `${shortName(h.cardId)}: $${unused.reduce((a, cr) => a + cr.amount, 0)} of October perks unused (${unused.map((cr) => `${cr.name} $${cr.amount}`).join(", ")}).`,
        });
      const m = marginalValue(wallet, txns, h.cardId);
      if (c.annual_fee > 0 && m.net < 25)
        out.push({ tag: "Before it renews", tone: "loss", text: `${shortName(h.cardId)} is worth ${money(m.net)} a year to you after its ${money(c.annual_fee)} fee. Call for a retention offer, or downgrade.` });
    }
    if (recs[0] && recs[0].total > 40 && !wallet.some((h) => h.balance))
      out.push({ tag: "Opportunity", tone: "gain", text: `${shortName(recs[0].id)} would add about ${money(recs[0].total)} a year on your actual spending, after its fee.` });
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, txns, recs, valuation]);

  return (
    <Section
      id="foryou"
      index="05"
      kicker="Learns you"
      title={
        <>
          Recommendations from <span className="serif italic text-ace-gold">your</span> spending, not a sponsor.
        </>
      }
      lede="Ace learns how you spend, how you redeem, which perks you really use and what you won't put up with, then ranks cards on what they'd do for you, not on referral payouts."
    >
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6 rounded-3xl border border-ace-line bg-ace-panel/70 p-6">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-ace-dim">What Ace learned</div>
            <ul className="mt-3 space-y-2 text-sm">
              {spend.top.map(([cat, v]) => (
                <li key={cat} className="flex justify-between">
                  <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                  <span className="mono text-ace-dim">{Math.round((v / spend.total) * 100)}% of spend</span>
                </li>
              ))}
              {wallet.some((h) => h.creditsUsed) && (
                <li className="text-ace-dim">
                  Uses ${Object.values(wallet.find((h) => h.creditsUsed)!.creditsUsed!).reduce((a, b) => a + b, 0)} of{" "}
                  ${card(wallet.find((h) => h.creditsUsed)!.cardId).credits.reduce((a, c) => a + creditPerYear(c), 0)} in perks
                </li>
              )}
            </ul>
          </div>
          <Pref label="Redeems points as">
            {(["cash", "travel"] as const).map((v) => (
              <Pill key={v} on={valuation === v} onClick={() => setValuationMode(v)}>
                {v}
              </Pill>
            ))}
          </Pref>
          <Pref label="Annual fees">
            <Pill on={!noFee} onClick={() => setNoFee(false)}>
              ok if worth it
            </Pill>
            <Pill on={noFee} onClick={() => setNoFee(true)}>
              never
            </Pill>
          </Pref>
          <Pref label="Perks I'd actually use">
            {([0, 0.5, 1] as const).map((v) => (
              <Pill key={v} on={perks === v} onClick={() => setPerks(v)}>
                {v === 0 ? "none" : v === 0.5 ? "half" : "all"}
              </Pill>
            ))}
          </Pref>
        </div>

        <div className="grid gap-8 2xl:grid-cols-2">
          <div>
            <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">Best next card for {persona.name}</div>
            {wallet.some((h) => h.balance) && (
              <div className="mb-3 rounded-2xl border border-ace-loss/40 bg-ace-loss/10 p-4 text-sm leading-relaxed">
                <span className="font-semibold text-ace-loss">Ace&apos;s advice: no new card yet.</span> {persona.name} carries a balance, and
                the interest outweighs any card below. Pay it down first; this list is what to apply for after.
              </div>
            )}
            <div className="space-y-3">
              {recs.map((x, k) => (
                <motion.div
                  layout
                  key={x.id}
                  className="flex items-center gap-4 rounded-2xl border border-ace-line p-3 pr-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="mono w-4 text-ace-dim">{k + 1}</span>
                  <CardArt id={x.id} size="sm" className="w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{shortName(x.id)}</div>
                    <div className="mono text-[10px] text-ace-dim">
                      {money(x.rewardsAdded, { sign: true })} rewards · {money(-x.fee, { sign: true })} fee
                      {x.perkValue ? ` · ${money(x.perkValue, { sign: true })} perks` : ""}
                    </div>
                  </div>
                  <span className={`mono text-sm ${x.total >= 0 ? "text-ace-gain" : "text-ace-loss"}`}>{money(x.total, { sign: true })}/yr</span>
                  <button
                    onClick={() => addCard(x.id)}
                    className="rounded-full border border-ace-line px-2.5 py-1 text-xs text-ace-dim transition hover:border-ace-gold hover:text-ace-gold"
                  >
                    try it
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
          <div>
            <div className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-ace-dim">This week</div>
            <div className="space-y-3">
              {nudges.map((n, k) => (
                <motion.div
                  key={n.text}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: k * 0.08 }}
                  className="rounded-2xl border border-ace-line bg-ace-panel/60 p-4"
                >
                  <div
                    className={`mono text-[10px] uppercase tracking-[0.2em] ${n.tone === "gain" ? "text-ace-gain" : n.tone === "loss" ? "text-ace-loss" : "text-ace-gold"}`}
                  >
                    {n.tag}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{n.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Pref({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono mb-2 text-[11px] uppercase tracking-[0.2em] text-ace-dim">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm capitalize transition ${on ? "border-ace-ink bg-ace-ink text-ace-bg" : "border-ace-line text-ace-dim hover:text-ace-ink"}`}
    >
      {children}
    </button>
  );
}
