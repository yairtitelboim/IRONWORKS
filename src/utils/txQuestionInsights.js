import * as turf from '@turf/turf';
import {
  TEXAS_DATA_CENTERS_GEOJSON_BASE_URL,
  fetchTexasDataCentersGeoJson
} from './texasDataCentersDataset';

const DATA_CENTER_URL = TEXAS_DATA_CENTERS_GEOJSON_BASE_URL;
const ERCOT_COUNTIES_URL = '/data/ercot/ercot_counties_with_dc.geojson';

let datasetsPromise = null;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatInt = (value) => Math.round(toNumber(value, 0)).toLocaleString();

const getCountyCentroid = (feature) => {
  try {
    const center = turf.center(feature);
    const coords = center?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) return coords;
  } catch (_) {}
  return null;
};

const distanceMiles = (a, b) => {
  try {
    return turf.distance(turf.point(a), turf.point(b), { units: 'miles' });
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
};

const loadDatasets = async () => {
  if (!datasetsPromise) {
    datasetsPromise = Promise.all([
      fetchTexasDataCentersGeoJson(),
      fetch(ERCOT_COUNTIES_URL, { cache: 'no-cache' })
    ]).then(async ([dcRes, countyRes]) => {
      if (!dcRes.ok) throw new Error(`Failed to load ${DATA_CENTER_URL} (${dcRes.status})`);
      if (!countyRes.ok) throw new Error(`Failed to load ${ERCOT_COUNTIES_URL} (${countyRes.status})`);
      const [dataCenters, counties] = await Promise.all([dcRes.json(), countyRes.json()]);
      return {
        dataCenters: dataCenters?.features || [],
        counties: counties?.features || []
      };
    });
  }
  return datasetsPromise;
};

const getRepresentativeProject = (countyFeature, dataCenters) => {
  const countyCenter = getCountyCentroid(countyFeature);
  if (!countyCenter) return null;

  let best = null;
  for (const f of dataCenters) {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const dist = distanceMiles(coords, countyCenter);
    if (!best || dist < best.distanceMi) {
      best = { feature: f, distanceMi: dist };
    }
  }
  return best;
};

const rankCountiesByClusterSignal = (counties) => {
  return [...counties]
    .filter((f) => toNumber(f?.properties?.dc_count, 0) > 0)
    .sort((a, b) => {
      const ap = a.properties || {};
      const bp = b.properties || {};
      const adc = toNumber(ap.dc_count, 0);
      const bdc = toNumber(bp.dc_count, 0);
      if (bdc !== adc) return bdc - adc;
      const apc = toNumber(ap.project_count, 0);
      const bpc = toNumber(bp.project_count, 0);
      return bpc - apc;
    });
};

const getOppositionPressure = (props) => {
  const dcCount = toNumber(props.dc_count, 0);
  const projectCount = toNumber(props.project_count, 0);
  const renewablePct = toNumber(props.renewable_pct, 0);
  const avgCapacity = toNumber(props.avg_capacity_mw, 0);

  // Higher score = more likely to see local opposition pressure emerge.
  const demandPressure = dcCount * 1.8 + projectCount * 0.25;
  const generationConstraint = Math.max(0, 60 - renewablePct) * 0.06;
  const capacityStress = avgCapacity > 0 ? Math.max(0, 300 - avgCapacity) * 0.003 : 0.7;
  return demandPressure + generationConstraint + capacityStress;
};

const rankCountiesByOppositionSignal = (counties) => {
  return [...counties]
    .filter((f) => toNumber(f?.properties?.dc_count, 0) > 0)
    .map((f) => ({
      feature: f,
      pressure: getOppositionPressure(f.properties || {})
    }))
    .sort((a, b) => b.pressure - a.pressure);
};

const getExpansionScore = (props) => {
  const totalMw = toNumber(props.total_capacity_mw, 0);
  const renewablePct = toNumber(props.renewable_pct, 0);
  const baseloadPct = toNumber(props.baseload_pct, 0);
  const projectCount = toNumber(props.project_count, 0);
  const oppositionPressure = getOppositionPressure(props);

  const supplyScore = Math.min(1, totalMw / 5000) * 45;
  const cleanMixScore = Math.min(1, renewablePct / 100) * 20;
  const baseloadScore = Math.min(1, baseloadPct / 100) * 10;
  const competitionPenalty = Math.min(1, projectCount / 40) * 10;
  const oppositionPenalty = Math.min(1, oppositionPressure / 40) * 15;

  return supplyScore + cleanMixScore + baseloadScore - competitionPenalty - oppositionPenalty;
};

const rankCountiesByExpansionScore = (counties) => {
  return [...counties]
    .filter((f) => toNumber(f?.properties?.dc_count, 0) > 0)
    .map((f) => ({
      feature: f,
      score: getExpansionScore(f.properties || {})
    }))
    .sort((a, b) => b.score - a.score);
};

const buildClusterAnswer = ({ counties, dataCenters }) => {
  const ranked = rankCountiesByClusterSignal(counties);
  if (!ranked.length) throw new Error('No cluster data available');

  const topCounty = ranked[0];
  const topProps = topCounty.properties || {};
  const rep = getRepresentativeProject(topCounty, dataCenters);
  const repProps = rep?.feature?.properties || {};
  const repCoords = rep?.feature?.geometry?.coordinates || getCountyCentroid(topCounty);

  const top3 = ranked.slice(0, 3).map((f) => ({
    name: f.properties?.NAME || 'Unknown County',
    dcCount: toNumber(f.properties?.dc_count, 0),
    projectCount: toNumber(f.properties?.project_count, 0)
  }));

  const content = [
    '## Largest Data Center Cluster in Texas',
    `Primary cluster signal is **${topProps.NAME || 'Unknown County'} County** with **${formatInt(topProps.dc_count)} data centers** and **${formatInt(topProps.project_count)} power projects** in ERCOT county aggregates.`,
    '',
    `Representative project focus: **${repProps.project_name || 'Nearest active project'}** (${repProps.company || 'Unknown operator'}).`,
    '',
    '### Top Cluster Counties',
    ...top3.map((item, idx) => `${idx + 1}. ${item.name}: ${formatInt(item.dcCount)} DCs · ${formatInt(item.projectCount)} power projects`)
  ].join('\n');

  return {
    content,
    citations: [
      { title: 'Texas Data Centers', url: DATA_CENTER_URL, snippet: 'Local project-level marker dataset.' },
      { title: 'ERCOT Counties with Data Centers', url: ERCOT_COUNTIES_URL, snippet: 'County-level power + data center aggregates.' }
    ],
    metadata: {
      responseType: 'tx_precomputed_cluster',
      source: 'local_precomputed',
      countyName: topProps.NAME || null,
      coordinates: repCoords,
      projectId: repProps.project_id || null,
      projectName: repProps.project_name || null,
      countyMetrics: {
        project_count: toNumber(topProps.project_count, 0),
        total_capacity_mw: toNumber(topProps.total_capacity_mw, 0),
        avg_capacity_mw: toNumber(topProps.avg_capacity_mw, 0),
        renewable_pct: toNumber(topProps.renewable_pct, 0),
        baseload_pct: toNumber(topProps.baseload_pct, 0),
        storage_pct: toNumber(topProps.storage_pct, 0),
        dc_count: toNumber(topProps.dc_count, 0)
      },
      timestamp: Date.now()
    },
    mapAction: {
      ensureLayers: { showTexasDataCenters: true },
      focusProjectId: repProps.project_id || null,
      coordinates: repCoords
    }
  };
};

const buildOppositionAnswer = ({ counties }) => {
  const ranked = rankCountiesByOppositionSignal(counties);
  if (!ranked.length) throw new Error('No opposition data available');

  const top = ranked[0];
  const county = top.feature;
  const props = county.properties || {};
  const center = getCountyCentroid(county);

  const top3 = ranked.slice(0, 3).map((row) => ({
    name: row.feature.properties?.NAME || 'Unknown County',
    pressure: row.pressure
  }));

  const content = [
    '## Area With the Most Opposition Forming',
    `Current highest opposition-pressure signal is **${props.NAME || 'Unknown County'} County** (score **${top.pressure.toFixed(1)}**).`,
    '',
    `Drivers: ${formatInt(props.dc_count)} data centers, ${formatInt(props.project_count)} queued/active county projects, and renewable mix at ${toNumber(props.renewable_pct, 0).toFixed(1)}%.`,
    '',
    '### Highest Pressure Counties',
    ...top3.map((item, idx) => `${idx + 1}. ${item.name} (score ${item.pressure.toFixed(1)})`)
  ].join('\n');

  return {
    content,
    citations: [
      { title: 'ERCOT Counties with Data Centers', url: ERCOT_COUNTIES_URL, snippet: 'County-level demand/supply pressure inputs.' }
    ],
    metadata: {
      responseType: 'tx_precomputed_opposition',
      source: 'local_precomputed',
      countyName: props.NAME || null,
      geometry: county.geometry || null,
      coordinates: center,
      oppositionScore: Number(top.pressure.toFixed(2)),
      timestamp: Date.now()
    },
    mapAction: {
      ensureLayers: { showERCOTCounties: true, showTexasDataCenters: true },
      coordinates: center
    }
  };
};

const buildCorridorAnswer = ({ counties }) => {
  const ranked = rankCountiesByExpansionScore(counties);
  if (!ranked.length) throw new Error('No expansion corridor data available');

  const primary = ranked[0];
  const primaryCenter = getCountyCentroid(primary.feature);

  // Pick next best county within ~180mi to form an actionable corridor pair.
  const secondary = ranked
    .slice(1)
    .find((candidate) => {
      const candidateCenter = getCountyCentroid(candidate.feature);
      if (!primaryCenter || !candidateCenter) return false;
      return distanceMiles(primaryCenter, candidateCenter) <= 180;
    }) || ranked[1];

  const secondaryCenter = secondary ? getCountyCentroid(secondary.feature) : null;
  const midpoint = (primaryCenter && secondaryCenter)
    ? [(primaryCenter[0] + secondaryCenter[0]) / 2, (primaryCenter[1] + secondaryCenter[1]) / 2]
    : primaryCenter;

  const content = [
    '## Best Low-Risk Expansion Corridor in Texas',
    `Recommended corridor anchor: **${primary.feature.properties?.NAME || 'Unknown County'} County** (expansion score **${primary.score.toFixed(1)}**).`,
    secondary
      ? `Secondary corridor county: **${secondary.feature.properties?.NAME || 'Unknown County'} County** (score **${secondary.score.toFixed(1)}**).`
      : '',
    '',
    'This recommendation balances available generation capacity, cleaner supply mix, lower competition pressure, and lower modeled opposition friction.',
    '',
    '### Top Expansion Candidates',
    ...ranked.slice(0, 3).map((row, idx) => `${idx + 1}. ${row.feature.properties?.NAME || 'Unknown County'} (score ${row.score.toFixed(1)})`)
  ].filter(Boolean).join('\n');

  return {
    content,
    citations: [
      { title: 'ERCOT Counties with Data Centers', url: ERCOT_COUNTIES_URL, snippet: 'County-level expansion scoring inputs.' }
    ],
    metadata: {
      responseType: 'tx_precomputed_corridor',
      source: 'local_precomputed',
      primaryCounty: primary.feature.properties?.NAME || null,
      secondaryCounty: secondary?.feature?.properties?.NAME || null,
      coordinates: midpoint,
      timestamp: Date.now()
    },
    mapAction: {
      ensureLayers: {
        showProducerConsumerCounties: true,
        showSpatialMismatchCounties: true,
        showHIFLDTransmission: true
      },
      coordinates: midpoint
    }
  };
};

export const getTexasPrecomputedInsight = async (questionId) => {
  const datasets = await loadDatasets();

  if (questionId === 'largest_tx_data_center_cluster') {
    return buildClusterAnswer(datasets);
  }
  if (questionId === 'tx_opposition_hotspot') {
    return buildOppositionAnswer(datasets);
  }
  if (questionId === 'best_tx_low_risk_corridor') {
    return buildCorridorAnswer(datasets);
  }
  return null;
};
