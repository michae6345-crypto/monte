// Small helpers for what the checkout panel tells people when PayPal says no.

/** When PayPal itself failed, the API routes pass on PayPal's debug_id (see paypalFailure in
 *  lib/paypal/client.ts). Quoting it lets anyone look the call up with PayPal support or in the
 *  sandbox dashboard. Only a plain alphanumeric id is shown, never other response text. */
export function withPayPalRef(text: string, data: unknown): string {
  const id = data && typeof data === "object" ? (data as { debug_id?: unknown }).debug_id : undefined;
  return typeof id === "string" && /^[A-Za-z0-9]{6,40}$/.test(id) ? `${text} PayPal reference: ${id}.` : text;
}
