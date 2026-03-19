const turf = require('@turf/turf');
const lineMerge = require('@turf/line-merge').default;
const fs = require('fs');

// File paths
const I10_PATH = 'public/data/i10_ozona_sonora_snapped.geojson';
const US277_PATH = 'public/data/us277_sonora_rocksprings_snapped.geojson';
const I10_OUT = 'public/data/i10_ozona_sonora_trimmed.geojson';
const US277_OUT = 'public/data/us277_sonora_rocksprings_trimmed.geojson';

// Intersection point (Sonora)
const intersection = turf.point([-100.647867, 30.578935]);

// Load GeoJSONs
const i10 = JSON.parse(fs.readFileSync(I10_PATH));
const us277 = JSON.parse(fs.readFileSync(US277_PATH));

// Merge all features into a single LineString for each road
const i10Line = lineMerge(turf.featureCollection(i10.features));
const us277Line = lineMerge(turf.featureCollection(us277.features));

// For I-10: slice from start to intersection
const i10Start = turf.point(i10Line.geometry.coordinates[0]);
const i10Trimmed = turf.lineSlice(i10Start, intersection, i10Line);

// For US-277: slice from intersection to end
const us277End = turf.point(us277Line.geometry.coordinates[us277Line.geometry.coordinates.length - 1]);
const us277Trimmed = turf.lineSlice(intersection, us277End, us277Line);

// Save trimmed GeoJSONs
fs.writeFileSync(I10_OUT, JSON.stringify(i10Trimmed));
fs.writeFileSync(US277_OUT, JSON.stringify(us277Trimmed));

console.log('Trimmed I-10 saved to', I10_OUT);
console.log('Trimmed US-277 saved to', US277_OUT); 