#!/usr/bin/env node
/**
 * Fetches real US county boundaries (Plotly/Census) and writes a GeoJSON
 * with the 30 counties closest to Memphis (by centroid distance).
 * Run: node scripts/generate_memphis_counties_geojson.js
 * Output: public/data/memphis/memphis_counties.geojson
 */

const fs = require('fs');
const path = require('path');

const MEMPHIS_LNG = -90.05;
const MEMPHIS_LAT = 35.15;
const COUNTY_COUNT = 30;
const SOURCE_URL = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'memphis', 'memphis_counties.geojson');

// 2-digit FIPS state code -> state abbreviation (for states near Memphis)
const STATE_ABBREV = {
  '01': 'AL', '05': 'AR', '17': 'IL', '18': 'IN', '21': 'KY', '28': 'MS', '29': 'MO', '47': 'TN'
};

function getCentroid(feature) {
  const g = feature.geometry;
  if (!g || !g.coordinates) return null;
  let sumLng = 0, sumLat = 0, n = 0;
  function addRing(ring) {
    for (const c of ring) {
      if (typeof c[0] === 'number') { sumLng += c[0]; sumLat += c[1]; n++; }
      else addRing(c);
    }
  }
  if (g.type === 'Polygon') {
    for (const ring of g.coordinates) addRing(ring);
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) {
      for (const ring of poly) addRing(ring);
    }
  }
  if (n === 0) return null;
  return [sumLng / n, sumLat / n];
}

function distSq(lng, lat) {
  const dLng = lng - MEMPHIS_LNG;
  const dLat = lat - MEMPHIS_LAT;
  return dLng * dLng + dLat * dLat;
}

async function main() {
  console.log('Fetching US counties GeoJSON...');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  console.log(`Loaded ${data.features?.length ?? 0} counties`);

  const withDist = (data.features || [])
    .map((f) => {
      const c = getCentroid(f);
      if (!c) return null;
      return { feature: f, distSq: distSq(c[0], c[1]) };
    })
    .filter(Boolean);

  withDist.sort((a, b) => a.distSq - b.distSq);
  const nearest = withDist.slice(0, COUNTY_COUNT).map((x) => x.feature);

  const out = {
    type: 'FeatureCollection',
    features: nearest.map((f) => {
      const stateFips = String(f.id).slice(0, 2);
      const stateAbbrev = STATE_ABBREV[stateFips] || stateFips;
      return {
        type: 'Feature',
        id: f.id,
        properties: {
          NAME: f.properties?.NAME ?? f.properties?.name ?? 'Unknown',
          STATE: stateAbbrev,
          GEOID: f.id,
          project_count: 0,
        },
        geometry: f.geometry,
      };
    }),
  };

  const dir = path.dirname(OUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.features.length} counties (nearest to Memphis) to ${OUT_PATH}`);
  out.features.forEach((f) => console.log(`  - ${f.properties.NAME} (${f.properties.STATE})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
