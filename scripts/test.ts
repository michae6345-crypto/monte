// Every engine test in one run (node:test, no new dependencies, no npm test script):
// JITI_ALIAS='{"@":"<worktree abs path>"}' npx jiti scripts/test.ts
// Exits non-zero if any test fails. The two files can also be run on their own.
import "@/tests/engine.test";
import "@/tests/provenance.test";
