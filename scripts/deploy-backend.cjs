#!/usr/bin/env node
/**
 * Backend Step 4: Deploy backend to Render
 *
 * Frameworks: nodejs, nestjs, express, fastapi, django, flask, rails, go, rust, laravel, springboot, docker
 * Supports optional env vars via --env KEY=VALUE (repeatable)
 * Auto-injects DATABASE_URL if database was provisioned. Auto-generates JWT_SECRET.
 *
 * Render service options (all optional):
 *   --runtime           Runtime override (node/python/ruby/go/rust/docker/image)
 *   --dockerfile-path   Path to Dockerfile (implies runtime=docker)
 *   --docker-context    Docker build context (default: ./)
 *   --docker-command    Docker CMD override
 *   --pre-deploy-cmd    Command that runs after build, before start (e.g. DB migrations)
 *   --health-check-path Health endpoint for zero-downtime deploys
 *   --plan              Instance plan (free/starter/standard/pro/pro_plus/pro_max/pro_ultra)
 *   --num-instances     Horizontal scaling
 *   --max-shutdown      Graceful shutdown timeout in seconds (1-300)
 *   --branch            Git branch (default: main)
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get, getAll } = parseArgs();
const wf = get("--workflow-id");
const framework = get("--framework");
const buildCmd = get("--build-command");
const startCmd = get("--start-command");
const region = get("--region");

if (!wf) {
  console.error("Usage: node deploy-backend.cjs --workflow-id <id> [options]");
  console.error("\nOptions:");
  console.error(
    "  --framework <name>       Backend framework (nestjs, express, fastapi, django, etc.)",
  );
  console.error("  --build-command <cmd>    Custom build command");
  console.error("  --start-command <cmd>    Custom start command");
  console.error("  --region <region>        Deploy region (default: oregon)");
  console.error("  --env KEY=VALUE          Environment variable (repeatable)");
  console.error("\nRender options:");
  console.error(
    "  --runtime <rt>           Runtime override (node/python/ruby/go/rust/docker/image)",
  );
  console.error("  --dockerfile-path <path> Path to Dockerfile");
  console.error("  --docker-context <dir>   Docker build context");
  console.error("  --docker-command <cmd>   Docker CMD override");
  console.error("  --pre-deploy-cmd <cmd>   Pre-deploy command (e.g. DB migrations)");
  console.error("  --health-check-path <p>  Health endpoint (e.g. /health)");
  console.error("  --plan <plan>            Instance plan (starter/standard/pro/...)");
  console.error("  --num-instances <n>      Number of instances");
  console.error("  --max-shutdown <sec>     Graceful shutdown timeout (1-300)");
  console.error("  --branch <branch>        Git branch (default: main)");
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
  if (framework) body.framework = framework;
  if (buildCmd) body.buildCommand = buildCmd;
  if (startCmd) body.startCommand = startCmd;
  if (region) body.region = region;
  if (Object.keys(envVars).length > 0) body.env_vars = envVars;

  // Render service options
  const opt = (flag, key) => {
    const v = get(flag);
    if (v) body[key] = v;
  };
  opt("--runtime", "runtime");
  opt("--dockerfile-path", "dockerfilePath");
  opt("--docker-context", "dockerContext");
  opt("--docker-command", "dockerCommand");
  opt("--pre-deploy-cmd", "preDeployCommand");
  opt("--health-check-path", "healthCheckPath");
  opt("--plan", "plan");
  opt("--branch", "branch");
  const numInst = get("--num-instances");
  if (numInst) body.numInstances = parseInt(numInst, 10);
  const maxShut = get("--max-shutdown");
  if (maxShut) body.maxShutdownDelaySeconds = parseInt(maxShut, 10);
  const autoDeploy = get("--auto-deploy");
  if (autoDeploy === "false") body.autoDeploy = false;

  const r = await api("/backend/deploy", "POST", body);

  upsert({
    workflow_id: wf,
    backend_framework: framework || "nodejs",
    backend_service_url: r.deployment?.service_url,
    backend_service_id: r.deployment?.service_id,
    backend_deploy_id: r.deployment?.deploy_id,
    backend_deploy_status: r.deployment?.status,
    backend_env_vars: Object.keys(envVars).length > 0 ? envVars : undefined,
    backend_build_command: buildCmd || undefined,
    backend_start_command: startCmd || undefined,
    backend_plan: get("--plan") || undefined,
    backend_region: region || undefined,
  });

  console.log(`✅ Backend deploy triggered`);
  console.log(`   Service: ${r.deployment?.service_url || "pending"}`);
  console.log(`   Service ID: ${r.deployment?.service_id || "N/A"}`);
  console.log(`   Deploy ID: ${r.deployment?.deploy_id || "N/A"}`);
  console.log(`   Framework: ${framework || "nodejs"}`);
  console.log(`   Status: ${r.deployment?.status || r.status}`);
  if (Object.keys(envVars).length > 0)
    console.log(`   Env Vars: ${Object.keys(envVars).join(", ")}`);
  console.log(`
⚠️  MANDATORY: Poll service-status.cjs until \`live\` before proceeding to attach-subdomain`);
  console.log(`   node service-status.cjs --workflow-id ${wf} --type backend`);
  console.log(`
📁 Saved to websites.json: backend_service_url, backend_service_id, backend_framework, backend_deploy_id`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
