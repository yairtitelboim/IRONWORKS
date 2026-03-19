/**
 * Power Grid API — Supabase PostGIS backend for HIFLD transmission lines.
 *
 * Replaces the 355 MB static GeoJSON fetch with a spatial query that returns
 * only the lines inside a given radius.  Falls back to the static file when
 * the Supabase env vars are missing so the app stays stable during rollout.
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const HIFLD_STATIC_URL = '/data/hifld_transmission_lines.json';
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// In-memory cache keyed by "lng,lat,radius"
const _cache = new Map();
const MAX_CACHE = 20;

function cacheKey(lng, lat, radius) {
  return `${lng.toFixed(3)},${lat.toFixed(3)},${Math.round(radius)}`;
}

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return e.data;
}

function cacheSet(key, data) {
  if (_cache.size >= MAX_CACHE) _cache.delete(_cache.keys().next().value);
  _cache.set(key, { data, ts: Date.now() });
}

async function supabaseRpc(params) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_hifld_lines_in_radius`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) { console.warn(`[powerGridApi] RPC ${res.status}`); return null; }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn('[powerGridApi] RPC failed:', err.name === 'AbortError' ? 'timeout' : err.message);
    return null;
  }
}

/**
 * Fetch HIFLD transmission lines inside a radius.
 *
 * @param {{ lng: number, lat: number }} center
 * @param {number} radiusMeters  — defaults to ~15 mi
 * @param {number} minVoltageRank — 0 = all, 1 = 500kV+, etc.
 * @returns {Promise<{ type: string, features: Array }>}
 */
export async function getHIFLDLines(center, radiusMeters = 24140, minVoltageRank = 0) {
  const { lng, lat } = center;
  const key = cacheKey(lng, lat, radiusMeters);
  const cached = cacheGet(key);
  if (cached) {
    console.log(`[powerGridApi] cache hit — ${cached.features.length} features`);
    return cached;
  }

  const rpc = await supabaseRpc({
    center_lng: lng,
    center_lat: lat,
    radius_meters: radiusMeters,
    min_voltage_rank: minVoltageRank,
  });

  if (rpc?.features) {
    console.log(`[powerGridApi] Supabase returned ${rpc.features.length} HIFLD features`);
    cacheSet(key, rpc);
    return rpc;
  }

  // Fallback: static file (full 355 MB — same behavior as before)
  console.warn('[powerGridApi] Falling back to static HIFLD file');
  try {
    const res = await fetch(HIFLD_STATIC_URL);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data;
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

/**
 * True when Supabase env vars are configured.
 */
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Flush the in-memory cache (e.g. on location change).
 */
export function clearHIFLDCache() {
  _cache.clear();
}
