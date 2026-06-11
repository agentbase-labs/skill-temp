#!/usr/bin/env node
/**
 * View commit history for a repository
 *
 * Usage:
 *   node commit-history.cjs --repo-id <id> [--branch main] [--page 1] [--per-page 30]
 *
 * Also accepts --workflow-id to auto-resolve the repo from workflow metadata.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const repoId = get('--repo-id');
const workflowId = get('--workflow-id');
const branch = get('--branch');
const page = get('--page');
const perPage = get('--per-page');

if (!repoId && !workflowId) {
  console.error('Usage: node commit-history.cjs --repo-id <id> [--branch main] [--page 1] [--per-page 30]');
  console.error('       node commit-history.cjs --workflow-id <id> [--type website|backend] [--branch main]');
  process.exit(1);
}

(async () => {
  let rid = repoId;

  // Resolve repo ID from workflow if needed
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

  const params = new URLSearchParams();
  if (branch) params.set('branch', branch);
  if (page) params.set('page', page);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString() ? `?${params}` : '';

  const r = await api(`/github/repo/${rid}/commits${qs}`);

  console.log(`📜 Commit history for ${r.repo_name} (${r.branch})\n`);

  for (const c of r.commits) {
    const date = new Date(c.author.date).toISOString().replace('T', ' ').substring(0, 19);
    console.log(`  ${c.short_sha}  ${date}  ${c.message}`);
  }

  console.log(`\n  Page ${r.pagination.page} · ${r.commits.length} commits`);
  if (r.pagination.has_next) console.log(`  → Next page: --page ${r.pagination.page + 1}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
