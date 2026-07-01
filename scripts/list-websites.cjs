#!/usr/bin/env node
/**
 * List all workflows from API.
 *
 * The list endpoint is paginated (default 50, max 200) and returns
 * { workflows: [...], pagination: { total, limit, offset, count, hasMore } }.
 * We page through with offset until hasMore is false so tenants with >50
 * workflows are fully listed. (Older responses were a bare array or
 * { workflows } without pagination — both still handled.)
 */
const { api, tenantId } = require('./_api.cjs');

(async () => {
  const PAGE = 200; // max page size
  const workflows = [];
  let offset = 0;
  for (;;) {
    const r = await api(`/workflow/list?tenant_id=${tenantId()}&limit=${PAGE}&offset=${offset}`);
    const page = Array.isArray(r) ? r : r.workflows || [];
    workflows.push(...page);
    const meta = (r && r.pagination) || null;
    if (meta ? !meta.hasMore : page.length < PAGE) break;
    offset += page.length || PAGE;
    if (!page.length) break; // safety: avoid infinite loop
  }
  if (!workflows.length) { console.log('No workflows found'); return; }
  workflows.forEach((w, i) => {
    console.log(`${i + 1}. ${w.metadata?.domain || '(no domain)'} — ${w.status}`);
    console.log(`   ID: ${w.id} | Type: ${w.workflowType} | Budget: $${w.budgetSpent}/$${w.budgetAllocated}`);
  });
})().catch(e => { console.error('❌', e.message); process.exit(1); });
