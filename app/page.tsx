import { AceProvider } from "@/components/ace/store";
import { BrandProvider } from "@/components/ace/brands";
import { KitGate } from "@/components/ace/kit-gate";
import { Hero, Nav } from "@/components/ace/hero";
import { ReceiptSection } from "@/components/ace/receipt";
import { MoneySection } from "@/components/ace/money";
import { HistorySection } from "@/components/ace/history";
import { ReplaySection } from "@/components/ace/replay";
import { TapSection } from "@/components/ace/tap";
import { ForYouSection, KeepSection } from "@/components/ace/keep";
import { Footer, HowSection, MoatSection } from "@/components/ace/moat";
import { RealSection } from "@/components/ace/real";
import { WrappedSection } from "@/components/ace/wrapped";
import { Presenter } from "@/components/ace/presenter";

export default function Home() {
  return (
    <BrandProvider>
      <AceProvider>
        <div>
          <Nav />
          <main>
            <Hero />
            <MoneySection />
            <ReceiptSection />
            <HistorySection />
            <ReplaySection />
            <TapSection />
            <KeepSection />
            <ForYouSection />
            <WrappedSection />
            <MoatSection />
            <HowSection />
            <RealSection />
          </main>
          <Footer />
          <KitGate />
          <Presenter />
        </div>
      </AceProvider>
    </BrandProvider>
  );
}
