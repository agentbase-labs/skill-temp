#!/usr/bin/env node
/**
 * Website Step 6: Setup Cloudflare DNS zone + CNAME records
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node setup-dns.cjs --workflow-id <id>");
  process.exit(1);
}

(async () => {
  const r = await api("/website/setup-dns", "POST", { tenant_id: tenantId(), workflow_id: wf });
  upsert({
    workflow_id: wf,
    dns_zone_id: r.dns.zone_id,
    dns_nameservers: r.dns.nameservers,
  });

  console.log(`✅ DNS zone created`);
  console.log(`   Zone ID: ${r.dns.zone_id}`);
  if (r.dns.nameservers) console.log(`   Nameservers: ${r.dns.nameservers.join(", ")}`);
  console.log(`   Next: update-nameservers`);
  console.log(`
📁 Saved to websites.json: dns_zone_id, dns_nameservers`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
