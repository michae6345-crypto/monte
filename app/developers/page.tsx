import type { Metadata } from "next";
import { DevDocs } from "@/components/developers/dev-docs";

export const metadata: Metadata = {
  title: "Monte for developers: the right card, in one API call",
  description: "Monte's API for apps that already hold their users' cards: send the cards, the store and the amount; get the card to use and why.",
};

export default function DevelopersPage() {
  return <DevDocs />;
}
