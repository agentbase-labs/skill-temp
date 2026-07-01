#!/usr/bin/env node
/**
 * Run the dunning retry sweep on demand.
 *
 * Re-attempts payment for every past-due resource and advances the dunning
 * lifecycle: a successful charge RESUMES a suspended resource and clears
 * past-due; still-unpaid resources are suspended after the grace window and
 * hard-deleted strictly after 30 days past-due. Idempotent — safe to run
 * repeatedly.
 *
 * Typical use: after topping up credits on the account email in the app, run
 * this to resume a suspended site/backend/database without waiting for the
 * daily 06:00 UTC cron.
 *
 * Calls POST /billing/dunning/retry (no body).
 */
const { api } = require('./_api.cjs');

(async () => {
  let r;
  try {
    r = await api('/billing/dunning/retry', 'POST');
  } catch (e) {
    if (/402|insufficient_credits/i.test(e.message)) {
      console.error('❌ Insufficient credits. Add credits to the account email in the app, then retry.');
      process.exit(1);
    }
    throw e;
  }

  console.log('✅ Dunning retry sweep complete');
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
