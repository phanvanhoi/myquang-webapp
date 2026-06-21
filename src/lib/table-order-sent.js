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

/**
 * Chỉ hiện UI chờ bàn (ẩn đặt online) khi vừa có session vừa vào từ ?from=table.
 * Tránh lẫn khi khách bấm「Về quán」từ /order mà session cũ còn trong tab.
 */
function shouldShowAwaitingUI(data, searchOrQuery, now = Date.now()) {
  if (!data || data.sentAt == null) return false;
  return isActive(data, now) && isFromTableUrl(searchOrQuery);
}

/** Session chờ bàn còn hiệu lực nhưng URL thiếu ?from=table — cần redirect/bổ sung param. */
function needsTableIntroParam(data, searchOrQuery, now = Date.now()) {
  if (!data || data.sentAt == null) return false;
  return isActive(data, now) && !isFromTableUrl(searchOrQuery);
}

function introHref(data, now = Date.now()) {
  if (data && isActive(data, now)) return '/gioi-thieu?from=table';
  return '/gioi-thieu';
}

module.exports = {
  KEY,
  MIN_ETA,
  MAX_ETA,
  GRACE_MS,
  FROM_TABLE,
  randomEtaMinutes,
  parseFromParam,
  isFromTableUrl,
  getEndMs,
  isActive,
  getRemainingMs,
  shouldShowAwaitingUI,
  needsTableIntroParam,
  introHref,
};
