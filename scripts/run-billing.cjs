#!/usr/bin/env node
/**
 * Run the monthly recurring billing on demand (ops / testing).
 *
 * Charges every live, billable Render resource (databases + compute services)
 * its monthly cost for the current billing period. Idempotent per period —
 * resources already billed this month are skipped. On insufficient credits a
 * resource enters the dunning lifecycle (past-due → suspend after 3 days →
 * hard-delete after 30 days).
 *
 * The monthly cron fires automatically on the 1st (00:00 UTC); this is the
 * manual trigger for ops/testing between cron fires.
 *
 * Calls POST /billing/run (no body).
 */
const { api } = require('./_api.cjs');

(async () => {
  let r;
  try {
    r = await api('/billing/run', 'POST');
  } catch (e) {
    throw e;
  }

  console.log('✅ Billing run complete');
  console.log(`   Period:          ${r.period ?? '(current)'}`);
  console.log(`   Databases charged: ${r.databasesCharged ?? 0}`);
  console.log(`   Services charged:  ${r.servicesCharged ?? 0}`);
  console.log(`   Total charged:     $${(r.totalCharged ?? 0).toFixed ? r.totalCharged.toFixed(2) : r.totalCharged}`);
  console.log(`   Past-due (402):    ${r.pastDue ?? 0}`);
  console.log(`   Suspended:         ${r.suspended ?? 0}`);
  console.log(`   Hard-deleted:      ${r.hardDeleted ?? 0}`);
  console.log(`   Skipped:           ${r.skipped ?? 0}`);
  console.log(`   Errors:            ${r.errors ?? 0}`);

  if ((r.pastDue ?? 0) > 0 || (r.suspended ?? 0) > 0) {
    console.log('\n⚠️  Some resources hit insufficient credits and entered dunning.');
    console.log('    Add credits to the account email, then run retry-dunning.cjs to recover them.');
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
