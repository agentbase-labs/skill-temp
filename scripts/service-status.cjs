#!/usr/bin/env node
/**
 * Get Render service deployment status (building/live/failed)
 * Works for both website and backend workflows
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const wf = get('--workflow-id');
const type = get('--type') || 'website'; // website or backend
if (!wf) { console.error('Usage: node service-status.cjs --workflow-id <id> [--type website|backend]'); process.exit(1); }

(async () => {
  const prefix = type === 'backend' ? 'backend' : 'website';
  const r = await api(`/${prefix}/${wf}/service-status?tenant_id=${tenantId()}`);
  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error('❌', e.message); process.exit(1); });
