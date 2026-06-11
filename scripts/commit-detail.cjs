#!/usr/bin/env node
/**
 * View details of a single commit (files changed, diffs)
 *
 * Usage:
 *   node commit-detail.cjs --repo-id <id> --sha <commit-sha>
 *   node commit-detail.cjs --workflow-id <id> --sha <commit-sha> [--type website|backend]
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const repoId = get('--repo-id');
const workflowId = get('--workflow-id');
const sha = get('--sha');

if ((!repoId && !workflowId) || !sha) {
  console.error('Usage: node commit-detail.cjs --repo-id <id> --sha <commit-sha>');
  console.error('       node commit-detail.cjs --workflow-id <id> --sha <commit-sha> [--type website|backend]');
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

  const r = await api(`/github/repo/${rid}/commits/${sha}`);

  console.log(`📋 Commit ${r.short_sha} — ${r.message}\n`);
  console.log(`   Author:  ${r.author.name} <${r.author.email}>`);
  console.log(`   Date:    ${r.author.date}`);
  if (r.stats) {
    console.log(`   Stats:   +${r.stats.additions} -${r.stats.deletions} (${r.stats.total} changes)`);
  }
  console.log(`   Parents: ${r.parents.map(p => p.short_sha).join(', ') || '(root)'}`);
  console.log(`   URL:     ${r.url}\n`);

  if (r.files && r.files.length > 0) {
    console.log(`   Files changed (${r.files.length}):`);
    for (const f of r.files) {
      const sign = f.status === 'added' ? '🟢' : f.status === 'removed' ? '🔴' : '🟡';
      console.log(`     ${sign} ${f.filename}  (+${f.additions} -${f.deletions})`);
    }
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
