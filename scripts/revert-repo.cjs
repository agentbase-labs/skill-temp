#!/usr/bin/env node
/**
 * Revert a repository branch to a specific commit
 *
 * ⚠️ DESTRUCTIVE: All commits after the target are removed from the branch.
 *
 * Usage:
 *   node revert-repo.cjs --repo-id <id> --sha <target-commit-sha> [--branch main]
 *   node revert-repo.cjs --workflow-id <id> --sha <target-commit-sha> [--type website|backend] [--branch main]
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const repoId = get('--repo-id');
const workflowId = get('--workflow-id');
const sha = get('--sha');
const branch = get('--branch');

if ((!repoId && !workflowId) || !sha) {
  console.error('Usage: node revert-repo.cjs --repo-id <id> --sha <target-sha> [--branch main]');
  console.error('       node revert-repo.cjs --workflow-id <id> --sha <target-sha> [--type website|backend]');
  process.exit(1);
}

(async () => {
  let rid = repoId;

  if (!rid && workflowId) {
    const type = get('--type') || 'website';
    const wf = await api(`/workflow/${workflowId}/status?tenant_id=${tenantId()}`);
    const meta = wf.metadata || {};
    rid = type === 'backend' ? meta.backend_repo_id : meta.repo_id;
    if (!rid) {
      console.error(`❌ No ${type} repo found in workflow ${workflowId}`);
      process.exit(1);
    }
  }

  const body = { target_sha: sha };
  if (branch) body.branch = branch;

  const r = await api(`/github/repo/${rid}/revert`, 'POST', body);

  if (!r.reverted) {
    console.log(`ℹ️  ${r.message}`);
    return;
  }

  console.log(`✅ Reverted ${r.repo_name}:${r.branch}`);
  console.log(`   Previous HEAD: ${r.previous_sha.substring(0, 7)}`);
  console.log(`   New HEAD:      ${r.current_sha.substring(0, 7)}`);
  console.log(`   Target commit: "${r.target_commit.message}" by ${r.target_commit.author} (${r.target_commit.date})`);
  console.log(`\n   ⚠️  Run redeploy to publish the reverted code.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
