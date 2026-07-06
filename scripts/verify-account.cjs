#!/usr/bin/env node
/**
 * Standalone AgentMail account check.
 *
 * - Runs the drift guard (env email vs saved config.email) — exits 1 on mismatch.
 * - Resolves the effective AgentMail email (env precedence, then config).
 * - If a saved tenant/config exists, prints the resolved email + tenant and
 *   confirms which account will be billed.
 *
 * This spends nothing and creates nothing — it is a safe pre-flight check.
 */
const fs = require('fs');
const {
  CONFIG_FILE,
  resolveEmail,
  resolveEnvEmail,
  assertNoEmailDrift,
} = require('./_api.cjs');

(function main() {
  // Refuse (exit 1) if env email drifts from the saved config's email.
  assertNoEmailDrift();

  const envEmail = resolveEnvEmail();

  if (!fs.existsSync(CONFIG_FILE)) {
    if (envEmail) {
      console.log(`ℹ️  No saved account yet. Signup would use: ${envEmail}`);
    } else {
      console.log('❌ No AgentMail found — please contact support to fix it.');
      process.exit(1);
    }
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const email = resolveEmail(config);
  console.log('✅ AgentBase account verified');
  console.log(`   Tenant: ${config.tenant_id}`);
  console.log(`   Email (billed): ${email}`);
  if (envEmail && envEmail === config.email) {
    console.log('   Env email matches saved config — safe to run.');
  } else if (!envEmail) {
    console.log('   (env email unset — using saved config email)');
  }
})();
