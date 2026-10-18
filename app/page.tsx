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
import { MonteCardSection } from "@/components/ace/monte-card-section";
import { Presenter } from "@/components/ace/presenter";
import { Chapters } from "@/components/ace/chapters";

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
                card: <MonteCardSection />,
                payoff: <PayoffSection />,
                keep: <KeepSection />,
                apply: <ForYouSection />,
                next: <NextYear />,
                how: <HowSection />,
                real: <RealSection />,
                moat: <MoatSection />,
              }}
            />
          </main>
          <Footer />
          <KitGate />
          <Presenter />
        </div>
      </AceProvider>
    </BrandProvider>
  );
}
