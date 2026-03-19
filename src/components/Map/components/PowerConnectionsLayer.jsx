import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { NC_POWER_SITES } from '../../../config/ncPowerSites';
import {
  loadPowerConnectionData,
  analyzeSiteConnections,
  createConnectionLine,
  createSiteMarker,
  createStatusIcon
} from '../utils/powerConnectionsVisualization';

/**
 * PowerConnectionsLayer Component
 * Visualizes power infrastructure connections to show regulatory distinction:
 * - Microsoft/Three Mile Island: Grid-connected
 * - Amazon/Susquehanna: Behind-the-meter
 */
const PowerConnectionsLayer = ({ map }) => {
  const [isActive, setIsActive] = useState(false);
  const [connectionData, setConnectionData] = useState(null);
  const layersAddedRef = useRef(false);
  const pulseAnimationRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) {
      return;
    }

    const eventBus = window.mapEventBus;

    const handleToggle = (enabled) => {
      console.log('🔌 PowerConnectionsLayer: Toggle event received:', enabled);
      setIsActive(!!enabled);
    };

    eventBus.on('power-connections:toggle', handleToggle);

    return () => {
      eventBus.off('power-connections:toggle', handleToggle);
    };
  }, []);

  // Load data and create visualization when activated
  useEffect(() => {
    if (!isActive || !map?.current) {
      // Clean up layers when deactivated
      if (!isActive && layersAddedRef.current) {
        cleanupLayers();
        layersAddedRef.current = false;
      }
      return;
    }

    // Load data and create visualization
    loadAndVisualizeConnections();

    return () => {
      if (!isActive) {
        cleanupLayers();
      }
    };
  }, [isActive, map]);

  const cleanupLayers = () => {
    if (!map?.current) return;

    // Stop pulse animation
    if (pulseAnimationRef.current) {
      cancelAnimationFrame(pulseAnimationRef.current);
      pulseAnimationRef.current = null;
    }

    // Remove event listeners first
    try {
      map.current.off('click', 'power-connections-sites');
      map.current.off('mouseenter', 'power-connections-sites');
      map.current.off('mouseleave', 'power-connections-sites');
    } catch (error) {
      // Ignore errors if listeners don't exist
    }

    const layersToRemove = [
      'power-connections-transmission',
      'power-connections-sites',
      'power-connections-lines',
      'power-connections-distance-labels',
      'power-connections-status-icons',
      'power-connections-status-icons-text',
      'power-connections-site-labels'
    ];

    const sourcesToRemove = [
      'power-connections-transmission',
      'power-connections-sites',
      'power-connections-lines',
      'power-connections-distance-labels',
      'power-connections-status-icons',
      'power-connections-site-labels'
    ];

    layersToRemove.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    sourcesToRemove.forEach(sourceId => {
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    console.log('🧹 PowerConnectionsLayer: Cleaned up layers');
  };

  const loadAndVisualizeConnections = async () => {
    if (!map?.current) return;

    try {
      console.log('🔌 PowerConnectionsLayer: Loading connection data...');

      // Get PA site configurations
      const tmiSite = NC_POWER_SITES.find(s => s.key === 'three_mile_island_pa');
      const susquehannaSite = NC_POWER_SITES.find(s => s.key === 'susquehanna_nuclear_pa');

      if (!tmiSite || !susquehannaSite) {
        console.error('❌ PowerConnectionsLayer: PA sites not found in configuration');
        return;
      }

      // Load OSM data for both sites
      const [tmiData, susquehannaData] = await Promise.all([
        loadPowerConnectionData('three_mile_island_pa'),
        loadPowerConnectionData('susquehanna_nuclear_pa')
      ]);

      if (!tmiData || !susquehannaData) {
        console.error('❌ PowerConnectionsLayer: Failed to load OSM data');
        return;
      }

      // Analyze connections for both sites
      const tmiAnalysis = analyzeSiteConnections(tmiData, tmiSite);
      const susquehannaAnalysis = analyzeSiteConnections(susquehannaData, susquehannaSite);

      // Override with known regulatory status (regardless of OSM distance analysis)
      // Microsoft/Three Mile Island: Grid-connected via PPA (connects to transmission)
      // Amazon/Susquehanna: Behind-the-meter (does NOT connect to transmission)
      tmiAnalysis.isConnected = true; // Microsoft is grid-connected
      susquehannaAnalysis.isConnected = false; // Amazon is behind-the-meter
      
      console.log('🔌 PowerConnectionsLayer: Regulatory status override applied:', {
        'Microsoft/Three Mile Island': 'Grid-Connected',
        'Amazon/Susquehanna': 'Behind-the-Meter'
      });

      // Create visualization features
      const transmissionFeatures = [];
      const siteFeatures = [];
      const connectionLineFeatures = [];
      const statusIconFeatures = [];

      // Add transmission lines from both datasets
      [...tmiAnalysis.transmissionLines, ...susquehannaAnalysis.transmissionLines].forEach(line => {
        transmissionFeatures.push(line);
      });

      // Create site markers
      const tmiMarker = createSiteMarker(tmiSite, tmiAnalysis);
      const susquehannaMarker = createSiteMarker(susquehannaSite, susquehannaAnalysis);
      siteFeatures.push(tmiMarker, susquehannaMarker);

      // Create connection lines
      if (tmiAnalysis.connectionPoint) {
        const tmiConnectionLine = createConnectionLine(
          tmiAnalysis.sitePoint,
          tmiAnalysis.connectionPoint,
          tmiAnalysis.isConnected,
          tmiAnalysis.distanceToNearest
        );
        if (tmiConnectionLine) {
          connectionLineFeatures.push(tmiConnectionLine);
        }
      }

      if (susquehannaAnalysis.connectionPoint) {
        const susquehannaConnectionLine = createConnectionLine(
          susquehannaAnalysis.sitePoint,
          susquehannaAnalysis.connectionPoint,
          susquehannaAnalysis.isConnected,
          susquehannaAnalysis.distanceToNearest
        );
        if (susquehannaConnectionLine) {
          connectionLineFeatures.push(susquehannaConnectionLine);
        }
      }

      // Create status icons
      if (tmiAnalysis.connectionPoint) {
        const tmiIcon = createStatusIcon(tmiAnalysis.connectionPoint, tmiAnalysis.isConnected);
        if (tmiIcon) {
          statusIconFeatures.push(tmiIcon);
        }
      }

      if (susquehannaAnalysis.connectionPoint) {
        const susquehannaIcon = createStatusIcon(susquehannaAnalysis.connectionPoint, susquehannaAnalysis.isConnected);
        if (susquehannaIcon) {
          statusIconFeatures.push(susquehannaIcon);
        }
      }

      // Store connection data
      setConnectionData({
        tmi: tmiAnalysis,
        susquehanna: susquehannaAnalysis
      });

      // Add layers to map
      addLayersToMap({
        transmissionFeatures,
        siteFeatures,
        connectionLineFeatures,
        statusIconFeatures
      });

      layersAddedRef.current = true;
      console.log('✅ PowerConnectionsLayer: Visualization complete');

    } catch (error) {
      console.error('❌ PowerConnectionsLayer: Error loading connections:', error);
    }
  };

  const addLayersToMap = ({ transmissionFeatures, siteFeatures, connectionLineFeatures, statusIconFeatures }) => {
    if (!map?.current) return;

    // Clean up existing layers first
    cleanupLayers();

    // 1. Transmission Lines Layer (Orange)
    if (transmissionFeatures.length > 0) {
      map.current.addSource('power-connections-transmission', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: transmissionFeatures
        }
      });

      map.current.addLayer({
        id: 'power-connections-transmission',
        type: 'line',
        source: 'power-connections-transmission',
        paint: {
          'line-color': '#ff6600', // Orange
          'line-width': 2, // Reduced from 6 to 2 for less dominance
          'line-opacity': 0.7 // Slightly reduced opacity
        }
      });
    }

    // 2. Connection Lines Layer (Green for connected, Red for not connected)
    if (connectionLineFeatures.length > 0) {
      map.current.addSource('power-connections-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: connectionLineFeatures
        }
      });

      map.current.addLayer({
        id: 'power-connections-lines',
        type: 'line',
        source: 'power-connections-lines',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'isConnected'], true], '#22c55e', // Green for connected
            '#ef4444' // Red for not connected
          ],
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2] // Dashed line
        }
      });

      // Add pulse animation to connection lines
      let pulsePhase = 0;
      const pulseAnimation = () => {
        if (!map.current || !map.current.getLayer('power-connections-lines')) {
          pulseAnimationRef.current = null;
          return; // Stop if layer was removed
        }

        pulsePhase += 0.05;
        const pulseOpacity = 0.6 + (Math.sin(pulsePhase) * 0.3); // Pulse between 0.6 and 0.9
        const pulseWidth = 3 + (Math.sin(pulsePhase) * 1); // Pulse width between 3 and 4

        try {
          map.current.setPaintProperty('power-connections-lines', 'line-opacity', pulseOpacity);
          map.current.setPaintProperty('power-connections-lines', 'line-width', pulseWidth);
          pulseAnimationRef.current = requestAnimationFrame(pulseAnimation);
        } catch (error) {
          // Layer was removed, stop animation
          pulseAnimationRef.current = null;
          return;
        }
      };
      pulseAnimationRef.current = requestAnimationFrame(pulseAnimation);

      // Create distance label features (midpoints of connection lines)
      const distanceLabelFeatures = connectionLineFeatures
        .filter(f => f.properties.distanceKm !== null)
        .map(f => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [f.properties.midPoint.lng, f.properties.midPoint.lat]
          },
          properties: {
            distance: f.properties.distanceKm,
            isConnected: f.properties.isConnected,
            unit: 'km'
          }
        }));

      if (distanceLabelFeatures.length > 0) {
        map.current.addSource('power-connections-distance-labels', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: distanceLabelFeatures
          }
        });

        map.current.addLayer({
          id: 'power-connections-distance-labels',
          type: 'symbol',
          source: 'power-connections-distance-labels',
          layout: {
            'text-field': ['concat', ['get', 'distance'], ' km'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'center',
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': [
              'case',
              ['==', ['get', 'isConnected'], true], '#22c55e', // Green for connected
              '#ef4444' // Red for not connected
            ],
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-halo-blur': 1
          }
        });
      }
    }

    // 3. Site Markers Layer
    if (siteFeatures.length > 0) {
      map.current.addSource('power-connections-sites', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: siteFeatures
        }
      });

      map.current.addLayer({
        id: 'power-connections-sites',
        type: 'circle',
        source: 'power-connections-sites',
        paint: {
          'circle-radius': 12,
          'circle-color': ['get', 'companyColor'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      });

      // Site labels
      map.current.addLayer({
        id: 'power-connections-site-labels',
        type: 'symbol',
        source: 'power-connections-sites',
        layout: {
          'text-field': ['get', 'companyLabel'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, 2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 2
        }
      });

      // Add click handler for site markers to show popup
      map.current.on('click', 'power-connections-sites', (e) => {
        const props = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();

        // Create popup content
        const popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
              ${props.siteName}
            </div>
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>Company:</strong> ${props.companyLabel}
            </div>
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>Status:</strong> 
              <span style="color: ${props.isConnected ? '#22c55e' : '#ef4444'}; font-weight: bold;">
                ${props.connectionStatus}
              </span>
            </div>
            ${props.distanceToNearest !== null ? `
              <div style="font-size: 11px; color: #666;">
                Distance to nearest transmission: ${(props.distanceToNearest / 1000).toFixed(2)} km
              </div>
            ` : ''}
          </div>
        `;

        // Create and show popup
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map.current);
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'power-connections-sites', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'power-connections-sites', () => {
        map.current.getCanvas().style.cursor = '';
      });
    }

      // 4. Status Icons Layer (using symbols for checkmark/X icons)
      if (statusIconFeatures.length > 0) {
        map.current.addSource('power-connections-status-icons', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: statusIconFeatures
          }
        });

        // Add circle background for icons (2x bigger)
        map.current.addLayer({
          id: 'power-connections-status-icons',
          type: 'circle',
          source: 'power-connections-status-icons',
          paint: {
            'circle-radius': 20, // 2x bigger (was 10)
            'circle-color': ['get', 'iconColor'],
            'circle-stroke-width': 0, // No border
            'circle-opacity': 0.9
          }
        });

        // Add symbol layer for checkmark/X text (2x bigger)
        map.current.addLayer({
          id: 'power-connections-status-icons-text',
          type: 'symbol',
          source: 'power-connections-status-icons',
          layout: {
            'text-field': [
              'case',
              ['==', ['get', 'isConnected'], true], '✓',
              '✗'
            ],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 28, // 2x bigger (was 14)
            'text-anchor': 'center'
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      }

    console.log('✅ PowerConnectionsLayer: Layers added to map');
  };

  return null; // This component doesn't render anything visible
};

export default PowerConnectionsLayer;

