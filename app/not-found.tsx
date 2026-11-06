import type { Metadata } from "next";
import Link from "next/link";
import { Expect } from "@/components/brand";

export const metadata: Metadata = { title: "Not found · Monte" };

// BRAND.md §4, #27: a missing page is an expectation with no value.
export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--m-ground)] px-5 text-center text-[var(--m-ink)]">
      <div className="max-w-full">
        {/* sized to the screen so "𝔼[page] = undefined" stays on one line on a phone */}
        <p className="whitespace-nowrap text-[clamp(1.6rem,8.5vw,4.5rem)]">
          <Expect of="page">undefined</Expect>
        </p>
        <p className="mt-6 text-lg">There&apos;s no page here.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/app" className="btn btn-primary">
            Open the app <span aria-hidden>→</span>
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back to Monte
          </Link>
        </div>
      </div>
    </main>
  );
}
