#!/usr/bin/env node
/**
 * Website Step 5: Deploy to Render
 *
 * Supported frontend frameworks: static (default), react, vue, angular, svelte, nextjs, nuxtjs
 * Supports optional environment variables via --env KEY=VALUE (repeatable)
 *
 * Render service options (all optional):
 *   --runtime           Runtime override (node/python/ruby/go/rust/docker/image/static)
 *   --dockerfile-path   Path to Dockerfile (implies runtime=docker)
 *   --docker-context    Docker build context (default: ./)
 *   --docker-command    Docker CMD override
 *   --publish-path      Static site publish directory (e.g. ./dist)
 *   --pre-deploy-cmd    Command that runs after build, before start
 *   --health-check-path Health endpoint for zero-downtime deploys
 *   --plan              Instance plan (free/starter/standard/pro/pro_plus/pro_max/pro_ultra)
 *   --num-instances     Horizontal scaling
 *   --max-shutdown      Graceful shutdown timeout in seconds (1-300)
 *   --region            Deploy region (oregon/ohio/virginia/frankfurt/singapore)
 *   --branch            Git branch (default: main)
 *   --build-command     Custom build command
 *   --start-command     Custom start command
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get, getAll } = parseArgs();
const wf = get("--workflow-id");
const framework = get("--framework");
if (!wf) {
  console.error(
    "Usage: node deploy.cjs --workflow-id <id> [--framework nextjs] [--env KEY=VALUE ...]",
  );
  console.error("\nFrameworks: static (default), react, vue, angular, svelte, nextjs, nuxtjs");
  console.error(
    "\nRender options: --runtime, --dockerfile-path, --docker-context, --docker-command,",
  );
  console.error(
    "  --publish-path, --pre-deploy-cmd, --health-check-path, --plan, --num-instances,",
  );
  console.error("  --max-shutdown, --region, --branch, --build-command, --start-command");
  process.exit(1);
}

// Collect --env KEY=VALUE pairs
const envPairs = getAll ? getAll("--env") : [];
const envVars = {};
for (const pair of envPairs) {
  const eq = pair.indexOf("=");
  if (eq > 0) envVars[pair.slice(0, eq)] = pair.slice(eq + 1);
}

const frameworkKey = String(framework || "static")
  .trim()
  .toLowerCase();
const frameworkDefaults = {
  react: {
    runtime: "static",
    publishPath: "./dist",
    buildCommand: "npm ci && npm run build",
  },
  static: {
    runtime: "static",
  },
};
const defaults = frameworkDefaults[frameworkKey] || {};

(async () => {
  const body = { tenant_id: tenantId(), workflow_id: wf };
  if (framework) body.framework = framework;
  if (Object.keys(envVars).length > 0) body.envVars = envVars;

  // Render service options
  const opt = (flag, key) => {
    const v = get(flag);
    if (v) body[key] = v;
  };
  opt("--runtime", "runtime");
  opt("--dockerfile-path", "dockerfilePath");
  opt("--docker-context", "dockerContext");
  opt("--docker-command", "dockerCommand");
  opt("--publish-path", "publishPath");
  opt("--pre-deploy-cmd", "preDeployCommand");
  opt("--health-check-path", "healthCheckPath");
  opt("--plan", "plan");
  opt("--region", "region");
  opt("--branch", "branch");
  opt("--build-command", "buildCommand");
  opt("--start-command", "startCommand");
  if (!body.runtime && defaults.runtime) body.runtime = defaults.runtime;
  if (!body.publishPath && defaults.publishPath) body.publishPath = defaults.publishPath;
  if (!body.buildCommand && defaults.buildCommand) body.buildCommand = defaults.buildCommand;
  const numInst = get("--num-instances");
  if (numInst) body.numInstances = parseInt(numInst, 10);
  const maxShut = get("--max-shutdown");
  if (maxShut) body.maxShutdownDelaySeconds = parseInt(maxShut, 10);
  const autoDeploy = get("--auto-deploy");
  if (autoDeploy === "false") body.autoDeploy = false;

  const r = await api("/website/deploy", "POST", body);

  upsert({
    workflow_id: wf,
    status: r.status,
    frontend_framework: framework || "static",
    frontend_service_url: r.deployment?.render_service_url,
    frontend_service_id: r.deployment?.render_service_id,
    frontend_deploy_id: r.deployment?.render_deploy_id,
    frontend_deploy_status: r.deployment?.deployment_status,
    frontend_env_vars: Object.keys(envVars).length > 0 ? envVars : undefined,
    frontend_build_command: get("--build-command") || undefined,
    frontend_start_command: get("--start-command") || undefined,
    frontend_publish_path: get("--publish-path") || undefined,
    frontend_plan: get("--plan") || undefined,
    frontend_region: get("--region") || undefined,
  });

  console.log(`✅ Deploy triggered`);
  console.log(`   Service: ${r.deployment?.render_service_url || "pending"}`);
  console.log(`   Service ID: ${r.deployment?.render_service_id || "N/A"}`);
  console.log(`   Deploy ID: ${r.deployment?.render_deploy_id || "N/A"}`);
  console.log(`   Framework: ${framework || "static"}`);
  if (body.buildCommand) console.log(`   Build Command: ${body.buildCommand}`);
  if (body.publishPath) console.log(`   Publish Path: ${body.publishPath}`);
  if (body.runtime) console.log(`   Runtime: ${body.runtime}`);
  console.log(`   Status: ${r.deployment?.deployment_status || r.status}`);
  if (Object.keys(envVars).length > 0)
    console.log(`   Env Vars: ${Object.keys(envVars).join(", ")}`);
  console.log(`
⚠️  MANDATORY: Poll service-status.cjs until \`live\` before proceeding to setup-dns`);
  console.log(`   node service-status.cjs --workflow-id ${wf} --type website`);
  console.log(`
📁 Saved to websites.json: frontend_service_url, frontend_service_id, frontend_framework, frontend_deploy_id`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
