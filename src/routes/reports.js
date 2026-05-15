const express = require('express');
const router = express.Router();
const { q } = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getDashboardData() {
  const todayIncome = q.get(`
    SELECT COALESCE(SUM(p.amount),0) as total
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.status = 'completed'
      AND date(p.paid_at) = date('now','localtime')
  `).total;

  // Đếm hóa đơn hôm nay, loại order completed mà không có món nào active
  // (vd. tất cả món đã bị huỷ, hoặc completed sai luồng) — đồng nhất với
  // /orders list (lọc HAVING item_count > 0).
  const todayOrders = q.get(`
    SELECT COUNT(*) as cnt FROM orders o
    WHERE date(o.updated_at) = date('now','localtime')
      AND o.status = 'completed'
      AND EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.status != 'cancelled'
      )
  `).cnt;

  // Một bàn chỉ tính là "đang có khách" khi có order open/serving với
  // ít nhất 1 món chưa huỷ. Bàn đã bấm mở nhưng chưa gọi món → không tính.
  const occupiedTables = q.get(`
    SELECT COUNT(DISTINCT t.id) as cnt
    FROM tables t
    JOIN orders o ON o.table_id = t.id AND o.status IN ('open','serving')
    JOIN order_items oi ON oi.order_id = o.id AND oi.status != 'cancelled'
    WHERE t.is_active = 1
  `).cnt;

  const totalTables = q.get(
    `SELECT COUNT(*) as cnt FROM tables WHERE is_active=1`
  ).cnt;

  const todayExpense = q.get(`
    SELECT COALESCE(SUM(amount),0) as total FROM expenses
    WHERE date(occurred_at) = date('now','localtime')
  `).total;

  const topItems = q.all(`
    SELECT mi.name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE date(o.updated_at) = date('now','localtime')
      AND o.status = 'completed'
      AND oi.status != 'cancelled'
    GROUP BY mi.id
    ORDER BY total_qty DESC
    LIMIT 5
  `);

  // Add pct field for bar width in template (avoids Jinja2 min filter)
  const maxQty = topItems.length > 0 ? topItems[0].total_qty : 1;
  topItems.forEach(item => {
    item.pct = Math.min(100, Math.round(item.total_qty / maxQty * 100));
  });

  // Doanh thu 7 ngày
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const row = q.get(`
      SELECT COALESCE(SUM(p.amount),0) as total
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.status = 'completed'
        AND date(p.paid_at) = date('now','localtime','-${i} days')
    `);
    last7.push({ day: i, total: row.total });
  }
  const chartLabels = last7.map(r => {
    const d = new Date();
    d.setDate(d.getDate() - r.day);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const chartData = last7.map(r => r.total);

  // Sơ đồ bàn mini — gom theo tầng. Override status: bàn có status='occupied'
  // nhưng order chưa có món thực sự (mở nhưng chưa gọi) → hiển thị 'available'
  // cho khớp với counter "Bàn đang có khách" ở trên.
  const floors = q.all(`SELECT * FROM floors WHERE is_active=1 ORDER BY sort_order`);
  const allTables = q.all(`
    SELECT t.*, f.name as floor_name, r.name as room_name,
           EXISTS (
             SELECT 1 FROM orders o
             JOIN order_items oi ON oi.order_id = o.id AND oi.status != 'cancelled'
             WHERE o.table_id = t.id AND o.status IN ('open','serving')
           ) AS has_active_items
    FROM tables t
    JOIN floors f ON f.id = t.floor_id
    LEFT JOIN rooms r ON r.id = t.room_id
    WHERE t.is_active=1
    ORDER BY f.sort_order, t.id
  `);
  for (const t of allTables) {
    if (t.status === 'occupied' && !t.has_active_items) t.status = 'available';
  }

  // floors_map: array of { id, name, tables[] } for template iteration
  const floorsMap = floors.map(f => ({
    id: f.id,
    name: f.name,
    tables: allTables.filter(t => t.floor_id === f.id),
  }));

  return {
    todayIncome, todayOrders, occupiedTables, totalTables, todayExpense,
    topItems, chartLabels, chartData, floors, allTables, floorsMap,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /  →  xử lý cả /dashboard (mount tại /dashboard)
//           và /reports (mount tại /reports, render trang báo cáo)
// ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  if (req.baseUrl === '/dashboard' || req.originalUrl === '/dashboard') {
    // ── DASHBOARD ──
    const d = getDashboardData();
    return res.render('dashboard.html', {
      // Tên biến theo template hiện tại
      today_revenue:  d.todayIncome,
      today_orders:   d.todayOrders,
      occupied_count: d.occupiedTables,
      total_tables:   d.totalTables,
      today_expense:  d.todayExpense,
      top_items:      d.topItems,
      chart_labels:   d.chartLabels,
      chart_data:     d.chartData,
      floors_map:     d.floorsMap,
      today:          new Date().toISOString().slice(0, 10),
      // Alias theo spec (phòng khi template được update)
      todayIncome:    d.todayIncome,
      todayOrders:    d.todayOrders,
      occupiedTables: d.occupiedTables,
      totalTables:    d.totalTables,
      todayExpense:   d.todayExpense,
      topItems:       d.topItems,
      chartLabels:    JSON.stringify(d.chartLabels),
      chartData:      JSON.stringify(d.chartData),
      floors:         d.floors,
      allTables:      d.allTables,
    });
  }

  // ── REPORTS INDEX ──
  const monthRevenue = q.get(`
    SELECT COALESCE(SUM(p.amount),0) as total
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.status = 'completed'
      AND strftime('%Y-%m', p.paid_at) = strftime('%Y-%m','now','localtime')
  `).total;

  const monthExpense = q.get(`
    SELECT COALESCE(SUM(amount),0) as total FROM expenses
    WHERE strftime('%Y-%m', occurred_at) = strftime('%Y-%m','now','localtime')
  `).total;

  res.render('reports/index.html', {
    monthRevenue,
    monthExpense,
    monthProfit: monthRevenue - monthExpense,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /revenue  →  /reports/revenue (JSON)
// ─────────────────────────────────────────────────────────────
router.get('/revenue', requireAuth, (req, res) => {
  const period = req.query.period || 'day';
  const date   = req.query.date   || new Date().toISOString().slice(0, 10);

  let rows;
  if (period === 'month') {
    rows = q.all(`
      SELECT date(p.paid_at) as label,
             COALESCE(SUM(p.amount),0)   as total
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.status = 'completed'
        AND p.paid_at >= date('now','localtime','-29 days')
      GROUP BY label ORDER BY label
    `);
  } else if (period === 'week') {
    rows = q.all(`
      SELECT date(p.paid_at) as label,
             COALESCE(SUM(p.amount),0)   as total
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.status = 'completed'
        AND p.paid_at >= date('now','localtime','-6 days')
      GROUP BY label ORDER BY label
    `);
  } else {
    rows = q.all(`
      SELECT strftime('%H:00', p.paid_at) as label,
             COALESCE(SUM(p.amount),0)                as total
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.status = 'completed'
        AND date(p.paid_at) = ?
      GROUP BY label ORDER BY label
    `, date);
  }

  const total  = rows.reduce((s, r) => s + r.total, 0);
  const values = rows.map(r => r.total);
  const max    = values.length ? Math.max(...values) : 0;
  const min    = values.length ? Math.min(...values) : 0;

  res.json({
    labels:  rows.map(r => r.label),
    data:    values,
    summary: { total, avg: rows.length ? total / rows.length : 0, max, min },
  });
});

// ─────────────────────────────────────────────────────────────
// GET /items  →  /reports/items (JSON)
// ─────────────────────────────────────────────────────────────
router.get('/items', requireAuth, (req, res) => {
  const start = req.query.start_date || new Date().toISOString().slice(0, 10);
  const end   = req.query.end_date   || start;

  const rows = q.all(`
    SELECT mi.name,
           mc.name          as category,
           SUM(oi.quantity) as qty,
           SUM(oi.subtotal) as revenue
    FROM order_items oi
    JOIN menu_items mi       ON mi.id = oi.item_id
    JOIN menu_categories mc  ON mc.id = mi.category_id
    JOIN orders o            ON o.id  = oi.order_id
    WHERE o.status  = 'completed'
      AND oi.status != 'cancelled'
      AND date(o.updated_at) BETWEEN ? AND ?
    GROUP BY mi.id
    ORDER BY qty DESC
    LIMIT 20
  `, start, end);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  res.json({
    items: rows.map(r => ({
      ...r,
      pct: totalRevenue ? (r.revenue / totalRevenue * 100).toFixed(1) : '0.0',
    })),
  });
});

// ─────────────────────────────────────────────────────────────
// GET /finance  →  /reports/finance (JSON)
// ─────────────────────────────────────────────────────────────
router.get('/finance', requireAuth, (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const income = q.get(`
    SELECT COALESCE(SUM(p.amount),0) as total
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.status = 'completed'
      AND strftime('%Y-%m', p.paid_at) = ?
  `, month).total;

  const expByCategory = q.all(`
    SELECT ec.name                  as name,
           COALESCE(SUM(e.amount),0) as total
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE strftime('%Y-%m', e.occurred_at) = ?
    GROUP BY ec.id
    ORDER BY total DESC
  `, month);

  const expDetail = q.all(`
    SELECT date(e.occurred_at)  as date,
           ec.name              as category,
           e.description,
           e.amount
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE strftime('%Y-%m', e.occurred_at) = ?
    ORDER BY e.occurred_at DESC
  `, month);

  const totalExp = expByCategory.reduce((s, r) => s + r.total, 0);

  res.json({
    // Tên theo template hiện tại
    total_income:    income,
    total_expense:   totalExp,
    profit:          income - totalExp,
    expense_by_cat:  expByCategory,
    expenses_detail: expDetail,
    // Alias theo spec
    income,
    expense:    totalExp,
    byCategory: expByCategory,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /profit-trend → so sánh thu/chi/lợi nhuận theo Tháng / Quý / Năm
// Trả về danh sách N kỳ gần nhất (mặc định month=12, quarter=8, year=5)
// đã fill 0 cho kỳ không có dữ liệu để chart liền mạch.
// ─────────────────────────────────────────────────────────────
router.get('/profit-trend', requireAuth, (req, res) => {
  const period = req.query.period === 'year' ? 'year'
               : req.query.period === 'quarter' ? 'quarter'
               : 'month';

  // Sinh danh sách kỳ mục tiêu (cũ → mới)
  const now = new Date();
  const periods = [];
  if (period === 'month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      periods.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `T${m}/${String(y).slice(2)}` });
    }
  } else if (period === 'quarter') {
    const curQ = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 7; i >= 0; i--) {
      let q = curQ - i, y = now.getFullYear();
      while (q <= 0) { q += 4; y--; }
      periods.push({ key: `${y}-Q${q}`, label: `Q${q}/${String(y).slice(2)}` });
    }
  } else { // year
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      periods.push({ key: String(y), label: String(y) });
    }
  }

  // Expression group-by tương ứng cho SQLite
  const keyExpr = (col) => {
    if (period === 'month')   return `strftime('%Y-%m', ${col})`;
    if (period === 'year')    return `strftime('%Y', ${col})`;
    return `strftime('%Y', ${col}) || '-Q' || ((CAST(strftime('%m', ${col}) AS INTEGER) + 2) / 3)`;
  };

  const incomeRows = q.all(
    `SELECT ${keyExpr('p.paid_at')} AS k, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.status = 'completed'
     GROUP BY k`
  );
  const expenseRows = q.all(
    `SELECT ${keyExpr('occurred_at')} AS k, COALESCE(SUM(amount), 0) AS total
     FROM expenses
     GROUP BY k`
  );

  const incomeBy  = Object.fromEntries(incomeRows.map(r => [r.k, r.total]));
  const expenseBy = Object.fromEntries(expenseRows.map(r => [r.k, r.total]));

  const rows = periods.map(p => {
    const income  = incomeBy[p.key]  || 0;
    const expense = expenseBy[p.key] || 0;
    const profit  = income - expense;
    return {
      key: p.key, label: p.label,
      income, expense, profit,
      margin: income > 0 ? +((profit / income) * 100).toFixed(1) : 0,
    };
  });

  const totals = rows.reduce((acc, r) => ({
    income:  acc.income  + r.income,
    expense: acc.expense + r.expense,
    profit:  acc.profit  + r.profit,
  }), { income: 0, expense: 0, profit: 0 });

  res.json({ period, rows, totals });
});

module.exports = router;
