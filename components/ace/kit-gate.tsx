"use client";

import { useSyncExternalStore } from "react";
import { BrandSwitcher } from "./brands";

const noop = () => () => {};
const wanted = () => {
  const q = new URLSearchParams(window.location.search);
  return q.has("kit") || q.has("logo") || q.has("theme") || q.has("type");
};

/** The brand kit only shows with ?kit (or ?logo=/theme=/type=) in the URL, so it never sits over a pitch. */
export function KitGate() {
  const on = useSyncExternalStore(noop, wanted, () => false);
  return on ? <BrandSwitcher /> : null;
}
