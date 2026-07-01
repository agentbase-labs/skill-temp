#!/usr/bin/env node
/**
 * Retry dunning for the CALLING TENANT'S OWN resources (tenant-scoped).
 *
 * Re-attempts payment for ONLY this account's past-due resources and advances
 * the dunning lifecycle: a successful charge RESUMES a suspended resource and
 * clears past-due; still-unpaid resources are suspended after the grace window
 * and hard-deleted strictly after 30 days past-due. Idempotent — safe to run
 * repeatedly.
 *
 * Typical use: after topping up credits on the account email in the app, run
 * this to resume YOUR OWN suspended site/backend/database without waiting for
 * the daily 06:00 UTC cron. It never touches other tenants' resources.
 *
 * Calls POST /billing/retry-mine (no body) — tenant-scoped, authenticated with
 * the account's own Bearer API key via the shared _api.cjs client.
 *
 * Rate limit: 6 requests/min per tenant. On HTTP 429 (Too Many Requests),
 * back off and retry after ~1 minute — do not hammer.
 */
const { api } = require('./_api.cjs');

(async () => {
  let r;
  try {
    r = await api('/billing/retry-mine', 'POST');
  } catch (e) {
    if (/402|insufficient_credits/i.test(e.message)) {
      console.error('❌ Insufficient credits. Add credits to the account email in the app, then retry.');
      process.exit(1);
    }
    if (/\b429\b|too many requests/i.test(e.message)) {
      console.error('❌ Rate limited (429). Retry-mine is capped at 6/min — wait ~1 minute and try again.');
      process.exit(1);
    }
    throw e;
  }

  console.log("✅ Dunning retry complete for this account's own resources");
  console.log(`   Attempted:      ${r.attempted ?? 0}`);
  console.log(`   Recovered:      ${r.recovered ?? 0} (resumed + billed)`);
  console.log(`   Suspended:      ${r.suspended ?? 0}`);
  console.log(`   Hard-deleted:   ${r.hardDeleted ?? 0}`);
  console.log(`   Still past-due: ${r.stillPastDue ?? 0}`);
  console.log(`   Errors:         ${r.errors ?? 0}`);

  if ((r.recovered ?? 0) > 0) {
    console.log('\n💡 Recovered resources have been resumed on Render and are billing again.');
  }
  if ((r.stillPastDue ?? 0) > 0 || (r.suspended ?? 0) > 0) {
    console.log('\n⚠️  Some resources are still past-due/suspended — add more credits and re-run.');
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
