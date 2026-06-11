#!/usr/bin/env node
/**
 * Increase workflow budget.
 *
 * Billing model B (credits): the backend deducts the additional amount from
 * in-app credits atomically (the deduct IS the balance check) and raises the
 * workflow budget. If the account email lacks credits, the backend returns
 * HTTP 402 insufficient_credits — add credits to the email account in the app
 * and retry. There is no wallet to pre-fund here.
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const wf = get('--workflow-id');
const amount = get('--amount');
if (!wf || !amount) { console.error('Usage: node increase-budget.cjs --workflow-id <id> --amount <usd>'); process.exit(1); }

(async () => {
  const tid = tenantId();
  const amt = parseFloat(amount);

  let r;
  try {
    r = await api('/website/increase-budget', 'POST', {
      tenant_id: tid, workflow_id: wf, additional_budget: amt,
    });
  } catch (e) {
    if (/402|insufficient_credits/i.test(e.message)) {
      console.error('❌ Insufficient credits. Add credits to the account email in the app, then retry.');
      process.exit(1);
    }
    throw e;
  }

  console.log(`✅ Budget increased`);
  console.log(`   Allocated: $${r.budget_allocated}`);
  console.log(`   Remaining: $${r.budget_remaining}`);
  console.log(`   Status: ${r.status}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
