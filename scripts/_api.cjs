#!/usr/bin/env node
/**
 * AgentBase API Client — shared by all scripts
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(process.env.HOME, '.joni', 'agentbase');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// The agent app that installs this skill can point it at a specific AgentBase
// deployment via the AGENT_BASE_URL env var (e.g. prod:
// https://prod-api.agentbase.network). dev_render and prod are deployed on
// different links but share this one skill, so AGENT_BASE_URL selects which
// backend to talk to. If it is NOT set, we fall back to the historic default.
//
// AGENT_BASE_URL may be given with or without the /v1 API version suffix and
// with or without a trailing slash; normalizeApiUrl() makes it canonical so the
// endpoint paths (e.g. `/tenant`) resolve correctly.
const API_URL_FALLBACK = 'https://dev-render-api.agentbase.network/v1';

function normalizeApiUrl(raw) {
  if (!raw) return raw;
  let url = String(raw).trim().replace(/\/+$/, ''); // strip trailing slashes
  if (!/\/v\d+$/.test(url)) {
    url += '/v1'; // append version segment if the env value omitted it
  }
  return url;
}

// Resolved API base: AGENT_BASE_URL wins when present, else historic default.
const API_URL_DEFAULT = process.env.AGENT_BASE_URL
  ? normalizeApiUrl(process.env.AGENT_BASE_URL)
  : API_URL_FALLBACK;

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Config not found at ${CONFIG_FILE}. Run auto-signup first.`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (!config.api_url || !config.api_key || !config.tenant_id) {
    throw new Error(`Invalid config in ${CONFIG_FILE}`);
  }
  // If AGENT_BASE_URL is set, it always overrides the api_url persisted in
  // config.json. This lets the same saved account be pointed at a different
  // AgentBase deployment (e.g. prod) without re-running signup, and prevents a
  // config written against dev from silently pinning calls to dev.
  if (process.env.AGENT_BASE_URL) {
    config.api_url = normalizeApiUrl(process.env.AGENT_BASE_URL);
  }
  return config;
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_FILE, 0o600);
}

async function api(endpoint, method = 'GET', body = null, extraHeaders = null) {
  const config = loadConfig();
  const url = `${config.api_url}${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
      // Optional extra headers (e.g. x-admin-key for admin-only ops endpoints).
      // Tenant scripts don't pass this, so the shared Bearer client is unchanged.
      ...(extraHeaders || {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

function tenantId() { return loadConfig().tenant_id; }

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  // Collect all values for a repeated flag (e.g. --env KEY=VALUE --env KEY2=VALUE2)
  const getAll = (flag) => {
    const values = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag && args[i + 1]) values.push(args[i + 1]);
    }
    return values;
  };

  // Collect files from THREE sources (later sources override earlier on path collision):
  //
  //   1. --files-json <path>            JSON file: { "path": "text" | { content, encoding } }
  //   2. --file path=content            text (utf8) — backwards compatible
  //   3. --file-base64 path=<base64>    binary file (images, fonts, favicons, etc.)
  //
  // Backend (agentBase-BE) accepts:
  //   files: Record<string, string | { content: string, encoding?: 'utf8' | 'base64' }>
  // Plain strings are treated as utf8. Use the FileEntry object shape for binary content.
  const files = {};

  // 1. --files-json <path>
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--files-json' && args[i + 1]) {
      const jsonPath = args[i + 1];
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {
        throw new Error(`--files-json: failed to read/parse ${jsonPath}: ${e.message}`);
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`--files-json: ${jsonPath} must be a JSON object mapping path -> string | {content, encoding}`);
      }
      for (const [p, v] of Object.entries(parsed)) {
        files[p] = v;
      }
    }
  }

  // 2. --file path=content (utf8 text — plain string)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      const eq = args[i + 1].indexOf('=');
      if (eq > 0) {
        files[args[i + 1].substring(0, eq)] = args[i + 1].substring(eq + 1);
      }
    }
  }

  // 3. --file-base64 path=<base64-content> (binary)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file-base64' && args[i + 1]) {
      const eq = args[i + 1].indexOf('=');
      if (eq > 0) {
        const p = args[i + 1].substring(0, eq);
        const b64 = args[i + 1].substring(eq + 1);
        files[p] = { content: b64, encoding: 'base64' };
      }
    }
  }

  return { get, getAll, files, raw: args };
}

module.exports = { loadConfig, saveConfig, api, tenantId, parseArgs, CONFIG_DIR, CONFIG_FILE, API_URL_DEFAULT, normalizeApiUrl };
