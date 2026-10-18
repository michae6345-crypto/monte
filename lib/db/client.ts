// Supabase access. Two clients, on purpose.
//
// The browser client carries the signed-in user's JWT, so row-level security applies to
// every query it makes: a user can only ever see their own rows, enforced by the database
// rather than by us remembering to filter. The service client bypasses RLS and is only
// ever imported from route handlers, never from a component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const dbConfigured = Boolean(url && publishable);

/** Browser-side. RLS applies. Safe to use anywhere. */
export function browserDb(): SupabaseClient | null {
  if (!url || !publishable) return null;
  return createClient(url, publishable);
}

/** Server-side only. Bypasses RLS, so never import this into a client component. */
export function serviceDb(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false } });
}

/** Every route answers the same way when the backend isn't wired up, so the app can
 *  always fall back to the demo people instead of erroring. */
export const notConfigured = {
  error: "db_not_configured",
  detail: "No Supabase keys on this deployment. The app runs on its demo people.",
} as const;
