// The site's Monte Carlo is the engine's (lib/engine/montecarlo.ts, Michael's): every
// simulated year is replayed through the card rules, so caps reset per year. This file
// keeps the import path the screens already use.
export { monteCarlo, monteCarloSamples, mcLabel, carriesBalance } from "@/lib/engine/montecarlo";
export type { Band, Outcome, MonteCarloResult, MonteCarloOpts } from "@/lib/engine/montecarlo";
