"use client";

import { card } from "@/lib/engine/catalog";
import { cn } from "@/lib/utils";

// Our own abstract art per card: issuer-ish colours, no logos.
const ART: Record<string, { bg: string; ink: string; foil?: string }> = {
  chase_sapphire_preferred: { bg: "linear-gradient(135deg,#0b2a5b,#123c7c 55%,#0a1f44)", ink: "#e6eefc" },
  chase_sapphire_reserve: { bg: "linear-gradient(135deg,#0d1b33,#1d2e4f 50%,#09111f)", ink: "#dfe7f5", foil: "#9db0d6" },
  chase_freedom_unlimited: { bg: "linear-gradient(135deg,#1263b8,#1b84e8 60%,#0d4c90)", ink: "#f2f8ff" },
  chase_freedom_flex: { bg: "linear-gradient(135deg,#1f3d7a,#3b64c2 60%,#16306a)", ink: "#f2f8ff" },
  chase_prime_visa: { bg: "linear-gradient(135deg,#0f1b2d,#22344f 60%,#0b1422)", ink: "#cfe3ff" },
  amex_gold: { bg: "linear-gradient(135deg,#b88a2e,#f0cf7a 45%,#c99a3c 70%,#8f6620)", ink: "#2b1e05", foil: "#fff3c8" },
  amex_platinum: { bg: "linear-gradient(135deg,#9aa3ad,#e6e9ee 45%,#b3bac3 70%,#7d858f)", ink: "#1c2128", foil: "#ffffff" },
  amex_blue_cash_preferred: { bg: "linear-gradient(135deg,#0a5cbf,#2f86ea 55%,#0748a0)", ink: "#f2f7ff" },
  amex_blue_cash_everyday: { bg: "linear-gradient(135deg,#4aa7e8,#86c8f5 55%,#3b8fd0)", ink: "#06253d" },
  capital_one_savor: { bg: "linear-gradient(135deg,#6b1e1e,#a3302c 55%,#4d1414)", ink: "#ffeceb" },
  capital_one_venture: { bg: "linear-gradient(135deg,#2a3a4a,#43596e 55%,#1f2b37)", ink: "#eef4f9" },
  capital_one_venture_x: { bg: "linear-gradient(135deg,#111316,#2a2e33 55%,#0b0c0e)", ink: "#e7e7e7", foil: "#a3a9b2" },
  capital_one_quicksilver: { bg: "linear-gradient(135deg,#7d858c,#c3c8cc 55%,#6c7378)", ink: "#141619" },
  capital_one_quicksilver_student: { bg: "linear-gradient(135deg,#5d6b74,#9fb0ba 55%,#4b5860)", ink: "#0f1418" },
  capital_one_platinum_secured: { bg: "linear-gradient(135deg,#3e4650,#6c7684 55%,#2f353d)", ink: "#eef1f5" },
  citi_double_cash: { bg: "linear-gradient(135deg,#0b6e78,#16a3ae 55%,#085860)", ink: "#eafcfd" },
  citi_custom_cash: { bg: "linear-gradient(135deg,#0f8c7a,#3cc9b0 55%,#0b6e60)", ink: "#04201b" },
  citi_strata_premier: { bg: "linear-gradient(135deg,#1c2433,#33405a 55%,#141a25)", ink: "#e9eef7", foil: "#8fa4c8" },
  discover_it_cash_back: { bg: "linear-gradient(135deg,#d9692a,#f39a4e 55%,#b8531c)", ink: "#2a1206" },
  discover_it_student_cash_back: { bg: "linear-gradient(135deg,#2f6d8f,#58a3c7 55%,#24576f)", ink: "#06202d" },
  discover_it_secured: { bg: "linear-gradient(135deg,#4a4f57,#7d848e 55%,#393d44)", ink: "#f1f3f5" },
  wells_fargo_active_cash: { bg: "linear-gradient(135deg,#8c1018,#c8202a 55%,#6b0b12)", ink: "#fff1d6", foil: "#ffcd41" },
  wells_fargo_autograph: { bg: "linear-gradient(135deg,#1a1a1a,#3a3a3a 55%,#0f0f0f)", ink: "#f2e2b6", foil: "#d9b45a" },
  bofa_customized_cash_rewards: { bg: "linear-gradient(135deg,#b3122e,#e2374f 55%,#8a0d22)", ink: "#fff0f2" },
  apple_card: { bg: "linear-gradient(135deg,#e9e9ec,#ffffff 45%,#d7d8dc 75%,#c3c4c9)", ink: "#1d1d1f" },
  bilt_blue: { bg: "linear-gradient(135deg,#1f3fbf,#3c64ff 55%,#152c8c)", ink: "#eef2ff" },
  bilt_obsidian: { bg: "linear-gradient(135deg,#0c0c0e,#24242a 55%,#060607)", ink: "#e6e6ea", foil: "#8a8a96" },
  bilt_palladium: { bg: "linear-gradient(135deg,#8d8f93,#d9dade 45%,#a5a7ac 70%,#6f7175)", ink: "#141518" },
  us_bank_altitude_go: { bg: "linear-gradient(135deg,#0b3a2e,#16684f 55%,#08291f)", ink: "#e8fff6" },
};

export function cardArt(id: string) {
  return ART[id] ?? { bg: "linear-gradient(135deg,#2a2a33,#45454f)", ink: "#f4f4f6" };
}

export function shortName(id: string) {
  return card(id)
    .name.replace("American Express", "Amex")
    .replace("Card from American Express", "")
    .replace(" Credit Card", "")
    .replace("Cash Back", "")
    .trim();
}

export function CardArt({
  id,
  className,
  size = "md",
  dim,
}: {
  id: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  dim?: boolean;
}) {
  const c = card(id);
  const a = cardArt(id);
  const pad = size === "sm" ? "p-2" : size === "lg" ? "p-5" : "p-3.5";
  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] select-none overflow-hidden rounded-[7%/11%] shadow-[0_20px_40px_-12px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.25)]",
        pad,
        dim && "opacity-40 saturate-50",
        className,
      )}
      style={{ background: a.bg, color: a.ink }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
        style={{ background: "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,.55), transparent 55%)" }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("mono uppercase leading-tight tracking-wider opacity-80", size === "sm" ? "text-[6px]" : "text-[9px]")}>
            {id === "apple_card" ? "Apple" : c.issuer.replace("American Express", "Amex").replace(/\s*\(.*\)\s*/, "")}
          </span>
          {size !== "sm" && (
            <span className="mono text-[9px] uppercase tracking-wider opacity-70">{c.annual_fee ? `$${c.annual_fee}/yr` : "no fee"}</span>
          )}
        </div>
        <div
          className={cn("rounded-[3px]", size === "sm" ? "h-2 w-3" : "h-5 w-7")}
          style={{ background: `linear-gradient(135deg, ${a.foil ?? "#e8d08a"}, #b89a4a 60%, ${a.foil ?? "#f3e3a8"})` }}
        />
        <div className={cn("font-medium leading-tight", size === "sm" ? "text-[7px]" : size === "lg" ? "text-lg" : "text-[13px]")}>
          {shortName(id)}
        </div>
      </div>
    </div>
  );
}
