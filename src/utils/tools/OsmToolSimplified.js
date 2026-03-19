/**
 * OsmTool - Visual Power Infrastructure Mapping for ERCOT Analysis
 * 
 * FOCUSED ROLE: Provides clear visual mapping of power infrastructure within 6-mile radius
 * INTEGRATION: Complements SERP data with visual geographic context
 * PERFORMANCE: Optimized for sub-20 second execution with maximum visual impact
 */

import mapboxgl from 'mapbox-gl';

export class OsmTool {
  constructor(updateToolFeedback) {
    this.updateToolFeedback = updateToolFeedback;
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
    this.cacheKeyPrefix = 'osm_visual_context_';
  }

  /**
   * Execute OSM tool for visual power infrastructure mapping
   */
  async execute(queries, coordinates, map = null, locationConfig = null, serpData = null) {
    const { lat, lng } = coordinates;
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🗺️ Mapping power infrastructure...',
      progress: 30,
      details: `Visual analysis within 6-mile radius of ${locationConfig?.city || 'Austin'} power grid`
    });

    try {
      // Check cache first
      const cacheKey = this.generateSimpleCacheKey(coordinates, locationConfig);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        console.log('⚡ OSM: Using cached visual context');
        await this.addVisualLayersToMap(map, cached, lat, lng);
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '⚡ Cached visual context loaded',
          progress: 100,
          details: `Used cached power infrastructure map (${cached.features.length} features)`
        });
        
        return {
          success: true,
          tool: 'OSM',
          data: cached,
          cached: true,
          timestamp: Date.now()
        };
      }

      // Execute fresh visual analysis
      const result = await this.executeVisualPowerMapping(coordinates, map, locationConfig, serpData);
      
      // Cache the result
      this.saveToCache(cacheKey, result);
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '✅ Power infrastructure mapping completed',
        progress: 100,
        details: `Mapped ${result.features.length} power infrastructure features within 6-mile radius`
      });
      
      return {
        success: true,
        tool: 'OSM',
        data: result,
        cached: false,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.warn('⚠️ OSM visual mapping failed:', error.message);
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: 'OSM visual mapping failed - using fallback',
        progress: 100,
        details: `Error: ${error.message}. Analysis proceeding without visual context.`
      });
      
      return {
        success: false,
        tool: 'OSM',
        error: error.message,
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute focused visual power infrastructure mapping
   */
  async executeVisualPowerMapping(coordinates, map, locationConfig, serpData) {
    const { lat, lng } = coordinates;
    const visualRadius = 9656; // 6 miles in meters
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🔍 Querying power infrastructure...',
      progress: 50,
      details: 'Searching for visual power infrastructure within 6-mile radius'
    });

    // FOCUSED VISUAL QUERY - Optimized for performance and visual impact
    const query = `
      [out:json][timeout:20];
      (
        // POWER INFRASTRUCTURE (Visual Priority)
        node["power"="substation"](around:${visualRadius}, ${lat}, ${lng});
        node["power"="plant"](around:${visualRadius}, ${lat}, ${lng});
        node["power"="generator"](around:${visualRadius}, ${lat}, ${lng});
        way["power"="line"](around:${visualRadius}, ${lat}, ${lng});
        
        // MAJOR TRANSPORTATION (Visual Corridors)
        way["highway"~"motorway|trunk|primary"](around:${visualRadius}, ${lat}, ${lng});
        way["railway"="rail"](around:${visualRadius}, ${lat}, ${lng});
        
        // MAJOR WATER FEATURES (Visual Landmarks)
        way["natural"="water"](around:${visualRadius}, ${lat}, ${lng});
        way["waterway"="river"](around:${visualRadius}, ${lat}, ${lng});
        
        // INDUSTRIAL ZONES (Visual Context)
        way["landuse"="industrial"](around:${visualRadius}, ${lat}, ${lng});
        
        // CRITICAL INFRASTRUCTURE (Visual Reference Points)
        node["amenity"="hospital"](around:${visualRadius}, ${lat}, ${lng});
        node["amenity"="university"](around:${visualRadius}, ${lat}, ${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    // Execute query with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

    try {
      const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSM API error: ${response.status}`);
      }

      const osmData = await response.json();
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '🎨 Creating visual map layers...',
        progress: 80,
        details: `Processing ${osmData.elements?.length || 0} visual elements`
      });

      // Process into visual features
      const visualFeatures = this.processVisualFeatures(osmData);
      
      // Add to map
      if (map?.current) {
        await this.addVisualLayersToMap(map, visualFeatures, lat, lng);
      }

      return {
        features: visualFeatures.features,
        powerInfrastructure: visualFeatures.powerInfrastructure,
        visualLayers: visualFeatures.visualLayers,
        message: `Mapped ${visualFeatures.features.length} visual power infrastructure features`
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Process OSM data into visual features for power grid analysis
   */
  processVisualFeatures(osmData) {
    const features = [];
    const powerInfrastructure = [];
    const visualLayers = {
      transmission: [],
      substations: [],
      powerPlants: [],
      transportation: [],
      water: [],
      industrial: [],
      critical: []
    };

    if (!osmData.elements) {
      return { features, powerInfrastructure, visualLayers };
    }

    osmData.elements.forEach(element => {
      if (element.type === 'node') {
        this.processVisualNode(element, features, visualLayers);
      } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
        this.processVisualWay(element, osmData.elements, features, visualLayers);
      }
    });

    // Extract power infrastructure for analysis
    powerInfrastructure.push(...visualLayers.substations, ...visualLayers.powerPlants);

    console.log('🗺️ OSM Visual Features:', {
      transmission: visualLayers.transmission.length,
      substations: visualLayers.substations.length,
      powerPlants: visualLayers.powerPlants.length,
      transportation: visualLayers.transportation.length,
      water: visualLayers.water.length,
      industrial: visualLayers.industrial.length,
      critical: visualLayers.critical.length,
      total: features.length
    });

    return { features, powerInfrastructure, visualLayers };
  }

  /**
   * Process visual nodes (power infrastructure, critical facilities)
   */
  processVisualNode(element, features, visualLayers) {
    if (!element.tags) return;

    let category = null;
    let visualLayer = null;

    // Power infrastructure (highest visual priority)
    if (element.tags.power === 'substation') {
      category = 'power_substation';
      visualLayer = 'substations';
    } else if (element.tags.power === 'plant') {
      category = 'power_plant';
      visualLayer = 'powerPlants';
    } else if (element.tags.power === 'generator') {
      category = 'power_generator';
      visualLayer = 'powerPlants';
    } else if (element.tags.amenity === 'hospital') {
      category = 'critical_infrastructure';
      visualLayer = 'critical';
    } else if (element.tags.amenity === 'university') {
      category = 'critical_infrastructure';
      visualLayer = 'critical';
    }

    if (category && visualLayer) {
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [element.lon, element.lat]
        },
        properties: {
          osm_id: element.id,
          name: element.tags.name || category.replace('_', ' '),
          category: category,
          power: element.tags.power,
          voltage: element.tags.voltage,
          amenity: element.tags.amenity
        }
      };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
    }
  }

  /**
   * Process visual ways (transmission lines, roads, water, zones)
   */
  processVisualWay(element, allElements, features, visualLayers) {
    if (!element.tags) return;

    const coordinates = element.nodes.map(nodeId => {
      const node = allElements.find(e => e.id === nodeId);
      return node ? [node.lon, node.lat] : null;
    }).filter(coord => coord !== null);

    if (coordinates.length < 2) return;

    let category = null;
    let visualLayer = null;
    let geometryType = 'LineString';

    // Visual categorization for map display
    if (element.tags.power === 'line') {
      category = 'transmission_line';
      visualLayer = 'transmission';
    } else if (element.tags.highway) {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.railway === 'rail') {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.natural === 'water' || element.tags.waterway) {
      category = 'water_feature';
      visualLayer = 'water';
      if (element.tags.natural === 'water') {
        geometryType = 'Polygon';
        if (coordinates[0] !== coordinates[coordinates.length - 1]) {
          coordinates.push(coordinates[0]);
        }
      }
    } else if (element.tags.landuse === 'industrial') {
      category = 'industrial_zone';
      visualLayer = 'industrial';
      geometryType = 'Polygon';
      if (coordinates[0] !== coordinates[coordinates.length - 1]) {
        coordinates.push(coordinates[0]);
      }
    }

    if (category && visualLayer) {
      const geometry = geometryType === 'Polygon' ? 
        { type: 'Polygon', coordinates: [coordinates] } :
        { type: 'LineString', coordinates: coordinates };

      const feature = {
        type: 'Feature',
        geometry: geometry,
        properties: {
          osm_id: element.id,
          name: element.tags.name || category.replace('_', ' '),
          category: category,
          power: element.tags.power,
          voltage: element.tags.voltage,
          highway: element.tags.highway,
          railway: element.tags.railway,
          waterway: element.tags.waterway,
          landuse: element.tags.landuse
        }
      };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
    }
  }

  /**
   * Add visual layers to map with clear hierarchy
   */
  async addVisualLayersToMap(map, visualData, lat, lng) {
    // Remove existing layers
    const layersToRemove = [
      'osm-transmission', 'osm-substations', 'osm-power-plants', 'osm-transportation',
      'osm-water', 'osm-industrial', 'osm-critical', 'osm-radius'
    ];
    
    layersToRemove.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('osm-visual')) {
      map.current.removeSource('osm-visual');
    }
    if (map.current.getSource('osm-radius')) {
      map.current.removeSource('osm-radius');
    }

    // Add visual features source
    map.current.addSource('osm-visual', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: visualData.features || []
      }
    });

    // 🔴 TRANSMISSION LINES - Bold Red (Highest Priority)
    map.current.addLayer({
      id: 'osm-transmission',
      type: 'line',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'transmission_line'],
      paint: {
        'line-color': '#ef4444',
        'line-width': 4,
        'line-opacity': 0.9
      }
    });

    // 🔴 SUBSTATIONS - Large Red Circles
    map.current.addLayer({
      id: 'osm-substations',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'power_substation'],
      paint: {
        'circle-radius': 10,
        'circle-color': '#dc2626',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });

    // 🔴 POWER PLANTS - Large Red Squares
    map.current.addLayer({
      id: 'osm-power-plants',
      type: 'circle',
      source: 'osm-visual',
      filter: ['any', 
        ['==', ['get', 'category'], 'power_plant'],
        ['==', ['get', 'category'], 'power_generator']
      ],
      paint: {
        'circle-radius': 12,
        'circle-color': '#ef4444',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1.0
      }
    });

    // 🟠 TRANSPORTATION - Orange Lines
    map.current.addLayer({
      id: 'osm-transportation',
      type: 'line',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'transportation'],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'highway'], 'motorway'], '#f97316',
          ['==', ['get', 'highway'], 'trunk'], '#fb923c',
          ['==', ['get', 'railway'], 'rail'], '#8b5cf6',
          '#f59e0b'
        ],
        'line-width': [
          'case',
          ['==', ['get', 'highway'], 'motorway'], 5,
          ['==', ['get', 'highway'], 'trunk'], 4,
          3
        ],
        'line-opacity': 0.8
      }
    });

    // 🔵 WATER FEATURES - Blue Polygons
    map.current.addLayer({
      id: 'osm-water',
      type: 'fill',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'water_feature'],
      paint: {
        'fill-color': '#0ea5e9',
        'fill-opacity': 0.4
      }
    });

    // 🟣 INDUSTRIAL ZONES - Purple Areas
    map.current.addLayer({
      id: 'osm-industrial',
      type: 'fill',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'industrial_zone'],
      paint: {
        'fill-color': 'rgba(139, 92, 246, 0.3)',
        'fill-opacity': 0.5
      }
    });

    // 🟠 CRITICAL INFRASTRUCTURE - Orange Circles
    map.current.addLayer({
      id: 'osm-critical',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'critical_infrastructure'],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], 10,
          ['==', ['get', 'amenity'], 'university'], 9,
          7
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], '#dc2626',
          ['==', ['get', 'amenity'], 'university'], '#8b5cf6',
          '#f59e0b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });

    // 🟢 6-MILE ANALYSIS RADIUS - Red Dashed Circle
    this.addAnalysisRadius(map, lat, lng);

    console.log('✅ Added visual power infrastructure layers to map');
  }

  /**
   * Add 6-mile analysis radius circle
   */
  addAnalysisRadius(map, lat, lng) {
    const radiusKm = 9.656; // 6 miles
    const circle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [this.generateCircle(lat, lng, radiusKm)]
      },
      properties: {
        name: 'Power Analysis Radius (6 miles)',
        category: 'analysis_boundary'
      }
    };

    map.current.addSource('osm-radius', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [circle] }
    });

    map.current.addLayer({
      id: 'osm-radius',
      type: 'line',
      source: 'osm-radius',
      paint: {
        'line-color': '#ef4444',
        'line-width': 3,
        'line-dasharray': [8, 4],
        'line-opacity': 0.8
      }
    });
  }

  /**
   * Process OSM data into visual features for power grid analysis
   */
  processVisualFeatures(osmData) {
    const features = [];
    const powerInfrastructure = [];
    const visualLayers = {
      transmission: [],
      substations: [],
      powerPlants: [],
      transportation: [],
      water: [],
      industrial: [],
      critical: []
    };

    if (!osmData.elements) {
      return { features, powerInfrastructure, visualLayers };
    }

    osmData.elements.forEach(element => {
      if (element.type === 'node') {
        this.processVisualNode(element, features, visualLayers);
      } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
        this.processVisualWay(element, osmData.elements, features, visualLayers);
      }
    });

    // Extract power infrastructure for analysis
    powerInfrastructure.push(...visualLayers.substations, ...visualLayers.powerPlants);

    return { features, powerInfrastructure, visualLayers };
  }

  /**
   * Process visual nodes (power infrastructure, critical facilities)
   */
  processVisualNode(element, features, visualLayers) {
    if (!element.tags) return;

    let category = null;
    let visualLayer = null;

    // Power infrastructure (highest visual priority)
    if (element.tags.power === 'substation') {
      category = 'power_substation';
      visualLayer = 'substations';
    } else if (element.tags.power === 'plant') {
      category = 'power_plant';
      visualLayer = 'powerPlants';
    } else if (element.tags.power === 'generator') {
      category = 'power_generator';
      visualLayer = 'powerPlants';
    } else if (element.tags.amenity === 'hospital') {
      category = 'critical_infrastructure';
      visualLayer = 'critical';
    } else if (element.tags.amenity === 'university') {
      category = 'critical_infrastructure';
      visualLayer = 'critical';
    }

    if (category && visualLayer) {
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [element.lon, element.lat]
        },
        properties: {
          osm_id: element.id,
          name: element.tags.name || category.replace('_', ' '),
          category: category,
          power: element.tags.power,
          voltage: element.tags.voltage,
          amenity: element.tags.amenity
        }
      };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
    }
  }

  /**
   * Process visual ways (transmission lines, roads, water, zones)
   */
  processVisualWay(element, allElements, features, visualLayers) {
    if (!element.tags) return;

    const coordinates = element.nodes.map(nodeId => {
      const node = allElements.find(e => e.id === nodeId);
      return node ? [node.lon, node.lat] : null;
    }).filter(coord => coord !== null);

    if (coordinates.length < 2) return;

    let category = null;
    let visualLayer = null;
    let geometryType = 'LineString';

    // Visual categorization for map display
    if (element.tags.power === 'line') {
      category = 'transmission_line';
      visualLayer = 'transmission';
    } else if (element.tags.highway) {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.railway === 'rail') {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.natural === 'water' || element.tags.waterway) {
      category = 'water_feature';
      visualLayer = 'water';
      if (element.tags.natural === 'water') {
        geometryType = 'Polygon';
        if (coordinates[0] !== coordinates[coordinates.length - 1]) {
          coordinates.push(coordinates[0]);
        }
      }
    } else if (element.tags.landuse === 'industrial') {
      category = 'industrial_zone';
      visualLayer = 'industrial';
      geometryType = 'Polygon';
      if (coordinates[0] !== coordinates[coordinates.length - 1]) {
        coordinates.push(coordinates[0]);
      }
    }

    if (category && visualLayer) {
      const geometry = geometryType === 'Polygon' ? 
        { type: 'Polygon', coordinates: [coordinates] } :
        { type: 'LineString', coordinates: coordinates };

      const feature = {
        type: 'Feature',
        geometry: geometry,
        properties: {
          osm_id: element.id,
          name: element.tags.name || category.replace('_', ' '),
          category: category,
          power: element.tags.power,
          voltage: element.tags.voltage,
          highway: element.tags.highway,
          railway: element.tags.railway,
          waterway: element.tags.waterway,
          landuse: element.tags.landuse
        }
      };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
    }
  }

  /**
   * Simple cache key generation
   */
  generateSimpleCacheKey(coordinates, locationConfig) {
    const lat = Math.round(coordinates.lat * 1000) / 1000;
    const lng = Math.round(coordinates.lng * 1000) / 1000;
    const location = locationConfig?.city || 'default';
    return `${this.cacheKeyPrefix}${lat}_${lng}_${location}`;
  }

  /**
   * Get from cache
   */
  getFromCache(cacheKey) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const entry = JSON.parse(cached);
        if ((Date.now() - entry.timestamp) < this.cacheExpiration) {
          return entry.data;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('OSM Cache error:', error.message);
    }
    return null;
  }

  /**
   * Save to cache
   */
  saveToCache(cacheKey, data) {
    try {
      const entry = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      console.log('💾 OSM: Cached visual context');
    } catch (error) {
      if (error.message.includes('quota')) {
        // Clear old cache and retry
        this.clearOldCache(3);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(entry));
          console.log('💾 OSM: Cached visual context (after cleanup)');
        } catch (retryError) {
          console.warn('OSM Cache quota exceeded:', retryError.message);
        }
      } else {
        console.warn('OSM Cache save error:', error.message);
      }
    }
  }

  /**
   * Clear old cache entries
   */
  clearOldCache(count = 3) {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cacheKeyPrefix)) {
          keys.push(key);
        }
      }
      keys.slice(0, count).forEach(key => localStorage.removeItem(key));
      console.log(`🧹 OSM: Cleared ${Math.min(count, keys.length)} old cache entries`);
    } catch (error) {
      console.warn('Cache cleanup error:', error.message);
    }
  }

  /**
   * Generate circle coordinates
   */
  generateCircle(centerLat, centerLng, radiusKm, points = 32) {
    const coordinates = [];
    const radiusDegrees = radiusKm / 111.32;
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const lat = centerLat + (radiusDegrees * Math.cos(angle));
      const lng = centerLng + (radiusDegrees * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180));
      coordinates.push([lng, lat]);
    }
    
    return coordinates;
  }
}

// Global cache controls
let globalOsmTool = null;

export function setGlobalOsmTool(toolInstance) {
  globalOsmTool = toolInstance;
}

if (typeof window !== 'undefined') {
  window.clearOsmCache = () => {
    if (globalOsmTool) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('osm_visual_context_')) {
            keys.push(key);
          }
        }
        keys.forEach(key => localStorage.removeItem(key));
        console.log(`🗑️ OSM Cache: Cleared ${keys.length} visual context entries`);
      } catch (error) {
        console.warn('Cache clear error:', error.message);
      }
    }
  };
}
