// Lets `node` run the .ts files in scripts/ directly (Node 24 strips the types itself)
// by resolving the tsconfig "@/*" path alias, which Node does not read. No new deps.
//
//   node --import ./scripts/_alias.mjs scripts/plaid-fixture-test.ts
//   node --import ./scripts/_alias.mjs scripts/print.ts
//
// Keep this in sync with tsconfig.json "paths" if that ever gains more than "@/*".

import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const EXTS = ["", ".ts", ".tsx", ".mts", ".js", ".json", "/index.ts", "/index.tsx", "/index.js"];

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function resolveAlias(specifier) {
  const rest = specifier.slice(2); // drop "@/"
  for (const ext of EXTS) {
    const candidate = new URL(rest + ext, ROOT);
    if (isFile(candidate)) return candidate.href;
  }
  return new URL(rest, ROOT).href;
}

/** TypeScript sources import "./catalog", not "./catalog.ts"; plain Node needs the real
 *  file name. Try the extensions in order, as the bundler would. */
function resolveRelative(specifier, parentURL) {
  if (!parentURL) return null;
  for (const ext of EXTS) {
    const candidate = new URL(specifier + ext, parentURL);
    if (isFile(candidate)) return candidate.href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(resolveAlias(specifier), context);
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const hit = resolveRelative(specifier, context.parentURL);
      if (hit) return nextResolve(hit, context);
    }
    return nextResolve(specifier, context);
  },
  // The bundler resolves `import x from "./x.json"` on its own; plain Node insists on an
  // `with { type: "json" }` attribute the TypeScript sources do not carry. Supply it here
  // so data/*.json imports work unmodified.
  load(url, context, nextLoad) {
    if (url.endsWith(".json")) {
      return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
    }
    return nextLoad(url, context);
  },
});
