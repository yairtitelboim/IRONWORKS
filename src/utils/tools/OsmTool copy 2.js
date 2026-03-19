/**
 * OsmTool - Visual Urban Startup Ecosystem Mapping for Boston/Cambridge Analysis
 * 
 * FOCUSED ROLE: Provides clear visual mapping of urban infrastructure within 3-mile radius
 * INTEGRATION: Complements SERP data with visual geographic context for startup ecosystem
 * PERFORMANCE: Optimized for sub-20 second execution with maximum visual impact
 */

// mapboxgl imported for popup functionality (if needed later)

export class OsmTool {
  constructor(cache, updateToolFeedback) {
    this.cache = cache;
    this.updateToolFeedback = updateToolFeedback;
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
    this.cacheKeyPrefix = 'osm_visual_context_';
    console.log('🔧 OsmTool constructor: Received cache with size:', cache?.size || 0, 'is Map:', cache instanceof Map);
  }

  /**
   * Execute OSM tool for visual urban startup ecosystem mapping
   */
  async execute(queries, coordinates, map = null, locationConfig = null, serpData = null) {
    const { lat, lng } = coordinates;
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🗺️ Mapping urban startup ecosystem...',
      progress: 30,
      details: `Visual analysis within 3-mile radius of ${locationConfig?.city || 'Boston'} startup ecosystem`
    });

    try {
      // Check local JSON file first (Boston area only)
      const isBostonArea = locationConfig?.city === 'Boston' || 
                          (coordinates.lat >= 42.2 && coordinates.lat <= 42.5 && 
                           coordinates.lng >= -71.3 && coordinates.lng <= -70.9);
      
      if (isBostonArea) {
        console.log('🔍 OSM: Checking for local Boston OSM data...');
        try {
          const response = await fetch('/osm-boston-cache.json');
          if (response.ok) {
            const cachedData = await response.json();
            console.log('⚡ OSM: Using local Boston OSM data file');
            
            // Load neighborhood boundaries first (keep existing behavior)
            await this.loadNeighborhoodBoundaries(map);
            
            // Load cached layers with staggered loading (3 seconds like API version)
            await this.addCachedLayersToMap(map, cachedData, lat, lng);
            
            // Emit cached OSM data to legend
            if (window.mapEventBus) {
              window.mapEventBus.emit('osm:geographicContext', {
                context: {
                  visualLayers: cachedData.visualLayers || {},
                  features: cachedData.features || []
                },
                timestamp: Date.now()
              });
            }
            
            this.updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: '⚡ Local Boston data loaded',
              progress: 100,
              details: `Used local Boston OSM data (${cachedData.features?.length || 0} features)`
            });
            
            return {
              success: true,
              tool: 'OSM',
              data: cachedData,
              cached: true,
              timestamp: Date.now()
            };
          }
        } catch (error) {
          console.log('📁 OSM: No local Boston data file found, proceeding with API call');
        }
      }
      
      // Fallback to memory cache
      const cacheKey = this.generateSimpleCacheKey(coordinates, locationConfig);
      console.log('🔍 OSM: Checking memory cache with key:', cacheKey);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        console.log('⚡ OSM: Using memory cached visual context');
        // Load cached layers immediately without staggered loading
        await this.addCachedLayersToMap(map, cached, lat, lng);
        
        // Emit cached OSM data to legend
        if (window.mapEventBus) {
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
          details: `Used cached urban startup ecosystem map (${cached.features.length} features)`
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
      const result = await this.executeVisualUrbanMapping(coordinates, map, locationConfig, serpData);
      
      // Cache the result
      this.saveToCache(cacheKey, result);
      
      // Save to local JSON file for Boston area
      if (isBostonArea) {
        this.saveToLocalFile(result);
      }
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'osm',
        status: '✅ Urban startup ecosystem mapping completed',
        progress: 100,
        details: `Mapped ${result.features.length} urban infrastructure features within 3-mile radius`
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
        status: 'OSM urban mapping failed - using fallback',
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
   * Execute focused visual urban startup ecosystem mapping
   */
  async executeVisualUrbanMapping(coordinates, map, locationConfig, serpData) {
    const { lat, lng } = coordinates;
    const visualRadius = 5000; // ~3 miles in meters (reduced for urban focus)
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'osm',
      status: '🔍 Querying urban infrastructure...',
      progress: 50,
      details: 'Searching for visual urban infrastructure within 3-mile radius'
    });

    // SIMPLIFIED VISUAL QUERY - Optimized for startup ecosystem with MIT focus
    const query = `
      [out:json][timeout:30];
      (
        // UNIVERSITIES AND RESEARCH INSTITUTIONS (Most important for startup ecosystem)
        node["amenity"="university"](around:${visualRadius}, ${lat}, ${lng});
        way["amenity"="university"](around:${visualRadius}, ${lat}, ${lng});
        node["amenity"="college"](around:${visualRadius}, ${lat}, ${lng});
        way["amenity"="college"](around:${visualRadius}, ${lat}, ${lng});
        
        // OFFICE BUILDINGS AND COMMERCIAL SPACES
        node["office"](around:${visualRadius}, ${lat}, ${lng});
        way["office"](around:${visualRadius}, ${lat}, ${lng});
        node["building"="office"](around:${visualRadius}, ${lat}, ${lng});
        way["building"="office"](around:${visualRadius}, ${lat}, ${lng});
        
        // PUBLIC TRANSPORTATION (T stops, bus stops)
        node["public_transport"="station"](around:${visualRadius}, ${lat}, ${lng});
        node["railway"="station"](around:${visualRadius}, ${lat}, ${lng});
        node["highway"="bus_stop"](around:${visualRadius}, ${lat}, ${lng});
        
        // MAJOR ROADS AND TRANSPORTATION - REMOVED per user request
        // way["highway"="motorway"](around:${visualRadius}, ${lat}, ${lng});
        // way["highway"="trunk"](around:${visualRadius}, ${lat}, ${lng});
        // way["highway"="primary"](around:${visualRadius}, ${lat}, ${lng});
        
        // PARKS AND PUBLIC SPACES (Networking venues)
        way["leisure"="park"](around:${visualRadius}, ${lat}, ${lng});
        way["amenity"="park"](around:${visualRadius}, ${lat}, ${lng});
        
        // WATER FEATURES (Charles River, etc.)
        way["natural"="water"](around:${visualRadius}, ${lat}, ${lng});
        way["waterway"="river"](around:${visualRadius}, ${lat}, ${lng});
        
        // COMMERCIAL AND MIXED-USE ZONES
        way["landuse"="commercial"](around:${visualRadius}, ${lat}, ${lng});
        way["landuse"="retail"](around:${visualRadius}, ${lat}, ${lng});
      );
      out body;
      >;
      out skel qt;
    `;
    
    // Execute query with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('⏰ OSM query timeout - aborting request after 90 seconds');
      controller.abort();
    }, 90000); // 90s timeout - increased for complex queries
    
    console.log('🌐 Executing OSM query for urban startup ecosystem...');
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
        status: '🎨 Creating urban map layers...',
      progress: 80,
        details: `Processing ${osmData.elements?.length || 0} urban elements`
      });

      // Process into visual features
      const visualFeatures = this.processVisualFeatures(osmData);
      
      // Add to map
      if (map?.current) {
        // Load neighborhood boundaries first
        await this.loadNeighborhoodBoundaries(map);
        await this.addVisualLayersToMap(map, visualFeatures, lat, lng);
      }
      
      // Emit OSM visual data to legend
    if (window.mapEventBus) {
        window.mapEventBus.emit('osm:geographicContext', {
          context: {
            visualLayers: visualFeatures.visualLayers,
            features: visualFeatures.features
          },
        timestamp: Date.now()
      });
    }

    // Emit OSM urban infrastructure data for Site Assessment Overview
    if (window.mapEventBus) {
      // Count major universities specifically
      const majorUniversities = visualFeatures.visualLayers.universities.filter(f => f.properties.is_major_university);
      const mitCount = majorUniversities.filter(f => f.properties.university_type === 'MIT').length;
      const harvardCount = majorUniversities.filter(f => f.properties.university_type === 'Harvard').length;
      const northeasternCount = majorUniversities.filter(f => f.properties.university_type === 'Northeastern').length;
      const buCount = majorUniversities.filter(f => f.properties.university_type === 'Boston University').length;
      const tuftsCount = majorUniversities.filter(f => f.properties.university_type === 'Tufts').length;
      
      window.mapEventBus.emit('osm:urbanInfrastructureData', {
        universitiesCount: visualFeatures.visualLayers.universities.length,
        majorUniversitiesCount: majorUniversities.length,
        mitCount: mitCount,
        harvardCount: harvardCount,
        northeasternCount: northeasternCount,
        buCount: buCount,
        tuftsCount: tuftsCount,
        officesCount: visualFeatures.visualLayers.offices.length,
        transportationAccess: visualFeatures.visualLayers.transportation.length > 0 ? 'Major transportation nearby' : 'Limited transportation',
        parksAccess: visualFeatures.visualLayers.parks.length > 0 ? 'Parks and public spaces available' : 'Limited public spaces',
        commercialZones: visualFeatures.visualLayers.commercial.length > 0 ? 'Commercial zones present' : 'Mixed land use',
        criticalInfrastructure: visualFeatures.visualLayers.critical.length > 0 ? 'Critical facilities nearby' : 'No critical facilities',
        timestamp: Date.now()
      });
    }
    
    // Count major universities for return data
    const majorUniversities = visualFeatures.visualLayers.universities.filter(f => f.properties.is_major_university);
    const mitCount = majorUniversities.filter(f => f.properties.university_type === 'MIT').length;
    const harvardCount = majorUniversities.filter(f => f.properties.university_type === 'Harvard').length;
    const northeasternCount = majorUniversities.filter(f => f.properties.university_type === 'Northeastern').length;
    const buCount = majorUniversities.filter(f => f.properties.university_type === 'Boston University').length;
    const tuftsCount = majorUniversities.filter(f => f.properties.university_type === 'Tufts').length;

    return {
        features: visualFeatures.features,
        urbanInfrastructure: visualFeatures.urbanInfrastructure,
        visualLayers: visualFeatures.visualLayers,
        message: `Mapped ${visualFeatures.features.length} visual urban infrastructure features`,
        // Urban infrastructure data for parseTableData
        universitiesCount: visualFeatures.visualLayers.universities.length,
        majorUniversitiesCount: majorUniversities.length,
        mitCount: mitCount,
        harvardCount: harvardCount,
        northeasternCount: northeasternCount,
        buCount: buCount,
        tuftsCount: tuftsCount,
        officesCount: visualFeatures.visualLayers.offices.length,
        transportationAccess: visualFeatures.visualLayers.transportation.length > 0 ? 'Major transportation nearby' : 'Limited transportation',
        parksAccess: visualFeatures.visualLayers.parks.length > 0 ? 'Parks and public spaces available' : 'Limited public spaces',
        commercialZones: visualFeatures.visualLayers.commercial.length > 0 ? 'Commercial zones present' : 'Mixed land use',
        criticalInfrastructure: visualFeatures.visualLayers.critical.length > 0 ? 'Critical facilities nearby' : 'No critical facilities'
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Provide more specific error messages
      if (error.name === 'AbortError') {
        throw new Error('OSM query timed out after 90 seconds. The query may be too complex or the server is overloaded.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Failed to connect to OSM API. Please check your internet connection.');
      } else {
        throw new Error(`OSM API error: ${error.message}`);
      }
    }
  }

  /**
   * Process OSM data into visual features for urban startup ecosystem analysis
   */
  processVisualFeatures(osmData) {
    const features = [];
    const urbanInfrastructure = [];
    const visualLayers = {
      universities: [],
      offices: [],
      transportation: [],
      parks: [],
      water: [],
      commercial: [],
      critical: []
    };

    if (!osmData.elements) {
      return { features, urbanInfrastructure, visualLayers };
    }
      
      osmData.elements.forEach(element => {
        
        if (element.type === 'node') {
          this.processVisualNode(element, features, visualLayers);
        } else if (element.type === 'way' && element.nodes && element.nodes.length > 0) {
          this.processVisualWay(element, osmData.elements, features, visualLayers);
        }
      });
      
    // Extract urban infrastructure for analysis
    urbanInfrastructure.push(...visualLayers.universities, ...visualLayers.offices);

    // Summary logging only
    const totalUrbanInfrastructure = visualLayers.universities.length + visualLayers.offices.length + visualLayers.transportation.length + visualLayers.parks.length;
    // OSM Visual Summary generated

    return { features, urbanInfrastructure, visualLayers };
  }

  /**
   * Process visual nodes (urban infrastructure, universities, offices)
   */
  processVisualNode(element, features, visualLayers) {
    if (!element.tags) return;

    let category = null;
    let visualLayer = null;
    let isMajorUniversity = false;

    // Check if this is a major university by name (enhanced)
    const name = (element.tags.name || '').toLowerCase();
    const isMIT = name.includes('mit') || 
                  name.includes('massachusetts institute') ||
                  name.includes('mit ') ||
                  name.includes(' mit') ||
                  name.includes('mit campus') ||
                  name.includes('mit building') ||
                  name.includes('mit ') ||
                  name.includes('mit-') ||
                  name.includes('mit/');
    const isHarvard = (name.includes('harvard') && 
                      !name.includes('harvard square') &&
                      !name.includes('harvard street') &&
                      !name.includes('harvard ')) ||
                      name.includes('harvard university') ||
                      name.includes('harvard law') ||
                      name.includes('harvard school') ||
                      name.includes('harvard ') ||
                      name.includes('harvard-') ||
                      name.includes('harvard/');
    const isNortheastern = name.includes('northeastern') ||
                          name.includes('northeastern university');
    const isBostonUniversity = name.includes('boston university') ||
                              name.includes('boston u') ||
                              name.includes('bu ') ||
                              name.includes('bu-') ||
                              name.includes('bu/');
    const isTufts = name.includes('tufts') ||
                    name.includes('tufts university') ||
                    name.includes('tufts ') ||
                    name.includes('tufts-') ||
                    name.includes('tufts/');

    // Calculate if this is a major university
    isMajorUniversity = isMIT || isHarvard || isNortheastern || isBostonUniversity || isTufts;

    // Universities and research institutions (highest visual priority)
    if (element.tags.amenity === 'university' || element.tags.amenity === 'college' || isMajorUniversity) {
      category = 'university';
      visualLayer = 'universities';
    } else if (element.tags.office) {
      category = 'office_building';
      visualLayer = 'offices';
    } else if (element.tags.public_transport === 'station' || element.tags.railway === 'station') {
      category = 'transportation_station';
      visualLayer = 'transportation';
    } else if (element.tags.highway === 'bus_stop') {
      category = 'bus_stop';
      visualLayer = 'transportation';
    } else if (element.tags.amenity === 'hospital') {
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
          amenity: element.tags.amenity,
          building: element.tags.building,
          office: element.tags.office,
          public_transport: element.tags.public_transport,
          railway: element.tags.railway,
          website: element.tags.website,
          is_major_university: isMajorUniversity,
          university_type: isMIT ? 'MIT' : 
                         isHarvard ? 'Harvard' : 
                         isNortheastern ? 'Northeastern' : 
                         isBostonUniversity ? 'Boston University' : 
                         isTufts ? 'Tufts' : 'Other'
        }
      };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
    }
  }

  /**
   * Process visual ways (roads, parks, water, commercial zones)
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

    // Check if this is a major university by name (enhanced)
    const name = (element.tags.name || '').toLowerCase();
    const isMIT = name.includes('mit') || 
                  name.includes('massachusetts institute') ||
                  name.includes('mit ') ||
                  name.includes(' mit') ||
                  name.includes('mit campus') ||
                  name.includes('mit building') ||
                  name.includes('mit ') ||
                  name.includes('mit-') ||
                  name.includes('mit/');
    const isHarvard = (name.includes('harvard') && 
                      !name.includes('harvard square') &&
                      !name.includes('harvard street') &&
                      !name.includes('harvard ')) ||
                      name.includes('harvard university') ||
                      name.includes('harvard law') ||
                      name.includes('harvard school') ||
                      name.includes('harvard ') ||
                      name.includes('harvard-') ||
                      name.includes('harvard/');
    const isNortheastern = name.includes('northeastern') ||
                          name.includes('northeastern university');
    const isBostonUniversity = name.includes('boston university') ||
                              name.includes('boston u') ||
                              name.includes('bu ') ||
                              name.includes('bu-') ||
                              name.includes('bu/');
    const isTufts = name.includes('tufts') ||
                    name.includes('tufts university') ||
                    name.includes('tufts ') ||
                    name.includes('tufts-') ||
                    name.includes('tufts/');
    const isMajorUniversity = isMIT || isHarvard || isNortheastern || isBostonUniversity || isTufts;

    // Visual categorization for urban startup ecosystem
    if (element.tags.amenity === 'university' || element.tags.amenity === 'college' || isMajorUniversity) {
      // Handle universities mapped as ways (campus areas)
      category = 'university_campus';
      visualLayer = 'universities';
      geometryType = 'Polygon'; // Universities are typically areas
    } else if (element.tags.office) {
      // Handle office buildings mapped as ways (office complexes)
      category = 'office_complex';
      visualLayer = 'offices';
      geometryType = 'Polygon'; // Office complexes are typically areas
    } else if (element.tags.railway === 'rail') {
      category = 'transportation';
      visualLayer = 'transportation';
    } else if (element.tags.leisure === 'park' || element.tags.amenity === 'park') {
      category = 'park';
      visualLayer = 'parks';
      geometryType = 'Polygon'; // Parks are typically areas
      if (coordinates[0] !== coordinates[coordinates.length - 1]) {
        coordinates.push(coordinates[0]);
      }
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
    } else if (element.tags.landuse === 'commercial' || element.tags.landuse === 'retail') {
      category = 'commercial_zone';
      visualLayer = 'commercial';
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
                amenity: element.tags.amenity,
                building: element.tags.building,
                office: element.tags.office,
                highway: element.tags.highway,
                railway: element.tags.railway,
                leisure: element.tags.leisure,
                waterway: element.tags.waterway,
                landuse: element.tags.landuse,
                website: element.tags.website,
                is_major_university: isMajorUniversity,
                university_type: isMIT ? 'MIT' : 
                               isHarvard ? 'Harvard' : 
                               isNortheastern ? 'Northeastern' : 
                               isBostonUniversity ? 'Boston University' : 
                               isTufts ? 'Tufts' : 'Other'
              }
            };

      features.push(feature);
      visualLayers[visualLayer].push(feature);
      
      // Transportation endpoints creation removed per user request
    }
  }

  /**
   * Add cached layers to map with staggered loading (same as API version)
   */
  async addCachedLayersToMap(map, visualData, lat, lng) {
    // Remove existing layers
    const layersToRemove = [
      'osm-mit', 'osm-harvard', 'osm-northeastern', 'osm-bu', 'osm-tufts', 'osm-other-universities',
      'osm-offices', 'osm-transportation-stations', 'osm-parks', 
      'osm-water-lines', 'osm-water-fill', 'osm-commercial', 'osm-critical', 'osm-radius',
      'neighborhood-boundaries-fill', 'neighborhood-boundaries-highlight', 'neighborhood-boundaries-highlight-fill'
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
    if (map.current.getSource('neighborhood-boundaries')) {
      map.current.removeSource('neighborhood-boundaries');
    }

    // Add visual features source
    map.current.addSource('osm-visual', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: visualData.features || []
      }
    });

    // Load neighborhood boundaries
    await this.loadNeighborhoodBoundaries(map);

    // Use staggered loading (same as API version)
    const layerLoadingSequence = [
      { id: 'osm-mit', name: 'MIT Universities', delay: 0 },
      { id: 'osm-harvard', name: 'Harvard Universities', delay: 150 },
      { id: 'osm-northeastern', name: 'Northeastern Universities', delay: 300 },
      { id: 'osm-bu', name: 'Boston University', delay: 450 },
      { id: 'osm-tufts', name: 'Tufts University', delay: 600 },
      { id: 'osm-other-universities', name: 'Other Universities', delay: 750 },
      { id: 'osm-offices', name: 'Office Buildings', delay: 900 },
      { id: 'osm-transportation-stations', name: 'Transportation Stations', delay: 1050 },
      { id: 'osm-parks', name: 'Parks', delay: 1200 },
      { id: 'osm-water-lines', name: 'Water Features (Lines)', delay: 1350 },
      { id: 'osm-water-fill', name: 'Water Features (Areas)', delay: 1500 },
      { id: 'osm-commercial', name: 'Commercial Zones', delay: 1650 },
      { id: 'osm-critical', name: 'Critical Infrastructure', delay: 1800 },
      { id: 'osm-radius', name: 'Analysis Radius', delay: 1950 }
    ];

    // Start staggered loading
    this.startStaggeredLayerLoading(map, layerLoadingSequence, lat, lng);
    
    // Add neighborhood boundaries on top of all other layers
    if (map.current.getSource('neighborhood-boundaries')) {
      // Add transparent fill layer for click detection (no visible boundaries)
      map.current.addLayer({
        id: 'neighborhood-boundaries-fill',
        type: 'fill',
        source: 'neighborhood-boundaries',
        paint: {
          'fill-color': 'transparent',
          'fill-opacity': 0
        }
      });
      console.log('✅ Neighborhood boundaries click layer added on top');
    }

    console.log(`✅ Started staggered loading of cached OSM layers (${visualData.features?.length || 0} features)`);
  }

  /**
   * Add visual layers to map with staggered loading (one layer every 3 seconds)
   */
  async addVisualLayersToMap(map, visualData, lat, lng) {
    // Remove existing layers
    const layersToRemove = [
      'osm-mit', 'osm-harvard', 'osm-northeastern', 'osm-bu', 'osm-tufts', 'osm-other-universities',
      'osm-offices', 'osm-transportation-stations', 'osm-parks', 
      'osm-water-lines', 'osm-water-fill', 'osm-commercial', 'osm-critical', 'osm-radius',
      'neighborhood-boundaries-fill', 'neighborhood-boundaries-highlight', 'neighborhood-boundaries-highlight-fill'
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
    if (map.current.getSource('neighborhood-boundaries')) {
      map.current.removeSource('neighborhood-boundaries');
    }

    // Add visual features source
    map.current.addSource('osm-visual', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: visualData.features || []
      }
    });
    
    // Define layer loading order based on LegendContainer categories
    // Load all layers within 2 seconds (150ms intervals)
    const layerLoadingSequence = [
      { id: 'osm-mit', name: 'MIT Universities', delay: 0 },
      { id: 'osm-harvard', name: 'Harvard Universities', delay: 150 },
      { id: 'osm-northeastern', name: 'Northeastern Universities', delay: 300 },
      { id: 'osm-bu', name: 'Boston University', delay: 450 },
      { id: 'osm-tufts', name: 'Tufts University', delay: 600 },
      { id: 'osm-other-universities', name: 'Other Universities', delay: 750 },
      { id: 'osm-offices', name: 'Office Buildings', delay: 900 },
      { id: 'osm-transportation-stations', name: 'Transportation Stations', delay: 1050 },
      { id: 'osm-parks', name: 'Parks', delay: 1200 },
      { id: 'osm-water-lines', name: 'Water Features (Lines)', delay: 1350 },
      { id: 'osm-water-fill', name: 'Water Features (Areas)', delay: 1500 },
      { id: 'osm-commercial', name: 'Commercial Zones', delay: 1650 },
      { id: 'osm-critical', name: 'Critical Infrastructure', delay: 1800 },
      { id: 'osm-radius', name: 'Analysis Radius', delay: 1950 }
    ];

    // Start staggered loading
    this.startStaggeredLayerLoading(map, layerLoadingSequence, lat, lng);

    console.log(`✅ Started staggered loading of ${visualData.features?.length || 0} visual features to map`);
  }

  /**
   * Start staggered layer loading - one layer every 3 seconds
   */
  startStaggeredLayerLoading(map, layerLoadingSequence, lat, lng) {
    layerLoadingSequence.forEach((layerConfig, index) => {
      setTimeout(() => {
        this.addSingleLayer(map, layerConfig.id, lat, lng);
        // OSM layer loaded
        
        // Emit layer loaded event for UI updates
        if (window.mapEventBus) {
          window.mapEventBus.emit('osm:layerLoaded', {
            layerId: layerConfig.id,
            layerName: layerConfig.name,
            timestamp: Date.now()
          });
        }
      }, layerConfig.delay);
    });
  }

  /**
   * Load neighborhood boundaries from census data
   */
  async loadNeighborhoodBoundaries(map) {
    try {
      // Loading neighborhood boundaries
      
      // Fetch the census data
      const response = await fetch('/census2020_bg_neighborhoods.json');
      if (!response.ok) {
        throw new Error(`Failed to load census data: ${response.status}`);
      }
      
      const censusData = await response.json();
      console.log(`📊 Loaded ${censusData.features?.length || 0} neighborhood boundaries`);
      
      // Convert coordinates from EPSG:2249 to WGS84 (approximate conversion for Boston area)
      const convertedFeatures = censusData.features.map(feature => {
        const convertedGeometry = this.convertCoordinates(feature.geometry);
        console.log('🔄 Converting feature:', feature.properties.BlockGr202, 'Original coords:', feature.geometry.coordinates[0][0], 'Converted coords:', convertedGeometry.coordinates[0][0]);
        return {
          ...feature,
          geometry: convertedGeometry,
          properties: {
            ...feature.properties,
            neighborhood: feature.properties.BlockGr202 || 'Unknown'
          }
        };
      });
      
      // Add the neighborhood boundaries source
      map.current.addSource('neighborhood-boundaries', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: convertedFeatures
        }
      });
      
      // Neighborhood source data loaded
      
      // Add a transparent fill layer for click detection (invisible but clickable)
      map.current.addLayer({
        id: 'neighborhood-boundaries-fill',
        type: 'fill',
        source: 'neighborhood-boundaries',
        paint: {
          'fill-color': 'transparent',
          'fill-opacity': 0
        }
      });
      
      console.log('✅ Neighborhood boundaries click layer added to map');
      console.log('🔍 Layer exists check:', map.current.getLayer('neighborhood-boundaries-fill'));
      console.log('🔍 Source exists check:', map.current.getSource('neighborhood-boundaries'));
      
      // Check if the source has data
      const source = map.current.getSource('neighborhood-boundaries');
      if (source && source._data) {
        console.log('🔍 Source data check:', {
          type: source._data.type,
          featureCount: source._data.features?.length,
          firstFeature: source._data.features?.[0]
        });
      }
      
      // Add click handler for neighborhood highlighting
      this.setupNeighborhoodClickHandler(map);
      
      console.log('✅ Neighborhood boundaries loaded and click handler set up');
      
    } catch (error) {
      console.warn('⚠️ Failed to load neighborhood boundaries:', error.message);
    }
  }

  /**
   * Convert coordinates from EPSG:2249 to WGS84 (approximate for Boston area)
   */
  convertCoordinates(geometry) {
    if (geometry.type === 'Polygon') {
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map(ring => 
          ring.map(coord => this.convertSingleCoordinate(coord))
        )
      };
    } else if (geometry.type === 'MultiPolygon') {
      return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(polygon => 
          polygon.map(ring => 
            ring.map(coord => this.convertSingleCoordinate(coord))
          )
        )
      };
    }
    return geometry;
  }

  /**
   * Convert a single coordinate from EPSG:2249 to WGS84
   * This is an approximate conversion for the Boston area
   */
  convertSingleCoordinate(coord) {
    const [x, y] = coord;
    
    // More accurate conversion for Massachusetts State Plane coordinates
    // Using a better reference point and scaling
    
    // Reference point: Boston Common area
    // State Plane: (776000, 2954000) -> WGS84: (-71.0622, 42.3551)
    
    const refX = 776000;
    const refY = 2954000;
    const refLon = -71.0622;
    const refLat = 42.3551;
    
    // Calculate offset from reference point
    const deltaX = x - refX;
    const deltaY = y - refY;
    
    // Convert meters to degrees with better scaling
    const metersPerDegreeLon = 111320 * Math.cos(refLat * Math.PI / 180);
    const metersPerDegreeLat = 110540;
    
    const lon = refLon + deltaX / metersPerDegreeLon;
    const lat = refLat + deltaY / metersPerDegreeLat;
    
    return [lon, lat];
  }

  /**
   * Setup click handler for neighborhood boundaries
   */
  setupNeighborhoodClickHandler(map) {
    // Store reference to current map for click handling
    this.mapRef = map;
    
    // Setting up neighborhood click handlers
    
    // Add click event listener for the fill layer (better click detection)
    map.current.on('click', 'neighborhood-boundaries-fill', (e) => {
      // Neighborhood clicked
      const feature = e.features[0];
      if (feature) {
        // Clicked feature processed
        this.highlightNeighborhood(feature);
      } else {
        console.log('❌ No feature found at click location');
      }
    });
    
    // Add a more robust click handler that queries all features
    map.current.on('click', (e) => {
      // Map clicked
      
      // Query for neighborhood features specifically
      const neighborhoodFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: ['neighborhood-boundaries-fill', 'neighborhood-boundaries']
      });
      
      // Neighborhood features queried
      
      if (neighborhoodFeatures.length > 0) {
        const feature = neighborhoodFeatures[0];
        // Found neighborhood feature
        this.highlightNeighborhood(feature);
      } else {
        // Check if there are any features at all
        const allFeatures = map.current.queryRenderedFeatures(e.point);
        // All features queried
        if (allFeatures.length > 0) {
          // Available layers checked
        }
      }
    });
    
    // Change cursor on hover
    map.current.on('mouseenter', 'neighborhood-boundaries-fill', () => {
      // Mouse entered neighborhood area
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', 'neighborhood-boundaries-fill', () => {
      // Mouse left neighborhood area
      map.current.getCanvas().style.cursor = '';
    });
    
  }

  /**
   * Highlight a clicked neighborhood with green stroke
   */
  highlightNeighborhood(feature) {
    const map = this.mapRef?.current;
    if (!map) return;
    
    const neighborhoodName = feature.properties.neighborhood || 'Unknown';
    // Highlighting neighborhood
    
    // Remove existing highlight layers
    if (map.getLayer('neighborhood-boundaries-highlight-fill')) {
      map.removeLayer('neighborhood-boundaries-highlight-fill');
    }
    if (map.getLayer('neighborhood-boundaries-highlight')) {
      map.removeLayer('neighborhood-boundaries-highlight');
    }
    if (map.getSource('neighborhood-boundaries-highlight')) {
      map.removeSource('neighborhood-boundaries-highlight');
    }
    
    // Create highlight source with the clicked feature
    map.addSource('neighborhood-boundaries-highlight', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [feature]
      }
    });
    
    // Add highlight fill layer (green fill)
    map.addLayer({
      id: 'neighborhood-boundaries-highlight-fill',
      type: 'fill',
      source: 'neighborhood-boundaries-highlight',
      paint: {
        'fill-color': '#22c55e', // Green color
        'fill-opacity': 0.08
      }
    });
    
    // Add highlight layer with green stroke
    map.addLayer({
      id: 'neighborhood-boundaries-highlight',
      type: 'line',
      source: 'neighborhood-boundaries-highlight',
      paint: {
        'line-color': '#22c55e', // Green color
        'line-width': 0.1,
        'line-opacity': 0.8
      }
    });
    
    // Emit event for UI updates
    if (window.mapEventBus) {
      window.mapEventBus.emit('neighborhood:highlighted', {
        neighborhood: neighborhoodName,
        feature: feature,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Add a single layer to the map
   */
  addSingleLayer(map, layerId, lat, lng) {
    switch (layerId) {
      case 'osm-mit':
    map.current.addLayer({
      id: 'osm-mit',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'MIT']
      ],
      paint: {
            'circle-radius': 12,
            'circle-color': '#dc2626',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-harvard':
    map.current.addLayer({
      id: 'osm-harvard',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'Harvard']
      ],
      paint: {
            'circle-radius': 10,
            'circle-color': '#7c2d12',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-northeastern':
    map.current.addLayer({
      id: 'osm-northeastern',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'Northeastern']
      ],
      paint: {
            'circle-radius': 8,
            'circle-color': '#ea580c',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-bu':
    map.current.addLayer({
      id: 'osm-bu',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'Boston University']
      ],
      paint: {
            'circle-radius': 8,
            'circle-color': '#0891b2',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-tufts':
    map.current.addLayer({
      id: 'osm-tufts',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'Tufts']
      ],
      paint: {
            'circle-radius': 8,
            'circle-color': '#7c3aed',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-other-universities':
    map.current.addLayer({
      id: 'osm-other-universities',
      type: 'circle',
      source: 'osm-visual',
      filter: ['all',
        ['any', 
          ['==', ['get', 'category'], 'university'],
          ['==', ['get', 'category'], 'university_campus']
        ],
        ['==', ['get', 'university_type'], 'Other']
      ],
      paint: {
            'circle-radius': 6,
            'circle-color': '#ef4444',
            'circle-stroke-width': 0,
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-offices':
    map.current.addLayer({
      id: 'osm-offices',
      type: 'circle',
      source: 'osm-visual',
      filter: ['any', 
        ['==', ['get', 'category'], 'office_building'],
        ['==', ['get', 'category'], 'office_complex']
      ],
      paint: {
        'circle-radius': [
          'case',
              ['==', ['get', 'category'], 'office_complex'], 8,
              ['==', ['get', 'category'], 'office_building'], 6,
              6
            ],
            'circle-color': '#3b82f6',
        'circle-opacity': 0.35
      }
    });
        break;
    
      case 'osm-transportation-stations':
    map.current.addLayer({
      id: 'osm-transportation-stations',
      type: 'circle',
      source: 'osm-visual',
      filter: ['any', 
        ['==', ['get', 'category'], 'transportation_station'],
        ['==', ['get', 'category'], 'bus_stop']
      ],
      paint: {
        'circle-radius': [
          'case',
              ['==', ['get', 'category'], 'transportation_station'], 6,
              ['==', ['get', 'category'], 'bus_stop'], 3,
              4
        ],
        'circle-color': [
          'case',
              ['==', ['get', 'category'], 'transportation_station'], '#f59e0b',
              ['==', ['get', 'category'], 'bus_stop'], '#f97316',
              '#f59e0b'
        ],
        'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-parks':
    map.current.addLayer({
      id: 'osm-parks',
      type: 'fill',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'park'],
      paint: {
            'fill-color': '#10b981',
        'fill-opacity': 0.4
      }
    });
        break;
    
      case 'osm-water-lines':
    map.current.addLayer({
      id: 'osm-water-lines',
      type: 'line',
      source: 'osm-visual',
      filter: ['all',
        ['==', ['get', 'category'], 'water_feature'],
            ['==', ['geometry-type'], 'LineString']
      ],
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 3,
        'line-opacity': 0.8
      }
    });
        break;
    
      case 'osm-water-fill':
    map.current.addLayer({
      id: 'osm-water-fill',
      type: 'fill',
      source: 'osm-visual',
      filter: ['all',
        ['==', ['get', 'category'], 'water_feature'],
            ['==', ['geometry-type'], 'Polygon']
      ],
      paint: {
        'fill-color': '#0ea5e9',
        'fill-opacity': 0.4
      }
    });
        break;

      case 'osm-commercial':
    map.current.addLayer({
      id: 'osm-commercial',
      type: 'fill',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'commercial_zone'],
      paint: {
        'fill-color': 'rgba(139, 92, 246, 0.3)',
        'fill-opacity': 0.5
      }
    });
        break;

      case 'osm-critical':
    map.current.addLayer({
      id: 'osm-critical',
      type: 'circle',
      source: 'osm-visual',
      filter: ['==', ['get', 'category'], 'critical_infrastructure'],
      paint: {
        'circle-radius': [
          'case',
              ['==', ['get', 'amenity'], 'hospital'], 7,
              ['==', ['get', 'amenity'], 'university'], 6,
              5
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'amenity'], 'hospital'], '#dc2626',
          ['==', ['get', 'amenity'], 'university'], '#8b5cf6',
          '#f59e0b'
        ],
            'circle-stroke-width': 0,
            'circle-opacity': 0.35
      }
    });
        break;

      case 'osm-radius':
    this.addAnalysisRadius(map, lat, lng);
        break;

      default:
        console.warn(`Unknown layer ID: ${layerId}`);
    }
  }

  /**
   * Add 3-mile analysis radius circle
   */
  addAnalysisRadius(map, lat, lng) {
    const radiusKm = 4.83; // 3 miles
    const circle = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [this.generateCircle(lat, lng, radiusKm)]
      },
      properties: {
        name: 'Urban Startup Ecosystem Analysis Radius (3 miles)',
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
    const key = `${this.cacheKeyPrefix}${lat}_${lng}_${location}`;
    console.log('🔑 OSM: Generated cache key:', key, 'from coords:', coordinates, 'location:', location);
    return key;
  }

  /**
   * Get from cache
   */
  getFromCache(cacheKey) {
    try {
      const cached = this.cache.get(cacheKey);
      console.log('🔍 OSM: Cache lookup result:', { 
        found: !!cached, 
        valid: cached ? this.isCacheValid(cached) : false,
        age: cached ? Math.round((Date.now() - cached.timestamp) / 1000 / 60) : 'N/A'
      });
      
      if (cached && this.isCacheValid(cached)) {
        console.log('✅ OSM: Cache hit - returning cached data');
        // Decompress cached data back to full format
        return this.decompressDataFromCache(cached.data);
      } else if (cached) {
        console.log('⏰ OSM: Cache expired - removing entry');
        // Remove expired cache entry
        this.cache.delete(cacheKey);
      } else {
        console.log('❌ OSM: Cache miss - no data found');
      }
    } catch (error) {
      console.warn('OSM Cache error:', error.message);
    }
    return null;
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
   * Save to cache with optimized data compression
   */
  saveToCache(cacheKey, data) {
    try {
      // Compress data before caching - only store essential information
      const compressedData = this.compressDataForCache(data);
      
      const entry = {
        data: compressedData,
        timestamp: Date.now()
      };
      
      this.cache.set(cacheKey, entry);
      console.log('💾 OSM: Cached visual context (compressed) with key:', cacheKey);
      console.log('🔍 OSM: Cache size after save:', this.cache.size);
      
      // Test cache immediately after save
      const testRetrieve = this.cache.get(cacheKey);
      console.log('🧪 OSM: Test cache retrieve after save:', !!testRetrieve);
    } catch (error) {
      console.warn('OSM Cache save error:', error.message);
    }
  }

  /**
   * Save to local JSON file for development caching
   */
  saveToLocalFile(data) {
    try {
      const compressedData = this.compressDataForCache(data);
      const jsonString = JSON.stringify(compressedData, null, 2);
      
      // Create downloadable file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = 'osm-boston-cache.json';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('📁 OSM: Boston cache file downloaded - place in public folder for caching');
    } catch (error) {
      console.warn('📁 OSM: Failed to save local file:', error.message);
    }
  }

  /**
   * Compress data for efficient caching
   */
  compressDataForCache(data) {
    // Store OSM data properly - keep all essential properties for layer filtering
    return {
      features: data.features?.map(feature => ({
        type: feature.type,
        geometry: feature.geometry,
        properties: {
          osm_id: feature.properties?.osm_id,
          name: feature.properties?.name,
          category: feature.properties?.category,
          amenity: feature.properties?.amenity,
          building: feature.properties?.building,
          office: feature.properties?.office,
          public_transport: feature.properties?.public_transport,
          railway: feature.properties?.railway,
          highway: feature.properties?.highway,
          leisure: feature.properties?.leisure,
          waterway: feature.properties?.waterway,
          landuse: feature.properties?.landuse,
          website: feature.properties?.website,
          is_major_university: feature.properties?.is_major_university,
          university_type: feature.properties?.university_type
        }
      })) || [],
      visualLayers: data.visualLayers || {},
      // OSM infrastructure counts for Site Assessment
      universitiesCount: data.universitiesCount || 0,
      majorUniversitiesCount: data.majorUniversitiesCount || 0,
      mitCount: data.mitCount || 0,
      harvardCount: data.harvardCount || 0,
      northeasternCount: data.northeasternCount || 0,
      buCount: data.buCount || 0,
      tuftsCount: data.tuftsCount || 0,
      officesCount: data.officesCount || 0,
      transportationAccess: data.transportationAccess || 'Unknown',
      parksAccess: data.parksAccess || 'Unknown',
      commercialZones: data.commercialZones || 'Unknown',
      criticalInfrastructure: data.criticalInfrastructure || 'Unknown'
    };
  }

  /**
   * Decompress data from cache back to full format
   */
  decompressDataFromCache(compressedData) {
    // Return the data as-is since we're now storing it properly
    return {
      features: compressedData.features || [],
      visualLayers: compressedData.visualLayers || {},
      // OSM infrastructure counts for Site Assessment
      universitiesCount: compressedData.universitiesCount || 0,
      majorUniversitiesCount: compressedData.majorUniversitiesCount || 0,
      mitCount: compressedData.mitCount || 0,
      harvardCount: compressedData.harvardCount || 0,
      northeasternCount: compressedData.northeasternCount || 0,
      buCount: compressedData.buCount || 0,
      tuftsCount: compressedData.tuftsCount || 0,
      officesCount: compressedData.officesCount || 0,
      transportationAccess: compressedData.transportationAccess || 'Unknown',
      parksAccess: compressedData.parksAccess || 'Unknown',
      commercialZones: compressedData.commercialZones || 'Unknown',
      criticalInfrastructure: compressedData.criticalInfrastructure || 'Unknown'
    };
  }

  /**
   * Clear old cache entries
   */
  clearOldCache(count = 3) {
    try {
      const keys = [];
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(this.cacheKeyPrefix)) {
          keys.push(key);
        }
      }
      keys.slice(0, count).forEach(key => this.cache.delete(key));
      console.log(`🧹 OSM: Cleared ${Math.min(count, keys.length)} old cache entries`);
    } catch (error) {
      console.warn('Cache cleanup error:', error.message);
    }
  }

  /**
   * Clear all OSM cache entries
   */
  clearAllOsmCache() {
    try {
      const keys = [];
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(this.cacheKeyPrefix)) {
          keys.push(key);
        }
      }
      keys.forEach(key => this.cache.delete(key));
      console.log(`🗑️ OSM: Cleared all ${keys.length} cache entries`);
    } catch (error) {
      console.warn('Full cache clear error:', error.message);
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      expirationMinutes: this.cacheExpiration / (60 * 1000),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Math.round((Date.now() - entry.timestamp) / 1000 / 60), // minutes
        valid: this.isCacheValid(entry)
      }))
    };
  }

  /**
   * Debug cache state - useful for troubleshooting
   */
  debugCacheState() {
    console.log('🔍 OSM Cache Debug State:');
    console.log('  Cache size:', this.cache.size);
    console.log('  Cache expiration (hours):', this.cacheExpiration / (60 * 60 * 1000));
    console.log('  Cache entries:');
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(this.cacheKeyPrefix)) {
        console.log(`    ${key}: age=${Math.round((Date.now() - entry.timestamp) / 1000 / 60)}min, valid=${this.isCacheValid(entry)}`);
      }
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
      globalOsmTool.clearAllOsmCache();
    } else {
      console.warn('⚠️ OSM Cache: No global OsmTool instance available for cache clearing');
    }
  };
  
  window.debugOsmCache = () => {
    if (globalOsmTool) {
      globalOsmTool.debugCacheState();
    } else {
      console.warn('⚠️ OSM Cache: No global OsmTool instance available for debugging');
    }
  };
}
