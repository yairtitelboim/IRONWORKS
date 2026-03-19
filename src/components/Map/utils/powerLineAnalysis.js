/**
 * Power Line Analysis Utilities
 * Works with HIFLD and OSM-style features. Adapts HIFLD voltage_category to voltage_kv.
 */

import * as turf from '@turf/turf';

const parseVoltageFromHIFLD = (props) => {
  if (!props) return 0;
  const cat = (props.voltage_category || '').toString();
  const match = cat.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  const rank = props.voltage_rank;
  if (rank >= 1 && rank <= 6) {
    const map = { 1: 500, 2: 345, 3: 230, 4: 138, 5: 69, 6: 34 };
    return map[rank] || 0;
  }
  return 0;
};

export const getVoltageKv = (feature) => {
  if (!feature?.properties) return 0;
  const p = feature.properties;
  if (p.voltage_kv) return Number(p.voltage_kv) || 0;
  if (p.voltage) return Math.round(Number(p.voltage) / 1000) || 0;
  return parseVoltageFromHIFLD(p);
};

export const categorizeVoltage = (voltageKv) => {
  if (voltageKv >= 500) return '500+ kV';
  if (voltageKv >= 345) return '345-499 kV';
  if (voltageKv >= 230) return '230-344 kV';
  if (voltageKv >= 138) return '138-229 kV';
  if (voltageKv >= 69) return '69-137 kV';
  if (voltageKv > 0) return '< 69 kV';
  return 'Unknown';
};

const estimateCapacity = (voltageKv, lineLengthMiles = 1) => {
  if (!voltageKv || voltageKv <= 0) return 0;
  const perMile = voltageKv >= 500 ? 2500 : voltageKv >= 345 ? 1200 : voltageKv >= 230 ? 600 : voltageKv >= 138 ? 300 : voltageKv >= 69 ? 100 : 30;
  return perMile * lineLengthMiles;
};

const calculateLineLength = (feature) => {
  if (!feature?.geometry?.coordinates?.length) return 0;
  const coords = feature.geometry.coordinates;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += turf.distance(turf.point(coords[i - 1]), turf.point(coords[i]), { units: 'miles' });
  }
  return total;
};

const calculateDistanceToLine = (center, feature) => {
  if (!feature?.geometry?.coordinates?.length || !center?.length) return Infinity;
  let minD = Infinity;
  for (const c of feature.geometry.coordinates) {
    const d = turf.distance(turf.point(center), turf.point(c), { units: 'miles' });
    if (d < minD) minD = d;
  }
  return minD;
};

const toPowerFeature = (f) => {
  if (!f?.geometry?.coordinates) return null;
  const p = f.properties || {};
  const voltageKv = getVoltageKv(f);
  return {
    ...f,
    properties: {
      ...p,
      infra_type: 'power',
      voltage_kv: voltageKv
    }
  };
};

export const analyzeCapacity = (features) => {
  const powerLines = (features || []).map(toPowerFeature).filter(Boolean);
  if (!powerLines.length) return { voltageDistribution: [] };
  const byCat = {};
  powerLines.forEach((f) => {
    const v = getVoltageKv(f);
    const cat = categorizeVoltage(v);
    const len = calculateLineLength(f);
    const cap = estimateCapacity(v, len);
    if (!byCat[cat]) byCat[cat] = { count: 0, capacity: 0 };
    byCat[cat].count += 1;
    byCat[cat].capacity += cap;
  });
  const order = { '500+ kV': 6, '345-499 kV': 5, '230-344 kV': 4, '138-229 kV': 3, '69-137 kV': 2, '< 69 kV': 1, 'Unknown': 0 };
  const voltageDistribution = Object.entries(byCat)
    .map(([category, d]) => ({ category, count: d.capacity, capacity: d.capacity, lineCount: d.count }))
    .sort((a, b) => (order[b.category] || 0) - (order[a.category] || 0));
  return { voltageDistribution };
};

export const analyzeDistanceWeightedCapacity = (features, center) => {
  if (!features?.length || !center?.length) return { voltageDistribution: [] };
  const powerLines = features.map(toPowerFeature).filter(Boolean);
  if (!powerLines.length) return { voltageDistribution: [] };
  const byCat = {};
  powerLines.forEach((f) => {
    const v = getVoltageKv(f);
    const cat = categorizeVoltage(v);
    const len = calculateLineLength(f);
    const base = estimateCapacity(v, len);
    const dist = calculateDistanceToLine(center, f);
    const weight = 1 / (1 + dist);
    const cap = base * weight;
    if (!byCat[cat]) byCat[cat] = { count: 0, capacity: 0 };
    byCat[cat].count += 1;
    byCat[cat].capacity += cap;
  });
  const order = { '500+ kV': 6, '345-499 kV': 5, '230-344 kV': 4, '138-229 kV': 3, '69-137 kV': 2, '< 69 kV': 1, 'Unknown': 0 };
  const voltageDistribution = Object.entries(byCat)
    .map(([category, d]) => ({ category, count: d.capacity, capacity: d.capacity, lineCount: d.count }))
    .sort((a, b) => (order[b.category] || 0) - (order[a.category] || 0));
  return { voltageDistribution };
};

export const analyzeRedundancy = (features) => {
  const powerLines = (features || []).map(toPowerFeature).filter(Boolean);
  if (!powerLines.length) return { voltageDistribution: [] };
  const byCat = {};
  powerLines.forEach((f) => {
    const cat = categorizeVoltage(getVoltageKv(f));
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(f);
  });
  const order = { '500+ kV': 6, '345-499 kV': 5, '230-344 kV': 4, '138-229 kV': 3, '69-137 kV': 2, '< 69 kV': 1, 'Unknown': 0 };
  const voltageDistribution = Object.entries(byCat)
    .map(([category, lines]) => ({
      category,
      count: lines.length > 1 ? Math.min(100, ((lines.length - 1) / lines.length) * 100) : 0,
      redundancyScore: lines.length > 1 ? Math.min(100, ((lines.length - 1) / lines.length) * 100) : 0,
      lineCount: lines.length
    }))
    .sort((a, b) => (order[b.category] || 0) - (order[a.category] || 0));
  return { voltageDistribution };
};

export const analyzePowerLines = (features, center = null) => {
  if (!features?.length) {
    return { totalLines: 0, totalLength: 0, voltageDistribution: [], maxVoltage: 0, categories: [], capacity: { voltageDistribution: [] }, distanceWeightedCapacity: { voltageDistribution: [] }, connectionAccessibility: { voltageDistribution: [] }, connectionAvailability: { voltageDistribution: [] }, redundancy: { voltageDistribution: [] }, powerAndGas: { voltageDistribution: [] } };
  }
  const powerLines = features.map(toPowerFeature).filter(Boolean);
  if (!powerLines.length) {
    return { totalLines: 0, totalLength: 0, voltageDistribution: [], maxVoltage: 0, categories: [], capacity: { voltageDistribution: [] }, distanceWeightedCapacity: { voltageDistribution: [] }, connectionAccessibility: { voltageDistribution: [] }, connectionAvailability: { voltageDistribution: [] }, redundancy: { voltageDistribution: [] }, powerAndGas: { voltageDistribution: [] } };
  }
  let totalLength = 0;
  let maxVoltage = 0;
  const voltageCategories = {};
  powerLines.forEach((f) => {
    const v = getVoltageKv(f);
    const cat = categorizeVoltage(v);
    voltageCategories[cat] = (voltageCategories[cat] || 0) + 1;
    if (v > maxVoltage) maxVoltage = v;
    totalLength += calculateLineLength(f);
  });
  const order = { '500+ kV': 6, '345-499 kV': 5, '230-344 kV': 4, '138-229 kV': 3, '69-137 kV': 2, '< 69 kV': 1, 'Unknown': 0 };
  const voltageDistribution = Object.entries(voltageCategories)
    .map(([category, count]) => ({ category, count, percentage: (count / powerLines.length) * 100 }))
    .sort((a, b) => (order[b.category] || 0) - (order[a.category] || 0));
  const capacity = analyzeCapacity(features);
  const distanceWeightedCapacity = analyzeDistanceWeightedCapacity(features, center);
  const redundancy = analyzeRedundancy(features);
  const powerAndGas = { voltageDistribution: capacity.voltageDistribution };
  return {
    totalLines: powerLines.length,
    totalLength: Math.round(totalLength * 10) / 10,
    voltageDistribution,
    maxVoltage,
    categories: Object.keys(voltageCategories),
    capacity,
    distanceWeightedCapacity,
    connectionAccessibility: { voltageDistribution: [] },
    connectionAvailability: { voltageDistribution: [] },
    redundancy,
    powerAndGas
  };
};
