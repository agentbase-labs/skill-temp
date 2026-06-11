#!/usr/bin/env node
/**
 * DEPRECATED — crypto wallet funding has been removed.
 *
 * AgentBase now uses billing model B (in-app credits, keyed by the tenant's
 * email; 1 credit = 1 USD). There is no per-tenant crypto wallet to fund and
 * the `/wallet/*` endpoints no longer exist. Sending crypto does nothing.
 *
 * To fund usage: add credits to the tenant's email account in the agentic app.
 * Insufficient credits surface at spend time as HTTP 402 (insufficient_credits),
 * and downstream failures auto-refund.
 */
console.error(
  '❌ auto-fund is deprecated. AgentBase uses in-app credits (1 credit = 1 USD),\n' +
  '   keyed by the tenant email. Add credits to that email account in the app.\n' +
  '   There is no crypto wallet and no /wallet endpoints anymore.'
);
process.exit(1);

module.exports = {
  autoFund: async () => {
    throw new Error('auto-fund is deprecated; AgentBase uses in-app credits keyed by tenant email.');
  },
};
