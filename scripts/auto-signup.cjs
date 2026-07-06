#!/usr/bin/env node
/**
 * Auto-create AgentBase tenant using Joni's email. Called by initialize.cjs.
 *
 * The email is the Credits API billing identity. The backend now REFUSES
 * signup (HTTP 422 agentmail_not_found) for an email that has no AgentMail
 * account in the Credits API, so we surface that clearly to the user.
 */
const fs = require('fs');
const {
  saveConfig,
  CONFIG_FILE,
  API_URL_DEFAULT,
  resolveEmail,
} = require('./_api.cjs');

const NO_AGENTMAIL_MSG = '❌ No AgentMail found — please contact support to fix it.';

async function autoSignup() {
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log(`✅ Account exists — tenant ${cfg.tenant_id}`);
    return cfg;
  }

  // No config yet — we MUST have an email from env to sign up. Precedence:
  // AGENTMAIL_INBOX_ID -> JONI_EMAIL_ADDRESS. (No config exists here, so the
  // config fallback in resolveEmail contributes nothing.)
  const email = resolveEmail();
  if (!email) {
    console.error(NO_AGENTMAIL_MSG);
    process.exit(1);
  }

  console.log(`📝 Creating AgentBase account (${email})...`);
  const res = await fetch(`${API_URL_DEFAULT}/tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Backend refuses signup for an email with no AgentMail account in the
    // Credits API (fail-closed existence gate) with HTTP 422 agentmail_not_found.
    // Surface the backend message verbatim, then exit with the standard wording.
    const bodyStr = JSON.stringify(data || {});
    const isAgentMailNotFound =
      res.status === 422 ||
      data?.error === 'agentmail_not_found' ||
      /agentmail_not_found/i.test(bodyStr);

    if (isAgentMailNotFound) {
      if (data?.message) console.error(`❌ ${data.message}`);
      console.error(NO_AGENTMAIL_MSG);
      process.exit(1);
    }

    throw new Error(data?.message || `Signup failed: ${res.status}`);
  }

  const config = {
    api_url: API_URL_DEFAULT,
    api_key: data.api_key,
    tenant_id: data.tenant_id,
    email,
    billing: data.billing || { model: 'credits' },
  };
  saveConfig(config);
  console.log(`✅ Account created — tenant ${data.tenant_id} (credits-based, email ${email})`);
  return config;
}

if (require.main === module) autoSignup().catch(e => { console.error('❌', e.message); process.exit(1); });
module.exports = { autoSignup };
