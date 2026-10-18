import { AceProvider } from "@/components/ace/store";
import { BrandProvider, BrandSwitcher } from "@/components/ace/brands";
import { Hero, Nav } from "@/components/ace/hero";
import { ReceiptSection } from "@/components/ace/receipt";
import { ReplaySection } from "@/components/ace/replay";
import { TapSection } from "@/components/ace/tap";
import { ForYouSection, KeepSection } from "@/components/ace/keep";
import { Footer, HowSection, MoatSection } from "@/components/ace/moat";

export default function Home() {
  return (
    <BrandProvider>
      <AceProvider>
        <div className="grain">
          <Nav />
          <main>
            <Hero />
            <ReceiptSection />
            <ReplaySection />
            <TapSection />
            <KeepSection />
            <ForYouSection />
            <MoatSection />
            <HowSection />
          </main>
          <Footer />
          <BrandSwitcher />
        </div>
      </AceProvider>
    </BrandProvider>
  );
}
