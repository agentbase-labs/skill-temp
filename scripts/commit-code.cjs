#!/usr/bin/env node
/**
 * Website Step 4: Commit code to repository
 *
 * Pass ALL files. Three input modes (combinable, later wins on path collision):
 *   --file path=content            text (utf8)        e.g. --file index.html="<html>..."
 *   --file-base64 path=<base64>    binary             e.g. --file-base64 public/logo.png="iVBORw0..."
 *   --files-json <path>            JSON manifest      { "path": "text" | { content, encoding } }
 *
 * For binary assets (images, fonts, favicons) you MUST use --file-base64 or the
 * FileEntry object form in --files-json, otherwise the backend will treat the
 * bytes as utf8 and corrupt the file.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get, files } = parseArgs();
const wf = get('--workflow-id');

if (!wf || Object.keys(files).length === 0) {
  console.error('Usage: node commit-code.cjs --workflow-id <id> \\');
  console.error('         --file index.html="<html>..." --file style.css="body{}" \\');
  console.error('         [--file-base64 public/logo.png="<base64>"] \\');
  console.error('         [--files-json /tmp/files.json]');
  process.exit(1);
}

(async () => {
  const r = await api('/website/commit-code', 'POST', { tenant_id: tenantId(), workflow_id: wf, files });
  console.log(`✅ Code committed: ${r.commit.commit_hash}`);
  console.log(`   Files: ${r.commit.files_committed}`);
  console.log(`   Next: deploy`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
