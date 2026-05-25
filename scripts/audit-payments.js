#!/usr/bin/env node
/**
 * Read-only audit: order completed mà tổng payments ≠ final_amount.
 * Usage: node scripts/audit-payments.js
 *        DB_PATH=/data/myquang.db node scripts/audit-payments.js
 */
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'myquang.db');
process.env.DB_PATH = DB_PATH;

const { q } = require('../src/db');

const MONEY_EPS = 0.01;

const mismatches = q.all(`
  SELECT o.id,
         o.order_code,
         o.final_amount,
         o.updated_at,
         COALESCE(SUM(p.amount), 0) AS paid_total
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.status = 'completed'
  GROUP BY o.id
  HAVING ABS(COALESCE(SUM(p.amount), 0) - o.final_amount) > ?
  ORDER BY o.updated_at DESC
`, MONEY_EPS);

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
