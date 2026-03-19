import React, { useState, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { fetchOverpassJSON } from '../../../../utils/overpassClient';
import { generateCircleCoordinates, calculatePinalMetrics } from '../../../../utils/pinalMapUtils';
import PINAL_SITES from '../../../../data/pinalSites';
import { resolveCoordinatesForSites } from '../../../../utils/geocodeSites';
import { createCasaGrandeMarker } from './utils/pinalMarkers';

// Pinal County Arizona Infrastructure Analysis Zones
const PINAL_ZONES = {
  casa_grande: { 
    lat: 32.8795, lng: -111.7573, 
    name: "Casa Grande", 
    radius: 2000,
    focus: "Major urban center & commercial development"
  },
  florence: { 
    lat: 33.0314, lng: -111.3873, 
    name: "Florence", 
    radius: 1500,
    focus: "County seat & historic downtown"
  },
  apache_junction: { 
    lat: 33.4150, lng: -111.5496, 
    name: "Apache Junction", 
    radius: 1800,
    focus: "Northern gateway & transportation hub"
  }
};

// Major highway corridors connecting Pinal County areas
const HIGHWAY_CORRIDORS = {
  i10_casa_grande: {
    lat: 32.8795, lng: -111.7573, // Casa Grande area
    name: "I-10 Casa Grande Corridor",
    radius: 20000, // 20km radius to capture I-10 around Casa Grande
    focus: "Interstate 10 through Casa Grande area"
  },
  i10_florence: {
    lat: 33.0314, lng: -111.3873, // Florence area
    name: "I-10 Florence Corridor",
    radius: 20000, // 20km radius to capture I-10 around Florence
    focus: "Interstate 10 through Florence area"
  },
  i10_apache_junction: {
    lat: 33.4150, lng: -111.5496, // Apache Junction area
    name: "I-10 Apache Junction Corridor",
    radius: 20000, // 20km radius to capture I-10 around Apache Junction
    focus: "Interstate 10 through Apache Junction area"
  },
  us60_corridor: {
    lat: 33.2, lng: -111.3,
    name: "US-60 Corridor",
    radius: 15000, // 15km radius for US-60
    focus: "US-60 connecting Apache Junction to Globe"
  },
  sr87_corridor: {
    lat: 33.0, lng: -111.4,
    name: "SR-87 Corridor",
    radius: 15000, // 15km radius for SR-87
    focus: "State Route 87 north-south connector"
  }
};

// Cache configuration
const CACHE_KEY = 'pinal_county_infrastructure_analysis';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Module-level cache (persists across component re-mounts)
const globalPinalCache = new Map();

const OSMCall = ({ 
  onClick, 
  title = "Pinal County Infrastructure Analysis",
  color = "#059669", // Green color for Arizona analysis
  size = "10px",
  position = { top: '-25px', left: 'calc(98% + 20px)' }, // Positioned to the right of drag handle
  aiState = null, // Add aiState prop for context
  map = null, // Add map prop for future use
  onLoadingChange = null, // Callback to notify parent of loading state
  disabled = false, // Add disabled prop
  updateToolFeedback = null, // Callback to update tool feedback
  locationKey = 'default', // Add locationKey prop to get correct coordinates
  onToggleLucid = null // Callback to toggle Lucid layer
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState(null);

  // Cache management functions (using global cache)
  const getCachedData = useCallback(() => {
    try {
      const cached = globalPinalCache.get(CACHE_KEY);
      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < CACHE_DURATION) {
          console.log('📦 Using cached Pinal County infrastructure data from global cache');
          return cached.data;
        } else {
          console.log('⏰ Pinal County cache expired, clearing...');
          globalPinalCache.delete(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading Pinal County cache:', error);
      globalPinalCache.delete(CACHE_KEY);
    }
    return null;
  }, []);

  const saveCachedData = (data) => {
    try {
      // Compress data before caching (similar to OsmTool.js)
      const compressedData = compressPinalData(data);
      
      const cacheEntry = {
        data: compressedData,
        timestamp: Date.now()
      };
      
      globalPinalCache.set(CACHE_KEY, cacheEntry);
      console.log('💾 Pinal County infrastructure data cached successfully in global cache');
      console.log('🔍 Pinal County cache size:', globalPinalCache.size);
    } catch (error) {
      console.warn('⚠️ Error caching Pinal County data:', error);
    }
  };

  const clearCache = () => {
    try {
      globalPinalCache.delete(CACHE_KEY);
      setCachedData(null);
      console.log('🗑️ Pinal County cache cleared from global cache');
    } catch (error) {
      console.warn('⚠️ Error clearing Pinal County cache:', error);
    }
  };

  // Compress Pinal County data for efficient caching (similar to OsmTool.js)
  const compressPinalData = (data) => {
    return {
      features: data.features?.map(feature => ({
        type: feature.type,
        geometry: feature.geometry,
        properties: {
          osm_id: feature.properties?.osm_id,
          name: feature.properties?.name,
          category: feature.properties?.category,
          priority: feature.properties?.priority,
          zone: feature.properties?.zone,
          zone_name: feature.properties?.zone_name,
          amenity: feature.properties?.amenity,
          tourism: feature.properties?.tourism,
          leisure: feature.properties?.leisure,
          building: feature.properties?.building,
          building_levels: feature.properties?.building_levels,
          highway: feature.properties?.highway,
          railway: feature.properties?.railway,
          public_transport: feature.properties?.public_transport,
          // Keep essential Pinal County analysis properties
          distance_to_casa_grande: feature.properties?.distance_to_casa_grande,
          distance_to_florence: feature.properties?.distance_to_florence,
          development_score: feature.properties?.development_score,
          accessibility_score: feature.properties?.accessibility_score
        }
      })) || [],
      summary: data.summary || {},
      pinal_insights: data.pinal_insights || {},
      zones_queried: data.zones_queried || [],
      zone_results: data.zone_results || {}
    };
  };

  // Decompress Pinal County data from cache
  const decompressPinalData = useCallback((compressedData) => {
    return {
      features: compressedData.features || [],
      summary: compressedData.summary || {},
      pinal_insights: compressedData.pinal_insights || {},
      zones_queried: compressedData.zones_queried || [],
      zone_results: compressedData.zone_results || {},
      timestamp: Date.now(),
      cached: true
    };
  }, []);

  // Save Pinal County data to local JSON file (similar to OsmTool.js)
  const saveToLocalPinalFile = (data) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      
      // Create downloadable file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pinal-county-cache.json';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('📁 Pinal County: Cache file downloaded - place in public folder for caching');
    } catch (error) {
      console.warn('📁 Pinal County: Failed to save local file:', error);
    }
  };

  // Cache cleanup function (similar to OsmTool.js)
  const cleanupCache = useCallback(() => {
    try {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, entry] of globalPinalCache.entries()) {
        if (now - entry.timestamp > CACHE_DURATION) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => globalPinalCache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`🧹 Pinal County Cache: Cleaned up ${keysToDelete.length} expired entries`);
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning up Pinal County cache:', error);
    }
  }, []);

  // Cache statistics function
  const getCacheStats = useCallback(() => {
    return {
      size: globalPinalCache.size,
      expirationMinutes: CACHE_DURATION / (60 * 1000),
      entries: Array.from(globalPinalCache.entries()).map(([key, entry]) => ({
        key,
        age: Math.round((Date.now() - entry.timestamp) / 1000 / 60), // minutes
        valid: (Date.now() - entry.timestamp) < CACHE_DURATION
      }))
    };
  }, []);

  // Check for cached data on component mount and cleanup
  useEffect(() => {
    // Cleanup expired cache entries
    cleanupCache();
    
    // Check for valid cached data
    const cached = getCachedData();
    if (cached) {
      const decompressedData = decompressPinalData(cached);
      setCachedData(decompressedData);
      console.log('📦 Pinal County Cache: Loaded cached data on mount');
    }
    
    // Cache stats logging removed for cleaner console
  }, [getCachedData, cleanupCache, getCacheStats, decompressPinalData]);

  
  // Geometry and scoring helpers moved to utils/pinalMapUtils.js


  // Function to fetch Pinal County boundary from OpenStreetMap
  const fetchPinalCountyBoundary = async () => {
    try {
      console.log('🗺️ Fetching Pinal County boundary from OpenStreetMap...');
      
      // Overpass API query for Pinal County administrative boundary
      const overpassQuery = `
        [out:json][timeout:25];
        (
          relation["name"="Pinal County"]["boundary"="administrative"]["admin_level"="6"];
          relation["name"="Pinal"]["boundary"="administrative"]["admin_level"="6"];
          relation["name"="Pinal County"]["boundary"="administrative"];
          relation["name"="Pinal"]["boundary"="administrative"];
        );
        out geom;
      `;
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🏜️ Pinal County boundary data received:', data);
      
      if (data.elements && data.elements.length > 0) {
        // Convert OSM relation to GeoJSON
        const boundary = data.elements[0];
        const coordinates = boundary.members
          .filter(member => member.type === 'way')
          .map(member => member.geometry)
          .filter(geom => geom && geom.length > 0);
        
        if (coordinates.length > 0) {
          // Create a simple polygon from the boundary coordinates
          const boundaryGeoJSON = {
            type: 'Feature',
            properties: {
              name: 'Pinal County',
              admin_level: boundary.tags?.admin_level || '6',
              boundary: 'administrative',
              type: 'county_boundary'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates.flat()]
            }
          };
          
          console.log('✅ Pinal County boundary processed successfully');
          return boundaryGeoJSON;
        }
      }
      
      console.warn('⚠️ No boundary data found for Pinal County, using fallback boundary');
      
      // Fallback: Create a simple rectangular boundary around Pinal County
      const fallbackBoundary = {
        type: 'Feature',
        properties: {
          name: 'Pinal County (Fallback)',
          admin_level: '6',
          boundary: 'administrative',
          type: 'county_boundary'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-112.5, 32.5], // Southwest corner
            [-110.5, 32.5], // Southeast corner  
            [-110.5, 33.5], // Northeast corner
            [-112.5, 33.5], // Northwest corner
            [-112.5, 32.5]  // Close the polygon
          ]]
        }
      };
      
      console.log('✅ Using fallback Pinal County boundary');
      return fallbackBoundary;
      
    } catch (error) {
      console.error('❌ Error fetching Pinal County boundary:', error);
      return null;
    }
  };


  // Function to fetch Pinal County infrastructure data from OSM
  const fetchPinalInfrastructure = async (marker, useCache = true) => {
    try {
      // Check cache first if useCache is true
      if (useCache) {
        console.log('🔍 Checking Pinal County cache...');
        const cached = getCachedData();
        if (cached) {
          console.log('📦 Using cached Pinal County infrastructure data');
          
          // Decompress cached data
          const decompressedData = decompressPinalData(cached);
          console.log(`📦 Cached data: ${decompressedData.features.length} features`);
          
          // Update feedback for cached data
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: '📦 Loading cached Pinal County data...',
              progress: 50,
              details: `Using cached analysis from ${new Date(decompressedData.timestamp).toLocaleTimeString()}`
            });
          }
          
          // Emit cached data to legend
          if (window.mapEventBus) {
            window.mapEventBus.emit('pinal:analysisComplete', decompressedData);
            window.mapEventBus.emit('osm:dataLoaded', decompressedData);
          }
          
          return decompressedData.features;
        } else {
          console.log('❌ No cached Pinal County data found, checking for local file...');
        }
      }
      
      // Check for local Pinal County data file first
      console.log('🔍 Checking for local Pinal County data file...');
      try {
        const response = await fetch('/companies/pinal-county-cache.json');
        if (response.ok) {
          const localData = await response.json();
          
          // Check if this is old data without roads (before highway corridors were added)
          const hasRoads = localData.features?.some(f => 
            f.properties?.category === 'interstate' || 
            f.properties?.category === 'us_highway' || 
            f.properties?.category === 'state_highway' ||
            f.properties?.corridor === true
          );
          
          if (!hasRoads) {
            console.log('🛣️ Local data is outdated (no roads found), fetching fresh data...');
            // Skip using local data and proceed to API calls
          } else {
            console.log('⚡ Pinal County: Using local Pinal County data file');
          
          // Update feedback for local data
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
                status: '⚡ Loading local Pinal County data...',
              progress: 40,
                details: `Using local Pinal County data (${localData.features?.length || 0} features)`
            });
          }
          
          // Cache the local data for future use
          saveCachedData(localData);
          
          // Emit local data to legend
          if (window.mapEventBus) {
              window.mapEventBus.emit('pinal:analysisComplete', localData);
            window.mapEventBus.emit('osm:dataLoaded', localData);
          }
          
          return localData.features || [];
          }
        }
      } catch (error) {
        console.log('📁 Pinal County: No local data file found, proceeding with API call');
      }
      
      console.log('🏜️ Fetching Pinal County infrastructure data across all zones');
        
        // Update feedback for OSM query start
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'osm',
          status: '🔍 Querying Pinal County infrastructure...',
            progress: 70,
          details: `Analyzing infrastructure across ${Object.keys(PINAL_ZONES).length} Pinal County zones`
        });
      }

      // Query all Pinal County zones and highway corridors
      const allFeatures = [];
      const zoneResults = {};

      // First query the main zones
      for (const [zoneKey, zone] of Object.entries(PINAL_ZONES)) {
        console.log(`📍 Querying ${zone.name} (${zone.radius}m radius)`);

        const overpassQuery = `
          [out:json][timeout:15];
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
          );
          out body;
          >;
          out skel qt;
        `;
      
      // Use resilient client with endpoint rotation and content-type guard
      const startTs = new Date().toISOString();
      console.log(`[${startTs}] Overpass zone query start: ${zone.name} (${zone.radius}m)`);
      let osmData;
      try {
        osmData = await fetchOverpassJSON(overpassQuery, { retriesPerEndpoint: 1, totalEndpoints: 2 });
      } catch (e) {
        console.warn(`[${new Date().toISOString()}] Overpass zone query failed for ${zone.name}: ${e.message}`);
          continue;
      }
      console.log(`[${new Date().toISOString()}] Overpass zone query success: ${zone.name}`);
        console.log(`📡 OSM Response for ${zone.name}:`, osmData);
        console.log(`🏗️ Found ${osmData.elements?.length || 0} elements in ${zone.name}`);
      
        // Process OSM elements into GeoJSON features with Pinal County categories
        const zoneFeatures = [];
      
      if (osmData.elements) {
                 osmData.elements.forEach(element => {
           if (element.type === 'node') {
              // Process POI nodes with Pinal County-specific categories
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
                    zone_name: zone.name
                  }
                };
                
                zoneFeatures.push(feature);
            }
                   } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
              // Convert OSM way to GeoJSON with Pinal County categories
            const coordinates = element.nodes.map(nodeId => {
              const node = osmData.elements.find(e => e.id === nodeId);
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
                    zone_name: zone.name
                }
               };
              
                zoneFeatures.push(feature);
            }
          }
        });
        }
        
        zoneResults[zoneKey] = zoneFeatures;
        allFeatures.push(...zoneFeatures);
        console.log(`✅ Processed ${zoneFeatures.length} features from ${zone.name}`);
      }
      
      // Now query highway corridors for major connecting roads
      console.log('🛣️ Querying major highway corridors...');
      for (const [corridorKey, corridor] of Object.entries(HIGHWAY_CORRIDORS)) {
        console.log(`🛣️ Querying ${corridor.name} (${corridor.radius}m radius)`);

        const highwayQuery = `
          [out:json][timeout:25];
          (
            // Major highways and interstates - broader search
            way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
            
            // Specific route references
            way["ref"~"^(I-10|I 10|US-60|US 60|SR-87|AZ-87|87)$"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
            
            // Named highways
            way["name"~"^(Interstate 10|I-10|US Highway 60|US 60|State Route 87|Arizona 87|SR 87)$"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
            
            // Major roads in Casa Grande area
            way["highway"="primary"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
            way["highway"="secondary"](around:${corridor.radius}, ${corridor.lat}, ${corridor.lng});
            
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
          const startTs = new Date().toISOString();
          console.log(`[${startTs}] Overpass highway query start: ${corridor.name} (${corridor.radius}m)`);
          const highwayData = await fetchOverpassJSON(highwayQuery, { retriesPerEndpoint: 1, totalEndpoints: 2 });
          console.log(`[${new Date().toISOString()}] Overpass highway query success: ${corridor.name}`);
          
          // Process highway elements
          const highwayFeatures = [];
          if (highwayData.elements) {
            highwayData.elements.forEach(element => {
              if (element.type === 'node') {
                // Highway junctions and intersections
                if (element.tags?.highway && ['motorway_junction', 'trunk_junction'].includes(element.tags.highway)) {
                  highwayFeatures.push({
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [element.lon, element.lat]
                    },
                    properties: {
                      osm_id: element.id,
                      osm_type: 'node',
                      name: element.tags.name || 'Highway Junction',
                      highway: element.tags.highway,
                      ref: element.tags.ref || null,
                      category: 'highway_junction',
                      priority: 3,
                      zone: corridorKey,
                      zone_name: corridor.name,
                      corridor: true
                    }
                  });
                }
              } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
                // Highway ways
                const coordinates = element.nodes.map(nodeId => {
                  const node = highwayData.elements.find(e => e.id === nodeId);
                  return node ? [node.lon, node.lat] : null;
                }).filter(coord => coord !== null);
                
                if (coordinates.length >= 2) {
                  let category = 'highway_access';
                  let priority = 3;
                  
                  // Categorize by highway type
                  if (element.tags?.highway === 'motorway' || 
                      element.tags?.ref?.includes('I-10') || 
                      element.tags?.ref?.includes('I 10') ||
                      element.tags?.name?.includes('Interstate 10') ||
                      element.tags?.name?.includes('I-10')) {
                    category = 'interstate';
                    priority = 3;
                  } else if (element.tags?.highway === 'trunk' || 
                           element.tags?.ref?.includes('US-60') || 
                           element.tags?.ref?.includes('US 60') ||
                           element.tags?.name?.includes('US Highway 60') ||
                           element.tags?.name?.includes('US 60')) {
                    category = 'us_highway';
                    priority = 3;
                  } else if (element.tags?.ref?.includes('SR-87') || 
                           element.tags?.ref?.includes('AZ-87') || 
                           element.tags?.ref?.includes('87') ||
                           element.tags?.name?.includes('State Route 87') ||
                           element.tags?.name?.includes('Arizona 87') ||
                           element.tags?.name?.includes('SR 87')) {
                    category = 'state_highway';
                    priority = 2;
                  } else if (element.tags?.highway === 'primary') {
                    category = 'primary_road';
                    priority = 2;
                  } else if (element.tags?.highway === 'secondary') {
                    category = 'secondary_road';
                    priority = 1;
                  }
                  
                  highwayFeatures.push({
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    },
                    properties: {
                      osm_id: element.id,
                      osm_type: 'way',
                      name: element.tags?.name || 'Highway',
                      highway: element.tags?.highway || null,
                      ref: element.tags?.ref || null,
                      category: category,
                      priority: priority,
                      zone: corridorKey,
                      zone_name: corridor.name,
                      corridor: true
                    }
                  });
                }
              }
            });
          }
          
          zoneResults[corridorKey] = highwayFeatures;
          allFeatures.push(...highwayFeatures);
          console.log(`✅ Processed ${highwayFeatures.length} highway features from ${corridor.name}`);
          
          // Debug logging for Casa Grande specifically
          if (corridorKey === 'i10_casa_grande') {
            console.log(`🏜️ Casa Grande highway debug:`, {
              corridor: corridor.name,
              radius: corridor.radius,
              coordinates: [corridor.lat, corridor.lng],
              featuresFound: highwayFeatures.length,
              categories: highwayFeatures.reduce((acc, f) => {
                const cat = f.properties.category;
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
              }, {}),
              sampleFeatures: highwayFeatures.slice(0, 3).map(f => ({
                name: f.properties.name,
                category: f.properties.category,
                highway: f.properties.highway,
                ref: f.properties.ref
              }))
            });
          }
          
        } catch (error) {
          console.warn(`⚠️ Highway query failed for ${corridor.name}: ${error.message}`);
        }
        
        // Small delay between highway queries
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Fallback: Simple road query for Casa Grande if no roads found
      const casaGrandeRoads = allFeatures.filter(f => f.properties.zone === 'i10_casa_grande');
      if (casaGrandeRoads.length === 0) {
        console.log('🛣️ No roads found in Casa Grande, trying fallback query...');
        
        const fallbackQuery = `
          [out:json][timeout:15];
          (
            way["highway"~"^(primary|secondary|tertiary|residential)$"](around:10000, 32.8795, -111.7573);
            way["highway"~"^(motorway|trunk)$"](around:15000, 32.8795, -111.7573);
          );
          out body;
          >;
          out skel qt;
        `;
        
        try {
          const fallbackData = await fetchOverpassJSON(fallbackQuery, { retriesPerEndpoint: 1, totalEndpoints: 2 });
          console.log(`🛣️ Fallback query found ${fallbackData.elements?.length || 0} elements`);
          
          if (fallbackData.elements && fallbackData.elements.length > 0) {
            const fallbackFeatures = [];
            fallbackData.elements.forEach(element => {
              if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
                const coordinates = element.nodes.map(nodeId => {
                  const node = fallbackData.elements.find(e => e.id === nodeId);
                  return node ? [node.lon, node.lat] : null;
                }).filter(coord => coord !== null);
                
                if (coordinates.length >= 2) {
                  let category = 'highway_access';
                  let priority = 2;
                  
                  if (element.tags?.highway === 'motorway' || element.tags?.highway === 'trunk') {
                    category = 'interstate';
                    priority = 3;
                  } else if (element.tags?.highway === 'primary') {
                    category = 'primary_road';
                    priority = 2;
                  } else if (element.tags?.highway === 'secondary') {
                    category = 'secondary_road';
                    priority = 1;
                  }
                  
                  fallbackFeatures.push({
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    },
                    properties: {
                      osm_id: element.id,
                      osm_type: 'way',
                      name: element.tags?.name || 'Road',
                      highway: element.tags?.highway || null,
                      ref: element.tags?.ref || null,
                      category: category,
                      priority: priority,
                      zone: 'i10_casa_grande',
                      zone_name: 'I-10 Casa Grande Corridor',
                      corridor: true,
                      fallback: true
                    }
                  });
                }
              }
            });
            
            if (fallbackFeatures.length > 0) {
              allFeatures.push(...fallbackFeatures);
              zoneResults['i10_casa_grande_fallback'] = fallbackFeatures;
              console.log(`✅ Fallback added ${fallbackFeatures.length} road features to Casa Grande`);
            }
          }
        } catch (error) {
          console.warn('⚠️ Fallback road query failed:', error.message);
        }
      }
      
      console.log(`🏜️ Total Pinal County infrastructure features found: ${allFeatures.length}`);
      
      // Calculate Pinal County analysis metrics
      const enhancedFeatures = calculatePinalMetrics(allFeatures);
         
         // Update feedback for data processing
         if (updateToolFeedback) {
           updateToolFeedback({
             isActive: true,
             tool: 'osm',
          status: '🏗️ Processing Pinal County infrastructure data...',
             progress: 85,
          details: `Processed ${enhancedFeatures.length} features across ${Object.keys(PINAL_ZONES).length} zones. Calculating development metrics...`
           });
         }
         
      // Enhanced data broadcasting with Pinal County analysis results
         if (window.mapEventBus) {
        const analysisResults = {
          features: enhancedFeatures,
          timestamp: Date.now(),
          zones_queried: Object.keys(PINAL_ZONES),
          zone_results: zoneResults,
          summary: {
            office_building: enhancedFeatures.filter(f => f.properties.category === 'office_building').length,
            commercial_building: enhancedFeatures.filter(f => f.properties.category === 'commercial_building').length,
            retail_building: enhancedFeatures.filter(f => f.properties.category === 'retail_building').length,
            government_facility: enhancedFeatures.filter(f => f.properties.category === 'government_facility').length,
            education: enhancedFeatures.filter(f => f.properties.category === 'education').length,
            healthcare: enhancedFeatures.filter(f => f.properties.category === 'healthcare').length,
            service_amenity: enhancedFeatures.filter(f => f.properties.category === 'service_amenity').length,
            emergency_services: enhancedFeatures.filter(f => f.properties.category === 'emergency_services').length,
            transit_hub: enhancedFeatures.filter(f => f.properties.category === 'transit_hub').length,
            highway_access: enhancedFeatures.filter(f => f.properties.category === 'highway_access').length,
            recreation_area: enhancedFeatures.filter(f => f.properties.category === 'recreation_area').length,
            industrial: enhancedFeatures.filter(f => f.properties.category === 'industrial').length,
            high_development_potential: enhancedFeatures.filter(f => f.properties.development_score > 75).length
          },
          pinal_insights: {
            casa_grande_proximity: enhancedFeatures.filter(f => f.properties.distance_to_casa_grande < 5000).length, // Within 5km of Casa Grande
            florence_proximity: enhancedFeatures.filter(f => f.properties.distance_to_florence < 5000).length, // Within 5km of Florence
            high_development_potential: enhancedFeatures.filter(f => f.properties.development_score > 75).length,
            total_commercial_development: enhancedFeatures.filter(f => f.properties.category.includes('commercial') || f.properties.category.includes('office') || f.properties.category.includes('retail')).length,
            high_priority_features: enhancedFeatures.filter(f => f.properties.priority === 3).length
          }
        };
        
        // Cache the results (compressed)
        saveCachedData(analysisResults);
        
        // Save to local JSON file for Pinal County area
        saveToLocalPinalFile(analysisResults);
        
        window.mapEventBus.emit('pinal:analysisComplete', analysisResults);
        window.mapEventBus.emit('osm:dataLoaded', analysisResults); // Keep backward compatibility
      }
      
      // Detailed breakdown of Pinal County infrastructure found
         const categoryBreakdown = {};
      enhancedFeatures.forEach(feature => {
           const cat = feature.properties.category;
           categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
         });
         
      console.log('📊 Pinal County Infrastructure breakdown:', categoryBreakdown);
      console.log('🔍 High-priority features by category:');
         Object.keys(categoryBreakdown).forEach(cat => {
        const sample = enhancedFeatures.find(f => f.properties.category === cat && f.properties.priority === 3);
           if (sample) {
          console.log(`  ${cat}: ${sample.properties.name} (${sample.properties.osm_id}) - Zone: ${sample.properties.zone_name}`);
        }
      });
      
      return enhancedFeatures;
    } catch (error) {
      console.error('❌ Error fetching Pinal County infrastructure from OSM:', error);
      throw error;
    }
  };

  // Function to add Pinal County boundary to the map
  const addPinalCountyBoundaryToMap = async (boundaryData) => {
    if (!boundaryData || !map.current) {
      console.warn('⚠️ No boundary data or map available');
      return;
    }

    try {
      console.log('🗺️ Adding Pinal County boundary to map...');
      
      // Remove existing boundary layers if they exist
      const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
      boundaryLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      if (map.current.getSource('pinal-county-boundary')) {
        map.current.removeSource('pinal-county-boundary');
      }
      
      // Add boundary source
      map.current.addSource('pinal-county-boundary', {
        type: 'geojson',
        data: boundaryData
      });
      
      // Add boundary fill layer (semi-transparent)
      map.current.addLayer({
        id: 'pinal-county-boundary-fill',
        type: 'fill',
        source: 'pinal-county-boundary',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.1
        }
      });
      
      // Add boundary line layer
      map.current.addLayer({
        id: 'pinal-county-boundary-line',
        type: 'line',
        source: 'pinal-county-boundary',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8
        }
      });
      
      console.log('✅ Pinal County boundary added to map successfully');
      
    } catch (error) {
      console.error('❌ Error adding Pinal County boundary to map:', error);
    }
  };

  // Function to add particle animations to roads
  const addRoadParticles = (map, features) => {
    console.log('🚀 Setting up road particle system...');
    
    // Filter road features (LineString geometries) - only main roads for particles
    const roadFeatures = features.filter(f => 
      f.geometry.type === 'LineString' && 
      ['interstate', 'us_highway', 'state_highway', 'primary_road'].includes(f.properties.category)
    );
    
    if (roadFeatures.length === 0) {
      console.log('⚠️ No road features found for particle animation');
      return;
    }
    
    console.log(`🛣️ Found ${roadFeatures.length} road features for particle animation`);
    
    // Create particle source
    if (!map.getSource('road-particles-source')) {
      map.addSource('road-particles-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    
    // Create particle layer
    if (!map.getLayer('road-particles-layer')) {
      map.addLayer({
        id: 'road-particles-layer',
        type: 'circle',
        source: 'road-particles-source',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.4,   // very small when fully zoomed out
            6, 0.8,
            10, 1.4,
            14, 2.0,  // original size around city zoom
            18, 2.6
          ],
          'circle-color': '#FFD700', // Yellow particles
          'circle-opacity': 0.8,
          'circle-stroke-width': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.2,
            6, 0.35,
            10, 0.6,
            14, 0.9,
            18, 1.2
          ],
          'circle-stroke-color': '#FFA500', // Orange stroke
          'circle-blur': 0.2
        }
      });
    }
    
    // Animation state
    let animationFrame = null;
    let isAnimating = false;
    
    const animateParticles = () => {
      if (!isAnimating) return;
      
      const now = Date.now();
      const particleCount = Math.min(60, roadFeatures.length * 2); // Max 60 particles
      const features = [];
      
      // Generate particles for each road
      roadFeatures.forEach((roadFeature, roadIndex) => {
        const coords = roadFeature.geometry.coordinates;
        if (coords.length < 2) return;
        
        // Calculate how many particles for this road
        const particlesForThisRoad = Math.max(1, Math.floor(particleCount / roadFeatures.length));
        
        for (let i = 0; i < particlesForThisRoad; i++) {
          // Calculate particle position along the road
          const progress = ((now * 0.00008) + (i / particlesForThisRoad) + (roadIndex * 0.1)) % 1;
          const idx = Math.floor(progress * (coords.length - 1));
          const nextIdx = (idx + 1) % coords.length;
          const frac = (progress * (coords.length - 1)) % 1;
          
          // Linear interpolation between coordinates
          const pos = [
            coords[idx][0] + (coords[nextIdx][0] - coords[idx][0]) * frac,
            coords[idx][1] + (coords[nextIdx][1] - coords[idx][1]) * frac
          ];
          
          features.push({
            type: 'Feature',
            properties: {
              roadId: roadFeature.properties.osm_id,
              roadType: roadFeature.properties.category,
              particleId: `${roadIndex}-${i}`
            },
            geometry: { type: 'Point', coordinates: pos }
          });
        }
      });
      
      // Update particle positions
      map.getSource('road-particles-source').setData({
        type: 'FeatureCollection',
        features
      });
      
      animationFrame = requestAnimationFrame(animateParticles);
    };
    
    // Start animation
    isAnimating = true;
    animateParticles();
    
    console.log('✅ Road particle system started');
    
    // Return cleanup function
    return () => {
      isAnimating = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (map.getLayer('road-particles-layer')) {
        map.removeLayer('road-particles-layer');
      }
      if (map.getSource('road-particles-source')) {
        map.removeSource('road-particles-source');
      }
      console.log('🧹 Road particle system cleaned up');
    };
  };

  // Function to add Pinal County infrastructure to map with enhanced styling
  const addPinalInfrastructureToMap = async (features, marker) => {
    try {
      if (features.length === 0) {
        console.log('⚠️ No Pinal County infrastructure features found');
        return;
      }
      
      // Helper: simple opacity animator for Mapbox paint properties
      const animateOpacity = (layerId, paintProperty, target, duration = 800) => {
        if (!map?.current?.getLayer(layerId)) return;
        try {
          const steps = Math.max(1, Math.floor(duration / 16));
          const from = 0;
          let currentStep = 0;
          const tick = () => {
            if (!map?.current?.getLayer(layerId)) return;
            currentStep += 1;
            const t = Math.min(1, currentStep / steps);
            const value = from + (target - from) * t;
            map.current.setPaintProperty(layerId, paintProperty, value);
            if (t < 1) {
              requestAnimationFrame(tick);
            }
          };
          // Initialize to 0 first
          map.current.setPaintProperty(layerId, paintProperty, 0);
          requestAnimationFrame(tick);
        } catch (e) {
          console.warn(`⚠️ Animation failed for ${layerId}:${paintProperty}`, e);
        }
      };

      // Remove any existing OSM layers and sources
      const layersToRemove = [
        'osm-features-fill',
        'osm-features-lines', 
        'osm-pois',
        'osm-roads',
        'osm-highway-junctions',
        'road-particles-layer'
      ];
      
      layersToRemove.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      // Remove sources after layers are removed
         if (map.current.getSource('osm-features')) {
           map.current.removeSource('osm-features');
         }
         if (map.current.getSource('road-particles-source')) {
           map.current.removeSource('road-particles-source');
         }
         
      // Remove any existing search radius circles
      Object.keys(PINAL_ZONES).forEach(zoneKey => {
        if (map.current.getLayer(`pinal-zone-${zoneKey}-fill`)) {
          map.current.removeLayer(`pinal-zone-${zoneKey}-fill`);
        }
        if (map.current.getLayer(`pinal-zone-${zoneKey}-circle`)) {
          map.current.removeLayer(`pinal-zone-${zoneKey}-circle`);
        }
        if (map.current.getSource(`pinal-zone-${zoneKey}`)) {
          map.current.removeSource(`pinal-zone-${zoneKey}`);
        }
      });
      
      // Add Pinal County infrastructure features to the map
      const pinalGeoJSON = {
           type: 'FeatureCollection',
        features: features
         };
         
      // Check if source already exists before adding
      if (!map.current.getSource('osm-features')) {
         map.current.addSource('osm-features', {
           type: 'geojson',
          data: pinalGeoJSON
         });
      } else {
        // Update existing source data
        map.current.getSource('osm-features').setData(pinalGeoJSON);
      }
         
      // Add line layer for all features with Pinal County-specific colors (fade-in)
      if (!map.current.getLayer('osm-features-lines')) {
        map.current.addLayer({
          id: 'osm-features-lines',
          type: 'line',
          source: 'osm-features',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'category'], 'office_building'], '#059669',
              ['==', ['get', 'category'], 'commercial_building'], '#0ea5e9',
              ['==', ['get', 'category'], 'retail_building'], '#3b82f6',
              ['==', ['get', 'category'], 'government_facility'], '#dc2626',
              ['==', ['get', 'category'], 'education'], '#7c3aed',
              ['==', ['get', 'category'], 'healthcare'], '#ef4444',
              ['==', ['get', 'category'], 'service_amenity'], '#f59e0b',
              ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
              ['==', ['get', 'category'], 'transit_hub'], '#10b981',
              ['==', ['get', 'category'], 'highway_access'], '#6b7280',
              ['==', ['get', 'category'], 'recreation_area'], '#22c55e',
              ['==', ['get', 'category'], 'industrial'], '#8b5cf6',
              '#6b7280'
            ],
            'line-width': [
              'case',
              ['==', ['get', 'priority'], 3], 3,
              ['==', ['get', 'priority'], 2], 2,
              1
            ],
            'line-opacity': 0
          }
        });
      }
         
      // Add fill layer for polygons with Pinal County-specific colors (fade-in)
      if (!map.current.getLayer('osm-features-fill')) {
        map.current.addLayer({
          id: 'osm-features-fill',
          type: 'fill',
          source: 'osm-features',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'category'], 'office_building'], 'rgba(5, 150, 105, 0.2)',
              ['==', ['get', 'category'], 'commercial_building'], 'rgba(14, 165, 233, 0.2)',
              ['==', ['get', 'category'], 'retail_building'], 'rgba(59, 130, 246, 0.2)',
              ['==', ['get', 'category'], 'government_facility'], 'rgba(220, 38, 38, 0.2)',
              ['==', ['get', 'category'], 'education'], 'rgba(124, 58, 237, 0.2)',
              ['==', ['get', 'category'], 'healthcare'], 'rgba(239, 68, 68, 0.2)',
              ['==', ['get', 'category'], 'service_amenity'], 'rgba(245, 158, 11, 0.2)',
              ['==', ['get', 'category'], 'emergency_services'], 'rgba(220, 38, 38, 0.2)',
              ['==', ['get', 'category'], 'recreation_area'], 'rgba(34, 197, 94, 0.2)',
              ['==', ['get', 'category'], 'industrial'], 'rgba(139, 92, 246, 0.2)',
              'rgba(107, 114, 128, 0.05)'
            ],
            'fill-opacity': 0
          }
        });
      }
         
      // Add POI markers for points with priority-based sizing (fade-in)
      if (!map.current.getLayer('osm-pois')) {
        map.current.addLayer({
          id: 'osm-pois',
          type: 'circle',
          source: 'osm-features',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'priority'], 3], 8,
              ['==', ['get', 'priority'], 2], 6,
              4
            ],
            'circle-color': [
              'case',
              ['==', ['get', 'category'], 'government_facility'], '#dc2626',
              ['==', ['get', 'category'], 'education'], '#7c3aed',
              ['==', ['get', 'category'], 'healthcare'], '#ef4444',
              ['==', ['get', 'category'], 'service_amenity'], '#f59e0b',
              ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
              ['==', ['get', 'category'], 'transit_hub'], '#10b981',
              '#059669'
            ],
            'circle-opacity': 0
          }
        });
      }

      // Add dedicated road layer for better road visualization
      if (!map.current.getLayer('osm-roads')) {
        map.current.addLayer({
          id: 'osm-roads',
          type: 'line',
          source: 'osm-features',
          filter: ['in', ['get', 'category'], ['literal', ['highway_access', 'interstate', 'us_highway', 'state_highway', 'primary_road', 'secondary_road']]],
          paint: {
            'line-color': '#FFD700', // Yellow for all roads
            'line-width': [
              'case',
              ['==', ['get', 'category'], 'interstate'], 1.1, // thinner interstates
              ['==', ['get', 'category'], 'us_highway'], 1.0, // thinner US highways
              ['==', ['get', 'category'], 'state_highway'], 0.9, // thinner state highways
              ['==', ['get', 'category'], 'primary_road'], 0.8, // thinner primary roads
              ['==', ['get', 'category'], 'secondary_road'], 0.65, // thinner secondary roads
              ['==', ['get', 'highway'], 'motorway'], 1.0,
              ['==', ['get', 'highway'], 'trunk'], 0.9,
              ['==', ['get', 'highway'], 'primary'], 0.8,
              ['==', ['get', 'highway'], 'secondary'], 0.65,
              ['==', ['get', 'highway'], 'tertiary'], 0.55,
              ['==', ['get', 'highway'], 'residential'], 0.4,
              0.35
            ],
            'line-opacity': 0
          }
        });
      }

      // Add highway junctions layer for major intersections
      if (!map.current.getLayer('osm-highway-junctions')) {
        map.current.addLayer({
          id: 'osm-highway-junctions',
          type: 'circle',
          source: 'osm-features',
          filter: ['==', ['get', 'category'], 'highway_junction'],
          paint: {
            'circle-radius': 8,
            'circle-color': '#dc2626', // Red for highway junctions
            'circle-opacity': 0
          }
        });
      }
      
      console.log('✅ Added', features.length, 'Pinal County infrastructure features to map');
      
      // Add particle system for roads
      addRoadParticles(map.current, features);
      console.log('🗺️ Pinal County GeoJSON:', pinalGeoJSON);

      // === Add key sites from site.md (with live logs) ===
      try {
        console.log('🏷️ Resolving coordinates for key sites...', { count: PINAL_SITES.length });
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'sites',
            status: '📍 Loading site coordinates...',
            progress: 30,
            details: `Checking cache for ${PINAL_SITES.length} sites`
          });
        }

        // Prefer seeded coordinates if present by writing them into cache first
        const sitesWithSeeds = PINAL_SITES.map(s => ({ ...s }));
        // Write seeds to cache for entries with lat/lng provided
        for (const s of sitesWithSeeds) {
          if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
            try {
              const { seedKnownCoordinates } = await import('../../../../utils/geocodeSites');
              seedKnownCoordinates(s, s.lat, s.lng, { provenanceURLs: [], confidence: 0.95 });
              // Seeded coordinates logging removed for cleaner console
            } catch (e) {
              console.warn('⚠️ Failed to seed coordinates for', s.id, e);
            }
          }
        }

        const resolvedSites = await resolveCoordinatesForSites(sitesWithSeeds, { forceRefresh: false, parallelLimit: 1 });
        console.log('📍 Geocoding results:', resolvedSites);

        const validSites = resolvedSites.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
        const unresolvedSites = resolvedSites.filter(s => !Number.isFinite(s.lat) || !Number.isFinite(s.lng));
        console.log(`✅ Sites with coordinates: ${validSites.length}, ❌ unresolved: ${unresolvedSites.length} (Lucid excluded from markers - circle only)`);

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'sites',
            status: '🗺️ Adding key sites to map...',
            progress: 60,
            details: `Resolved ${validSites.length} sites; ${unresolvedSites.length} pending`
          });
        }

        if (validSites.length > 0) {
          // Clean any prior vector layer approach
          try {
            if (map.current.getLayer('pinal-sites-layer')) map.current.removeLayer('pinal-sites-layer');
          } catch (e) {}
          try {
            if (map.current.getSource('pinal-sites')) map.current.removeSource('pinal-sites');
          } catch (e) {}

          // Remove any previous DOM markers
          try {
            if (typeof window !== 'undefined' && window.pinalSiteMarkers) {
              Object.values(window.pinalSiteMarkers).forEach(m => { try { m.remove(); } catch(e) {} });
            }
          } catch (e) {}
          if (typeof window !== 'undefined') window.pinalSiteMarkers = {};

          // Create DOM emoji markers (red) for each site, consistent style with towns but red
          // Filter out Lucid site as it will only have the circle (no marker)
          validSites.filter(site => site.id !== 'lucid-motors-casa-grande').forEach(site => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.width = '26px';
            el.style.height = '26px';
            el.style.borderRadius = '50%';
            el.style.background = 'rgba(239, 68, 68, 0.95)'; // red
            el.style.border = 'none';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
            el.style.cursor = 'pointer';
            el.style.userSelect = 'none';
            el.title = site.name;

            const provenance = Array.isArray(site.provenanceURLs) ? site.provenanceURLs : [];
            
            const marker = new mapboxgl.Marker(el)
              .setLngLat([site.lng, site.lat])
              .setPopup(new mapboxgl.Popup().setHTML(`
                <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: rgba(17,24,39,0.96); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
                  <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${site.name}</div>
                    <div style="font-size: 11px; color: #9ca3af;">${site.city || ''}${site.city ? ', ' : ''}${site.state || ''}</div>
                  </div>
                  <div style="padding: 10px 12px; font-size: 11px; color: #cbd5e1; line-height: 1.5;">
                    <div>Provider: <strong style="color:#f3f4f6;">${site.provider}</strong> | Confidence: <strong style="color:#f3f4f6;">${(Number(site.confidence) * 100).toFixed(0)}%</strong></div>
                    <div>Last Verified: <span style="color:#e5e7eb;">${new Date(site.lastVerified).toLocaleString()}</span></div>
                    ${provenance.length ? `<div style="margin-top:6px;">Provenance: ${provenance.map(u => `<a href="${u}" target="_blank" rel="noreferrer" style="color:#60a5fa;">link</a>`).join(' · ')}</div>` : ''}
                  </div>
                </div>
              `))
              .addTo(map.current);


            if (typeof window !== 'undefined') {
              window.pinalSiteMarkers[site.id] = marker;
            }
          });

          // Add pulsing red circle around Lucid marker specifically
          const lucidSite = validSites.find(site => site.id === 'lucid-motors-casa-grande');
          if (lucidSite) {
            console.log('🚗 Adding pulsing red circle around Lucid marker...');
            
            // Remove existing Lucid pulse layer if it exists
            if (map.current.getLayer('lucid-site-pulse')) {
              map.current.removeLayer('lucid-site-pulse');
            }
            if (map.current.getSource('lucid-site-pulse')) {
              map.current.removeSource('lucid-site-pulse');
            }

            // Create pulsing circle with animation properties
            const radiusKm = 1.4; // 1.4km radius circle (30% smaller than 2.0km)
            const pulseCircle = turf.circle([lucidSite.lng, lucidSite.lat], radiusKm, { 
              steps: 80, 
              units: 'kilometers',
              properties: { 
                name: 'Lucid Site Pulse Circle',
                pulse: 0 // Initial pulse value for animation
              }
            });

            // Static circle source removed - only pulsing fill will be visible

            // Add pulse source (animated fill) with proper data structure
            map.current.addSource('lucid-site-pulse', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [pulseCircle]
              }
            });

            // Static circle layer removed - only pulsing fill will be visible

            // Add pulsing fill layer (opacity will be animated via JavaScript)
            map.current.addLayer({
              id: 'lucid-site-pulse',
              type: 'fill',
              source: 'lucid-site-pulse',
              paint: {
                'fill-color': '#3b82f6', // Blue color
                'fill-opacity': 0.05 // Initial opacity, will be animated
              },
              layout: { visibility: 'visible' },
              maxzoom: 18 // Keep visible at higher zoom levels
            });

            // Start pulse animation using paint property updates (more reliable)
            let pulseValue = 0;
            const pulseSpeed = 0.001; // 16.67 second cycle (much slower)
            let animationId = null;
            // Frame count removed as it's no longer used
            
            const pulseAnimation = () => {
              try {
                // Increment pulse value
                pulseValue = (pulseValue + pulseSpeed) % 1;
                
                // Update the fill opacity directly using paint properties
                if (map.current.getLayer('lucid-site-pulse')) {
                  // Calculate opacity based on pulse value (0 to 1) - ensure it's always positive
                  // Use absolute value of sine wave to avoid negative values
                  const sineValue = Math.abs(Math.sin(pulseValue * Math.PI * 2));
                  const opacity = 0.05 + (sineValue * 0.15); // Reduced range - half the peak values
                  
                  // Debug logging removed for cleaner console
                  
                  // Update paint property directly
                  map.current.setPaintProperty('lucid-site-pulse', 'fill-opacity', opacity);
                } else {
                  console.warn('⚠️ Lucid pulse layer not found!');
                  if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                  }
                  return;
                }
                
                // Continue animation
                animationId = requestAnimationFrame(pulseAnimation);
              } catch (error) {
                console.warn('⚠️ Lucid pulse animation error:', error);
                // Stop animation on error
                if (animationId) {
                  cancelAnimationFrame(animationId);
                  animationId = null;
                }
              }
            };
            
            // Start the pulse animation after a short delay
            setTimeout(() => {
              animationId = requestAnimationFrame(pulseAnimation);
              // Store animation ID for cleanup after it's set
              if (typeof window !== 'undefined') {
                window.lucidPulseAnimationId = animationId;
              }
            }, 200);

            console.log('✅ Pulsing red circle added around Lucid marker');
            
            // Add blue teardrop marker for Lucid site
            const lucidMarker = new mapboxgl.Marker({
              color: '#3b82f6', // Blue color
              scale: 1.5
            })
            .setLngLat([lucidSite.lng, lucidSite.lat])
            .addTo(map.current);
            
            // Add click handler to emit marker:clicked event
            lucidMarker.getElement().addEventListener('click', () => {
              if (window.mapEventBus) {
                window.mapEventBus.emit('marker:clicked', {
                  id: 'lucid-motors-casa-grande',
                  name: 'Lucid Motors',
                  type: 'Electric Vehicle Manufacturing',
                  category: 'Advanced Manufacturing Facility',
                  coordinates: [lucidSite.lng, lucidSite.lat],
                  formatter: 'pinal',
                  zonesAnalyzed: 3,
                  cachedDataAvailable: !!cachedData,
                  analysisStatus: 'Manufacturing facility operational'
                });
              }
            });
            
            console.log('✅ Blue teardrop marker added for Lucid Motors');
            
            // Auto-trigger Lucid popup after a short delay
            setTimeout(() => {
              if (window.mapEventBus) {
                window.mapEventBus.emit('marker:clicked', {
                  id: 'lucid-motors-casa-grande',
                  name: 'Lucid Motors',
                  type: 'Electric Vehicle Manufacturing',
                  category: 'Advanced Manufacturing Facility',
                  coordinates: [lucidSite.lng, lucidSite.lat],
                  formatter: 'pinal',
                  zonesAnalyzed: 3,
                  cachedDataAvailable: !!cachedData,
                  analysisStatus: 'Manufacturing facility operational',
                  isAutomatic: true // Flag to indicate this is an automatic popup
                });
              }
            }, 4000); // 4 second delay after Lucid marker creation
          }

          console.log('✅ Added key site emoji markers:', validSites.filter(site => site.id !== 'lucid-motors-casa-grande').length);

          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'sites',
              status: '✅ Key sites added to map',
              progress: 100,
              details: `Markers: ${validSites.length}; unresolved: ${unresolvedSites.length}`
            });
          }
        } else {
          console.log('ℹ️ No valid site coordinates yet.');
        }
      } catch (e) {
        console.warn('⚠️ Failed to add key sites layer', e);
      }

      // Staged, animated reveal
      // 1) Polygons fade in first
      setTimeout(() => {
        animateOpacity('osm-features-fill', 'fill-opacity', 0.3, 700);
      }, 100);
      // 2) Then lines
      setTimeout(() => {
        animateOpacity('osm-features-lines', 'line-opacity', 0.8, 700);
      }, 500);
      // 3) Then roads
      setTimeout(() => {
        animateOpacity('osm-roads', 'line-opacity', 0.5, 600);
      }, 700);
      // 4) Then highway junctions
      setTimeout(() => {
        animateOpacity('osm-highway-junctions', 'circle-opacity', 1, 600);
      }, 800);
      // 5) Then points
      setTimeout(() => {
        animateOpacity('osm-pois', 'circle-opacity', 1, 600);
      }, 900);
         
         // Update feedback for map completion
         if (updateToolFeedback) {
           updateToolFeedback({
             isActive: true,
             tool: 'osm',
          status: '🗺️ Adding Pinal County infrastructure to map...',
             progress: 95,
          details: `Added ${features.length} features to map. Creating Pinal County zone visualization...`
           });
         }
         
      // Add Pinal County zone circles one-by-one (Casa Grande -> Florence -> Apache Junction) each loading separately
      const orderedZones = ['casa_grande', 'florence', 'apache_junction'];
      const zoneBaseStartDelay = 1200; // wait for feature layers reveal first
      const perZoneDelay = 600; // delay between zones

      orderedZones.forEach((zoneKey, index) => {
        const zone = PINAL_ZONES[zoneKey];
        const startDelay = zoneBaseStartDelay + index * perZoneDelay;

        setTimeout(() => {
          const zoneCircle = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [generateCircleCoordinates(zone.lat, zone.lng, zone.radius / 1000, 64)]
            },
            properties: {
              name: zone.name,
              category: 'fifa_zone',
              zone: zoneKey,
              focus: zone.focus
            }
          };

          // Add zone source
          if (!map.current.getSource(`pinal-zone-${zoneKey}`)) {
            map.current.addSource(`pinal-zone-${zoneKey}`, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [zoneCircle]
              }
            });
          } else {
            map.current.getSource(`pinal-zone-${zoneKey}`).setData({
              type: 'FeatureCollection',
              features: [zoneCircle]
            });
          }

          // Add circle line (invisible)
          if (!map.current.getLayer(`pinal-zone-${zoneKey}-circle`)) {
            map.current.addLayer({
              id: `pinal-zone-${zoneKey}-circle`,
              type: 'line',
              source: `pinal-zone-${zoneKey}`,
              paint: {
                'line-color': [
                  'case',
                  ['==', ['get', 'zone'], 'casa_grande'], '#059669',
                  ['==', ['get', 'zone'], 'florence'], '#7c3aed',
                  '#0ea5e9'
                ],
                'line-width': 3,
                'line-dasharray': [6, 3],
                'line-opacity': 0
              }
            });
          }

          // Add circle fill (invisible)
          if (!map.current.getLayer(`pinal-zone-${zoneKey}-fill`)) {
            map.current.addLayer({
              id: `pinal-zone-${zoneKey}-fill`,
              type: 'fill',
              source: `pinal-zone-${zoneKey}`,
              paint: {
                'fill-color': [
                  'case',
                  ['==', ['get', 'zone'], 'casa_grande'], 'rgba(5, 150, 105, 0.1)',
                  ['==', ['get', 'zone'], 'florence'], 'rgba(124, 58, 237, 0.1)',
                  'rgba(14, 165, 233, 0.1)'
                ],
                'fill-opacity': 0
              }
            });
          }

          // Animate this zone's opacity in (skip Casa Grande circle to remove dashed green circle)
          if (zoneKey !== 'casa_grande') {
            animateOpacity(`pinal-zone-${zoneKey}-circle`, 'line-opacity', 0.8, 600);
          }
          setTimeout(() => animateOpacity(`pinal-zone-${zoneKey}-fill`, 'fill-opacity', 0.2, 600), 120);
        }, startDelay);
      });
      
      // Calculate summary statistics for logging
      const governmentFacilities = features.filter(f => f.properties.category === 'government_facility').length;
      const highDevelopment = features.filter(f => f.properties.development_score > 75).length;
      
      // Log analysis completion (popup now handled by custom MarkerPopupCard)
      console.log(`✅ Pinal County analysis complete: ${features.length} features, ${governmentFacilities} government facilities, ${highDevelopment} high development potential`);
      
    } catch (error) {
      console.error('❌ Error adding Pinal County infrastructure to map:', error);
      throw error;
    }
  };

  const handleClick = async (event) => {
    if (isLoading) return;
    
    // Check if user wants to force refresh (Ctrl+Click or Shift+Click)
    const forceRefresh = event.ctrlKey || event.shiftKey;
    
    // Clear previous OSM data from legend (but preserve cache)
    if (window.mapEventBus) {
      window.mapEventBus.emit('osm:dataCleared');
      window.mapEventBus.emit('pinal:analysisCleared');
      window.mapEventBus.emit('osm:loading');
    }
    
    // Don't clear the cache here - only clear it on force refresh
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - clearing cache and fetching fresh data');
      clearCache();
    }
    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    try {
      const city = 'Pinal County';
      const state = 'AZ';
      
      // Analysis button click logging removed for cleaner console
      
      // Start Pinal County analysis feedback
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '🚀 Starting Pinal County infrastructure analysis...',
          progress: 10,
          details: `Analyzing infrastructure across ${Object.keys(PINAL_ZONES).length} Pinal County zones in ${city}, ${state}`
        });
      }
      
      // Call the original onClick if provided
      if (onClick) {
        onClick('Pinal County Infrastructure Analysis');
      }
      
      // Toggle on Lucid Motors layer when Pinal County analysis starts
      if (window.mapEventBus) {
        window.mapEventBus.emit('lucid:toggle', true);
      }
      
      // Toggle on Irrigation Districts and Well Registry layers when Pinal County analysis starts
      if (window.mapEventBus) {
        window.mapEventBus.emit('irrigation:toggle', true);
        window.mapEventBus.emit('well-registry:toggle', true);
      }
      
      // Toggle on Roads layer 1 second after the other toggles
      setTimeout(() => {
        if (window.mapEventBus) {
          window.mapEventBus.emit('main-roads:toggle', true);
        }
      }, 1000);
      
      // Phase 1: Create central marker for Casa Grande
      if (map?.current) {
        try {
          // Use Casa Grande coordinates as the central marker
          const casaGrande = PINAL_ZONES.casa_grande;
          const lat = casaGrande.lat;
          const lng = casaGrande.lng;
          
          // Remove any existing site marker
          if (map.current.getLayer('site-marker')) {
            map.current.removeLayer('site-marker');
          }
          
          if (map.current.getSource('site-marker')) {
            map.current.removeSource('site-marker');
          }
          
          // Remove any existing zone markers from previous runs
          try {
            if (typeof window !== 'undefined' && window.pinalZoneMarkers) {
              Object.values(window.pinalZoneMarkers).forEach(m => {
                try { m.remove(); } catch (e) {}
              });
              window.pinalZoneMarkers = {};
            }
          } catch (e) {
            // no-op
          }

          // Create a Pinal County-themed marker (Casa Grande) using utility function
          const marker = createCasaGrandeMarker(map.current, lng, lat, cachedData);
          
            // Auto-trigger Casa Grande popup after a short delay
            setTimeout(() => {
              if (window.mapEventBus) {
                window.mapEventBus.emit('marker:clicked', {
                  id: 'casa-grande-marker',
                  name: 'Casa Grande',
                  type: 'Pinal County Infrastructure',
                  category: 'Arizona Infrastructure Development',
                  coordinates: [lng, lat],
                  formatter: 'pinal',
                  zonesAnalyzed: 3,
                  cachedDataAvailable: !!cachedData,
                  analysisStatus: 'Analyzing infrastructure...',
                  isAutomatic: true // Flag to indicate this is an automatic popup
                });
              }
            }, 3000); // 3 second delay after Casa Grande marker creation
            
          // Analysis marker logging removed for cleaner console

          // Skip smaller pulse - only using the larger one

          // Add larger pulsing green circle around Casa Grande marker (triple radius)
          console.log('🏜️ Adding larger pulsing green circle around Casa Grande marker...');
          
          // Remove existing Casa Grande large pulse layer if it exists
          if (map.current.getLayer('casa-grande-pulse-large')) {
            map.current.removeLayer('casa-grande-pulse-large');
          }
          if (map.current.getSource('casa-grande-pulse-large')) {
            map.current.removeSource('casa-grande-pulse-large');
          }

          // Create larger pulsing circle with animation properties (triple radius)
          const largeRadiusKm = 4.2; // Triple the radius (3 * 1.4km)
          const casaGrandeLargePulseCircle = turf.circle([lng, lat], largeRadiusKm, { 
            steps: 80, 
            units: 'kilometers',
            properties: { 
              name: 'Casa Grande Large Pulse Circle',
              pulse: 0 // Initial pulse value for animation
            }
          });

          // Add large pulse source (animated fill) with proper data structure
          map.current.addSource('casa-grande-pulse-large', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [casaGrandeLargePulseCircle]
            }
          });

          // Add larger pulsing fill layer (opacity will be animated via JavaScript)
          map.current.addLayer({
            id: 'casa-grande-pulse-large',
            type: 'fill',
            source: 'casa-grande-pulse-large',
            paint: {
              'fill-color': '#10b981', // Same green color (emerald-500)
              'fill-opacity': 0.03 // Lower initial opacity for the larger circle
            },
            layout: { visibility: 'visible' },
            maxzoom: 18 // Keep visible at higher zoom levels
          });

          // Start large pulse animation using paint property updates
          let casaGrandeLargePulseValue = 0;
          const casaGrandeLargePulseSpeed = 0.0008; // Slightly slower for the larger circle
          let casaGrandeLargeAnimationId = null;
          
          const casaGrandeLargePulseAnimation = () => {
            try {
              // Increment pulse value
              casaGrandeLargePulseValue = (casaGrandeLargePulseValue + casaGrandeLargePulseSpeed) % 1;
              
              // Update the fill opacity directly using paint properties
              if (map.current.getLayer('casa-grande-pulse-large')) {
                // Calculate opacity based on pulse value (0 to 1) - ensure it's always positive
                // Use absolute value of sine wave to avoid negative values
                const sineValue = Math.abs(Math.sin(casaGrandeLargePulseValue * Math.PI * 2));
                const opacity = 0.03 + (sineValue * 0.12); // Lower range for the larger circle
                
                // Update paint property directly
                map.current.setPaintProperty('casa-grande-pulse-large', 'fill-opacity', opacity);
              } else {
                console.warn('⚠️ Casa Grande large pulse layer not found!');
                if (casaGrandeLargeAnimationId) {
                  cancelAnimationFrame(casaGrandeLargeAnimationId);
                  casaGrandeLargeAnimationId = null;
                }
                return;
              }
              
              // Continue animation
              casaGrandeLargeAnimationId = requestAnimationFrame(casaGrandeLargePulseAnimation);
            } catch (error) {
              console.warn('⚠️ Casa Grande large pulse animation error:', error);
              // Stop animation on error
              if (casaGrandeLargeAnimationId) {
                cancelAnimationFrame(casaGrandeLargeAnimationId);
                casaGrandeLargeAnimationId = null;
              }
            }
          };
          
          // Start the large pulse animation after a short delay
          setTimeout(() => {
            casaGrandeLargeAnimationId = requestAnimationFrame(casaGrandeLargePulseAnimation);
            // Store animation ID for cleanup
            if (typeof window !== 'undefined') {
              window.casaGrandeLargePulseAnimationId = casaGrandeLargeAnimationId;
            }
          }, 300); // Slightly longer delay to offset the animations

          console.log('✅ Larger pulsing green circle added around Casa Grande marker');

          // Initialize container for zone markers
          if (typeof window !== 'undefined') {
            if (!window.pinalZoneMarkers) window.pinalZoneMarkers = {};
          }

          // Schedule zone markers to load in sequence with circles
          const zoneBaseStartDelay = 1200; // matches zone circle base delay
          const perZoneDelay = 600; // matches per-zone delay

          // Florence marker (second)
          setTimeout(() => {
            try {
              const florence = PINAL_ZONES.florence;
              const florenceMarker = new mapboxgl.Marker({ color: '#7c3aed', scale: 1.2 })
                .setLngLat([florence.lng, florence.lat])
                .setPopup(new mapboxgl.Popup().setHTML(`
                  <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: rgba(17, 24, 39, 0.96); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
                    <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                      <div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">Florence</div>
                    </div>
                    <div style="padding: 10px 12px; font-size: 11px; color: #cbd5e1;">County seat & historic downtown</div>
                  </div>
                `))
                .addTo(map.current);
              if (window.pinalZoneMarkers) window.pinalZoneMarkers.florence = florenceMarker;
            } catch (e) {
              console.warn('⚠️ Could not add Florence marker:', e);
            }
          }, zoneBaseStartDelay + perZoneDelay + 150);

          // Apache Junction marker (third)
          setTimeout(() => {
            try {
              const apacheJunction = PINAL_ZONES.apache_junction;
              const apacheJunctionMarker = new mapboxgl.Marker({ color: '#0ea5e9', scale: 1.2 })
                .setLngLat([apacheJunction.lng, apacheJunction.lat])
                .setPopup(new mapboxgl.Popup().setHTML(`
                  <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: rgba(17, 24, 39, 0.96); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
                    <div style="background: linear-gradient(90deg, #111827 0%, #0b1220 100%); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                      <div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">Apache Junction</div>
                    </div>
                    <div style="padding: 10px 12px; font-size: 11px; color: #cbd5e1;">Northern gateway & transportation hub</div>
                  </div>
                `))
                .addTo(map.current);
              if (window.pinalZoneMarkers) window.pinalZoneMarkers.apache_junction = apacheJunctionMarker;
            } catch (e) {
              console.warn('⚠️ Could not add Apache Junction marker:', e);
            }
          }, zoneBaseStartDelay + perZoneDelay * 2 + 150);
            
          // Update feedback for Pinal County infrastructure analysis
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
              status: '🏜️ Analyzing Pinal County infrastructure...',
                progress: 60,
              details: `Querying OpenStreetMap for Pinal County infrastructure across ${Object.keys(PINAL_ZONES).length} zones`
            });
          }
          
          // Phase 2: Fetch Pinal County boundary
          // Phase logging removed for cleaner console
          const pinalBoundary = await fetchPinalCountyBoundary();
          
          // Phase 3: Fetch Pinal County infrastructure data
          // Phase logging removed for cleaner console
          const pinalFeatures = await fetchPinalInfrastructure(marker, !forceRefresh);
          
          // Phase 4: Add boundary and infrastructure to map
          // Phase logging removed for cleaner console
          if (pinalBoundary) {
            await addPinalCountyBoundaryToMap(pinalBoundary);
          }
          await addPinalInfrastructureToMap(pinalFeatures, marker);
            
            // Update feedback for completion
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
              status: '✅ Pinal County infrastructure analysis completed!',
                progress: 100,
              details: `Analyzed ${pinalFeatures.length} infrastructure features across ${Object.keys(PINAL_ZONES).length} zones.`
              });
            }
            
          // Fly to Casa Grande after analysis completes
          if (map?.current) {
            map.current.flyTo({
              center: [casaGrande.lng, casaGrande.lat],
              zoom: 12,
              pitch: 45,
              bearing: 0,
              duration: 2000
            });
            console.log('🏜️ Flying to Casa Grande after Pinal County analysis...');
          }
            
            // Clear feedback after a delay
            setTimeout(() => {
              if (updateToolFeedback) {
                updateToolFeedback({
                  isActive: false,
                  tool: null,
                  status: '',
                  progress: 0,
                  details: ''
                });
              }
          }, 4000);

          // Toggle on Casa Grande Tax Zones layer 4 seconds after analysis completes
          setTimeout(() => {
            if (window.mapEventBus) {
              window.mapEventBus.emit('casa-grande-boundary:toggle', true);
              console.log('🏙️ Auto-toggling Casa Grande Tax Zones layer on after analysis completion');
            }
          }, 4000);
            
        } catch (error) {
          console.error('❌ Error in Pinal County analysis:', error);
            
            // Update feedback for error
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
              status: '❌ Pinal County analysis failed',
                progress: 0,
              details: `Error: ${error.message}`
            });
            
            // Clear error feedback after delay
            setTimeout(() => {
              updateToolFeedback({
                isActive: false,
                tool: null,
                status: '',
                progress: 0,
                details: ''
              });
            }, 5000);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Pinal County Analysis Error:', error.message);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '❌ Pinal County analysis failed',
          progress: 0,
          details: `Error: ${error.message}`
        });
        
        // Clear error feedback after delay
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 5000);
      }
    } finally {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  // Add CSS animations for Pinal County analysis pulsing effects
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pinalButtonPulse {
        0% { 
          transform: scale(1);
          background-color: #059669;
        }
        50% { 
          transform: scale(1.1);
          background-color: #047857;
        }
        100% { 
          transform: scale(1);
          background-color: #059669;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);


  return (
    <div
      style={{
        position: 'relative',
        top: position?.top || '0px',
        left: position?.left || '0px',
        transform: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled ? 'rgba(0, 0, 0, 0.4)' : (isLoading ? '#059669' : (cachedData ? '#10b981' : (isHovered ? `${color}ee` : `${color}cc`))),
        border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : `1px solid ${color}40`,
        cursor: disabled ? 'not-allowed' : (isLoading ? 'default' : 'pointer'),
        boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isHovered 
          ? `0 2px 8px ${color}40` 
          : '0 1px 4px rgba(0, 0, 0, 0.2)'),
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px',
        opacity: disabled ? 0.6 : (isLoading ? 0.7 : 1),
        animation: disabled ? 'none' : (isLoading ? 'pinalButtonPulse 1.5s ease-out infinite' : 'none')
      }}
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={disabled ? 'Loading...' : (isLoading ? 'Analyzing Pinal County infrastructure...' : 
        cachedData ? `${title} (Cached - Ctrl+Click to refresh)` : `${title} (Click to analyze)`)}
    />
  );
};

// Global Pinal County cache controls (similar to OsmTool.js)
if (typeof window !== 'undefined') {
  window.debugPinalCache = () => {
    console.log('🔍 Pinal County Cache Debug:');
    console.log('  Cache key:', CACHE_KEY);
    console.log('  Cache expiration (minutes):', CACHE_DURATION / (60 * 1000));
    console.log('  Cache size:', globalPinalCache.size);
    console.log('  Cache entries:', Array.from(globalPinalCache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((Date.now() - entry.timestamp) / 1000 / 60),
      valid: (Date.now() - entry.timestamp) < CACHE_DURATION
    })));
    console.log('  Local file: /pinal-county-cache.json (place in public folder)');
  };
  
  window.clearPinalCache = () => {
    globalPinalCache.clear();
    console.log('🗑️ Pinal County Cache: Cleared all entries from global cache');
  };
  
  window.downloadPinalCache = () => {
    console.log('📁 Pinal County Cache: Run Pinal County analysis to download cache file');
    console.log('  The file will be saved as pinal-county-cache.json');
    console.log('  Place it in the public folder for instant loading');
  };
}

export default OSMCall;
