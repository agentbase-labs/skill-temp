#!/usr/bin/env node
/**
 * Redeploy backend — triggers Render to pull latest from Git
 * Supports updating env vars via --env KEY=VALUE (repeatable)
 * DB vars (DATABASE_URL etc.) are always synced automatically
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get, getAll } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node redeploy-backend.cjs --workflow-id <id> [--env KEY=VALUE ...]");
  console.error("\nExamples:");
  console.error("  node redeploy-backend.cjs --workflow-id wf_abc123");
  console.error(
    "  node redeploy-backend.cjs --workflow-id wf_abc123 --env API_SECRET=newsecret --env REDIS_URL=redis://...",
  );
  console.error(
    "  node redeploy-backend.cjs --workflow-id wf_abc123 --env OLD_VAR=   # removes OLD_VAR",
  );
  process.exit(1);
}

// Collect --env KEY=VALUE pairs
const envPairs = getAll("--env");
const envVars = {};
for (const pair of envPairs) {
  const eq = pair.indexOf("=");
  if (eq > 0) envVars[pair.slice(0, eq)] = pair.slice(eq + 1);
}

(async () => {
  const body = { tenant_id: tenantId(), workflow_id: wf };
  if (Object.keys(envVars).length > 0) body.env_vars = envVars;

  const r = await api("/backend/redeploy", "POST", body);

  const dbUpdate = {
    workflow_id: wf,
    backend_deploy_id: r.deployment?.deploy_id,
    backend_deploy_status: r.deployment?.status,
    backend_service_url: r.deployment?.service_url,
    backend_last_redeployed_at: new Date().toISOString(),
  };
  if (Object.keys(envVars).length > 0) dbUpdate.backend_env_vars = envVars;
  upsert(dbUpdate);

  console.log(`✅ Backend redeploy triggered`);
  console.log(`   Service: ${r.deployment?.service_url || "pending"}`);
  console.log(`   Deploy ID: ${r.deployment?.deploy_id || "N/A"}`);
  console.log(`   Status: ${r.deployment?.status || r.status}`);
  if (Object.keys(envVars).length > 0)
    console.log(`   Updated Env Vars: ${Object.keys(envVars).join(", ")}`);
  console.log(`
⚠️  MANDATORY: Poll service-status.cjs until \`live\` or \`failed\``);
  console.log(`   node service-status.cjs --workflow-id ${wf} --type backend`);
  console.log(`   If failed: run deploy-logs.cjs --type backend --log-type build`);
  console.log(
    `   If build passed but crashed: run deploy-logs.cjs --type backend --log-type runtime`,
  );
  console.log(`
📁 Saved to websites.json: backend_deploy_id, backend_deploy_status, backend_last_redeployed_at`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
