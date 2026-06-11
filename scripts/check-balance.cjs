#!/usr/bin/env node
/**
 * Show AgentBase billing status for this account.
 *
 * Billing model B (credits): funding is handled by in-app credits in the
 * agentic app, keyed by the tenant's EMAIL (1 credit = 1 USD). There is NO
 * crypto wallet and NO public balance endpoint on AgentBase — the credit
 * balance lives in the external Credits API and is enforced server-side at
 * spend time (atomic deduct; HTTP 402 = insufficient_credits).
 *
 * This script reports the billing model and the recent local spend ledger.
 * To add funds, add credits to the tenant's email account in the app.
 */
const { api, tenantId, loadConfig } = require('./_api.cjs');

(async () => {
  const cfg = loadConfig();
  console.log(`💳 Billing model: credits (1 credit = 1 USD)`);
  console.log(`   Account email: ${cfg.email || '(unknown)'}`);
  console.log(`   Funding: add credits to this email's account in the app.`);

  // Confirm billing model from the tenant record (no numeric balance is exposed here).
  try {
    const t = await api(`/tenant/${tenantId()}`);
    if (t && t.billing) {
      console.log(`   Tenant billing: ${t.billing.model || 'credits'}`);
    }
  } catch (e) {
    console.log(`   (could not read tenant billing: ${e.message})`);
  }

  // Show recent spend ledger.
  try {
    const r = await api(`/tenant/transactions?limit=5`);
    const txs = r.transactions || [];
    console.log(`\n📒 Recent spend ledger (${r.total || txs.length}):`);
    if (!txs.length) {
      console.log('   (none yet)');
    } else {
      for (const tx of txs) {
        const amt = tx.amount != null ? tx.amount : '';
        console.log(`   ${tx.type || tx.category || 'tx'}  ${amt}  ${tx.description || ''}`);
      }
    }
  } catch (e) {
    console.log(`\n📒 (could not read transactions: ${e.message})`);
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
