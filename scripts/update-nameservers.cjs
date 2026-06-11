#!/usr/bin/env node
/**
 * Website Step 7: Update nameservers at registrar → Cloudflare
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const wf = get('--workflow-id');
if (!wf) { console.error('Usage: node update-nameservers.cjs --workflow-id <id>'); process.exit(1); }

(async () => {
  const r = await api('/website/update-nameservers', 'POST', { tenant_id: tenantId(), workflow_id: wf });
  console.log(`✅ Nameservers updated`);
  if (r.nameservers) console.log(`   NS: ${r.nameservers.join(', ')}`);
  console.log(`   Propagation: ${r.propagation_time || '5-60 min'}`);
  console.log(`   Next: attach-domain (wait ~5 min for DNS propagation)`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
