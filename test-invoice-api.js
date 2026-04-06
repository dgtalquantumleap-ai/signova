// test-invoice-api.js
// Test script for Ebenova Invoice API endpoint
// Run: node test-invoice-api.js

// IMPORTANT: Never hardcode live API keys. Set EBENOVA_API_KEY in your environment.
// Example: $env:EBENOVA_API_KEY="sk_live_..." ; node test-invoice-api.js
const API_KEY = process.env.EBENOVA_API_KEY || 'sk_test_local_dev';
const BASE_URL = 'https://api.ebenova.dev';

const tests = [
  {
    name: 'Test 1: Basic invoice (from, to, 1 item)',
    payload: {
      type: 'invoice',
      from: {
        name: 'Acme Design Ltd.',
        address: '12 Marina, Lagos, Nigeria',
        email: 'billing@acme.com',
      },
      to: {
        name: 'John Smith',
        address: '456 Oak Ave, London, UK',
        email: 'john@example.com',
      },
      items: [
        {
          description: 'Website Design',
          quantity: 1,
          unit_price: 2500,
        },
      ],
      invoice_number: 'INV-2026-001',
      issue_date: 'April 1, 2026',
      due_date: 'April 30, 2026',
      currency: 'USD',
    },
  },
  {
    name: 'Test 2: Invoice with tax + discount',
    payload: {
      type: 'invoice',
      from: {
        name: 'Tech Solutions Inc.',
        address: '100 King St, Calgary, AB',
        email: 'hello@techsolutions.com',
        tax_id: 'CA-123456789',
      },
      to: {
        name: 'Small Business Corp',
        address: '200 Queen St, Toronto, ON',
        email: 'accounts@smallbiz.com',
      },
      items: [
        {
          description: 'Consulting Services',
          quantity: 10,
          unit_price: 150,
        },
        {
          description: 'Software License',
          quantity: 5,
          unit_price: 200,
        },
      ],
      invoice_number: 'INV-2026-002',
      issue_date: 'March 28, 2026',
      due_date: 'April 28, 2026',
      currency: 'CAD',
      tax_rate: 13, // HST
      discount_percent: 10,
      notes: 'Thank you for your business!',
      payment_instructions: 'Bank Transfer: TD Bank, Account: 123456789',
    },
  },
  {
    name: 'Test 3: Generate receipt (type: "receipt")',
    payload: {
      type: 'receipt',
      from: {
        name: 'Ebenova Solutions',
        address: 'Calgary, Alberta',
        email: 'billing@ebenova.dev',
      },
      to: {
        name: 'Beta Customer',
        address: 'Lagos, Nigeria',
        email: 'customer@example.com',
      },
      items: [
        {
          description: 'Signova Pro - Annual Subscription',
          quantity: 1,
          unit_price: 199.99,
        },
      ],
      invoice_number: 'REC-2026-001',
      issue_date: 'March 28, 2026',
      currency: 'USD',
    },
  },
  {
    name: 'Test 4: Generate proforma invoice (type: "proforma")',
    payload: {
      type: 'proforma',
      from: {
        name: 'Export Goods Ltd.',
        address: 'Nairobi, Kenya',
        email: 'exports@exportgoods.co.ke',
        tax_id: 'KE-987654321',
      },
      to: {
        name: 'Import Partners Inc.',
        address: 'Dubai, UAE',
        email: 'imports@importpartners.ae',
      },
      items: [
        {
          description: 'Agricultural Equipment - Model X200',
          quantity: 5,
          unit_price: 5000,
        },
        {
          description: 'Shipping & Handling',
          quantity: 1,
          unit_price: 800,
        },
      ],
      invoice_number: 'PRO-2026-001',
      issue_date: 'March 28, 2026',
      due_date: 'April 15, 2026',
      currency: 'USD',
      tax_rate: 16, // VAT
      notes: 'Proforma invoice for customs clearance. Valid for 30 days.',
    },
  },
  {
    name: 'Test 5: Error handling (missing required fields)',
    payload: {
      type: 'invoice',
      from: {
        name: 'Only From Name',
        // Missing address, email, etc.
      },
      // Missing 'to' entirely
      // Missing 'items' entirely
    },
    expectError: true,
  },
];

async function runTest(test, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${test.name}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/v1/invoices/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test.payload),
    });

    const data = await response.json();

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response:`);
    console.log(JSON.stringify(data, null, 2));

    if (test.expectError) {
      if (!data.success) {
        console.log('✅ PASS: Expected error received');
        console.log(`   Error code: ${data.error?.code}`);
        console.log(`   Message: ${data.error?.message}`);
        return { passed: true, test: test.name };
      } else {
        console.log('❌ FAIL: Expected error but got success');
        return { passed: false, test: test.name };
      }
    }

    if (data.success) {
      console.log('✅ PASS: Invoice generated successfully');
      console.log(`   Invoice ID: ${data.invoice_id}`);
      console.log(`   Invoice Number: ${data.invoice_number}`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Currency: ${data.currency}`);
      console.log(`   Subtotal: ${data.subtotal}`);
      console.log(`   Tax: ${data.tax_amount}`);
      console.log(`   Discount: ${data.discount_amount}`);
      console.log(`   Total: ${data.total}`);
      console.log(`   HTML length: ${data.html?.length || 0} characters`);
      console.log(`   Documents remaining: ${data.usage?.documents_remaining}`);
      return { passed: true, test: test.name };
    } else {
      console.log('❌ FAIL: Invoice generation failed');
      console.log(`   Error: ${data.error?.message}`);
      return { passed: false, test: test.name };
    }
  } catch (error) {
    console.log('❌ FAIL: Request threw an exception');
    console.log(`   Error: ${error.message}`);
    return { passed: false, test: test.name };
  }
}

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     EBENOVA INVOICE API — TEST SUITE                    ║');
  console.log('║     Base URL: https://api.ebenova.dev                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const result = await runTest(tests[i], i);
    results.push(result);
    // Add a small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.test}`);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
