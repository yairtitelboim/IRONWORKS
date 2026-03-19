/**
 * Lakeside Village (Lake Whitney, TX) change detection helper.
 *
 * Run this inside the Google Earth Engine Code Editor.
 * It mirrors the Whitney DFW7 workflow but replaces the AOI with
 * a 4.5 km circular buffer centered on Lakeside Village.
 */

// AOI configuration ---------------------------------------------------------
var center = ee.Geometry.Point([-97.405, 31.98]);
var radiusMeters = 4500;
var studyArea = center.buffer(radiusMeters);

Map.centerObject(studyArea, 11);
Map.addLayer(studyArea, {color: 'cyan'}, 'Lakeside Village AOI', false);

// Dataset + thresholds ------------------------------------------------------
var DATASET = 'COPERNICUS/S2_SR_HARMONIZED';
var YEAR_PAIRS = [
  [2019, 2020],
  [2020, 2021],
  [2021, 2022],
  [2022, 2023],
  [2023, 2024],
  [2024, 2025]
];

var VIS_CLASSES = {
  1: '#f97316', // agriculture loss
  2: '#22c55e', // agriculture gain
  3: '#f43f5e', // industrial / residential expansion
  4: '#38bdf8', // water change
  5: '#16a34a'  // persistent agriculture
};

var AG_THRESHOLD = 0.45;
var WATER_THRESHOLD = 0.25;
var INDUSTRIAL_NDBI_THRESHOLD = 0.2;
var INDUSTRIAL_NDVI_MAX = 0.42;
var BARREN_NDVI_MAX = 0.22;

// Helper functions ----------------------------------------------------------
function cloudMask(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

function loadComposite(year) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  return ee.ImageCollection(DATASET)
    .filterBounds(studyArea)
    .filterDate(start, end)
    .map(cloudMask)
    .median()
    .clip(studyArea);
}

function classify(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI');

  var agriculture = ndvi.gt(AG_THRESHOLD).and(ndwi.lt(WATER_THRESHOLD + 0.05));
  var water = ndwi.gt(WATER_THRESHOLD);
  var industrial = ndbi.gt(INDUSTRIAL_NDBI_THRESHOLD).and(ndvi.lt(INDUSTRIAL_NDVI_MAX));
  var barren = ndvi.lt(BARREN_NDVI_MAX).and(ndwi.lt(WATER_THRESHOLD));

  return ee.Image(0)
    .where(agriculture, 1)
    .where(water, 2)
    .where(industrial, 3)
    .where(barren, 4)
    .rename('class');
}

function computeChange(yearPair) {
  var year1 = yearPair[0];
  var year2 = yearPair[1];

  var class1 = classify(loadComposite(year1));
  var class2 = classify(loadComposite(year2));

  var water1 = class1.eq(2);
  var water2 = class2.eq(2);

  return ee.Image(0)
    .where(class1.eq(1).and(class2.neq(1)), 1)   // agriculture loss
    .where(class1.neq(1).and(class2.eq(1)), 2)    // agriculture gain
    .where(class1.neq(3).and(class2.eq(3)), 3)    // industrial expansion
    .where(water1.neq(water2), 4)                 // water change
    .where(class1.eq(1).and(class2.eq(1)), 5)     // persistent agriculture
    .rename('change');
}

function visualizeChange(changeImage, yearPair) {
  var palette = [VIS_CLASSES[1], VIS_CLASSES[2], VIS_CLASSES[3], VIS_CLASSES[4], VIS_CLASSES[5]];
  var visParams = {min: 1, max: 5, palette: palette};
  Map.addLayer(changeImage, visParams, yearPair[0] + ' → ' + yearPair[1], false);
}

function exportChangeVectors(changeImage, yearPair) {
  var masked = changeImage.updateMask(changeImage.gt(0));
  var vectors = masked.reduceToVectors({
    geometry: studyArea,
    scale: 60,
    geometryType: 'polygon',
    eightConnected: false,
    labelProperty: 'change_code',
    maxPixels: 1e13
  }).limit(2500);

  var paletteDict = ee.Dictionary(VIS_CLASSES);
  var enriched = vectors.map(function(feature) {
    var geom = feature.geometry();
    var areaHa = geom.area(1).divide(10000);
    var centroid = geom.centroid(1);
    var distanceKm = centroid.distance(center, 1).divide(1000);
    var code = ee.Number(feature.get('change_code')).toInt();
    return feature.set({
      site_id: 'lakeside_village_circle',
      site_name: 'Lakeside Village Circular AOI',
      change_code: code,
      change_label: paletteDict.get(code.format()),
      area_ha: areaHa,
      distance_km: distanceKm,
      year_start: yearPair[0],
      year_end: yearPair[1]
    });
  });

  var fileName = 'lakeside_village_circle_' + yearPair[0] + '_' + yearPair[1];
  Export.table.toDrive({
    collection: enriched,
    description: fileName + '_vectors',
    fileNamePrefix: fileName,
    folder: 'GEE_LakesideVillage',
    fileFormat: 'GeoJSON'
  });
}

// Run the workflow ----------------------------------------------------------
YEAR_PAIRS.forEach(function(pair) {
  var change = computeChange(pair);
  visualizeChange(change, pair);
  exportChangeVectors(change, pair);
});

print('Queued Lakeside Village exports. Adjust YEAR_PAIRS or thresholds as needed.');
