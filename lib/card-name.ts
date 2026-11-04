// A card's name as people say it ("Amex Gold Card", "Amex Platinum", "Citi Double Cash Card").
// Plain code, so server routes can use it too; components/ace/card-art.tsx re-exports it.
import { card } from "@/lib/engine/catalog";

export function shortName(id: string) {
  const name = card(id).name;
  // "The Platinum Card from American Express" -> "Amex Platinum";
  // "Blue Cash Everyday Card from American Express" -> "Amex Blue Cash Everyday"
  const from = /^(?:The\s+)?(.+?)\s+Card from American Express$/.exec(name);
  if (from) return `Amex ${from[1]}`;
  return name
    .replace("American Express", "Amex")
    .replace(" Visa Signature", "")
    .replace(" Credit Card", "")
    .replace("Cash Back", "")
    .trim();
}
