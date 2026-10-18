"use client";

// A store's own logo, fetched from the store's site (public/merchants, sources in
// public/merchants/SOURCES.json). Until a logo is on file, a quiet monogram stands in.

import { cn } from "@/lib/utils";
import { MERCHANT_LOGOS } from "./merchant-logos";

export const merchantSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function MerchantLogo({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const file = MERCHANT_LOGOS[merchantSlug(name)];
  const box = cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-[6px] bg-white shadow-[0_0_0_1px_var(--m-line)]", className);
  if (file)
    return (
      <span className={box} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/merchants/${file}`} alt="" width={size} height={size} className="h-[82%] w-[82%] object-contain" loading="lazy" draggable={false} />
      </span>
    );
  return (
    <span className={cn(box, "m-num bg-[var(--m-wash)] text-ace-dim")} style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
      {name.replace(/^the /i, "").charAt(0).toUpperCase()}
    </span>
  );
}
