function roundQty(n) {
  return Math.round(n * 10) / 10;
}

function buildNoodleGroup(row, period) {
  const qty = row?.qty || 0;
  const revenue = row?.revenue || 0;
  const { days, weeks, months } = period;
  return {
    qty,
    revenue,
    avg_day: days ? roundQty(qty / days) : 0,
    avg_week: weeks ? roundQty(qty / weeks) : 0,
    avg_month: months ? roundQty(qty / months) : 0,
    revenue_avg_day: days ? Math.round(revenue / days) : 0,
    revenue_avg_week: weeks ? Math.round(revenue / weeks) : 0,
    revenue_avg_month: months ? Math.round(revenue / months) : 0,
  };
}

function buildNoodleStats(rows, period) {
  const byType = Object.fromEntries(rows.map(r => [r.noodle_type, r]));
  return {
    period,
    mi: buildNoodleGroup(byType.mi, period),
    bun: buildNoodleGroup(byType.bun, period),
  };
}

module.exports = { buildNoodleStats, buildNoodleGroup, roundQty };
