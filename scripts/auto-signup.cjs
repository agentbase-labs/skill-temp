#!/usr/bin/env node
/**
 * Auto-create AgentBase tenant using Joni's email. Called by initialize.cjs.
 */
const fs = require('fs');
const { saveConfig, CONFIG_FILE, API_URL_DEFAULT } = require('./_api.cjs');

const JONI_EMAIL = process.env.AGENTMAIL_INBOX_ID || '';

async function autoSignup() {
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log(`✅ Account exists — tenant ${cfg.tenant_id}`);
    return cfg;
  }

  console.log(`📝 Creating AgentBase account (${JONI_EMAIL})...`);
  const res = await fetch(`${API_URL_DEFAULT}/tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: JONI_EMAIL }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Signup failed: ${res.status}`);

  const config = {
    api_url: API_URL_DEFAULT,
    api_key: data.api_key,
    tenant_id: data.tenant_id,
    email: JONI_EMAIL,
    billing: data.billing || { model: 'credits' },
  };
  saveConfig(config);
  console.log(`✅ Account created — tenant ${data.tenant_id} (credits-based, email ${JONI_EMAIL})`);
  return config;
}

if (require.main === module) autoSignup().catch(e => { console.error('❌', e.message); process.exit(1); });
module.exports = { autoSignup };
