/**
 * Logic trạng thái chờ món sau QR bàn — dùng chung server test + browser (pub-table-sent.js).
 */
const KEY = 'mq_table_order_sent';
const MIN_ETA = 10;
const MAX_ETA = 15;
const GRACE_MS = 30 * 60 * 1000;
const FROM_TABLE = 'table';

function randomEtaMinutes() {
  return MIN_ETA + Math.floor(Math.random() * (MAX_ETA - MIN_ETA + 1));
}

function parseFromParam(searchOrQuery) {
  if (!searchOrQuery) return null;
  if (typeof searchOrQuery === 'object' && searchOrQuery.from != null) {
    return String(searchOrQuery.from);
  }
  const raw = String(searchOrQuery);
  const qs = raw.startsWith('?') ? raw.slice(1) : raw;
  return new URLSearchParams(qs).get('from');
}

function getTokenFromUrl(searchOrQuery) {
  if (!searchOrQuery) return '';
  const raw = String(searchOrQuery);
  const qs = raw.startsWith('?') ? raw.slice(1) : raw;
  return new URLSearchParams(qs).get('t') || '';
}

/** URL có ?from=table — luồng chờ món tại bàn sau khi gửi bếp. */
function isFromTableUrl(searchOrQuery) {
  return parseFromParam(searchOrQuery) === FROM_TABLE;
}

function getEndMs(data) {
  if (!data || data.sentAt == null || data.etaMinutes == null) return 0;
  return data.sentAt + data.etaMinutes * 60 * 1000;
}

function isActive(data, now = Date.now()) {
  if (!data || data.sentAt == null) return false;
  return now < getEndMs(data) + GRACE_MS;
}

function getRemainingMs(data, now = Date.now()) {
  return Math.max(0, getEndMs(data) - now);
}

/** Khôi phục countdown từ query ?sent=&eta=&table=&t= sau redirect hoặc link tĩnh. */
function parseFromUrl(searchOrQuery) {
  if (!searchOrQuery) return null;
  const raw = String(searchOrQuery);
  const qs = raw.startsWith('?') ? raw.slice(1) : raw;
  const q = new URLSearchParams(qs);
  const sentAt = parseInt(q.get('sent'), 10);
  const etaMinutes = parseInt(q.get('eta'), 10);
  if (!sentAt || !etaMinutes) return null;
  return {
    sentAt,
    etaMinutes,
    tableName: q.get('table') || '',
    tableToken: q.get('t') || '',
    source: 'table',
  };
}

function resolveState(storedData, searchOrQuery) {
  const fromUrl = parseFromUrl(searchOrQuery);
  if (storedData && isActive(storedData)) return storedData;
  if (fromUrl && isActive(fromUrl)) return fromUrl;
  return storedData || fromUrl || null;
}

function buildIntroQuery(data, searchOrQuery) {
  const q = new URLSearchParams({ from: FROM_TABLE });
  if (data) {
    if (data.sentAt != null) q.set('sent', String(data.sentAt));
    if (data.etaMinutes != null) q.set('eta', String(data.etaMinutes));
    if (data.tableName) q.set('table', data.tableName);
    const token = data.tableToken || getTokenFromUrl(searchOrQuery);
    if (token) q.set('t', token);
  }
  return '?' + q.toString();
}

/**
 * Hiện UI chờ bàn khi URL có ?from=table và còn countdown (storage hoặc query).
 */
function shouldShowAwaitingUI(data, searchOrQuery, now = Date.now()) {
  if (!isFromTableUrl(searchOrQuery)) return false;
  const resolved = resolveState(data, searchOrQuery);
  return resolved != null && isActive(resolved, now);
}

/** Session chờ bàn còn hiệu lực nhưng URL thiếu ?from=table — cần redirect/bổ sung param. */
function needsTableIntroParam(data, searchOrQuery, now = Date.now()) {
  const resolved = resolveState(data, searchOrQuery);
  if (!resolved || !isActive(resolved, now)) return false;
  return !isFromTableUrl(searchOrQuery);
}

function introHref(data, searchOrQuery, now = Date.now()) {
  const resolved = resolveState(data, searchOrQuery);
  if (resolved && isActive(resolved, now)) {
    return '/gioi-thieu' + buildIntroQuery(resolved, searchOrQuery);
  }
  return '/gioi-thieu';
}

/** Link giới thiệu từ trang QR bàn — luôn giữ ngữ cảnh bàn, không lẫn luồng online. */
function tablePageIntroHref(tableToken) {
  if (!tableToken) return '/gioi-thieu';
  return `/gioi-thieu?from=table&t=${encodeURIComponent(tableToken)}`;
}

/** Đang ở luồng QR bàn (ẩn đặt online dù chưa gửi bếp). */
function isTableFlowUrl(searchOrQuery) {
  return isFromTableUrl(searchOrQuery);
}

module.exports = {
  KEY,
  MIN_ETA,
  MAX_ETA,
  GRACE_MS,
  FROM_TABLE,
  randomEtaMinutes,
  parseFromParam,
  getTokenFromUrl,
  isFromTableUrl,
  getEndMs,
  isActive,
  getRemainingMs,
  parseFromUrl,
  resolveState,
  buildIntroQuery,
  shouldShowAwaitingUI,
  needsTableIntroParam,
  introHref,
  tablePageIntroHref,
  isTableFlowUrl,
};
