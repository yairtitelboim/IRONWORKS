#!/usr/bin/env node

/**
 * Whitney Infrastructure Data Download Script
 * 
 * This script mimics the OSMCall.jsx functionality to download
 * Whitney infrastructure data from OpenStreetMap and save it
 * to the public folder for faster loading.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Whitney, TX Infrastructure Analysis Zones
const WHITNEY_ZONES = {
  data_center: { 
    lat: 31.9315, lng: -97.347, 
    name: "Whitney Data Center Campus", 
    radius: 1200,
    focus: "Primary data center development zone"
  },
  downtown: { 
    lat: 31.951, lng: -97.323, 
    name: "Whitney Downtown Core", 
    radius: 1500,
    focus: "Civic center, services, and growth corridor"
  },
  lake_whitney: { 
    lat: 31.857, lng: -97.402, 
    name: "Lake Whitney Gateway", 
    radius: 2000,
    focus: "Recreation, tourism, and hydropower assets"
  }
};

// Major highway corridors connecting Whitney-area assets
const WHITNEY_CORRIDORS = {
  data_center_access: {
    lat: 31.9315, lng: -97.347,
    name: "FM-933 / FM-1713 Corridor",
    radius: 15000,
    focus: "Primary access roads serving the Whitney data center campus"
  },
  downtown_access: {
    lat: 31.951, lng: -97.323,
    name: "State Highway 22 Corridor",
    radius: 18000,
    focus: "Whitney commercial spine connecting Hillsboro and Meridian"
  },
  lake_whitney_access: {
    lat: 31.857, lng: -97.402,
    name: "FM-56 Lakeshore Corridor",
    radius: 18000,
    focus: "Lakeside access routes supporting recreation economy"
  },
  regional_connector: {
    lat: 31.89, lng: -97.30,
    name: "I-35 / US-81 Logistics Connector",
    radius: 25000,
    focus: "Freight linkage between Whitney area and Hillsboro logistics hub"
  },
  scenic_loop: {
    lat: 31.84, lng: -97.37,
    name: "Lake Whitney Scenic Loop",
    radius: 20000,
    focus: "Tourism loop encircling the reservoir and recreation assets"
  }
};

// Overpass API endpoints
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

// Utility function to make HTTP requests
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Whitney-Data-Downloader/1.0'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(`data=${encodeURIComponent(data)}`);
    req.end();
  });
}

// Function to query Overpass API with retry logic
async function fetchOverpassData(query, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        console.log(`🔍 Querying ${endpoint} (attempt ${retry + 1}/${maxRetries})`);
        const data = await makeRequest(endpoint, query);
        console.log(`✅ Success with ${endpoint}`);
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${retry + 1} failed for ${endpoint}: ${error.message}`);
        if (retry < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
        }
      }
    }
  }
  
  throw new Error(`All endpoints failed. Last error: ${lastError.message}`);
}

// Function to generate circle coordinates
function generateCircleCoordinates(lat, lng, radiusKm, steps = 64) {
  const coordinates = [];
  const earthRadius = 6371; // Earth's radius in kilometers
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const angleRad = (angle * Math.PI) / 180;
    
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    
    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(radiusKm / earthRadius) +
      Math.cos(latRad) * Math.sin(radiusKm / earthRadius) * Math.cos(angleRad)
    );
    
    const newLng = lngRad + Math.atan2(
      Math.sin(angleRad) * Math.sin(radiusKm / earthRadius) * Math.cos(latRad),
      Math.cos(radiusKm / earthRadius) - Math.sin(latRad) * Math.sin(newLat)
    );
    
    coordinates.push([
      (newLng * 180) / Math.PI,
      (newLat * 180) / Math.PI
    ]);
  }
  
  return coordinates;
}

// Function to process OSM elements into GeoJSON features
function processOSMElements(elements, zoneKey, zoneName) {
  const features = [];
  
  elements.forEach(element => {
    if (element.type === 'node') {
      // Process POI nodes
      if (element.tags && (element.tags.amenity || element.tags.tourism || element.tags.leisure)) {
        let category = 'other';
        let priority = 1;
        
        // Government and public facilities
        if (element.tags.amenity && ['townhall', 'government', 'courthouse', 'library'].includes(element.tags.amenity)) {
          category = 'government_facility';
          priority = 3;
        } else if (element.tags.amenity === 'school') {
          category = 'education';
          priority = 2;
        } else if (element.tags.amenity === 'hospital') {
          category = 'healthcare';
          priority = 3;
        }
        // Services and amenities
        else if (element.tags.amenity && ['restaurant', 'fuel', 'bank', 'post_office'].includes(element.tags.amenity)) {
          category = 'service_amenity';
          priority = 2;
        } else if (element.tags.amenity && ['police', 'fire_station'].includes(element.tags.amenity)) {
          category = 'emergency_services';
          priority = 3;
        }
        // Transportation infrastructure
        else if (element.tags.railway === 'station' || element.tags.public_transport === 'platform') {
          category = 'transit_hub';
          priority = 3;
        }
        // Power facilities
        else if (element.tags.power || element.tags.amenity === 'power' || element.tags.landuse === 'power') {
          category = 'power_facility';
          priority = 3;
        }
        
        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [element.lon, element.lat]
          },
          properties: {
            osm_id: element.id,
            osm_type: 'node',
            name: element.tags.name || 'Unnamed POI',
            amenity: element.tags.amenity || null,
            tourism: element.tags.tourism || null,
            leisure: element.tags.leisure || null,
            category: category,
            priority: priority,
            zone: zoneKey,
            zone_name: zoneName
          }
        };
        
        features.push(feature);
      }
    } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
      // Convert OSM way to GeoJSON
      const coordinates = element.nodes.map(nodeId => {
        const node = elements.find(e => e.id === nodeId);
        return node ? [node.lon, node.lat] : null;
      }).filter(coord => coord !== null);
      
      if (coordinates.length >= 2) {
        let category = 'other';
        let priority = 1;
        let geometryType = 'LineString';
        
        // Commercial and office buildings
        if (element.tags?.building === 'office') {
          category = 'office_building';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        } else if (element.tags?.building === 'commercial') {
          category = 'commercial_building';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        } else if (element.tags?.building === 'retail') {
          category = 'retail_building';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        }
        // Government and public facilities
        else if (element.tags?.amenity && ['townhall', 'government', 'courthouse', 'library'].includes(element.tags.amenity)) {
          category = 'government_facility';
          priority = 3;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        } else if (element.tags?.amenity === 'school') {
          category = 'education';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        } else if (element.tags?.amenity === 'hospital') {
          category = 'healthcare';
          priority = 3;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        }
        // Transportation infrastructure - roads
        else if (element.tags?.highway && ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified'].includes(element.tags.highway)) {
          category = 'highway_access';
          priority = element.tags.highway === 'motorway' || element.tags.highway === 'trunk' ? 3 : 
                    element.tags.highway === 'primary' || element.tags.highway === 'secondary' ? 2 : 1;
        }
        // Parks and recreational areas
        else if (element.tags?.leisure && ['park', 'playground', 'sports_centre'].includes(element.tags.leisure)) {
          category = 'recreation_area';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        } else if (element.tags?.landuse === 'recreation_ground') {
          category = 'recreation_area';
          priority = 2;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        }
        // Industrial areas
        else if (element.tags?.landuse === 'industrial' || element.tags?.building === 'industrial') {
          category = 'industrial';
          priority = 1;
          geometryType = 'Polygon';
          if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
          }
        }
        // Power facilities and infrastructure
        else if (element.tags?.power || element.tags?.amenity === 'power' || element.tags?.landuse === 'power') {
          category = 'power_facility';
          priority = 3;
          // Power lines are LineString, power stations are Polygon
          if (element.tags?.power === 'line' || element.tags?.power === 'tower' || element.tags?.power === 'pole') {
            geometryType = 'LineString';
          } else {
            geometryType = 'Polygon';
            if (coordinates[0] !== coordinates[coordinates.length - 1]) {
              coordinates.push(coordinates[0]);
            }
          }
        }
        
        // Create the appropriate geometry
        let geometry;
        if (geometryType === 'Polygon') {
          geometry = {
            type: 'Polygon',
            coordinates: [coordinates]
          };
        } else {
          geometry = {
            type: 'LineString',
            coordinates: coordinates
          };
        }
        
        const feature = {
          type: 'Feature',
          geometry: geometry,
          properties: {
            osm_id: element.id,
            osm_type: 'way',
            building: element.tags?.building || null,
            building_levels: element.tags?.['building:levels'] || null,
            amenity: element.tags?.amenity || null,
            highway: element.tags?.highway || null,
            leisure: element.tags?.leisure || null,
            name: element.tags?.name || 'Unnamed Area',
            category: category,
            priority: priority,
            geometry_type: geometryType,
            zone: zoneKey,
            zone_name: zoneName
          }
        };
        
        features.push(feature);
      }
    }
  });
  
  return features;
}

// Main function to download Whitney data
async function downloadWhitneyData() {
  console.log('🏜️ Starting Whitney infrastructure data download...');
  
  const allFeatures = [];
  const zoneResults = {};
  
  // Query all Whitney zones
  for (const [zoneKey, zone] of Object.entries(WHITNEY_ZONES)) {
    console.log(`📍 Querying ${zone.name} (${zone.radius}m radius)`);
    
    const overpassQuery = `
      [out:json][timeout:25];
      (
        // Commercial and office buildings
        way["building"="office"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["building"="commercial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["building"="retail"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Government and public facilities
        node["amenity"~"^(townhall|government|courthouse|library|school|hospital)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["amenity"~"^(townhall|government|courthouse|library|school|hospital)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Transportation infrastructure - roads
        way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        node["railway"="station"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        node["public_transport"="platform"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Services and amenities
        node["amenity"~"^(restaurant|fuel|bank|post_office|police|fire_station)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["amenity"~"^(restaurant|fuel|bank|post_office|police|fire_station)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Parks and recreational areas
        way["leisure"~"^(park|playground|sports_centre)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["landuse"="recreation_ground"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Industrial and manufacturing
        way["landuse"="industrial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["building"="industrial"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        
        // Power facilities and infrastructure
        node["power"~"^(station|substation|generator|transformer|tower|pole)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["power"~"^(station|substation|generator|transformer|tower|pole|line)$"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        node["amenity"="power"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["amenity"="power"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        node["landuse"="power"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
        way["landuse"="power"](around:${zone.radius}, ${zone.lat}, ${zone.lng});
      );
      out body;
      >;
      out skel qt;
    `;
    
    try {
      const osmData = await fetchOverpassData(overpassQuery);
      console.log(`✅ Successfully queried ${zone.name}: ${osmData.elements?.length || 0} elements`);
      
      const zoneFeatures = processOSMElements(osmData.elements || [], zoneKey, zone.name);
      zoneResults[zoneKey] = zoneFeatures;
      allFeatures.push(...zoneFeatures);
      
      console.log(`📊 Processed ${zoneFeatures.length} features from ${zone.name}`);
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to query ${zone.name}: ${error.message}`);
    }
  }
  
  // Query highway corridors
  console.log('🛣️ Querying major highway corridors...');
  for (const [corridorKey, corridor] of Object.entries(WHITNEY_CORRIDORS)) {
    console.log(`🛣️ Querying ${corridor.name} (${corridor.radius}m radius)`);
    
    const highwayQuery = `
      [out:json][timeout:25];
      (
        // Major highways and interstates - broader search
        way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
        
        // Major intersections and interchanges
        node["highway"="motorway_junction"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
        node["highway"="trunk_junction"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
        node["highway"="primary_junction"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
      );
      out body;
      >;
      out skel qt;
    `;
    
    try {
      const highwayData = await fetchOverpassData(highwayQuery);
      console.log(`✅ Successfully queried ${corridor.name}: ${highwayData.elements?.length || 0} elements`);
      
      const highwayFeatures = processOSMElements(highwayData.elements || [], corridorKey, corridor.name);
      zoneResults[corridorKey] = highwayFeatures;
      allFeatures.push(...highwayFeatures);
      
      console.log(`📊 Processed ${highwayFeatures.length} highway features from ${corridor.name}`);
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to query ${corridor.name}: ${error.message}`);
    }
  }
  
  // Add dedicated power facility query
  console.log('⚡ Running dedicated power facility query for Whitney area...');
  const powerQuery = `
    [out:json][timeout:25];
    (
      // Power facilities in Whitney area - broader search
      node["power"~"^(station|substation|generator|transformer|tower|pole)$"](around:5000, 31.9315, -97.347);
      way["power"~"^(station|substation|generator|transformer|tower|pole|line)$"](around:5000, 31.9315, -97.347);
      node["amenity"="power"](around:5000, 31.9315, -97.347);
      way["amenity"="power"](around:5000, 31.9315, -97.347);
      node["landuse"="power"](around:5000, 31.9315, -97.347);
      way["landuse"="power"](around:5000, 31.9315, -97.347);
    );
    out body;
    >;
    out skel qt;
  `;
  
  try {
    const powerData = await fetchOverpassData(powerQuery);
    console.log(`⚡ Power query found ${powerData.elements?.length || 0} power elements`);
    
    if (powerData.elements && powerData.elements.length > 0) {
      const powerFeatures = processOSMElements(powerData.elements, 'power_search', 'Whitney Power Infrastructure');
      allFeatures.push(...powerFeatures);
      console.log(`✅ Added ${powerFeatures.length} power facilities from dedicated query`);
    }
  } catch (error) {
    console.warn(`⚠️ Power facility query failed: ${error.message}`);
  }
  
  // Calculate summary statistics
  const categoryCounts = {};
  allFeatures.forEach(f => {
    const cat = f.properties.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  console.log('📊 Feature categories found:', categoryCounts);
  
  // Create the final data structure
  const analysisResults = {
    features: allFeatures,
    timestamp: Date.now(),
    zones_queried: Object.keys(WHITNEY_ZONES),
    zone_results: zoneResults,
    summary: {
      office_building: allFeatures.filter(f => f.properties.category === 'office_building').length,
      commercial_building: allFeatures.filter(f => f.properties.category === 'commercial_building').length,
      retail_building: allFeatures.filter(f => f.properties.category === 'retail_building').length,
      government_facility: allFeatures.filter(f => f.properties.category === 'government_facility').length,
      education: allFeatures.filter(f => f.properties.category === 'education').length,
      healthcare: allFeatures.filter(f => f.properties.category === 'healthcare').length,
      service_amenity: allFeatures.filter(f => f.properties.category === 'service_amenity').length,
      emergency_services: allFeatures.filter(f => f.properties.category === 'emergency_services').length,
      transit_hub: allFeatures.filter(f => f.properties.category === 'transit_hub').length,
      power_facility: allFeatures.filter(f => f.properties.category === 'power_facility').length,
      highway_access: allFeatures.filter(f => f.properties.category === 'highway_access').length,
      recreation_area: allFeatures.filter(f => f.properties.category === 'recreation_area').length,
      industrial: allFeatures.filter(f => f.properties.category === 'industrial').length
    },
    whitney_insights: {
      data_center_proximity: allFeatures.filter(f => f.properties.zone === 'data_center').length,
      downtown_proximity: allFeatures.filter(f => f.properties.zone === 'downtown').length,
      lake_whitney_proximity: allFeatures.filter(f => f.properties.zone === 'lake_whitney').length,
      total_commercial_development: allFeatures.filter(f => f.properties.category.includes('commercial') || f.properties.category.includes('office') || f.properties.category.includes('retail')).length,
      high_priority_features: allFeatures.filter(f => f.properties.priority === 3).length
    }
  };
  
  // Ensure public directory exists
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Save to public folder
  const outputPath = path.join(publicDir, 'whitney-cache.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysisResults, null, 2));
  
  console.log(`✅ Whitney infrastructure data saved to: ${outputPath}`);
  console.log(`📊 Total features: ${allFeatures.length}`);
  console.log(`⚡ Power facilities: ${analysisResults.summary.power_facility}`);
  console.log(`🏢 Commercial buildings: ${analysisResults.summary.commercial_building + analysisResults.summary.office_building + analysisResults.summary.retail_building}`);
  console.log(`🏛️ Government facilities: ${analysisResults.summary.government_facility}`);
  console.log(`🛣️ Highway access: ${analysisResults.summary.highway_access}`);
  
  return analysisResults;
}

// Run the script
if (require.main === module) {
  downloadWhitneyData()
    .then(() => {
      console.log('🎉 Whitney data download completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Whitney data download failed:', error);
      process.exit(1);
    });
}

module.exports = { downloadWhitneyData };


