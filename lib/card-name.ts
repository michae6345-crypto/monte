// A card's name as people say it ("Amex Gold Card", "Citi Double Cash Card"). Plain code, so
// server routes can use it too; components/ace/card-art.tsx re-exports it.
import { card } from "@/lib/engine/catalog";

export function shortName(id: string) {
  // "Card from American Express" first: once "American Express" became "Amex" it never matched,
  // and the Blue Cash cards read "Blue Cash Everyday Card from Amex"
  return card(id)
    .name.replace(/\s*Card from American Express/, "")
    .replace("American Express", "Amex")
    .replace(" Credit Card", "")
    .replace("Cash Back", "")
    .trim();
}
