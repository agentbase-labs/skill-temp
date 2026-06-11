#!/usr/bin/env node
/**
 * Recreate backend Render service with correct framework.
 * Use when a backend was deployed with the wrong framework config.
 * Deletes old service, creates new one, re-injects DB vars, re-attaches subdomain.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get, getAll } = parseArgs();
const wf = get('--workflow-id');
if (!wf) {
  console.error('Usage: node recreate-backend-service.cjs --workflow-id <id> [--framework nestjs] [--env KEY=VALUE ...]');
  console.error('\nThis deletes the existing backend Render service and creates a new one with the correct framework.');
  console.error('If --framework is not provided, it auto-detects from the committed code.');
  console.error('\nExamples:');
  console.error('  node recreate-backend-service.cjs --workflow-id wf_abc123 --framework nestjs');
  console.error('  node recreate-backend-service.cjs --workflow-id wf_abc123   # auto-detect');
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
  if (Object.keys(envVars).length > 0) body.env_vars = envVars;

  const r = await api('/backend/recreate-service', 'POST', body);

  console.log(`✅ Backend service recreated`);
  console.log(`   Old service: ${r.old_service_id}`);
  console.log(`   New service: ${r.new_service_id}`);
  console.log(`   URL: ${r.new_service_url}`);
  console.log(`   Framework: ${r.framework}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
