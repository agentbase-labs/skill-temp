#!/usr/bin/env node
/**
 * Backend Step 5: Attach subdomain (e.g. api.example.com) to backend service
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
const subdomain = get("--subdomain") || "api";

if (!wf) {
  console.error("Usage: node attach-subdomain.cjs --workflow-id <id> [--subdomain api]");
  process.exit(1);
}

(async () => {
  const r = await api("/backend/attach-subdomain", "POST", {
    tenant_id: tenantId(),
    workflow_id: wf,
    subdomain,
  });

  upsert({
    workflow_id: wf,
    backend_subdomain: r.domain.custom_domain,
    backend_subdomain_prefix: subdomain,
    backend_root_domain: r.domain.root_domain,
    backend_subdomain_id: r.domain.id,
  });

  console.log(`✅ Subdomain attached: ${r.domain.custom_domain}`);
  console.log(`   Root: ${r.domain.root_domain}`);
  console.log(`   Subdomain ID: ${r.domain.id || "N/A"}`);
  console.log(`   Next: verify-health`);
  console.log(`
📁 Saved to websites.json: backend_subdomain, backend_subdomain_prefix, backend_root_domain`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
