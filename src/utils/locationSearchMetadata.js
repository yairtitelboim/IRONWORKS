const toFiniteNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const collectLngLatPairs = (coords, out = []) => {
  if (!Array.isArray(coords)) return out;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    out.push([coords[0], coords[1]]);
    return out;
  }
  for (let i = 0; i < coords.length; i += 1) {
    collectLngLatPairs(coords[i], out);
  }
  return out;
};

const getGeometryCenter = (geometry, fallbackCoordinates = null) => {
  const pairs = collectLngLatPairs(geometry?.coordinates, []);
  if (!pairs.length) return fallbackCoordinates;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  pairs.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  if (![minLng, maxLng, minLat, maxLat].every(Number.isFinite)) {
    return fallbackCoordinates;
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
};

export const formatLocationSearchResponseContent = (coordinates, fallbackLabel = 'Texas Location') => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return fallbackLabel;
  const [lng, lat] = coordinates;
  const latNum = toFiniteNumber(lat);
  const lngNum = toFiniteNumber(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return fallbackLabel;
  return `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;
};

export const buildLocationSearchMetadataFromCountySelection = ({
  properties = {},
  geometry = null,
  fallbackCoordinates = null,
  source = 'ercot-counties',
  query = 'ERCOT county detail',
  txPrecomputedType = 'tx_county_detail',
  timestamp = Date.now()
} = {}) => {
  const countyName = properties.NAME || properties.name || 'Unknown County';
  const coordinates = getGeometryCenter(geometry, fallbackCoordinates);

  return {
    responseType: 'location_search',
    txPrecomputedType,
    source,
    query,
    displayName: `${countyName} County, TX`,
    coordinates: Array.isArray(coordinates) ? coordinates : [],
    timestamp,
    queueMetricsSchemaVersion: '1.0.0',
    queueMetricsSource: 'local_county_aggregate',
    queueMetricsStatus: 'fallback',
    queueMetrics: {
      activeQueueCount: toFiniteNumber(properties.project_count, 0),
      totalQueueCount: toFiniteNumber(properties.project_count, 0),
      activeQueueMw: toFiniteNumber(properties.total_capacity_mw, 0),
      avgCapacityMw: toFiniteNumber(properties.avg_capacity_mw, 0),
      countyName,
      countyType: 'consumer',
      netMw: toFiniteNumber(properties.total_capacity_mw, 0),
      baseloadPct: toFiniteNumber(properties.baseload_pct, 0),
      renewablePct: toFiniteNumber(properties.renewable_pct, 0),
      storagePct: toFiniteNumber(properties.storage_pct, 0),
      dataCenterCount: toFiniteNumber(properties.dc_count, 0),
      dominantFuelType: properties.dominant_fuel_type || null,
      source: 'local_precomputed',
      isFallback: true,
      queriedAt: timestamp
    }
  };
};

export const buildLocationSearchMetadataFromPrecomputedCluster = ({
  insightMetadata = {},
  query = 'Largest Texas data center cluster'
} = {}) => {
  const countyMetrics = insightMetadata?.countyMetrics || {};
  const coordinates = Array.isArray(insightMetadata?.coordinates)
    ? insightMetadata.coordinates
    : [];

  return {
    responseType: 'location_search',
    txPrecomputedType: 'tx_precomputed_cluster',
    source: 'precomputed_cluster',
    query,
    displayName: `${insightMetadata?.countyName || 'Texas'} Cluster Focus`,
    coordinates,
    timestamp: Date.now(),
    queueMetricsSchemaVersion: '1.0.0',
    queueMetricsSource: 'local_county_aggregate',
    queueMetricsStatus: 'fallback',
    queueMetrics: {
      activeQueueCount: toFiniteNumber(countyMetrics.project_count, 0),
      totalQueueCount: toFiniteNumber(countyMetrics.project_count, 0),
      activeQueueMw: toFiniteNumber(countyMetrics.total_capacity_mw, 0),
      avgCapacityMw: toFiniteNumber(countyMetrics.avg_capacity_mw, 0),
      countyName: insightMetadata?.countyName || null,
      countyType: 'consumer',
      netMw: toFiniteNumber(countyMetrics.total_capacity_mw, 0),
      baseloadPct: toFiniteNumber(countyMetrics.baseload_pct, 0),
      renewablePct: toFiniteNumber(countyMetrics.renewable_pct, 0),
      storagePct: toFiniteNumber(countyMetrics.storage_pct, 0),
      dataCenterCount: toFiniteNumber(countyMetrics.dc_count, 0),
      source: 'local_precomputed',
      isFallback: true,
      queriedAt: Date.now()
    }
  };
};
