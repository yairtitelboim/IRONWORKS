/**
 * SERP Tool for startup ecosystem analysis
 * Uses pre-processed JSON data for fast loading
 */

// Note: mapboxgl import removed as popup creation is now handled by enhanced popup system

// mapEventBus is available as window.mapEventBus

export class SerpTool {
  constructor() {
    this.name = 'SERP';
    this.startupData = null;
    this.companiesLoaded = false;
  }

  // Load Houston real estate data from JSON file
  async loadStartupData() {
    if (this.companiesLoaded) {
      return this.startupData;
    }

    try {
      console.log('📊 Loading Houston real estate data...');
      const response = await fetch('/Listings/houston_downtown_master_CLEANED.geojson');
      const geojsonData = await response.json();
      
      // Convert GeoJSON to our expected format for real estate properties
      this.startupData = {
        companies: geojsonData.features.map(feature => ({
          id: feature.properties.id,
          name: feature.properties.address || 'Property',
          description: `${feature.properties.property_type} - ${feature.properties.square_footage} sq ft`,
          category: this.mapPropertyTypeToCategory(feature.properties.property_type),
          fundingStage: this.mapPriceToFundingStage(feature.properties.price_value),
          industries: 'Real Estate',
          headquarters: 'Houston, TX',
          url: null,
          foundedDate: null,
          address: feature.properties.formatted_address || feature.properties.address,
          categoryColor: this.getCategoryColor(this.mapPropertyTypeToCategory(feature.properties.property_type)),
          icon: this.getCategoryIcon(this.mapPropertyTypeToCategory(feature.properties.property_type)),
          coordinates: {
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0]
          },
          cbRank: 0,
          isActive: true,
          lastFundingDate: feature.properties.scraped_at,
          lastFundingType: feature.properties.property_type,
          // Real estate specific data
          price: feature.properties.price_value,
          squareFootage: feature.properties.square_footage,
          bedrooms: feature.properties.bedrooms,
          zipCode: feature.properties.zip_code,
          propertyType: feature.properties.property_type,
          scrapedAt: feature.properties.scraped_at,
          // Include geometry for map integration
          geometry: feature.geometry
        }))
      };
      
      this.companiesLoaded = true;
      console.log(`✅ Loaded ${this.startupData.companies.length} properties from Houston real estate data`);
      return this.startupData;
    } catch (error) {
      console.error('❌ Failed to load Houston real estate data:', error);
      return null;
    }
  }

  // Map property type to category
  mapPropertyTypeToCategory(propertyType) {
    const mapping = {
      'rentals': 'Residential Lease',
      'sales': 'Residential Sale',
      'condo_rentals': 'Residential Lease',
      'office_buildings': 'Commercial Sale',
      'office_leases': 'Commercial Lease'
    };
    return mapping[propertyType] || 'Other';
  }

  // Map price to funding stage equivalent
  mapPriceToFundingStage(price) {
    if (!price) return 'Unknown';
    if (price < 200000) return 'Budget';
    if (price < 500000) return 'Mid-Range';
    if (price < 1000000) return 'Premium';
    return 'Luxury';
  }

  // Get category icon
  getCategoryIcon(category) {
    const icons = {
      'Residential': '🏠',
      'Commercial': '🏢',
      'Luxury': '💎',
      'Budget': '💰',
      'Mid-Range': '🏘️',
      'Premium': '🏡',
      'Other': '🏭'
    };
    return icons[category] || '🏭';
  }

  // Get category color
  getCategoryColor(category) {
    const colors = {
      'Residential Sale': '#F59E0B',     // Dark Yellow (for sale)
      'Residential Lease': '#FDE68A',    // Light Yellow (for lease)
      'Commercial Sale': '#3B82F6',      // Dark Blue (for sale)
      'Commercial Lease': '#93C5FD',     // Light Blue (for lease)
      'Luxury': '#F59E0B',               // Amber
      'Budget': '#059669',               // Emerald
      'Mid-Range': '#8B5CF6',            // Purple
      'Premium': '#EF4444',              // Red
      'Other': '#6B7280'                 // Gray
    };
    return colors[category] || '#6B7280';
  }

  // Filter companies by location proximity
  filterCompaniesByLocation(companies, centerLat, centerLng, radiusMiles = 25) {
    const filtered = companies.filter(company => {
      const distance = this.calculateDistance(
        centerLat, centerLng,
        company.coordinates.lat, company.coordinates.lng
      );
      return distance <= radiusMiles;
    });
    
    console.log(`🔍 Filtered ${filtered.length} companies within ${radiusMiles} miles of ${centerLat}, ${centerLng}`);
    return filtered;
  }

  // Calculate distance between two coordinates in miles
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Convert companies to GeoJSON features
  companiesToGeoJSON(companies) {
    return companies.map(company => ({
                  type: 'Feature',
      properties: {
        id: company.id,
        name: company.name,
        description: company.description,
        category: company.category,
        fundingStage: company.fundingStage,
        industries: company.industries,
        headquarters: company.headquarters,
        url: company.url,
        foundedDate: company.foundedDate,
        address: company.address,
        categoryColor: company.categoryColor,
        icon: company.icon,
        color: this.getCategoryColor(company.category),
        cbRank: company.cbRank,
        isActive: company.isActive,
        lastFundingDate: company.lastFundingDate,
        lastFundingType: company.lastFundingType,
        // Include the full geographic intelligence data
        geographicIntelligence: company.geographicIntelligence || {},
        spatialInsights: company.spatialInsights || {}
      },
                  geometry: {
                    type: 'Point',
        coordinates: [company.coordinates.lng, company.coordinates.lat]
      }
    }));
  }

  // Analyze real estate data
  analyzeStartupEcosystemData(companies) {
    const analysis = {
      totalProperties: companies.length,
      categories: {},
      priceRanges: {},
      propertyTypes: {},
      topProperties: [],
      averagePrice: 0,
      totalValue: 0
    };

    companies.forEach(company => {
      // Count categories
      analysis.categories[company.category] = (analysis.categories[company.category] || 0) + 1;
      
      // Count price ranges
      analysis.priceRanges[company.fundingStage] = (analysis.priceRanges[company.fundingStage] || 0) + 1;
      
      // Count property types
      analysis.propertyTypes[company.propertyType] = (analysis.propertyTypes[company.propertyType] || 0) + 1;
      
      // Track total value
      if (company.price) {
        analysis.totalValue += company.price;
      }
      
      // Track top properties by price
      if (company.price > 0) {
        analysis.topProperties.push({
          name: company.name,
          category: company.category,
          price: company.price,
          propertyType: company.propertyType,
          squareFootage: company.squareFootage
        });
      }
    });

    // Calculate average price
    analysis.averagePrice = analysis.totalValue / companies.length;

    // Sort top properties by price
    analysis.topProperties.sort((a, b) => b.price - a.price);
    analysis.topProperties = analysis.topProperties.slice(0, 10); // Top 10

    return analysis;
  }

  // Execute startup ecosystem analysis
  async executeStartupEcosystemAnalysis(locationConfig, mapInstance, updateToolFeedback = null) {
    try {
      console.log('🚀 Starting startup ecosystem analysis with JSON data...');
      
      // Update tool feedback - starting
      if (updateToolFeedback) {
        updateToolFeedback({
      tool: 'serp',
          isActive: true,
          status: 'Loading startup geographic intelligence...',
          progress: 10,
          details: 'Fetching startup intelligence data from GeoJSON',
        timestamp: Date.now()
      });
    }

      // Load startup data
      const startupData = await this.loadStartupData();
      if (!startupData) {
        throw new Error('Failed to load startup data');
      }

      // Add a small delay to make the loading process visible
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get location coordinates
      const centerLat = parseFloat(locationConfig.lat) || 29.7604;
      const centerLng = parseFloat(locationConfig.lng) || -95.3698;
      
      console.log(`📍 Analyzing real estate properties near ${centerLat}, ${centerLng}`);

      // Update tool feedback - filtering
      if (updateToolFeedback) {
        updateToolFeedback({
      tool: 'serp',
          isActive: true,
          status: 'Activating real estate intelligence markers...',
          progress: 30,
          details: `Loading ${startupData.companies.length} real estate intelligence markers`,
          timestamp: Date.now()
        });
      }

      // Filter properties by location proximity (within 5 miles of downtown Houston)
      const nearbyCompanies = this.filterCompaniesByLocation(startupData.companies, centerLat, centerLng, 5);
      console.log(`🌍 Showing ${nearbyCompanies.length} properties near Houston downtown (filtered from ${startupData.companies.length} total)`);

      // Add a delay after filtering to make the process visible
      await new Promise(resolve => setTimeout(resolve, 400));

      if (nearbyCompanies.length === 0) {
        console.log('❌ No properties found in the area');
      return {
          features: [],
          startupsCount: 0,
          investorsCount: 0,
          coWorkingSpaces: 'No properties found',
          researchInstitutions: 'No properties available',
          analysis: null
        };
      }

      // Update tool feedback - processing data
      if (updateToolFeedback) {
        updateToolFeedback({
      tool: 'serp',
          isActive: true,
          status: 'Processing startup intelligence data...',
          progress: 60,
          details: `Found ${nearbyCompanies.length} companies, preparing geographic intelligence markers`,
          timestamp: Date.now()
        });
      }

      // Convert to GeoJSON
      const features = this.companiesToGeoJSON(nearbyCompanies);
      
      // Analyze data
      const analysis = this.analyzeStartupEcosystemData(nearbyCompanies);

      console.log(`✅ Found ${nearbyCompanies.length} real estate properties in the area`);
      console.log('📊 Analysis:', analysis);

      // Add a delay after data processing to make the process visible
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update tool feedback - adding markers
      if (updateToolFeedback) {
        updateToolFeedback({
          tool: 'serp',
          isActive: true,
          status: 'Rendering startup intelligence markers...',
          progress: 80,
          details: `Activating ${features.length} geographic intelligence markers with category styling`,
          timestamp: Date.now()
        });
      }

      // Add a delay to make the marker loading process visible
      await new Promise(resolve => setTimeout(resolve, 800));

      // Update progress during marker loading
      if (updateToolFeedback) {
        updateToolFeedback({
          tool: 'serp',
          isActive: true,
          status: 'Activating geographic intelligence layer...',
          progress: 85,
          details: `Rendering ${features.length} startup intelligence markers with geographic data`,
          timestamp: Date.now()
        });
      }

      // Add markers to map
      if (mapInstance) {
        await this.addMarkersToMap(mapInstance, features);
      }

      // Update progress after markers are added
      if (updateToolFeedback) {
        updateToolFeedback({
          tool: 'serp',
          isActive: true,
          status: 'Finalizing startup intelligence layer...',
          progress: 95,
          details: `Successfully activated ${features.length} geographic intelligence markers`,
          timestamp: Date.now()
        });
      }

      // Add another delay after markers are added to show completion
      await new Promise(resolve => setTimeout(resolve, 700));

      // Update tool feedback - completion
      if (updateToolFeedback) {
        updateToolFeedback({
      tool: 'serp',
          isActive: true,
          status: 'Startup Geographic Intelligence activated',
          progress: 100,
          details: `Successfully activated ${analysis.totalProperties} geographic intelligence markers across ${Object.keys(analysis.categories).length} categories`,
          timestamp: Date.now()
        });
      }

      // Emit data to legend
      if (window.mapEventBus) {
        window.mapEventBus.emit('serp:dataLoaded', {
          startupsCount: analysis.totalProperties,
          investorsCount: 0, // Not applicable for this data
          coWorkingSpaces: 'Multiple properties available',
          researchInstitutions: 'Real estate market data',
          features: features, // Include features for legend
          timestamp: Date.now()
        });
      }

      // Final completion feedback
      if (updateToolFeedback) {
        setTimeout(() => {
          updateToolFeedback({
      tool: 'serp',
            isActive: false,
            status: 'Startup Geographic Intelligence activated',
            progress: 100,
            details: `Successfully activated ${analysis.totalProperties} geographic intelligence markers across ${Object.keys(analysis.categories).length} categories`,
            timestamp: Date.now()
          });
        }, 500); // Small delay to show completion
      }

    return {
        features,
        startupsCount: analysis.totalProperties,
        investorsCount: 0,
        coWorkingSpaces: 'Multiple properties available',
        researchInstitutions: 'Real estate market data',
        analysis
      };

    } catch (error) {
      console.error('❌ Real estate analysis failed:', error);
      throw error;
    }
  }

  // Add markers to map
  async addMarkersToMap(mapInstance, features) {
    try {
      console.log(`🗺️ Adding ${features.length} company markers to map...`);
      // console.log('🔍 Map instance type:', typeof mapInstance);
      // console.log('🔍 Map instance methods:', Object.getOwnPropertyNames(mapInstance));
      // console.log('🔍 Map instance has getSource:', 'getSource' in mapInstance);

      // Check if mapInstance is a React ref (has .current property)
      let actualMap = mapInstance;
      if (mapInstance && mapInstance.current) {
        actualMap = mapInstance.current;
        // console.log('🔧 Using map from React ref (.current property)');
      }

      // Check if actualMap is a valid Mapbox GL JS map
      if (!actualMap || typeof actualMap.getSource !== 'function') {
        console.error('❌ Invalid map instance provided. Expected Mapbox GL JS map object.');
        console.error('❌ Map instance:', mapInstance);
        console.error('❌ Actual map:', actualMap);
        return;
      }

      // Add source
      if (actualMap.getSource('serp-startup-ecosystem-markers')) {
        // Stop radius animation
        if (window.serpRadiusAnimationFrame) {
          cancelAnimationFrame(window.serpRadiusAnimationFrame);
          window.serpRadiusAnimationFrame = null;
        }
        
        // Remove existing layers
        actualMap.removeLayer('serp-startup-ecosystem-markers');
        actualMap.removeLayer('serp-startup-ecosystem-radius-particles-layer');
        actualMap.removeSource('serp-startup-ecosystem-markers');
        actualMap.removeSource('serp-startup-ecosystem-radius-particles');
      }

      actualMap.addSource('serp-startup-ecosystem-markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });

      // Add markers layer
      actualMap.addLayer({
        id: 'serp-startup-ecosystem-markers',
        type: 'circle',
        source: 'serp-startup-ecosystem-markers',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 4.5,  // Half the previous size
            12, 7.5,
            16, 10.5,
            20, 13.5
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'category'], 'Residential Sale'], '#F59E0B',     // Dark Yellow
            ['==', ['get', 'category'], 'Residential Lease'], '#FDE68A',    // Light Yellow
            ['==', ['get', 'category'], 'Commercial Sale'], '#3B82F6',      // Dark Blue
            ['==', ['get', 'category'], 'Commercial Lease'], '#93C5FD',     // Light Blue
            ['==', ['get', 'category'], 'Luxury'], '#F59E0B',               // Amber
            ['==', ['get', 'category'], 'Budget'], '#059669',               // Emerald
            ['==', ['get', 'category'], 'Mid-Range'], '#8B5CF6',            // Purple
            ['==', ['get', 'category'], 'Premium'], '#EF4444',              // Red
            '#6B7280' // Default color
          ],
          'circle-opacity': 0.2, // 20% fill opacity
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'category'], 'Residential Sale'], '#F59E0B',     // Dark Yellow
            ['==', ['get', 'category'], 'Residential Lease'], '#FDE68A',    // Light Yellow
            ['==', ['get', 'category'], 'Commercial Sale'], '#3B82F6',      // Dark Blue
            ['==', ['get', 'category'], 'Commercial Lease'], '#93C5FD',     // Light Blue
            ['==', ['get', 'category'], 'Luxury'], '#F59E0B',               // Amber
            ['==', ['get', 'category'], 'Budget'], '#059669',               // Emerald
            ['==', ['get', 'category'], 'Mid-Range'], '#8B5CF6',            // Purple
            ['==', ['get', 'category'], 'Premium'], '#EF4444',              // Red
            '#6B7280' // Default color
          ],
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 1.0
        }
      });

      // Add animated radius circles layer (100m radius)
      const RADIUS_PARTICLES_SOURCE_ID = 'serp-startup-ecosystem-radius-particles';
      const RADIUS_PARTICLES_LAYER_ID = 'serp-startup-ecosystem-radius-particles-layer';
      
      // Create animated particles for radius circles
      const createRadiusParticles = (markers) => {
        // Get current zoom level and adjust particle count
        const currentZoom = actualMap.getZoom();
        const particleCount = currentZoom >= 11 ? 16 : 8; // Double particles at zoom 11+
        const radiusMeters = 100; // 100m radius
        const features = [];
        
        markers.forEach(marker => {
          const [lng, lat] = marker.geometry.coordinates;
          
          // Create particles around the circle
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * 2 * Math.PI;
            const now = Date.now();
            const timeOffset = (now * 0.001) % (2 * Math.PI); // Rotating animation
            const animatedAngle = angle + timeOffset;
            
            // Calculate position on circle (100m radius)
            const earthRadius = 6371000; // Earth radius in meters
            const latOffset = (radiusMeters / earthRadius) * (180 / Math.PI);
            const lngOffset = (radiusMeters / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
            
            const particleLng = lng + lngOffset * Math.cos(animatedAngle);
            const particleLat = lat + latOffset * Math.sin(animatedAngle);
            
            features.push({
              type: 'Feature',
              properties: {
                markerId: marker.properties.serp_id || marker.properties.id,
                particleIndex: i,
                category: marker.properties.category, // Include category for filtering
                color: marker.properties.color || marker.properties.categoryColor // Include color for dynamic styling
              },
              geometry: {
                type: 'Point',
                coordinates: [particleLng, particleLat]
              }
            });
          }
        });
        
        return { type: 'FeatureCollection', features };
      };
      
      // Add GeoJSON data source for radius particles
      actualMap.addSource(RADIUS_PARTICLES_SOURCE_ID, {
        type: 'geojson',
        data: createRadiusParticles(features)
      });
      
      // Add circle layer to render particles as animated dashed circles
      actualMap.addLayer({
        id: RADIUS_PARTICLES_LAYER_ID,
        type: 'circle',
        source: RADIUS_PARTICLES_SOURCE_ID,
        paint: {
          'circle-radius': 0.45, // 40% smaller than previous size - very small particles
          'circle-color': ['get', 'color'], // Dynamic color from marker
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': ['get', 'color'], // Dynamic stroke color from marker
          'circle-stroke-opacity': 0.6
        }
      });
      
      // Store visibility state for radius particles
      let radiusParticlesVisibility = {};
      
      // Start animation loop for rotating particles
      let radiusAnimationFrame = null;
      const animateRadiusParticles = () => {
        const source = actualMap.getSource(RADIUS_PARTICLES_SOURCE_ID);
        if (source) {
          const particlesData = createRadiusParticles(features);
          
          // Apply visibility filtering to particles
          if (Object.keys(radiusParticlesVisibility).length > 0) {
            particlesData.features = particlesData.features.filter(particle => {
              const category = particle.properties.category;
              return radiusParticlesVisibility[category] !== false;
            });
          }
          
          source.setData(particlesData);
        }
        radiusAnimationFrame = requestAnimationFrame(animateRadiusParticles);
      };
      
      // Start animation
      animateRadiusParticles();
      
      // Store animation frame for cleanup
      window.serpRadiusAnimationFrame = radiusAnimationFrame;
      
      // Store reference to visibility state for external control
      window.serpRadiusParticlesVisibility = radiusParticlesVisibility;

      // Start enhanced pulse animation - size and opacity pulsing for 5 seconds
      console.log('🎯 Starting enhanced startup markers pulse animation...');
      
      // Create pulsing opacity effect
      let pulseCount = 0;
      const maxPulses = 25; // 5 seconds at 200ms intervals
      
      const pulseInterval = setInterval(() => {
        const progress = pulseCount / maxPulses;
        const rawOpacity = 0.3 + (0.7 * Math.sin(progress * Math.PI * 4)); // Pulsing between 0.3 and 1.0
        const opacity = Math.max(0, Math.min(1, rawOpacity)); // Clamp between 0 and 1
        
        actualMap.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', opacity);
        
        pulseCount++;
        
        if (pulseCount >= maxPulses) {
          clearInterval(pulseInterval);
          // Set final normal size and opacity
          actualMap.setPaintProperty('serp-startup-ecosystem-markers', 'circle-radius', [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 1.5,  // Half the previous size
            12, 2.5,
            16, 3.5,
            20, 4.5
          ]);
          actualMap.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', 1.0);
          console.log('✅ Enhanced startup markers pulse animation completed');
        }
      }, 200); // Pulse every 200ms

      // Remove existing click handlers first to prevent duplicates
      actualMap.off('click', 'serp-startup-ecosystem-markers');
      actualMap.off('mouseenter', 'serp-startup-ecosystem-markers');
      actualMap.off('mouseleave', 'serp-startup-ecosystem-markers');

      // Add click handler with rich popup content
      actualMap.on('click', 'serp-startup-ecosystem-markers', (e) => {
        console.log('🎯 SERP Startup marker clicked:', e.features[0].properties);
        
        const feature = e.features[0];
        const properties = feature.properties;
        
        // Note: Popup creation is now handled by the enhanced popup system

        // Emit event to trigger popup via the enhanced popup system
        console.log('🚀 SERP Tool: Emitting marker click event for enhanced popup:', properties.name);
        if (window.mapEventBus) {
          window.mapEventBus.emit('marker:clicked', {
            ...properties,
            coordinates: [e.lngLat.lng, e.lngLat.lat],
            id: properties.id || properties.serp_id
          });
        }
      });

      // Change cursor on hover
      actualMap.on('mouseenter', 'serp-startup-ecosystem-markers', () => {
        actualMap.getCanvas().style.cursor = 'pointer';
      });

      actualMap.on('mouseleave', 'serp-startup-ecosystem-markers', () => {
        actualMap.getCanvas().style.cursor = '';
      });

      console.log('✅ Company markers added to map');
      
      // Debug: Check if markers are actually visible
      
      // Check if any features are actually in the source
      const source = actualMap.getSource('serp-startup-ecosystem-markers');
      if (source && source._data) {
        console.log('🗺️ Startup markers added to map without auto-zoom');
      }

    } catch (error) {
      console.error('❌ Failed to add markers to map:', error);
    }
  }

  // Legacy method for power grid analysis (kept for compatibility)
  async execute(query, locationConfig, mapInstance) {
    console.log('🔄 SERP: Using legacy execute method for power grid analysis');
    // This would contain the original power grid analysis logic
    // For now, return empty result
    return {
      features: [],
      startupsCount: 0,
      investorsCount: 0,
      coWorkingSpaces: 'Not applicable',
      researchInstitutions: 'Not applicable'
    };
  }
}
