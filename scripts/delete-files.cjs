#!/usr/bin/env node
/**
 * Delete files from the WEBSITE Git repository (post-deploy).
 *
 * Calls POST /website/delete-files (workflow-scoped — resolves the website repo
 * via workflow metadata.repo_id). Mirrors update-code.cjs conventions.
 *
 * Args:
 *   --workflow-id <id>   (required)
 *   --path <p>           (repeatable, at least one required)
 *   --message "<msg>"    (optional commit message)
 *
 * Behavior:
 *   - Each path is checked for existence first; only existing files are deleted.
 *   - Non-existent paths come back in `not_found` (NOT an error).
 *   - If NONE of the paths exist, no commit is created (success: false).
 *
 * ⚠️ Deletion only updates Git — it does NOT redeploy. Run redeploy.cjs after
 *    to publish the change to the live site.
 *
 * Rate limit: 10 requests/min per tenant. On HTTP 429, back off ~1 minute.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get, getAll } = parseArgs();
const wf = get('--workflow-id');
const paths = getAll('--path');
const msg = get('--message') || undefined;

if (!wf || paths.length === 0) {
  console.error('Usage: node delete-files.cjs --workflow-id <id> \\');
  console.error('         --path <p> [--path <p> ...] [--message "msg"]');
  console.error('');
  console.error('Deletes files from the WEBSITE repo. Does NOT redeploy —');
  console.error('run redeploy.cjs afterward to publish.');
  process.exit(1);
}

(async () => {
  let r;
  try {
    r = await api('/website/delete-files', 'POST', {
      tenant_id: tenantId(), workflow_id: wf, paths, commit_message: msg,
    });
  } catch (e) {
    if (/\b429\b|too many requests/i.test(e.message)) {
      console.error('❌ Rate limited (429). delete-files is capped at ~10/min — wait ~1 minute and try again.');
      process.exit(1);
    }
    throw e;
  }

  const commit = r.commit || {};
  const deleted = commit.deleted || [];
  const notFound = commit.not_found || [];

  if (r.success && commit.sha) {
    console.log(`✅ Deleted ${deleted.length} file(s) — commit ${commit.sha}`);
    deleted.forEach(p => console.log(`   - ${p}`));
  } else {
    console.log('ℹ️  No files deleted — none of the given paths existed in the repo (no commit created).');
  }

  if (notFound.length > 0) {
    console.log(`⚠️  Not found (skipped, no error): ${notFound.join(', ')}`);
  }

  console.log('');
  console.log('   Deletion does NOT redeploy — run redeploy.cjs to publish the change.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
