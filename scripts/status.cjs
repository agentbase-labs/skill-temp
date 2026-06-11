#!/usr/bin/env node
/**
 * Get workflow status (website or backend)
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const wf = get('--workflow-id');
if (!wf) { console.error('Usage: node status.cjs --workflow-id <id>'); process.exit(1); }

(async () => {
  const r = await api(`/workflow/${wf}/status?tenant_id=${tenantId()}`);
  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error('❌', e.message); process.exit(1); });
