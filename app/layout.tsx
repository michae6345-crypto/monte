import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ace-eta-beryl.vercel.app"),
  title: "Monte: every dollar, played right",
  icons: { icon: "/brand/favicon.svg" },
  description:
    "See where your money goes, stop the leaks (interest, fees, price rises, double charges), spend it on the right card, and plan the next move, from a year of your own purchases.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="ace min-h-full">{children}</body>
    </html>
  );
}
