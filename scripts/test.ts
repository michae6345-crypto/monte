// Every engine test in one run (node:test, no new dependencies, no npm test script):
// JITI_ALIAS='{"@":"<worktree abs path>"}' npx jiti scripts/test.ts
// Exits non-zero if any test fails. The two files can also be run on their own.
import "@/tests/engine.test";
import "@/tests/provenance.test";
import "@/tests/paypal.test";
import "@/tests/paylater.test";
import "@/tests/plaid-recurring.test";
import "@/tests/paypal-transactions.test";
import "@/tests/paypal-refund.test";
import "@/tests/paypal-order-detail.test";
import "@/tests/paypal-webhook.test";
import "@/tests/paypal-agent-refund.test";
