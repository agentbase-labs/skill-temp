#!/usr/bin/env node
/**
 * DEPRECATED — crypto deposits have been removed.
 *
 * AgentBase no longer accepts crypto deposits and the `/wallet/*` endpoints
 * (including check-deposit) have been deleted. Billing is now model B: in-app
 * credits keyed by the tenant's email (1 credit = 1 USD).
 *
 * There is nothing to "credit" from a tx hash. To fund usage, add credits to
 * the tenant's email account in the agentic app.
 */
console.error(
  '❌ check-deposit is deprecated. AgentBase no longer uses crypto deposits.\n' +
  '   Billing is in-app credits (1 credit = 1 USD) keyed by the tenant email.\n' +
  '   Add credits to that email account in the app instead of sending crypto.'
);
process.exit(1);
