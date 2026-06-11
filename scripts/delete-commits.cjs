#!/usr/bin/env node
/**
 * Delete the last N commits from a repository branch
 *
 * ⚠️ DESTRUCTIVE: The specified commits are removed from the branch.
 *
 * Usage:
 *   node delete-commits.cjs --repo-id <id> --count <N> [--branch main]
 *   node delete-commits.cjs --workflow-id <id> --count <N> [--type website|backend] [--branch main]
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const repoId = get('--repo-id');
const workflowId = get('--workflow-id');
const count = get('--count');
const branch = get('--branch');

if ((!repoId && !workflowId) || !count) {
  console.error('Usage: node delete-commits.cjs --repo-id <id> --count <N> [--branch main]');
  console.error('       node delete-commits.cjs --workflow-id <id> --count <N> [--type website|backend]');
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

  const body = { count: parseInt(count, 10) };
  if (branch) body.branch = branch;

  const r = await api(`/github/repo/${rid}/delete-commits`, 'POST', body);

  console.log(`✅ ${r.message}`);
  console.log(`   Previous HEAD: ${r.previous_sha.substring(0, 7)}`);
  console.log(`   New HEAD:      ${r.new_head.short_sha} — "${r.new_head.message}"\n`);
  console.log(`   Removed commits:`);
  for (const c of r.removed_commits) {
    console.log(`     ✖ ${c.short_sha}  ${c.message}`);
  }
  console.log(`\n   ⚠️  Run redeploy to publish the rolled-back code.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
