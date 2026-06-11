#!/usr/bin/env node
/**
 * Backend Step 3: Commit backend code to repository
 *
 * Pass ALL files. Three input modes (combinable, later wins on path collision):
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
const msg = get('--message') || 'Deploy backend code';

if (!wf || Object.keys(files).length === 0) {
  console.error('Usage: node commit-backend-code.cjs --workflow-id <id> \\');
  console.error('         --file src/main.ts="..." --file package.json="..." \\');
  console.error('         [--file-base64 assets/logo.png="<base64>"] \\');
  console.error('         [--files-json /tmp/files.json] [--message "msg"]');
  process.exit(1);
}

(async () => {
  const r = await api('/backend/commit-code', 'POST', {
    tenant_id: tenantId(), workflow_id: wf, files, commit_message: msg,
  });
  console.log(`✅ Backend code committed: ${r.commit.sha}`);
  console.log(`   Next: deploy-backend`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
