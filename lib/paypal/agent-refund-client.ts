// Browser side of "return it" in the checkout agent. The agent only ever proposes a refund;
// this is the one place the browser turns a confirmed proposal into a real (sandbox) refund.
//
//   1. Keep the session's captures (newest first) and send them with every agent request:
//        fetch("/api/paypal/agent", { body: JSON.stringify({ ...body, captures }) })
//   2. If the answer has `proposal`, show it with a Confirm button (refundProposalLine is a
//      ready-made line) and do nothing until it's pressed.
//   3. On Confirm: confirmAgentRefund(proposal). The result is /api/paypal/refund's answer:
//      lower the purchase `txnId` by `refunded`, as the existing refund flow does.

import type { RefundProposal, SessionCapture } from "@/lib/paypal/agent";

export type { RefundProposal, SessionCapture };

/** /api/paypal/refund's answer (see app/api/paypal/refund/route.ts). */
export type AgentRefundResult = {
  replayed?: boolean;
  status: string;
  refundId: string;
  captureId: string;
  refunded: string;
  currency: string | null;
  requestId: string;
  txnId: string;
  rollback: { cardId: string; category: string; refunded: number; capReleased: number; rewardOriginal: number; rewardReversed: number } | null;
  cap: { store: "supabase" | "memory" };
};

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Add a just-captured purchase to the session list the agent may refund from (newest first, 10 max). */
export function rememberCapture(list: SessionCapture[], capture: SessionCapture): SessionCapture[] {
  return [capture, ...list.filter((c) => c.captureId !== capture.captureId)].slice(0, 10);
}

/** One line for the confirm card, from the engine's numbers only. */
export function refundProposalLine(p: RefundProposal): string {
  const amount = p.full ? `${money(Number(p.amount))} (full refund)` : money(Number(p.amount));
  return `Refund ${amount} at ${p.merchant} on ${p.card}: ${money(p.capBack)} of cap room back, ${money(p.rewardsReversed)} of rewards reversed.`;
}

/** Run the refund the person just confirmed, for exactly the amount they saw (so a capture that
 *  was already part-refunded fails loudly instead of refunding a different number). Pass a
 *  stable requestId to make a double click safe. */
export async function confirmAgentRefund(
  p: RefundProposal,
  opts: { requestId?: string; authToken?: string; fetchImpl?: typeof fetch } = {},
): Promise<AgentRefundResult> {
  const { requestId = crypto.randomUUID(), authToken, fetchImpl = fetch } = opts;
  const res = await fetchImpl("/api/paypal/refund", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authToken ? { authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ captureId: p.captureId, amount: p.amount, requestId }),
  });
  const data = (await res.json().catch(() => ({}))) as AgentRefundResult & { error?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? data.error ?? `refund failed (${res.status})`);
  return data;
}
