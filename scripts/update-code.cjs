#!/usr/bin/env node
/**
 * Update website files in Git (post-deploy). Run redeploy.cjs after.
 *
 * Input modes (combinable, later wins on path collision):
 *   --file path=content            text (utf8)
 *   --file-base64 path=<base64>    binary (images, fonts, etc.)
 *   --files-json <path>            JSON manifest { "path": "text" | { content, encoding } }
 *
 * Binary assets MUST use --file-base64 or the FileEntry object form in
 * --files-json, otherwise the backend will treat the bytes as utf8 and corrupt
 * the file.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get, files } = parseArgs();
const wf = get('--workflow-id');
const msg = get('--message') || 'Update website code';

if (!wf || Object.keys(files).length === 0) {
  console.error('Usage: node update-code.cjs --workflow-id <id> \\');
  console.error('         --file name=content [--file ...] \\');
  console.error('         [--file-base64 path=<base64> ...] \\');
  console.error('         [--files-json /tmp/files.json] [--message "msg"]');
  process.exit(1);
}

(async () => {
  const r = await api('/website/update-code', 'POST', {
    tenant_id: tenantId(), workflow_id: wf, files, commit_message: msg,
  });
  console.log(`✅ Code updated: ${r.files_updated} files`);
  console.log(`   Run redeploy.cjs to publish`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
