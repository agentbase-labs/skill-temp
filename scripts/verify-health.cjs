#!/usr/bin/env node
/**
 * Backend Step 6: Verify backend health check
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
if (!wf) {
  console.error("Usage: node verify-health.cjs --workflow-id <id>");
  process.exit(1);
}

(async () => {
  const r = await api("/backend/verify-health", "POST", { tenant_id: tenantId(), workflow_id: wf });

  if (r.health.status === "healthy") {
    upsert({
      workflow_id: wf,
      backend_health_url: r.health.url,
      backend_health_status: "healthy",
      backend_health_response_ms: r.health.response_time_ms,
      backend_live_at: new Date().toISOString(),
    });
    console.log(`✅ Backend healthy`);
    console.log(`   URL: ${r.health.url}`);
    console.log(`   Response: ${r.health.response_time_ms}ms`);
    console.log(`
📁 Saved to websites.json: backend_health_url, backend_health_status, backend_live_at`);
  } else {
    console.log(`⚠️  Backend unhealthy — may still be starting`);
    console.log(`   URL: ${r.health.url}`);
    console.log(`   Error: ${r.health.error || "unknown"}`);
    console.log(`   Retry in a few minutes`);
  }
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
