import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monte: every dollar, played right",
  icons: { icon: "/brand/favicon.svg" },
  description:
    "See where your money goes, stop the leaks (interest, fees, price rises, double charges), spend it on the right card, and plan the next move, from a year of your own purchases.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="ace min-h-full">{children}</body>
    </html>
  );
}
