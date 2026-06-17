/** Cache tóm tắt tồn kho cho dialog — tránh query mỗi request HTML. */
const TTL_MS = 90 * 1000;

let cache = null;

function getCachedDailySummary() {
  const { buildDailySummary, vietnamDateKey } = require('./inventory');
  const now = Date.now();
  const dateKey = vietnamDateKey();
  if (cache && cache.dateKey === dateKey && (now - cache.at) < TTL_MS) {
    return cache.summary;
  }
  const summary = buildDailySummary();
  cache = { dateKey, summary, at: now };
  return summary;
}

function invalidateDailySummaryCache() {
  cache = null;
}

module.exports = { getCachedDailySummary, invalidateDailySummaryCache };
