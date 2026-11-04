import type { Metadata, Viewport } from "next";
import { MonteApp } from "@/components/app/app";

export const metadata: Metadata = {
  title: "Monte: the right card, every time you pay",
  description: "Monte names the card to use wherever you pay, counting interest as well as points. Connect a bank with Plaid, upload a statement, or add your cards.",
  appleWebApp: { capable: true, title: "Monte", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f7f8fa", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function AppPage() {
  return <MonteApp />;
}
