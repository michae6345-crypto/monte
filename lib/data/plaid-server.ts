// Server-only Plaid plumbing: the client, the access-token cookie and the error shapes
// every /api/plaid/* route returns. No mapping logic lives here (see lib/data/plaid.ts).
//
// There may be no Plaid keys at all: nothing in here throws at import time, and every
// route answers 503 {"error":"plaid_not_configured"} when the env is unset, so the app
// still builds and still runs on the personas.

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

/** Sandbox-only hackathon shortcut: the Plaid access_token is kept in an httpOnly
 *  cookie instead of a database. Sandbox tokens only ever reach fake institutions and
 *  we have no users, no sessions and no server state. This is NOT safe for production
 *  Plaid credentials: a real deployment stores access tokens server-side, encrypted,
 *  keyed by a user id. */
export const PLAID_COOKIE = "monte_plaid_access_token";
export const PLAID_COOKIE_MAX_AGE = 60 * 60 * 8; // the length of a hackathon demo day

export type PlaidEnvName = keyof typeof PlaidEnvironments;

export function plaidEnvName(): PlaidEnvName {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  return raw in PlaidEnvironments ? (raw as PlaidEnvName) : "sandbox";
}

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/** null when PLAID_CLIENT_ID / PLAID_SECRET are unset - the caller returns 503. */
export function plaidClient(): PlaidApi | null {
  if (!plaidConfigured()) return null;
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[plaidEnvName()],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
          "Plaid-Version": "2020-09-14",
        },
      },
    }),
  );
}

/** The one documented failure mode when no keys exist. */
export function notConfigured(): Response {
  return Response.json(
    { error: "plaid_not_configured" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

export function notLinked(): Response {
  return Response.json(
    { error: "plaid_not_linked" },
    { status: 409, headers: { "cache-control": "no-store" } },
  );
}

export function badRequest(message: string): Response {
  return Response.json({ error: "bad_request", message }, { status: 400, headers: { "cache-control": "no-store" } });
}

type PlaidErrorBody = { error_code?: string; error_message?: string; error_type?: string; request_id?: string };

/** Plaid errors arrive as an axios error with the real reason in response.data. Pass the
 *  Plaid error_code through (never the key) so the UI can tell "try again" apart from
 *  "this item is broken". */
export function plaidFailure(e: unknown): Response {
  const res = (e as { response?: { status?: number; data?: PlaidErrorBody } }).response;
  const data = res?.data ?? {};
  return Response.json(
    {
      error: "plaid_error",
      code: data.error_code ?? null,
      type: data.error_type ?? null,
      message: data.error_message ?? (e instanceof Error ? e.message : "Plaid request failed"),
      request_id: data.request_id ?? null,
    },
    { status: 502, headers: { "cache-control": "no-store" } },
  );
}

/** Render terminates TLS at its proxy, so trust x-forwarded-proto first; locally this is
 *  http, which is what lets `curl` drive the whole flow without https. */
export function isHttps(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function accessTokenCookie(req: Request, accessToken: string) {
  return {
    name: PLAID_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: PLAID_COOKIE_MAX_AGE,
  };
}

/** Body parsing that tolerates an empty body: `curl -X POST` with no -d is the normal
 *  way we call these on stage. */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
