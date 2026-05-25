#!/usr/bin/env node
/**
 * Read-only audit: order completed mà tổng payments ≠ final_amount.
 * Usage: node scripts/audit-payments.js
 *        DB_PATH=/data/myquang.db node scripts/audit-payments.js
 */
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'myquang.db');
process.env.DB_PATH = DB_PATH;

const { MONEY_EPS } = require('../src/lib/money');
const { q } = require('../src/db');

const mismatches = q.findCompletedOrdersWithPaymentMismatch(MONEY_EPS);

console.log(`DB: ${DB_PATH}`);
console.log(`Completed orders with payment mismatch: ${mismatches.length}`);

if (mismatches.length === 0) {
  console.log('OK — no mismatches found.');
  process.exit(0);
}

for (const row of mismatches) {
  console.log(
    `- ${row.order_code} (id=${row.id}): final=${row.final_amount}, paid=${row.paid_total}, at=${row.updated_at}`
  );
}

console.log('\nRead-only audit — no data was modified.');
process.exit(1);
