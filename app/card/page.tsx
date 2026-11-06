import type { Metadata } from "next";
import { CardLab } from "@/components/card/card-lab";

export const metadata: Metadata = {
  title: "The Monte card: one card, every purchase played right",
  description: "A working MVP of the Monte card: the authorization request a card network sends, answered by Monte with the card in your wallet that should play it.",
};

export default function CardPage() {
  return <CardLab />;
}
