import React, { useState, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { generateCircleCoordinates } from '../../../../utils/whitneyMapUtils';
import { WHITNEY_SITES, WHITNEY_ZONES } from '../../../../config/whitneyConfig';
import { resolveCoordinatesForSites } from '../../../../utils/geocodeSites';
import { createWhitneyMarker } from './utils/whitneyMarkers';
import { NC_POWER_SITES } from '../../../../config/ncPowerSites';
import { loadPowerConnectionData, analyzeSiteConnections } from '../../utils/powerConnectionsVisualization';

const OSMCallCached = ({ 
  onClick, 
  title = "Liberty Infrastructure Analysis",
  color = "#059669",
  size = "10px",
  position = { top: '-25px', left: 'calc(98% + 20px)' },
  aiState = null,
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null,
  locationKey = 'default'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState(null);

  // Load cached data from public folder - location-aware
  const loadCachedData = useCallback(async () => {
    try {
      // Find the site configuration based on locationKey
      const siteConfig = NC_POWER_SITES.find(site => site.key === locationKey);
      
      // Determine cache file path
      let cachePath;
      let siteName;
      
      if (siteConfig && locationKey !== 'default') {
        // Use location-specific cache
        cachePath = siteConfig.dataPath;
        siteName = siteConfig.name;
        console.log(`📁 Loading ${siteName} cached data from ${cachePath}...`);
      } else {
        // Fall back to Whitney/Liberty cache
        cachePath = '/whitney-cache.json';
        siteName = 'Liberty';
        console.log('📁 Loading Liberty cached data from public folder...');
      }
      
      const response = await fetch(cachePath);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ ${siteName} cached data loaded successfully`);
      console.log(`📊 Loaded ${data.features?.length || 0} features`);
      
      setCachedData(data);
      return data;
    } catch (error) {
      console.error(`❌ Failed to load cached data for ${locationKey}:`, error);
      return null;
    }
  }, [locationKey]);
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);


  // Function to add PA infrastructure to map with sequence animation
  const addPAInfrastructureToMap = async (features, marker) => {
      console.log('🎯 [OSMCallCached] Starting PA infrastructure mounting', {
        totalFeatures: features.length,
        hasMap: !!map?.current
      });
    
    try {
      if (features.length === 0) {
        console.log('⚠️ No PA infrastructure features found');
        return;
      }
      
      if (!map?.current) {
        console.error('❌ [addPAInfrastructureToMap] Map is not available!');
        return;
      }
      
      // Remove any existing OSM layers and sources
      const layersToRemove = [
        'osm-features-fill',
        'osm-features-lines', 
        'osm-pois',
        'osm-highway-junctions',
        'osm-transmission-lines',
        'osm-substations',
        'osm-power-facilities',
        'osm-water-lines',
        'osm-water-fill',
        'osm-water-points',
        'osm-labels'
      ];
      
      // Remove PA zone circles
      const allPASites = NC_POWER_SITES.filter(site => 
        site.key === 'three_mile_island_pa' || site.key === 'susquehanna_nuclear_pa'
      );
      allPASites.forEach((paSite) => {
        const siteKey = paSite.key;
        const circleLayerId = `pa-zone-${siteKey}-circle`;
        const fillLayerId = `pa-zone-${siteKey}-fill`;
        const sourceId = `pa-zone-${siteKey}-source`;
        
        if (map.current.getLayer(circleLayerId)) {
          map.current.removeLayer(circleLayerId);
        }
        if (map.current.getLayer(fillLayerId)) {
          map.current.removeLayer(fillLayerId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      layersToRemove.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      // Remove sources after layers are removed
      if (map.current.getSource('osm-features')) {
        map.current.removeSource('osm-features');
      }
      
      // Deduplicate features with same name at same location before adding to map
      // This prevents duplicate labels from appearing
      const nameLocationMap = new Map();
      const deduplicatedFeatures = [];
      
      features.forEach(f => {
        const name = f.properties?.name;
        if (!name || name === '' || name === 'Unnamed') {
          // Keep features without names (they won't have labels anyway)
          deduplicatedFeatures.push(f);
          return;
        }
        
        // Only deduplicate features that will have labels (power/water with names)
        const isLabelable = 
          (f.properties?.category === 'power' && (f.geometry?.type === 'Point' || f.geometry?.type === 'Polygon')) ||
          ((f.properties?.category === 'water' || f.properties?.category === 'waterway') && f.geometry?.type === 'Point');
        
        if (!isLabelable) {
          // Keep non-labelable features
          deduplicatedFeatures.push(f);
          return;
        }
        
        // Extract coordinates for location key
        let coords;
        if (f.geometry?.type === 'Point') {
          coords = f.geometry.coordinates;
        } else if (f.geometry?.type === 'Polygon') {
          // Use first coordinate of first ring as representative point
          coords = f.geometry.coordinates[0]?.[0];
        }
        
        if (!coords || !Array.isArray(coords) || coords.length < 2) {
          deduplicatedFeatures.push(f);
          return;
        }
        
        // Round coordinates to ~10m precision to group nearby duplicates
        const roundedLng = Math.round(coords[0] * 10000) / 10000;
        const roundedLat = Math.round(coords[1] * 10000) / 10000;
        const locationKey = `${name}|${roundedLng},${roundedLat}`;
        
        // Prefer Point over Polygon, and keep first occurrence
        if (!nameLocationMap.has(locationKey)) {
          nameLocationMap.set(locationKey, f);
          deduplicatedFeatures.push(f);
        } else {
          const existing = nameLocationMap.get(locationKey);
          // Replace if current is Point and existing is Polygon
          if (f.geometry?.type === 'Point' && existing.geometry?.type === 'Polygon') {
            // Remove the old Polygon feature and add the Point
            const existingIndex = deduplicatedFeatures.findIndex(feat => feat === existing);
            if (existingIndex !== -1) {
              deduplicatedFeatures[existingIndex] = f;
            }
            nameLocationMap.set(locationKey, f);
          }
          // Otherwise, skip this duplicate
        }
      });
      
      console.log('🔍 [OSMCallCached] Deduplicated features for labels', {
        originalCount: features.length,
        deduplicatedCount: deduplicatedFeatures.length,
        duplicatesRemoved: features.length - deduplicatedFeatures.length
      });
      
      // Add Liberty infrastructure features to the map
      const whitneyGeoJSON = {
        type: 'FeatureCollection',
        features: deduplicatedFeatures
      };
      
      // Check if source already exists before adding
      if (!map.current.getSource('osm-features')) {
        map.current.addSource('osm-features', {
          type: 'geojson',
          data: whitneyGeoJSON
        });
      } else {
        // Update existing source data
        map.current.getSource('osm-features').setData(whitneyGeoJSON);
      }

      // Phase 1: Animate infrastructure layers in sequence (fast sequential loading)
      console.log('🎬 [OSMCallCached] Starting infrastructure layers animation sequence...');
      
      // 1. Lines layer (0ms delay - first)
      setTimeout(() => {
        if (!map.current.getLayer('osm-features-lines')) {
          map.current.addLayer({
            id: 'osm-features-lines',
            type: 'line',
            source: 'osm-features',
            filter: ['all',
              // Exclude water features (they have their own layer)
              ['!=', ['get', 'category'], 'waterway'],
              ['!=', ['get', 'category'], 'water'],
              ['!=', ['get', 'category'], 'water_body'],
              // Exclude power lines (they have their own layer)
              ['!=', ['get', 'category'], 'power']
            ],
            paint: {
              'line-color': [
                'case',
                // Buildings and other infrastructure (power/water excluded - they have their own layers)
                ['==', ['get', 'category'], 'office_building'], '#059669',
                ['==', ['get', 'category'], 'commercial_building'], '#0ea5e9',
                ['==', ['get', 'category'], 'retail_building'], '#3b82f6',
                ['==', ['get', 'category'], 'government_facility'], '#dc2626',
                ['==', ['get', 'category'], 'education'], '#7c3aed',
                ['==', ['get', 'category'], 'healthcare'], '#ef4444',
                ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
                ['==', ['get', 'category'], 'transit_hub'], '#10b981',
                ['==', ['get', 'category'], 'highway_access'], '#6b7280',
                ['==', ['get', 'category'], 'recreation_area'], '#22c55e',
                ['==', ['get', 'category'], 'industrial'], '#8b5cf6',
                '#6b7280'
              ],
              'line-width': [
                'case',
                // General infrastructure lines (power/water excluded)
                ['==', ['get', 'priority'], 3], 3,
                ['==', ['get', 'priority'], 2], 2,
                1
              ],
              'line-opacity': 0
            }
          });
          
          // Animate line opacity
          let lineOpacity = 0;
          const lineAnimation = () => {
            lineOpacity += 0.05;
            if (lineOpacity <= 0.8) {
              map.current.setPaintProperty('osm-features-lines', 'line-opacity', lineOpacity);
              requestAnimationFrame(lineAnimation);
            }
          };
          requestAnimationFrame(lineAnimation);
        }
      }, 0); // Lines layer: 0ms delay (first)

      // 2. Fill layer (50ms delay)
      setTimeout(() => {
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
                ['==', ['get', 'category'], 'emergency_services'], 'rgba(220, 38, 38, 0.2)',
                ['==', ['get', 'category'], 'recreation_area'], 'rgba(34, 197, 94, 0.2)',
                ['==', ['get', 'category'], 'industrial'], 'rgba(139, 92, 246, 0.2)',
                'rgba(107, 114, 128, 0.05)'
              ],
              'fill-opacity': 0
            }
          });
          
          // Animate fill opacity
          let fillOpacity = 0;
          const fillAnimation = () => {
            fillOpacity += 0.05;
            if (fillOpacity <= 0.3) {
              map.current.setPaintProperty('osm-features-fill', 'fill-opacity', fillOpacity);
              requestAnimationFrame(fillAnimation);
            }
          };
          requestAnimationFrame(fillAnimation);
        }
      }, 50); // Fill layer: 50ms delay

      // 3. POI markers (100ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-pois')) {
          map.current.addLayer({
            id: 'osm-pois',
            type: 'circle',
            source: 'osm-features',
            filter: ['all',
              ['==', ['geometry-type'], 'Point'],
              // Only show POIs with specific categories (hide generic uncategorized points)
              ['has', 'category'],
              ['!=', ['get', 'category'], ''] // Exclude empty category strings
            ],
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'priority'], 3], 8,
                ['==', ['get', 'priority'], 2], 6,
                4
              ],
              'circle-color': [
                'case',
                // Power infrastructure (PA-specific) - Orange colors to match power lines
                // PA OSM data uses category: "power" with subcategory for type
                ['all', ['==', ['get', 'category'], 'power'], ['has', 'subcategory']], '#f97316', // Orange for power features
                ['==', ['get', 'category'], 'substation'], '#f97316', // Orange for substations (fallback)
                ['==', ['get', 'category'], 'power_substation'], '#f97316', // Orange for power substations (fallback)
                ['==', ['get', 'category'], 'power_facility'], '#fb923c', // Lighter orange for power facilities (fallback)
                // Other facilities
                ['==', ['get', 'category'], 'government_facility'], '#dc2626',
                ['==', ['get', 'category'], 'education'], '#7c3aed',
                ['==', ['get', 'category'], 'healthcare'], '#ef4444',
                ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
                ['==', ['get', 'category'], 'transit_hub'], '#10b981',
                // Gray markers - 70% smaller radius applied above
                'rgba(107, 114, 128, 0.3)' // Very subtle gray for uncategorized POIs
              ],
              'circle-radius': [
                'case',
                // Power infrastructure - larger circles
                ['==', ['get', 'category'], 'substation'], 10,
                ['==', ['get', 'category'], 'power_substation'], 10,
                ['==', ['get', 'category'], 'power_facility'], 8,
                ['==', ['get', 'priority'], 3], 2.4, // 70% smaller: 8 * 0.3 = 2.4
                ['==', ['get', 'priority'], 2], 1.8, // 70% smaller: 6 * 0.3 = 1.8
                1.2 // 70% smaller: 4 * 0.3 = 1.2
              ],
              'circle-opacity': 0
            }
          });
          
          // Animate POI opacity
          let poiOpacity = 0;
          const poiAnimation = () => {
            poiOpacity += 0.1;
            if (poiOpacity <= 1) {
              map.current.setPaintProperty('osm-pois', 'circle-opacity', poiOpacity);
              requestAnimationFrame(poiAnimation);
            }
          };
          requestAnimationFrame(poiAnimation);
        }
      }, 100); // POI markers: 100ms delay

      // 4. Highway junctions (150ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-highway-junctions')) {
          map.current.addLayer({
            id: 'osm-highway-junctions',
            type: 'circle',
            source: 'osm-features',
            filter: ['==', ['get', 'category'], 'highway_junction'],
            paint: {
              'circle-radius': 8,
              'circle-color': '#dc2626',
              'circle-opacity': 0
            }
          });
          
          // Animate junction opacity
          let junctionOpacity = 0;
          const junctionAnimation = () => {
            junctionOpacity += 0.1;
            if (junctionOpacity <= 1) {
              map.current.setPaintProperty('osm-highway-junctions', 'circle-opacity', junctionOpacity);
              requestAnimationFrame(junctionAnimation);
            }
          };
          requestAnimationFrame(junctionAnimation);
        }
      }, 150); // Highway junctions: 150ms delay
      
      // 5. Transmission lines layer (200ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-transmission-lines')) {
            map.current.addLayer({
            id: 'osm-transmission-lines',
              type: 'line',
            source: 'osm-features',
            filter: ['all',
              ['==', ['get', 'category'], 'power'],
              ['==', ['geometry-type'], 'LineString']
            ],
              paint: {
              'line-color': '#ff6b00', // Brighter orange (#f97316 -> #ff6b00)
              'line-width': 5, // Slightly thicker for visibility
              'line-opacity': 0,
              // Pulse halo effect using line-blur and multiple layers
              'line-blur': 3,
              'line-gap-width': 0
              }
            });
            
          // Animate transmission line opacity with pulse effect
          let transmissionOpacity = 0;
          let pulsePhase = 0;
          const transmissionAnimation = () => {
            transmissionOpacity += 0.05;
            if (transmissionOpacity <= 0.9) {
              map.current.setPaintProperty('osm-transmission-lines', 'line-opacity', transmissionOpacity);
              requestAnimationFrame(transmissionAnimation);
            } else {
              // Start pulse animation after initial fade-in
              const pulseAnimation = () => {
                pulsePhase += 0.1;
                const pulseIntensity = 0.3 + (Math.sin(pulsePhase) * 0.2); // Pulse between 0.3 and 0.5
                map.current.setPaintProperty('osm-transmission-lines', 'line-blur', 3 + (Math.sin(pulsePhase) * 2)); // Pulse blur between 3 and 5
                map.current.setPaintProperty('osm-transmission-lines', 'line-width', 5 + (Math.sin(pulsePhase) * 1)); // Pulse width between 5 and 6
                requestAnimationFrame(pulseAnimation);
              };
              requestAnimationFrame(pulseAnimation);
            }
          };
          requestAnimationFrame(transmissionAnimation);
        }
      }, 200); // Transmission lines: 200ms delay
      
      // 6. Substations layer (250ms delay)
      setTimeout(() => {
        if (!map.current.getLayer('osm-substations')) {
            map.current.addLayer({
            id: 'osm-substations',
            type: 'circle',
            source: 'osm-features',
            filter: ['all',
              ['==', ['get', 'category'], 'power'],
              ['in', ['get', 'geometry-type'], ['literal', ['Point', 'Polygon']]]
            ],
              paint: {
              'circle-radius': 12, // Slightly larger for visibility
              'circle-color': '#ff6b00', // Brighter orange to match power lines
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0,
              // Pulse halo effect
              'circle-blur': 4,
              'circle-stroke-opacity': 1
            }
          });
          
          // Animate substation opacity with pulse effect
          let substationOpacity = 0;
          let substationPulsePhase = 0;
          const substationAnimation = () => {
            substationOpacity += 0.1;
            if (substationOpacity <= 1) {
              map.current.setPaintProperty('osm-substations', 'circle-opacity', substationOpacity);
              requestAnimationFrame(substationAnimation);
            } else {
              // Start pulse animation after initial fade-in
              const pulseAnimation = () => {
                substationPulsePhase += 0.1;
                map.current.setPaintProperty('osm-substations', 'circle-blur', 4 + (Math.sin(substationPulsePhase) * 3)); // Pulse blur between 4 and 7
                map.current.setPaintProperty('osm-substations', 'circle-radius', 12 + (Math.sin(substationPulsePhase) * 2)); // Pulse radius between 12 and 14
                requestAnimationFrame(pulseAnimation);
              };
              requestAnimationFrame(pulseAnimation);
            }
          };
          requestAnimationFrame(substationAnimation);
        }
      }, 250); // Substations: 250ms delay
      
      // 7. Water features layer (300ms delay)
      setTimeout(() => {
        // Water lines (rivers, streams) - only LineString geometry
        if (!map.current.getLayer('osm-water-lines')) {
          map.current.addLayer({
            id: 'osm-water-lines',
            type: 'line',
            source: 'osm-features',
            filter: ['all',
              ['==', ['geometry-type'], 'LineString'],
              ['any',
              ['==', ['get', 'category'], 'waterway'],
              ['==', ['get', 'category'], 'water']
              ]
            ],
            paint: {
              'line-color': '#3b82f6', // Blue for water lines (clearer blue)
              'line-width': 3, // Slightly thicker for visibility
              'line-opacity': 0
            }
          });
          
          // Animate water line opacity to 70%
          let waterLineOpacity = 0;
          const waterLineAnimation = () => {
            waterLineOpacity += 0.05;
            if (waterLineOpacity < 0.7) {
              map.current.setPaintProperty('osm-water-lines', 'line-opacity', waterLineOpacity);
              requestAnimationFrame(waterLineAnimation);
            } else {
              // Ensure it reaches exactly 0.7
              map.current.setPaintProperty('osm-water-lines', 'line-opacity', 0.7);
            }
          };
          requestAnimationFrame(waterLineAnimation);
        }
        
        // Water polygons (lakes, reservoirs, treatment plants) - outline only
        if (!map.current.getLayer('osm-water-fill')) {
          map.current.addLayer({
            id: 'osm-water-fill',
            type: 'line', // Outline only for water bodies
            source: 'osm-features',
            filter: ['all',
              ['==', ['geometry-type'], 'Polygon'],
              ['any',
              ['==', ['get', 'category'], 'water_body'],
              ['==', ['get', 'category'], 'water']
              ]
            ],
            paint: {
              'line-color': '#3b82f6', // Blue outline for water bodies
              'line-width': 2,
              'line-opacity': 0 // Will be animated
            }
          });
          
          // Animate water outline opacity to 70% (no fill, just outline)
          let waterOutlineOpacity = 0;
          const waterOutlineAnimation = () => {
            waterOutlineOpacity += 0.05;
            if (waterOutlineOpacity < 0.7) {
              map.current.setPaintProperty('osm-water-fill', 'line-opacity', waterOutlineOpacity);
              requestAnimationFrame(waterOutlineAnimation);
            } else {
              // Ensure it reaches exactly 0.7
              map.current.setPaintProperty('osm-water-fill', 'line-opacity', 0.7);
            }
          };
          requestAnimationFrame(waterOutlineAnimation);
        }
        
        // Water Point markers (treatment plants, water works)
        if (!map.current.getLayer('osm-water-points')) {
          map.current.addLayer({
            id: 'osm-water-points',
            type: 'circle',
            source: 'osm-features',
            filter: ['all',
              ['==', ['geometry-type'], 'Point'],
              ['any',
                ['==', ['get', 'category'], 'water'],
                ['==', ['get', 'category'], 'waterway']
              ]
            ],
            paint: {
              'circle-radius': 8,
              'circle-color': '#3b82f6', // Blue for water points
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0
            }
          });
          
          // Animate water point opacity to 70%
          let waterPointOpacity = 0;
          const waterPointAnimation = () => {
            waterPointOpacity += 0.1;
            if (waterPointOpacity < 0.7) {
              map.current.setPaintProperty('osm-water-points', 'circle-opacity', waterPointOpacity);
              requestAnimationFrame(waterPointAnimation);
            } else {
              // Ensure it reaches exactly 0.7
              map.current.setPaintProperty('osm-water-points', 'circle-opacity', 0.7);
            }
          };
          requestAnimationFrame(waterPointAnimation);
        }
      }, 300); // Water features: 300ms delay
      
      // 8. OSM Labels layer (400ms delay - LAST) - Text labels for Power and Water nodes
      setTimeout(() => {
        if (!map.current.getLayer('osm-labels')) {
          // Verify source exists and has data
          const source = map.current.getSource('osm-features');
          if (!source) {
            console.warn('⚠️ [OSMCallCached] osm-features source not found, retrying labels layer in 500ms');
            setTimeout(() => {
              if (!map.current.getLayer('osm-labels') && map.current.getSource('osm-features')) {
                // Retry adding labels layer
                const retrySource = map.current.getSource('osm-features');
                if (retrySource && retrySource._data && retrySource._data.features) {
                  console.log('🔄 [OSMCallCached] Retrying labels layer creation');
                  // Will be handled by the retry logic below
                }
              }
            }, 500);
            return;
          }
          
          // Count features that will have labels before creating the layer
          // Check for duplicates: same name at same/similar location
          const labelableFeatures = features.filter(f => {
            const hasName = f.properties?.name && 
            f.properties.name !== '' &&
                           f.properties.name !== 'Unnamed';
            if (!hasName) return false;
            
            // Power: prefer Point over Polygon to avoid duplicates
            if (f.properties?.category === 'power') {
              return f.geometry?.type === 'Point' || f.geometry?.type === 'Polygon';
            }
            
            // Water: only Point features
            if (f.properties?.category === 'water' || f.properties?.category === 'waterway') {
              return f.geometry?.type === 'Point';
            }
            
            return false;
          });
          
          // Deduplicate: group by name and coordinates, keep only one per location
          const nameLocationMap = new Map();
          labelableFeatures.forEach(f => {
            const name = f.properties.name;
            let coords;
            
            if (f.geometry?.type === 'Point') {
              coords = f.geometry.coordinates;
            } else if (f.geometry?.type === 'Polygon') {
              // Use first coordinate of first ring as representative point
              coords = f.geometry.coordinates[0]?.[0];
            }
            
            if (!coords || !Array.isArray(coords) || coords.length < 2) return;
            
            // Round coordinates to ~10m precision to group nearby duplicates
            const roundedLng = Math.round(coords[0] * 10000) / 10000;
            const roundedLat = Math.round(coords[1] * 10000) / 10000;
            const locationKey = `${name}|${roundedLng},${roundedLat}`;
            
            // Prefer Point over Polygon, and prefer first occurrence
            if (!nameLocationMap.has(locationKey)) {
              nameLocationMap.set(locationKey, f);
            } else {
              const existing = nameLocationMap.get(locationKey);
              // Replace if current is Point and existing is Polygon
              if (f.geometry?.type === 'Point' && existing.geometry?.type === 'Polygon') {
                nameLocationMap.set(locationKey, f);
              }
            }
          });
          
          const deduplicatedFeatures = Array.from(nameLocationMap.values());
          const powerNodesWithNames = deduplicatedFeatures.filter(f => 
            f.properties?.category === 'power'
          );
          const waterNodesWithNames = deduplicatedFeatures.filter(f => 
            f.properties?.category === 'water' || f.properties?.category === 'waterway'
          );
          
          console.log('🏷️ [OSMCallCached] Creating OSM text labels layer', {
            totalLabelableFeatures: labelableFeatures.length,
            deduplicatedFeatures: deduplicatedFeatures.length,
            duplicatesRemoved: labelableFeatures.length - deduplicatedFeatures.length,
            powerNodesWithNames: powerNodesWithNames.length,
            waterNodesWithNames: waterNodesWithNames.length,
            samplePowerNames: powerNodesWithNames.slice(0, 5).map(f => ({
              name: f.properties.name,
              type: f.geometry?.type
            })),
            sampleWaterNames: waterNodesWithNames.slice(0, 3).map(f => f.properties.name),
            sourceReady: !!source,
            sourceHasData: !!(source && source._data && source._data.features)
          });
          
          // Check if source has data (source already declared above)
          if (source && source._data && source._data.features) {
            const sourceFeatures = source._data.features;
            const featuresWithNames = sourceFeatures.filter(f => 
              f.properties?.name && 
              f.properties.name !== '' && 
              f.properties.name !== 'Unnamed'
            );
            console.log('🔍 [OSMCallCached] Source data check for labels', {
              totalSourceFeatures: sourceFeatures.length,
              featuresWithNames: featuresWithNames.length,
              sampleNames: featuresWithNames.slice(0, 5).map(f => ({
                name: f.properties.name,
                category: f.properties.category,
                geometryType: f.geometry?.type
              }))
            });
          }
          
          map.current.addLayer({
            id: 'osm-labels',
            type: 'symbol',
            source: 'osm-features',
            filter: ['all',
              // Only show labels for features that have names
              ['has', 'name'],
              ['!=', ['get', 'name'], ''],
              ['!=', ['get', 'name'], 'Unnamed'],
              // Show labels for Power nodes (substations, power facilities) and Water nodes
              // STRATEGY: Prefer Point features to avoid duplicates when both Point and Polygon exist
              ['any',
                // Power nodes: prefer Point, but allow Polygon if no Point exists
                // Use symbol-sort-key to prioritize Point (lower number = higher priority)
                ['all',
                  ['==', ['get', 'category'], 'power'],
                  ['in', ['geometry-type'], ['literal', ['Point', 'Polygon']]]
                ],
                // Water nodes: only Point geometry
                ['all',
                  ['in', ['get', 'category'], ['literal', ['water', 'waterway']]],
                  ['==', ['geometry-type'], 'Point']
                ]
              ]
            ],
            layout: {
              'text-field': [
                'coalesce',
                ['get', 'name'],
                ''  // Fallback to empty string if name is null/undefined
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 11,  // Smaller at low zoom
                12, 13,  // Medium at mid zoom
                14, 15,  // Larger at high zoom
                16, 17   // Largest at very high zoom
              ],
              'text-anchor': 'bottom',
              'text-offset': [0, -2.5],  // Position above marker
              // Enable collision detection to prevent overlapping labels
              'text-allow-overlap': false,  // Let Mapbox handle label placement
              'text-ignore-placement': false,  // Respect other labels
              'text-optional': true,  // Allow labels to be hidden if they collide
              // Prioritize Point features over Polygon (lower number = higher priority)
              'symbol-sort-key': [
                'case',
                ['==', ['geometry-type'], 'Point'], 0,  // Point features get priority
                ['==', ['geometry-type'], 'Polygon'], 1,  // Polygon features lower priority
                2  // Fallback
              ]
            },
            paint: {
              'text-color': '#ffffff',  // White text
              'text-halo-color': '#000000',  // Black halo for contrast
              'text-halo-width': 2.5,  // Halo width for visibility
              'text-halo-blur': 1,  // Slight blur for smooth halo
              'text-opacity': 0  // Start invisible, will animate in
            }
          });
          
          // Verify layer was added successfully
          const addedLayer = map.current.getLayer('osm-labels');
          if (!addedLayer) {
            console.error('❌ [OSMCallCached] Failed to add osm-labels layer');
            return;
          }
          
          console.log('✅ [OSMCallCached] osm-labels layer added successfully', {
            layerId: 'osm-labels',
            sourceId: 'osm-features',
            hasSource: !!map.current.getSource('osm-features')
          });
          
          // Animate label opacity fade-in (faster animation for quicker visibility)
          let labelOpacity = 0;
          const labelAnimation = () => {
            labelOpacity += 0.15; // Increased from 0.05 to 0.15 for 3x faster animation
            if (labelOpacity <= 1) {
              map.current.setPaintProperty('osm-labels', 'text-opacity', labelOpacity);
              requestAnimationFrame(labelAnimation);
        } else {
              console.log('✅ [OSMCallCached] OSM text labels fully visible', {
                totalLabels: deduplicatedFeatures.length,
                opacity: labelOpacity
              });
            }
          };
          requestAnimationFrame(labelAnimation);
          
          console.log('✅ [OSMCallCached] OSM labels layer created and animating in');
        }
      }, 400); // Labels layer: 400ms delay (LAST layer before popup)
      
      // 9. Add circular zone outlines for both PA sites (350ms delay - after water, before labels)
      setTimeout(() => {
        const allPASites = NC_POWER_SITES.filter(site => 
          site.key === 'three_mile_island_pa' || site.key === 'susquehanna_nuclear_pa'
        );
        
        allPASites.forEach((paSite) => {
          const siteKey = paSite.key;
          const isSelected = siteKey === locationKey;
          const lat = paSite.coordinates?.lat;
          const lng = paSite.coordinates?.lng;
          const radiusKm = (paSite.radiusMeters || 25000) / 1000; // Convert meters to km
          
          if (!lat || !lng) return;
          
          // Create circle using turf
          const circle = turf.circle([lng, lat], radiusKm, {
            units: 'kilometers',
            steps: 64
          });
          
          const sourceId = `pa-zone-${siteKey}-source`;
          const circleLayerId = `pa-zone-${siteKey}-circle`;
          const fillLayerId = `pa-zone-${siteKey}-fill`;
          
          // Remove existing layers
          if (map.current.getLayer(circleLayerId)) {
            map.current.removeLayer(circleLayerId);
          }
          if (map.current.getLayer(fillLayerId)) {
            map.current.removeLayer(fillLayerId);
          }
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
          
          // Add source
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: circle
          });
          
          // Add fill layer (subtle background)
          map.current.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': isSelected ? 'rgba(220, 38, 38, 0.05)' : 'rgba(249, 115, 22, 0.05)',
              'fill-opacity': 0.1
            }
          });
          
          // Add dashed circle outline
          map.current.addLayer({
            id: circleLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': isSelected ? '#dc2626' : '#f97316',
              'line-width': isSelected ? 3 : 2,
              'line-dasharray': [2, 2],
              'line-opacity': isSelected ? 0.8 : 0.6
            }
          });
          
        });
      }, 350); // Circular zone outlines: 350ms delay (after water, before labels)
      
      // Emit analysis complete event for legend (includes features from both PA sites)
      if (window.mapEventBus) {
        window.mapEventBus.emit('pa:analysisComplete', {
          features: features,
          siteKey: 'both_pa_sites', // Indicates features from both Three Mile Island and Susquehanna
          summary: {
            office_building: features.filter(f => f.properties.category === 'office_building').length,
            commercial_building: features.filter(f => f.properties.category === 'commercial_building').length,
            retail_building: features.filter(f => f.properties.category === 'retail_building').length,
            government_facility: features.filter(f => f.properties.category === 'government_facility').length,
            education: features.filter(f => f.properties.category === 'education').length,
            healthcare: features.filter(f => f.properties.category === 'healthcare').length,
            industrial: features.filter(f => f.properties.category === 'industrial').length,
            // Power infrastructure - PA OSM uses category: "power"
            // Count all power LineString features as power lines
            power_line: features.filter(f => 
              f.properties?.category === 'power' && 
              f.geometry?.type === 'LineString'
            ).length,
            // Transmission lines are a subset of power lines (can distinguish by subcategory if needed)
            transmission_line: features.filter(f => 
              f.properties?.category === 'power' && 
              f.geometry?.type === 'LineString' &&
              (f.properties?.subcategory?.includes('power:line') || 
               f.properties?.tags?.power === 'line' ||
               f.properties?.subcategory?.includes('route:power'))
            ).length,
            // Substations are power features with Point or Polygon geometry
            substation: features.filter(f => 
              f.properties?.category === 'power' && 
              (f.geometry?.type === 'Point' || f.geometry?.type === 'Polygon') &&
              (f.properties?.subcategory?.includes('substation') || 
               f.properties?.tags?.power === 'substation' ||
               f.properties?.tags?.substation)
            ).length,
            power_substation: features.filter(f => 
              f.properties?.category === 'power' && 
              (f.geometry?.type === 'Point' || f.geometry?.type === 'Polygon')
            ).length,
            power_facility: features.filter(f => 
              f.properties?.category === 'power' && 
              f.geometry?.type === 'Point'
            ).length,
            // Water infrastructure - separate counts
            water: features.filter(f => f.properties.category === 'water').length,
            waterway: features.filter(f => f.properties.category === 'waterway').length,
            water_body: features.filter(f => f.properties.category === 'water_body').length
          },
          totalFeatures: features.length,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('❌ Error adding Whitney infrastructure to map:', error);
      throw error;
    }
  };

  const handleClick = async (event) => {
    console.log('🟢 [OSMCallCached] OSM button clicked', { 
      locationKey,
      hasCachedData: !!cachedData,
      timestamp: new Date().toISOString()
    });
    
    if (isLoading || !cachedData) {
      return;
    }
    
    // ONLY allow PA sites to mount the map
    const PA_SITES = ['three_mile_island_pa', 'susquehanna_nuclear_pa'];
    if (!PA_SITES.includes(locationKey)) {
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: '⚠️ OSM analysis only available for Pennsylvania sites',
          progress: 0,
          details: 'Please select Three Mile Island or Susquehanna from the location selector'
        });
        setTimeout(() => {
          updateToolFeedback({ isActive: false, tool: null, status: '', progress: 0, details: '' });
        }, 3000);
      }
      return;
    }
    
    // Get site-specific info from config (defined here so it's available in all scopes)
    const siteConfig = NC_POWER_SITES.find(site => site.key === locationKey);
    const city = siteConfig?.shortName || 'Site';
    const state = locationKey.includes('_pa') ? 'PA' : 'NC';
    
    // Clear previous OSM data from legend
    if (window.mapEventBus) {
      window.mapEventBus.emit('osm:dataCleared');
      window.mapEventBus.emit('liberty:analysisCleared');
      window.mapEventBus.emit('osm:loading');
    }

    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    try {
      
      // Start PA site analysis feedback
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: `🚀 Starting ${siteConfig?.name || city} infrastructure analysis...`,
          progress: 10,
          details: `Loading cached data for ${city}, ${state}`
        });
      }
      
      // Call the original onClick if provided
      if (onClick) {
        onClick(`${siteConfig?.name || city} Infrastructure Analysis`);
      }
      
      // Only toggle these layers for PA sites (skip for other locations)
      if (locationKey.includes('_pa') && window.mapEventBus) {
        // PA-specific layer toggles can be added here if needed
        // For now, we skip the NC-specific layers
      }
      
      // Phase 1: Create markers for BOTH PA sites
      console.log('🗺️ [OSMCallCached] Checking map availability:', { 
        hasMap: !!map?.current, 
        mapReady: map?.current?.isStyleLoaded?.() 
      });
      
      if (map?.current) {
        try {
          // Get both PA site configs
          const allPASites = NC_POWER_SITES.filter(site => 
            site.key === 'three_mile_island_pa' || site.key === 'susquehanna_nuclear_pa'
          );
          
          console.log('📍 [OSMCallCached] Mounting OSM data for PA sites:', allPASites.map(s => s.key));
          
          // Remove any existing PA site markers and popups
          if (typeof window !== 'undefined') {
            if (window.paSiteMarkers) {
              Object.values(window.paSiteMarkers).forEach(m => { 
                try { m.remove(); } catch(e) {} 
              });
            }
            if (window.paSitePopups) {
              Object.values(window.paSitePopups).forEach(p => { 
                try { p.remove(); } catch(e) {} 
              });
            }
            window.paSiteMarkers = {};
            window.paSitePopups = {};
          }
          
          // Create markers for both PA sites
          allPASites.forEach((paSite, index) => {
            const isSelected = paSite.key === locationKey;
            const lat = paSite.coordinates?.lat;
            const lng = paSite.coordinates?.lng;
            
            if (!lat || !lng) return;
            
            // Create marker with different color for selected vs unselected
            const marker = new mapboxgl.Marker({ 
              color: isSelected ? '#dc2626' : '#f97316', // Red for selected, orange for other
              scale: isSelected ? 1.4 : 1.0, // Larger for selected site
                anchor: 'center'
              })
              .setLngLat([lng, lat])
                .addTo(map.current);
              
            // Create auto popup card above the marker
            const markerColor = isSelected ? '#dc2626' : '#f97316';
            // Use full site name
            const fullName = paSite.name || 'PA Nuclear Site';
            
            // Determine site-specific colors for halo effect
            const isThreeMileIsland = paSite.key === 'three_mile_island_pa';
            const pulseColorRgb = isThreeMileIsland ? '34, 197, 94' : '220, 38, 38'; // Green RGB for MSFT, Red RGB for AMZN
            
            // Create unique animation name for this color
            const animationName = `paPopupHaloPulse_${paSite.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            // Inject CSS for popup styling and animation
            if (typeof document !== 'undefined') {
              // Check if base styles exist
              if (!document.getElementById('pa-site-popup-styles')) {
              const style = document.createElement('style');
              style.id = 'pa-site-popup-styles';
              style.textContent = `
                .pa-site-popup-container .mapboxgl-popup-content {
                  background: transparent !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .pa-site-popup-container .mapboxgl-popup-tip {
                  display: none !important;
                }
              `;
              document.head.appendChild(style);
            }
              
              // Inject unique animation for this popup color with enhanced pulse halo
              if (!document.getElementById(`pa-popup-animation-${animationName}`)) {
                const animationStyle = document.createElement('style');
                animationStyle.id = `pa-popup-animation-${animationName}`;
                animationStyle.textContent = `
                  @keyframes ${animationName} {
                    0%, 100% {
                      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 
                                  0 0 0 0 rgba(${pulseColorRgb}, 0.7),
                                  0 0 0 0 rgba(${pulseColorRgb}, 0.5),
                                  0 0 0 0 rgba(${pulseColorRgb}, 0.3) !important;
                      transform: scale(1);
                    }
                    50% {
                      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 
                                  0 0 0 10px rgba(${pulseColorRgb}, 0.4),
                                  0 0 0 20px rgba(${pulseColorRgb}, 0.3),
                                  0 0 0 30px rgba(${pulseColorRgb}, 0) !important;
                      transform: scale(1.02);
                    }
                  }
                  .pa-site-popup-container {
                    z-index: 10000 !important;
                  }
                  .pa-site-popup-container .mapboxgl-popup-content {
                    z-index: 10000 !important;
                  }
                `;
                document.head.appendChild(animationStyle);
              }
            }
            
            // Convert hex to darker shade for background
            const hexToDarker = (hex) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              if (!result) return hex;
              // Darken by 30% (multiply by 0.7)
              const r = Math.floor(parseInt(result[1], 16) * 0.7);
              const g = Math.floor(parseInt(result[2], 16) * 0.7);
              const b = Math.floor(parseInt(result[3], 16) * 0.7);
              return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            };
            const darkerColor = hexToDarker(markerColor);
            
            // Create popup element with inline styles for dynamic color
            const popupElement = document.createElement('div');
            popupElement.className = 'pa-site-popup';
            popupElement.style.cssText = `
              background-color: ${darkerColor} !important;
              color: #ffffff !important;
              padding: 8px 12px !important;
              border-radius: 6px !important;
              font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif !important;
              font-size: 12px !important;
              font-weight: 600 !important;
              line-height: 1.4 !important;
              text-align: left !important;
              white-space: normal !important;
              pointer-events: none !important;
              z-index: 10000 !important;
              animation: ${animationName} 2s ease-in-out infinite !important;
              position: relative !important;
              transform-origin: center !important;
            `;
            // Use full name as single line
            popupElement.innerHTML = fullName;
            
            // Create Mapbox popup (will be shown after 500ms delay)
            const popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              anchor: 'bottom',
              offset: [0, -57], // Position above marker (moved up 8px from -49)
              className: 'pa-site-popup-container',
              maxWidth: 'none'
            })
              .setLngLat([lng, lat])
              .setDOMContent(popupElement);
            
            // Ensure popup has high z-index
            setTimeout(() => {
              const popupContainer = document.querySelector('.pa-site-popup-container');
              if (popupContainer) {
                popupContainer.style.zIndex = '10000';
                const popupContent = popupContainer.querySelector('.mapboxgl-popup-content');
                if (popupContent) {
                  popupContent.style.zIndex = '10000';
                }
              }
            }, 100);
            
            // Show popup after labels finish animating (labels start at 400ms, animation ~111ms, so 550ms total)
          setTimeout(() => {
              popup.addTo(map.current);
            }, 550);
              
            // Helper function to update popup with connection details
            const updatePopupWithConnectionDetails = async (siteConfig, popupEl, markerColorValue, markerElement) => {
              try {
                // Load OSM data for connection analysis
                const geoJSON = await loadPowerConnectionData(siteConfig.key);
                if (!geoJSON) {
                  console.warn(`⚠️ [OSMCallCached] No connection data available for ${siteConfig.key}`);
                  return;
                }

                // Analyze connections
                const connectionAnalysis = analyzeSiteConnections(geoJSON, siteConfig);
                const isConnected = connectionAnalysis.isConnected;
                const connectionStatus = isConnected ? 'Grid-Connected' : 'Behind-the-Meter';
                const distanceKm = connectionAnalysis.distanceToNearest 
                  ? (connectionAnalysis.distanceToNearest / 1000).toFixed(1) 
                  : null;

                // Determine company label
                let companyLabel = '';
                if (siteConfig.key === 'three_mile_island_pa') {
                  companyLabel = 'MSFT';
                } else if (siteConfig.key === 'susquehanna_nuclear_pa') {
                  companyLabel = 'AMZN';
                }

                // Determine colors based on site
                const isThreeMileIsland = siteConfig.key === 'three_mile_island_pa';
                const markerClickColor = isThreeMileIsland ? '#22c55e' : '#ef4444'; // Green for MSFT, Red for AMZN
                const popupBackgroundColor = isThreeMileIsland ? '#16a34a' : '#dc2626'; // Darker green for MSFT, darker red for AMZN
                const pulseColorRgb = isThreeMileIsland ? '34, 197, 94' : '220, 38, 38'; // Green RGB for MSFT, Red RGB for AMZN
                
                // Change marker color based on site
                if (markerElement) {
                  const markerSvg = markerElement.querySelector('svg');
                  if (markerSvg) {
                    const path = markerSvg.querySelector('path');
                    if (path) {
                      path.setAttribute('fill', markerClickColor);
                    }
                  }
                }

                // Create expanded popup HTML with left-side icon container
                const checkmarkColor = '#22c55e'; // Green checkmark
                const xColor = '#ef4444'; // Red X
                const iconSymbol = isConnected ? '✔' : '✘'; // Heavy checkmark for MSFT, heavy X for AMZN
                const iconColor = isConnected ? checkmarkColor : xColor;

                const expandedHTML = `
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Icon container on the left with white circle -->
                    <div style="display: flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; flex-shrink: 0; width: 40px; background-color: #ffffff; border-radius: 50%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                      <span style="font-size: 28.8px; color: ${iconColor}; font-weight: bold; line-height: 1; font-family: Arial, sans-serif; text-align: center; display: block;">
                        ${iconSymbol}
                      </span>
                    </div>
                    <!-- Content container on the right -->
                    <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0;">
                      <!-- Site name -->
                      <div style="font-size: 12px; font-weight: 600; line-height: 1.3;">
                        ${siteConfig.shortName || siteConfig.name}
                      </div>
                      <!-- Company and status -->
                      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; margin-top: 2px;">
                        <span style="color: rgba(255, 255, 255, 0.9);">${companyLabel}</span>
                        <span style="color: rgba(255, 255, 255, 0.7);">•</span>
                        <span style="color: rgba(255, 255, 255, 0.9);">${connectionStatus}</span>
                      </div>
                      ${distanceKm ? `<div style="font-size: 10px; color: rgba(255, 255, 255, 0.7); margin-top: 2px;">
                        Nearest transmission: ${distanceKm} km
                      </div>` : ''}
                    </div>
                  </div>
                `;

                // Update popup background color based on site
                popupEl.style.setProperty('background-color', popupBackgroundColor, 'important');
                
                // Update animation to use site-specific color for halo
                const animationName = `paPopupHaloPulse_${siteConfig.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
                
                // Update or create animation style with site-specific color
                if (typeof document !== 'undefined') {
                  let animationStyle = document.getElementById(`pa-popup-animation-${animationName}`);
                  if (!animationStyle) {
                    animationStyle = document.createElement('style');
                    animationStyle.id = `pa-popup-animation-${animationName}`;
                    document.head.appendChild(animationStyle);
                  }
                  animationStyle.textContent = `
                    @keyframes ${animationName} {
                      0%, 100% {
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 
                                    0 0 0 0 rgba(${pulseColorRgb}, 0.7),
                                    0 0 0 0 rgba(${pulseColorRgb}, 0.5),
                                    0 0 0 0 rgba(${pulseColorRgb}, 0.3) !important;
                        transform: scale(1);
                      }
                      50% {
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 
                                    0 0 0 10px rgba(${pulseColorRgb}, 0.4),
                                    0 0 0 20px rgba(${pulseColorRgb}, 0.3),
                                    0 0 0 30px rgba(${pulseColorRgb}, 0) !important;
                        transform: scale(1.02);
                      }
                    }
                  `;
                }
                
                // Update popup content while preserving animation
                popupEl.innerHTML = expandedHTML;
                
                // Force reapply animation and ensure box-shadow is not overridden
                popupEl.style.setProperty('animation', `${animationName} 2s ease-in-out infinite`, 'important');
                popupEl.style.setProperty('transform-origin', 'center', 'important');
                popupEl.style.setProperty('position', 'relative', 'important');

                console.log('✅ [OSMCallCached] Popup updated with connection details', {
                  siteKey: siteConfig.key,
                  isConnected,
                  connectionStatus,
                  distanceKm
                });
              } catch (error) {
                console.error('❌ [OSMCallCached] Error updating popup with connection details:', error);
                // Fallback to original content on error
                popupEl.innerHTML = fullName;
              }
            };

            // Add click handler for PA marker
            marker.getElement().addEventListener('click', async (event) => {
                console.log('🔍 [OSMCallCached] PA Marker clicked', {
                  siteKey: paSite.key,
                  siteName: paSite.name,
                  timestamp: new Date().toISOString(),
                  event: {
                    type: event.type,
                    target: event.target,
                    currentTarget: event.currentTarget,
                    bubbles: event.bubbles,
                    cancelable: event.cancelable
                  },
                  markerElement: marker.getElement(),
                  popupElement: popupElement,
                  hasMapEventBus: !!window.mapEventBus,
                  stackTrace: new Error().stack?.split('\n').slice(0, 10).join('\n')
                });
                
                // Update popup with connection details and change colors to green
                await updatePopupWithConnectionDetails(paSite, popupElement, markerColor, marker.getElement());
                
                // Emit marker:clicked event with defensive checks
                if (window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
                  const markerData = {
                  id: `${paSite.key}-marker`,
                  name: paSite.name || 'PA Nuclear Site',
                  type: 'PA Nuclear Infrastructure',
                  category: paSite.description || 'Pennsylvania Nuclear Plant',
                  coordinates: [lng, lat],
                  formatter: 'pinal',
                  zonesAnalyzed: 1,
                    cachedDataAvailable: !!cachedData,
                  analysisStatus: 'Analyzing infrastructure...',
                  markerColor: markerColor, // Pass marker color to popup
                  isAutomatic: false
                  };
                  
                  const listenersCount = (window.mapEventBus.listeners && window.mapEventBus.listeners['marker:clicked']) 
                    ? window.mapEventBus.listeners['marker:clicked'].length 
                    : 'unknown';
                  
                  console.log('🔍 [OSMCallCached] Emitting marker:clicked event', {
                    eventData: markerData,
                    listenersCount: listenersCount,
                    timestamp: new Date().toISOString()
                  });
                  
                  try {
                    window.mapEventBus.emit('marker:clicked', markerData);
                    console.log('🔍 [OSMCallCached] marker:clicked event emitted', {
                      timestamp: new Date().toISOString()
                    });
                  } catch (emitError) {
                    console.error('❌ [OSMCallCached] Error emitting marker:clicked event:', emitError);
                  }
                } else {
                  console.warn('⚠️ [OSMCallCached] mapEventBus not available or emit is not a function on marker click');
                }
              });
              
            // Store marker reference
            if (typeof window !== 'undefined') {
              window.paSiteMarkers[paSite.key] = marker;
              if (!window.paSitePopups) {
                window.paSitePopups = {};
              }
              window.paSitePopups[paSite.key] = popup;
            }
          });
          
          // Use selected site coordinates for the main marker reference
          const lat = siteConfig?.coordinates?.lat || 40.1500;
          const lng = siteConfig?.coordinates?.lng || -76.7300;
          const marker = window.paSiteMarkers?.[locationKey] || null;
          
          // Update feedback for PA infrastructure analysis
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: `🎬 Starting ${siteConfig?.shortName || city} sequence animation...`,
              progress: 20,
              details: `Phase 1: Infrastructure layers (0-2s)`
            });
          }
          
          // Ensure map is fully loaded before adding infrastructure
          const isMapReady = map.current.isStyleLoaded() || 
                            (map.current.getStyle() && 
                             map.current.getStyle().layers && 
                             map.current.getStyle().layers.length > 0);
          
          if (!isMapReady) {
            await new Promise((resolve) => {
              let resolved = false;
              
              const checkAndResolve = () => {
                if (resolved) return;
                const ready = map.current.isStyleLoaded() || 
                             (map.current.getStyle() && 
                              map.current.getStyle().layers && 
                              map.current.getStyle().layers.length > 0);
                if (ready) {
                  resolved = true;
                  map.current.off('styledata', checkAndResolve);
                  map.current.off('style.load', checkAndResolve);
                  clearTimeout(timeoutId);
                resolve();
                }
              };
              
              map.current.on('styledata', checkAndResolve);
              map.current.on('style.load', checkAndResolve);
              
              const timeoutId = setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  map.current.off('styledata', checkAndResolve);
                  map.current.off('style.load', checkAndResolve);
                  resolve();
                }
              }, 2000);
            });
          }
          
          // Add a small delay to ensure map is ready (reduced from 200ms to 50ms for faster loading)
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Phase 2: Load OSM data for BOTH PA sites and combine features
          const allPAFeatures = [];
          const allPASiteConfigs = NC_POWER_SITES.filter(site => 
            site.key === 'three_mile_island_pa' || site.key === 'susquehanna_nuclear_pa'
          );
          
          for (const paSiteConfig of allPASiteConfigs) {
            try {
              const siteDataPath = paSiteConfig.dataPath;
              if (siteDataPath) {
                const siteResponse = await fetch(siteDataPath);
                if (siteResponse.ok) {
                  const siteData = await siteResponse.json();
                  const siteFeatures = siteData.features || [];
                  
                  // Get site center and radius for distance filtering
                  const siteLat = paSiteConfig.coordinates?.lat;
                  const siteLng = paSiteConfig.coordinates?.lng;
                  const siteRadiusMeters = paSiteConfig.radiusMeters || 25000; // Default 25km
                  const siteCenter = siteLat && siteLng ? turf.point([siteLng, siteLat]) : null;
                  
                  // Filter features to only include those within the site's radius
                  const filteredFeatures = siteCenter ? siteFeatures.filter(feature => {
                    try {
                      let distance_m = Infinity;
                      
                      if (feature.geometry?.type === 'Point') {
                        const featurePoint = turf.point(feature.geometry.coordinates);
                        distance_m = turf.distance(siteCenter, featurePoint, { units: 'meters' });
                      } else if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
                        // For lines, check distance to nearest point on line
                        const line = turf.lineString(
                          feature.geometry.type === 'LineString' 
                            ? feature.geometry.coordinates 
                            : feature.geometry.coordinates[0] // Use first segment for MultiLineString
                        );
                        const nearestPoint = turf.nearestPointOnLine(line, siteCenter, { units: 'meters' });
                        distance_m = nearestPoint.properties.dist || turf.distance(siteCenter, nearestPoint, { units: 'meters' });
                      } else if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
                        // For polygons, check distance to nearest point on boundary
                        const polygon = turf.polygon(
                          feature.geometry.type === 'Polygon'
                            ? feature.geometry.coordinates
                            : feature.geometry.coordinates[0] // Use first polygon for MultiPolygon
                        );
                        const nearestPoint = turf.nearestPointOnLine(
                          turf.polygonToLine(polygon),
                          siteCenter,
                          { units: 'meters' }
                        );
                        distance_m = nearestPoint.properties.dist || turf.distance(siteCenter, nearestPoint, { units: 'meters' });
                      }
                      
                      // Only include features within the site's radius
                      return distance_m <= siteRadiusMeters;
                    } catch (error) {
                      // If distance calculation fails, exclude the feature
                      console.warn(`⚠️ [OSMCallCached] Error calculating distance for feature:`, error);
                      return false;
                    }
                  }) : siteFeatures; // If no site center, include all features (fallback)
                  
                  console.log(`📊 [OSMCallCached] Filtered features for ${paSiteConfig.name}`, {
                    totalInCache: siteFeatures.length,
                    withinRadius: filteredFeatures.length,
                    radiusKm: (siteRadiusMeters / 1000).toFixed(1)
                  });
                  
                  // Tag each feature with its site of origin
                  const taggedFeatures = filteredFeatures.map(feature => ({
                    ...feature,
                    properties: {
                      ...feature.properties,
                      pa_site_key: paSiteConfig.key,
                      pa_site_name: paSiteConfig.name
                    }
                  }));
                  
                  allPAFeatures.push(...taggedFeatures);
                }
              }
            } catch (error) {
              console.error(`❌ [OSMCallCached] Error loading data for ${paSiteConfig.name}:`, error);
            }
          }
          
          console.log('📊 [OSMCallCached] Loaded OSM features', {
            totalFeatures: allPAFeatures.length,
            sites: allPASiteConfigs.map(s => s.key)
          });
          
          // Phase 3: Add infrastructure to map with sequence animation
          await addPAInfrastructureToMap(allPAFeatures, marker);
          
          // Update feedback for completion
          setTimeout(() => {
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'osm',
                status: `✅ PA Nuclear Infrastructure analysis completed!`,
                progress: 100,
                details: `Loaded OSM features from both Three Mile Island and Susquehanna Nuclear sites.`
              });
            }
          }, 2000);
          
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
          }, 8000);

            
        } catch (error) {
          console.error(`❌ Error in ${siteConfig?.name || 'PA site'} analysis:`, error);
          console.error('❌ [OSMCallCached] Full error stack:', error.stack);
            
          // Update feedback for error
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'osm',
              status: `❌ ${siteConfig?.shortName || city} analysis failed`,
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
      console.error(`❌ PA Site Analysis Error:`, error.message);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'osm',
          status: `❌ ${siteConfig?.shortName || 'PA site'} analysis failed`,
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
        animation: disabled ? 'none' : (isLoading ? 'whitneyButtonPulse 1.5s ease-out infinite' : 'none')
      }}
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={disabled ? 'Loading...' : (isLoading ? `Analyzing ${locationKey.includes('_pa') ? 'PA' : 'site'} infrastructure...` : 
        cachedData ? `${title} (Cached - Click to analyze)` : `${title} (Loading data...)`)}
    />
  );
};

export default OSMCallCached;
