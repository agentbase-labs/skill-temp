#!/usr/bin/env node
/**
 * ⚠️ ADMIN / OPS TOOL — NOT for normal users or agents.
 *
 * Runs the GLOBAL monthly recurring billing sweep across EVERY tenant on
 * demand. Charges every live, billable Render resource (databases + compute
 * services) its monthly cost for the current billing period. Idempotent per
 * period — resources already billed this month are skipped. On insufficient
 * credits a resource enters the dunning lifecycle (past-due → suspend after
 * 3 days → hard-delete after 30 days).
 *
 * The monthly cron fires automatically on the 1st (00:00 UTC); this is the
 * manual ops trigger between cron fires.
 *
 * Calls POST /billing/run (no body). This endpoint is ADMIN-ONLY: it requires
 * an `x-admin-key` header matched against the backend's ADMIN_API_KEY. This
 * script reads that key from (in order):
 *   1. env ADMIN_API_KEY
 *   2. ~/.joni/agentbase/config.json  ->  "admin_api_key"
 * If no admin key is available, the script exits with a clear message.
 *
 * A normal user resuming THEIR OWN suspended resources should use
 * retry-dunning.cjs (POST /billing/retry-mine), NOT this tool.
 *
 * Rate limit: 3 requests / 5 min (global). On HTTP 429, back off ~5 min.
 */
const { api, loadConfig } = require('./_api.cjs');

function resolveAdminKey() {
  if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
  try {
    const cfg = loadConfig();
    if (cfg.admin_api_key) return cfg.admin_api_key;
  } catch (_) { /* config errors surface later via api() */ }
  return null;
}

(async () => {
  const adminKey = resolveAdminKey();
  if (!adminKey) {
    console.error('❌ This is an ADMIN-ONLY ops tool. No admin key found.');
    console.error('   Set env ADMIN_API_KEY, or add "admin_api_key" to ~/.joni/agentbase/config.json.');
    console.error('   (Normal users resuming their own suspended resources should run retry-dunning.cjs instead.)');
    process.exit(1);
  }

  let r;
  try {
    r = await api('/billing/run', 'POST', null, { 'x-admin-key': adminKey });
  } catch (e) {
    if (/\b401\b|\b403\b|forbidden|unauthorized|admin/i.test(e.message)) {
      console.error('❌ Admin auth rejected. Check ADMIN_API_KEY matches the backend ADMIN_API_KEY.');
      process.exit(1);
    }
    if (/\b429\b|too many requests/i.test(e.message)) {
      console.error('❌ Rate limited (429). The global billing run is capped at 3 / 5 min — wait and retry.');
      process.exit(1);
    }
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
