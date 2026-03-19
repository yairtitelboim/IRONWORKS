/**
 * OsmTool - Visual Power Infrastructure Mapping for ERCOT Analysis
 * 
 * FOCUSED ROLE: Provides clear visual mapping of power infrastructure within 6-mile radius
 * INTEGRATION: Complements SERP data with visual geographic context
 * PERFORMANCE: Optimized for sub-20 second execution with maximum visual impact
 */

// mapboxgl imported for popup functionality (if needed later)

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
        
        // Emit cached OSM data to legend
        if (typeof window !== 'undefined' && window.mapEventBus) {
          window.mapEventBus.emit('osm:geographicContext', {
            context: {
              visualLayers: cached.visualLayers || {},
              features: cached.features || []
            },
            timestamp: Date.now()
          });
        }
        
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
    const visualRadius = 24140; // 15 miles in meters (matching SERP search radius)
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🔍 Querying power infrastructure...',
      progress: 50,
      details: 'Searching for visual power infrastructure within 6-mile radius'
    });

    // FOCUSED VISUAL QUERY - Optimized for performance and visual impact
    const query = `
      [out:json][timeout:30];
      (
        // POWER INFRASTRUCTURE (Visual Priority with endpoints)
        node["power"="substation"](around:${visualRadius}, ${lat}, ${lng});
        way["power"="substation"](around:${visualRadius}, ${lat}, ${lng});
        node["power"="plant"](around:${visualRadius}, ${lat}, ${lng});
        node["power"="generator"](around:${visualRadius}, ${lat}, ${lng});
        node["power"="tower"](around:${visualRadius}, ${lat}, ${lng});
        way["power"="line"](around:${visualRadius}, ${lat}, ${lng});
        
        // ADDITIONAL SUBSTATION SEARCH - Alternative tagging patterns
        node["substation"~"transmission|distribution|primary"](around:${visualRadius}, ${lat}, ${lng});
        way["substation"~"transmission|distribution|primary"](around:${visualRadius}, ${lat}, ${lng});
        node["power"~"substation|switch"](around:${visualRadius}, ${lat}, ${lng});
        way["power"~"substation|switch"](around:${visualRadius}, ${lat}, ${lng});
        
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
    const timeoutId = setTimeout(() => {
      console.warn('⏰ OSM query timeout - aborting request after 40 seconds');
      controller.abort();
    }, 40000); // 40s timeout (10s buffer over OSM server timeout)
    
    console.log('🌐 Executing OSM query for power infrastructure...');
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
    
    console.log('✅ OSM API response received, parsing data...');
    const osmData = await response.json();
    console.log(`📊 OSM data parsed: ${osmData.elements?.length || 0} elements found`);
      
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
      
      // Emit OSM visual data to legend
    if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('osm:geographicContext', {
          context: {
            visualLayers: visualFeatures.visualLayers,
            features: visualFeatures.features
          },
        timestamp: Date.now()
      });
    }

    // Emit OSM infrastructure data for Site Assessment Overview
    if (typeof window !== 'undefined' && window.mapEventBus) {
      window.mapEventBus.emit('osm:infrastructureData', {
        substationsCount: visualFeatures.visualLayers.substations.length,
        waterAccess: visualFeatures.visualLayers.water.length > 0 ? 'Water features available' : 'Limited water access',
        landUse: visualFeatures.visualLayers.industrial.length > 0 ? 'Industrial zones present' : 'Mixed land use',
        transportationAccess: visualFeatures.visualLayers.transportation.length > 0 ? 'Major transportation nearby' : 'Limited transportation',
        criticalInfrastructure: visualFeatures.visualLayers.critical.length > 0 ? 'Critical facilities nearby' : 'No critical facilities',
        timestamp: Date.now()
      });
    }
    
    return {
        features: visualFeatures.features,
        powerInfrastructure: visualFeatures.powerInfrastructure,
        visualLayers: visualFeatures.visualLayers,
        message: `Mapped ${visualFeatures.features.length} visual power infrastructure features`,
        // Infrastructure data for parseTableData
        substationsCount: visualFeatures.visualLayers.substations.length,
        waterAccess: visualFeatures.visualLayers.water.length > 0 ? 'Water features available' : 'Limited water access',
        landUse: visualFeatures.visualLayers.industrial.length > 0 ? 'Industrial zones present' : 'Mixed land use',
        transportationAccess: visualFeatures.visualLayers.transportation.length > 0 ? 'Major transportation nearby' : 'Limited transportation',
        criticalInfrastructure: visualFeatures.visualLayers.critical.length > 0 ? 'Critical facilities nearby' : 'No critical facilities'
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error('OSM query timed out after 40 seconds. The query may be too complex or the server is overloaded.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Failed to connect to OSM API. Please check your internet connection.');
      } else {
        throw new Error(`OSM API error: ${error.message}`);
      }
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
      towers: [], // Power transmission towers
      transportation: [],
      water: [],
      industrial: [],
      critical: []
    };

    if (!osmData.elements) {
      return { features, powerInfrastructure, visualLayers };
    }
      
      console.log(`🔍 OSM Debug - Processing ${osmData.elements.length} elements`);
      let powerElements = 0;
      let substationElements = 0;
      
      osmData.elements.forEach(element => {
        if (element.tags && element.tags.power) {
          powerElements++;
          if (element.tags.power === 'substation' || element.tags.substation) {
            substationElements++;
            console.log('🔍 OSM Debug - Power element found:', {
              type: element.type,
              power: element.tags.power,
              substation: element.tags.substation,
              name: element.tags.name,
              id: element.id
            });
          }
        }
        
        if (element.type === 'node') {
          this.processVisualNode(element, features, visualLayers);
        } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
          this.processVisualWay(element, osmData.elements, features, visualLayers);
        }
      });
      
      console.log(`🔍 OSM Debug - Power elements: ${powerElements}, Substation elements: ${substationElements}`);

    // Extract power infrastructure for analysis
    powerInfrastructure.push(...visualLayers.substations, ...visualLayers.powerPlants);
    
    // Add towers to the features if they exist
    if (visualLayers.towers && visualLayers.towers.length > 0) {
      console.log(`🗼 Found ${visualLayers.towers.length} power towers`);
      console.log(`⚡ Found ${visualLayers.transmission.length} transmission lines`);
      console.log(`🏭 Found ${visualLayers.powerPlants.length} power plants/generators`);
      console.log(`🔌 Found ${visualLayers.substations.length} substations`);
    }

    // Summary logging only
    const totalPowerInfrastructure = visualLayers.transmission.length + visualLayers.substations.length + visualLayers.powerPlants.length + (visualLayers.towers?.length || 0);
    console.log(`🗺️ OSM Visual Summary: ${totalPowerInfrastructure} power infrastructure features, ${features.length} total features`);

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
    if (element.tags.power === 'substation' || 
        element.tags.power === 'switch' ||
        element.tags.substation ||
        (element.tags.power && element.tags.power.includes('substation'))) {
      category = 'power_substation';
      visualLayer = 'substations';
      console.log('⚡ Substation Found:', {
        name: element.tags.name,
        voltage: element.tags.voltage,
        operator: element.tags.operator,
        power: element.tags.power,
        substation: element.tags.substation,
        coordinates: [element.lon, element.lat]
      });
    } else if (element.tags.power === 'plant') {
      category = 'power_plant';
      visualLayer = 'powerPlants';
      console.log('🏢 Power Plant Found:', {
        name: element.tags.name,
        source: element.tags['generator:source'],
        output: element.tags['generator:output'],
        coordinates: [element.lon, element.lat]
      });
    } else if (element.tags.power === 'generator') {
      category = 'power_generator';
      visualLayer = 'powerPlants';
    } else if (element.tags.power === 'tower') {
      category = 'power_tower';
      visualLayer = 'towers';
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
      
      // Enhanced transmission line analysis (reduced logging)
    } else if (element.tags.power === 'substation' || 
               element.tags.power === 'switch' ||
               element.tags.substation ||
               (element.tags.power && element.tags.power.includes('substation'))) {
      // Handle substations mapped as ways (areas/facilities)
      category = 'power_substation';
      visualLayer = 'substations';
      geometryType = 'Polygon'; // Substations are typically areas
      console.log('⚡ Substation Way Found:', {
        name: element.tags.name,
        voltage: element.tags.voltage,
        operator: element.tags.operator,
        power: element.tags.power,
        substation: element.tags.substation,
        coordinates: coordinates[0] // Use first coordinate as center
      });
    } else if (element.tags.highway) {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.railway === 'rail') {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.natural === 'water' || element.tags.waterway) {
      category = 'water_feature';
      visualLayer = 'water';
      
      // Only create polygons for actual closed water bodies (lakes, ponds)
      // Keep rivers and streams as lines
      if (element.tags.natural === 'water') {
        // Check if this is actually a closed polygon
        if (coordinates.length >= 4 && 
            Math.abs(coordinates[0][0] - coordinates[coordinates.length - 1][0]) < 0.001 &&
            Math.abs(coordinates[0][1] - coordinates[coordinates.length - 1][1]) < 0.001) {
          // Already closed, it's a proper water body (lake/pond)
              geometryType = 'Polygon';
        } else if (coordinates.length >= 10) {
          // Large area, likely a lake - close it
              geometryType = 'Polygon';
                coordinates.push(coordinates[0]);
        } else {
          // Small or linear water feature - keep as line
          geometryType = 'LineString';
              }
      } else {
        // Waterways (rivers, streams) should always be lines
              geometryType = 'LineString';
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
      
      // For transmission lines, also create endpoint markers for tracing
      if (category === 'transmission_line' && coordinates.length >= 2) {
        // Create start endpoint
        const startEndpoint = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: coordinates[0]
          },
          properties: {
            osm_id: `${element.id}_start`,
            name: `${element.tags.name || 'Transmission Line'} - Start`,
            category: 'transmission_endpoint',
            endpoint_type: 'start',
            parent_line: element.id,
            voltage: element.tags.voltage,
            operator: element.tags.operator
          }
        };
        
        // Create end endpoint
        const endEndpoint = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: coordinates[coordinates.length - 1]
          },
          properties: {
            osm_id: `${element.id}_end`,
            name: `${element.tags.name || 'Transmission Line'} - End`,
            category: 'transmission_endpoint',
            endpoint_type: 'end',
            parent_line: element.id,
            voltage: element.tags.voltage,
            operator: element.tags.operator
          }
        };
        
        features.push(startEndpoint, endEndpoint);
        
        // Transmission line traced (reduced logging)
      }
    }
  }

  /**
   * Add visual layers to map with clear hierarchy
   */
  async addVisualLayersToMap(map, visualData, lat, lng) {
    // Remove existing layers
    const layersToRemove = [
      'osm-transmission', 'osm-transmission-endpoints', 'osm-substations', 'osm-power-plants', 
      'osm-power-towers', 'osm-transportation', 'osm-water-lines', 'osm-water-fill', 
      'osm-industrial', 'osm-critical', 'osm-radius'
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
    
    // 🔴 TRANSMISSION LINES - Color-coded by Voltage with Direction Indicators
    map.current.addLayer({
      id: 'osm-transmission',
      type: 'line',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'transmission_line'],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'voltage'], '345000'], '#dc2626', // High voltage - Dark red
          ['==', ['get', 'voltage'], '138000'], '#ef4444', // Medium voltage - Red
          ['==', ['get', 'voltage'], '69000'], '#f87171',  // Lower voltage - Light red
          '#ef4444' // Default red
        ],
        'line-width': [
          'case',
          ['==', ['get', 'voltage'], '345000'], 4, // Thicker for high voltage
          ['==', ['get', 'voltage'], '138000'], 2, // Medium thickness
          ['==', ['get', 'voltage'], '69000'], 2,  // Thinner for lower voltage
          4 // Default
        ],
        'line-opacity': 0.9
      }
    });

    // 🔴 SUBSTATIONS - Medium Red Circles (40% smaller, no border, transparent)
    map.current.addLayer({
      id: 'osm-substations',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'power_substation'],
      paint: {
        'circle-radius': 2, // 40% smaller (8 * 0.6 = 4.8 ≈ 4)
        'circle-color': '#dc2626',
        'circle-stroke-width': 0, // No white border
        'circle-opacity': 0.5 // Slightly transparent
      }
    });

    // 🔴 POWER PLANTS - Large Red Circles (40% smaller, no border, transparent)
    map.current.addLayer({
      id: 'osm-power-plants',
      type: 'circle',
      source: 'osm-visual',
      filter: ['any', 
        ['==', ['get', 'category'], 'power_plant'],
        ['==', ['get', 'category'], 'power_generator']
      ],
      paint: {
        'circle-radius': 5, // 40% smaller (12 * 0.6 = 7.2 ≈ 7)
        'circle-color': '#ef4444',
        'circle-stroke-width': 0, // No white border
        'circle-opacity': 0.6 // Slightly transparent
      }
    });
    
    // 🗼 POWER TOWERS - Small Gray Circles (25% smaller, no border, transparent)
    map.current.addLayer({
      id: 'osm-power-towers',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'power_tower'],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'voltage'], '345000'], 3, // 25% smaller (4 * 0.75 = 3)
          ['==', ['get', 'voltage'], '138000'], 2, // 25% smaller (3 * 0.75 = 2.25 ≈ 2)
          ['==', ['get', 'voltage'], '69000'], 1,  // 25% smaller (2 * 0.75 = 1.5 ≈ 1)
          1 // Default - 25% smaller
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'voltage'], '345000'], '#374151', // Darker for high voltage
          ['==', ['get', 'voltage'], '138000'], '#6b7280', // Medium gray
          ['==', ['get', 'voltage'], '69000'], '#9ca3af',  // Lighter gray
          '#6b7280' // Default
        ],
        'circle-stroke-width': 0, // No white border
        'circle-opacity': 0.6 // Slightly transparent
      }
    });

    // 🔴 TRANSMISSION LINE ENDPOINTS - Power Flow Direction Indicators (25% smaller, no border, transparent)
    map.current.addLayer({
      id: 'osm-transmission-endpoints',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'transmission_endpoint'],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'endpoint_type'], 'start'], 4, // 25% smaller (6 * 0.75 = 4.5 ≈ 4)
          ['==', ['get', 'endpoint_type'], 'end'], 3,   // 25% smaller (4 * 0.75 = 3)
          3 // Default - 25% smaller
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'endpoint_type'], 'start'], '#10b981', // Green for start (power source)
          ['==', ['get', 'endpoint_type'], 'end'], '#f59e0b',   // Orange for end (destination)
          '#6b7280' // Default gray
        ],
        'circle-stroke-width': 0, // No white border
        'circle-opacity': 0.7 // Slightly transparent
      }
    });

    // 🟠 TRANSPORTATION - Thinner Orange Lines (Half thickness)
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
          ['==', ['get', 'highway'], 'motorway'], 2.5, // Half of 5
          ['==', ['get', 'highway'], 'trunk'], 2,      // Half of 4
          1.5 // Half of 3
        ],
        'line-opacity': 0.8
      }
    });
    
    // 🔵 WATER FEATURES - Blue Lines and Proper Polygons
    // First add water lines (rivers, streams that shouldn't be filled)
    map.current.addLayer({
      id: 'osm-water-lines',
      type: 'line',
      source: 'osm-visual',
      filter: ['all',
        ['==', ['get', 'category'], 'water_feature'],
        ['==', ['geometry-type'], 'LineString'] // Only line geometries
      ],
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 3,
        'line-opacity': 0.8
      }
    });
    
    // Then add water polygons (lakes, ponds that should be filled)
    map.current.addLayer({
      id: 'osm-water-fill',
      type: 'fill',
      source: 'osm-visual',
      filter: ['all',
        ['==', ['get', 'category'], 'water_feature'],
        ['==', ['geometry-type'], 'Polygon'] // Only closed polygon geometries
      ],
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

    // 🟠 CRITICAL INFRASTRUCTURE - Orange Circles (25% smaller, no border, transparent)
    map.current.addLayer({
      id: 'osm-critical',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'critical_infrastructure'],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], 7, // 25% smaller (10 * 0.75 = 7.5 ≈ 7)
          ['==', ['get', 'amenity'], 'university'], 6, // 25% smaller (9 * 0.75 = 6.75 ≈ 6)
          5 // Default - 25% smaller (7 * 0.75 = 5.25 ≈ 5)
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], '#dc2626',
          ['==', ['get', 'amenity'], 'university'], '#8b5cf6',
          '#f59e0b'
        ],
        'circle-stroke-width': 0, // No white border
        'circle-opacity': 0.7 // Slightly transparent
      }
    });

    // 🟢 6-MILE ANALYSIS RADIUS - Red Dashed Circle
    this.addAnalysisRadius(map, lat, lng);

    console.log(`✅ Added ${visualData.features?.length || 0} visual features to map`);
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
      // Check localStorage only in browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const entry = JSON.parse(cached);
          if ((Date.now() - entry.timestamp) < this.cacheExpiration) {
            return entry.data;
          } else {
            localStorage.removeItem(cacheKey);
          }
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
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      }
      console.log('💾 OSM: Cached visual context');
    } catch (error) {
      if (error.message.includes('quota')) {
        // Clear old cache and retry
        this.clearOldCache(3);
        try {
          const retryEntry = {
            data: data,
            timestamp: Date.now()
          };
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(cacheKey, JSON.stringify(retryEntry));
          }
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
      // Clear localStorage only in browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.cacheKeyPrefix)) {
            keys.push(key);
          }
        }
        keys.slice(0, count).forEach(key => localStorage.removeItem(key));
        console.log(`🧹 OSM: Cleared ${Math.min(count, keys.length)} old cache entries`);
      }
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
  
  /**
   * Calculate the length of a transmission line in kilometers
   */
  calculateLineLength(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;
    
    let totalLength = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      totalLength += this.calculateDistance(coordinates[i], coordinates[i + 1]);
    }
    return Math.round(totalLength * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Calculate distance between two coordinates in kilometers
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('osm_visual_context_')) {
              keys.push(key);
            }
          }
          keys.forEach(key => localStorage.removeItem(key));
        }
        console.log(`🗑️ OSM Cache: Cleared ${keys.length} visual context entries`);
      } catch (error) {
        console.warn('Cache clear error:', error.message);
      }
    }
  };
}
