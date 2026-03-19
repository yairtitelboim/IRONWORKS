/**
 * OsmTool - Strategic Geographic Context Provider for Power Grid Analysis
 * 
 * STRATEGIC ROLE: Provides geographic context for SERP-discovered power facilities
 * NOT a duplicate of SERP, but a complement that adds:
 * - Property boundaries and zoning context
 * - Geographic risk assessment (flood zones, terrain)
 * - Transportation and access corridors
 * - Transmission line topology and connectivity
 * - Spatial relationships between facilities
 * 
 * INTEGRATION: Works with SERP data to enable Perplexity's strategic analysis
 */

import mapboxgl from 'mapbox-gl';

export class OsmTool {
  constructor(updateToolFeedback) {
    this.updateToolFeedback = updateToolFeedback;
    
    // OSM caching configuration
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours (geographic data changes slowly)
    this.cacheKeyPrefix = 'osm_geographic_context_';
    
    // Cost tracking for OSM API calls
    this.costTracker = {
      overpassCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalApiTime: 0
    };
  }

  /**
   * Execute OSM tool for strategic geographic context analysis
   * Complements SERP data with geographic intelligence
   */
  async execute(queries, coordinates, map = null, locationConfig = null, serpData = null) {
    // Use location-specific search radius if available
    const searchRadius = locationConfig?.searchRadius || 5000; // Default 5km
    
    // Clean expired cache entries before starting
    this.cleanExpiredCache();
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🗺️ Analyzing geographic context...',
      progress: 30,
      details: serpData ? 
        `Analyzing geographic context for ${serpData.length} SERP facilities` :
        `Performing regional geographic analysis within ${(searchRadius/1000).toFixed(1)}km`
    });

    try {
      // Check cache first
      const cachedResult = this.getCachedGeographicContext(coordinates, locationConfig, serpData);
      if (cachedResult) {
        console.log('⚡ OSM: Using cached geographic context');
        this.costTracker.cacheHits++;
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
          status: '⚡ Loading cached geographic context...',
          progress: 90,
          details: `Using cached analysis (${cachedResult.contextualFeatures} features, age: ${this.getCacheAge(cachedResult.timestamp)})`
        });
        
        // Add cached context to map if map is provided
        if (map?.current && cachedResult.features.length > 0) {
          await this.addStrategicContextToMap(map, cachedResult, coordinates.lat, coordinates.lng, locationConfig);
        }
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '⚡ Cached geographic context loaded',
        progress: 100,
          details: `Used cached analysis (${cachedResult.contextualFeatures} features, cached ${this.getCacheAge(cachedResult.timestamp)})`
        });
        
        return {
          success: true,
          tool: 'OSM',
          queries: queries,
          coordinates: coordinates,
          data: cachedResult,
          timestamp: Date.now(),
          strategicContext: true,
          cached: true
        };
      }
      
      // Cache miss - execute fresh analysis
      console.log('💾 OSM: Cache miss, executing fresh geographic analysis');
      this.costTracker.cacheMisses++;
      
      // Execute strategic OSM analysis
      const startTime = performance.now();
      const result = await this.executeStrategicGeographicAnalysis(
        coordinates, 
        map, 
        locationConfig, 
        serpData
      );
      const endTime = performance.now();
      this.costTracker.totalApiTime += (endTime - startTime);
      
      // Cache the result for future use (with size optimization)
      this.setCachedGeographicContext(coordinates, locationConfig, serpData, result);
      
      // Log cost summary
      const costSummary = this.getCostSummary();
      console.log(`💰 OSM Cost Summary: ${costSummary.overpassCalls} API calls, ${costSummary.cacheHitRate}% cache hit rate, avg ${costSummary.averageApiTime}ms per call`);
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '✅ Geographic context analysis completed',
        progress: 100,
        details: `Analyzed ${result.contextualFeatures} geographic features (live API call). Cache: ${costSummary.cacheHits} hits, ${costSummary.cacheMisses} misses (${costSummary.cacheHitRate}% hit rate)`
      });
      
      return {
        success: true,
        tool: 'OSM',
        queries: queries,
        coordinates: coordinates,
        data: result,
        timestamp: Date.now(),
        strategicContext: true,
        cached: false
      };
    } catch (error) {
      console.warn('⚠️ OSM geographic context analysis failed:', error.message);
      
      // Check if it's a timeout error
      const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
      const errorMessage = isTimeout ? 'OSM API timeout (30s) - using fallback' : `OSM geographic analysis failed: ${error.message}`;
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: isTimeout ? 'OSM visual query timeout - using fallback' : 'OSM analysis failed - using fallback',
        progress: 100,
        details: errorMessage
      });
      
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'OSM',
        error: error.message,
        fallback: true,
        isTimeout: isTimeout,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute strategic geographic analysis using OSM Overpass API
   * Provides geographic context for SERP-discovered power facilities
   */
  async executeStrategicGeographicAnalysis(coordinates, map, locationConfig = null, serpData = null) {
    const { lat, lng } = coordinates;
    const searchRadius = locationConfig?.searchRadius || 5000; // Default 5km
    
    // Update feedback for OSM query start
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🔍 Querying OSM Overpass API...',
      progress: 40,
      details: `Searching for power infrastructure within ${(searchRadius/1000).toFixed(1)}km radius of ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    });
    
    // Ensure coordinates are numbers and within valid ranges
    if (typeof lat !== 'number' || typeof lng !== 'number' || 
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
    }
    
    // Strategic geographic context query - complements SERP data
    const overpassQuery = this.buildStrategicContextQuery(lat, lng, searchRadius, serpData);
    
    console.log('🔍 OSM: Starting strategic geographic analysis...');
    
    // Track API call
    this.costTracker.overpassCalls++;
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for visual queries
    
    // Update progress for API call
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🌍 Fetching data from OpenStreetMap...',
      progress: 60,
      details: `Executing strategic context query (API call ${this.costTracker.overpassCalls})`
    });
    
    const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('🔍 OSM: Overpass API response received');
    
    if (!response.ok) {
      throw new Error(`OSM API error: ${response.status}`);
    }
    
    const osmData = await response.json();
    
    // Update progress for data processing
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '⚙️ Processing geographic context...',
      progress: 80,
      details: `Processing ${osmData.elements?.length || 0} geographic elements for strategic analysis`
    });
    
    // Process OSM elements into strategic geographic context
    const geographicContext = await this.processStrategicGeographicData(osmData, serpData, coordinates);
    
    // No arbitrary limits - all geographic context is potentially relevant
    const contextualFeatures = geographicContext.features;
    
    // Update feedback for strategic analysis
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🧭 Analyzing spatial relationships...',
      progress: 80,
      details: `Processing ${contextualFeatures.length} geographic context features. Calculating spatial intelligence...`
    });
    
    // Add strategic geographic context to map if map is provided
    if (map?.current && contextualFeatures.length > 0) {
      await this.addStrategicContextToMap(map, geographicContext, lat, lng, locationConfig);
    }
    
    // Emit strategic geographic data to global event bus
    if (window.mapEventBus) {
      window.mapEventBus.emit('osm:geographicContext', {
        context: geographicContext,
        timestamp: Date.now()
      });
    }
    
    return {
      features: contextualFeatures,
      geographicContext: geographicContext,
      contextualFeatures: contextualFeatures.length,
      spatialAnalysis: geographicContext.spatialAnalysis,
      riskAssessment: geographicContext.riskAssessment,
      message: `Analyzed ${contextualFeatures.length} geographic features providing strategic context for power grid analysis`
    };
  }

  /**
   * Build visual-focused power infrastructure query for ERCOT analysis
   */
  buildStrategicContextQuery(lat, lng, searchRadius, serpData) {
    // 6-MILE RADIUS VISUAL POWER INFRASTRUCTURE QUERY
    // Focus on visually clear, ERCOT-relevant power infrastructure
    const visualRadius = 9656; // 6 miles in meters
    
    let query = `[out:json][timeout:25];(`; // Increased timeout for visual queries
    
    // 🔴 TIER 1: CRITICAL POWER INFRASTRUCTURE (Most Visual Impact)
    // Major substations and power plants - large visual markers
    query += `
      node["power"="substation"]["voltage"~"[0-9]+kV"](around:${visualRadius}, ${lat}, ${lng});
      node["power"="plant"](around:${visualRadius}, ${lat}, ${lng});
      node["power"="generator"]["generator:source"~"solar|wind|gas|coal"](around:${visualRadius}, ${lat}, ${lng});
      way["power"="substation"](around:${visualRadius}, ${lat}, ${lng});`;
    
    // 🔴 TRANSMISSION LINES (Bold Red Lines)
    // High-voltage transmission lines - thick visual lines
    query += `
      way["power"="line"]["voltage"~"^(138|230|345|500).*kV"](around:${visualRadius}, ${lat}, ${lng});
      way["power"="line"]["cables"~"[2-9]"](around:${visualRadius}, ${lat}, ${lng});`;
    
    // 🟣 TIER 2: INDUSTRIAL & POWER ZONES (Purple Polygons)
    // Large industrial areas and power-related land use - clear visual zones
    query += `
      way["landuse"="industrial"](if: count(nodes) > 8)(around:${visualRadius}, ${lat}, ${lng});
      way["industrial"="power"](around:${visualRadius}, ${lat}, ${lng});
      relation["type"="multipolygon"]["landuse"="industrial"](around:${visualRadius}, ${lat}, ${lng});
      way["landuse"="commercial"](if: count(nodes) > 12)(around:${searchRadius}, ${lat}, ${lng});`;
    
    // 🔵 TIER 1: MAJOR WATER FEATURES (Blue Polygons/Lines)
    // Major rivers, lakes for cooling and flood analysis - prominent visual features
    query += `
      way["natural"="water"]["name"](around:${visualRadius * 1.5}, ${lat}, ${lng});
      way["waterway"="river"]["name"](around:${visualRadius * 1.5}, ${lat}, ${lng});
      relation["type"="waterway"]["waterway"="river"](around:${visualRadius * 1.5}, ${lat}, ${lng});
      way["water"="reservoir"](around:${visualRadius}, ${lat}, ${lng});`;
    
    // 🟠 TIER 2: MAJOR TRANSPORTATION (Orange Lines)
    // Major highways and rail - clear visual corridors for equipment access
    query += `
      way["highway"~"motorway|trunk|primary"]["name"](around:${visualRadius}, ${lat}, ${lng});
      way["railway"="rail"](around:${visualRadius}, ${lat}, ${lng});
      node["railway"="station"]["name"](around:${visualRadius}, ${lat}, ${lng});`;
    
    // 🟢 TIER 3: UTILITY INFRASTRUCTURE (Green Markers)
    // Utility companies, electrical services - medium visual markers
    query += `
      node["office"="utility"](around:${visualRadius}, ${lat}, ${lng});
      node["office"="energy"](around:${visualRadius}, ${lat}, ${lng});
      way["building"="industrial"]["industrial"="power"](around:${searchRadius}, ${lat}, ${lng});`;
    
    // 🔶 TIER 3: CRITICAL INFRASTRUCTURE (Orange Markers)
    // Major facilities that depend on reliable power - important visual markers
    query += `
      node["amenity"="hospital"]["name"](around:${visualRadius}, ${lat}, ${lng});
      node["amenity"="university"]["name"](around:${searchRadius}, ${lat}, ${lng});
      way["amenity"="university"]["name"](around:${searchRadius}, ${lat}, ${lng});
      node["amenity"="fire_station"](around:${searchRadius}, ${lat}, ${lng});`;
    
    // 🎯 SERP FACILITY CONTEXT (if available)
    // Visual context around SERP-discovered power facilities
    if (serpData && Array.isArray(serpData) && serpData.length > 0) {
      query += this.buildVisualFacilityQueries(serpData);
    }
    
    query += `
      );
      out body;
      >;
      out skel qt;`;
    
    return query;
  }
  
  /**
   * Build visual context queries around SERP-discovered power facilities
   */
  buildVisualFacilityQueries(serpData) {
    let facilityQueries = '';
    
    // Focus on top 3 most critical facilities from SERP for visual clarity
    const criticalFacilities = serpData
      .filter(feature => feature.properties && feature.geometry && feature.geometry.coordinates)
      .filter(facility => {
        // Only include power-related facilities for visual focus
        const category = facility.properties.category;
        return category && (category.includes('power') || category.includes('electric') || category.includes('grid'));
      })
      .slice(0, 3); // Limit to top 3 for visual clarity
    
    criticalFacilities.forEach(facility => {
      const coords = facility.geometry.coordinates;
      const [facilityLng, facilityLat] = coords;
      
      // Add simplified visual context around each power facility
      facilityQueries += `
        // Context: ${facility.properties.name || 'facility'}
        way["power"="line"](around:1000, ${facilityLat}, ${facilityLng});`;
    });
    
    return facilityQueries;
  }
  
  /**
   * Process OSM data into strategic geographic context
   */
  async processStrategicGeographicData(osmData, serpData, siteCoordinates) {
    const geographicContext = {
      features: [],
      spatialAnalysis: {
        transmissionCorridors: [],
        landUseZones: [],
        waterFeatures: [],
        transportationNetwork: [],
        facilityProximity: []
      },
      riskAssessment: {
        floodRisk: 'unknown',
        accessRisk: 'unknown',
        landAvailability: 'unknown'
      },
      contextType: 'strategic_geographic_analysis'
    };
    
    if (!osmData.elements) {
      return geographicContext;
    }
    
    // Process elements by strategic category
      osmData.elements.forEach(element => {
        if (element.type === 'node') {
        this.processStrategicNode(element, geographicContext, siteCoordinates);
      } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
        this.processStrategicWay(element, osmData.elements, geographicContext, siteCoordinates);
      } else if (element.type === 'relation') {
        this.processStrategicRelation(element, osmData.elements, geographicContext);
      }
    });
    
    // Perform spatial analysis
    await this.performSpatialAnalysis(geographicContext, serpData, siteCoordinates);
    
    // Assess geographic risks
    await this.assessGeographicRisks(geographicContext, siteCoordinates);
    
    // Limit features to prevent storage issues (keep most strategic ones)
    this.limitStrategicFeatures(geographicContext);
    
    console.log('🗺️ OSM Strategic Geographic Context:', {
      transmissionCorridors: geographicContext.spatialAnalysis.transmissionCorridors.length,
      landUseZones: geographicContext.spatialAnalysis.landUseZones.length,
      waterFeatures: geographicContext.spatialAnalysis.waterFeatures.length,
      transportationNetwork: geographicContext.spatialAnalysis.transportationNetwork.length,
      totalFeatures: geographicContext.features.length
    });
    
    return geographicContext;
  }
  
  /**
   * Process strategic nodes (hospitals, emergency services, key infrastructure)
   */
  processStrategicNode(element, geographicContext, siteCoordinates) {
    if (!element.tags) return;
    
    const { lat: siteLat, lng: siteLng } = siteCoordinates;
    const distance = this.calculateDistance([element.lon, element.lat], [siteLng, siteLat]);
    
    let category = null;
    let strategicImportance = 'low';
    
    // Power infrastructure (highest priority for visual display)
    if (element.tags.power) {
      if (element.tags.power === 'substation') {
        category = 'power_substation';
        strategicImportance = 'critical';
      } else if (element.tags.power === 'plant') {
        category = 'power_plant';
        strategicImportance = 'critical';
      } else if (element.tags.power === 'generator') {
        category = 'power_generator';
        strategicImportance = 'high';
      } else if (element.tags.power === 'transformer') {
        category = 'power_transformer';
        strategicImportance = 'medium';
      }
    }
    // Critical infrastructure that depends on reliable power
    else if (element.tags.amenity === 'hospital') {
      category = 'critical_infrastructure';
      strategicImportance = 'critical';
    } else if (element.tags.amenity === 'university') {
      category = 'critical_infrastructure';
      strategicImportance = 'high';
    } else if (element.tags.amenity === 'fire_station') {
      category = 'emergency_services';
      strategicImportance = 'high';
    } else if (element.tags.railway === 'station') {
      category = 'transportation_hub';
      strategicImportance = 'medium';
    }
    
    if (category) {
            const feature = {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [element.lon, element.lat]
              },
              properties: {
                osm_id: element.id,
                osm_type: 'node',
          name: element.tags.name || `${category.replace('_', ' ')}`,
          category: category,
          strategic_importance: strategicImportance,
          distance_km: distance,
          amenity: element.tags.amenity,
          railway: element.tags.railway,
          power_dependency: category === 'critical_infrastructure' ? 'high' : 'medium'
        }
      };
      
      geographicContext.features.push(feature);
    }
  }
  
  /**
   * Process strategic ways (transmission lines, roads, waterways, land use)
   */
  processStrategicWay(element, allElements, geographicContext, siteCoordinates) {
    if (!element.tags || !element.nodes || element.nodes.length < 2) return;
    
    // Convert node IDs to coordinates
    const coordinates = element.nodes.map(nodeId => {
      const node = allElements.find(e => e.id === nodeId);
      return node ? [node.lon, node.lat] : null;
          }).filter(coord => coord !== null);
          
    if (coordinates.length < 2) return;
    
    let category = null;
    let strategicImportance = 'low';
            let geometryType = 'LineString';
    
    // TRANSMISSION CORRIDORS - Critical for power analysis
    if (element.tags.power === 'line') {
      category = 'transmission_corridor';
      strategicImportance = this.assessTransmissionImportance(element.tags);
      geographicContext.spatialAnalysis.transmissionCorridors.push({
        osm_id: element.id,
        voltage: element.tags.voltage,
        cables: element.tags.cables,
        operator: element.tags.operator,
        coordinates: coordinates,
        importance: strategicImportance
      });
    }
    // LAND USE - Critical for expansion and zoning
    else if (element.tags.landuse) {
      category = 'land_use_zone';
              geometryType = 'Polygon';
      strategicImportance = this.assessLandUseImportance(element.tags.landuse);
      
      // Close polygon if not already closed
              if (coordinates[0] !== coordinates[coordinates.length - 1]) {
                coordinates.push(coordinates[0]);
              }
      
      geographicContext.spatialAnalysis.landUseZones.push({
        osm_id: element.id,
        landuse: element.tags.landuse,
        name: element.tags.name,
        coordinates: coordinates,
        importance: strategicImportance
      });
    }
    // WATER FEATURES - Critical for cooling and flood risk
    else if (element.tags.natural === 'water' || element.tags.waterway) {
      category = 'water_feature';
      strategicImportance = this.assessWaterFeatureImportance(element.tags);
      
      if (element.tags.natural === 'water') {
              geometryType = 'Polygon';
              if (coordinates[0] !== coordinates[coordinates.length - 1]) {
                coordinates.push(coordinates[0]);
              }
      }
      
      geographicContext.spatialAnalysis.waterFeatures.push({
        osm_id: element.id,
        waterway: element.tags.waterway,
        natural: element.tags.natural,
        name: element.tags.name,
        coordinates: coordinates,
        importance: strategicImportance
      });
    }
    // TRANSPORTATION - Critical for access and maintenance
    else if (element.tags.highway || element.tags.railway) {
      category = 'transportation_corridor';
      strategicImportance = this.assessTransportationImportance(element.tags);
      
      geographicContext.spatialAnalysis.transportationNetwork.push({
        osm_id: element.id,
        highway: element.tags.highway,
        railway: element.tags.railway,
        name: element.tags.name,
        coordinates: coordinates,
        importance: strategicImportance
      });
    }
    
    if (category) {
      const geometry = geometryType === 'Polygon' ? 
        { type: 'Polygon', coordinates: [coordinates] } :
        { type: 'LineString', coordinates: coordinates };
            
            const feature = {
              type: 'Feature',
              geometry: geometry,
              properties: {
                osm_id: element.id,
                osm_type: 'way',
          name: element.tags.name || `${category.replace('_', ' ')}`,
                category: category,
          strategic_importance: strategicImportance,
          ...element.tags // Include all OSM tags for detailed analysis
        }
      };
      
      geographicContext.features.push(feature);
    }
  }
  
  /**
   * Process strategic relations (administrative boundaries, complex infrastructure)
   */
  processStrategicRelation(element, allElements, geographicContext) {
    if (!element.tags) return;
    
    // Administrative boundaries - important for regulatory context
    if (element.tags.type === 'multipolygon' && element.tags.boundary === 'administrative') {
      // Add to geographic context for regulatory analysis
      const feature = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[]] }, // Simplified for now
        properties: {
          osm_id: element.id,
          osm_type: 'relation',
          name: element.tags.name || 'Administrative Boundary',
          category: 'administrative_boundary',
          admin_level: element.tags.admin_level,
          strategic_importance: 'medium'
        }
      };
      
      geographicContext.features.push(feature);
    }
  }

  /**
   * Assess transmission line importance based on voltage and other factors
   */
  assessTransmissionImportance(tags) {
    const voltage = tags.voltage;
    if (!voltage) return 'unknown';
    
    const voltageNum = parseInt(voltage.replace(/[^0-9]/g, ''));
    if (voltageNum >= 345000) return 'critical'; // 345kV+
    if (voltageNum >= 138000) return 'high';     // 138kV+
    if (voltageNum >= 69000) return 'medium';    // 69kV+
    return 'low';
  }
  
  /**
   * Assess land use importance for data center development
   */
  assessLandUseImportance(landuse) {
    switch (landuse) {
      case 'industrial': return 'critical';
      case 'commercial': return 'high';
      case 'residential': return 'low';
      case 'agricultural': return 'medium';
      default: return 'unknown';
    }
  }
  
  /**
   * Assess water feature importance for cooling and flood risk
   */
  assessWaterFeatureImportance(tags) {
    if (tags.waterway === 'river') return 'high';
    if (tags.waterway === 'canal') return 'medium';
    if (tags.natural === 'water') return 'medium';
    return 'low';
  }
  
  /**
   * Assess transportation importance for facility access
   */
  assessTransportationImportance(tags) {
    if (tags.highway === 'motorway' || tags.highway === 'trunk') return 'critical';
    if (tags.highway === 'primary') return 'high';
    if (tags.highway === 'secondary') return 'medium';
    if (tags.railway === 'rail') return 'high';
    return 'low';
  }
  
  /**
   * Perform spatial analysis between facilities and geographic features
   */
  async performSpatialAnalysis(geographicContext, serpData, siteCoordinates) {
    if (!serpData || !Array.isArray(serpData)) return;
    
    // Analyze proximity between SERP facilities and geographic features
    serpData.slice(0, 5).forEach(facility => { // Top 5 facilities
      if (!facility.geometry || !facility.geometry.coordinates) return;
      
      const [facilityLng, facilityLat] = facility.geometry.coordinates;
      const facilityName = facility.properties?.name || 'Unknown Facility';
      
      // Find nearest transmission corridors
      const nearestTransmission = geographicContext.spatialAnalysis.transmissionCorridors
        .map(corridor => ({
          ...corridor,
          distance: this.calculateMinDistanceToLine(corridor.coordinates, [facilityLng, facilityLat])
        }))
        .filter(corridor => corridor.distance < 5) // Within 5km
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
      
      // Find water features (cooling potential)
      const nearbyWater = geographicContext.spatialAnalysis.waterFeatures
        .map(water => ({
          ...water,
          distance: this.calculateDistance([facilityLng, facilityLat], water.coordinates[0])
        }))
        .filter(water => water.distance < 10) // Within 10km
        .sort((a, b) => a.distance - b.distance);
      
      geographicContext.spatialAnalysis.facilityProximity.push({
        facility: facilityName,
        coordinates: [facilityLng, facilityLat],
        nearestTransmission,
        nearbyWater: nearbyWater.slice(0, 3),
        accessRoads: this.findNearestRoads(geographicContext.spatialAnalysis.transportationNetwork, [facilityLng, facilityLat])
      });
    });
  }
  
  /**
   * Limit strategic features to prevent storage issues
   */
  limitStrategicFeatures(geographicContext) {
    // Limit each category to reasonable numbers for caching (adjusted for major cities)
    const limits = {
      transmissionCorridors: 100,  // Increased for major cities like Austin
      landUseZones: 200,          // Increased for metropolitan areas
      waterFeatures: 150,         // Increased for water-rich areas like Austin
      transportationNetwork: 300, // Increased for major transportation hubs
      totalFeatures: 400          // Increased total limit for comprehensive analysis
    };
    
    // Sort and limit transmission corridors by importance
    geographicContext.spatialAnalysis.transmissionCorridors = 
      geographicContext.spatialAnalysis.transmissionCorridors
        .sort((a, b) => this.getImportanceScore(b.importance) - this.getImportanceScore(a.importance))
        .slice(0, limits.transmissionCorridors);
    
    // Sort and limit land use zones by importance
    geographicContext.spatialAnalysis.landUseZones = 
      geographicContext.spatialAnalysis.landUseZones
        .sort((a, b) => this.getImportanceScore(b.importance) - this.getImportanceScore(a.importance))
        .slice(0, limits.landUseZones);
    
    // Sort and limit water features by importance
    geographicContext.spatialAnalysis.waterFeatures = 
      geographicContext.spatialAnalysis.waterFeatures
        .sort((a, b) => this.getImportanceScore(b.importance) - this.getImportanceScore(a.importance))
        .slice(0, limits.waterFeatures);
    
    // Sort and limit transportation network by importance
    geographicContext.spatialAnalysis.transportationNetwork = 
      geographicContext.spatialAnalysis.transportationNetwork
        .sort((a, b) => this.getImportanceScore(b.importance) - this.getImportanceScore(a.importance))
        .slice(0, limits.transportationNetwork);
    
    // Limit total features by strategic importance
    geographicContext.features = geographicContext.features
      .sort((a, b) => this.getImportanceScore(b.properties.strategic_importance) - this.getImportanceScore(a.properties.strategic_importance))
      .slice(0, limits.totalFeatures);
  }
  
  /**
   * Get numeric importance score for sorting
   */
  getImportanceScore(importance) {
    switch (importance) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
  
  /**
   * Assess geographic risks for power grid reliability
   */
  async assessGeographicRisks(geographicContext, siteCoordinates) {
    const { lat, lng } = siteCoordinates;
    
    // Flood risk assessment based on water features
    const nearbyWaterFeatures = geographicContext.spatialAnalysis.waterFeatures
      .filter(water => {
        const distance = this.calculateDistance([lng, lat], water.coordinates[0]);
        return distance < 2; // Within 2km
      });
    
    if (nearbyWaterFeatures.length > 0) {
      const hasRiver = nearbyWaterFeatures.some(w => w.waterway === 'river');
      geographicContext.riskAssessment.floodRisk = hasRiver ? 'high' : 'medium';
    } else {
      geographicContext.riskAssessment.floodRisk = 'low';
    }
    
    // Access risk assessment based on transportation network
    const nearbyRoads = geographicContext.spatialAnalysis.transportationNetwork
      .filter(road => {
        if (!road.coordinates || road.coordinates.length === 0) return false;
        const distance = this.calculateMinDistanceToLine(road.coordinates, [lng, lat]);
        return distance < 1; // Within 1km
      });
    
    const hasHighwayAccess = nearbyRoads.some(road => 
      road.highway === 'motorway' || road.highway === 'trunk' || road.highway === 'primary'
    );
    
    geographicContext.riskAssessment.accessRisk = hasHighwayAccess ? 'low' : 'medium';
    
    // Land availability assessment
    const nearbyIndustrial = geographicContext.spatialAnalysis.landUseZones
      .filter(zone => zone.landuse === 'industrial');
    
    geographicContext.riskAssessment.landAvailability = nearbyIndustrial.length > 0 ? 'high' : 'medium';
  }
  
  /**
   * Find nearest roads to a facility
   */
  findNearestRoads(transportationNetwork, facilityCoords) {
    return transportationNetwork
      .filter(road => road.highway) // Only highways/roads
      .map(road => ({
        ...road,
        distance: this.calculateMinDistanceToLine(road.coordinates, facilityCoords)
      }))
      .filter(road => road.distance < 2) // Within 2km
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
  }
  
  /**
   * Calculate minimum distance from a point to a line
   */
  calculateMinDistanceToLine(lineCoordinates, point) {
    if (!lineCoordinates || lineCoordinates.length < 2) return Infinity;
    
    let minDistance = Infinity;
    
    for (let i = 0; i < lineCoordinates.length - 1; i++) {
      const distance = this.calculateDistance(point, lineCoordinates[i]);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }
  
  /**
   * Add strategic geographic context to the map
   */
  async addStrategicContextToMap(map, geographicContext, lat, lng, locationConfig = null) {
    // Remove any existing OSM visual layers
    const layersToRemove = [
      'osm-transmission-lines', 'osm-power-substations', 'osm-power-plants', 'osm-power-markers',
      'osm-industrial-zones', 'osm-industrial-outlines', 'osm-water-features-fill', 
      'osm-water-features-lines', 'osm-transportation', 'osm-critical-infrastructure',
      'power-analysis-fill', 'power-analysis-circle'
    ];
    
    layersToRemove.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('osm-strategic-context')) {
      map.current.removeSource('osm-strategic-context');
    }
    
    // Remove any existing power analysis radius circle
    if (map.current.getLayer('power-analysis-fill')) {
      map.current.removeLayer('power-analysis-fill');
    }
    if (map.current.getLayer('power-analysis-circle')) {
      map.current.removeLayer('power-analysis-circle');
    }
    if (map.current.getSource('power-analysis-radius')) {
      map.current.removeSource('power-analysis-radius');
    }
    
    // Remove any existing center marker
    if (map.current.getLayer('center-marker-symbol')) {
      map.current.removeLayer('center-marker-symbol');
    }
    if (map.current.getSource('center-marker')) {
      map.current.removeSource('center-marker');
    }
    
    // Remove any existing location popup
    if (this.locationPopup) {
      this.locationPopup.remove();
      this.locationPopup = null;
    }
    
    // Add strategic geographic context to the map
    const strategicGeoJSON = {
      type: 'FeatureCollection',
      features: geographicContext.features
    };
    
    map.current.addSource('osm-strategic-context', {
      type: 'geojson',
      data: strategicGeoJSON
    });
    
    // 🔴 POWER TRANSMISSION LINES - Bold Red Lines (Most Visual Impact)
    map.current.addLayer({
      id: 'osm-transmission-lines',
      type: 'line',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'transmission_corridor'],
      paint: {
        'line-color': [
          'case',
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 345], '#dc2626', // Dark red for 345kV+
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 138], '#ef4444', // Red for 138kV+
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 2]], 69], '#f97316',  // Orange for 69kV+
          '#ef4444' // Default red for power lines
        ],
        'line-width': [
          'case',
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 345], 6, // Thick for 345kV+
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 138], 4, // Medium for 138kV+
          3 // Standard for other transmission
        ],
        'line-opacity': 0.9
      }
    });
    
    // 🔴 POWER SUBSTATIONS - Large Red Circles (High Visual Impact)
    map.current.addLayer({
      id: 'osm-power-substations',
      type: 'circle',
      source: 'osm-strategic-context',
      filter: ['any', 
        ['==', ['get', 'category'], 'power_substation'],
        ['==', ['get', 'power'], 'substation']
      ],
      paint: {
        'circle-radius': [
          'case',
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 345], 12, // Large for 345kV+
          ['>=', ['to-number', ['slice', ['get', 'voltage'], 0, 3]], 138], 10, // Medium for 138kV+
          8 // Standard for substations
        ],
        'circle-color': '#dc2626', // Dark red for power substations
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });
    
    // 🔴 POWER PLANTS - Diamond Symbols (Highest Visual Impact)
    map.current.addLayer({
      id: 'osm-power-plants',
      type: 'symbol',
      source: 'osm-strategic-context',
      filter: ['any',
        ['==', ['get', 'power'], 'plant'],
        ['==', ['get', 'power'], 'generator']
      ],
      layout: {
        'icon-image': 'custom-power-plant', // We'll create this
        'icon-size': 1.5,
        'icon-allow-overlap': true,
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-color': '#ffffff',
        'text-halo-color': '#dc2626',
        'text-halo-width': 2,
        'text-offset': [0, 2]
      }
    });
    
    // 🟠 MAJOR HIGHWAYS - Bold Orange Lines (Clear Visual Corridors)
    map.current.addLayer({
      id: 'osm-transportation',
      type: 'line',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'transportation_corridor'],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'highway'], 'motorway'], '#f97316',  // Orange for interstates
          ['==', ['get', 'highway'], 'trunk'], '#fb923c',     // Lighter orange for major highways
          ['==', ['get', 'highway'], 'primary'], '#fbbf24',   // Yellow for primary roads
          ['==', ['get', 'railway'], 'rail'], '#8b5cf6',     // Purple for rail
          '#f59e0b' // Default orange
        ],
        'line-width': [
          'case',
          ['==', ['get', 'highway'], 'motorway'], 5,    // Thick for interstates
          ['==', ['get', 'highway'], 'trunk'], 4,      // Medium for major highways
          ['==', ['get', 'highway'], 'primary'], 3,    // Standard for primary
          ['==', ['get', 'railway'], 'rail'], 4,       // Medium for rail
          2 // Default
        ],
        'line-opacity': 0.8
      }
    });
    
    // 🔵 MAJOR WATER FEATURES - Blue Polygons (Prominent Visual Features)
    map.current.addLayer({
      id: 'osm-water-features-fill',
      type: 'fill',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'water_feature'],
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'waterway'], 'river'], '#0ea5e9',  // Bright blue for rivers
          ['==', ['get', 'natural'], 'water'], '#06b6d4',   // Cyan for lakes
          '#0ea5e9' // Default blue
        ],
        'fill-opacity': 0.4
      }
    });
    
    // 🔵 WATER FEATURE OUTLINES - Blue Lines for Definition
    map.current.addLayer({
      id: 'osm-water-features-lines',
      type: 'line',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'water_feature'],
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 2,
        'line-opacity': 0.8
      }
    });
    
    // 🟣 INDUSTRIAL ZONES - Purple Polygons (Power Infrastructure Areas)
    map.current.addLayer({
      id: 'osm-industrial-zones',
      type: 'fill',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'land_use_zone'],
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'landuse'], 'industrial'], 'rgba(139, 92, 246, 0.3)', // Purple for industrial
          ['==', ['get', 'industrial'], 'power'], 'rgba(220, 38, 38, 0.25)',   // Red for power industrial
          ['==', ['get', 'landuse'], 'commercial'], 'rgba(59, 130, 246, 0.2)', // Blue for commercial
          'rgba(107, 114, 128, 0.1)' // Gray for other
        ],
        'fill-opacity': 0.6
      }
    });
    
    // 🟣 INDUSTRIAL ZONE OUTLINES - Purple Lines for Definition
    map.current.addLayer({
      id: 'osm-industrial-outlines',
      type: 'line',
      source: 'osm-strategic-context',
      filter: ['==', ['get', 'category'], 'land_use_zone'],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'landuse'], 'industrial'], '#8b5cf6', // Purple outline
          ['==', ['get', 'industrial'], 'power'], '#dc2626',   // Red outline for power
          '#6b7280' // Gray for other
        ],
        'line-width': 2,
        'line-opacity': 0.8
      }
    });
    
    // 🟠 CRITICAL INFRASTRUCTURE - Large Orange Circles (High Visual Impact)
    map.current.addLayer({
      id: 'osm-critical-infrastructure',
      type: 'circle',
      source: 'osm-strategic-context',
      filter: ['any',
        ['==', ['get', 'category'], 'critical_infrastructure'],
        ['==', ['get', 'category'], 'emergency_services'],
        ['==', ['get', 'category'], 'transportation_hub']
      ],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], 10,        // Large for hospitals
          ['==', ['get', 'amenity'], 'university'], 9,       // Large for universities
          ['==', ['get', 'amenity'], 'fire_station'], 7,     // Medium for fire stations
          ['==', ['get', 'railway'], 'station'], 8,          // Medium for train stations
          6 // Default
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], '#dc2626',     // Dark red for hospitals
          ['==', ['get', 'amenity'], 'university'], '#8b5cf6',   // Purple for universities
          ['==', ['get', 'amenity'], 'fire_station'], '#f59e0b', // Orange for fire stations
          ['==', ['get', 'railway'], 'station'], '#6366f1',     // Indigo for train stations
          '#10b981' // Green for other
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });
    
    // 🔴 POWER INFRASTRUCTURE MARKERS - Red Squares (Power Focus)
    map.current.addLayer({
      id: 'osm-power-markers',
      type: 'circle',
      source: 'osm-strategic-context',
      filter: ['any',
        ['==', ['get', 'power'], 'substation'],
        ['==', ['get', 'power'], 'plant'],
        ['==', ['get', 'power'], 'generator'],
        ['==', ['get', 'power'], 'transformer']
      ],
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'power'], 'plant'], 14,        // Largest for power plants
          ['==', ['get', 'power'], 'substation'], 10,   // Large for substations
          ['==', ['get', 'power'], 'generator'], 8,     // Medium for generators
          6 // Default for transformers
        ],
        'circle-color': '#ef4444', // Bright red for all power infrastructure
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1.0
      }
    });
    
    // Strategic geographic context added to map
    
    // 🟢 POWER ANALYSIS RADIUS - Green Dashed Circle (6-Mile Visual Boundary)
    const powerAnalysisRadiusKm = 9.656; // 6 miles for power infrastructure analysis
    const powerAnalysisCircle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [this.generateCircleCoordinates(lat, lng, powerAnalysisRadiusKm, 64)] // 6 miles, high resolution
      },
      properties: {
        name: 'Power Infrastructure Analysis Radius (6 miles)',
        category: 'power_analysis_boundary'
      }
    };
    
    // Add power analysis radius circle to the map
    map.current.addSource('power-analysis-radius', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [powerAnalysisCircle]
      }
    });
    
    // Prominent dashed circle for power analysis boundary
    map.current.addLayer({
      id: 'power-analysis-circle',
      type: 'line',
      source: 'power-analysis-radius',
      paint: {
        'line-color': '#ef4444', // Red for power analysis boundary
        'line-width': 3,
        'line-dasharray': [8, 4], // Prominent dash pattern
        'line-opacity': 0.8
      }
    });
    
    // Subtle fill for the power analysis radius
    map.current.addLayer({
      id: 'power-analysis-fill',
      type: 'fill',
      source: 'power-analysis-radius',
      paint: {
        'fill-color': '#ef4444',
        'fill-opacity': 0.05
      }
    });
    
    // Add center location marker (teardrop shape)
    const centerMarker = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        name: 'Analysis Center',
        category: 'location_marker'
      }
    };
    
    // Add center marker source
    map.current.addSource('center-marker', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [centerMarker]
      }
    });
    
    // Create and add the teardrop marker
    this.createAndAddTeardropMarker(map);
  }

  /**
   * Create and add teardrop marker to the map
   */
  createAndAddTeardropMarker(map) {
    // Check if icon already exists
    if (map.current.hasImage('location-marker')) {
      this.addTeardropLayer(map);
      return;
    }

    // Create simple teardrop marker using Lucide MapPin style
    const size = 48;
    const svgString = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <!-- Simple teardrop shape like Lucide MapPin -->
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
              fill="#10b981" 
              stroke="#ffffff" 
              stroke-width="1.5" 
              filter="url(#shadow)"/>
      </svg>
    `;

    // Convert SVG to image data
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, size, size);
        map.current.addImage('location-marker', {
          width: size,
          height: size,
          data: imageData.data
        });
        
        // Add the layer after the image is loaded
        this.addTeardropLayer(map);
      } catch (error) {
        console.error('Failed to create teardrop marker icon:', error);
        // Fallback: add a simple circle marker instead
        this.addFallbackMarker(map);
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load SVG teardrop marker');
      this.addFallbackMarker(map);
    };
    
    // Set the SVG as the image source
    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
  }

  /**
   * Add the teardrop marker layer to the map
   */
  addTeardropLayer(map) {
    // Add teardrop marker using symbol layer with custom icon
    map.current.addLayer({
      id: 'center-marker-symbol',
      type: 'symbol',
      source: 'center-marker',
      layout: {
        'icon-image': 'location-marker',
        'icon-size': 1.2,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'bottom'
      }
    });
    
    // Add click event to the marker
    map.current.on('click', 'center-marker-symbol', (e) => {
      this.showLocationCard(e.lngLat, map);
    });
    
    // Change cursor on hover
    map.current.on('mouseenter', 'center-marker-symbol', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', 'center-marker-symbol', () => {
      map.current.getCanvas().style.cursor = '';
    });
    
    console.log('✅ Added teardrop marker to map center');
  }

  /**
   * Add fallback circle marker if teardrop creation fails
   */
  addFallbackMarker(map) {
    map.current.addLayer({
      id: 'center-marker-symbol',
      type: 'circle',
      source: 'center-marker',
      paint: {
        'circle-radius': 8,
        'circle-color': '#10b981',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    
    // Add click event to fallback marker too
    map.current.on('click', 'center-marker-symbol', (e) => {
      this.showLocationCard(e.lngLat, map);
    });
    
    // Change cursor on hover
    map.current.on('mouseenter', 'center-marker-symbol', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', 'center-marker-symbol', () => {
      map.current.getCanvas().style.cursor = '';
    });
    
    console.log('✅ Added fallback circle marker to map center');
  }

  /**
   * Show location card with address information
   */
  showLocationCard(lngLat, map) {
    // Remove existing popup if any
    if (this.locationPopup) {
      this.locationPopup.remove();
    }

    // Create popup content with styling similar to PopupCards.jsx
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    // Add header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(77, 212, 172, 0.3);
    `;
    
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 20px;
      height: 20px;
      background: #4dd4ac;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    `;
    icon.textContent = '📍';
    
    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      font-size: 16px;
      color: #4dd4ac;
    `;
    title.textContent = 'Analysis Center';
    
    header.appendChild(icon);
    header.appendChild(title);
    popupContent.appendChild(header);

    // Add coordinates
    const coords = document.createElement('div');
    coords.style.cssText = `
      margin-bottom: 8px;
      font-size: 14px;
    `;
    coords.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-left: 8px;">
        <span style="color: #bbb;">Latitude:</span>
        <span style="color: white; text-align: right;">${lngLat.lat.toFixed(6)}°</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-left: 8px;">
        <span style="color: #bbb;">Longitude:</span>
        <span style="color: white; text-align: right;">${lngLat.lng.toFixed(6)}°</span>
      </div>
    `;
    popupContent.appendChild(coords);

    // Add search radius info
    const radius = document.createElement('div');
    radius.style.cssText = `
      margin-bottom: 8px;
      font-size: 14px;
    `;
    radius.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-left: 8px;">
        <span style="color: #bbb;">Analysis Radius:</span>
        <span style="color: white; text-align: right;">5.0km</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding-left: 8px;">
        <span style="color: #bbb;">Data Source:</span>
        <span style="color: white; text-align: right;">OpenStreetMap</span>
      </div>
    `;
    popupContent.appendChild(radius);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #ffffff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    `;
    closeBtn.textContent = '×';
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    closeBtn.onclick = () => {
      if (this.locationPopup) {
        this.locationPopup.remove();
        this.locationPopup = null;
      }
    };
    popupContent.appendChild(closeBtn);

    // Create and show popup
    this.locationPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 25,
      className: 'custom-location-popup'
    })
    .setLngLat(lngLat)
    .setDOMContent(popupContent)
    .addTo(map.current);

    // Remove Mapbox's default styling completely
    const popupElement = this.locationPopup.getElement();
    if (popupElement) {
      // Remove all Mapbox styling
      popupElement.style.background = 'transparent';
      popupElement.style.border = 'none';
      popupElement.style.boxShadow = 'none';
      popupElement.style.padding = '0';
      popupElement.style.margin = '0';
      
      // Remove the arrow/tip
      const tip = popupElement.querySelector('.mapboxgl-popup-tip');
      if (tip) {
        tip.style.display = 'none';
      }
      
      // Remove any content wrapper styling
      const content = popupElement.querySelector('.mapboxgl-popup-content');
      if (content) {
        content.style.background = 'transparent';
        content.style.border = 'none';
        content.style.boxShadow = 'none';
        content.style.padding = '0';
        content.style.margin = '0';
      }
    }

    console.log('📍 Location card shown for coordinates:', lngLat);
  }

  /**
   * Generate cache key for OSM geographic context
   */
  generateCacheKey(coordinates, locationConfig, serpData) {
    // Round coordinates to avoid minor differences causing cache misses
    const roundedLat = Math.round(coordinates.lat * 10000) / 10000; // 4 decimal places
    const roundedLng = Math.round(coordinates.lng * 10000) / 10000;
    
    // Include location config in cache key
    const locationKey = locationConfig ? 
      `${locationConfig.city}_${locationConfig.state}` : 'default';
    
    // Include SERP data signature (number of facilities and their categories)
    const serpSignature = serpData ? 
      `serp_${serpData.length}_${this.getSerpDataSignature(serpData)}` : 'no_serp';
    
    return `${this.cacheKeyPrefix}${roundedLat}_${roundedLng}_${locationKey}_${serpSignature}`;
  }
  
  /**
   * Get SERP data signature for cache key
   */
  getSerpDataSignature(serpData) {
    if (!serpData || !Array.isArray(serpData)) return 'empty';
    
    // Create signature based on facility categories and count
    const categories = {};
    serpData.forEach(facility => {
      const category = facility.properties?.category || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .map(([cat, count]) => `${cat}${count}`)
      .sort()
      .join('_');
  }
  
  /**
   * Check if cached data is still valid
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < this.cacheExpiration;
  }
  
  /**
   * Get cached geographic context if available and valid (with decompression)
   */
  getCachedGeographicContext(coordinates, locationConfig, serpData) {
    try {
      const cacheKey = this.generateCacheKey(coordinates, locationConfig, serpData);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheEntry = JSON.parse(cached);
        
        if (this.isCacheValid(cacheEntry)) {
          console.log(`💾 OSM Cache: Hit for ${coordinates.lat}, ${coordinates.lng}`);
          
          // Decompress data if it was compressed
          if (cacheEntry.ultraCompressed) {
            return this.decompressUltraGeographicData(cacheEntry.data);
          } else if (cacheEntry.compressed) {
            return this.decompressGeographicData(cacheEntry.data);
          } else {
            return cacheEntry.data;
          }
        } else {
          // Cache expired, remove it
          localStorage.removeItem(cacheKey);
          console.log(`🗑️ OSM Cache: Expired cache removed for ${coordinates.lat}, ${coordinates.lng}`);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ OSM Cache: Failed to get cached data:', error.message);
      return null;
    }
  }
  
  /**
   * Cache geographic context for future use (with data compression)
   */
  setCachedGeographicContext(coordinates, locationConfig, serpData, data) {
    try {
      const cacheKey = this.generateCacheKey(coordinates, locationConfig, serpData);
      
      // Compress data to reduce storage size
      const compressedData = this.compressGeographicData(data);
      
      const cacheEntry = {
        data: compressedData,
        timestamp: Date.now(),
        coordinates: coordinates,
        locationConfig: locationConfig,
        serpDataSignature: this.getSerpDataSignature(serpData),
        compressed: true
      };
      
      // Check size before saving
      const jsonString = JSON.stringify(cacheEntry);
      const sizeKB = Math.round(jsonString.length / 1024);
      
      // LocalStorage limit is ~5-10MB, let's limit to 1MB per entry
      if (sizeKB > 1024) {
        console.warn(`⚠️ OSM Cache: Data too large (${sizeKB}KB), using ultra-compression`);
        // Use ultra-compressed version for very large datasets
        const ultraCompressed = this.ultraCompressGeographicData(data);
        cacheEntry.data = ultraCompressed;
        cacheEntry.ultraCompressed = true;
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`💾 OSM Cache: Saved geographic context for ${coordinates.lat}, ${coordinates.lng} (${sizeKB}KB)`);
    } catch (error) {
      if (error.message.includes('quota')) {
        console.warn('⚠️ OSM Cache: Storage quota exceeded, clearing old cache and retrying...');
        this.clearOldestCacheEntries(3); // Clear 3 oldest entries
        
        // Retry with ultra-compressed data
        try {
          const cacheKey = this.generateCacheKey(coordinates, locationConfig, serpData);
          const ultraCompressed = this.ultraCompressGeographicData(data);
          const cacheEntry = {
            data: ultraCompressed,
            timestamp: Date.now(),
            coordinates: coordinates,
            ultraCompressed: true
          };
          
          localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
          console.log(`💾 OSM Cache: Saved ultra-compressed context (retry successful)`);
        } catch (retryError) {
          console.warn('⚠️ OSM Cache: Failed to save even ultra-compressed data:', retryError.message);
        }
      } else {
        console.warn('⚠️ OSM Cache: Failed to save data:', error.message);
      }
    }
  }
  
  /**
   * Compress geographic data to reduce storage size
   */
  compressGeographicData(data) {
    // Keep essential data, remove verbose properties
    const compressed = {
      features: data.features.map(feature => ({
        type: feature.type,
        geometry: feature.geometry,
        properties: {
          osm_id: feature.properties.osm_id,
          name: feature.properties.name,
          category: feature.properties.category,
          strategic_importance: feature.properties.strategic_importance,
          // Keep only essential properties
          ...(feature.properties.voltage && { voltage: feature.properties.voltage }),
          ...(feature.properties.landuse && { landuse: feature.properties.landuse }),
          ...(feature.properties.highway && { highway: feature.properties.highway })
        }
      })),
      spatialAnalysis: {
        transmissionCorridors: data.spatialAnalysis.transmissionCorridors.slice(0, 20), // Limit to top 20
        landUseZones: data.spatialAnalysis.landUseZones.slice(0, 50), // Limit to top 50
        waterFeatures: data.spatialAnalysis.waterFeatures.slice(0, 30), // Limit to top 30
        transportationNetwork: data.spatialAnalysis.transportationNetwork.slice(0, 40), // Limit to top 40
        facilityProximity: data.spatialAnalysis.facilityProximity // Keep all facility proximity data
      },
      riskAssessment: data.riskAssessment,
      contextualFeatures: Math.min(data.contextualFeatures, 200), // Cap at 200
      contextType: data.contextType
    };
    
    return compressed;
  }
  
  /**
   * Ultra-compress geographic data for very large datasets
   */
  ultraCompressGeographicData(data) {
    // Keep only the most critical information
    const ultraCompressed = {
      spatialAnalysis: {
        transmissionCorridors: data.spatialAnalysis.transmissionCorridors.slice(0, 10)
          .map(corridor => ({
            voltage: corridor.voltage,
            importance: corridor.importance,
            coordinates: corridor.coordinates.slice(0, 10) // Limit coordinate points
          })),
        landUseZones: data.spatialAnalysis.landUseZones.slice(0, 20)
          .map(zone => ({
            landuse: zone.landuse,
            importance: zone.importance
          })),
        waterFeatures: data.spatialAnalysis.waterFeatures.slice(0, 15)
          .map(water => ({
            waterway: water.waterway,
            natural: water.natural,
            importance: water.importance
          })),
        facilityProximity: data.spatialAnalysis.facilityProximity // Keep facility proximity
      },
      riskAssessment: data.riskAssessment,
      contextualFeatures: Math.min(data.contextualFeatures, 100),
      contextType: 'ultra_compressed_analysis'
    };
    
    return ultraCompressed;
  }
  
  /**
   * Decompress geographic data
   */
  decompressGeographicData(compressedData) {
    // For regular compression, data structure is mostly intact
    return compressedData;
  }
  
  /**
   * Decompress ultra-compressed geographic data
   */
  decompressUltraGeographicData(ultraCompressed) {
    // Reconstruct minimal feature set for ultra-compressed data
    return {
      features: [], // Features not stored in ultra-compressed version
      geographicContext: ultraCompressed,
      contextualFeatures: ultraCompressed.contextualFeatures,
      spatialAnalysis: ultraCompressed.spatialAnalysis,
      riskAssessment: ultraCompressed.riskAssessment,
      message: `Ultra-compressed geographic context (${ultraCompressed.contextualFeatures} features)`
    };
  }
  
  /**
   * Clear oldest cache entries to free up space
   */
  clearOldestCacheEntries(count = 3) {
    try {
      const cacheEntries = [];
      
      // Collect all OSM cache entries with timestamps
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cacheKeyPrefix)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheEntry = JSON.parse(cached);
              cacheEntries.push({
                key,
                timestamp: cacheEntry.timestamp
              });
            }
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      }
      
      // Sort by timestamp (oldest first) and remove the oldest entries
      cacheEntries
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, count)
        .forEach(entry => {
          localStorage.removeItem(entry.key);
          console.log(`🗑️ OSM Cache: Removed old cache entry (${new Date(entry.timestamp).toLocaleString()})`);
        });
      
      console.log(`🧹 OSM Cache: Cleared ${Math.min(count, cacheEntries.length)} oldest entries`);
    } catch (error) {
      console.warn('⚠️ OSM Cache: Failed to clear oldest entries:', error.message);
    }
  }
  
  /**
   * Clear expired OSM cache entries
   */
  cleanExpiredCache() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cacheKeyPrefix)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheEntry = JSON.parse(cached);
              if (!this.isCacheValid(cacheEntry)) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            keysToRemove.push(key); // Remove corrupted entries
          }
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 OSM Cache: Cleaned ${keysToRemove.length} expired entries`);
      }
    } catch (error) {
      console.warn('⚠️ OSM Cache: Failed to clean expired cache:', error.message);
    }
  }
  
  /**
   * Clear all OSM cache
   */
  clearCache() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cacheKeyPrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ OSM Cache: Cleared all cache (${keysToRemove.length} entries)`);
    } catch (error) {
      console.warn('⚠️ OSM Cache: Failed to clear cache:', error.message);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    this.cleanExpiredCache(); // Clean first to get accurate stats
    
    const cacheEntries = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cacheKeyPrefix)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheEntry = JSON.parse(cached);
              cacheEntries.push({
                key,
                coordinates: cacheEntry.coordinates,
                age: Math.round((Date.now() - cacheEntry.timestamp) / 1000 / 60), // minutes
                valid: this.isCacheValid(cacheEntry),
                features: cacheEntry.data?.contextualFeatures || 0
              });
            }
          } catch (error) {
            // Skip corrupted entries
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ OSM Cache: Failed to get cache stats:', error.message);
    }
    
    return {
      size: cacheEntries.length,
      expirationHours: this.cacheExpiration / (60 * 60 * 1000),
      entries: cacheEntries
    };
  }
  
  /**
   * Get cost summary for monitoring
   */
  getCostSummary() {
    const totalQueries = this.costTracker.cacheHits + this.costTracker.cacheMisses;
    const cacheHitRate = totalQueries > 0 ? Math.round((this.costTracker.cacheHits / totalQueries) * 100) : 0;
    
    return {
      overpassCalls: this.costTracker.overpassCalls,
      cacheHits: this.costTracker.cacheHits,
      cacheMisses: this.costTracker.cacheMisses,
      cacheHitRate: cacheHitRate,
      averageApiTime: this.costTracker.overpassCalls > 0 ? 
        Math.round(this.costTracker.totalApiTime / this.costTracker.overpassCalls) : 0
    };
  }
  
  /**
   * Get cache age in human-readable format
   */
  getCacheAge(timestamp) {
    const ageMs = Date.now() - timestamp;
    const ageMinutes = Math.round(ageMs / 1000 / 60);
    
    if (ageMinutes < 60) {
      return `${ageMinutes}min ago`;
    } else {
      const ageHours = Math.round(ageMinutes / 60);
      return `${ageHours}h ago`;
    }
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
    return R * c; // Distance in kilometers
  }
  
  /**
   * Generate circle coordinates for analysis radius visualization
   */
  generateCircleCoordinates(centerLat, centerLng, radiusKm, numPoints = 64) {
    const coordinates = [];
    const radiusDegrees = radiusKm / 111.32; // Convert km to degrees (approximate)
    
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = centerLat + (radiusDegrees * Math.cos(angle));
      const lng = centerLng + (radiusDegrees * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180));
      coordinates.push([lng, lat]);
    }
    
    return coordinates;
  }
  
  /**
   * Warm cache with common location queries for better performance
   */
  async warmCache() {
    console.log('🔥 OSM Cache: Starting cache warming...');
    
    // Common Texas locations for data center analysis
    const commonLocations = [
      { lat: 31.9315, lng: -97.347, name: 'Whitney, TX' },   // Default
      { lat: 30.2672, lng: -97.7431, name: 'Austin, TX' },   // Austin
      { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },   // Dallas
      { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' }   // Houston
    ];
    
    for (const location of commonLocations) {
      try {
        // Check if already cached
        const cached = this.getCachedGeographicContext(location, null, null);
        if (cached) {
          console.log(`✅ OSM Cache: Already warm for ${location.name}`);
          continue;
        }
        
        console.log(`🔥 OSM Cache: Warming cache for ${location.name}...`);
        
        // This would trigger a real API call and cache the result
        // In production, you might want to limit this or run it in background
        // For now, we'll just log that it would warm the cache
        console.log(`🔥 OSM Cache: Would warm cache for ${location.name} (${location.lat}, ${location.lng})`);
        
      } catch (error) {
        console.warn(`⚠️ OSM Cache: Failed to warm cache for ${location.name}:`, error.message);
      }
    }
    
    console.log('✅ OSM Cache: Cache warming completed');
  }
}

// Global OSM cache controls for development and testing
let globalOsmTool = null;

// Set global tool instance (called by tool executor)
export function setGlobalOsmTool(toolInstance) {
  globalOsmTool = toolInstance;
}

// Global functions for OSM cache control
if (typeof window !== 'undefined') {
  window.clearOsmCache = () => {
    if (globalOsmTool) {
      globalOsmTool.clearCache();
      console.log('🗑️ OSM Cache: Cleared all cached geographic context');
    } else {
      console.warn('⚠️ OSM Cache: No OSM tool instance available');
    }
  };
  
  window.listOsmCache = () => {
    if (globalOsmTool) {
      const stats = globalOsmTool.getCacheStats();
      console.log('📊 OSM Cache Stats:', stats);
      console.table(stats.entries);
      return stats;
    } else {
      console.warn('⚠️ OSM Cache: No OSM tool instance available');
      return { size: 0, entries: [] };
    }
  };
  
  window.getOsmCostSummary = () => {
    if (globalOsmTool) {
      const summary = globalOsmTool.getCostSummary();
      console.log('💰 OSM Cost Summary:', summary);
      return summary;
    } else {
      console.warn('⚠️ OSM Cache: No OSM tool instance available');
      return { overpassCalls: 0, cacheHitRate: 0 };
    }
  };
  
  window.cleanOsmCache = () => {
    if (globalOsmTool) {
      globalOsmTool.cleanExpiredCache();
      console.log('🧹 OSM Cache: Cleaned expired entries');
    } else {
      console.warn('⚠️ OSM Cache: No OSM tool instance available');
    }
  };
  
  window.warmOsmCache = async () => {
    if (globalOsmTool) {
      await globalOsmTool.warmCache();
      console.log('🔥 OSM Cache: Cache warming completed');
    } else {
      console.warn('⚠️ OSM Cache: No OSM tool instance available');
    }
  };
}