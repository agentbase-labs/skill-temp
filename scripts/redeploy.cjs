#!/usr/bin/env node
/**
 * Redeploy website — triggers Render to pull latest from Git
 * Supports updating environment variables via --env KEY=VALUE (repeatable)
 * Pass --env KEY= (empty value) to remove a variable
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get, getAll } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node redeploy.cjs --workflow-id <id> [--env KEY=VALUE ...]");
  console.error("\nExamples:");
  console.error("  node redeploy.cjs --workflow-id wf_abc123");
  console.error(
    "  node redeploy.cjs --workflow-id wf_abc123 --env NEXT_PUBLIC_API_URL=https://new-api.example.com",
  );
  console.error("  node redeploy.cjs --workflow-id wf_abc123 --env OLD_VAR=   # removes OLD_VAR");
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
  if (Object.keys(envVars).length > 0) body.envVars = envVars;

  const r = await api("/website/redeploy", "POST", body);

  const dbUpdate = {
    workflow_id: wf,
    frontend_deploy_id: r.render_deploy_id,
    frontend_deploy_status: r.deployment_status,
    frontend_service_url: r.deployment_url,
    last_redeployed_at: new Date().toISOString(),
  };
  if (Object.keys(envVars).length > 0) dbUpdate.frontend_env_vars = envVars;
  upsert(dbUpdate);

  console.log(`✅ Redeploy triggered`);
  console.log(`   URL: ${r.deployment_url}`);
  console.log(`   Deploy ID: ${r.render_deploy_id || "N/A"}`);
  console.log(`   Status: ${r.deployment_status}`);
  if (Object.keys(envVars).length > 0)
    console.log(`   Updated Env Vars: ${Object.keys(envVars).join(", ")}`);
  console.log(`
⚠️  MANDATORY: Poll service-status.cjs until \`live\` or \`failed\``);
  console.log(`   node service-status.cjs --workflow-id ${wf} --type website`);
  console.log(`   If failed: run deploy-logs.cjs --type website --log-type build`);
  console.log(`
📁 Saved to websites.json: frontend_deploy_id, frontend_deploy_status, last_redeployed_at`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
