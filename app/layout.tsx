import type { Metadata } from "next";
import { Barlow_Condensed, Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700", "800"], style: ["normal", "italic"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monte: every card, played right",
  description:
    "Picks the right card at every tap, and shows what your cards really cost you after interest, fees and the perks you never use.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} ${unbounded.variable} ${barlow.variable} ${grotesk.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="ace min-h-full">{children}</body>
    </html>
  );
}
