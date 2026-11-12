// /paypal: the PayPal activity table on its own page, for judges who open it directly.
//
// The site's state lives in one page's memory (AceProvider), so checkouts made on the
// walkthrough don't travel here: this page starts a fresh session. The same table is also
// mounted under the checkout panel on the home page, where this session's purchases show up.

import Link from "next/link";
import { AceProvider } from "@/components/ace/store";
import { PayPalActivity } from "@/components/ace/paypal-activity";

export const metadata = { title: "Monte: PayPal activity" };

export default function PayPalPage() {
  return (
    <main className="mx-auto max-w-6xl overflow-x-clip px-4 sm:px-5 py-10 md:px-8 md:py-14">
      <header className="mb-6">
        <Link href="/" className="mono inline-flex min-h-10 items-center text-[11px] uppercase tracking-wider text-[var(--ace-dim)] underline-offset-4 hover:text-[var(--ace-ink)] hover:underline">
          ← back to the walkthrough
        </Link>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">PayPal activity</h1>
        <p className="mt-3 max-w-2xl text-base sm:text-lg text-[var(--ace-dim)]">
          What went through PayPal, which card Monte played, what it earned and what came back. Checkouts
          made in the walkthrough&apos;s register appear under its PayPal panel; here, load the sandbox
          account&apos;s history from PayPal Transaction Search.
        </p>
      </header>
      <AceProvider>
        <PayPalActivity />
      </AceProvider>
    </main>
  );
}
