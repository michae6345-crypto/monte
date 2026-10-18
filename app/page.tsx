import { AceProvider } from "@/components/ace/store";
import { BrandProvider } from "@/components/ace/brands";
import { KitGate } from "@/components/ace/kit-gate";
import { Hero, Nav, NextYear } from "@/components/ace/hero";
import { ReceiptSection } from "@/components/ace/receipt";
import { MoneySection } from "@/components/ace/money";
import { HistorySection } from "@/components/ace/history";
import { ReplaySection } from "@/components/ace/replay";
import { TapSection } from "@/components/ace/tap";
import { ForYouSection, KeepSection } from "@/components/ace/keep";
import { Footer, HowSection, MoatSection } from "@/components/ace/moat";
import { RealSection } from "@/components/ace/real";
import { WrappedSection } from "@/components/ace/wrapped";
import { PayoffSection } from "@/components/ace/payoff";
import { OddChargesSection } from "@/components/ace/odd";
import { Presenter } from "@/components/ace/presenter";
import { TapDemo } from "@/components/ace/tap-demo";
import { Chapters } from "@/components/ace/chapters";
import { LeaksSection } from "@/components/ace/leaks";

// The pitch in seven beats: the cards, your year, the receipt, the misses, the register,
// the plan, next year, and how it works. Secondary views live as tabs inside each beat.
export default function Home() {
  return (
    <BrandProvider>
      <AceProvider>
        <div>
          <Nav />
          <main>
            <Hero />
            <Chapters
              sections={{
                money: <MoneySection />,
                wrapped: <WrappedSection />,
                receipt: <ReceiptSection />,
                replay: <ReplaySection />,
                history: <HistorySection />,
                odd: <OddChargesSection />,
                tap: <TapSection />,
                payoff: <PayoffSection />,
                keep: <KeepSection />,
                apply: <ForYouSection />,
                next: <NextYear />,
                how: <HowSection />,
                real: <RealSection />,
                moat: <MoatSection />,
                leaks: <LeaksSection />,
              }}
            />
          </main>
          <Footer />
          <KitGate />
          <Presenter />
          <TapDemo />
        </div>
      </AceProvider>
    </BrandProvider>
  );
}
