import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const WellRegistryLayer = ({ map, visible }) => {
  const layerRef = useRef(null);
  const sourceRef = useRef(null);
  const markersRef = useRef([]);
  const isLoadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  // Log when component mounts and visibility changes
  useEffect(() => {
    console.log('🟡 WellRegistryLayer: Component mounted with visible:', visible);
  }, []);

  useEffect(() => {
    console.log('🟡 WellRegistryLayer: Visibility changed to:', visible);
  }, [visible]);

  useEffect(() => {
    if (!map || !map.current) return;

    const mapInstance = map.current;

    // If not visible, remove the markers
    if (!visible) {
      console.log('🟡 WellRegistryLayer: Not visible, removing markers');
      removeWellMarkers();
      return;
    }

    console.log('🟡 WellRegistryLayer: Visible, checking if markers need to be loaded');
    
    // Check if markers already exist
    if (markersRef.current.length > 0) {
      console.log('🟡 WellRegistryLayer: Markers already exist, skipping load');
      return;
    }
    
    loadWellRegistryData();

    function removeWellMarkers() {
      // Remove layer and source if they exist
      if (mapInstance.getLayer('well-registry-circles')) {
        mapInstance.removeLayer('well-registry-circles');
        console.log('🟡 WellRegistryLayer: Removed well registry circles layer');
      }
      if (mapInstance.getSource('well-registry')) {
        mapInstance.removeSource('well-registry');
        console.log('🟡 WellRegistryLayer: Removed well registry source');
      }
      
      // Clear markers ref (not used anymore but keeping for compatibility)
      markersRef.current = [];
      console.log('🟡 WellRegistryLayer: Removed all well markers');
    }

    async function loadWellRegistryData() {
      // Prevent concurrent loads using ref
      if (isLoadingRef.current) {
        console.log('🟡 WellRegistryLayer: Load already in progress, skipping...');
        return;
      }
      
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🟡 WellRegistryLayer: Starting to load well registry data...');

      try {
        // Fetch the GeoJSON data
        const response = await fetch('/ARZ/Well_Registry_2024_7097276752063490248.geojson');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('🟡 WellRegistryLayer: GeoJSON data fetched, parsing...');
        const data = await response.json();
        
        if (!data.features || !Array.isArray(data.features)) {
          throw new Error('Invalid GeoJSON data structure');
        }

        console.log(`🟡 WellRegistryLayer: Total features in dataset: ${data.features.length}`);
        
        // Sample 10% of the features
        const sampleSize = Math.floor(data.features.length * 0.1);
        const sampledFeatures = data.features.slice(0, sampleSize);
        
        console.log(`🟡 WellRegistryLayer: Sampling ${sampledFeatures.length} features (10% of ${data.features.length})`);

        // Remove existing markers first
        removeWellMarkers();

        // Create a GeoJSON source with sampled features
        const sampledGeoJSON = {
          type: 'FeatureCollection',
          features: sampledFeatures.filter(feature => 
            feature.geometry && 
            feature.geometry.type === 'Point' && 
            feature.geometry.coordinates
          )
        };

        console.log(`🟡 WellRegistryLayer: Creating GeoJSON source with ${sampledGeoJSON.features.length} features`);

        // Add source
        mapInstance.addSource('well-registry', {
          type: 'geojson',
          data: sampledGeoJSON
        });

        // Add circle layer for well points with zoom-based sizing
        mapInstance.addLayer({
          id: 'well-registry-circles',
          type: 'circle',
          source: 'well-registry',
          paint: {
            'circle-color': '#FFD700',
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              0, 1,      // Very small when zoomed out
              6, 1.5,    // Small at low zoom
              10, 2.5,   // Medium at mid zoom
              14, 3,     // Original size at city zoom
              18, 4      // Slightly larger when very zoomed in
            ],
            'circle-stroke-color': '#B8860B',
            'circle-stroke-width': [
              'interpolate', ['linear'], ['zoom'],
              0, 0.5,    // Thinner stroke when zoomed out
              6, 0.7,
              10, 0.9,
              14, 1,     // Original stroke width
              18, 1.2    // Slightly thicker when very zoomed in
            ],
            'circle-opacity': 0.8
          }
        });

        // Add click handler for popups
        mapInstance.on('click', 'well-registry-circles', (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const properties = feature.properties || {};
          
          // Create popup content
          const popupContent = `
            <div style="padding: 8px; font-size: 12px;">
              <h4 style="margin: 0 0 4px 0; color: #1E3A8A;">Well Registry</h4>
              <p style="margin: 2px 0;"><strong>Coordinates:</strong> ${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}</p>
              ${properties.WELL_ID ? `<p style="margin: 2px 0;"><strong>Well ID:</strong> ${properties.WELL_ID}</p>` : ''}
              ${properties.DEPTH ? `<p style="margin: 2px 0;"><strong>Depth:</strong> ${properties.DEPTH}</p>` : ''}
              ${properties.STATUS ? `<p style="margin: 2px 0;"><strong>Status:</strong> ${properties.STATUS}</p>` : ''}
              ${properties.OWNER ? `<p style="margin: 2px 0;"><strong>Owner:</strong> ${properties.OWNER}</p>` : ''}
            </div>
          `;

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(mapInstance);
        });

        // Change cursor on hover
        mapInstance.on('mouseenter', 'well-registry-circles', () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });

        mapInstance.on('mouseleave', 'well-registry-circles', () => {
          mapInstance.getCanvas().style.cursor = '';
        });

        console.log(`🟡 WellRegistryLayer: Successfully created well registry layer with ${sampledGeoJSON.features.length} features`);
        
      } catch (error) {
        console.error('🟡 WellRegistryLayer: Error loading well registry data:', error);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }

    return () => {
      removeWellMarkers();
      isLoadingRef.current = false;
    };
  }, [map, visible]);

  return null;
};

export default WellRegistryLayer;
