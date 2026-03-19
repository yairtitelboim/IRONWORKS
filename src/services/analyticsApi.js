/**
 * Analytics API — logs user interactions to Supabase for usage tracking.
 *
 * Writes to the `search_logs` table using:
 *   query       → search text or event name
 *   query_type  → 'address' | 'perplexity' | 'event'
 *   source      → originating component
 *   metadata    → structured event properties
 *   viewport    → { w, h, dpr, touch }
 *   session_id  → stable per-tab session
 *   user_agent  → navigator.userAgent
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

let _sessionId = null;
function getSessionId() {
  if (!_sessionId) {
    _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return _sessionId;
}

function getViewport() {
  if (typeof window === 'undefined') return null;
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  };
}

let _contextCache = null;
function getAttributionContext() {
  if (_contextCache) return _contextCache;
  if (typeof window === 'undefined') {
    _contextCache = {};
    return _contextCache;
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    _contextCache = {
      // Cohort attribution
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      utm_content: params.get('utm_content') || null,
      utm_term: params.get('utm_term') || null,
      ref: params.get('ref') || null,
      // Gated beta identity (non-PII but stable per invite link)
      cohort: params.get('cohort') || null,
      invite: params.get('invite') || null,
    };
    return _contextCache;
  } catch {
    _contextCache = {};
    return _contextCache;
  }
}

let _userId = null;
function getUserId() {
  if (_userId) return _userId;
  if (typeof window === 'undefined') {
    _userId = null;
    return _userId;
  }
  try {
    const key = 'pha_uid';
    const existing = window.localStorage.getItem(key);
    if (existing) {
      _userId = existing;
      return _userId;
    }
    const newId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, newId);
    _userId = newId;
    return _userId;
  } catch {
    // Private mode / blocked storage: fall back to session-scoped id
    _userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return _userId;
  }
}

function writeRow(query, queryType, source, metadata) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    // Merge attribution + stable anonymous user_id into every row so dashboards
    // can segment by cohort/invite and de-dupe users across sessions.
    const context = getAttributionContext();
    const user_id = getUserId();
    const mergedMetadata = { ...context, user_id, ...(metadata || {}) };

    const body = JSON.stringify({
      query,
      query_type: queryType,
      source,
      session_id: getSessionId(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      viewport: getViewport(),
      metadata: mergedMetadata,
    });
    // Use sendBeacon when available for resilience during page unload
    const url = `${SUPABASE_URL}/rest/v1/search_logs`;
    if (typeof navigator?.sendBeacon === 'function' && queryType === 'event') {
      const blob = new Blob([body], { type: 'application/json' });
      const headers = new Headers({
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      });
      // sendBeacon can't set custom headers, fall through to fetch
    }
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent — analytics should never break the app
  }
}

/**
 * Log a search query. Fire-and-forget.
 */
export function logSearch(query, { queryType = 'address', source = 'ask_anything', metadata = {} } = {}) {
  if (!query?.trim()) return;
  writeRow(query.trim(), queryType, source, metadata);
}

/**
 * Log an interaction event. Fire-and-forget.
 *
 * @param {string} eventName - e.g. 'geocode_success', 'verdict_shown', 'layer_toggled'
 * @param {object} [properties] - structured event data
 * @param {string} [source] - originating component
 */
export function logEvent(eventName, properties = {}, source = 'app') {
  if (!eventName) return;
  writeRow(eventName, 'event', source, properties);
}

/**
 * Returns an `emitOncePerKey(eventName, payload, { key, ttlMs })` function
 * backed by a React ref (Map). Pass the ref from a `useRef(new Map())` call
 * in your component. Prevents duplicate "_seen" events during re-renders while
 * still allowing re-logging after the TTL window elapses.
 *
 * Usage:
 *   const seenRef = useRef(new Map());
 *   const emitOnce = createOncePerKeyEmitter(seenRef, logEvent);
 *   emitOnce('opposition_card_seen', { ...props }, { key: coordStr, ttlMs: 60000 });
 */
export function createOncePerKeyEmitter(seenRef, emitFn) {
  return function emitOncePerKey(eventName, payload, { key = '', ttlMs = 60000 } = {}) {
    const k = `${eventName}::${key}`;
    const now = Date.now();
    const last = seenRef.current.get(k);
    if (last !== undefined && now - last < ttlMs) return;
    seenRef.current.set(k, now);
    emitFn(eventName, payload);
  };
}

let _busListenerAttached = false;

/**
 * Subscribe to `analytics:event` on window.mapEventBus and persist every
 * event to Supabase. Call once during app init (idempotent).
 */
export function initEventBusTracking() {
  if (_busListenerAttached) return;
  if (typeof window === 'undefined' || !window.mapEventBus) return;

  _busListenerAttached = true;
  window.mapEventBus.on('analytics:event', (data) => {
    if (!data?.event) return;
    const { event: eventName, source: src, timestamp, ...rest } = data;
    logEvent(eventName, { ...rest, busTimestamp: timestamp }, src || 'event_bus');
  });
}
