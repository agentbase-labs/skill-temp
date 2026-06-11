#!/usr/bin/env node
/**
 * Backend Step 2: Create backend Git repository
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
const repoName = get("--name");
const framework = get("--framework") || "nodejs";

if (!wf || !repoName) {
  console.error(
    "Usage: node create-backend-repo.cjs --workflow-id <id> --name <repo-name> [--framework nestjs|express|fastapi|django]",
  );
  process.exit(1);
}

(async () => {
  const r = await api("/backend/create-repo", "POST", {
    tenant_id: tenantId(),
    workflow_id: wf,
    repo_name: repoName,
    framework,
  });
  upsert({
    workflow_id: wf,
    backend_repo_name: r.repository.repo_name,
    backend_clone_url: r.repository.clone_url,
  });

  console.log(`✅ Backend repo created`);
  console.log(`   Repo: ${r.repository.repo_name}`);
  console.log(`   Clone URL: ${r.repository.clone_url}`);
  console.log(`   Next: commit-backend-code`);
  console.log(`
📁 Saved to websites.json: backend_repo_name, backend_clone_url`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
