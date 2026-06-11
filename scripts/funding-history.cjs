#!/usr/bin/env node
/**
 * Show the AgentBase spend ledger for this account.
 *
 * NOTE: Crypto funding history is gone (billing is now in-app credits keyed by
 * the tenant email, 1 credit = 1 USD). This shows the local spend ledger
 * returned by GET /tenant/transactions (debits for domains/deploys, refunds).
 *
 * Usage:
 *   node funding-history.cjs [--limit 50]
 */
const { api, parseArgs } = require("./_api.cjs");

(async () => {
  const args = parseArgs();
  const limit = args.get('--limit') || 50;
  const r = await api(`/tenant/transactions?limit=${limit}`);
  const txs = r.transactions || [];

  if (!txs.length) {
    console.log("📭 No transactions recorded yet.");
    return;
  }

  console.log(`📒 Spend ledger (${r.total || txs.length}):`);
  for (const tx of txs) {
    const when = tx.createdAt || tx.timestamp || "";
    const amt = tx.amount != null ? tx.amount : "";
    const kind = tx.type || tx.category || "tx";
    console.log(`   ${when}  ${kind}  ${amt}  ${tx.description || ""}`);
  }
})().catch(e => { console.error("❌", e.message); process.exit(1); });
