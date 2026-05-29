const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROUTE_MODULES = [
  '../src/db',
  '../src/routes/tables',
  '../src/routes/orders',
  '../src/lib/table-move',
  '../src/lib/table-guest',
  '../src/lib/virtual-tables',
  '../src/middleware/auth',
];

function clearRouteCaches() {
  ROUTE_MODULES.forEach((mod) => {
    delete require.cache[require.resolve(mod)];
  });
}

function loadDb(tmpPath) {
  process.env.DB_PATH = tmpPath;
  clearRouteCaches();
  return require('../src/db');
}

function seedRouteFixture(q) {
  q.run(`INSERT INTO roles (name, permissions) VALUES ('admin', '[]'), ('cashier', '[]'), ('waiter', '[]')`);
  q.run(
    `INSERT INTO users (id, role_id, username, full_name, password_hash)
     VALUES (1, 1, 'admin1', 'Admin', 'x'),
            (2, 2, 'cashier1', 'Cashier', 'x'),
            (3, 3, 'waiter1', 'Waiter', 'x')`
  );
  const floor = q.run(`INSERT INTO floors (name, sort_order) VALUES ('T1', 1)`);
  const t1 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B01', 'Bàn 01', 4, 'occupied', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const t2 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B02', 'Bàn 02', 4, 'available', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const t3 = q.run(
    `INSERT INTO tables (floor_id, code, name, capacity, status, is_active, is_takeaway, is_virtual)
     VALUES (?, 'T1-B03', 'Bàn 03', 4, 'occupied', 1, 0, 0)`,
    floor.lastInsertRowid
  );
  const order = q.run(
    `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
     VALUES (?, 1, 'ORD-ROUTE-1', 'serving', 'dine_in', 2)`,
    t1.lastInsertRowid
  );
  q.run(
    `INSERT INTO orders (table_id, user_id, order_code, status, order_type, guest_count)
     VALUES (?, 1, 'ORD-ROUTE-2', 'serving', 'dine_in', 2)`,
    t3.lastInsertRowid
  );
  return {
    orderId: order.lastInsertRowid,
    table1: t1.lastInsertRowid,
    table2: t2.lastInsertRowid,
    table3: t3.lastInsertRowid,
  };
}

function buildApp(role) {
  const express = require('express');
  const session = require('express-session');
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    res.render = function renderStub() {
      this.status(403);
      this.end('forbidden');
    };
    if (role) {
      req.session.userId = role === 'waiter' ? 3 : role === 'cashier' ? 2 : 1;
      req.session.role = role;
    }
    next();
  });
  app.use('/tables', require('../src/routes/tables'));
  app.use('/orders', require('../src/routes/orders'));
  return app;
}

function request(app, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method,
          headers: body
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {},
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, raw, headers: res.headers });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

test('GET /tables/available-for-move requires admin or cashier', async () => {
  const tmp = path.join(os.tmpdir(), `myquang-mr-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    loadDb(tmp);
    seedRouteFixture(require('../src/db').q);

    const waiterApp = buildApp('waiter');
    const waiterRes = await request(waiterApp, 'GET', '/tables/available-for-move');
    assert.strictEqual(waiterRes.status, 403);

    const cashierApp = buildApp('cashier');
    const cashierRes = await request(cashierApp, 'GET', '/tables/available-for-move');
    assert.strictEqual(cashierRes.status, 200);
    const data = JSON.parse(cashierRes.raw);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.tables));
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});

test('POST /orders/:id/move-table requires admin or cashier', async () => {
  const tmp = path.join(os.tmpdir(), `myquang-mr2-${Date.now()}.db`);
  const lockDir = tmp + '.lock';
  try {
    loadDb(tmp);
    const { orderId, table2 } = seedRouteFixture(require('../src/db').q);

    const waiterApp = buildApp('waiter');
    const waiterRes = await request(waiterApp, 'POST', `/orders/${orderId}/move-table`, {
      target_table_id: table2,
      return_to: 'floor',
    });
    assert.strictEqual(waiterRes.status, 403);

    const adminApp = buildApp('admin');
    const adminRes = await request(adminApp, 'POST', `/orders/${orderId}/move-table`, {
      target_table_id: table2,
      return_to: 'floor',
    });
    assert.strictEqual(adminRes.status, 200);
    const data = JSON.parse(adminRes.raw);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.redirect, '/tables');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    if (fs.existsSync(lockDir)) fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
