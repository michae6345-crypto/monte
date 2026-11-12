// Server-only PayPal plumbing: config, OAuth and the two Orders v2 calls, the same shape as
// lib/data/plaid-server.ts. Nothing here throws at import time, and without keys every
// /api/paypal/* route answers 503 {"error":"paypal_not_configured"}, so the app still runs.
//
// Sandbox only, on purpose: the base URL is a constant and any other PAYPAL_ENV counts as
// not configured, so live credentials can't move real money through this code.

import { encodeOrderRef, type CheckoutPlan } from "@/lib/paypal/plan";

export const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const TIMEOUT_MS = 15_000;
const NO_STORE = { "cache-control": "no-store" };

export function paypalConfigured(): boolean {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "sandbox" && Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function notConfigured(): Response {
  return Response.json({ error: "paypal_not_configured" }, { status: 503, headers: NO_STORE });
}

export function failure(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: NO_STORE });
}

/** A body that isn't a JSON object reads as empty and fails validation, not with a 500. */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type ErrorBody = { name?: string; message?: string; debug_id?: string; details?: { issue?: string }[] };

export class PayPalError extends Error {
  status: number;
  name: string;
  issue: string | null;
  debugId: string | null;
  constructor(status: number, body: ErrorBody) {
    super(body.message ?? `PayPal returned ${status}`);
    this.status = status;
    this.name = body.name ?? "PAYPAL_ERROR";
    this.issue = body.details?.[0]?.issue ?? null;
    this.debugId = body.debug_id ?? null;
  }
}

/** PayPal's own reason, never a credential, so the UI can tell "try again" from "already paid". */
export function paypalFailure(e: unknown): Response {
  if (e instanceof PayPalError) {
    if (e.issue === "ORDER_ALREADY_CAPTURED") return failure(409, "already_captured");
    if (e.issue === "ORDER_NOT_APPROVED") return failure(409, "not_approved");
    if (e.issue === "INSTRUMENT_DECLINED") return failure(402, "instrument_declined");
    return failure(502, "paypal_error", { paypal_status: e.status, name: e.name, issue: e.issue, debug_id: e.debugId });
  }
  console.warn("paypal: request failed:", (e as Error).message);
  return failure(502, "paypal_error");
}

let token: { clientId: string; value: string; expires: number } | null = null;

/** OAuth client-credentials token, cached until a minute before it expires. Exported for
 *  other server-side PayPal calls; it never leaves the server. */
export async function accessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  if (token && token.clientId === clientId && token.expires > Date.now()) return token.value;
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as ErrorBody & { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new PayPalError(res.status, data);
  token = { clientId, value: data.access_token, expires: Date.now() + ((data.expires_in ?? 0) - 60) * 1000 };
  return data.access_token;
}

async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${PAYPAL_API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as T & ErrorBody;
  if (!res.ok) throw new PayPalError(res.status, data);
  return data;
}

export type CreatedOrder = { id: string; status: string; value: string };

/** Create the order for a plan. The amount and the remembered card come from the plan, which
 *  came from the engine: no caller, the agent included, can set either one. */
export async function createOrderForPlan(plan: CheckoutPlan): Promise<CreatedOrder> {
  const { merchant, category } = plan.purchase;
  const order = await post<{ id: string; status: string }>("/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: "monte",
        custom_id: encodeOrderRef(plan),
        description: `${merchant} (${category.replace(/_/g, " ")}), Monte sandbox demo`.slice(0, 127),
        amount: { currency_code: "USD", value: plan.orderValue },
      },
    ],
  });
  return { id: order.id, status: order.status, value: plan.orderValue };
}

type CaptureBody = {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: { id: string; status: string; custom_id?: string; amount?: { currency_code: string; value: string } }[] };
  }[];
};

export type CapturedOrder = {
  orderId: string;
  status: string;
  captureId: string | null;
  captureStatus: string | null;
  value: string | null;
  currency: string | null;
  customId: string | null;
};

/** Capture an approved order. No PayPal-Request-Id: a replay would return the old success and
 *  count the purchase against its cap twice, while a true retry fails with
 *  ORDER_ALREADY_CAPTURED and changes nothing. */
export async function captureOrder(orderId: string): Promise<CapturedOrder> {
  const order = await post<CaptureBody>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { prefer: "return=representation" });
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    orderId: order.id,
    status: order.status,
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    value: capture?.amount?.value ?? null,
    currency: capture?.amount?.currency_code ?? null,
    customId: capture?.custom_id ?? unit?.custom_id ?? null,
  };
}

// ---------- refunds ----------

export type CaptureDetails = { captureId: string; status: string; value: string | null; currency: string | null; customId: string | null };

/** What PayPal itself says a capture was for: the refund route trusts this, not the browser. */
export async function getCapture(captureId: string): Promise<CaptureDetails> {
  const res = await fetch(`${PAYPAL_API}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
    method: "GET",
    headers: { authorization: `Bearer ${await accessToken()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as ErrorBody & {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { currency_code: string; value: string };
  };
  if (!res.ok) throw new PayPalError(res.status, data);
  return {
    captureId: data.id ?? captureId,
    status: data.status ?? "UNKNOWN",
    value: data.amount?.value ?? null,
    currency: data.amount?.currency_code ?? null,
    customId: data.custom_id ?? null,
  };
}

export type RefundResult = { refundId: string; status: string; value: string | null; currency: string | null; requestId: string };

/** Refund a capture, in full (no amount) or in part ("12.34" USD). The PayPal-Request-Id makes
 *  a retry with the same id return the first refund instead of refunding twice. */
export async function refundCapture(captureId: string, amount?: string, requestId: string = crypto.randomUUID()): Promise<RefundResult> {
  const body = amount ? { amount: { currency_code: "USD", value: amount } } : {};
  const r = await post<{ id: string; status: string; amount?: { currency_code: string; value: string } }>(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    body,
    { prefer: "return=representation", "paypal-request-id": requestId },
  );
  return { refundId: r.id, status: r.status, value: r.amount?.value ?? amount ?? null, currency: r.amount?.currency_code ?? null, requestId };
}
