#!/usr/bin/env node
/**
 * Website Step 3: Create Git repository
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node create-repo.cjs --workflow-id <id>");
  process.exit(1);
}

const { upsert } = require("./_db.cjs");

(async () => {
  const r = await api("/website/create-repo", "POST", { tenant_id: tenantId(), workflow_id: wf });

  upsert({
    workflow_id: wf,
    frontend_repo_name: r.repository.repo_name,
    frontend_clone_url: r.repository.clone_url,
    status: r.status || "repo_created",
  });

  console.log(`✅ Repo created: ${r.repository.repo_name}`);
  console.log(`   Clone URL: ${r.repository.clone_url}`);
  console.log(`   Next: commit-code`);
  console.log(`
📁 Saved to websites.json: frontend_repo_name, frontend_clone_url`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
