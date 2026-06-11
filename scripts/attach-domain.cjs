#!/usr/bin/env node
/**
 * Website Step 8: Attach custom domain to Render service
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node attach-domain.cjs --workflow-id <id>");
  process.exit(1);
}

(async () => {
  const r = await api("/website/attach-domain", "POST", { tenant_id: tenantId(), workflow_id: wf });

  upsert({
    workflow_id: wf,
    custom_domain: r.custom_domain.domain,
    custom_domain_id: r.custom_domain.id,
  });

  console.log(`✅ Domain attached: ${r.custom_domain.domain}`);
  console.log(`   Domain ID: ${r.custom_domain.id || "N/A"}`);
  console.log(`   Next: verify-ssl (wait ~5 min for SSL provisioning)`);
  console.log(`
📁 Saved to websites.json: custom_domain, custom_domain_id`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
