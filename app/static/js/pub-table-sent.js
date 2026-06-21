/**
 * Trạng thái sau khi khách gửi món QR tại bàn — localStorage (bền qua quét lại QR / tab mới).
 * Logic đồng bộ với src/lib/table-order-sent.js
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

  function getTokenFromUrl(searchOrQuery) {
    if (!searchOrQuery) return '';
    const raw = String(searchOrQuery);
    const qs = raw.startsWith('?') ? raw.slice(1) : raw;
    return new URLSearchParams(qs).get('t') || '';
  }

  function isFromTableUrl(searchOrQuery) {
    return parseFromParam(searchOrQuery) === FROM_TABLE;
  }

  function readRaw() {
    try {
      return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function writeRaw(json) {
    try {
      localStorage.setItem(KEY, json);
      sessionStorage.setItem(KEY, json);
    } catch {
      try {
        sessionStorage.setItem(KEY, json);
      } catch {
        /* ignore */
      }
    }
  }

  function removeRaw() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  function save(payload) {
    const data = {
      sentAt: Date.now(),
      etaMinutes: randomEtaMinutes(),
      tableName: '',
      tableToken: '',
      source: 'table',
      ...(payload || {}),
    };
    if (!data.etaMinutes) data.etaMinutes = randomEtaMinutes();
    writeRaw(JSON.stringify(data));
    return data;
  }

  function load() {
    try {
      const raw = readRaw();
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

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
    if (!isFromTableUrl(searchOrQuery)) return false;
    const resolved = resolveState(data, searchOrQuery);
    return resolved != null && isActive(resolved);
  }

  function needsTableIntroParam(data, searchOrQuery) {
    const resolved = resolveState(data, searchOrQuery);
    if (!resolved || !isActive(resolved)) return false;
    return !isFromTableUrl(searchOrQuery);
  }

  function introHref(searchOrQuery) {
    const search = searchOrQuery != null ? searchOrQuery : (typeof location !== 'undefined' ? location.search : '');
    const data = load();
    const resolved = resolveState(data, search);
    if (resolved && isActive(resolved)) {
      return '/gioi-thieu' + buildIntroQuery(resolved, search);
    }
    return '/gioi-thieu';
  }

  function tablePageIntroHref(tableToken) {
    if (!tableToken) return '/gioi-thieu';
    return '/gioi-thieu?from=table&t=' + encodeURIComponent(tableToken);
  }

  function isTableFlowUrl(searchOrQuery) {
    return isFromTableUrl(searchOrQuery);
  }

  /** Vào luồng giao online — xóa trạng thái chờ bàn. */
  function clearForDeliveryFlow() {
    removeRaw();
  }

  function clear() {
    removeRaw();
  }

  global.MqTableSent = {
    save,
    load,
    parseFromUrl,
    resolveState,
    buildIntroQuery,
    getEndMs,
    getRemainingMs,
    isActive,
    isCounting,
    isFromTableUrl,
    shouldShowAwaitingUI,
    needsTableIntroParam,
    introHref,
    tablePageIntroHref,
    isTableFlowUrl,
    clearForDeliveryFlow,
    clear,
    MIN_ETA,
    MAX_ETA,
    FROM_TABLE,
  };
})(typeof window !== 'undefined' ? window : global);
