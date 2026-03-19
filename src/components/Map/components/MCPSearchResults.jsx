/**
 * MCP Search Results - Phase 1 MVP
 * Displays search results on the map with markers and radius visualization
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

const MCPSearchResults = ({ map }) => {
  const markersRef = useRef([]);
  const popupsRef = useRef([]); // Track popups separately
  const radiusLayerRef = useRef(null);
  const sourceRef = useRef(null);
  const haloRefsRef = useRef([]); // Store halo layer/source IDs for cleanup
  const resetDimmingTimeoutRef = useRef(null); // Store timeout for resetting dimmed markers

  // Cleanup function - only removes MCP markers, preserves OSM markers
  const cleanup = useCallback(() => {
    // Get OSM marker instances to preserve them
    const osmMarkers = new Set();
    if (typeof window !== 'undefined' && window.pinalSiteMarkers) {
      Object.values(window.pinalSiteMarkers).forEach(marker => {
        if (marker) osmMarkers.add(marker);
      });
    }
    
    // Remove only MCP markers (not OSM markers)
    markersRef.current.forEach(marker => {
      if (marker && marker.remove) {
        const isOSMMarker = osmMarkers.has(marker);
        if (!isOSMMarker) {
          try {
            marker.remove();
          } catch (err) {
            console.warn('⚠️ MCPSearchResults: Error removing MCP marker:', err);
          }
        }
      }
    });
    
    markersRef.current = [];
    
    // Remove popups
    popupsRef.current.forEach(popup => {
      if (popup && popup.remove) {
        popup.remove();
      }
    });
    popupsRef.current = [];

    if (map?.current) {
      // Remove halo layers and sources
      haloRefsRef.current.forEach(({ haloFillId, haloLineId, haloSourceId }) => {
        // Remove layers first
        if (map.current.getLayer(haloLineId)) {
          try {
            map.current.removeLayer(haloLineId);
          } catch (err) {
            console.warn('⚠️ MCPSearchResults: Error removing halo line layer', err);
          }
        }
        if (map.current.getLayer(haloFillId)) {
          try {
            map.current.removeLayer(haloFillId);
          } catch (err) {
            console.warn('⚠️ MCPSearchResults: Error removing halo fill layer', err);
          }
        }
        // Remove source
        if (map.current.getSource(haloSourceId)) {
          try {
            map.current.removeSource(haloSourceId);
          } catch (err) {
            console.warn('⚠️ MCPSearchResults: Error removing halo source', err);
          }
        }
      });
      haloRefsRef.current = [];

      // Clean up halo animations
      if (typeof window !== 'undefined' && window.mcpHaloAnimations) {
        Object.keys(window.mcpHaloAnimations).forEach(haloLineId => {
          if (window.mcpHaloAnimations[haloLineId]) {
            clearTimeout(window.mcpHaloAnimations[haloLineId]);
          }
        });
        window.mcpHaloAnimations = {};
      }

      // Remove radius layers (both fill and outline) before removing source
      const layerId = 'mcp-search-radius-layer';
      const outlineLayerId = `${layerId}-outline`;
      const sourceId = 'mcp-search-radius';

      // Remove outline layer first
      if (map.current.getLayer(outlineLayerId)) {
        try {
          map.current.removeLayer(outlineLayerId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing outline layer', err);
        }
      }

      // Remove fill layer
      if (map.current.getLayer(layerId)) {
        try {
          map.current.removeLayer(layerId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing fill layer', err);
        }
      }

      // Remove source only after all layers are removed
      if (map.current.getSource(sourceId)) {
        try {
          map.current.removeSource(sourceId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing source', err);
        }
      }
    }

    radiusLayerRef.current = null;
    sourceRef.current = null;
  }, [map]);

  // Helper function to reset all markers, halos, and popups to full opacity
  const resetAllToFullOpacity = useCallback((mapInstance) => {
    // Reset all markers to full opacity
    markersRef.current.forEach((m) => {
      if (m && m.getElement) {
        const el = m.getElement();
        if (el) {
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('filter', 'none', 'important');
          el.classList.remove('mcp-marker-dimmed');
          const svg = el.querySelector('svg');
          if (svg) {
            svg.style.setProperty('opacity', '1', 'important');
            svg.style.setProperty('filter', 'none', 'important');
          }
        }
      }
    });
    
    // Reset all halos to full opacity
    if (mapInstance) {
      haloRefsRef.current.forEach(({ haloFillId, haloLineId }) => {
        if (mapInstance.getLayer(haloFillId)) {
          mapInstance.setPaintProperty(haloFillId, 'fill-opacity', 0.08);
        }
        if (mapInstance.getLayer(haloLineId)) {
          mapInstance.setPaintProperty(haloLineId, 'line-opacity', 0.9);
        }
      });
    }
    
    // Reset all popups to full opacity
    popupsRef.current.forEach((p) => {
      if (p && p.getElement) {
        const popupEl = p.getElement();
        if (popupEl) {
          popupEl.style.setProperty('opacity', '1', 'important');
          popupEl.style.setProperty('filter', 'none', 'important');
        }
      }
    });
    
    // Also reset popups by class selector
    const allPopupsByClass = document.querySelectorAll('.mcp-marker-popup');
    allPopupsByClass.forEach((popupEl) => {
      popupEl.style.setProperty('opacity', '1', 'important');
      popupEl.style.setProperty('filter', 'none', 'important');
    });
  }, []);

  // Handle search results
  useEffect(() => {
    if (!map?.current || typeof window === 'undefined' || !window.mapEventBus) return;

    const handleSearchResults = (data) => {
      const { results, parsed } = data;
      
      const isPowerPlantsQuery = parsed?.query?.toLowerCase().includes('power plants within 20km') ||
                                 data?.query?.toLowerCase().includes('power plants within 20km');
      
      
      if (!results || !results.features || results.features.length === 0) {
        return;
      }

      cleanup();
      
      // Reset all markers to full opacity before adding new ones
      markersRef.current.forEach((m) => {
        if (m && m.getElement) {
          const el = m.getElement();
          if (el) {
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.classList.remove('mcp-marker-dimmed');
            const svg = el.querySelector('svg');
            if (svg) {
              svg.style.setProperty('opacity', '1', 'important');
              svg.style.setProperty('filter', 'none', 'important');
            }
          }
        }
      });
      
      // Reset all halos to full opacity
      if (map.current) {
        haloRefsRef.current.forEach(({ haloFillId, haloLineId }) => {
          if (map.current.getLayer(haloFillId)) {
            map.current.setPaintProperty(haloFillId, 'fill-opacity', 0.08);
          }
          if (map.current.getLayer(haloLineId)) {
            map.current.setPaintProperty(haloLineId, 'line-opacity', 0.9);
          }
        });
      }
      
      // Clear any existing reset timeout
      if (resetDimmingTimeoutRef.current) {
        clearTimeout(resetDimmingTimeoutRef.current);
        resetDimmingTimeoutRef.current = null;
      }
      if (map?.current) {
        haloRefsRef.current.forEach(({ haloFillId, haloLineId }) => {
          if (map.current.getLayer(haloFillId)) {
            map.current.setPaintProperty(haloFillId, 'fill-opacity', 0.08);
          }
          if (map.current.getLayer(haloLineId)) {
            map.current.setPaintProperty(haloLineId, 'line-opacity', 0.9);
          }
        });
      }

      const features = results.features;
      const facilityPoint = parsed.facilityKey ? getFacilityCoordinates(parsed.facilityKey) : null;

      // Add radius circle if we have facility coordinates
      if (facilityPoint && parsed.radius) {
        addRadiusCircle(map.current, facilityPoint, parsed.radius);
      }

      // Performance limits: Prevent Mapbox overload
      const MAX_MARKERS_WITH_POPUPS = 20;
      const MAX_MARKERS_WITHOUT_POPUPS = 30;
      const MAX_TOTAL_MARKERS = 50;  // Show only top 50 most important markers
      
      // Log tier distribution in ALL received features (before limiting)
      const allTierCounts = {};
      features.forEach(f => {
        const props = f.properties || {};
        const tier = props.importance_tier || props.strategic_tier || 'medium';
        allTierCounts[tier] = (allTierCounts[tier] || 0) + 1;
      });
      
      // Importance-based priority filtering: Sort by tier and importance score, then take top 50
      // Tier priority: critical > high > medium > low
      // Within each tier, sort by importance score (higher = better)
      const getTierPriority = (tier) => {
        if (tier === 'critical') return 4;
        if (tier === 'high') return 3;
        if (tier === 'medium') return 2;
        return 1; // low
      };
      
      const sortedFeatures = [...features].sort((a, b) => {
        const propsA = a.properties || {};
        const propsB = b.properties || {};
        
        const tierA = propsA.importance_tier || propsA.strategic_tier || 'medium';
        const tierB = propsB.importance_tier || propsB.strategic_tier || 'medium';
        
        const priorityA = getTierPriority(tierA);
        const priorityB = getTierPriority(tierB);
        
        // Primary sort: by tier priority (higher = better)
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Descending (critical first)
        }
        
        // Secondary sort: by importance score (higher = better)
        const scoreA = propsA.importance || propsA.strategic_score || 0;
        const scoreB = propsB.importance || propsB.strategic_score || 0;
        
        if (Math.abs(scoreA - scoreB) > 0.1) {
          return scoreB - scoreA; // Descending (higher score first)
        }
        
        // Tertiary sort: by distance (closer = better)
        const distA = propsA.distance_m || Infinity;
        const distB = propsB.distance_m || Infinity;
        return distA - distB; // Ascending (closer first)
      });
      
      // Take only the top 50 most important markers
      const featuresToDisplay = sortedFeatures.slice(0, MAX_TOTAL_MARKERS);
      
      
      const featuresToProcess = featuresToDisplay.slice(0, MAX_MARKERS_WITH_POPUPS);
      
      if (features.length > MAX_TOTAL_MARKERS) {
        console.warn(`⚠️ MCPSearchResults: Limiting display to ${MAX_TOTAL_MARKERS} markers (${features.length} available)`);
      }
      
      
      // Add markers for each feature (handle Point, Polygon, LineString, etc.)
      featuresToProcess.forEach((feature, index) => {
        let coordinates = null;
        
        if (feature.geometry) {
          if (feature.geometry.type === 'Point') {
            coordinates = feature.geometry.coordinates;
          } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            // Calculate centroid for polygons
            try {
              const centroid = turf.centroid(feature);
              coordinates = centroid.geometry.coordinates;
            } catch (err) {
              console.warn('⚠️ MCPSearchResults: Error calculating centroid', err);
              return; // Skip this feature
            }
          } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
            // Use first point of line for marker
            try {
              const line = feature.geometry.type === 'LineString' 
                ? turf.lineString(feature.geometry.coordinates)
                : turf.lineString(feature.geometry.coordinates[0]);
              const centroid = turf.centroid(line);
              coordinates = centroid.geometry.coordinates;
            } catch (err) {
              console.warn('⚠️ MCPSearchResults: Error processing line', err);
              return; // Skip this feature
            }
          }
        }
        
        if (coordinates) {
          // Create a point feature for the marker
          const pointFeature = {
            ...feature,
            geometry: {
              type: 'Point',
              coordinates: coordinates
            }
          };
          
          const marker = addMarker(map.current, pointFeature, index);
          if (marker) {
            // Verify this is not an OSM marker before adding to MCP markers
            let isOSMMarker = false;
            if (typeof window !== 'undefined' && window.pinalSiteMarkers) {
              for (const osmMarker of Object.values(window.pinalSiteMarkers)) {
                if (osmMarker === marker) {
                  isOSMMarker = true;
                  console.warn('⚠️ MCPSearchResults: Attempted to add OSM marker to MCP markers array - skipping');
                  break;
                }
              }
            }
            if (!isOSMMarker) {
              markersRef.current.push(marker);
            }
            // Add halo effect for this marker (pass feature to determine color)
            addHaloEffect(map.current, coordinates, index, pointFeature);
          }
        }
      });
      
      // Add remaining markers without popups (if any, up to limit)
      const remainingFeatures = featuresToDisplay.slice(MAX_MARKERS_WITH_POPUPS);
      if (remainingFeatures.length > 0) {
        remainingFeatures.slice(0, MAX_MARKERS_WITHOUT_POPUPS).forEach((feature, originalIndex) => {
          const index = originalIndex + MAX_MARKERS_WITH_POPUPS;
          let coordinates = null;
          
          if (feature.geometry) {
            if (feature.geometry.type === 'Point') {
              coordinates = feature.geometry.coordinates;
            } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              try {
                const centroid = turf.centroid(feature);
                coordinates = centroid.geometry.coordinates;
              } catch (err) {
                return;
              }
            } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
              try {
                const line = feature.geometry.type === 'LineString' 
                  ? turf.lineString(feature.geometry.coordinates)
                  : turf.lineString(feature.geometry.coordinates[0]);
                const centroid = turf.centroid(line);
                coordinates = centroid.geometry.coordinates;
              } catch (err) {
                return;
              }
            }
          }
          
          if (coordinates) {
            const pointFeature = {
              ...feature,
              geometry: {
                type: 'Point',
                coordinates: coordinates
              }
            };
            
            const marker = addMarkerWithoutPopup(map.current, pointFeature, index);
            if (marker) {
              // Verify this is not an OSM marker before adding to MCP markers
              let isOSMMarker = false;
              if (typeof window !== 'undefined' && window.pinalSiteMarkers) {
                for (const osmMarker of Object.values(window.pinalSiteMarkers)) {
                  if (osmMarker === marker) {
                    isOSMMarker = true;
                    console.warn('⚠️ MCPSearchResults: Attempted to add OSM marker to MCP markers array - skipping');
                    break;
                  }
                }
              }
              if (!isOSMMarker) {
                markersRef.current.push(marker);
              }
              // Add halo effect for this marker too (pass feature to determine color)
              addHaloEffect(map.current, coordinates, index, pointFeature);
            }
          }
        });
      }

      // Fly to results bounding box
      if (features.length > 0) {
        try {
          const bbox = turf.bbox(turf.featureCollection(features));
          map.current.fitBounds(bbox, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            duration: 4000 // Slowed down from 1000ms to 4000ms (4 seconds)
          });
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error fitting bounds', err);
        }
      }

    };

    const unsubscribe = window.mapEventBus.on('mcp:searchResults', handleSearchResults);

    // Listen for zoom to feature events
    const handleZoomToFeature = (data) => {
      if (!map?.current || !data.coordinates || !Array.isArray(data.coordinates)) {
        console.warn('⚠️ MCPSearchResults: Invalid zoom data', data);
        return;
      }

      const [lng, lat] = data.coordinates;
      const featureIndex = data.featureIndex;

      // Fly to the feature location
      map.current.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 3000, // Slowed down from 1000ms to 3000ms
        essential: true
      });

      // After a short delay, trigger the marker click to show popup
      setTimeout(() => {
        // Find the marker by index
        if (markersRef.current[featureIndex]) {
          const marker = markersRef.current[featureIndex];
          const markerElement = marker.getElement();
          
          if (markerElement) {
            markerElement.click();
          } else {
            console.warn(`⚠️ Marker ${featureIndex} has no element`);
          }
        } else {
          console.warn(`⚠️ Marker ${featureIndex} not found`);
        }
      }, 3200); // Wait for flyTo to complete (increased from 1200ms to match 3000ms duration)
    };

    const unsubscribeZoom = window.mapEventBus.on('mcp:zoomToFeature', handleZoomToFeature);

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeZoom) unsubscribeZoom();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cleanup]);

  // Helper: Get facility coordinates
  const getFacilityCoordinates = (facilityKey) => {
    const coords = {
      'toyota_battery_nc': { lat: 35.85347, lng: -79.57169 },
      'vinfast_nc': { lat: 35.62, lng: -79.08 },
      'wolfspeed_nc': { lat: 35.72, lng: -79.49 },
      'raleigh_grid': { lat: 35.7796, lng: -78.6382 },
      'greensboro_grid': { lat: 36.0726, lng: -79.792 },
      'harris_nc': { lat: 35.6506, lng: -78.9531 },
      'tsmc_phoenix': { lat: 33.7250, lng: -112.1667 },
      'tsmc_phoenix_water': { lat: 33.4484, lng: -112.0740 },
      'amkor_technology_phoenix': { lat: 33.7100, lng: -112.2800 },
      'intel_ocotillo_chandler': { lat: 33.2431, lng: -111.8844 },
      'nxp_semiconductors_chandler': { lat: 33.3260, lng: -111.8617 },
      'linde_industrial_gas_phoenix': { lat: 33.7200, lng: -112.1650 },
      'halo_vista_phoenix': { lat: 33.7150, lng: -112.1600 },
      // PA Nuclear Sites
      'three_mile_island_pa': { lat: 40.1500, lng: -76.7300 },
      'susquehanna_nuclear_pa': { lat: 41.1000, lng: -76.1500 },
      // Also support facility name variations
      'three_mile_island': { lat: 40.1500, lng: -76.7300 },
      'susquehanna': { lat: 41.1000, lng: -76.1500 },
    };
    return coords[facilityKey] || null;
  };

  // Helper: Add radius circle
  const addRadiusCircle = (mapInstance, center, radiusMeters) => {
    try {
      const sourceId = 'mcp-search-radius';
      const layerId = 'mcp-search-radius-layer';
      const outlineLayerId = `${layerId}-outline`;

      // Remove existing layers and source if present (must remove layers first)
      if (mapInstance.getLayer(outlineLayerId)) {
        try {
          mapInstance.removeLayer(outlineLayerId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing existing outline layer', err);
        }
      }
      if (mapInstance.getLayer(layerId)) {
        try {
          mapInstance.removeLayer(layerId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing existing fill layer', err);
        }
      }
      // Only remove source after all layers are removed
      if (mapInstance.getSource(sourceId)) {
        try {
          mapInstance.removeSource(sourceId);
        } catch (err) {
          console.warn('⚠️ MCPSearchResults: Error removing existing source', err);
        }
      }

      // Create circle
      const circle = turf.circle([center.lng, center.lat], radiusMeters / 1000, {
        units: 'kilometers',
        steps: 64
      });

      // Add source
      mapInstance.addSource(sourceId, {
        type: 'geojson',
        data: circle
      });

      // Determine radius circle color based on search category (default to purple)
      // Note: This could be enhanced to check parsed.category from search results
      const radiusColor = '#8b5cf6'; // Default purple, could be made dynamic based on search type
      const radiusOutlineColor = '#a78bfa'; // Default purple outline
      
      // Add layer
      mapInstance.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': radiusColor,
          'fill-opacity': 0.1
        }
      });

      // Add outline
      mapInstance.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': radiusOutlineColor,
          'line-width': 2,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2]
        }
      });

      sourceRef.current = sourceId;
      radiusLayerRef.current = layerId;

    } catch (err) {
      console.warn('⚠️ MCPSearchResults: Error adding radius circle', err);
    }
  };

  // Helper: Add halo effect (similar to OSM markers)
  const addHaloEffect = (mapInstance, coordinates, index, feature = null) => {
    try {
      const [lng, lat] = coordinates;
      const haloSourceId = `mcp-marker-${index}-halo-source`;
      const haloFillId = `mcp-marker-${index}-halo-fill`;
      const haloLineId = `mcp-marker-${index}-halo-line`;

      // Create halo circle (0.7km radius for MCP markers)
      const haloCircle = turf.circle([lng, lat], 0.7, {
        steps: 120,
        units: 'kilometers'
      });

      // Add source
      mapInstance.addSource(haloSourceId, {
        type: 'geojson',
        data: haloCircle
      });

      // Determine halo color based on feature category and importance tier
      let haloColor = '#8b5cf6'; // Default purple
      if (feature && feature.properties) {
        const props = feature.properties;
        const tags = props.tags || {};
        const category = props.category || props.power || 'infrastructure';
        const isWaterCategory = category === 'water' || 
                               category === 'waterway' ||      // Rivers, streams, canals
                               category === 'water_body' ||    // Lakes, reservoirs
                               category === 'water_allocation' || 
                               category === 'agricultural_water' || 
                               category === 'state_trust_land' ||
                               tags.waterway ||                // Check tags.waterway (river, stream, canal, etc.)
                               tags.natural === 'water' ||     // Natural water bodies
                               props.man_made === 'water_tower' ||
                               props.man_made === 'water_works' ||
                               props.man_made === 'reservoir_covered' ||
                               tags.man_made === 'water_tower' ||
                               tags.man_made === 'water_works' ||
                               tags.man_made === 'reservoir_covered' ||
                               tags.amenity === 'water_treatment' ||
                               tags.amenity === 'water_works';
        
        // Get importance tier
        const importanceTier = props.importance_tier || props.strategic_tier || 'medium';
        
        // Match halo color to marker brightness
        if (isWaterCategory) {
          // Water halo colors (matching marker brightness)
          if (importanceTier === 'critical') haloColor = '#67e8f9';
          else if (importanceTier === 'high') haloColor = '#22d3ee';
          else if (importanceTier === 'medium') haloColor = '#06b6d4';
          else haloColor = '#0891b2';
        } else {
          // Power halo colors (matching marker colors)
          if (importanceTier === 'critical') haloColor = '#7c3aed';
          else if (importanceTier === 'high') haloColor = '#c084fc';
          else if (importanceTier === 'medium') haloColor = '#8b5cf6';
          else haloColor = '#6b21a8';
        }
      }
      
      // Add fill layer (category-appropriate color)
      mapInstance.addLayer({
        id: haloFillId,
        type: 'fill',
        source: haloSourceId,
        paint: {
          'fill-color': haloColor,
          'fill-opacity': 0.08
        }
      });

      // Add line layer (category-appropriate color)
      mapInstance.addLayer({
        id: haloLineId,
        type: 'line',
        source: haloSourceId,
        paint: {
          'line-color': haloColor,
          'line-width': 1.5,
          'line-opacity': 0.9,
          'line-dasharray': [0, 1.8, 1.2, 1.8]
        }
      });

      // Store halo refs for cleanup
      haloRefsRef.current.push({ haloFillId, haloLineId, haloSourceId });

      // Add animation (same as OSM)
      if (typeof window !== 'undefined') {
        if (!window.mcpHaloAnimations) {
          window.mcpHaloAnimations = {};
        }

        const dashArraySequence = [
          [0, 1.8, 1.2, 1.8],
          [0.45, 1.8, 0.75, 1.8],
          [0.9, 1.8, 0.3, 1.8],
          [1.35, 1.8, 0, 1.8]
        ];

        let dashIndex = 0;
        const animateHalo = () => {
          if (!mapInstance || !mapInstance.getLayer(haloLineId)) {
            if (window.mcpHaloAnimations[haloLineId]) {
              clearTimeout(window.mcpHaloAnimations[haloLineId]);
              delete window.mcpHaloAnimations[haloLineId];
            }
            return;
          }

          dashIndex = (dashIndex + 1) % dashArraySequence.length;
          mapInstance.setPaintProperty(haloLineId, 'line-dasharray', dashArraySequence[dashIndex]);
          window.mcpHaloAnimations[haloLineId] = setTimeout(animateHalo, 100);
        };

        window.mcpHaloAnimations[haloLineId] = setTimeout(animateHalo, 100);
      }
    } catch (err) {
      console.warn('⚠️ MCPSearchResults: Error adding halo effect', err);
    }
  };

  // Helper: Add marker without popup (for markers beyond the limit)
  const addMarkerWithoutPopup = (mapInstance, feature, index) => {
    try {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const distance = props.distance_m || 0;
      
      // Extract name
      let name = null;
      if (props.name && props.name !== 'Unnamed' && props.name.trim() !== '') {
        name = props.name;
      } else if (props.operator && props.operator.trim() !== '') {
        name = props.operator;
      } else if (props.ref && props.ref.trim() !== '') {
        name = `Ref: ${props.ref}`;
      } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
        name = props['operator:ref'];
      } else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
        name = props.power;
      } else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
        name = props.man_made;
      } else if (props.substation && props.substation.trim() !== '') {
        name = props.substation;
      } else if (props.type && props.type.trim() !== '') {
        name = props.type;
      } else {
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${index + 1}`;
      }
      
      const category = props.category || props.power || 'infrastructure';
      const tags = props.tags || {};
      
      // Determine marker color based on category - water gets cyan/teal colors
      const isWaterCategory = category === 'water' || 
                             category === 'waterway' ||      // Rivers, streams, canals
                             category === 'water_body' ||    // Lakes, reservoirs
                             category === 'water_allocation' || 
                             category === 'agricultural_water' || 
                             category === 'state_trust_land' ||
                             tags.waterway ||                // Check tags.waterway (river, stream, canal, etc.)
                             tags.natural === 'water' ||     // Natural water bodies
                             props.man_made === 'water_tower' ||
                             props.man_made === 'water_works' ||
                             props.man_made === 'reservoir_covered' ||
                             tags.man_made === 'water_tower' ||
                             tags.man_made === 'water_works' ||
                             tags.man_made === 'reservoir_covered' ||
                             tags.amenity === 'water_treatment' ||
                             tags.amenity === 'water_works';
      
      // Get importance tier from properties (strategic_tier or importance_tier)
      const importanceTier = props.importance_tier || props.strategic_tier || 'medium';
      
      // Color gradient system: more saturated/darker = more important (for better visual distinction)
      // Power (Purple) gradient: #6b21a8 (low) → #8b5cf6 (medium) → #c084fc (high) → #7c3aed (critical - darker, more saturated)
      // Water (Cyan) gradient: #0891b2 (low) → #06b6d4 (medium) → #22d3ee (high) → #0ea5e9 (critical - darker, more saturated)
      const getMarkerColor = (isWater, tier) => {
        if (isWater) {
          // Water: Cyan gradient (more saturated = more important)
          if (tier === 'critical') return '#0ea5e9'; // Darker, more saturated cyan (critical - stands out)
          if (tier === 'high') return '#22d3ee'; // Bright cyan (high)
          if (tier === 'medium') return '#06b6d4'; // Base cyan (medium)
          return '#0891b2'; // Darker cyan (low)
        } else {
          // Power: Purple gradient (more saturated/darker = more important)
          if (tier === 'critical') return '#7c3aed'; // Darker, more saturated purple (critical - stands out)
          if (tier === 'high') return '#c084fc'; // Bright purple (high)
          if (tier === 'medium') return '#8b5cf6'; // Base purple (medium)
          return '#6b21a8'; // Darker purple (low)
        }
      };
      
      const markerColor = getMarkerColor(isWaterCategory, importanceTier);
      const markerSize = 1.0;

      // Get z-index based on importance tier (higher tier = higher z-index)
      const getZIndex = (tier) => {
        if (tier === 'critical') return 1000;
        if (tier === 'high') return 800;
        if (tier === 'medium') return 600;
        return 400; // low
      };
      const markerZIndex = getZIndex(importanceTier);

      // Create marker without popup
      const marker = new mapboxgl.Marker({
        color: markerColor,
        scale: markerSize,
        anchor: 'bottom'
      })
        .setLngLat([lng, lat])
        .addTo(mapInstance);

      // Add click handler and set z-index
      const markerElement = marker.getElement();
      markerElement.style.cursor = 'pointer';
      markerElement.style.zIndex = markerZIndex;
      markerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Auto-zoom to marker location
        if (map?.current && Number.isFinite(lng) && Number.isFinite(lat)) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: Math.max(map.current.getZoom(), 15),
            duration: 3000, // Slowed down from 1000ms to 3000ms
            essential: true
          });
        }
        
        // Find the index of this marker in the array
        const clickedMarkerIndex = markersRef.current.findIndex(m => m === marker);
        
        // Ensure clicked marker stays at full opacity
        if (clickedMarkerIndex >= 0) {
          const clickedMarker = markersRef.current[clickedMarkerIndex];
          if (clickedMarker && clickedMarker.getElement) {
            const clickedEl = clickedMarker.getElement();
            if (clickedEl) {
              clickedEl.style.setProperty('opacity', '1', 'important');
              clickedEl.style.setProperty('filter', 'none', 'important');
              clickedEl.classList.remove('mcp-marker-dimmed');
              const clickedSvg = clickedEl.querySelector('svg');
              if (clickedSvg) {
                clickedSvg.style.setProperty('opacity', '1', 'important');
                clickedSvg.style.setProperty('filter', 'none', 'important');
              }
            }
          }
          
          // Ensure clicked halo stays at full opacity
          if (mapInstance) {
            const clickedHaloFillId = `mcp-marker-${clickedMarkerIndex}-halo-fill`;
            const clickedHaloLineId = `mcp-marker-${clickedMarkerIndex}-halo-line`;
            if (mapInstance.getLayer(clickedHaloFillId)) {
              mapInstance.setPaintProperty(clickedHaloFillId, 'fill-opacity', 0.08);
            }
            if (mapInstance.getLayer(clickedHaloLineId)) {
              mapInstance.setPaintProperty(clickedHaloLineId, 'line-opacity', 0.9);
            }
          }
          
          // Dim all halos EXCEPT the clicked one
          if (mapInstance) {
            haloRefsRef.current.forEach(({ haloFillId, haloLineId }, haloIdx) => {
              // Skip the clicked halo
              if (haloIdx === clickedMarkerIndex) {
                return;
              }
              
              if (mapInstance.getLayer(haloFillId)) {
                mapInstance.setPaintProperty(haloFillId, 'fill-opacity', 0.016); // 20% of 0.08 = 0.016
              }
              if (mapInstance.getLayer(haloLineId)) {
                mapInstance.setPaintProperty(haloLineId, 'line-opacity', 0.18); // 20% of 0.9 = 0.18
              }
            });
          }
        }
        
        // Dim all markers EXCEPT the clicked one
        markersRef.current.forEach((m, idx) => {
          // Skip the clicked marker
          if (idx === clickedMarkerIndex) {
            return;
          }
          
          if (m && m.getElement) {
            const el = m.getElement();
            if (el) {
              // Try multiple approaches to dim the marker
              // 1. Set opacity on the marker element itself (20% opacity to keep them visible)
              el.style.setProperty('opacity', '0.2', 'important');
              el.style.setProperty('filter', 'grayscale(50%)', 'important');
              
              // 2. Also try setting opacity on the SVG inside (Mapbox uses SVG for markers)
              const svg = el.querySelector('svg');
              if (svg) {
                svg.style.setProperty('opacity', '0.2', 'important');
                svg.style.setProperty('filter', 'grayscale(50%)', 'important');
              }
              
              // 3. Add a CSS class for additional control
              el.classList.add('mcp-marker-dimmed');
            }
          }
        });
        
        // Dim all popups
        popupsRef.current.forEach((p, popupIdx) => {
          if (p && p.getElement) {
            const popupEl = p.getElement();
            if (popupEl) {
              popupEl.style.setProperty('opacity', '0.01', 'important'); // Very transparent (1%)
              popupEl.style.setProperty('filter', 'grayscale(50%)', 'important');
            }
          }
        });
        
        // Also try to dim by class selector as fallback
        const allPopupsByClass = document.querySelectorAll('.mcp-marker-popup');
        allPopupsByClass.forEach((popupEl, popupIdx) => {
          popupEl.style.setProperty('opacity', '0.05', 'important'); // Super transparent (5%)
          popupEl.style.setProperty('filter', 'grayscale(50%)', 'important');
        });
        
        // Clear any existing reset timeout
        if (resetDimmingTimeoutRef.current) {
          clearTimeout(resetDimmingTimeoutRef.current);
        }
        
        // Set timeout to reset all markers, halos, and popups to full opacity after 3 seconds
        resetDimmingTimeoutRef.current = setTimeout(() => {
          resetAllToFullOpacity(mapInstance);
          resetDimmingTimeoutRef.current = null;
        }, 3000);
        
        const markerData = {
          id: props.id || `mcp-${index}`,
          name: name,
          category: category,
          coordinates: {
            lng: lng,
            lat: lat
          },
          distance: distance,
          distance_km: (distance / 1000).toFixed(2),
          power: props.power || null,
          voltage: props.voltage || null,
          material: props.material || null,
          operator: props.operator || null,
          type: props.man_made || props.type || null,
          description: `${name} - ${category}`,
          source: 'mcp',
          color: markerColor,
          properties: props
        };

        if (window.mapEventBus) {
          window.mapEventBus.emit('marker:clicked', markerData);
        }
      });

      return marker;
    } catch (err) {
      console.warn('⚠️ MCPSearchResults: Error adding marker without popup', err);
      return null;
    }
  };

  // Helper: Trigger pulse effect on popup, halo, and marker
  const triggerPulseEffect = (popup, mapInstance, index, marker) => {
    // Pulse the popup card
    const popupElement = popup.getElement();
    if (popupElement) {
      const contentDiv = popupElement.querySelector('.mapboxgl-popup-content > div');
      if (contentDiv) {
        // Check if it's a water popup by class
        const isWaterPopup = contentDiv.classList.contains('mcp-popup-water');
        if (isWaterPopup) {
          contentDiv.classList.add('mcp-popup-pulse');
        } else {
          contentDiv.classList.add('mcp-popup-pulse');
        }
        setTimeout(() => {
          contentDiv.classList.remove('mcp-popup-pulse');
        }, 3000);
      }
    }
    
    // Pulse the marker - make it super bright
    if (marker) {
      const markerElement = marker.getElement();
      if (markerElement) {
        const svg = markerElement.querySelector('svg');
        if (svg) {
          // Check marker color to determine if it's water
          const computedColor = window.getComputedStyle(svg).color;
          const svgColor = svg.style.color || computedColor;
          // Store original color for reset
          const originalColor = svgColor;
          // Check if color is cyan/teal (water colors) - check all water color variants
          const isWater = svgColor === 'rgb(6, 182, 212)' || 
                         svgColor === '#06b6d4' || 
                         svgColor === '#22d3ee' ||
                         svgColor === '#67e8f9' ||
                         svgColor === '#0891b2' ||
                         svgColor.includes('06b6d4') ||
                         svgColor.includes('22d3ee') ||
                         svgColor.includes('67e8f9') ||
                         svgColor.includes('rgb(6, 182, 212)') ||
                         svgColor.includes('rgb(34, 211, 238)') ||
                         svgColor.includes('rgb(103, 232, 249)');
          
          // Get feature properties to determine importance tier
          const feature = markersRef.current[index]?.feature;
          const importanceTier = feature?.properties?.importance_tier || feature?.properties?.strategic_tier || 'medium';
          
          // Make marker super bright (use brightest color for tier)
          let brightColor, brightGlow;
          if (isWater) {
            // Water: Use brightest cyan for critical, bright for others
            if (importanceTier === 'critical') {
              brightColor = '#67e8f9'; // Brightest cyan
              brightGlow = 'rgba(103, 232, 249, 0.9)';
            } else if (importanceTier === 'high') {
              brightColor = '#22d3ee'; // Bright cyan
              brightGlow = 'rgba(34, 211, 238, 0.8)';
            } else {
              brightColor = '#06b6d4'; // Base cyan
              brightGlow = 'rgba(6, 182, 212, 0.7)';
            }
          } else {
            // Power: Use brightest purple for critical, bright for others
            if (importanceTier === 'critical') {
              brightColor = '#7c3aed'; // Darker, more saturated purple (stands out)
              brightGlow = 'rgba(124, 58, 237, 0.9)';
            } else if (importanceTier === 'high') {
              brightColor = '#c084fc'; // Bright purple
              brightGlow = 'rgba(192, 132, 252, 0.8)';
            } else {
              brightColor = '#8b5cf6'; // Base purple
              brightGlow = 'rgba(139, 92, 246, 0.7)';
            }
          }
          svg.style.color = brightColor;
          svg.style.filter = `brightness(2) drop-shadow(0 0 8px ${brightGlow})`;
          
          // Also change any path fills
          const paths = svg.querySelectorAll('path');
          paths.forEach(path => {
            if (path.hasAttribute('fill')) {
              const originalPathColor = path.getAttribute('fill') || originalColor;
              path.setAttribute('data-original-fill', originalPathColor);
              path.setAttribute('fill', brightColor);
            }
          });
          
          setTimeout(() => {
            svg.style.color = originalColor;
            svg.style.filter = '';
            paths.forEach(path => {
              if (path.hasAttribute('data-original-fill')) {
                path.setAttribute('fill', path.getAttribute('data-original-fill'));
                path.removeAttribute('data-original-fill');
              }
            });
          }, 3000);
        }
      }
    }
    
    // Pulse the halo - make it darker
    const haloLineId = `mcp-marker-${index}-halo-line`;
    const haloFillId = `mcp-marker-${index}-halo-fill`;
    if (mapInstance.getLayer(haloLineId)) {
      // Store original values
      const originalOpacity = mapInstance.getPaintProperty(haloLineId, 'line-opacity');
      const originalWidth = mapInstance.getPaintProperty(haloLineId, 'line-width');
      const originalColor = mapInstance.getPaintProperty(haloLineId, 'line-color');
      
      // Make halo darker and more prominent during pulse
      mapInstance.setPaintProperty(haloLineId, 'line-color', '#4c1d95'); // Much darker purple
      mapInstance.setPaintProperty(haloLineId, 'line-opacity', 1.0);
      mapInstance.setPaintProperty(haloLineId, 'line-width', 2.5);
      
      if (mapInstance.getLayer(haloFillId)) {
        const originalFillOpacity = mapInstance.getPaintProperty(haloFillId, 'fill-opacity');
        const originalFillColor = mapInstance.getPaintProperty(haloFillId, 'fill-color');
        
        // Make fill darker too
        mapInstance.setPaintProperty(haloFillId, 'fill-color', '#4c1d95'); // Much darker purple
        mapInstance.setPaintProperty(haloFillId, 'fill-opacity', 0.2);
        
        setTimeout(() => {
          mapInstance.setPaintProperty(haloLineId, 'line-color', originalColor);
          mapInstance.setPaintProperty(haloLineId, 'line-opacity', originalOpacity);
          mapInstance.setPaintProperty(haloLineId, 'line-width', originalWidth);
          mapInstance.setPaintProperty(haloFillId, 'fill-color', originalFillColor);
          mapInstance.setPaintProperty(haloFillId, 'fill-opacity', originalFillOpacity);
        }, 3000);
      } else {
        setTimeout(() => {
          mapInstance.setPaintProperty(haloLineId, 'line-color', originalColor);
          mapInstance.setPaintProperty(haloLineId, 'line-opacity', originalOpacity);
          mapInstance.setPaintProperty(haloLineId, 'line-width', originalWidth);
        }, 3000);
      }
    }
  };

  // Helper: Add marker (using Mapbox built-in teardrop like PerplexityCall)
  const addMarker = (mapInstance, feature, index) => {
    try {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const distance = props.distance_m || 0;
      
      // Extract name - skip "Unnamed" and try multiple OSM property fields
      let name = null;
      if (props.name && props.name !== 'Unnamed' && props.name.trim() !== '') {
        name = props.name;
      } else if (props.operator && props.operator.trim() !== '') {
        name = props.operator;
      } else if (props.ref && props.ref.trim() !== '') {
        name = `Ref: ${props.ref}`;
      } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
        name = props['operator:ref'];
      } else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
        name = props.power;
      } else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
        name = props.man_made;
      } else if (props.substation && props.substation.trim() !== '') {
        name = props.substation;
      } else if (props.type && props.type.trim() !== '') {
        name = props.type;
      } else {
        // Fallback to category-based name
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${index + 1}`;
      }
      
      const category = props.category || props.power || 'infrastructure';
      const tags = props.tags || {};

      // Determine marker color based on category - water gets cyan/teal colors
      const isWaterCategory = category === 'water' || 
                             category === 'waterway' ||      // Rivers, streams, canals
                             category === 'water_body' ||    // Lakes, reservoirs
                             category === 'water_allocation' || 
                             category === 'agricultural_water' || 
                             category === 'state_trust_land' ||
                             tags.waterway ||                // Check tags.waterway (river, stream, canal, etc.)
                             tags.natural === 'water' ||     // Natural water bodies
                             props.man_made === 'water_tower' ||
                             props.man_made === 'water_works' ||
                             props.man_made === 'reservoir_covered' ||
                             tags.man_made === 'water_tower' ||
                             tags.man_made === 'water_works' ||
                             tags.man_made === 'reservoir_covered' ||
                             tags.amenity === 'water_treatment' ||
                             tags.amenity === 'water_works';
      
      // Get importance tier from properties (strategic_tier or importance_tier)
      const importanceTier = props.importance_tier || props.strategic_tier || 'medium';
      
      
      // Color gradient system: more saturated/darker = more important (for better visual distinction)
      // Power (Purple) gradient: #6b21a8 (low) → #8b5cf6 (medium) → #c084fc (high) → #7c3aed (critical - darker, more saturated)
      // Water (Cyan) gradient: #0891b2 (low) → #06b6d4 (medium) → #22d3ee (high) → #0ea5e9 (critical - darker, more saturated)
      const getMarkerColor = (isWater, tier) => {
        if (isWater) {
          // Water: Cyan gradient (more saturated = more important)
          if (tier === 'critical') return '#0ea5e9'; // Darker, more saturated cyan (critical - stands out)
          if (tier === 'high') return '#22d3ee'; // Bright cyan (high)
          if (tier === 'medium') return '#06b6d4'; // Base cyan (medium)
          return '#0891b2'; // Darker cyan (low)
        } else {
          // Power: Purple gradient (more saturated/darker = more important)
          if (tier === 'critical') return '#7c3aed'; // Darker, more saturated purple (critical - stands out)
          if (tier === 'high') return '#c084fc'; // Bright purple (high)
          if (tier === 'medium') return '#8b5cf6'; // Base purple (medium)
          return '#6b21a8'; // Darker purple (low)
        }
      };
      
      const markerColor = getMarkerColor(isWaterCategory, importanceTier);
      
      // Get z-index based on importance tier (higher tier = higher z-index)
      const getZIndex = (tier) => {
        if (tier === 'critical') return 1000;
        if (tier === 'high') return 800;
        if (tier === 'medium') return 600;
        return 400; // low
      };
      const markerZIndex = getZIndex(importanceTier);
      
      const markerSize = 1.0; // Standard size

      // Format category for display
      const formatCategory = (cat) => {
        if (!cat) return 'Infrastructure';
        // Convert snake_case or kebab-case to Title Case
        return cat
          .replace(/[_-]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      const displayCategory = formatCategory(category);

      // Determine popup colors based on category and importance tier
      const getPopupGradient = (isWater, tier) => {
        if (isWater) {
          // Water popup gradients (matching marker brightness)
          if (tier === 'critical') return 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)'; // Brightest cyan
          if (tier === 'high') return 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)'; // Bright cyan
          if (tier === 'medium') return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'; // Base cyan
          return 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'; // Darker cyan
        } else {
          // Power popup gradients (matching marker colors)
          if (tier === 'critical') return 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)'; // Darker, more saturated purple
          if (tier === 'high') return 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)'; // Bright purple
          if (tier === 'medium') return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'; // Base purple
          return 'linear-gradient(135deg, #6b21a8 0%, #5b21b6 100%)'; // Darker purple
        }
      };
      
      const getPopupShadow = (isWater, tier) => {
        if (isWater) {
          // Water shadows (brighter for higher importance)
          if (tier === 'critical') return '0 4px 12px rgba(103, 232, 249, 0.6)'; // Brightest cyan shadow
          if (tier === 'high') return '0 4px 12px rgba(34, 211, 238, 0.5)'; // Bright cyan shadow
          if (tier === 'medium') return '0 4px 12px rgba(6, 182, 212, 0.4)'; // Base cyan shadow
          return '0 4px 12px rgba(8, 145, 178, 0.3)'; // Darker cyan shadow
        } else {
          // Power shadows (brighter for higher importance)
          if (tier === 'critical') return '0 4px 12px rgba(233, 213, 255, 0.6)'; // Brightest purple shadow
          if (tier === 'high') return '0 4px 12px rgba(192, 132, 252, 0.5)'; // Bright purple shadow
          if (tier === 'medium') return '0 4px 12px rgba(107, 33, 168, 0.4)'; // Base purple shadow
          return '0 4px 12px rgba(91, 33, 182, 0.3)'; // Darker purple shadow
        }
      };
      
      const popupBgGradient = getPopupGradient(isWaterCategory, importanceTier);
      const popupShadow = getPopupShadow(isWaterCategory, importanceTier);
      
      // Create popup with category-appropriate background and white text
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: 'bottom', // Position above marker
        offset: [0, -65], // Offset above marker (moved up 25px from -10)
        className: 'mcp-marker-popup',
        maxWidth: '200px'
      });
      
      // Store popup reference
      popupsRef.current.push(popup);
      
      popup
        .setLngLat([lng, lat])
        .setHTML(`
          <div style="
            background: ${popupBgGradient};
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            text-align: center;
            box-shadow: ${popupShadow};
            border: none;
            white-space: nowrap;
          ">
            ${displayCategory}
          </div>
        `);
      
      // Inject custom CSS to remove Mapbox default popup border and add pulse animation
      if (typeof document !== 'undefined') {
        const styleId = 'mcp-popup-custom-styles';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            .mcp-marker-popup .mapboxgl-popup-content {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
            .mcp-marker-popup .mapboxgl-popup-tip {
              border-top-color: transparent !important;
              display: none !important;
            }
            @keyframes mcpPulse {
              0% {
                transform: scale(1);
                box-shadow: 0 4px 12px rgba(107, 33, 168, 0.4);
                background: linear-gradient(135deg, #6b21a8 0%, #7c3aed 100%);
              }
              50% {
                transform: scale(1.1);
                box-shadow: 0 8px 24px rgba(107, 33, 168, 0.8);
                background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 4px 12px rgba(107, 33, 168, 0.4);
                background: linear-gradient(135deg, #6b21a8 0%, #7c3aed 100%);
              }
            }
            @keyframes mcpPulseWater {
              0% {
                transform: scale(1);
                box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
                background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
              }
              50% {
                transform: scale(1.1);
                box-shadow: 0 8px 24px rgba(6, 182, 212, 0.8);
                background: linear-gradient(135deg, #0e7490 0%, #0891b2 100%);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
                background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
              }
            }
            .mcp-popup-pulse {
              animation: mcpPulse 3s ease-in-out;
            }
            .mcp-popup-water.mcp-popup-pulse {
              animation: mcpPulseWater 3s ease-in-out;
            }
            
            /* Force dimmed markers to be dimmed but visible (20% opacity) */
            .mcp-marker-dimmed {
              opacity: 0.2 !important;
              filter: grayscale(50%) !important;
            }
            
            .mcp-marker-dimmed svg {
              opacity: 0.2 !important;
              filter: grayscale(50%) !important;
            }
          `;
          document.head.appendChild(style);
        }
      }

      // Create Mapbox marker with popup
      const marker = new mapboxgl.Marker({
        color: markerColor,
        scale: markerSize,
        anchor: 'bottom' // Anchor at the bottom for teardrop effect
      })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapInstance);

      // Get marker element and set z-index based on importance tier (higher tier = higher z-index)
      const markerElement = marker.getElement();
      markerElement.style.zIndex = markerZIndex;

      // Open popup immediately so it's visible above the marker
      marker.togglePopup();
      
      // Add click handler to popup content to trigger pulse
      setTimeout(() => {
        const popupElement = popup.getElement();
        if (popupElement) {
          const contentDiv = popupElement.querySelector('.mapboxgl-popup-content > div');
          if (contentDiv) {
            contentDiv.style.cursor = 'pointer';
            contentDiv.addEventListener('click', (e) => {
              e.stopPropagation();
              // Trigger the same pulse effect as marker click
              triggerPulseEffect(popup, mapInstance, index, marker);
            });
          }
        }
      }, 100);

      // Add click handler to emit marker clicked event and trigger pulse
      markerElement.style.cursor = 'pointer';
      markerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Auto-zoom to marker location
        if (map?.current && Number.isFinite(lng) && Number.isFinite(lat)) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: Math.max(map.current.getZoom(), 15),
            duration: 3000, // Slowed down from 1000ms to 3000ms
            essential: true
          });
        }
        
        // Ensure clicked marker stays at full opacity
        const clickedMarker = markersRef.current[index];
        if (clickedMarker && clickedMarker.getElement) {
          const clickedEl = clickedMarker.getElement();
          if (clickedEl) {
            clickedEl.style.setProperty('opacity', '1', 'important');
            clickedEl.style.setProperty('filter', 'none', 'important');
            clickedEl.classList.remove('mcp-marker-dimmed');
            const clickedSvg = clickedEl.querySelector('svg');
            if (clickedSvg) {
              clickedSvg.style.setProperty('opacity', '1', 'important');
              clickedSvg.style.setProperty('filter', 'none', 'important');
            }
          }
        }
        
        // Ensure clicked halo stays at full opacity
        if (mapInstance) {
          const clickedHaloFillId = `mcp-marker-${index}-halo-fill`;
          const clickedHaloLineId = `mcp-marker-${index}-halo-line`;
          if (mapInstance.getLayer(clickedHaloFillId)) {
            mapInstance.setPaintProperty(clickedHaloFillId, 'fill-opacity', 0.08);
          }
          if (mapInstance.getLayer(clickedHaloLineId)) {
            mapInstance.setPaintProperty(clickedHaloLineId, 'line-opacity', 0.9);
          }
        }
        
        // Dim all halos EXCEPT the clicked one
        if (mapInstance) {
          haloRefsRef.current.forEach(({ haloFillId, haloLineId }, haloIdx) => {
            // Skip the clicked halo
            if (haloIdx === index) {
              return;
            }
            
            if (mapInstance.getLayer(haloFillId)) {
              mapInstance.setPaintProperty(haloFillId, 'fill-opacity', 0.016); // 20% of 0.08 = 0.016
            }
            if (mapInstance.getLayer(haloLineId)) {
              mapInstance.setPaintProperty(haloLineId, 'line-opacity', 0.18); // 20% of 0.9 = 0.18
            }
          });
        }
        
        // Dim all markers EXCEPT the clicked one
        markersRef.current.forEach((m, idx) => {
          // Skip the clicked marker
          if (idx === index) {
            return;
          }
          
          if (m && m.getElement) {
            const el = m.getElement();
            if (el) {
              // Try multiple approaches to dim the marker
              // 1. Set opacity on the marker element itself (20% opacity to keep them visible)
              el.style.setProperty('opacity', '0.2', 'important');
              el.style.setProperty('filter', 'grayscale(50%)', 'important');
              
              // 2. Also try setting opacity on the SVG inside (Mapbox uses SVG for markers)
              const svg = el.querySelector('svg');
              if (svg) {
                svg.style.setProperty('opacity', '0.2', 'important');
                svg.style.setProperty('filter', 'grayscale(50%)', 'important');
              }
              
              // 3. Add a CSS class for additional control
              el.classList.add('mcp-marker-dimmed');
            }
          }
        });
        
        // Ensure clicked popup stays at full opacity
        const clickedPopup = popupsRef.current[index];
        if (clickedPopup && clickedPopup.getElement) {
          const clickedPopupEl = clickedPopup.getElement();
          if (clickedPopupEl) {
            clickedPopupEl.style.setProperty('opacity', '1', 'important');
            clickedPopupEl.style.setProperty('filter', 'none', 'important');
          }
        }
        
        // Dim all popups EXCEPT the clicked one (make them super transparent)
        popupsRef.current.forEach((p, popupIdx) => {
          // Skip the clicked popup
          if (popupIdx === index) {
            return;
          }
          
          if (p && p.getElement) {
            const popupEl = p.getElement();
            if (popupEl) {
              popupEl.style.setProperty('opacity', '0.01', 'important'); // Very transparent (1%)
              popupEl.style.setProperty('filter', 'grayscale(50%)', 'important');
            }
          }
        });
        
        // Also try to dim by class selector as fallback (excluding clicked one)
        const allPopupsByClass = document.querySelectorAll('.mcp-marker-popup');
        allPopupsByClass.forEach((popupEl, popupIdx) => {
          // Skip the clicked popup
          if (popupIdx === index) {
            return;
          }
          
          popupEl.style.setProperty('opacity', '0.05', 'important'); // Super transparent (5%)
          popupEl.style.setProperty('filter', 'grayscale(50%)', 'important');
        });
        
        // Clear any existing reset timeout
        if (resetDimmingTimeoutRef.current) {
          clearTimeout(resetDimmingTimeoutRef.current);
        }
        
        // Set timeout to reset all markers, halos, and popups to full opacity after 3 seconds
        resetDimmingTimeoutRef.current = setTimeout(() => {
          resetAllToFullOpacity(mapInstance);
          resetDimmingTimeoutRef.current = null;
        }, 3000);
        
        // Trigger pulse effect
        triggerPulseEffect(popup, mapInstance, index, marker);
        
        // Create marker data for AIResponseDisplayRefactored
        const markerData = {
          id: props.id || `mcp-${index}`,
          name: name,
          category: category,
          coordinates: {
            lng: lng,
            lat: lat
          },
          distance: distance,
          distance_km: (distance / 1000).toFixed(2),
          power: props.power || null,
          voltage: props.voltage || null,
          material: props.material || null,
          operator: props.operator || null,
          type: props.man_made || props.type || null,
          description: `${name} - ${category}`,
          source: 'mcp', // Mark as MCP marker
          color: markerColor, // Use the determined marker color (cyan for water, purple for others)
          // Include all properties for detailed view
          properties: props
        };

        // Emit marker clicked event for AIResponseDisplayRefactored
        if (window.mapEventBus) {
          window.mapEventBus.emit('marker:clicked', markerData);
        }
      });

      return marker;
    } catch (err) {
      console.warn('⚠️ MCPSearchResults: Error adding marker', err);
      return null;
    }
  };

  return null; // This component doesn't render anything
};

export default MCPSearchResults;

