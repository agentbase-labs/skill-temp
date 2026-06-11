#!/usr/bin/env node
/**
 * Get build/runtime logs for a deployment
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const wf = get('--workflow-id');
const type = get('--type') || 'website';
const logType = get('--log-type') || ''; // build or runtime
if (!wf) { console.error('Usage: node deploy-logs.cjs --workflow-id <id> [--type website|backend] [--log-type build|runtime]'); process.exit(1); }

(async () => {
  const prefix = type === 'backend' ? 'backend' : 'website';
  let endpoint = `/${prefix}/${wf}/deploy-logs?tenant_id=${tenantId()}`;
  if (logType) endpoint += `&type=${logType}`;
  const r = await api(endpoint);
  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error('❌', e.message); process.exit(1); });
