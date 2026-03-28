#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// EBENOVA.DEV API — ENDPOINT VALIDATION SCRIPT
// ═══════════════════════════════════════════════════════════════
// 
// Usage:
//   node test-api.js
//   node test-api.js --base https://api.ebenova.dev
//   node test-api.js --key sk_live_xxx
//
// This script tests all API endpoints and reports pass/fail status.

const API_BASE = process.argv.find((_, i) => process.argv[i - 1] === '--base') || 'http://localhost:3000';
const ADMIN_SECRET = process.env.EBENOVA_ADMIN_SECRET || process.argv.find((_, i) => process.argv[i - 1] === '--secret');
const TEST_API_KEY = process.argv.find((_, i) => process.argv[i - 1] === '--key');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logTest(name, status, details = '') {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '○';
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
  log(`  ${icon} ${name}`, color);
  if (details) log(`    ${details}`, 'gray');
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════

async function testPublicEndpoints() {
  log('\n📦 PUBLIC ENDPOINTS (No Auth Required)', 'blue');

  // GET /v1/documents/types
  const typesRes = await request('/api/v1/documents/types');
  if (typesRes.status === 200 && typesRes.data.success && typesRes.data.total === 27) {
    logTest('GET /v1/documents/types', 'pass', `Returns ${typesRes.data.total} document types`);
  } else {
    logTest('GET /v1/documents/types', 'fail', `Status: ${typesRes.status}`);
  }

  // OPTIONS preflight
  const optionsRes = await request('/api/v1/documents/types', { method: 'OPTIONS' });
  if (optionsRes.status === 200) {
    logTest('OPTIONS /v1/documents/types (CORS)', 'pass');
  } else {
    logTest('OPTIONS /v1/documents/types (CORS)', 'fail', `Status: ${optionsRes.status}`);
  }
}

async function testAuthRequiredEndpoints() {
  log('\n🔐 AUTH-REQUIRED ENDPOINTS', 'blue');

  const testKey = TEST_API_KEY || 'sk_test_local_dev';

  // GET /v1/keys/usage
  const usageRes = await request('/api/v1/keys/usage', {
    headers: { 'Authorization': `Bearer ${testKey}` },
  });
  if (usageRes.status === 200 && usageRes.data.success) {
    logTest('GET /v1/keys/usage', 'pass', `Tier: ${usageRes.data.key?.tier || 'unknown'}`);
  } else if (usageRes.status === 401) {
    logTest('GET /v1/keys/usage', 'fail', '401 Unauthorized — invalid API key');
  } else {
    logTest('GET /v1/keys/usage', 'fail', `Status: ${usageRes.status}`);
  }

  // POST /v1/documents/generate
  const genRes = await request('/api/v1/documents/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testKey}` },
    body: JSON.stringify({
      document_type: 'nda',
      fields: {
        disclosingParty: 'Test Corp',
        receivingParty: 'John Doe',
        purpose: 'Testing',
        duration: '1 year',
        mutual: 'Yes',
      },
      jurisdiction: 'Nigeria',
    }),
  });
  if (genRes.status === 200 && genRes.data.success && genRes.data.document) {
    logTest('POST /v1/documents/generate', 'pass', `Generated ${genRes.data.document.length} chars`);
  } else if (genRes.status === 401) {
    logTest('POST /v1/documents/generate', 'fail', '401 Unauthorized');
  } else if (genRes.status === 500) {
    logTest('POST /v1/documents/generate', 'fail', '500 Server Error — check ANTHROPIC_API_KEY');
  } else {
    logTest('POST /v1/documents/generate', 'fail', `Status: ${genRes.status}`);
    if (genRes.data.error) log(`    ${genRes.data.error.message}`, 'gray');
  }

  // POST /v1/extract/conversation
  const extractRes = await request('/api/v1/extract/conversation', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testKey}` },
    body: JSON.stringify({
      conversation: 'Landlord: Rent is ₦1.2m per year. Tenant: Agreed. I\'m Amaka Nwosu.',
      target_document: 'tenancy-agreement',
      auto_generate: false,
    }),
  });
  if (extractRes.status === 200 && extractRes.data.success) {
    logTest('POST /v1/extract/conversation', 'pass', `Extracted ${Object.keys(extractRes.data.extracted_fields || {}).length} fields`);
  } else if (extractRes.status === 401) {
    logTest('POST /v1/extract/conversation', 'fail', '401 Unauthorized');
  } else {
    logTest('POST /v1/extract/conversation', 'fail', `Status: ${extractRes.status}`);
  }
}

async function testAdminEndpoints() {
  log('\n👑 ADMIN-ONLY ENDPOINTS', 'blue');

  if (!ADMIN_SECRET) {
    logTest('POST /v1/keys/create', 'skip', 'EBENOVA_ADMIN_SECRET not set');
    return;
  }

  // POST /v1/keys/create
  const createRes = await request('/api/v1/keys/create', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ADMIN_SECRET}` },
    body: JSON.stringify({
      owner: `test+${Date.now()}@example.com`,
      tier: 'free',
      label: 'Test key from validation script',
      env: 'test',
    }),
  });
  if (createRes.status === 201 && createRes.data.success && createRes.data.api_key) {
    logTest('POST /v1/keys/create', 'pass', `Created ${createRes.data.api_key.slice(0, 15)}...`);
    // Return the new key for further testing
    return createRes.data.api_key;
  } else if (createRes.status === 401) {
    logTest('POST /v1/keys/create', 'fail', '401 Unauthorized — invalid admin secret');
  } else {
    logTest('POST /v1/keys/create', 'fail', `Status: ${createRes.status}`);
    if (createRes.data.error) log(`    ${createRes.data.error.message}`, 'gray');
  }
}

async function testErrorHandling() {
  log('\n❌ ERROR HANDLING', 'blue');

  // Missing auth header
  const noAuthRes = await request('/api/v1/keys/usage');
  if (noAuthRes.status === 401 && noAuthRes.data.error?.code === 'MISSING_AUTH') {
    logTest('401 on missing auth', 'pass');
  } else {
    logTest('401 on missing auth', 'fail', `Got ${noAuthRes.status}`);
  }

  // Invalid document type
  const testKey = TEST_API_KEY || 'sk_test_local_dev';
  const invalidRes = await request('/api/v1/documents/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testKey}` },
    body: JSON.stringify({
      document_type: 'invalid-doc-type',
      fields: {},
    }),
  });
  if (invalidRes.status === 400 && invalidRes.data.error?.code === 'UNSUPPORTED_TYPE') {
    logTest('400 on invalid type', 'pass');
  } else {
    logTest('400 on invalid type', 'fail', `Got ${invalidRes.status}`);
  }

  // Missing required field
  const missingFieldRes = await request('/api/v1/documents/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testKey}` },
    body: JSON.stringify({
      fields: {},
    }),
  });
  if (missingFieldRes.status === 400 && missingFieldRes.data.error?.code === 'MISSING_FIELD') {
    logTest('400 on missing field', 'pass');
  } else {
    logTest('400 on missing field', 'fail', `Got ${missingFieldRes.status}`);
  }

  // Wrong HTTP method
  const wrongMethodRes = await request('/api/v1/documents/generate', {
    method: 'GET',
  });
  if (wrongMethodRes.status === 405) {
    logTest('405 on wrong method', 'pass');
  } else {
    logTest('405 on wrong method', 'fail', `Got ${wrongMethodRes.status}`);
  }
}

async function testCORS() {
  log('\n🌐 CORS HEADERS', 'blue');

  const res = await fetch(`${API_BASE}/api/v1/documents/types`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': 'GET',
    },
  });

  const corsHeaders = {
    'Access-Control-Allow-Origin': res.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': res.headers.get('Access-Control-Allow-Methods'),
    'Access-Control-Allow-Headers': res.headers.get('Access-Control-Allow-Headers'),
  };

  if (corsHeaders['Access-Control-Allow-Origin'] === '*') {
    logTest('Access-Control-Allow-Origin', 'pass', '*');
  } else {
    logTest('Access-Control-Allow-Origin', 'fail', corsHeaders['Access-Control-Allow-Origin'] || 'missing');
  }

  if (corsHeaders['Access-Control-Allow-Methods']?.includes('GET')) {
    logTest('Access-Control-Allow-Methods', 'pass');
  } else {
    logTest('Access-Control-Allow-Methods', 'fail', corsHeaders['Access-Control-Allow-Methods'] || 'missing');
  }
}

async function testPerformance() {
  log('\n⚡ PERFORMANCE (Basic)', 'blue');

  const start = Date.now();
  await request('/api/v1/documents/types');
  const duration = Date.now() - start;

  if (duration < 500) {
    logTest('Response time /v1/documents/types', 'pass', `${duration}ms`);
  } else if (duration < 1000) {
    logTest('Response time /v1/documents/types', 'pass', `${duration}ms (acceptable)`);
  } else {
    logTest('Response time /v1/documents/types', 'fail', `${duration}ms (slow)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║   EBENOVA.DEV API — ENDPOINT VALIDATION                  ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  log(`\nAPI Base: ${API_BASE}`, 'gray');
  if (TEST_API_KEY) log(`Test Key: ${TEST_API_KEY.slice(0, 15)}...`, 'gray');
  if (ADMIN_SECRET) log(`Admin Secret: [SET]`, 'gray');

  await testPublicEndpoints();
  await testAuthRequiredEndpoints();
  await testAdminEndpoints();
  await testErrorHandling();
  await testCORS();
  await testPerformance();

  log('\n╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║   VALIDATION COMPLETE                                     ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  log('\nNext steps:', 'yellow');
  log('  1. Fix any failed tests', 'gray');
  log('  2. Add environment variables in Vercel dashboard', 'gray');
  log('  3. Re-run: node test-api.js', 'gray');
  log('');
}

main().catch(console.error);
