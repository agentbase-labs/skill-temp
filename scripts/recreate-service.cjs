#!/usr/bin/env node
/**
 * Recreate Render service with correct framework/type.
 * Use when a service was created with the wrong type (e.g., Next.js deployed as static_site).
 * Deletes old service, creates new one with correct config, re-attaches domain if needed.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get, getAll } = parseArgs();
const wf = get('--workflow-id');
if (!wf) {
  console.error('Usage: node recreate-service.cjs --workflow-id <id> [--framework nextjs] [--env KEY=VALUE ...]');
  console.error('\nThis deletes the existing Render service and creates a new one with the correct framework.');
  console.error('If --framework is not provided, it auto-detects from the committed code.');
  console.error('\nExamples:');
  console.error('  node recreate-service.cjs --workflow-id wf_abc123 --framework nextjs');
  console.error('  node recreate-service.cjs --workflow-id wf_abc123   # auto-detect');
  process.exit(1);
}

const framework = get('--framework');

// Collect --env KEY=VALUE pairs
const envPairs = getAll('--env');
const envVars = {};
for (const pair of envPairs) {
  const eq = pair.indexOf('=');
  if (eq > 0) envVars[pair.slice(0, eq)] = pair.slice(eq + 1);
}

(async () => {
  const body = { tenant_id: tenantId(), workflow_id: wf };
  if (framework) body.framework = framework;
  if (Object.keys(envVars).length > 0) body.envVars = envVars;

  const r = await api('/website/recreate-service', 'POST', body);

  console.log(`✅ Service recreated`);
  console.log(`   Old service: ${r.old_service_id}`);
  console.log(`   New service: ${r.new_service_id}`);
  console.log(`   URL: ${r.new_service_url}`);
  console.log(`   Framework: ${r.framework} (${r.service_type})`);
  if (r.next_steps) console.log(`   ⚠️  ${r.next_steps}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
