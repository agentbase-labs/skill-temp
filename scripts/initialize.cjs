#!/usr/bin/env node
/**
 * Website Step 1: Initialize workflow (auto-signup if needed).
 *
 * Billing is in-app credits (1 credit = 1 USD) keyed by the account email;
 * there is no wallet to pre-fund. Per-step spends are deducted atomically and
 * an out-of-credits step returns HTTP 402 insufficient_credits.
 */
const fs = require("fs");
const { api, tenantId, loadConfig, parseArgs, CONFIG_FILE, assertNoEmailDrift } = require("./_api.cjs");
const { autoSignup } = require("./auto-signup.cjs");
const { upsert } = require("./_db.cjs");

const { get } = parseArgs();
const prompt = get("--prompt");
const budget = get("--budget");
const domains = get("--domains");
const tlds = get("--tlds");

if (!prompt || !budget) {
  console.error(
    'Usage: node initialize.cjs --prompt "desc" --budget <amount> [--domains "kw1,kw2"] [--tlds ".com,.io"]',
  );
  process.exit(1);
}

(async () => {
  // Drift guard: if a saved config exists and the env AgentMail email now
  // differs from config.email, refuse before spending another account's
  // credits. No-op when env email is unset or no config exists yet.
  assertNoEmailDrift();

  // Auto-setup (credits-based account, keyed by email)
  if (!fs.existsSync(CONFIG_FILE)) await autoSignup();

  const payload = { tenant_id: tenantId(), prompt, budget: parseFloat(budget) };
  if (domains) payload.domain_preferences = domains.split(",").map((s) => s.trim());
  if (tlds) payload.preferred_tlds = tlds.split(",").map((s) => s.trim());

  const r = await api("/website/initialize", "POST", payload);

  upsert({
    workflow_id: r.workflow_id,
    prompt,
    status: r.status,
    budget_allocated: r.budget?.allocated,
    budget_spent: r.budget?.spent,
    budget_remaining: r.budget?.remaining,
  });

  console.log(`✅ Workflow initialized`);
  console.log(`   ID: ${r.workflow_id}`);
  console.log(`   Budget: $${r.budget?.allocated}`);
  console.log(`   Next: register-domain`);
  console.log(`
📁 Saved to websites.json: workflow_id, prompt, status, budget`);
})().catch((e) => {
  if (/402|insufficient_credits/i.test(e.message)) {
    console.error("❌ Insufficient credits. Add credits to the account email in the app, then retry.");
    process.exit(1);
  }
  console.error("❌", e.message);
  process.exit(1);
});
