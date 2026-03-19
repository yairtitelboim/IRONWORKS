/*
  Geocoding utility with caching and provider fallbacks.
  - Primary provider: OSM Nominatim (browser-safe usage)
  - Cache: in-memory + localStorage with TTL
  - Public API:
      resolveCoordinatesForSites(siteList, options?) => Promise<ResolvedSite[]>
      getCachedCoordinate(cacheKey) => CachedEntry | null
      setCachedCoordinate(cacheKey, value) => void
      clearGeocodeCache() => void
      debugGeocodeCache() => object

  Site shape expected (minimum):
    {
      id: string,              // stable id
      name: string,            // site name e.g., "Lucid Motors EV Manufacturing Campus"
      city?: string,           // Casa Grande
      state?: string,          // AZ
      address?: string,        // optional full address
      country?: string,        // default "USA"
      queryHints?: string[],   // extra keywords to aid geocoding
    }

  ResolvedSite shape:
    {
      ...site,
      lat: number,
      lng: number,
      confidence: number,              // 0-1
      provider: string,                // e.g., "nominatim"
      providerPlaceId?: string,
      sourceChain: string[],           // ordered providers tried
      lastVerified: string,            // ISO timestamp
      provenanceURLs?: string[],
    }
*/

const DEFAULT_CACHE_KEY = 'pinalSiteGeocodeCache';
const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

const inMemoryCache = new Map();

function nowIso() {
  return new Date().toISOString();
}

function buildCacheKey(site) {
  const parts = [
    site.name?.trim().toLowerCase() || '',
    site.address?.trim().toLowerCase() || '',
    site.city?.trim().toLowerCase() || '',
    site.state?.trim().toLowerCase() || '',
    site.country?.trim().toLowerCase() || 'usa',
  ].filter(Boolean);
  return parts.join(' | ');
}

function readLocalCache() {
  try {
    const raw = localStorage.getItem(DEFAULT_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn('geocodeSites: failed to read local cache', e);
    return {};
  }
}

function writeLocalCache(obj) {
  try {
    localStorage.setItem(DEFAULT_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('geocodeSites: failed to write local cache', e);
  }
}

export function getCachedCoordinate(cacheKey) {
  const mem = inMemoryCache.get(cacheKey);
  if (mem) return mem;

  const persisted = readLocalCache();
  const entry = persisted[cacheKey];
  if (!entry) return null;

  // TTL check
  try {
    if (Date.now() - (entry.cachedAt || 0) > (entry.ttlMs || DEFAULT_CACHE_TTL_MS)) {
      // expired
      return null;
    }
  } catch (e) {
    // ignore
  }
  inMemoryCache.set(cacheKey, entry);
  return entry;
}

export function setCachedCoordinate(cacheKey, value) {
  const entry = {
    ...value,
    cachedAt: Date.now(),
    ttlMs: DEFAULT_CACHE_TTL_MS,
  };
  inMemoryCache.set(cacheKey, entry);
  const persisted = readLocalCache();
  persisted[cacheKey] = entry;
  writeLocalCache(persisted);
}

export function clearGeocodeCache() {
  inMemoryCache.clear();
  try {
    localStorage.removeItem(DEFAULT_CACHE_KEY);
  } catch (e) {
    // ignore
  }
}

export function debugGeocodeCache() {
  const persisted = readLocalCache();
  return {
    memorySize: inMemoryCache.size,
    persistedKeys: Object.keys(persisted).length,
    sample: Object.entries(persisted).slice(0, 5),
  };
}

function buildQuery(site) {
  // Prefer address if provided, otherwise build from parts
  if (site.address) {
    return site.address;
  }
  const segments = [site.name, site.city, site.state || 'AZ', 'Pinal County', site.country || 'USA']
    .filter(Boolean)
    .join(', ');
  if (site.queryHints && site.queryHints.length > 0) {
    return `${segments} ${site.queryHints.join(' ')}`;
  }
  return segments;
}

async function geocodeWithNominatim(query, { viewbox, bounded = false } = {}) {
  // Respect Nominatim usage policy: include email param; avoid heavy parallelism.
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'us');
  // Include a contact email per Nominatim policy
  url.searchParams.set('email', 'geocoding@pinal.local');
  if (viewbox && Array.isArray(viewbox) && viewbox.length === 4) {
    // viewbox = [minLon, minLat, maxLon, maxLat]
    url.searchParams.set('viewbox', viewbox.join(','));
    if (bounded) url.searchParams.set('bounded', '1');
  }

  const resp = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) {
    throw new Error(`Nominatim error: ${resp.status}`);
  }
  const json = await resp.json();
  if (!Array.isArray(json) || json.length === 0) {
    return null;
  }
  const top = json[0];
  const lat = parseFloat(top.lat);
  const lng = parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  // Basic confidence heuristic
  let confidence = 0.7;
  if (top.importance && typeof top.importance === 'number') {
    confidence = Math.min(0.95, 0.5 + top.importance / 2);
  }
  return {
    lat,
    lng,
    confidence,
    provider: 'nominatim',
    providerPlaceId: top.place_id?.toString?.(),
    displayName: top.display_name,
    provenanceURLs: top.osm_id ? [`https://www.openstreetmap.org/${top.osm_type || 'node'}/${top.osm_id}`] : [],
  };
}

async function geocodeSite(site, { forceRefresh = false } = {}) {
  const cacheKey = buildCacheKey(site);
  if (!forceRefresh) {
    const cached = getCachedCoordinate(cacheKey);
    if (cached?.lat && cached?.lng) {
      return {
        ...site,
        lat: cached.lat,
        lng: cached.lng,
        confidence: cached.confidence ?? 0.8,
        provider: cached.provider ?? 'cache',
        providerPlaceId: cached.providerPlaceId,
        sourceChain: cached.sourceChain || ['cache'],
        lastVerified: cached.lastVerified || nowIso(),
        provenanceURLs: cached.provenanceURLs || [],
        cached: true,
      };
    }
  }

  const query = buildQuery(site);
  // Reduced logging - only log if in debug mode
  if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
    console.log('[geocodeSites] Querying', { id: site.id, name: site.name, query });
  }
  const sourceChain = [];

  // Provider 1: Nominatim
  try {
    sourceChain.push('nominatim');
    // Pinal County bounding box (approx): minLon, minLat, maxLon, maxLat
    const PINAL_VIEWBOX = [-112.5, 32.5, -110.5, 33.5];
    // Try a sequence of queries with increasing relaxation
    const queries = [
      query,
      // Address only, if present
      site.address ? site.address : null,
      // Name + city + AZ
      [site.name, site.city, site.state || 'AZ'].filter(Boolean).join(', '),
      // Name + AZ
      [site.name, site.state || 'AZ'].filter(Boolean).join(', '),
      // Company/facility name only
      site.name,
    ].filter(Boolean);

    let res = null;
    for (let i = 0; i < queries.length; i += 1) {
      const q = queries[i];
      // Reduced logging - only log if in debug mode
      if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
        console.log('[geocodeSites] Trying query variant', { id: site.id, q });
      }
      // First pass: bounded within Pinal
      res = await geocodeWithNominatim(q, { viewbox: PINAL_VIEWBOX, bounded: true });
      if (!res) {
        // Second pass: same query, unbounded but still with US bias
        res = await geocodeWithNominatim(q);
      }
      if (res) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (res) {
      // Only log successful resolutions if in debug mode
      if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
        console.log('[geocodeSites] Nominatim resolved', { id: site.id, name: site.name, lat: res.lat, lng: res.lng, confidence: res.confidence });
      }
      const resolved = {
        ...site,
        lat: res.lat,
        lng: res.lng,
        confidence: res.confidence,
        provider: res.provider,
        providerPlaceId: res.providerPlaceId,
        sourceChain,
        lastVerified: nowIso(),
        provenanceURLs: res.provenanceURLs,
      };
      setCachedCoordinate(cacheKey, resolved);
      return resolved;
    }
    // Only log failures if in debug mode
    if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
      console.log('[geocodeSites] Nominatim returned no results', { id: site.id, name: site.name });
    }
  } catch (e) {
    // Only log errors if in debug mode
    if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
      console.warn(`geocodeSites: Nominatim failed for ${site.name}`, e);
    }
  }

  // TODO: Add Mapbox / Google / OpenCage fallbacks here when keys available

  // If all providers failed, return null-like result for review
  const unresolved = {
    ...site,
    lat: null,
    lng: null,
    confidence: 0,
    provider: 'unresolved',
    sourceChain,
    lastVerified: nowIso(),
    provenanceURLs: [],
  };
  // Only log unresolved sites if in debug mode
  if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
    console.warn('[geocodeSites] Unresolved site', { id: site.id, name: site.name });
  }
  return unresolved;
}

export async function resolveCoordinatesForSites(siteList, { forceRefresh = false, parallelLimit = 1 } = {}) {
  if (!Array.isArray(siteList) || siteList.length === 0) return [];

  // Check for cached complete results first
  const CACHE_KEY_COMPLETE = 'pinal_sites_complete_resolution';
  if (!forceRefresh) {
    const cachedComplete = getCachedCoordinate(CACHE_KEY_COMPLETE);
    if (cachedComplete && Array.isArray(cachedComplete.results)) {
      console.log('🚀 Using cached complete site resolution (fast path)');
      return cachedComplete.results;
    }
  }

  // Simple concurrency control
  const results = [];
  let index = 0;

  async function worker() {
    while (index < siteList.length) {
      const current = siteList[index++];
      const resolved = await geocodeSite(current, { forceRefresh });
      results.push(resolved);
      // Be gentle to providers
      await new Promise(r => setTimeout(r, 250));
    }
  }

  const workers = Array.from({ length: Math.min(parallelLimit, siteList.length) }, () => worker());
  await Promise.all(workers);
  
  // Cache the complete results for next time
  setCachedCoordinate(CACHE_KEY_COMPLETE, {
    results: results,
    timestamp: Date.now(),
    siteCount: results.length
  });
  
  if (typeof window !== 'undefined' && window.DEBUG_GEOCODE) {
    console.log('💾 Cached complete site resolution for fast loading next time');
  }
  return results;
}

// Optional: seed known coordinates to bypass geocoding
export function seedKnownCoordinates(site, lat, lng, meta = {}) {
  const cacheKey = buildCacheKey(site);
  setCachedCoordinate(cacheKey, {
    ...site,
    lat,
    lng,
    confidence: Math.max(0.9, meta.confidence || 0.9),
    provider: 'manual',
    providerPlaceId: meta.providerPlaceId,
    sourceChain: ['manual'],
    lastVerified: nowIso(),
    provenanceURLs: meta.provenanceURLs || [],
  });
}

export default {
  resolveCoordinatesForSites,
  getCachedCoordinate,
  setCachedCoordinate,
  clearGeocodeCache,
  debugGeocodeCache,
  seedKnownCoordinates,
};


