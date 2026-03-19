import React, { useState, useEffect, useCallback, memo } from 'react';
import { getGeographicConfig } from '../../../../config/geographicConfig';

const LegendContainer = memo(({ 
  aiState, 
  isVisible = false,
  onToggle = null,
  map = null,
  handleMarkerClick = null,
  currentLocation = 'default' // Add currentLocation prop
}) => {
  // Real data state
  const [legendData, setLegendData] = useState({
    serpFeatures: [],
    featureCounts: {},
    totalFeatures: 0,
    lastUpdated: null
  });
  
  // OSM visual data state
  const [osmData, setOsmData] = useState({
    visualLayers: {},
    totalFeatures: 0,
    lastUpdated: null
  });

  // Dynamic height calculation like SidePanel
  const [cardHeight, setCardHeight] = useState(0);
  const [previousHeight, setPreviousHeight] = useState(400); // Remember previous height
  
  // Track selected marker for legend highlighting
  const [selectedMarker, setSelectedMarker] = useState(null);
  
  // Get location-specific university configuration
  const getLocationUniversities = (locationKey) => {
    const config = getGeographicConfig(locationKey);
    const { city, state } = config;
    
    // Define location-specific universities
    const locationUniversities = {
      boston: {
        mit: { name: 'MIT', color: '#dc2626', description: 'Massachusetts Institute of Technology' },
        harvard: { name: 'Harvard', color: '#7c2d12', description: 'Harvard University' },
        northeastern: { name: 'Northeastern', color: '#ea580c', description: 'Northeastern University' },
        bu: { name: 'Boston University', color: '#0891b2', description: 'Boston University' },
        tufts: { name: 'Tufts', color: '#7c3aed', description: 'Tufts University' }
      },
      default: { // Houston
        rice: { name: 'Rice University', color: '#dc2626', description: 'Rice University' },
        uh: { name: 'University of Houston', color: '#7c2d12', description: 'University of Houston' },
        tsu: { name: 'Texas Southern University', color: '#ea580c', description: 'Texas Southern University' },
        hbu: { name: 'Houston Baptist University', color: '#0891b2', description: 'Houston Baptist University' }
      },
      seattle: {
        uw: { name: 'University of Washington', color: '#dc2626', description: 'University of Washington' },
        seattle_u: { name: 'Seattle University', color: '#7c2d12', description: 'Seattle University' },
        spu: { name: 'Seattle Pacific University', color: '#ea580c', description: 'Seattle Pacific University' }
      }
    };
    
    return locationUniversities[locationKey] || locationUniversities.default;
  };
  
  // Track OSM layer visibility states - dynamically based on location
  const [osmLayerVisibility, setOsmLayerVisibility] = useState(() => {
    const locationUniversities = getLocationUniversities(currentLocation);
    const universityLayers = {};
    Object.keys(locationUniversities).forEach(key => {
      universityLayers[key] = true;
    });
    
    return {
      ...universityLayers,
      otherUniversities: true,
      offices: true,
      transportation: true,
      water: true,
      parks: true,
      commercial: true,
      analysisRadius: true,
      // Road layers
      highways: true,
      primaryRoads: true,
      secondaryRoads: true,
      localRoads: true,
      residentialRoads: true,
      roads: true,
      highway_junctions: true
    };
  });

  // Track Pinal County layer visibility states
  const [pinalLayerVisibility, setPinalLayerVisibility] = useState({
    office_building: true,
    commercial_building: true,
    retail_building: true,
    government_facility: true,
    education: true,
    healthcare: true,
    service_amenity: true,
    emergency_services: true,
    transit_hub: true,
    highway_access: true,
    recreation_area: true,
    industrial: true,
    county_boundary: true,
    pinal_zone: true
  });

  // Track Pinal County layer opacity state
  const [pinalLayerOpacity, setPinalLayerOpacity] = useState({
    isTranslucent: false
  });

  // Track OSM layer opacity state
  const [osmLayerOpacity, setOsmLayerOpacity] = useState({
    isTranslucent: false
  });

  // Track PA Nuclear Sites layer visibility states
  const [paLayerVisibility, setPaLayerVisibility] = useState({
    transmission_line: true,
    power_line: true,
    substation: true,
    power_substation: true,
    power_facility: true,
    water: true,
    waterway: true,
    water_body: true,
    office_building: true,
    commercial_building: true,
    government_facility: true,
    education: true,
    healthcare: true,
    industrial: true,
    pa_zone: true
  });

  // Track section collapse states
  const [pinalSectionCollapsed, setPinalSectionCollapsed] = useState(false);
  const [realEstateSectionCollapsed, setRealEstateSectionCollapsed] = useState(false);
  const [urbanInfrastructureSectionCollapsed, setUrbanInfrastructureSectionCollapsed] = useState(false);
  const [pinalAnalysisAreaSectionCollapsed, setPinalAnalysisAreaSectionCollapsed] = useState(false);

  // Track Perplexity layer visibility states
  const [perplexityLayerVisibility, setPerplexityLayerVisibility] = useState({
    innovation_hub: true,
    startup_zone: true,
    funding_source: true
  });
  
  // Reset layer visibility when location changes
  useEffect(() => {
    const locationUniversities = getLocationUniversities(currentLocation);
    const universityLayers = {};
    Object.keys(locationUniversities).forEach(key => {
      universityLayers[key] = true;
    });
    
    setOsmLayerVisibility({
      ...universityLayers,
      otherUniversities: true,
      offices: true,
      transportation: true,
      water: true,
      parks: true,
      commercial: true,
      analysisRadius: true,
      // Road layers
      highways: true,
      primaryRoads: true,
      secondaryRoads: true,
      localRoads: true,
      residentialRoads: true,
      roads: true,
      highway_junctions: true
    });
  }, [currentLocation]);

  // Track startup category visibility states
  const [startupCategoryVisibility, setStartupCategoryVisibility] = useState({
    'AI/ML': true,
    'Biotech/Health': true,
    'FinTech': true,
    'CleanTech': true,
    'Enterprise': true,
    'Hardware': true,
    'Other': true
  });

  // Track real estate category visibility states
  const [realEstateCategoryVisibility, setRealEstateCategoryVisibility] = useState({
    'Residential Sale': true,
    'Residential Lease': true,
    'Commercial Sale': true,
    'Commercial Lease': true,
    'Luxury': true,
    'Budget': true,
    'Mid-Range': true,
    'Premium': true,
    'Other': true
  });
  
  useEffect(() => {
    const calculateCardHeight = () => {
      // Look for base-card first (normal mode), then Perplexity container, then any fixed div
      const baseCard = document.querySelector('.base-card');
      const perplexityContainer = document.querySelector('[data-perplexity-container]');
      const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
      
      // Find the largest fixed div (likely the main container)
      let largestFixedDiv = null;
      let largestHeight = 0;
      fixedDivs.forEach(div => {
        const height = div.offsetHeight;
        if (height > largestHeight && height > 100) { // Only consider divs taller than 100px
          largestHeight = height;
          largestFixedDiv = div;
        }
      });
      
        // Priority: baseCard > perplexityContainer (if tall enough) > largestFixedDiv
        let mainCard = baseCard;
        if (!mainCard && perplexityContainer && perplexityContainer.offsetHeight > 100) {
          mainCard = perplexityContainer;
        }
        if (!mainCard && largestFixedDiv) {
          mainCard = largestFixedDiv;
        }
        
        // If we're in Perplexity mode but the container is too small, try to find a better container
        if (perplexityContainer && perplexityContainer.offsetHeight <= 100 && largestFixedDiv && largestFixedDiv.offsetHeight > perplexityContainer.offsetHeight) {
          mainCard = largestFixedDiv;
        }
        
        if (mainCard) {
          const height = mainCard.offsetHeight;
          // Ensure minimum height for legend visibility
          const minHeight = 200;
          const finalHeight = Math.max(height, minHeight);
          setCardHeight(finalHeight);
          setPreviousHeight(finalHeight); // Remember this height for future use
        } else {
          // If no main card found, use the previous height or fallback
          const fallbackHeight = previousHeight > 0 ? previousHeight : 400;
          setCardHeight(fallbackHeight);
        }
    };
    
    calculateCardHeight();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateCardHeight);
    
    // Use ResizeObserver to detect card height changes for both modes
    const observeElement = () => {
      const mainCard = document.querySelector('.base-card') || 
                       document.querySelector('[data-perplexity-container]') ||
                       document.querySelector('div[style*="position: fixed"]');
      if (mainCard) {
        const resizeObserver = new ResizeObserver(calculateCardHeight);
        resizeObserver.observe(mainCard);
        return resizeObserver;
      }
      return null;
    };
    
    const resizeObserver = observeElement();
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', calculateCardHeight);
    };
  }, []);

  // Pinal County analysis data state
  const [pinalData, setPinalData] = useState({
    features: [],
    summary: {},
    pinal_insights: {},
    zones_queried: [],
    totalFeatures: 0,
    lastUpdated: null
  });

  // PA Nuclear Sites analysis data state
  const [paData, setPaData] = useState({
    features: [],
    summary: {},
    siteKey: null,
    totalFeatures: 0,
    lastUpdated: null
  });

  // Perplexity analysis data state
  const [perplexityData, setPerplexityData] = useState({
    geoJsonFeatures: [],
    legendItems: [],
    summary: {},
    insights: {},
    totalFeatures: 0,
    lastUpdated: null
  });

  // Memphis Colossus Change layer legend (toggle-driven)
  const [memphisColossusLegend, setMemphisColossusLegend] = useState(null);
  const [memphisColossusSelectedLabel, setMemphisColossusSelectedLabel] = useState(null);
  const [showMemphisColossusSection, setShowMemphisColossusSection] = useState(true);

  // Listen for infrastructure data from Google Places API
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleSerpDataLoaded = (data) => {

      
      // Process the features to create legend data
      const features = data.features || [];
      const featureCounts = {};
      
      features.forEach(feature => {
        const category = feature.properties?.category || 'other';
        featureCounts[category] = (featureCounts[category] || 0) + 1;
      });

      setLegendData({
        serpFeatures: features,
        featureCounts: featureCounts,
        totalFeatures: features.length,
        lastUpdated: data.timestamp || Date.now()
      });

      // Legend is now closed by default - user must manually open it
    };

    // Listen for OSM visual context data
    const handleOsmDataLoaded = (data) => {
      if (data.context && data.context.visualLayers) {
        const visualLayers = data.context.visualLayers;
        const totalFeatures = Object.values(visualLayers).reduce((sum, layer) => sum + layer.length, 0);
        
        setOsmData({
          visualLayers: visualLayers,
          totalFeatures: totalFeatures,
          lastUpdated: data.timestamp || Date.now()
        });
      }
    };

    // Listen for Pinal County analysis data
    const handlePinalAnalysisComplete = (data) => {
      // Process Pinal County features into visual layers for legend
      const visualLayers = {};
      const features = data.features || [];
      
      // Categorize features by type for legend display
      features.forEach(feature => {
        const category = feature.properties?.category;
        if (category) {
          if (!visualLayers[category]) {
            visualLayers[category] = [];
          }
          visualLayers[category].push(feature);
        }
      });
      
      // Add road network data specifically
      const roadFeatures = features.filter(f => f.properties?.category === 'highway_access');
      if (roadFeatures.length > 0) {
        visualLayers.roads = roadFeatures;
      }
      
      setPinalData({
        features: features,
        summary: data.summary || {},
        pinal_insights: data.pinal_insights || {},
        zones_queried: data.zones_queried || [],
        totalFeatures: features.length,
        lastUpdated: data.timestamp || Date.now()
      });
      
      // Also update OSM data for legend compatibility
      setOsmData({
        visualLayers: visualLayers,
        totalFeatures: features.length,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    // Listen for Pinal County analysis cleared
    const handlePinalAnalysisCleared = () => {
      setPinalData({
        features: [],
        summary: {},
        pinal_insights: {},
        zones_queried: [],
        totalFeatures: 0,
        lastUpdated: null
      });
    };

    // Listen for Perplexity analysis data
    const handlePerplexityAnalysisComplete = (data) => {
      setPerplexityData({
        geoJsonFeatures: data.geoJsonFeatures || [],
        legendItems: data.legendItems || [],
        summary: data.summary || {},
        insights: data.insights || {},
        totalFeatures: data.geoJsonFeatures?.length || 0,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    // Listen for Perplexity analysis cleared
    const handlePerplexityAnalysisCleared = () => {
      setPerplexityData({
        geoJsonFeatures: [],
        legendItems: [],
        summary: {},
        insights: {},
        totalFeatures: 0,
        lastUpdated: null
      });
    };

    // Listen for PA Nuclear Sites analysis data
    const handlePAAnalysisComplete = (data) => {
      // Process PA features into visual layers for legend
      const visualLayers = {};
      const features = data.features || [];
      
      // Categorize features by type for legend display
      features.forEach(feature => {
        const category = feature.properties?.category;
        if (category) {
          if (!visualLayers[category]) {
            visualLayers[category] = [];
          }
          visualLayers[category].push(feature);
        }
      });
      
      setPaData({
        features: features,
        summary: data.summary || {},
        siteKey: data.siteKey || null,
        totalFeatures: features.length,
        lastUpdated: data.timestamp || Date.now()
      });
      
      // Also update OSM data for legend compatibility
      setOsmData({
        visualLayers: visualLayers,
        totalFeatures: features.length,
        lastUpdated: data.timestamp || Date.now()
      });
    };

    // Listen for PA analysis cleared
    const handlePAAnalysisCleared = () => {
      setPaData({
        features: [],
        summary: {},
        siteKey: null,
        totalFeatures: 0,
        lastUpdated: null
      });
    };

    window.mapEventBus.on('serp:dataLoaded', handleSerpDataLoaded);
    window.mapEventBus.on('osm:geographicContext', handleOsmDataLoaded);
    window.mapEventBus.on('pinal:analysisComplete', handlePinalAnalysisComplete);
    window.mapEventBus.on('pinal:analysisCleared', handlePinalAnalysisCleared);
    window.mapEventBus.on('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
    window.mapEventBus.on('perplexity:analysisCleared', handlePerplexityAnalysisCleared);
    window.mapEventBus.on('pa:analysisComplete', handlePAAnalysisComplete);
    window.mapEventBus.on('pa:analysisCleared', handlePAAnalysisCleared);

    const handleMemphisColossusLegendData = (data) => {
      setMemphisColossusLegend(data || null);
    };
    const handleMemphisColossusLegendCleared = () => {
      setMemphisColossusLegend(null);
      setMemphisColossusSelectedLabel(null);
    };
    const handleMemphisColossusLegendSelect = (payload) => {
      setMemphisColossusSelectedLabel(payload ?? null);
    };
    window.mapEventBus.on('memphis-colossus:legendData', handleMemphisColossusLegendData);
    window.mapEventBus.on('memphis-colossus:legendCleared', handleMemphisColossusLegendCleared);
    window.mapEventBus.on('memphis-colossus:legendSelect', handleMemphisColossusLegendSelect);

    return () => {
      window.mapEventBus.off('serp:dataLoaded', handleSerpDataLoaded);
      window.mapEventBus.off('osm:geographicContext', handleOsmDataLoaded);
      window.mapEventBus.off('pinal:analysisComplete', handlePinalAnalysisComplete);
      window.mapEventBus.off('pinal:analysisCleared', handlePinalAnalysisCleared);
      window.mapEventBus.off('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
      window.mapEventBus.off('perplexity:analysisCleared', handlePerplexityAnalysisCleared);
      window.mapEventBus.off('pa:analysisComplete', handlePAAnalysisComplete);
      window.mapEventBus.off('pa:analysisCleared', handlePAAnalysisCleared);
      window.mapEventBus.off('memphis-colossus:legendData', handleMemphisColossusLegendData);
      window.mapEventBus.off('memphis-colossus:legendCleared', handleMemphisColossusLegendCleared);
      window.mapEventBus.off('memphis-colossus:legendSelect', handleMemphisColossusLegendSelect);
    };
  }, [isVisible, onToggle]);


  // Listen for marker click events to highlight corresponding legend item
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleMarkerSelected = (markerData) => {
      setSelectedMarker(markerData);
    };

    // Listen for marker selection events
    window.mapEventBus.on('marker:selected', handleMarkerSelected);
    
    // Also listen for when markers are deselected
    window.mapEventBus.on('marker:deselected', () => {
      setSelectedMarker(null);
    });

    return () => {
      window.mapEventBus.off('marker:selected', handleMarkerSelected);
      window.mapEventBus.off('marker:deselected', () => {});
    };
  }, []);


  // Function to handle legend item clicks
  const handleLegendItemClick = (displayLabel, item = null) => {
    // Memphis Colossus: click to highlight this class on map, dim others
    if (item && item.change_label !== undefined) {
      const next = memphisColossusSelectedLabel === item.change_label ? null : item.change_label;
      setMemphisColossusSelectedLabel(next);
      if (window.mapEventBus) {
        window.mapEventBus.emit('memphis-colossus:legendSelect', next);
      }
      return;
    }

    // Check if this is a startup category toggle
    if (item && item.category && item.category in startupCategoryVisibility) {
      toggleStartupCategory(item.category);
      return;
    }

    // Check if this is a real estate category toggle
    if (item && item.category && item.category in realEstateCategoryVisibility) {
      toggleRealEstateCategory(item.category);
      return;
    }

    // Check if this is a Pinal County layer toggle
    if (item && item.category && item.category in pinalLayerVisibility) {
      togglePinalLayer(item.category);
      return;
    }

    // Check if this is a PA Nuclear Sites layer toggle
    if (item && item.category && item.category in paLayerVisibility) {
      togglePALayer(item.category);
      return;
    }

    // Check if this is a Perplexity layer toggle
    if (item && item.category && item.category in perplexityLayerVisibility) {
      togglePerplexityLayer(item.category);
      return;
    }

    // Check if this is an OSM layer toggle
    if (item && item.layerName && item.layerName in osmLayerVisibility) {
      toggleOsmLayer(item.layerName);
      return;
    }

    // Handle SERP marker clicks (existing functionality)
    if (!map?.current || !handleMarkerClick || !legendData.serpFeatures.length) {
      return;
    }

    // Map display labels back to actual category names
    const categoryMap = {
      'Startups': 'startups',
      'Investors': 'investors', 
      'Co-working Spaces': 'co-working spaces',
      'Universities': 'universities',
      'Research Institutions': 'research institutions',
      'Other Facilities': 'other facilities'
    };

    const actualCategory = categoryMap[displayLabel] || displayLabel.toLowerCase();

    // Find the first marker of this category
    const markerFeature = legendData.serpFeatures.find(feature => 
      feature.properties?.category === actualCategory
    );

    if (!markerFeature) {
      return;
    }

    const coordinates = markerFeature.geometry.coordinates;
    const properties = markerFeature.properties;
    
    // Calculate distance from Boston center (-71.0589, 42.3601)
    const bostonCoords = [-71.0589, 42.3601];
    const distance = calculateDistance(coordinates, bostonCoords);
    
    // Prepare marker data (same format as SerpTool)
    const markerData = {
      title: properties.title || properties.name || 'Infrastructure',
      category: properties.category || 'Unknown',
      address: properties.address || 'No address available',
      rating: properties.rating || null,
      phone: properties.phone || null,
      website: properties.website || null,
      coordinates: coordinates,
      distance: distance,
      description: properties.description || null,
      hours: properties.hours || null,
      serp_id: properties.serp_id || null
    };
    
    // Emit event to notify table system about legend selection
    if (window.mapEventBus) {
      const legendBridgeData = {
        markerData: markerData,
        displayLabel: displayLabel,
        actualCategory: actualCategory,
        coordinates: coordinates,
        timestamp: Date.now()
      };
      
      window.mapEventBus.emit('legend:itemSelected', legendBridgeData);
    }
    
    // Trigger the same behavior as clicking the marker on the map
    handleMarkerClick(markerData);
    
    // Also handle map interactions: highlight marker and zoom to it
    highlightMarkerOnMap(markerData);
    zoomToMarker(markerData);
    
    // Trigger animation when legend item is clicked
    if (window.nodeAnimation) {
      const animationType = markerData.category === 'power plants' ? 'pulse' :
                           markerData.category === 'electric utilities' ? 'ripple' :
                           markerData.category === 'water facilities' ? 'glow' :
                           markerData.category === 'data centers' ? 'heartbeat' : 'pulse';
      
      window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
        type: animationType,
        intensity: 0.8,
        duration: 3.0,
        nodeData: markerData,
        category: markerData.category
      });
    }
  };

  // Helper function to calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  };

  // Find matching legend item based on table node data
  const findMatchingLegendItem = useCallback((bridgeData) => {
    if (!legendData.serpFeatures || legendData.serpFeatures.length === 0) {
      return null;
    }

    const { tableNode, coordinates, searchTerms } = bridgeData;
    let bestMatch = null;
    let bestScore = 0;

    // Search through all available features
    legendData.serpFeatures.forEach((feature, index) => {
      let score = 0;

      // 1. Coordinate matching (highest priority)
      if (coordinates && feature.geometry?.coordinates) {
        const distance = calculateDistance(coordinates, feature.geometry.coordinates);
        
        if (distance < 0.5) { // Within 0.5 miles
          score += 50;
        } else if (distance < 2) { // Within 2 miles
          score += 25;
        }
      }

      // 2. Name matching
      const featureName = (feature.properties?.title || feature.properties?.name || '').toLowerCase();
      const tableName = tableNode.name.toLowerCase();
      
      // Direct name matching
      if (featureName.includes(tableName.split(' ')[0]) || tableName.includes(featureName.split(' ')[0])) {
        score += 30;
      }

      // 3. Search terms matching
      searchTerms.forEach(term => {
        if (featureName.includes(term)) {
          score += 5;
        }
        if (feature.properties?.category?.includes(term)) {
          score += 10;
        }
      });

      // 4. Type-based category matching
      const nodeType = (tableNode.type || '').toLowerCase();
      const featureCategory = feature.properties?.category || '';
      
      if ((nodeType.includes('startup') || nodeType.includes('company')) && featureCategory.includes('startup')) {
        score += 20;
      }
      if ((nodeType.includes('investor') || nodeType.includes('venture')) && featureCategory.includes('investor')) {
        score += 20;
      }
      if (nodeType.includes('university') && featureCategory.includes('university')) {
        score += 20;
      }
      if (nodeType.includes('research') && featureCategory.includes('research')) {
        score += 20;
      }
      if (nodeType.includes('co-working') && featureCategory.includes('co-working')) {
        score += 20;
      }

      // Update best match if this score is higher
      if (score > bestScore) {
        bestScore = score;
        bestMatch = feature;
      }
    });

    if (bestMatch && bestScore >= 20) { // Minimum threshold for a valid match
      // Convert to marker data format
      const coordinates = bestMatch.geometry.coordinates;
      const properties = bestMatch.properties;
      const bostonCoords = [-71.0589, 42.3601];
      const distance = calculateDistance(coordinates, bostonCoords);
      
      return {
        title: properties.title || properties.name || 'Infrastructure',
        category: properties.category || 'Unknown',
        address: properties.address || 'No address available',
        rating: properties.rating || null,
        phone: properties.phone || null,
        website: properties.website || null,
        coordinates: coordinates,
        distance: distance,
        description: properties.description || null,
        hours: properties.hours || null,
        serp_id: properties.serp_id || null
      };
    }

    return null;
  }, [legendData]);

  // Function to highlight the selected marker on the map
  const highlightMarkerOnMap = useCallback((markerData) => {
    if (!map?.current || !markerData.serp_id) {
      return;
    }

    // Check if the SERP startup ecosystem layer exists
    if (!map.current.getLayer('serp-startup-ecosystem-markers')) {
      return;
    }

    // Update marker styling to highlight the selected marker
    // This uses the same logic as StartupEcosystemToolExecutor.updateMarkerStyling()
    map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-color', [
      'case',
      ['==', ['get', 'serp_id'], markerData.serp_id], '#ef4444', // Red for selected marker
      ['==', ['get', 'category'], 'startups'], '#ef4444',
      ['==', ['get', 'category'], 'investors'], '#f59e0b',
      ['==', ['get', 'category'], 'co-working spaces'], '#8b5cf6',
      ['==', ['get', 'category'], 'universities'], '#10b981',
      ['==', ['get', 'category'], 'research institutions'], '#3b82f6',
      '#6b7280'
    ]);

    // Make selected marker larger
    map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'serp_id'], markerData.serp_id], 12, // Larger for selected marker
      ['==', ['get', 'category'], 'startups'], 8,
      ['==', ['get', 'category'], 'investors'], 7,
      ['==', ['get', 'category'], 'co-working spaces'], 6,
      ['==', ['get', 'category'], 'universities'], 9,
      ['==', ['get', 'category'], 'research institutions'], 8,
      5
    ]);

    // Make selected marker more opaque
    map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', [
      'case',
      ['==', ['get', 'serp_id'], markerData.serp_id], 1.0, // Full opacity for selected
      0.8
    ]);
  }, [map]);

  // Function to zoom to the selected marker
  const zoomToMarker = useCallback((markerData) => {
    if (!map?.current || !markerData.coordinates) {
      return;
    }

    // Fly to the marker location with appropriate zoom level
    map.current.flyTo({
      center: markerData.coordinates,
      zoom: 14, // Good zoom level to see the marker and surrounding area
      duration: 1500, // Smooth animation
      essential: true
    });
  }, [map]);

  // Function to toggle startup category visibility
  const toggleStartupCategory = useCallback((category) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = startupCategoryVisibility[category];
    const newVisibility = !currentVisibility;

    try {
      // Check if the startup ecosystem layer exists
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Create a new opacity expression that respects category visibility
        const newOpacityExpression = [
          'case',
            ['==', ['get', 'category'], category], newVisibility ? 0.2 : 0, // Hide/show specific category
          // Keep other categories at their current visibility
          ['==', ['get', 'category'], 'AI/ML'], startupCategoryVisibility['AI/ML'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Biotech/Health'], startupCategoryVisibility['Biotech/Health'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'FinTech'], startupCategoryVisibility['FinTech'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'CleanTech'], startupCategoryVisibility['CleanTech'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Enterprise'], startupCategoryVisibility['Enterprise'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Hardware'], startupCategoryVisibility['Hardware'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], startupCategoryVisibility['Other'] ? 0.2 : 0,
          0.2 // Default opacity for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', newOpacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', newOpacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          // Update the visibility state for radius particles
          window.serpRadiusParticlesVisibility[category] = newVisibility;
          
          // Update all categories in the visibility state
          Object.keys(startupCategoryVisibility).forEach(cat => {
            if (cat !== category) {
              window.serpRadiusParticlesVisibility[cat] = startupCategoryVisibility[cat];
            }
          });
        }
        
        // Update state
        setStartupCategoryVisibility(prev => ({
          ...prev,
          [category]: newVisibility
        }));
      }
    } catch (error) {
      // Error handling
    }
  }, [map, startupCategoryVisibility]);

  // Function to toggle real estate category visibility
  const toggleRealEstateCategory = useCallback((category) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = realEstateCategoryVisibility[category];
    const newVisibility = !currentVisibility;

    try {
      // Check if the startup ecosystem layer exists (reused for real estate)
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Create a new opacity expression that respects real estate category visibility
        const newOpacityExpression = [
          'case',
            ['==', ['get', 'category'], category], newVisibility ? 0.2 : 0, // Hide/show specific category
          // Keep other categories at their current visibility
          ['==', ['get', 'category'], 'Residential Sale'], realEstateCategoryVisibility['Residential Sale'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Residential Lease'], realEstateCategoryVisibility['Residential Lease'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Commercial Sale'], realEstateCategoryVisibility['Commercial Sale'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Commercial Lease'], realEstateCategoryVisibility['Commercial Lease'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Luxury'], realEstateCategoryVisibility['Luxury'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Budget'], realEstateCategoryVisibility['Budget'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Mid-Range'], realEstateCategoryVisibility['Mid-Range'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Premium'], realEstateCategoryVisibility['Premium'] ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], realEstateCategoryVisibility['Other'] ? 0.2 : 0,
          0.2 // Default opacity for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', newOpacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', newOpacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          // Update the visibility state for radius particles
          window.serpRadiusParticlesVisibility[category] = newVisibility;
          
          // Update all categories in the visibility state
          Object.keys(realEstateCategoryVisibility).forEach(cat => {
            if (cat !== category) {
              window.serpRadiusParticlesVisibility[cat] = realEstateCategoryVisibility[cat];
            }
          });
        }
        
        // Update state
        setRealEstateCategoryVisibility(prev => ({
          ...prev,
          [category]: newVisibility
        }));
      }
    } catch (error) {
      // Error handling
    }
  }, [map, realEstateCategoryVisibility]);

  // Function to toggle OSM layer visibility
  const toggleOsmLayer = useCallback((layerName) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = osmLayerVisibility[layerName];
    const newVisibility = !currentVisibility;

    // Map layer names to actual map layer names - location-aware
    const locationUniversities = getLocationUniversities(currentLocation);
    const layerMap = {
      // Dynamic university layers based on location
      ...Object.keys(locationUniversities).reduce((acc, key) => {
        acc[key] = `osm-${key}`;
        return acc;
      }, {}),
      // Common layers
      otherUniversities: 'osm-other-universities',
      offices: 'osm-offices', 
      transportation: 'osm-transportation-stations',
      water: 'osm-water',
      parks: 'osm-parks',
      commercial: 'osm-commercial',
      analysisRadius: 'osm-radius',
      // Road layers
      highways: 'osm-highways',
      primaryRoads: 'osm-primary-roads',
      secondaryRoads: 'osm-secondary-roads',
      localRoads: 'osm-local-roads',
      residentialRoads: 'osm-residential-roads',
      roads: 'osm-roads',
      highway_junctions: 'osm-highway-junctions'
    };

    const mapLayerName = layerMap[layerName];
    
    if (!mapLayerName) {
      return;
    }

    try {
        // Special handling for water layer - toggle water lines, fill, and points
      if (layerName === 'water') {
          const waterLayers = ['osm-water-lines', 'osm-water-fill', 'osm-water-points'];
        let allLayersExist = true;
        
        waterLayers.forEach(waterLayerName => {
          if (map.current.getLayer(waterLayerName)) {
            map.current.setLayoutProperty(waterLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          } else {
            allLayersExist = false;
          }
        });
        
        if (allLayersExist) {
          setOsmLayerVisibility(prev => ({
            ...prev,
            [layerName]: newVisibility
          }));
        }
      } else {
        // Check if layer exists before trying to toggle it
        if (map.current.getLayer(mapLayerName)) {
          // Toggle layer visibility
          map.current.setLayoutProperty(mapLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          
          // Also toggle associated marker layer if it exists
          const markerLayerName = `${mapLayerName}-markers`;
          if (map.current.getLayer(markerLayerName)) {
            map.current.setLayoutProperty(markerLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          }
          
          // Update state
          setOsmLayerVisibility(prev => ({
            ...prev,
            [layerName]: newVisibility
          }));
        }
      }
    } catch (error) {
      // Error handling
    }
  }, [map, osmLayerVisibility]);

  // Function to toggle all startup categories
  const toggleAllStartupCategories = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Check if the startup ecosystem layer exists
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Set all categories to the same visibility
        const newVisibility = {};
        Object.keys(startupCategoryVisibility).forEach(category => {
          newVisibility[category] = visible;
        });

        // Update the circle-opacity to show/hide all categories
        const opacityExpression = [
          'case',
          ['==', ['get', 'category'], 'AI/ML'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Biotech/Health'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'FinTech'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'CleanTech'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Enterprise'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Hardware'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], visible ? 0.2 : 0,
          visible ? 0.2 : 0 // Default for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', opacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', opacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          // Update all startup categories in the visibility state
          Object.keys(startupCategoryVisibility).forEach(cat => {
            window.serpRadiusParticlesVisibility[cat] = visible;
          });
        }
        
        // Update state
        setStartupCategoryVisibility(newVisibility);
      }
    } catch (error) {
      // Error handling
    }
  }, [map, startupCategoryVisibility]);

  // Function to toggle all real estate categories
  const toggleAllRealEstateCategories = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Check if the startup ecosystem layer exists (reused for real estate)
      if (map.current.getLayer('serp-startup-ecosystem-markers')) {
        // Set all categories to the same visibility
        const newVisibility = {};
        Object.keys(realEstateCategoryVisibility).forEach(category => {
          newVisibility[category] = visible;
        });

        // Update the circle-opacity to show/hide all categories
        const opacityExpression = [
          'case',
          ['==', ['get', 'category'], 'Residential Sale'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Residential Lease'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Commercial Sale'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Commercial Lease'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Luxury'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Budget'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Mid-Range'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Premium'], visible ? 0.2 : 0,
          ['==', ['get', 'category'], 'Other'], visible ? 0.2 : 0,
          visible ? 0.2 : 0 // Default for any other categories
        ];

        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', opacityExpression);
        map.current.setPaintProperty('serp-startup-ecosystem-markers', 'circle-stroke-opacity', opacityExpression);
        
        // Also toggle the radius particles visibility
        if (window.serpRadiusParticlesVisibility) {
          // Update all real estate categories in the visibility state
          Object.keys(realEstateCategoryVisibility).forEach(cat => {
            window.serpRadiusParticlesVisibility[cat] = visible;
          });
        }
        
        // Update state
        setRealEstateCategoryVisibility(newVisibility);
      }
    } catch (error) {
      // Error handling
    }
  }, [map, realEstateCategoryVisibility]);

  // Function to toggle Pinal County layer visibility
  const togglePinalLayer = useCallback((layerName) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = pinalLayerVisibility[layerName];
    const newVisibility = !currentVisibility;

    try {
      // Map Pinal County categories to map layer names
      const layerMap = {
        office_building: 'osm-features',
        commercial_building: 'osm-features',
        retail_building: 'osm-features',
        government_facility: 'osm-features',
        education: 'osm-features',
        healthcare: 'osm-features',
        service_amenity: 'osm-features',
        emergency_services: 'osm-features',
        transit_hub: 'osm-features',
        highway_access: 'osm-features',
        recreation_area: 'osm-features',
        industrial: 'osm-features',
        county_boundary: 'pinal-county-boundary', // Special handling for county boundary
        pinal_zone: 'pinal-zone' // Special handling for zone layers
      };

      const mapLayerName = layerMap[layerName];
      
      if (layerName === 'pinal_zone') {
        // Toggle all Pinal County zone layers
        const zoneKeys = ['casa_grande', 'florence', 'apache_junction'];
        zoneKeys.forEach(zoneKey => {
          const zoneLayers = [`pinal-zone-${zoneKey}-circle`, `pinal-zone-${zoneKey}-fill`];
          zoneLayers.forEach(zoneLayerName => {
            if (map.current.getLayer(zoneLayerName)) {
              map.current.setLayoutProperty(zoneLayerName, 'visibility', newVisibility ? 'visible' : 'none');
            }
          });
        });
      } else if (layerName === 'county_boundary') {
        // Toggle county boundary layers
        const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
        boundaryLayers.forEach(boundaryLayerName => {
          if (map.current.getLayer(boundaryLayerName)) {
            map.current.setLayoutProperty(boundaryLayerName, 'visibility', newVisibility ? 'visible' : 'none');
          }
        });
      } else if (mapLayerName === 'osm-features') {
        // Toggle Pinal County features by updating the filter
        if (map.current.getLayer('osm-features-lines')) {
          const currentFilter = map.current.getFilter('osm-features-lines');
          // Update filter to hide/show specific category
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-features-lines', newFilter);
        }
        
        if (map.current.getLayer('osm-features-fill')) {
          const currentFilter = map.current.getFilter('osm-features-fill');
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-features-fill', newFilter);
        }
        
        if (map.current.getLayer('osm-pois')) {
          const currentFilter = map.current.getFilter('osm-pois');
          const newFilter = newVisibility ? 
            ['any', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-pois', newFilter);
        }
      }
      
      // Update state
      setPinalLayerVisibility(prev => ({
        ...prev,
        [layerName]: newVisibility
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, pinalLayerVisibility]);

  // Function to toggle Perplexity layer visibility (simplified)
  const togglePerplexityLayer = useCallback((category) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = perplexityLayerVisibility[category];
    const newVisibility = !currentVisibility;
    const layerId = `perplexity-analysis-${category}`;

    try {
      // Check if the specific category layer exists
      if (map.current.getLayer(layerId)) {
        // Toggle layer visibility using layout property
        map.current.setLayoutProperty(layerId, 'visibility', newVisibility ? 'visible' : 'none');
        
        // Update state
        setPerplexityLayerVisibility(prev => ({
          ...prev,
          [category]: newVisibility
        }));
      }
    } catch (error) {
      // Error handling
    }
  }, [map, perplexityLayerVisibility]);

  // Function to toggle all Perplexity layers (simplified)
  const toggleAllPerplexityLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Set all categories to the same visibility
      const newVisibility = {};
      Object.keys(perplexityLayerVisibility).forEach(category => {
        newVisibility[category] = visible;
        
        // Toggle individual layer visibility
        const layerId = `perplexity-analysis-${category}`;
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      });
      
      // Update state
      setPerplexityLayerVisibility(newVisibility);
    } catch (error) {
      // Error handling
    }
  }, [map, perplexityLayerVisibility]);

  // Function to toggle Pinal County layer opacity (translucent mode)
  const togglePinalLayerOpacity = useCallback(() => {
    if (!map?.current) {
      return;
    }

    const newTranslucentState = !pinalLayerOpacity.isTranslucent;
    const opacityValue = newTranslucentState ? 0.4 : 0.8; // 60% more translucent when enabled
    const fillOpacityValue = newTranslucentState ? 0.12 : 0.3; // 60% more translucent for fills
    const circleOpacityValue = newTranslucentState ? 0.4 : 1; // 60% more translucent for circles

    try {
      // Update line layer opacity
      if (map.current.getLayer('osm-features-lines')) {
        map.current.setPaintProperty('osm-features-lines', 'line-opacity', opacityValue);
      }
      
      // Update fill layer opacity
      if (map.current.getLayer('osm-features-fill')) {
        map.current.setPaintProperty('osm-features-fill', 'fill-opacity', fillOpacityValue);
      }
      
      // Update POI circles opacity
      if (map.current.getLayer('osm-pois')) {
        map.current.setPaintProperty('osm-pois', 'circle-opacity', circleOpacityValue);
      }
      
      // Update Pinal County zone circles opacity
      const zoneKeys = ['casa_grande', 'florence', 'apache_junction'];
      zoneKeys.forEach(zoneKey => {
        if (map.current.getLayer(`pinal-zone-${zoneKey}-circle`)) {
          map.current.setPaintProperty(`pinal-zone-${zoneKey}-circle`, 'line-opacity', opacityValue);
        }
        if (map.current.getLayer(`pinal-zone-${zoneKey}-fill`)) {
          map.current.setPaintProperty(`pinal-zone-${zoneKey}-fill`, 'fill-opacity', fillOpacityValue);
        }
      });
      
      // Update state
      setPinalLayerOpacity(prev => ({
        ...prev,
        isTranslucent: newTranslucentState
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, pinalLayerOpacity.isTranslucent]);

  // Function to toggle OSM layer opacity (translucent mode)
  const toggleOsmLayerOpacity = useCallback(() => {
    if (!map?.current) {
      return;
    }

    const newTranslucentState = !osmLayerOpacity.isTranslucent;
    const opacityValue = newTranslucentState ? 0.35 : 1.0; // 35% opacity when dimmed (65% more dim)

    try {
      // Use the same layer mapping logic as toggleAllOsmLayers
      const locationUniversities = getLocationUniversities(currentLocation);
      const layerMap = {
        // Dynamic university layers based on location
        ...Object.keys(locationUniversities).reduce((acc, key) => {
          acc[key] = `osm-${key}`;
          return acc;
        }, {}),
        // Common layers
        otherUniversities: 'osm-other-universities',
        offices: 'osm-offices', 
        transportation: 'osm-transportation-stations',
        water: 'osm-water',
        parks: 'osm-parks',
        commercial: 'osm-commercial',
        analysisRadius: 'osm-radius'
      };

      // Update each OSM layer's opacity
      Object.values(layerMap).forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          // Try different paint properties based on layer type with error handling
          try {
            const lineOpacity = map.current.getPaintProperty(layerId, 'line-opacity');
            if (lineOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'line-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const fillOpacity = map.current.getPaintProperty(layerId, 'fill-opacity');
            if (fillOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'fill-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const circleOpacity = map.current.getPaintProperty(layerId, 'circle-opacity');
            if (circleOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'circle-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const symbolOpacity = map.current.getPaintProperty(layerId, 'symbol-opacity');
            if (symbolOpacity !== undefined) {
              map.current.setPaintProperty(layerId, 'symbol-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }
        }
      });

      // Also handle water layers specifically (they have separate line, fill, and point layers)
      const waterLayers = ['osm-water-lines', 'osm-water-fill', 'osm-water-points'];
      waterLayers.forEach(waterLayerId => {
        if (map.current.getLayer(waterLayerId)) {
          try {
            const lineOpacity = map.current.getPaintProperty(waterLayerId, 'line-opacity');
            if (lineOpacity !== undefined) {
              map.current.setPaintProperty(waterLayerId, 'line-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const fillOpacity = map.current.getPaintProperty(waterLayerId, 'fill-opacity');
            if (fillOpacity !== undefined) {
              map.current.setPaintProperty(waterLayerId, 'fill-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }

          try {
            const circleOpacity = map.current.getPaintProperty(waterLayerId, 'circle-opacity');
            if (circleOpacity !== undefined) {
              map.current.setPaintProperty(waterLayerId, 'circle-opacity', opacityValue);
            }
          } catch (e) {
            // Property doesn't exist for this layer type
          }
        }
      });

      // Update state
      setOsmLayerOpacity(prev => ({
        ...prev,
        isTranslucent: newTranslucentState
      }));
    } catch (error) {
      // Error handling
    }
  }, [map, osmLayerOpacity.isTranslucent, currentLocation]);

  // Auto-toggle OSM layers to dim (translucent) mode 1 second after OSM data is loaded
  useEffect(() => {
    if (!map?.current || !window.mapEventBus) return;

    const handlePAAnalysisComplete = () => {
      // Wait 1 second after PA analysis completes (when OSM data is mounted), then toggle to dim mode
      const timer = setTimeout(() => {
        // Check if OSM layers exist and if not already in translucent mode
        const hasOsmLayers = 
          map.current.getLayer('osm-water-lines') ||
          map.current.getLayer('osm-water-fill') ||
          map.current.getLayer('osm-water-points') ||
          map.current.getLayer('osm-transmission-lines') ||
          map.current.getLayer('osm-substations') ||
          map.current.getLayer('osm-features-lines') ||
          map.current.getLayer('osm-features-fill') ||
          map.current.getLayer('osm-pois');

        // Only toggle if layers exist and not already translucent
        if (hasOsmLayers && !osmLayerOpacity.isTranslucent) {
          toggleOsmLayerOpacity();
        }
      }, 1000); // 1 second delay after data loads

      return () => clearTimeout(timer);
    };

    // Listen for PA analysis complete (when OSM data is mounted)
    window.mapEventBus.on('pa:analysisComplete', handlePAAnalysisComplete);
    
    // Also check after initial mount if layers already exist (for cases where data loaded before this component)
    const immediateTimer = setTimeout(() => {
      if (!map?.current) return;
      
      const hasOsmLayers = 
        map.current.getLayer('osm-water-lines') ||
        map.current.getLayer('osm-water-fill') ||
        map.current.getLayer('osm-water-points') ||
        map.current.getLayer('osm-transmission-lines') ||
        map.current.getLayer('osm-substations') ||
        map.current.getLayer('osm-features-lines') ||
        map.current.getLayer('osm-features-fill') ||
        map.current.getLayer('osm-pois');

      if (hasOsmLayers && !osmLayerOpacity.isTranslucent) {
        toggleOsmLayerOpacity();
      }
    }, 1000);

    return () => {
      window.mapEventBus.off('pa:analysisComplete', handlePAAnalysisComplete);
      clearTimeout(immediateTimer);
    };
  }, [map, osmLayerOpacity.isTranslucent, toggleOsmLayerOpacity]);

  // Functions to toggle section collapse
  const togglePinalSectionCollapse = useCallback(() => {
    setPinalSectionCollapsed(prev => !prev);
  }, []);

  const toggleRealEstateSectionCollapse = useCallback(() => {
    setRealEstateSectionCollapsed(prev => !prev);
  }, []);

  const toggleUrbanInfrastructureSectionCollapse = useCallback(() => {
    setUrbanInfrastructureSectionCollapsed(prev => !prev);
  }, []);

  const togglePinalAnalysisAreaSectionCollapse = useCallback(() => {
    setPinalAnalysisAreaSectionCollapsed(prev => !prev);
  }, []);

  // Helper function to get section collapse state and toggle function
  const getSectionCollapseInfo = useCallback((sectionTitle) => {
    const collapsibleSections = {
      'Pinal County Infrastructure Analysis': {
        isCollapsed: pinalSectionCollapsed,
        toggle: togglePinalSectionCollapse
      },
      'Real Estate Categories': {
        isCollapsed: realEstateSectionCollapsed,
        toggle: toggleRealEstateSectionCollapse
      },
      'Urban Infrastructure (OpenStreetMap)': {
        isCollapsed: urbanInfrastructureSectionCollapsed,
        toggle: toggleUrbanInfrastructureSectionCollapse
      },
      'Pinal County Analysis Area': {
        isCollapsed: pinalAnalysisAreaSectionCollapsed,
        toggle: togglePinalAnalysisAreaSectionCollapse
      }
    };
    
    return collapsibleSections[sectionTitle] || { isCollapsed: false, toggle: null };
  }, [pinalSectionCollapsed, realEstateSectionCollapsed, urbanInfrastructureSectionCollapsed, pinalAnalysisAreaSectionCollapsed, togglePinalSectionCollapse, toggleRealEstateSectionCollapse, toggleUrbanInfrastructureSectionCollapse, togglePinalAnalysisAreaSectionCollapse]);

  // Function to toggle all Pinal County layers
  const toggleAllPinalLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Toggle all Pinal County zone layers
      const zoneKeys = ['casa_grande', 'florence', 'apache_junction'];
      zoneKeys.forEach(zoneKey => {
        const zoneLayers = [`pinal-zone-${zoneKey}-circle`, `pinal-zone-${zoneKey}-fill`];
        zoneLayers.forEach(zoneLayerName => {
          if (map.current.getLayer(zoneLayerName)) {
            map.current.setLayoutProperty(zoneLayerName, 'visibility', visible ? 'visible' : 'none');
          }
        });
      });

      // Toggle Pinal County features by updating opacity
      if (map.current.getLayer('osm-features-lines')) {
        map.current.setPaintProperty('osm-features-lines', 'line-opacity', visible ? 0.8 : 0);
      }
      if (map.current.getLayer('osm-features-fill')) {
        map.current.setPaintProperty('osm-features-fill', 'fill-opacity', visible ? 0.3 : 0);
      }
      if (map.current.getLayer('osm-pois')) {
        map.current.setPaintProperty('osm-pois', 'circle-opacity', visible ? 1 : 0);
      }
      
      // Toggle county boundary layers
      const boundaryLayers = ['pinal-county-boundary-fill', 'pinal-county-boundary-line'];
      boundaryLayers.forEach(boundaryLayerName => {
        if (map.current.getLayer(boundaryLayerName)) {
          map.current.setLayoutProperty(boundaryLayerName, 'visibility', visible ? 'visible' : 'none');
        }
      });
      
      // Update all Pinal County layer visibility states
      const newVisibility = {};
      Object.keys(pinalLayerVisibility).forEach(layerName => {
        newVisibility[layerName] = visible;
      });
      
      setPinalLayerVisibility(newVisibility);
    } catch (error) {
      // Error handling
    }
  }, [map, pinalLayerVisibility]);

  // Function to toggle PA Nuclear Sites layer visibility
  const togglePALayer = useCallback((layerName) => {
    if (!map?.current) {
      return;
    }

    const currentVisibility = paLayerVisibility[layerName];
    const newVisibility = !currentVisibility;

    try {
      // Map PA categories to map layer names
      const layerMap = {
        transmission_line: 'osm-transmission-lines',
        power_line: 'osm-transmission-lines', // Same layer for both
        substation: 'osm-substations',
        power_substation: 'osm-substations',
        power_facility: 'osm-substations',
        water: 'osm-water-fill',
        waterway: 'osm-water-lines',
        water_body: 'osm-water-fill',
        office_building: 'osm-features-fill',
        commercial_building: 'osm-features-fill',
        government_facility: 'osm-features-fill',
        education: 'osm-pois',
        healthcare: 'osm-pois',
        industrial: 'osm-features-fill',
        pa_zone: 'pa-zone' // Special handling for zone layers
      };

      const mapLayerName = layerMap[layerName];
      
      if (layerName === 'pa_zone') {
        // Toggle all PA zone layers
        const paSiteKeys = ['three_mile_island_pa', 'susquehanna_nuclear_pa'];
        paSiteKeys.forEach(siteKey => {
          const zoneLayers = [`pa-zone-${siteKey}-circle`, `pa-zone-${siteKey}-fill`];
          zoneLayers.forEach(zoneLayerName => {
            if (map.current.getLayer(zoneLayerName)) {
              map.current.setLayoutProperty(zoneLayerName, 'visibility', newVisibility ? 'visible' : 'none');
            }
          });
        });
      } else if (mapLayerName === 'osm-transmission-lines') {
        // Toggle transmission lines layer - PA OSM uses category: "power" with LineString geometry
        if (map.current.getLayer('osm-transmission-lines')) {
          // Calculate visibility after this toggle
          const transmissionVisible = layerName === 'transmission_line' ? newVisibility : paLayerVisibility.transmission_line;
          const powerLineVisible = layerName === 'power_line' ? newVisibility : paLayerVisibility.power_line;
          
          // PA OSM data uses category: "power" with geometry type "LineString"
          // Build filter for power lines (all power LineString features)
          if (transmissionVisible || powerLineVisible) {
            // Show all power lines (category: "power" with LineString geometry)
            map.current.setFilter('osm-transmission-lines', [
              'all',
              ['==', ['get', 'category'], 'power'],
              ['==', ['geometry-type'], 'LineString']
            ]);
            map.current.setPaintProperty('osm-transmission-lines', 'line-opacity', 0.9);
          } else {
            map.current.setPaintProperty('osm-transmission-lines', 'line-opacity', 0);
          }
        }
      } else if (mapLayerName === 'osm-substations') {
        // Toggle substations layer - PA OSM uses category: "power" with Point/Polygon geometry
        if (map.current.getLayer('osm-substations')) {
          // Calculate visibility after this toggle
          const substationVisible = layerName === 'substation' ? newVisibility : paLayerVisibility.substation;
          const powerSubstationVisible = layerName === 'power_substation' ? newVisibility : paLayerVisibility.power_substation;
          const powerFacilityVisible = layerName === 'power_facility' ? newVisibility : paLayerVisibility.power_facility;
          
          // PA OSM data uses category: "power" with geometry type "Point" or "Polygon" for substations
          if (substationVisible || powerSubstationVisible || powerFacilityVisible) {
            // Show all power points/polygons (category: "power" with Point or Polygon geometry)
            map.current.setFilter('osm-substations', [
              'all',
              ['==', ['get', 'category'], 'power'],
              ['in', ['get', 'geometry-type'], ['literal', ['Point', 'Polygon']]]
            ]);
            map.current.setPaintProperty('osm-substations', 'circle-opacity', 1);
          } else {
            map.current.setPaintProperty('osm-substations', 'circle-opacity', 0);
          }
        }
      } else if (mapLayerName === 'osm-water-lines') {
        // Toggle water lines layer - PA OSM uses category: "water" for waterways (LineString only)
        if (map.current.getLayer('osm-water-lines')) {
          const waterwayVisible = layerName === 'waterway' ? newVisibility : paLayerVisibility.waterway;
          
          // PA OSM data uses category: "water" for waterways - only LineString geometry
          if (waterwayVisible) {
            map.current.setFilter('osm-water-lines', [
              'all',
              ['==', ['geometry-type'], 'LineString'],
              ['any',
              ['==', ['get', 'category'], 'waterway'],
                ['==', ['get', 'category'], 'water']
              ]
            ]);
            map.current.setPaintProperty('osm-water-lines', 'line-opacity', 0.7);
          } else {
            map.current.setPaintProperty('osm-water-lines', 'line-opacity', 0);
          }
        }
      } else if (mapLayerName === 'osm-water-fill') {
        // Toggle water fill layer - PA OSM uses category: "water" (Polygon outline only)
        if (map.current.getLayer('osm-water-fill')) {
          const waterBodyVisible = layerName === 'water_body' ? newVisibility : paLayerVisibility.water_body;
          const waterVisible = layerName === 'water' ? newVisibility : paLayerVisibility.water;
          
          // PA OSM data uses category: "water" - water-fill is a line layer (Polygon outline only)
          if (waterBodyVisible || waterVisible) {
            // Show water outlines (category: "water" or "water_body" with Polygon geometry)
            map.current.setFilter('osm-water-fill', [
              'all',
              ['==', ['geometry-type'], 'Polygon'],
              ['any',
              ['==', ['get', 'category'], 'water'],
              ['==', ['get', 'category'], 'water_body']
              ]
            ]);
            map.current.setPaintProperty('osm-water-fill', 'line-opacity', 0.7);
          } else {
            map.current.setPaintProperty('osm-water-fill', 'line-opacity', 0);
          }
        }
      } else if (layerName === 'water' && !mapLayerName) {
        // Handle general "water" toggle - toggle all water layers including points
        const waterLayers = ['osm-water-lines', 'osm-water-fill', 'osm-water-points'];
        waterLayers.forEach(waterLayerName => {
          if (map.current.getLayer(waterLayerName)) {
            if (waterLayerName === 'osm-water-points') {
              map.current.setPaintProperty(waterLayerName, 'circle-opacity', newVisibility ? 0.7 : 0);
            } else {
              map.current.setPaintProperty(waterLayerName, 'line-opacity', newVisibility ? 0.7 : 0);
            }
          }
        });
      } else if (mapLayerName === 'osm-features-fill') {
        // Toggle fill layer for buildings
        if (map.current.getLayer('osm-features-fill')) {
          const currentFilter = map.current.getFilter('osm-features-fill') || ['==', ['geometry-type'], 'Polygon'];
          const newFilter = newVisibility ? 
            ['all', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-features-fill', newFilter);
        }
      } else if (mapLayerName === 'osm-pois') {
        // Toggle POI layer
        if (map.current.getLayer('osm-pois')) {
          const currentFilter = map.current.getFilter('osm-pois') || ['==', ['geometry-type'], 'Point'];
          const newFilter = newVisibility ? 
            ['all', currentFilter, ['==', ['get', 'category'], layerName]] :
            ['all', currentFilter, ['!=', ['get', 'category'], layerName]];
          map.current.setFilter('osm-pois', newFilter);
        }
      }
      
      // Update state
      setPaLayerVisibility(prev => ({
        ...prev,
        [layerName]: newVisibility
      }));
    } catch (error) {
      console.warn('⚠️ Error toggling PA layer:', error);
    }
  }, [map, paLayerVisibility]);

  // Function to toggle all PA Nuclear Sites layers
  const toggleAllPALayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    try {
      // Toggle all PA zone layers
      const paSiteKeys = ['three_mile_island_pa', 'susquehanna_nuclear_pa'];
      paSiteKeys.forEach(siteKey => {
        const zoneLayers = [`pa-zone-${siteKey}-circle`, `pa-zone-${siteKey}-fill`];
        zoneLayers.forEach(zoneLayerName => {
          if (map.current.getLayer(zoneLayerName)) {
            map.current.setLayoutProperty(zoneLayerName, 'visibility', visible ? 'visible' : 'none');
          }
        });
      });

      // Toggle transmission lines (power lines) - PA OSM uses category: "power" with LineString
      if (map.current.getLayer('osm-transmission-lines')) {
        if (visible) {
          map.current.setFilter('osm-transmission-lines', [
            'all',
            ['==', ['get', 'category'], 'power'],
            ['==', ['geometry-type'], 'LineString']
          ]);
        }
        map.current.setPaintProperty('osm-transmission-lines', 'line-opacity', visible ? 0.9 : 0);
      }
      
      // Toggle substations - PA OSM uses category: "power" with Point/Polygon
      if (map.current.getLayer('osm-substations')) {
        if (visible) {
          map.current.setFilter('osm-substations', [
            'all',
            ['==', ['get', 'category'], 'power'],
            ['in', ['get', 'geometry-type'], ['literal', ['Point', 'Polygon']]]
          ]);
        }
        map.current.setPaintProperty('osm-substations', 'circle-opacity', visible ? 1 : 0);
      }
      
      // Toggle water layers - PA OSM uses category: "water"
      if (map.current.getLayer('osm-water-lines')) {
        if (visible) {
          map.current.setFilter('osm-water-lines', [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['any',
            ['==', ['get', 'category'], 'waterway'],
            ['==', ['get', 'category'], 'water']
            ]
          ]);
        }
        map.current.setPaintProperty('osm-water-lines', 'line-opacity', visible ? 0.7 : 0);
      }
      if (map.current.getLayer('osm-water-fill')) {
        if (visible) {
          map.current.setFilter('osm-water-fill', [
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['any',
            ['==', ['get', 'category'], 'water'],
            ['==', ['get', 'category'], 'water_body']
            ]
          ]);
        }
        map.current.setPaintProperty('osm-water-fill', 'line-opacity', visible ? 0.7 : 0);
      }
      if (map.current.getLayer('osm-water-points')) {
        if (visible) {
          map.current.setFilter('osm-water-points', [
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['any',
              ['==', ['get', 'category'], 'water'],
              ['==', ['get', 'category'], 'waterway']
            ]
          ]);
        }
        map.current.setPaintProperty('osm-water-points', 'circle-opacity', visible ? 0.7 : 0);
      }
      
      // Toggle other OSM feature layers
      if (map.current.getLayer('osm-features-lines')) {
        map.current.setPaintProperty('osm-features-lines', 'line-opacity', visible ? 0.8 : 0);
      }
      if (map.current.getLayer('osm-features-fill')) {
        map.current.setPaintProperty('osm-features-fill', 'fill-opacity', visible ? 0.3 : 0);
      }
      if (map.current.getLayer('osm-pois')) {
        map.current.setPaintProperty('osm-pois', 'circle-opacity', visible ? 1 : 0);
      }
      
      // Update all PA layer visibility states
      const newVisibility = {};
      Object.keys(paLayerVisibility).forEach(layerName => {
        newVisibility[layerName] = visible;
      });
      
      setPaLayerVisibility(newVisibility);
    } catch (error) {
      console.warn('⚠️ Error toggling all PA layers:', error);
    }
  }, [map, paLayerVisibility]);

  // Function to toggle all OSM layers
  const toggleAllOsmLayers = useCallback((visible) => {
    if (!map?.current) {
      return;
    }

    const locationUniversities = getLocationUniversities(currentLocation);
    const layerMap = {
      // Dynamic university layers based on location
      ...Object.keys(locationUniversities).reduce((acc, key) => {
        acc[key] = `osm-${key}`;
        return acc;
      }, {}),
      // Common layers
      otherUniversities: 'osm-other-universities',
      offices: 'osm-offices', 
      transportation: 'osm-transportation-stations',
      water: 'osm-water',
      parks: 'osm-parks',
      commercial: 'osm-commercial',
      analysisRadius: 'osm-radius',
      // Road layers
      highways: 'osm-highways',
      primaryRoads: 'osm-primary-roads',
      secondaryRoads: 'osm-secondary-roads',
      localRoads: 'osm-local-roads',
      residentialRoads: 'osm-residential-roads',
      roads: 'osm-roads',
      highway_junctions: 'osm-highway-junctions'
    };

    const newVisibility = {};
    
    Object.entries(layerMap).forEach(([layerName, mapLayerName]) => {
      try {
        // Special handling for water layer - toggle water lines, fill, and points
        if (layerName === 'water') {
          const waterLayers = ['osm-water-lines', 'osm-water-fill', 'osm-water-points'];
          let allLayersExist = true;
          
          waterLayers.forEach(waterLayerName => {
            if (map.current.getLayer(waterLayerName)) {
              map.current.setLayoutProperty(waterLayerName, 'visibility', visible ? 'visible' : 'none');
            } else {
              allLayersExist = false;
            }
          });
          
          if (allLayersExist) {
            newVisibility[layerName] = visible;
          }
        } else {
          if (map.current.getLayer(mapLayerName)) {
            map.current.setLayoutProperty(mapLayerName, 'visibility', visible ? 'visible' : 'none');
            
            // Also toggle associated marker layer if it exists
            const markerLayerName = `${mapLayerName}-markers`;
            if (map.current.getLayer(markerLayerName)) {
              map.current.setLayoutProperty(markerLayerName, 'visibility', visible ? 'visible' : 'none');
            }
            
            newVisibility[layerName] = visible;
          }
        }
      } catch (error) {
        // Error handling
      }
    });

    setOsmLayerVisibility(newVisibility);
  }, [map]);

  // Listen for table row clicks to find matching legend items
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleTableNodeSelected = (bridgeData) => {
      // Find matching legend item
      const matchingMarker = findMatchingLegendItem(bridgeData);
      
      if (matchingMarker) {
        // Highlight the matching marker
        setSelectedMarker(matchingMarker);
        
        // Trigger map interactions
        highlightMarkerOnMap(matchingMarker);
        zoomToMarker(matchingMarker);
        
        // Emit event for popup system to get coordinates
        if (window.mapEventBus) {
          window.mapEventBus.emit('legend:matchFound', matchingMarker);
        }
        
        // Note: We don't call handleMarkerClick here because we only want to show the popup,
        // not switch to node mode which would close the popup
      }
    };

    window.mapEventBus.on('table:nodeSelected', handleTableNodeSelected);

    return () => {
      window.mapEventBus.off('table:nodeSelected', handleTableNodeSelected);
    };
  }, [legendData, handleMarkerClick, findMatchingLegendItem, highlightMarkerOnMap, zoomToMarker]);

  // Create legend sections from real data (SERP + OSM + Perplexity)
  const getLegendSections = () => {
    const sections = [];

    // Perplexity Analysis Section (show first if available)
    if (perplexityData.totalFeatures > 0 && perplexityData.legendItems.length > 0) {
      const perplexityItems = perplexityData.legendItems.map(item => ({
        label: item.label,
        color: item.color,
        count: item.count,
        type: item.type || 'circle',
        category: item.category,
        isVisible: item.isVisible !== undefined ? item.isVisible : true,
        description: item.description || `${item.label} from Perplexity analysis`
      }));
      
      sections.push({
        title: 'Perplexity AI Analysis',
        items: perplexityItems.map(item => ({
          ...item,
          isVisible: perplexityLayerVisibility[item.category] !== undefined ? perplexityLayerVisibility[item.category] : item.isVisible
        }))
      });
    }

    // SERP Infrastructure Section - Startup Categories
    if (legendData.totalFeatures > 0) {
      const startupCategoryItems = [];
      const realEstateCategoryItems = [];
      
      // Map startup categories to display items with colors (matching SerpTool.mjs)
      const startupCategoryColors = {
        'AI/ML': '#3B82F6',      // Blue
        'Biotech/Health': '#10B981', // Green
        'FinTech': '#F59E0B',    // Amber
        'CleanTech': '#059669',  // Emerald
        'Enterprise': '#8B5CF6', // Purple
        'Hardware': '#EF4444',   // Red
        'Other': '#6B7280'       // Gray
      };


      // Map real estate categories to display items with colors (matching SerpTool.mjs)
      const realEstateCategoryColors = {
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


      // Create items for each startup category
      Object.entries(startupCategoryVisibility).forEach(([category, isVisible]) => {
        // Count companies in this category from the legend data
        const categoryCount = legendData.serpFeatures.filter(feature => 
          feature.properties?.category === category
        ).length;

        if (categoryCount > 0) {
          startupCategoryItems.push({
            label: category,
            color: startupCategoryColors[category] || '#6B7280',
            count: categoryCount,
            category: category, // For toggle functionality
            isVisible: isVisible,
            type: 'circle'
          });
        }
      });

      // Create items for each real estate category
      Object.entries(realEstateCategoryVisibility).forEach(([category, isVisible]) => {
        // Count properties in this category from the legend data
        const categoryCount = legendData.serpFeatures.filter(feature => 
          feature.properties?.category === category
        ).length;

        if (categoryCount > 0) {
          realEstateCategoryItems.push({
            label: category,
            color: realEstateCategoryColors[category] || '#6B7280',
            count: categoryCount,
            category: category, // For toggle functionality
            isVisible: isVisible,
            type: 'circle'
          });
        }
      });

      if (startupCategoryItems.length > 0) {
        sections.push({
          title: 'Startup Categories', 
          items: startupCategoryItems
        });
      }

      if (realEstateCategoryItems.length > 0) {
        sections.push({
          title: 'Real Estate Categories', 
          items: realEstateCategoryItems
        });
      }
    }
    
    // Pinal County Infrastructure Analysis Section
    if (pinalData.totalFeatures > 0) {
      const pinalItems = [];
      
      // Define all Pinal County categories with their display properties
      const pinalCategories = {
        office_building: {
          label: 'Office Buildings',
          color: '#3b82f6',
          type: 'circle',
          description: 'Commercial and office buildings',
          priority: 3
        },
        commercial_building: {
          label: 'Commercial Buildings',
          color: '#1d4ed8',
          type: 'circle',
          description: 'Commercial and retail buildings',
          priority: 3
        },
        retail_building: {
          label: 'Retail Buildings',
          color: '#2563eb',
          type: 'circle',
          description: 'Retail and shopping facilities',
          priority: 2
        },
        government_facility: {
          label: 'Government Facilities',
          color: '#dc2626',
          type: 'circle',
          description: 'Government buildings and public facilities',
          priority: 3
        },
        education: {
          label: 'Education',
          color: '#10b981',
          type: 'circle',
          description: 'Schools and educational institutions',
          priority: 2
        },
        healthcare: {
          label: 'Healthcare',
          color: '#f59e0b',
          type: 'circle',
          description: 'Hospitals and medical facilities',
          priority: 3
        },
        service_amenity: {
          label: 'Service Amenities',
          color: '#8b5cf6',
          type: 'circle',
          description: 'Service and amenity facilities',
          priority: 2
        },
        emergency_services: {
          label: 'Emergency Services',
          color: '#ef4444',
          type: 'circle',
          description: 'Emergency and safety services',
          priority: 3
        },
        transit_hub: {
          label: 'Transit Hubs',
          color: '#06b6d4',
          type: 'circle',
          description: 'Transportation and transit facilities',
          priority: 3
        },
        highway_access: {
          label: 'Highway Access',
          color: '#8b5cf6',
          type: 'line',
          description: 'Major highways and transportation routes',
          priority: 3
        },
        recreation_area: {
          label: 'Recreation Areas',
          color: '#059669',
          type: 'polygon',
          description: 'Parks and recreational facilities',
          priority: 2
        },
        industrial: {
          label: 'Industrial',
          color: '#6b7280',
          type: 'polygon',
          description: 'Industrial and manufacturing facilities',
          priority: 1
        },
        county_boundary: {
          label: 'Pinal County Boundary',
          color: '#3b82f6',
          type: 'line',
          description: 'Pinal County administrative boundary',
          priority: 4
        }
      };
      
      // Dynamically create legend items for all categories that have data
      Object.entries(pinalCategories).forEach(([categoryKey, categoryConfig]) => {
        const count = pinalData.summary[categoryKey] || 0;
        // Show county boundary if it exists (count = 1) or if it's a special boundary layer
        const shouldShow = count > 0 || (categoryKey === 'county_boundary' && pinalData.totalFeatures > 0);
        
        if (shouldShow) {
          pinalItems.push({
            label: categoryConfig.label,
            color: categoryConfig.color,
            count: categoryKey === 'county_boundary' ? 1 : count,
            type: categoryConfig.type,
            description: categoryConfig.description,
            category: categoryKey,
            priority: categoryConfig.priority,
            isVisible: pinalLayerVisibility[categoryKey] !== undefined ? pinalLayerVisibility[categoryKey] : true
          });
        }
      });
      
      // Pinal County Zone indicators
      if (pinalData.zones_queried.length > 0) {
        const zoneColors = {
          'casa_grande': '#dc2626', // Red for Casa Grande
          'florence': '#7c3aed', // Purple for Florence
          'apache_junction': '#0ea5e9' // Blue for Apache Junction
        };
        
        const zoneNames = {
          'casa_grande': 'Casa Grande',
          'florence': 'Florence',
          'apache_junction': 'Apache Junction'
        };
        
        pinalData.zones_queried.forEach(zoneKey => {
          pinalItems.push({
            label: zoneNames[zoneKey] || zoneKey,
            color: zoneColors[zoneKey] || '#6b7280',
            count: 1,
            type: 'line',
            description: 'Pinal County analysis zone',
            category: 'pinal_zone',
            priority: 3,
            isDashed: true,
            isVisible: pinalLayerVisibility.pinal_zone
          });
        });
      }
      
      if (pinalItems.length > 0) {
        sections.push({
          title: 'Pinal County Infrastructure Analysis',
          items: pinalItems
        });
      }
    }

    // PA Nuclear Sites Infrastructure Analysis Section
    if (paData.totalFeatures > 0) {
      const paItems = [];
      
      // Define PA infrastructure categories with their display properties
      const paCategories = {
        transmission_line: {
          label: 'Transmission Lines',
          color: '#f97316', // Orange for power
          type: 'line',
          description: 'High-voltage power transmission lines',
          priority: 4
        },
        power_line: {
          label: 'Power Lines',
          color: '#fb923c', // Lighter orange for power
          type: 'line',
          description: 'Power distribution lines',
          priority: 3
        },
        substation: {
          label: 'Substations',
          color: '#f97316', // Orange to match power lines
          type: 'circle',
          description: 'Electrical substations',
          priority: 4
        },
        power_substation: {
          label: 'Power Substations',
          color: '#f97316', // Orange to match power lines
          type: 'circle',
          description: 'Power substation facilities',
          priority: 4
        },
        power_facility: {
          label: 'Power Facilities',
          color: '#fb923c', // Lighter orange for power facilities
          type: 'circle',
          description: 'Power generation and distribution facilities',
          priority: 3
        },
        water: {
          label: 'Water Features',
          color: '#3b82f6', // Blue for water
          type: 'line',
          description: 'Water bodies and waterways (outline only)',
          priority: 3
        },
        waterway: {
          label: 'Waterways',
          color: '#3b82f6', // Blue for water
          type: 'line',
          description: 'Rivers, streams, and canals',
          priority: 3
        },
        water_body: {
          label: 'Water Bodies',
          color: '#3b82f6', // Blue for water (outline only, no fill)
          type: 'line',
          description: 'Lakes, reservoirs, and ponds (outline only)',
          priority: 3
        },
        office_building: {
          label: 'Office Buildings',
          color: '#3b82f6',
          type: 'circle',
          description: 'Commercial and office buildings',
          priority: 2
        },
        commercial_building: {
          label: 'Commercial Buildings',
          color: '#1d4ed8',
          type: 'circle',
          description: 'Commercial and retail buildings',
          priority: 2
        },
        government_facility: {
          label: 'Government Facilities',
          color: '#dc2626',
          type: 'circle',
          description: 'Government buildings and public facilities',
          priority: 2
        },
        education: {
          label: 'Education',
          color: '#10b981',
          type: 'circle',
          description: 'Schools and educational institutions',
          priority: 2
        },
        healthcare: {
          label: 'Healthcare',
          color: '#f59e0b',
          type: 'circle',
          description: 'Hospitals and medical facilities',
          priority: 2
        },
        industrial: {
          label: 'Industrial',
          color: '#6b7280',
          type: 'polygon',
          description: 'Industrial and manufacturing facilities',
          priority: 1
        }
      };
      
      // Dynamically create legend items for all categories that have data
      Object.entries(paCategories).forEach(([categoryKey, categoryConfig]) => {
        const count = paData.summary[categoryKey] || 0;
        const shouldShow = count > 0;
        
        if (shouldShow) {
          paItems.push({
            label: categoryConfig.label,
            color: categoryConfig.color,
            count: count,
            type: categoryConfig.type,
            description: categoryConfig.description,
            category: categoryKey,
            priority: categoryConfig.priority,
            isVisible: paLayerVisibility[categoryKey] !== undefined ? paLayerVisibility[categoryKey] : true
          });
        }
      });
      
      // Add PA site zone indicators (circular analysis zones)
      if (paData.siteKey) {
        const siteNames = {
          'three_mile_island_pa': 'Three Mile Island',
          'susquehanna_nuclear_pa': 'Susquehanna Nuclear'
        };
        
        const siteColors = {
          'three_mile_island_pa': '#f97316',
          'susquehanna_nuclear_pa': '#22c55e'
        };
        
        paItems.push({
          label: `${siteNames[paData.siteKey] || 'PA Site'} Analysis Zone`,
          color: siteColors[paData.siteKey] || '#dc2626',
          count: 1,
          type: 'line',
          description: '25km analysis radius around nuclear site',
          category: 'pa_zone',
          priority: 4,
          isDashed: true,
          isVisible: true
        });
      }
      
      if (paItems.length > 0) {
        sections.push({
          title: 'PA Nuclear Infrastructure Analysis',
          items: paItems
        });
      }
    }

    // OSM Visual Layers Section
    if (osmData.totalFeatures > 0) {
      const osmItems = [];
      
      // Urban infrastructure layers (geographic/visual data)
      // Location-aware university layers
      if (osmData.visualLayers.universities && osmData.visualLayers.universities.length > 0) {
        const universities = osmData.visualLayers.universities;
        const locationUniversities = getLocationUniversities(currentLocation);
        
        // Only show universities that exist in the current location
        Object.entries(locationUniversities).forEach(([key, config]) => {
          const universityCount = universities.filter(u => 
            u.properties?.university_type === config.name || 
            u.properties?.name?.toLowerCase().includes(config.name.toLowerCase())
          ).length;
          
          if (universityCount > 0) {
            osmItems.push({
              label: config.name,
              color: config.color,
              count: universityCount,
              type: 'circle',
              description: config.description,
              layerName: key,
              isVisible: osmLayerVisibility[key] !== undefined ? osmLayerVisibility[key] : true
            });
          }
        });
        
        // Other Universities (general category for any universities not specifically configured)
        const configuredNames = Object.values(locationUniversities).map(u => u.name.toLowerCase());
        const otherCount = universities.filter(u => {
          const uniName = (u.properties?.university_type || u.properties?.name || '').toLowerCase();
          return !configuredNames.some(name => uniName.includes(name.toLowerCase())) && u.properties?.university_type === 'Other';
        }).length;
        
        if (otherCount > 0) {
          osmItems.push({
            label: 'Other Universities',
            color: '#ef4444', // Red
            count: otherCount,
            type: 'circle',
            description: 'Other universities and colleges',
            layerName: 'otherUniversities',
            isVisible: osmLayerVisibility.otherUniversities
          });
        }
      }
      
      if (osmData.visualLayers.offices && osmData.visualLayers.offices.length > 0) {
        osmItems.push({
          label: 'Office Buildings',
          color: '#3b82f6', // Blue circles
          count: osmData.visualLayers.offices.length,
          type: 'circle',
          description: 'Office buildings and commercial spaces',
          layerName: 'offices',
          isVisible: osmLayerVisibility.offices
        });
      }
      
      if (osmData.visualLayers.transportation && osmData.visualLayers.transportation.length > 0) {
        osmItems.push({
          label: 'Transportation',
          color: '#f59e0b', // Orange circles
          count: osmData.visualLayers.transportation.length,
          type: 'circle',
          description: 'T stops and transportation stations',
          layerName: 'transportation',
          isVisible: osmLayerVisibility.transportation
        });
      }
      
      // Transportation routes - REMOVED per user request
      // if (osmData.visualLayers.transportation && osmData.visualLayers.transportation.length > 0) {
      //   osmItems.push({
      //     label: 'Major Roads',
      //     color: '#f97316', // Orange lines
      //     count: osmData.visualLayers.transportation.length,
      //     type: 'line',
      //     description: 'Major roads and transportation routes',
      //     layerName: 'transportation',
      //     isVisible: osmLayerVisibility.transportation
      //   });
      // }
      
      // Water features (combined lines and bodies)
      if (osmData.visualLayers.water && osmData.visualLayers.water.length > 0) {
        osmItems.push({
          label: 'Water Features',
          color: '#0ea5e9', // Blue polygons/lines
          count: osmData.visualLayers.water.length,
          type: 'polygon',
          description: 'Rivers, lakes, and waterways',
          layerName: 'water',
          isVisible: osmLayerVisibility.water
        });
      }
      
      // Parks and public spaces
      if (osmData.visualLayers.parks && osmData.visualLayers.parks.length > 0) {
        osmItems.push({
          label: 'Parks',
          color: '#10b981', // Green polygons
          count: osmData.visualLayers.parks.length,
          type: 'polygon',
          description: 'Parks and public spaces',
          layerName: 'parks',
          isVisible: osmLayerVisibility.parks
        });
      }
      
      // Commercial zones
      if (osmData.visualLayers.commercial && osmData.visualLayers.commercial.length > 0) {
        osmItems.push({
          label: 'Commercial Zones',
          color: '#8b5cf6', // Purple polygons
          count: osmData.visualLayers.commercial.length,
          type: 'polygon',
          description: 'Commercial and retail areas',
          layerName: 'commercial',
          isVisible: osmLayerVisibility.commercial
        });
      }
      
      // Road layers
      if (osmData.visualLayers.highways && osmData.visualLayers.highways.length > 0) {
        osmItems.push({
          label: 'Highways',
          color: '#dc2626', // Red for highways
          count: osmData.visualLayers.highways.length,
          type: 'line',
          description: 'Major highways and interstates',
          layerName: 'highways',
          isVisible: osmLayerVisibility.highways
        });
      }
      
      if (osmData.visualLayers.primaryRoads && osmData.visualLayers.primaryRoads.length > 0) {
        osmItems.push({
          label: 'Primary Roads',
          color: '#ea580c', // Orange for primary roads
          count: osmData.visualLayers.primaryRoads.length,
          type: 'line',
          description: 'Primary roads and major arterials',
          layerName: 'primaryRoads',
          isVisible: osmLayerVisibility.primaryRoads
        });
      }
      
      if (osmData.visualLayers.secondaryRoads && osmData.visualLayers.secondaryRoads.length > 0) {
        osmItems.push({
          label: 'Secondary Roads',
          color: '#f59e0b', // Amber for secondary roads
          count: osmData.visualLayers.secondaryRoads.length,
          type: 'line',
          description: 'Secondary roads and collectors',
          layerName: 'secondaryRoads',
          isVisible: osmLayerVisibility.secondaryRoads
        });
      }
      
      if (osmData.visualLayers.localRoads && osmData.visualLayers.localRoads.length > 0) {
        osmItems.push({
          label: 'Local Roads',
          color: '#10b981', // Green for local roads
          count: osmData.visualLayers.localRoads.length,
          type: 'line',
          description: 'Local roads and streets',
          layerName: 'localRoads',
          isVisible: osmLayerVisibility.localRoads
        });
      }
      
      if (osmData.visualLayers.residentialRoads && osmData.visualLayers.residentialRoads.length > 0) {
        osmItems.push({
          label: 'Residential Roads',
          color: '#8b5cf6', // Purple for residential roads
          count: osmData.visualLayers.residentialRoads.length,
          type: 'line',
          description: 'Residential streets and neighborhoods',
          layerName: 'residentialRoads',
          isVisible: osmLayerVisibility.residentialRoads
        });
      }
      
      // Add Pinal County roads layer
      if (osmData.visualLayers.roads && osmData.visualLayers.roads.length > 0) {
        osmItems.push({
          label: 'Road Network',
          color: '#6b7280', // Gray for general roads
          count: osmData.visualLayers.roads.length,
          type: 'line',
          description: 'Complete road network (motorway to residential)',
          layerName: 'roads',
          isVisible: osmLayerVisibility.roads
        });
      }
      
      // Add highway junctions layer
      if (osmData.visualLayers.highway_junction && osmData.visualLayers.highway_junction.length > 0) {
        osmItems.push({
          label: 'Highway Junctions',
          color: '#dc2626', // Red for highway junctions
          count: osmData.visualLayers.highway_junction.length,
          type: 'circle',
          description: 'Major highway intersections and interchanges',
          layerName: 'highway_junctions',
          isVisible: osmLayerVisibility.highway_junctions || true
        });
      }
      
      // Analysis Radius (Innovation Hub Center)
      osmItems.push({
        label: 'Innovation Hub Center',
        color: '#ef4444', // Red dashed line
        count: 1,
        type: 'line',
        description: '3-mile analysis radius around innovation hub',
        layerName: 'analysisRadius',
        isVisible: osmLayerVisibility.analysisRadius
      });
      
      if (osmItems.length > 0) {
        sections.push({
          title: 'Urban Infrastructure (OpenStreetMap)',
          items: osmItems
        });
      }
    }

    // Memphis Colossus Change (2023→2024) - toggle-driven
    if (memphisColossusLegend && memphisColossusLegend.items?.length > 0) {
      sections.push({
        title: memphisColossusLegend.title || 'Memphis Colossus Change (2023→2024)',
        items: memphisColossusLegend.items,
        description: 'Building and land use change within 5km of Colossus. Click a category to highlight it on the map; ties to who builds where and when power is needed.'
      });
    }

    return sections;
  };

  const legendSections = getLegendSections();

  return (
    <>
      {/* Legend Toggle Button - Always visible when legend is closed */}
      {!isVisible && (
        <div style={{
          position: 'absolute', // Back to absolute positioning
          left: '340px', // 320px (BaseCard width) + 20px margin
          top: '20px',
          zIndex: 1001,
          pointerEvents: 'auto' // Ensure it's clickable
        }}>
          <button
            onClick={() => {
              if (onToggle) {
                onToggle();
              }
            }}
            style={{
              background: 'rgb(30, 41, 59)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.color = 'rgba(255, 255, 255, 0.9)';
              e.target.style.transform = 'scale(1.1)';
              e.target.style.background = 'rgba(255, 255, 255, 0.18)';
              e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#f9fafb';
              e.target.style.transform = 'scale(1)';
              e.target.style.background = 'rgba(255, 255, 255, 0.06)';
              e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }}
            title="Show Map Legend"
          >
            ≡
          </button>
        </div>
      )}

      {/* Legend Content - Similar to FollowUpQuestions but positioned to the right */}
      {isVisible && (
        <div style={{
          position: 'absolute', // Back to absolute positioning
          left: '340px', // 320px (BaseCard width) + 20px margin
          top: '0px',
          height: cardHeight > 0 ? `${cardHeight}px` : 'auto', // Match BaseCard height
          zIndex: 1001,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto' // Ensure it's clickable
        }}>
          <div style={{
            background: 'rgb(30, 41, 59)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '12px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            minWidth: '200px',
            maxWidth: '280px',
            animation: 'fadeIn 0.3s ease-in-out',
            paddingBottom: '35px' /* Align with BaseCard bottom like SidePanel */
          }}>
            {/* Legend Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1px',
              paddingBottom: '2px',
              borderBottom: '1px solid rgba(75, 85, 99, 0.3)'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: '#f9fafb',
                flex: 1,
                minWidth: 0 /* Allow flex item to shrink */
              }}>
                Map Layers {(legendData.totalFeatures > 0 || osmData.totalFeatures > 0 || pinalData.totalFeatures > 0 || perplexityData.totalFeatures > 0 || paData.totalFeatures > 0 || (memphisColossusLegend && memphisColossusLegend.items?.length > 0)) && (
                  <span style={{ color: '#9ca3af', fontWeight: '400' }}>
                    [{legendData.totalFeatures + osmData.totalFeatures + pinalData.totalFeatures + perplexityData.totalFeatures + paData.totalFeatures + (memphisColossusLegend?.items?.length || 0)}]
                  </span>
                )}
              </h3>
              <button
                onClick={onToggle}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#f9fafb';
                  e.target.style.background = 'rgba(75, 85, 99, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#9ca3af';
                  e.target.style.background = 'none';
                }}
                title="Hide Legend"
              >
                ×
              </button>
            </div>



            {/* Legend Sections - Show SERP, OSM, Memphis Colossus, and Perplexity data */}
            {legendSections.length > 0 ? legendSections
              .filter((section) => showMemphisColossusSection || !(section.title || '').includes('Memphis Colossus'))
              .map((section, sectionIndex) => (
              <div key={section.title} style={{
                marginBottom: '16px',
                animation: 'slideInFromRight 0.4s ease-out forwards',
                animationDelay: `${sectionIndex * 0.1}s`,
                opacity: 0,
                transform: 'translateX(20px)'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#9ca3af',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {(() => {
                    const collapseInfo = getSectionCollapseInfo(section.title);
                    const isCollapsible = collapseInfo.toggle !== null;
                    
                    return (
                      <span 
                        style={{
                          cursor: isCollapsible ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s ease'
                        }}
                        onClick={isCollapsible ? collapseInfo.toggle : undefined}
                        onMouseEnter={isCollapsible ? (e) => {
                          e.target.style.color = '#ffffff';
                        } : undefined}
                        onMouseLeave={isCollapsible ? (e) => {
                          e.target.style.color = '#9ca3af';
                        } : undefined}
                        title={isCollapsible ? 
                          (collapseInfo.isCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`) : 
                          undefined
                        }
                      >
                        {isCollapsible && (
                          <span style={{
                            fontSize: '10px',
                            transition: 'transform 0.2s ease',
                            transform: collapseInfo.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            display: 'inline-block'
                          }}>
                            ▼
                          </span>
                        )}
                        {section.title}
                      </span>
                    );
                  })()}
                  {(section.title || '').includes('Memphis Colossus') && (
                    <button
                      type="button"
                      onClick={() => setShowMemphisColossusSection(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '8px',
                        fontSize: '11px'
                      }}
                      aria-label="Close Memphis Colossus legend"
                    >
                      ×
                    </button>
                  )}
                  {section.title === 'Startup Categories' && section.items.some(item => item.category) && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllStartupCategories(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Show all startup categories"
                      >
                        All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllStartupCategories(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Hide all startup categories"
                      >
                        None
                      </button>
                    </div>
                  )}
                  {section.title === 'Perplexity AI Analysis' && section.items.some(item => item.category) && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllPerplexityLayers(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Show all Perplexity categories"
                      >
                        All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllPerplexityLayers(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '9px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#ffffff';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        title="Hide all Perplexity categories"
                      >
                        None
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Section description (e.g. Memphis Colossus Change) */}
                {section.description && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.75)',
                    marginBottom: '6px',
                    lineHeight: 1.35,
                    paddingLeft: '2px'
                  }}>
                    {section.description}
                  </div>
                )}
                
                {/* Real Estate Categories Controls - Below the title */}
                {section.title === 'Real Estate Categories' && section.items.some(item => item.category) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllRealEstateCategories(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all real estate categories"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllRealEstateCategories(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all real estate categories"
                    >
                      None
                    </button>
                  </div>
                )}
                
                {/* Urban Infrastructure Controls - Below the title */}
                {section.title === 'Urban Infrastructure (OpenStreetMap)' && section.items.some(item => item.layerName) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllOsmLayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all OSM layers"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllOsmLayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all OSM layers"
                    >
                      None
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOsmLayerOpacity();
                      }}
                      style={{
                        background: osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        border: `1px solid ${osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '3px',
                        color: osmLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = osmLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af';
                        e.target.style.borderColor = osmLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)';
                      }}
                      title={osmLayerOpacity.isTranslucent ? "Make OSM layers opaque" : "Make OSM layers translucent (65% more dim)"}
                    >
                      {osmLayerOpacity.isTranslucent ? 'Opaque' : 'Dim'}
                    </button>
                  </div>
                )}
                
                {/* Pinal County Infrastructure Analysis Controls - Below the title */}
                {section.title === 'Pinal County Infrastructure Analysis' && section.items.some(item => item.category) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllPinalLayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all Pinal County layers"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllPinalLayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all Pinal County layers"
                    >
                      None
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinalLayerOpacity();
                      }}
                      style={{
                        background: pinalLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        border: `1px solid ${pinalLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                        borderRadius: '3px',
                        color: pinalLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = pinalLayerOpacity.isTranslucent ? '#60a5fa' : '#9ca3af';
                        e.target.style.borderColor = pinalLayerOpacity.isTranslucent ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.2)';
                      }}
                      title={pinalLayerOpacity.isTranslucent ? "Make Pinal County layers opaque" : "Make Pinal County layers translucent (60% opacity)"}
                    >
                      {pinalLayerOpacity.isTranslucent ? 'Opaque' : 'Dim'}
                    </button>
                  </div>
                )}

                {/* PA Nuclear Infrastructure Analysis Controls - Below the title */}
                {section.title === 'PA Nuclear Infrastructure Analysis' && section.items.some(item => item.category) && !getSectionCollapseInfo(section.title).isCollapsed && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    marginBottom: '8px',
                    justifyContent: 'flex-start'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllPALayers(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Show all PA infrastructure layers"
                    >
                      All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllPALayers(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '9px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = '#ffffff';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = '#9ca3af';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      title="Hide all PA infrastructure layers"
                    >
                      None
                    </button>
                  </div>
                )}
                
                {/* Only render items if section is not collapsed */}
                {!getSectionCollapseInfo(section.title).isCollapsed && section.items.map((item, itemIndex) => {
                  // Check if this legend item corresponds to the selected marker
                  const isSelected = selectedMarker && 
                    selectedMarker.category && 
                    item.label.toLowerCase().includes(selectedMarker.category.toLowerCase());
                  // Memphis Colossus: highlight selected change class (click filters map)
                  const isMemphisColossusSelected = item.change_label !== undefined && memphisColossusSelectedLabel === item.change_label;
                  const isHighlighted = isSelected || isMemphisColossusSelected;
                  
                  // Check if this is a startup category item
                  const isStartupCategory = item.category && item.category in startupCategoryVisibility;
                  
                  // Check if this is a real estate category item
                  const isRealEstateCategory = item.category && item.category in realEstateCategoryVisibility;
                  
                  // Check if this is an OSM layer item
                  const isOsmLayer = item.layerName && item.layerName in osmLayerVisibility;
                  
                  // Check if this is a Perplexity layer item
                  const isPerplexityLayer = item.category && item.category in perplexityLayerVisibility;
                  
                  // Check if this is a Pinal County layer item
                  const isPinalLayer = item.category && item.category in pinalLayerVisibility;
                  
                  // Check if this is a PA Nuclear Sites layer item
                  const isPALayer = item.category && item.category in paLayerVisibility;
                  
                  return (
                    <div 
                      key={item.label} 
                      onClick={() => handleLegendItemClick(item.label, item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '6px',
                        fontSize: '11px',
                        animation: 'slideInFromRight 0.4s ease-out forwards',
                        animationDelay: `${(sectionIndex * 0.1) + (itemIndex * 0.05)}s`,
                        opacity: 0,
                        transform: 'translateX(20px)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease',
                        background: isHighlighted ? (isMemphisColossusSelected ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.2)') : 'transparent',
                        border: isHighlighted ? (isMemphisColossusSelected ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(239, 68, 68, 0.4)') : '1px solid transparent',
                        boxShadow: isHighlighted ? (isMemphisColossusSelected ? '0 0 8px rgba(34, 197, 94, 0.3)' : '0 0 8px rgba(239, 68, 68, 0.3)') : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      title={item.change_label !== undefined ? `Click to show only ${item.label} on map` : isStartupCategory ? `Click to toggle ${item.label} category visibility` : isRealEstateCategory ? `Click to toggle ${item.label} category visibility` : isOsmLayer ? `Click to toggle ${item.label} layer visibility` : isPerplexityLayer ? `Click to toggle ${item.label} Perplexity layer visibility` : isPinalLayer ? `Click to toggle ${item.label} Pinal County layer visibility` : isPALayer ? `Click to toggle ${item.label} PA infrastructure layer visibility` : `Click to highlight ${item.label} on map`}
                    >
                    {/* Visual indicator based on feature type */}
                    <div style={{
                      width: '16px',
                      height: '16px',
                      marginRight: '8px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isPerplexityLayer ? (
                        // Toggle checkbox for Perplexity categories
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isStartupCategory ? (
                        // Toggle checkbox for startup categories
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isRealEstateCategory ? (
                        // Toggle checkbox for real estate categories
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isOsmLayer ? (
                        // Toggle checkbox for OSM layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isPinalLayer ? (
                        // Toggle checkbox for Pinal County layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : isPALayer ? (
                        // Toggle checkbox for PA Nuclear Sites layers
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: `2px solid ${item.isVisible ? item.color : '#6b7280'}`,
                          borderRadius: '3px',
                          backgroundColor: item.isVisible ? item.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}>
                          {item.isVisible && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              backgroundColor: '#ffffff',
                              borderRadius: '1px'
                            }} />
                          )}
                        </div>
                      ) : item.type === 'line' ? (
                        <div style={{
                          width: '14px',
                          height: '3px',
                          backgroundColor: item.color,
                          borderRadius: '1px',
                          // Special styling for dashed lines (analysis radius and Pinal County zones)
                          borderTop: (item.layerName === 'analysisRadius' || item.isDashed) ? `2px dashed ${item.color}` : 'none'
                        }} />
                      ) : item.type === 'polygon' ? (
                        <div style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: item.color,
                          border: `1px solid ${item.color}`,
                          opacity: 0.6
                        }} />
                      ) : (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: item.color
                        }} />
                      )}
                    </div>
                    <span style={{
                      color: '#d1d5db',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                      }}>
                        {item.label}
                      </span>
                    <span style={{
                      color: '#6b7280',
                      fontSize: '10px',
                      marginLeft: '4px'
                    }}>
                      ({item.count})
                    </span>
                    </div>
                  );
                })}
              </div>
            )) : (
              /* No data message */
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '12px',
                fontStyle: 'italic',
                padding: '20px 0'
              }}>
                No map data available yet.
                <br />
                Run a Perplexity AI analysis, Startup Ecosystem search, or Pinal County Infrastructure analysis to see data.
              </div>
            )}

            {/* Analysis Area Section - Show if we have any data */}
            {(legendData.totalFeatures > 0 || osmData.totalFeatures > 0 || pinalData.totalFeatures > 0 || perplexityData.totalFeatures > 0 || (memphisColossusLegend && memphisColossusLegend.items?.length > 0)) && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(75, 85, 99, 0.3)',
              animation: 'slideInFromRight 0.4s ease-out forwards',
              animationDelay: '0.3s',
              opacity: 0,
              transform: 'translateX(20px)'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#9ca3af',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {pinalData.totalFeatures > 0 ? 'Pinal County Analysis Area' : 'Analysis Area'}
              </div>
              
              {/* Pinal County-specific insights */}
              {pinalData.totalFeatures > 0 && pinalData.pinal_insights && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#dc2626',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Casa Grande Proximity: {pinalData.pinal_insights.casa_grande_proximity || 0} features
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#7c3aed',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Florence Proximity: {pinalData.pinal_insights.florence_proximity || 0} features
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      High Development Potential: {pinalData.pinal_insights.high_development_potential || 0} buildings
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    marginBottom: '6px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      marginRight: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#06b6d4',
                      flexShrink: 0
                    }} />
                    <span style={{
                      color: '#d1d5db'
                    }}>
                      Commercial Development: {pinalData.pinal_insights.total_commercial_development || 0} facilities
                    </span>
                  </div>
                </>
              )}
              
              {/* Standard analysis area indicators */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px',
                marginBottom: '6px'
              }}>
                <div style={{
                  width: '16px',
                  height: '2px',
                  marginRight: '8px',
                  backgroundColor: '#ef4444',
                  border: '1px dashed #ef4444',
                  opacity: 0.8,
                  flexShrink: 0
                }} />
                <span style={{
                  color: '#d1d5db'
                }}>
                  {pinalData.totalFeatures > 0 ? 'Pinal County Analysis Zones' : 'Innovation District Radius (6 miles)'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  marginRight: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  flexShrink: 0
                }} />
                <span style={{
                  color: '#d1d5db'
                }}>
                  {pinalData.totalFeatures > 0 ? 'Casa Grande Center' : 'Innovation Hub Center'}
                </span>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const propsToCompare = ['isVisible', 'currentLocation']; // Removed onToggle and handleMarkerClick as they are memoized
  
  for (const prop of propsToCompare) {
    if (prevProps[prop] !== nextProps[prop]) {
      return false; // Re-render needed
    }
  }
  
  // Compare aiState and map by reference (they should be stable)
  if (prevProps.aiState !== nextProps.aiState) {
    return false;
  }
  
  if (prevProps.map !== nextProps.map) {
    return false;
  }
  
  // Compare function references (should be stable due to useCallback)
  if (prevProps.onToggle !== nextProps.onToggle) {
    return false;
  }
  if (prevProps.handleMarkerClick !== nextProps.handleMarkerClick) {
    return false;
  }
  
  return true; // No re-render needed
});

LegendContainer.displayName = 'LegendContainer';

export default LegendContainer;
