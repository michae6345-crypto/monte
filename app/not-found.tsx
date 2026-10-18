import Link from "next/link";
import { Expect } from "@/components/brand";

// BRAND.md §4, #27: a missing page is an expectation with no value.
export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--m-ground)] px-5 text-center text-[var(--m-ink)]">
      <div>
        <p className="text-5xl md:text-7xl">
          <Expect of="page">undefined</Expect>
        </p>
        <p className="mt-6 text-lg">There&apos;s no page here.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Back to Monte <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
