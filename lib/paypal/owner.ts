// Binds a PayPal capture to the browser that paid for it. A successful capture sets an httpOnly
// cookie holding an HMAC-signed list of that browser's last 20 captureIds; refunding (by hand or
// through the agent) needs the captureId in a validly signed cookie, so knowing an id isn't enough.
//
// Signed with MONTE_SESSION_SECRET, or PAYPAL_CLIENT_SECRET when that isn't set (so no new env
// var is required). Without either, nothing is signed and nothing verifies.

import { createHmac, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "monte_captures";
export const MAX_OWNED = 20;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const CAPTURE_ID = /^[A-Za-z0-9]{5,64}$/;

function secret(): string | null {
  return process.env.MONTE_SESSION_SECRET || process.env.PAYPAL_CLIENT_SECRET || null;
}

const mac = (key: string, payload: string) => createHmac("sha256", key).update(`${OWNER_COOKIE}:${payload}`).digest("base64url");

/** "<base64url JSON ids>.<base64url HMAC>". null without a secret. */
export function signCaptures(ids: string[]): string | null {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify(ids)).toString("base64url");
  return `${payload}.${mac(key, payload)}`;
}

/** The captureIds in a signed value; [] for anything missing, malformed or tampered with. */
export function verifyCaptures(value: string | null | undefined): string[] {
  const key = secret();
  if (!key || !value) return [];
  const dot = value.indexOf(".");
  if (dot < 1) return [];
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(key, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return [];
  try {
    const ids: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === "string" && CAPTURE_ID.test(id)).slice(0, MAX_OWNED);
  } catch {
    return [];
  }
}

/** Newest first, no duplicates, at most MAX_OWNED. */
export function addCapture(ids: string[], captureId: string): string[] {
  return [captureId, ...ids.filter((id) => id !== captureId)].slice(0, MAX_OWNED);
}

/** The raw cookie value from a request's Cookie header. */
export function ownerCookieValue(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === OWNER_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

/** The captureIds this browser has paid for, per its signed cookie. */
export function ownedCaptures(req: Request): string[] {
  return verifyCaptures(ownerCookieValue(req));
}

export function ownsCapture(req: Request, captureId: string): boolean {
  return ownedCaptures(req).includes(captureId);
}

/** A Set-Cookie header value that adds captureId to the request's list. null without a secret. */
export function ownerSetCookie(req: Request, captureId: string): string | null {
  const value = signCaptures(addCapture(ownedCaptures(req), captureId));
  if (!value) return null;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OWNER_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}
