import { kv } from '@vercel/kv';

const CACHE_TTL_SECONDS = 30 * 60;
const REQUEST_TIMEOUT_MS = 2200;
const SCHEMA_VERSION = '1.0.0';
const CACHE_KEY_VERSION = 'v1';
const RATE_LIMIT_KEY_VERSION = 'v1';
const RATE_LIMIT_WINDOW_SECONDS = (() => {
  const value = Number(process.env.QUEUE_METRICS_RATE_LIMIT_WINDOW_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 10 * 60;
})();
const RATE_LIMIT_MAX_REQUESTS = (() => {
  const value = Number(process.env.QUEUE_METRICS_RATE_LIMIT_MAX_REQUESTS);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 60;
})();
const SUCCESS_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const ERROR_CACHE_CONTROL = 'no-store';

/**
 * queueMetrics contract (returned to location_search metadata):
 * {
 *   schemaVersion, source, countyName, countyGeoid,
 *   activeQueueCount, totalQueueCount, activeQueueMw, avgCapacityMw,
 *   dominantFuelType, baseloadPct, renewablePct, storagePct,
 *   countyType, netMw, queueWithdrawnCount, queueCompletedCount,
 *   dataCenterCount, dataCenterExistingCount, dataCenterUnderConstructionCount, dataCenterAnnouncedCount,
 *   units, queriedAt, isFallback
 * }
 */

const toFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

const normalizeRow = (row = {}) => {
  const projectCount = toInt(
    row.project_count ?? row.active_queue_count ?? row.active_projects_count,
    0
  );
  const totalQueueCount = toInt(
    row.total_queue_count ?? row.total_project_count ?? row.queue_total_count ?? projectCount,
    projectCount
  );
  const totalCapacityMw = toFiniteNumber(
    row.total_capacity_mw ?? row.active_queue_mw ?? row.queue_active_mw,
    0
  );
  const avgCapacityMw = toFiniteNumber(
    row.avg_capacity_mw ?? row.average_capacity_mw ?? (projectCount > 0 ? totalCapacityMw / projectCount : 0),
    0
  );

  const queueWithdrawnCount = toInt(
    row.queue_withdrawn_count ?? row.withdrawn_count ?? row.withdrawn_projects_count,
    Math.max(0, Math.round(totalQueueCount * 0.22))
  );
  const queueCompletedCount = toInt(
    row.queue_completed_count ?? row.completed_count ?? row.completed_projects_count,
    Math.max(0, Math.round(totalQueueCount * 0.16))
  );

  const countyName = String(row.county_name ?? row.name ?? row.NAME ?? '').trim();
  const countyGeoid = String(row.geoid ?? row.GEOID ?? '').trim();
  const countyTypeRaw = String(
    row.county_type ?? row.producer_consumer_type ?? row.county_profile_type ?? ''
  ).toLowerCase();
  const countyType = countyTypeRaw === 'consumer' ? 'consumer' : 'producer';
  const netMw = toFiniteNumber(row.net_mw ?? row.county_net_mw ?? totalCapacityMw, totalCapacityMw);
  const dataCenterExistingCount = toInt(
    row.data_centers_existing ?? row.dc_existing_count ?? row.existing_count,
    0
  );
  const dataCenterUnderConstructionCount = toInt(
    row.data_centers_under_construction ?? row.dc_under_construction_count ?? row.under_construction_count,
    0
  );
  const dataCenterAnnouncedCount = toInt(
    row.data_centers_announced ?? row.dc_announced_count ?? row.announced_count,
    0
  );
  const dataCenterCount = toInt(
    row.dc_count ??
      row.data_center_count ??
      row.data_centers_total ??
      dataCenterExistingCount + dataCenterUnderConstructionCount + dataCenterAnnouncedCount,
    0
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    source: 'supabase',
    countyName,
    countyGeoid,
    activeQueueCount: projectCount,
    totalQueueCount,
    activeQueueMw: totalCapacityMw,
    avgCapacityMw,
    dominantFuelType: row.dominant_fuel_type ?? row.dominant_fuel ?? null,
    baseloadPct: toFiniteNumber(row.baseload_pct, null),
    renewablePct: toFiniteNumber(row.renewable_pct, null),
    storagePct: toFiniteNumber(row.storage_pct, null),
    countyType,
    netMw,
    queueWithdrawnCount,
    queueCompletedCount,
    dataCenterCount,
    dataCenterExistingCount,
    dataCenterUnderConstructionCount,
    dataCenterAnnouncedCount,
    nearestSubDistanceMi: toFiniteNumber(
      row.nearest_sub_distance_mi ?? row.nearestSubDistanceMi,
      null
    ),
    nearestSubName: String(row.nearest_sub_name ?? row.nearestSubName ?? '').trim() || null,
    nearestSubVoltageKv: toFiniteNumber(
      row.nearest_sub_voltage_kv ?? row.nearestSubVoltageKv,
      null
    ),
    nearestSubOperator: String(row.nearest_sub_operator ?? row.nearestSubOperator ?? '').trim() || null,
    nearestSubPoiCount: toFiniteNumber(
      row.nearest_sub_poi_count ?? row.nearestSubPoiCount,
      null
    ),
    estWaitMonthsLow: toFiniteNumber(
      row.est_wait_months_low ?? row.estWaitMonthsLow,
      null
    ),
    estWaitMonthsHigh: toFiniteNumber(
      row.est_wait_months_high ?? row.estWaitMonthsHigh,
      null
    ),
    estWaitSource: row.est_wait_source ?? row.estWaitSource ?? null,
    ercotAvgActiveQueueCount: toFiniteNumber(
      row.ercot_avg_active_queue_count ?? row.ercotAvgActiveQueueCount,
      null
    ),
    units: {
      activeQueueCount: 'projects',
      totalQueueCount: 'projects',
      activeQueueMw: 'mw',
      avgCapacityMw: 'mw',
      netMw: 'mw',
      dataCenterCount: 'sites'
    },
    queriedAt: Date.now(),
    isFallback: false
  };
};

const roundedCoord = (value) => Number(value).toFixed(4);

const cacheKeyFor = (lat, lng) =>
  `queueMetrics:${CACHE_KEY_VERSION}:${roundedCoord(lat)}:${roundedCoord(lng)}`;

const stableHash = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  const firstForwarded = String(forwarded || '')
    .split(',')[0]
    .trim();
  if (firstForwarded) return firstForwarded;
  return (
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  );
};

const rateLimitKeyForRequest = (req, bucket) => {
  const ip = String(getClientIp(req)).trim().toLowerCase() || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 160);
  const uaHash = stableHash(userAgent || 'none');
  return `queueMetricsRateLimit:${RATE_LIMIT_KEY_VERSION}:${ip}:${uaHash}:${bucket}`;
};

const checkRateLimit = async (req) => {
  const windowSeconds = RATE_LIMIT_WINDOW_SECONDS;
  const maxRequests = RATE_LIMIT_MAX_REQUESTS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSeconds);
  const key = rateLimitKeyForRequest(req, bucket);

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSeconds);
    }
    if (count > maxRequests) {
      const retryAfterSeconds = Math.max(1, (bucket + 1) * windowSeconds - nowSeconds);
      return { limited: true, retryAfterSeconds };
    }
    return { limited: false, retryAfterSeconds: 0 };
  } catch (error) {
    console.warn('location-queue-metrics rate limit check error:', error.message);
    return { limited: false, retryAfterSeconds: 0 };
  }
};

const parseSupabasePayload = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse Supabase response JSON: ${error.message}`);
  }
};

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rpcName = process.env.SUPABASE_QUEUE_METRICS_RPC || 'get_location_queue_metrics';
  const latParam = process.env.SUPABASE_QUEUE_METRICS_LAT_PARAM || 'lat';
  const lngParam = process.env.SUPABASE_QUEUE_METRICS_LNG_PARAM || 'lng';

  return {
    supabaseUrl,
    supabaseKey,
    rpcName,
    latParam,
    lngParam,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const callSupabaseQueueRpc = async (lat, lng) => {
  const { supabaseUrl, supabaseKey, rpcName, latParam, lngParam } = getSupabaseConfig();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const rpcUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${rpcName}`;
    const payload = {
      [latParam]: lat,
      [lngParam]: lng
    };

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await parseSupabasePayload(response);
    if (!response.ok) {
      const errorMessage = typeof data === 'object' && data?.message ? data.message : `Supabase RPC failed (${response.status})`;
      throw new Error(errorMessage);
    }

    if (!data) return null;
    if (Array.isArray(data)) return data[0] ?? null;
    if (typeof data === 'object') return data;
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = toFiniteNumber(req.query.lat);
  const lng = toFiniteNumber(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: 'lat and lng query params are required numbers' });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of bounds' });
  }

  const rateLimit = await checkRateLimit(req);
  if (rateLimit.limited) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterSeconds: rateLimit.retryAfterSeconds
    });
  }

  const cacheKey = cacheKeyFor(lat, lng);
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', SUCCESS_CACHE_CONTROL);
      return res.status(200).json({ ...cached, cacheHit: true });
    }
  } catch (error) {
    console.warn('location-queue-metrics cache read error:', error.message);
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig.hasCredentials) {
    return res.status(500).json({
      schemaVersion: SCHEMA_VERSION,
      source: 'supabase',
      error: 'Supabase credentials are not configured',
      isFallback: true
    });
  }

  try {
    const row = await callSupabaseQueueRpc(lat, lng);
    if (!row) {
      return res.status(404).json({
        schemaVersion: SCHEMA_VERSION,
        source: 'supabase',
        error: 'No county metrics found for this point',
        isFallback: true
      });
    }

    const normalized = normalizeRow(row);
    try {
      await kv.setex(cacheKey, CACHE_TTL_SECONDS, normalized);
    } catch (error) {
      console.warn('location-queue-metrics cache write error:', error.message);
    }

    res.setHeader('Cache-Control', SUCCESS_CACHE_CONTROL);
    return res.status(200).json({ ...normalized, cacheHit: false });
  } catch (error) {
    console.error('location-queue-metrics error:', error);
    return res.status(502).json({
      schemaVersion: SCHEMA_VERSION,
      source: 'supabase',
      error: 'Failed to fetch queue metrics',
      message: error.message,
      isFallback: true
    });
  }
}
