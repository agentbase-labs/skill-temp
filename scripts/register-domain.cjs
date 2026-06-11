#!/usr/bin/env node
/**
 * Website Step 2: Register domain
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
const domain = get("--domain");

if (!wf || !domain) {
  console.error("Usage: node register-domain.cjs --workflow-id <id> --domain <domain.com>");
  process.exit(1);
}

(async () => {
  const r = await api("/website/register-domain", "POST", {
    tenant_id: tenantId(),
    workflow_id: wf,
    specific_domain: domain,
  });

  upsert({
    workflow_id: wf,
    domain: r.domain.name,
    domain_cost: r.domain.cost,
    domain_expires_at: r.domain.expires_at,
    status: r.status,
    budget_remaining: r.budget?.remaining,
  });

  console.log(`✅ Domain registered: ${r.domain.name}`);
  console.log(`   Cost: $${r.domain.cost}`);
  console.log(`   Expires: ${r.domain.expires_at}`);
  console.log(`   Budget remaining: $${r.budget?.remaining}`);
  console.log(`   Next: create-repo`);
  console.log(`
📁 Saved to websites.json: domain, domain_cost, domain_expires_at, budget_remaining`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
