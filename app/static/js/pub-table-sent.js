/**
 * Trạng thái sau khi khách gửi món QR tại bàn — sessionStorage (tab hiện tại).
 * Logic shouldShowAwaitingUI đồng bộ với src/lib/table-order-sent.js
 */
(function (global) {
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

  function isFromTableUrl(searchOrQuery) {
    return parseFromParam(searchOrQuery) === FROM_TABLE;
  }

  function save(payload) {
    const data = {
      sentAt: Date.now(),
      etaMinutes: randomEtaMinutes(),
      tableName: '',
      source: 'table',
      ...(payload || {}),
    };
    if (!data.etaMinutes) data.etaMinutes = randomEtaMinutes();
    sessionStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getEndMs(data) {
    if (!data || data.sentAt == null || data.etaMinutes == null) return 0;
    return data.sentAt + data.etaMinutes * 60 * 1000;
  }

  function getRemainingMs(data, now) {
    const t = now != null ? now : Date.now();
    return Math.max(0, getEndMs(data) - t);
  }

  function isActive(data) {
    if (!data || data.sentAt == null) return false;
    return Date.now() < getEndMs(data) + GRACE_MS;
  }

  function isCounting(data) {
    return getRemainingMs(data) > 0;
  }

  function shouldShowAwaitingUI(data, searchOrQuery) {
    if (!data || data.sentAt == null) return false;
    return isActive(data) && isFromTableUrl(searchOrQuery);
  }

  function introHref() {
    const data = load();
    if (data && isActive(data)) return '/gioi-thieu?from=table';
    return '/gioi-thieu';
  }

  /** Vào luồng giao online — xóa trạng thái chờ bàn trong tab. */
  function clearForDeliveryFlow() {
    sessionStorage.removeItem(KEY);
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  global.MqTableSent = {
    save,
    load,
    getEndMs,
    getRemainingMs,
    isActive,
    isCounting,
    isFromTableUrl,
    shouldShowAwaitingUI,
    introHref,
    clearForDeliveryFlow,
    clear,
    MIN_ETA,
    MAX_ETA,
    FROM_TABLE,
  };
})(typeof window !== 'undefined' ? window : global);
