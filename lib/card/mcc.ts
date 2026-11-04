// Merchant category codes -> Monte's categories. Every card authorization carries the store's
// MCC (ISO 18245), assigned by its acquiring bank: the same code the issuers' bonus rules key
// on. So at the moment of payment there's no guessing which store you're at or what it counts
// as: the network says. ("How do you know the merchant before the tap?" has this answer for
// a card Monte issues.)
//
// Ranges follow the published MCC list (Visa Merchant Data Standards Manual; Mastercard Quick
// Reference Booklet). Airline (3000-3350) and hotel (3501-3999) codes are the brand-specific
// blocks; everything not listed is "everything_else".

const EXACT: Record<string, string> = {
  // groceries: grocery stores and supermarkets, plus specialty food stores
  "5411": "groceries", "5422": "groceries", "5441": "groceries", "5451": "groceries", "5462": "groceries", "5499": "groceries",
  // dining: restaurants, bars, fast food
  "5811": "dining", "5812": "dining", "5813": "dining", "5814": "dining",
  // gas
  "5541": "gas", "5542": "gas", "5983": "gas",
  // EV charging (Visa added 5552 in 2022)
  "5552": "ev_charging",
  // getting around
  "4111": "transit", "4112": "transit", "4131": "transit", "4784": "transit", "7523": "transit",
  "4121": "rideshare",
  "4511": "airfare", "4582": "airfare",
  "7011": "hotels", "4722": "travel_portal",
  // bills
  "4814": "phone", "4812": "phone",
  "4899": "streaming", "5815": "streaming", "5817": "streaming", "5818": "streaming",
  "4900": "utilities",
  "6513": "rent",
  // shopping
  "5300": "wholesale_clubs",
  "5912": "drugstores",
  "5200": "home_improvement", "5211": "home_improvement", "5251": "home_improvement", "5231": "home_improvement",
  "7832": "entertainment", "7922": "entertainment", "7991": "entertainment", "7996": "entertainment", "7998": "entertainment", "7999": "entertainment", "7933": "entertainment",
  "5964": "online_retail", "5965": "online_retail", "5969": "online_retail",
};

const LABEL: Record<string, string> = {
  "5411": "Grocery stores, supermarkets",
  "5812": "Eating places, restaurants",
  "5814": "Fast food restaurants",
  "5813": "Bars, taverns",
  "5541": "Service stations",
  "5542": "Automated fuel dispensers",
  "5552": "Electric vehicle charging",
  "4121": "Taxicabs and rideshare",
  "4111": "Local and suburban commuter transport",
  "4511": "Airlines",
  "7011": "Hotels, motels, resorts",
  "4814": "Telecommunication services",
  "4899": "Cable, satellite and streaming",
  "4900": "Utilities",
  "5300": "Wholesale clubs",
  "5912": "Drug stores and pharmacies",
  "5200": "Home supply warehouse stores",
  "7832": "Motion picture theaters",
  "5942": "Book stores",
  "5999": "Miscellaneous retail",
  "5310": "Discount stores",
  "5311": "Department stores",
};

export function categoryForMcc(mcc: string): string {
  const m = (mcc ?? "").trim().padStart(4, "0");
  if (EXACT[m]) return EXACT[m];
  const n = Number(m);
  if (n >= 3000 && n <= 3350) return "airfare"; // airlines by brand
  if (n >= 3351 && n <= 3500) return "everything_else"; // car rental by brand
  if (n >= 3501 && n <= 3999) return "hotels"; // hotels by brand
  return "everything_else";
}

export function mccLabel(mcc: string): string {
  const m = (mcc ?? "").trim().padStart(4, "0");
  const n = Number(m);
  if (LABEL[m]) return LABEL[m];
  if (n >= 3000 && n <= 3350) return "Airline";
  if (n >= 3501 && n <= 3999) return "Hotel";
  return "Merchant category " + m;
}

/** Stores to try the card on, each with the MCC its acquirer would send. */
export const SAMPLE_MERCHANTS: { descriptor: string; mcc: string; amount: number }[] = [
  { descriptor: "TRADER JOE'S #071", mcc: "5411", amount: 64.2 },
  { descriptor: "SWEETGREEN LA BREA", mcc: "5812", amount: 18.45 },
  { descriptor: "SHELL OIL 57444", mcc: "5541", amount: 52.1 },
  { descriptor: "UBER *TRIP", mcc: "4121", amount: 23.6 },
  { descriptor: "DELTA AIR LINES", mcc: "3058", amount: 318 },
  { descriptor: "CVS/PHARMACY #9213", mcc: "5912", amount: 23.8 },
  { descriptor: "NETFLIX.COM", mcc: "4899", amount: 15.49 },
  { descriptor: "COSTCO WHSE #0479", mcc: "5300", amount: 186.4 },
  { descriptor: "AMC THEATRES GROVE", mcc: "7832", amount: 34 },
  { descriptor: "TARGET 00012345", mcc: "5310", amount: 72.15 },
];
