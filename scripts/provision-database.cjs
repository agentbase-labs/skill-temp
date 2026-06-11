#!/usr/bin/env node
/**
 * Backend Step 1: Provision PostgreSQL database on Render
 */
const { api, tenantId, parseArgs } = require("./_api.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const wf = get("--workflow-id");
const dbName = get("--name") || "app_db";
const dbType = get("--type") || "postgresql";
const plan = get("--plan") || "starter";

if (!wf) {
  console.error(
    "Usage: node provision-database.cjs --workflow-id <id> [--name app_db] [--plan starter|standard]",
  );
  process.exit(1);
}

(async () => {
  const r = await api("/backend/provision-database", "POST", {
    tenant_id: tenantId(),
    workflow_id: wf,
    database_name: dbName,
    database_type: dbType,
    plan,
  });
  upsert({
    workflow_id: wf,
    db_id: r.database.database_id,
    db_name: r.database.database_name,
    db_plan: plan,
    db_cost_monthly: r.database.cost,
    db_status: r.database.status,
    budget_remaining: r.budget?.remaining,
  });

  console.log(`✅ Database provisioning started`);
  console.log(`   DB ID: ${r.database.database_id}`);
  console.log(`   Name: ${r.database.database_name}`);
  console.log(`   Plan: ${plan} ($${r.database.cost}/mo)`);
  console.log(`   Status: ${r.database.status}`);
  console.log(`   Budget remaining: $${r.budget?.remaining}`);
  console.log(`   Next: create-backend-repo (can run in parallel)`);
  console.log(`
📁 Saved to websites.json: db_id, db_name, db_plan, db_cost_monthly, db_status`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
