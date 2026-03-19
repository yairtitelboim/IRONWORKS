import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

const ZoningLayer = ({ map, visible }) => {
  const sourceRef = useRef(false);
  const layersAddedRef = useRef(false);
  const currentDetailLevel = useRef(null);
  const isLoadingRef = useRef(false);
  const eventHandlersRef = useRef({});
  const originalLayerStatesRef = useRef({});
  const zoningLayerIds = useRef([
    'zoning-fill',
    'zoning-outline',
    'zoning-hover',
    'zoning-inner-glow',
    'zoning-hover-glow'
  ]);

  // Layer categories to dim when zoning is visible
  const backgroundLayerTypes = [
    'background',
    'fill',
    'line'
  ];
  
  // Layer IDs to exclude from dimming (critical UI elements)
  const excludeFromDimming = [
    'zoning-fill',
    'zoning-outline',
    'zoning-hover',
    'zoning-inner-glow',
    'zoning-outer-glow',
    'zoning-hover-glow'
  ];

  // Function to bring all zoning layers to the front
  const bringZoningLayersToFront = () => {
    if (!map?.current) return;
    
    try {
      console.log('Moving zoning layers to the front');
      // Get all layers in the map
      const layers = map.current.getStyle().layers || [];
      
      // Move each zoning layer to the top
      zoningLayerIds.current.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          // This will effectively move the layer to the top
          // by removing and re-adding it
          map.current.moveLayer(layerId);
        }
      });
    } catch (error) {
      console.error('Error bringing zoning layers to front:', error);
    }
  };

  // Function to dim background layers
  const dimBackgroundLayers = () => {
    if (!map?.current) return;

    try {
      const layers = map.current.getStyle().layers || [];
      console.log('Dimming background layers for zoning visibility');
      
      layers.forEach(layer => {
        // Skip our zoning layers
        if (excludeFromDimming.includes(layer.id)) return;
        
        if (backgroundLayerTypes.includes(layer.type)) {
          // Store original state if not already stored
          if (!originalLayerStatesRef.current[layer.id]) {
            if (layer.type === 'background') {
              // Store original background color
              originalLayerStatesRef.current[layer.id] = {
                type: layer.type,
                color: map.current.getPaintProperty(layer.id, 'background-color'),
                opacity: map.current.getPaintProperty(layer.id, 'background-opacity') || 1
              };
            } else if (layer.type === 'fill') {
              // Store original fill properties
              originalLayerStatesRef.current[layer.id] = {
                type: layer.type,
                color: map.current.getPaintProperty(layer.id, 'fill-color'),
                opacity: map.current.getPaintProperty(layer.id, 'fill-opacity') || 1
              };
            } else if (layer.type === 'line') {
              // Store original line properties
              originalLayerStatesRef.current[layer.id] = {
                type: layer.type,
                color: map.current.getPaintProperty(layer.id, 'line-color'),
                opacity: map.current.getPaintProperty(layer.id, 'line-opacity') || 1
              };
            }
          }
          
          // Apply dimming based on layer type
          if (layer.type === 'background') {
            // Reduce background opacity and darken color, but less aggressively
            const currentOpacity = map.current.getPaintProperty(layer.id, 'background-opacity') || 1;
            map.current.setPaintProperty(layer.id, 'background-opacity', currentOpacity * 0.2); // Increased from 0.2 to 0.5
            
            // Try to darken the background color if it exists, but use dark gray instead of black
            try {
              const backgroundColor = map.current.getPaintProperty(layer.id, 'background-color');
              if (backgroundColor) {
                map.current.setPaintProperty(layer.id, 'background-color', '#919191'); // Dark gray instead of black
              }
            } catch (e) {
              // Ignore errors with background color
            }
          } else if (layer.type === 'fill') {
            // Reduce fill opacity, but less aggressively
            const currentOpacity = map.current.getPaintProperty(layer.id, 'fill-opacity') || 1;
            map.current.setPaintProperty(layer.id, 'fill-opacity', currentOpacity * 0.8); // Increased from 0.2 to 0.4
          } else if (layer.type === 'line') {
            // Reduce line opacity, but less aggressively
            const currentOpacity = map.current.getPaintProperty(layer.id, 'line-opacity') || 1;
            map.current.setPaintProperty(layer.id, 'line-opacity', currentOpacity * 0.8); // Increased from 0.2 to 0.4
          }
        }
      });
      
      // After dimming background layers, bring zoning layers to front
      bringZoningLayersToFront();
    } catch (error) {
      console.error('Error dimming background layers:', error);
    }
  };

  // Function to restore background layers
  const restoreBackgroundLayers = () => {
    if (!map?.current) return;
    
    console.log('Restoring background layers');
    
    // Restore original states
    Object.entries(originalLayerStatesRef.current).forEach(([layerId, state]) => {
      try {
        if (map.current.getLayer(layerId)) {
          if (state.type === 'background') {
            map.current.setPaintProperty(layerId, 'background-opacity', state.opacity);
          } else if (state.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-opacity', state.opacity);
          } else if (state.type === 'line') {
            map.current.setPaintProperty(layerId, 'line-opacity', state.opacity);
          }
        }
      } catch (error) {
        console.error(`Error restoring layer ${layerId}:`, error);
      }
    });
    
    // Clear stored states
    originalLayerStatesRef.current = {};
  };

  // Expanded color mapping for LA zoning types
  const zoneColors = {
    // Residential - brightened colors
    'R1': '#FFEB88',      // Single Family (brightened from #FED976)
    'RS': '#FFEB88',      // Suburban (brightened)
    'RE': '#FFEB88',      // Residential Estate (brightened)
    'RA': '#FFF0C0',      // Suburban Agriculture (brightened from #F0E0B0)
    'RW': '#FFF0C0',      // Residential Waterways (brightened)
    'R2': '#FFCC5E',      // Two Family (brightened from #FEB24C)
    'RD': '#FFA24D',      // Restricted Density Multiple (brightened from #FD8D3C)
    'R3': '#FFA24D',      // Multiple Dwelling (brightened)
    'R4': '#FF6340',      // Multiple Dwelling (brightened from #FC4E2A)
    'R5': '#FF2A2C',      // Multiple Dwelling (brightened from #E31A1C)
    'RMP': '#FFA24D',     // Mobile Home Park (brightened)
    
    // Commercial - brightened colors
    'CR': '#D0E6F7',      // Limited Commercial (brightened from #BDD7E7)
    'C1': '#D0E6F7',      // Limited Commercial (brightened)
    'C1.5': '#B3DFF1',    // Limited Commercial (brightened from #9ECAE1)
    'C2': '#7FBBE6',      // Commercial (brightened from #6BAED6)
    'C4': '#56A2D6',      // Commercial (brightened from #4292C6)
    'C5': '#3585C5',      // Commercial (brightened from #2171B5)
    'CM': '#1765AC',      // Commercial Manufacturing (brightened from #08519C)
    'CW': '#1745BB',      // Central City West (brightened from #08306B)
    
    // Manufacturing/Industrial - brightened colors
    'M1': '#D0CCED',      // Limited Industrial (brightened from #BCBDDC)
    'MR1': '#D0CCED',     // Restricted Industrial (brightened)
    'M2': '#B3ADD8',      // Light Industrial (brightened from #9E9AC8)
    'MR2': '#B3ADD8',     // Restricted Light Industrial (brightened)
    'M3': '#9591CA',      // Heavy Industrial (brightened from #807DBA)
    'P': '#7E65B3',       // Automobile Parking (brightened from #6A51A3)
    
    // Special - brightened colors
    'PF': '#45B764',      // Public Facilities (brightened from #31A354)
    'OS': '#88D886',      // Open Space (brightened from #74C476)
    'GW': '#CEF4C3',      // Green Water (brightened from #BAE4B3)
    'ADP': '#1A813C',     // Airport Docking Point (brightened from #006D2C)
    
    // Specific Plans & Overlays - brightened colors
    'LASED': '#E8CDEA',   // LA Sports & Entertainment District (brightened from #D4B9DA)
    'WC': '#DDA8D7',      // Warner Center (brightened from #C994C7)
    'USC': '#F379C0',     // University of Southern California (brightened from #DF65B0)
    'CPIO': '#FB3D9A',    // Community Plan Implementation Overlay (brightened from #E7298A)
    'Q': '#E22966'        // Qualified Classification (brightened from #CE1256)
  };

  const getBaseZone = (zoneCode) => {
    if (!zoneCode) return null;
    
    // Remove qualifiers and overlays
    let base = zoneCode
      .replace(/^\[?Q\]?/, '')           // Remove [Q] or Q at start
      .replace(/^\(T\)/, '')             // Remove (T) at start
      .replace(/^\(Q\)/, '')             // Remove (Q) at start
      .replace(/\-.*$/, '')              // Remove everything after first hyphen
      .replace(/\(.*?\)/, '')            // Remove anything in parentheses
      .trim();
    
    // Special handling for combined zones (e.g., CM(GM))
    if (base.includes('(')) {
      base = base.split('(')[0];
    }
    
    return base;
  };

  const getDetailLevel = (zoom) => {
    if (zoom > 15) return 'high';    // Reduced threshold to load high detail earlier
    if (zoom > 12) return 'medium';  // Reduced threshold to load medium detail earlier
    return 'low';
  };

  // Cleanup function to remove event listeners
  const removeEventHandlers = () => {
    if (map?.current && eventHandlersRef.current) {
      const { mousemove, mouseleave, click } = eventHandlersRef.current;
      if (mousemove) map.current.off('mousemove', 'zoning-fill', mousemove);
      if (mouseleave) map.current.off('mouseleave', 'zoning-fill', mouseleave);
      if (click) map.current.off('click', 'zoning-fill', click);
      eventHandlersRef.current = {};
    }
  };

  // Setup event handlers
  const setupEventHandlers = () => {
    if (!map?.current) return;

    let hoveredStateId = null;

    const mousemove = (e) => {
      if (e.features.length > 0) {
        if (hoveredStateId !== null) {
          map.current.setFeatureState(
            { source: 'zoning-data', id: hoveredStateId },
            { hover: false }
          );
        }
        hoveredStateId = e.features[0].id;
        // Only set feature state if we have a valid ID
        if (hoveredStateId !== undefined && hoveredStateId !== null) {
          map.current.setFeatureState(
            { source: 'zoning-data', id: hoveredStateId },
            { hover: true }
          );
        }
      }
    };

    const mouseleave = () => {
      if (hoveredStateId !== null) {
        map.current.setFeatureState(
          { source: 'zoning-data', id: hoveredStateId },
          { hover: false }
        );
        hoveredStateId = null;
      }
    };

    const click = (e) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        const baseZone = getBaseZone(feature.properties.zone_cmplt);
        const fullZone = feature.properties.zone_cmplt;
        
        // Get a human-readable description
        const zoneDescription = {
          'R1': 'Single Family Residential',
          'RS': 'Suburban',
          'RE': 'Residential Estate',
          'R2': 'Two Family Residential',
          'R3': 'Multiple Dwelling',
          'R4': 'Multiple Dwelling',
          'R5': 'Multiple Dwelling',
          'C1': 'Limited Commercial',
          'C2': 'Commercial',
          'M1': 'Limited Industrial',
          'M2': 'Light Industrial',
          'PF': 'Public Facilities',
          'OS': 'Open Space'
        }[baseZone] || 'Special Zone';
        
        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px'
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <h3>Zoning Information</h3>
            <p><strong>Zone Code:</strong> ${fullZone || 'N/A'}</p>
            <p><strong>Type:</strong> ${zoneDescription}</p>
            <p><strong>Area:</strong> ${Math.round(feature.properties.shape_area).toLocaleString()} sq ft</p>
          `)
          .addTo(map.current);
      }
    };

    map.current.on('mousemove', 'zoning-fill', mousemove);
    map.current.on('mouseleave', 'zoning-fill', mouseleave);
    map.current.on('click', 'zoning-fill', click);

    eventHandlersRef.current = { mousemove, mouseleave, click };
  };

  // Add effect to listen for zoom changes
  useEffect(() => {
    if (!map?.current || !visible) return;
    
    const handleZoomEnd = () => {
      const zoom = map.current.getZoom();
      const newDetailLevel = getDetailLevel(zoom);
      
      console.log(`Zoom check: current=${currentDetailLevel.current}, new=${newDetailLevel}, loading=${isLoadingRef.current}`);
      
      if (currentDetailLevel.current !== newDetailLevel && !isLoadingRef.current) {
        console.log(`Zoom level changed to ${zoom}, switching to ${newDetailLevel} detail`);
        
        // Clean up existing layers and reload with new detail level
        isLoadingRef.current = true;
        
        removeEventHandlers();
        if (map.current.getLayer('zoning-hover-glow')) map.current.removeLayer('zoning-hover-glow');
        if (map.current.getLayer('zoning-outer-glow')) map.current.removeLayer('zoning-outer-glow');
        if (map.current.getLayer('zoning-inner-glow')) map.current.removeLayer('zoning-inner-glow');
        if (map.current.getLayer('zoning-outline')) map.current.removeLayer('zoning-outline');
        if (map.current.getLayer('zoning-hover')) map.current.removeLayer('zoning-hover');
        if (map.current.getLayer('zoning-fill')) map.current.removeLayer('zoning-fill');
        if (map.current.getSource('zoning-data')) map.current.removeSource('zoning-data');
        
        sourceRef.current = false;
        layersAddedRef.current = false;
        currentDetailLevel.current = null;
        isLoadingRef.current = false;
        
        // Force the main effect to run again with a small delay
        // This helps prevent race conditions during rapid zoom changes
        setTimeout(() => {
          if (map.current && visible) {
            console.log('Triggering layer reload after zoom change');
            setupLayers();
          }
        }, 50);
      }
    };
    
    map.current.on('zoomend', handleZoomEnd);
    
    return () => {
      if (map?.current) {
        map.current.off('zoomend', handleZoomEnd);
      }
    };
  }, [map, visible]);

  // Extract setupLayers function to the component level so it can be called from multiple places
  const setupLayers = async () => {
    if (!map?.current || isLoadingRef.current) {
      console.log('Setup already in progress or map not ready, skipping...');
      return;
    }

    console.log('Setting up zoning layers, visible:', visible);
    
    try {
      isLoadingRef.current = true;
      
      const zoom = map.current.getZoom();
      console.log(`Current zoom level: ${zoom.toFixed(2)}`);
      const detailLevel = getDetailLevel(zoom);
      console.log(`Selected detail level: ${detailLevel}`);
      
      // Check existing layers
      const sourceExists = map.current.getSource('zoning-data');
      const fillLayerExists = map.current.getLayer('zoning-fill');

      // Just update visibility if layers exist and detail level hasn't changed
      if (fillLayerExists && currentDetailLevel.current === detailLevel) {
        console.log('Layers exist, just updating visibility');
        const visibility = visible ? 'visible' : 'none';
        map.current.setLayoutProperty('zoning-fill', 'visibility', visibility);
        map.current.setLayoutProperty('zoning-outline', 'visibility', visibility);
        map.current.setLayoutProperty('zoning-hover', 'visibility', visibility);
        map.current.setLayoutProperty('zoning-inner-glow', 'visibility', visibility);
        map.current.setLayoutProperty('zoning-outer-glow', 'visibility', visibility);
        map.current.setLayoutProperty('zoning-hover-glow', 'visibility', visibility);
        
        // Dim or restore background layers based on visibility
        if (visible) {
          dimBackgroundLayers();
          bringZoningLayersToFront();
        } else {
          restoreBackgroundLayers();
        }
        
        isLoadingRef.current = false;
        return;
      }

      // If layers exist but detail level changed, we need to reload with new detail level
      if (fillLayerExists && currentDetailLevel.current !== detailLevel) {
        console.log(`Detail level changed from ${currentDetailLevel.current} to ${detailLevel}, reloading layers`);
        removeEventHandlers();
        if (map.current.getLayer('zoning-hover-glow')) map.current.removeLayer('zoning-hover-glow');
        if (map.current.getLayer('zoning-outer-glow')) map.current.removeLayer('zoning-outer-glow');
        if (map.current.getLayer('zoning-inner-glow')) map.current.removeLayer('zoning-inner-glow');
        if (map.current.getLayer('zoning-outline')) map.current.removeLayer('zoning-outline');
        if (map.current.getLayer('zoning-hover')) map.current.removeLayer('zoning-hover');
        if (map.current.getLayer('zoning-fill')) map.current.removeLayer('zoning-fill');
        if (map.current.getSource('zoning-data')) map.current.removeSource('zoning-data');
        
        sourceRef.current = false;
        layersAddedRef.current = false;
        currentDetailLevel.current = null;
      }

      // Clean up existing source if needed
      if (sourceExists && !fillLayerExists) {
        removeEventHandlers();
        map.current.removeSource('zoning-data');
      }

      // Fetch data with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      console.log('Fetching zoning data...');
      const response = await fetch(
        `/optimized_zoning/zoning_${detailLevel}_detail.geojson`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      let data = await response.json();
      console.log(`Loaded ${detailLevel} detail zoning data with ${data.features.length} features`);
      
      // Analyze zone codes in the data
      const zoneAnalysis = data.features.reduce((acc, feature) => {
        const zoneCode = feature.properties.zone_cmplt;
        if (!acc[zoneCode]) {
          acc[zoneCode] = {
            count: 0,
            hasColor: !!zoneColors[zoneCode],
            assignedColor: zoneColors[zoneCode] || '#CCCCCC'
          };
        }
        acc[zoneCode].count++;
        return acc;
      }, {});

      console.log('Zone code analysis:', zoneAnalysis);
      console.log('Zones without color mapping:', 
        Object.entries(zoneAnalysis)
          .filter(([_, info]) => !info.hasColor)
          .map(([code]) => code)
      );

      // Pre-process data to add baseZone property to each feature if not already present
      console.log('Processing features - adding base zone property...');
      
      data.features.forEach(feature => {
        if (feature.properties.zone_cmplt && !feature.properties.baseZone) {
          feature.properties.baseZone = getBaseZone(feature.properties.zone_cmplt);
        }
      });
      
      console.log(`Processed ${data.features.length} features`);

      // Add source and layers
      console.log('Adding source and layers');
      map.current.addSource('zoning-data', {
        type: 'geojson',
        data: data,
        generateId: true,
        maxzoom: 22
      });

      // Add fill layer with enhanced styling
      map.current.addLayer({
        id: 'zoning-fill',
        type: 'fill',
        source: 'zoning-data',
        minzoom: 0, // Ensure visible at all zoom levels
        maxzoom: 22,
        paint: {
          'fill-color': [
            'case',
            ['has', 'zone_cmplt'],
            [
              'match',
              ['string', ['get', 'baseZone']],
              // Map base zones to colors (using brightened colors)
              'R1', '#FFEB88',
              'RS', '#FFEB88',
              'RE', '#FFEB88',
              'RA', '#FFF0C0',
              'RW', '#FFF0C0',
              'R2', '#FFCC5E',
              'RD', '#FFA24D',
              'R3', '#FFA24D',
              'R4', '#FF6340',
              'R5', '#FF2A2C',
              'RMP', '#FFA24D',
              'CR', '#D0E6F7',
              'C1', '#D0E6F7',
              'C1.5', '#B3DFF1',
              'C2', '#7FBBE6',
              'C4', '#56A2D6',
              'C5', '#3585C5',
              'CM', '#1765AC',
              'CW', '#1745BB',
              'M1', '#D0CCED',
              'MR1', '#D0CCED',
              'M2', '#B3ADD8',
              'MR2', '#B3ADD8',
              'M3', '#9591CA',
              'P', '#7E65B3',
              'PF', '#45B764',
              'OS', '#88D886',
              'GW', '#CEF4C3',
              'ADP', '#1A813C',
              // Add special handling for other codes we found
              'A1', '#FFF0C0', // Agricultural (brightened)
              'A2', '#FFF0C0', // Agricultural (brightened)
              'RAS', '#FFF0C0', // Suburban Agriculture (brightened)
              'RZ', '#FFA24D', // Residential Zero lot line (brightened)
              'UV', '#EEEEEE', // Urban Village (brightened from #CCCCCC)
              'UI', '#EEEEEE', // Urban Innovation (brightened from #CCCCCC)
              'NI', '#EEEEEE', // Neighborhood Innovation (brightened from #CCCCCC)
              'HJ', '#EEEEEE', // Hybrid Industrial (brightened from #CCCCCC)
              'MU', '#B3DFF1', // Mixed Use (brightened from #9ECAE1)
              '#EEEEEE' // Default color if no match (brightened from #CCCCCC)
            ],
            '#EEEEEE' // Default color if no zone_cmplt (brightened from #CCCCCC)
          ],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.4,   // Increased from 0.2
            10, 0.6,  // Increased from 0.4
            12, 0.8,  // Increased from 0.6
            14, 0.9,  // Increased from 0.8
            16, 1.0   // Increased from 0.9 to full opacity
          ],
          'fill-antialias': true
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      // Add inner glow effect
      map.current.addLayer({
        id: 'zoning-inner-glow',
        type: 'line',
        source: 'zoning-data',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.5,   // Add visibility at lower zoom levels
            10, 1.5,  
            14, 2.5,  
            16, 3.5   
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.05,   // Subtle at low zoom levels
            10, 0.15,  
            14, 0.2,   
            16, 0.25   
          ],
          'line-blur': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            10, 2,
            14, 3,
            16, 4
          ]
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      // Add main outline with double-line effect
      map.current.addLayer({
        id: 'zoning-outline',
        type: 'line',
        source: 'zoning-data',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'line-color': '#000000',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.5,     // Increased from 0.3
            10, 1.0,    // Increased from 0.75
            12, 1.25,   // Increased from 1.0
            14, 1.5,    // Increased from 1.25
            16, 2.0     // Increased from 1.75
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.15,    // Increased from 0.1
            10, 0.25,   // Increased from 0.2
            14, 0.3,    // Increased from 0.25
            16, 0.35    // Increased from 0.3
          ],
          'line-blur': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.75,    // Reduced from 1.0 for sharper lines
            10, 0.5,
            14, 0.25,
            16, 0.1     // Reduced from 0.25 for sharper lines
          ],
          'line-gap-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.5,     // Increased from 0.3
            10, 1.0,    // Increased from 0.75
            14, 1.5,    // Increased from 1.25
            16, 2.0     // Increased from 1.75
          ]
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      // Add outer glow effect
      map.current.addLayer({
        id: 'zoning-outer-glow',
        type: 'line',
        source: 'zoning-data',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'line-color': [
            'case',
            ['has', 'zone_cmplt'],
            [
              'match',
              ['string', ['get', 'baseZone']],
              // Map base zones to colors (same as fill)
              'R1', '#FFEB88',
              'RS', '#FFEB88',
              'RE', '#FFEB88',
              'RA', '#FFF0C0',
              'RW', '#FFF0C0',
              'R2', '#FFCC5E',
              'RD', '#FFA24D',
              'R3', '#FFA24D',
              'R4', '#FF6340',
              'R5', '#FF2A2C',
              'RMP', '#FFA24D',
              'CR', '#D0E6F7',
              'C1', '#D0E6F7',
              'C1.5', '#B3DFF1',
              'C2', '#7FBBE6',
              'C4', '#56A2D6',
              'C5', '#3585C5',
              'CM', '#1765AC',
              'CW', '#1745BB',
              'M1', '#D0CCED',
              'MR1', '#D0CCED',
              'M2', '#B3ADD8',
              'MR2', '#B3ADD8',
              'M3', '#9591CA',
              'P', '#7E65B3',
              'PF', '#45B764',
              'OS', '#88D886',
              'GW', '#CEF4C3',
              'ADP', '#1A813C',
              '#EEEEEE' // Default color if no match (brightened from #CCCCCC)
            ],
            '#EEEEEE'
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            10, 2,
            14, 4,
            16, 6
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0.02,
            10, 0.05,
            14, 0.1,
            16, 0.15
          ],
          'line-blur': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 2,
            10, 3,
            14, 4,
            16, 5
          ]
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      // Enhanced hover effect with glow
      map.current.addLayer({
        id: 'zoning-hover',
        type: 'fill',
        source: 'zoning-data',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.2,
            0
          ],
          'fill-antialias': true
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      // Add hover outline glow
      map.current.addLayer({
        id: 'zoning-hover-glow',
        type: 'line',
        source: 'zoning-data',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            4,
            0
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            0
          ],
          'line-blur': 2
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });

      sourceRef.current = true;
      currentDetailLevel.current = detailLevel;
      layersAddedRef.current = true;

      // Setup event handlers after layers are added
      setupEventHandlers();
      
      // Dim background layers if zoning is visible
      if (visible) {
        dimBackgroundLayers();
        // Ensure our layers are on top
        bringZoningLayersToFront();
      }
      
      console.log('Finished setting up zoning layers');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Zoning data fetch timed out');
      } else {
        console.error('Error setting up zoning data:', error);
      }
    } finally {
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!map?.current) return;

    setupLayers();

    return () => {
      if (map?.current && sourceRef.current) {
        removeEventHandlers();
        if (map.current.getLayer('zoning-hover-glow')) map.current.removeLayer('zoning-hover-glow');
        if (map.current.getLayer('zoning-outer-glow')) map.current.removeLayer('zoning-outer-glow');
        if (map.current.getLayer('zoning-inner-glow')) map.current.removeLayer('zoning-inner-glow');
        if (map.current.getLayer('zoning-outline')) map.current.removeLayer('zoning-outline');
        if (map.current.getLayer('zoning-hover')) map.current.removeLayer('zoning-hover');
        if (map.current.getLayer('zoning-fill')) map.current.removeLayer('zoning-fill');
        if (map.current.getSource('zoning-data')) map.current.removeSource('zoning-data');
        
        // Restore any dimmed background layers
        restoreBackgroundLayers();
        
        sourceRef.current = false;
        layersAddedRef.current = false;
        currentDetailLevel.current = null;
        isLoadingRef.current = false;
      }
    };
  }, [map, visible]);

  // Add a special useEffect to ensure layers stay on top even if other layers are added later
  useEffect(() => {
    if (!map?.current || !visible || !layersAddedRef.current) return;
    
    // Ensure zoning layers stay on top whenever map style is fully loaded
    const handleStyleData = () => {
      if (visible) {
        bringZoningLayersToFront();
      }
    };
    
    map.current.on('styledata', handleStyleData);
    
    // Directly call once to ensure immediate effect
    bringZoningLayersToFront();
    
    return () => {
      if (map?.current) {
        map.current.off('styledata', handleStyleData);
      }
    };
  }, [map, visible, layersAddedRef.current]);

  return null;
};

export default ZoningLayer; 