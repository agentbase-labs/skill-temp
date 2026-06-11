#!/usr/bin/env node
/**
 * Website Step 9: Verify SSL certificate
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node verify-ssl.cjs --workflow-id <id>");
  process.exit(1);
}

(async () => {
  const r = await api("/website/verify-ssl", "POST", { tenant_id: tenantId(), workflow_id: wf });

  if (r.ssl_status === "active" || r.status === "completed") {
    upsert({
      workflow_id: wf,
      status: "completed",
      website_url: r.website_url,
      ssl_status: "active",
      total_cost: r.total_cost,
      completed_at: new Date().toISOString(),
    });
    console.log(`✅ SSL active — website live!`);
    console.log(`   URL: ${r.website_url}`);
    console.log(`   Total cost: $${r.total_cost}`);
    console.log(`
📁 Saved to websites.json: website_url, ssl_status, total_cost, completed_at`);
  } else {
    console.log(`⏳ SSL pending — retry in 5 minutes`);
    console.log(`   Status: ${r.ssl_status}`);
  }
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
