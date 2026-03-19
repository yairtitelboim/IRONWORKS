import { WHITNEY_ZONES } from '../config/whitneyConfig';
import { buildWhitneyBoundaryQuery, buildZoneInfrastructureQuery } from './overpassQueries';
import { fetchOverpassJSON } from './overpassClient';
import { calculateWhitneyMetrics } from './whitneyMapUtils';

function ts(label) {
  const t = new Date().toISOString();
  return `[${t}] ${label}`;
}

export async function fetchWhitneyBoundary() {
  console.log(ts('Boundary: build query'));
  const query = buildWhitneyBoundaryQuery();
  const data = await fetchOverpassJSON(query, { retriesPerEndpoint: 1, totalEndpoints: 2 });
  console.log(ts('Boundary: overpass response received'));

  if (data.elements && data.elements.length > 0) {
    const boundary = data.elements[0];
    const coordinates = boundary.members
      .filter(member => member.type === 'way')
      .map(member => member.geometry)
      .filter(geom => geom && geom.length > 0);
    if (coordinates.length > 0) {
      const boundaryGeoJSON = {
        type: 'Feature',
        properties: { name: 'Bosque County', admin_level: boundary.tags?.admin_level || '6', boundary: 'administrative', type: 'county_boundary' },
        geometry: { type: 'Polygon', coordinates: [coordinates.flat()] }
      };
      console.log(ts('Boundary: processed into GeoJSON'));
      return boundaryGeoJSON;
    }
  }
  console.warn(ts('Boundary: not found'));
  return null;
}

export async function fetchZoneInfrastructure() {
  const allFeatures = []; const zoneResults = {};
  for (const [zoneKey, zone] of Object.entries(PINAL_ZONES)) {
    console.log(ts(`Zone ${zone.name}: build query`));
    const query = buildZoneInfrastructureQuery(zone);
    let osmData;
    try {
      osmData = await fetchOverpassJSON(query, { retriesPerEndpoint: 1, totalEndpoints: 2 });
    } catch (e) {
      console.warn(ts(`Zone ${zone.name}: overpass failed - ${e.message}`));
      continue;
    }
    console.log(ts(`Zone ${zone.name}: received ${osmData.elements?.length || 0} elements`));

    const zoneFeatures = [];
    if (osmData.elements) {
      osmData.elements.forEach(element => {
        if (element.type === 'node') {
          if (element.tags && (element.tags.amenity || element.tags.tourism || element.tags.leisure)) {
            let category = 'other'; let priority = 1;
            if (element.tags.amenity && ['townhall', 'government', 'courthouse', 'library'].includes(element.tags.amenity)) { category = 'government_facility'; priority = 3; }
            else if (element.tags.amenity === 'school') { category = 'education'; priority = 2; }
            else if (element.tags.amenity === 'hospital') { category = 'healthcare'; priority = 3; }
            else if (element.tags.amenity && ['restaurant', 'fuel', 'bank', 'post_office'].includes(element.tags.amenity)) { category = 'service_amenity'; priority = 2; }
            else if (element.tags.amenity && ['police', 'fire_station'].includes(element.tags.amenity)) { category = 'emergency_services'; priority = 3; }
            else if (element.tags.railway === 'station' || element.tags.public_transport === 'platform') { category = 'transit_hub'; priority = 3; }

            zoneFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [element.lon, element.lat] },
              properties: { osm_id: element.id, osm_type: 'node', name: element.tags.name || 'Unnamed POI', amenity: element.tags.amenity || null, tourism: element.tags.tourism || null, leisure: element.tags.leisure || null, category, priority, zone: zoneKey, zone_name: zone.name }
            });
          }
        } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
          const coordinates = element.nodes.map(nodeId => {
            const node = osmData.elements.find(e => e.id === nodeId);
            return node ? [node.lon, node.lat] : null;
          }).filter(Boolean);
          if (coordinates.length >= 2) {
            let category = 'other'; let priority = 1; let geometryType = 'LineString';
            if (element.tags?.building === 'office') { category = 'office_building'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.building === 'commercial') { category = 'commercial_building'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.building === 'retail') { category = 'retail_building'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.amenity && ['townhall', 'government', 'courthouse', 'library'].includes(element.tags.amenity)) { category = 'government_facility'; priority = 3; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.amenity === 'school') { category = 'education'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.amenity === 'hospital') { category = 'healthcare'; priority = 3; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.highway && ['motorway', 'trunk', 'primary', 'secondary'].includes(element.tags.highway)) { category = 'highway_access'; priority = 3; }
            else if (element.tags?.leisure && ['park', 'playground', 'sports_centre'].includes(element.tags.leisure)) { category = 'recreation_area'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.landuse === 'recreation_ground') { category = 'recreation_area'; priority = 2; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }
            else if (element.tags?.landuse === 'industrial' || element.tags?.building === 'industrial') { category = 'industrial'; priority = 1; geometryType = 'Polygon'; if (coordinates[0] !== coordinates[coordinates.length - 1]) coordinates.push(coordinates[0]); }

            const geometry = geometryType === 'Polygon' ? { type: 'Polygon', coordinates: [coordinates] } : { type: 'LineString', coordinates };
            zoneFeatures.push({ type: 'Feature', geometry, properties: { osm_id: element.id, osm_type: 'way', building: element.tags?.building || null, ['building:levels']: element.tags?.['building:levels'] || null, amenity: element.tags?.amenity || null, highway: element.tags?.highway || null, leisure: element.tags?.leisure || null, name: element.tags?.name || 'Unnamed Area', category, priority, geometry_type: geometryType, zone: zoneKey, zone_name: zone.name } });
          }
        }
      });
    }

    zoneResults[zoneKey] = zoneFeatures; allFeatures.push(...zoneFeatures);
    console.log(ts(`Zone ${zone.name}: produced ${zoneFeatures.length} features`));
  }

  console.log(ts(`Zones total features: ${allFeatures.length}`));
  return { allFeatures, zoneResults };
}

export async function runWhitneyAnalysis() {
  console.log(ts('Analysis: start'));
  const boundary = await fetchWhitneyBoundary();
  const { allFeatures, zoneResults } = await fetchZoneInfrastructure();
  const enhanced = calculateWhitneyMetrics(allFeatures);
  const analysisResults = {
    features: enhanced,
    timestamp: Date.now(),
    zones_queried: Object.keys(WHITNEY_ZONES),
    zone_results: zoneResults,
    summary: {
      office_building: enhanced.filter(f => f.properties.category === 'office_building').length,
      commercial_building: enhanced.filter(f => f.properties.category === 'commercial_building').length,
      retail_building: enhanced.filter(f => f.properties.category === 'retail_building').length,
      government_facility: enhanced.filter(f => f.properties.category === 'government_facility').length,
      education: enhanced.filter(f => f.properties.category === 'education').length,
      healthcare: enhanced.filter(f => f.properties.category === 'healthcare').length,
      service_amenity: enhanced.filter(f => f.properties.category === 'service_amenity').length,
      emergency_services: enhanced.filter(f => f.properties.category === 'emergency_services').length,
      transit_hub: enhanced.filter(f => f.properties.category === 'transit_hub').length,
      highway_access: enhanced.filter(f => f.properties.category === 'highway_access').length,
      recreation_area: enhanced.filter(f => f.properties.category === 'recreation_area').length,
      industrial: enhanced.filter(f => f.properties.category === 'industrial').length,
      high_development_potential: enhanced.filter(f => f.properties.development_score > 75).length
    },
    pinal_insights: {
      casa_grande_proximity: enhanced.filter(f => f.properties.distance_to_casa_grande < 5000).length,
      florence_proximity: enhanced.filter(f => f.properties.distance_to_florence < 5000).length,
      high_development_potential: enhanced.filter(f => f.properties.development_score > 75).length,
      total_commercial_development: enhanced.filter(f => f.properties.category.includes('commercial') || f.properties.category.includes('office') || f.properties.category.includes('retail')).length,
      high_priority_features: enhanced.filter(f => f.properties.priority === 3).length
    },
    boundary
  };
  console.log(ts('Analysis: results ready'));
  return analysisResults;
}

