#!/usr/bin/env node
/**
 * List all workflows from API
 */
const { api, tenantId } = require('./_api.cjs');

(async () => {
  const r = await api(`/workflow/list?tenant_id=${tenantId()}`);
  const workflows = Array.isArray(r) ? r : r.workflows || [];
  if (!workflows.length) { console.log('No workflows found'); return; }
  workflows.forEach((w, i) => {
    console.log(`${i + 1}. ${w.metadata?.domain || '(no domain)'} — ${w.status}`);
    console.log(`   ID: ${w.id} | Type: ${w.workflowType} | Budget: $${w.budgetSpent}/$${w.budgetAllocated}`);
  });
})().catch(e => { console.error('❌', e.message); process.exit(1); });
