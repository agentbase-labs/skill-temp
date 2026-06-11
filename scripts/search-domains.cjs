#!/usr/bin/env node
/**
 * Search available domains with pricing
 */
const { api, tenantId, parseArgs } = require('./_api.cjs');

const { get } = parseArgs();
const keywords = get('--keywords');
const tlds = get('--tlds') || '.com,.io,.net';
if (!keywords) { console.error('Usage: node search-domains.cjs --keywords "bakery sweet" [--tlds ".com,.io"]'); process.exit(1); }

(async () => {
  const r = await api('/openprovider/search', 'POST', {
    tenant_id: tenantId(),
    keywords: keywords.split(/[\s,]+/),
    tlds: tlds.split(',').map(s => s.trim()),
    max_results: 10,
  });
  if (r.results && r.results.length) {
    r.results.forEach(d => {
      const mark = d.available ? '✓' : '✗';
      console.log(`${mark} ${d.domain} — $${d.price}/year${d.available ? '' : ' (taken)'}`);
    });
  } else {
    console.log('No results found');
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
