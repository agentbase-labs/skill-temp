#!/usr/bin/env node
/**
 * Update backend files in Git. Run redeploy-backend.cjs after.
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
const msg = get('--message') || 'Update backend code';

if (!wf || Object.keys(files).length === 0) {
  console.error('Usage: node update-backend-code.cjs --workflow-id <id> \\');
  console.error('         --file name=content [--file ...] \\');
  console.error('         [--file-base64 path=<base64> ...] \\');
  console.error('         [--files-json /tmp/files.json] [--message "msg"]');
  process.exit(1);
}

(async () => {
  const r = await api('/backend/update-code', 'POST', {
    tenant_id: tenantId(), workflow_id: wf, files, commit_message: msg,
  });
  console.log(`✅ Backend code updated: ${r.commit.sha}`);
  console.log(`   Run redeploy-backend.cjs to publish`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
