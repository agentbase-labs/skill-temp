#!/usr/bin/env node
/**
 * Local website/backend tracking DB — ~/.joni/agentbase/websites.json
 */
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(process.env.HOME, '.joni', 'agentbase');
const DB_FILE = path.join(DB_DIR, 'websites.json');

function load() {
  if (!fs.existsSync(DB_FILE)) { fs.mkdirSync(DB_DIR, { recursive: true }); fs.writeFileSync(DB_FILE, '{"sites":[]}'); }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function upsert(data) {
  const db = load();
  const idx = db.sites.findIndex(s => s.workflow_id === data.workflow_id);
  const entry = { ...((idx >= 0 ? db.sites[idx] : {})), ...data, updated_at: new Date().toISOString() };
  if (!entry.created_at) entry.created_at = entry.updated_at;
  if (idx >= 0) db.sites[idx] = entry; else db.sites.push(entry);
  save(db);
  return entry;
}

function get(workflowId) { return load().sites.find(s => s.workflow_id === workflowId) || null; }
function list(filter) { let s = load().sites; if (filter?.status) s = s.filter(x => x.status === filter.status); return s; }

module.exports = { upsert, get, list, load };
