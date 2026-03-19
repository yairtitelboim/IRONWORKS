import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const LocalZonesLayer = ({ map, showLocalZones, showLocalZoneBoundaries = false, showLocalZoneLabels = false }) => {
  useEffect(() => {
    if (!map.current) return;

    const addLocalZonesLayer = async () => {
      try {
        // This would be replaced with your actual local zones data
        const response = await fetch('/local_zones.geojson');
        const data = await response.json();

        if (!map.current.getSource('local-zones')) {
          map.current.addSource('local-zones', {
            type: 'geojson',
            data: data
          });
        }

        // Remove old layers if they exist
        if (map.current.getLayer('local-zones-fill')) {
          map.current.removeLayer('local-zones-fill');
        }
        if (map.current.getLayer('local-zones-boundary')) {
          map.current.removeLayer('local-zones-boundary');
        }
        if (map.current.getLayer('local-zones-labels')) {
          map.current.removeLayer('local-zones-labels');
        }

        // Add fill layer
        if (!map.current.getLayer('local-zones-fill')) {
          map.current.addLayer({
            id: 'local-zones-fill',
            type: 'fill',
            source: 'local-zones',
            paint: {
              'fill-color': [
                'match',
                ['get', 'zone_type'],
                'residential', '#9ACD32',
                'commercial', '#4169E1',
                'industrial', '#CD5C5C',
                'mixed_use', '#9932CC',
                'recreational', '#32CD32',
                '#BBBBBB'  // default color
              ],
              'fill-opacity': 0.6,
              'fill-outline-color': '#000000'
            }
          });
        }

        // Add boundary layer
        if (!map.current.getLayer('local-zones-boundary')) {
          map.current.addLayer({
            id: 'local-zones-boundary',
            type: 'line',
            source: 'local-zones',
            paint: {
              'line-color': '#000000',
              'line-width': 2,
              'line-opacity': 0.8
            }
          });
        }

        // Add labels layer
        if (!map.current.getLayer('local-zones-labels')) {
          map.current.addLayer({
            id: 'local-zones-labels',
            type: 'symbol',
            source: 'local-zones',
            layout: {
              'text-field': [
                'format',
                ['get', 'name'],
                { 'font-scale': 1 },
                '\n',
                {},
                ['get', 'zone_type'],
                { 'font-scale': 0.8 }
              ],
              'text-anchor': 'center',
              'text-offset': [0, 0],
              'text-size': 12
            },
            paint: {
              'text-color': '#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1
            }
          });
        }

        // Add click interaction
        map.current.on('click', 'local-zones-fill', (e) => {
          if (!e.features.length) return;

          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates[0][0].slice();
          const { name, zone_type, description, regulations } = feature.properties;

          const popupContent = `
            <h3>${name}</h3>
            <p><strong>Zone Type:</strong> ${zone_type}</p>
            <p><strong>Description:</strong> ${description || 'No description available'}</p>
            <p><strong>Regulations:</strong> ${regulations || 'No regulations available'}</p>
          `;

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        // Change cursor on hover
        map.current.on('mouseenter', 'local-zones-fill', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'local-zones-fill', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Update visibility based on props
        updateLayerVisibility();
      } catch (error) {
        console.error('Error loading local zones:', error);
      }
    };

    const updateLayerVisibility = () => {
      // Main fill layer depends on showLocalZones
      if (map.current.getLayer('local-zones-fill')) {
        map.current.setLayoutProperty(
          'local-zones-fill',
          'visibility',
          showLocalZones ? 'visible' : 'none'
        );
      }
      
      // Boundary layer depends on showLocalZones and showLocalZoneBoundaries
      if (map.current.getLayer('local-zones-boundary')) {
        map.current.setLayoutProperty(
          'local-zones-boundary',
          'visibility',
          (showLocalZones && showLocalZoneBoundaries) ? 'visible' : 'none'
        );
      }
      
      // Labels layer depends on showLocalZones and showLocalZoneLabels
      if (map.current.getLayer('local-zones-labels')) {
        map.current.setLayoutProperty(
          'local-zones-labels',
          'visibility',
          (showLocalZones && showLocalZoneLabels) ? 'visible' : 'none'
        );
      }
    };

    addLocalZonesLayer();

    // Cleanup function
    return () => {
      if (map.current) {
        // Remove event listeners
        map.current.off('click', 'local-zones-fill');
        map.current.off('mouseenter', 'local-zones-fill');
        map.current.off('mouseleave', 'local-zones-fill');

        // Remove layers
        if (map.current.getLayer('local-zones-fill')) {
          map.current.removeLayer('local-zones-fill');
        }
        if (map.current.getLayer('local-zones-boundary')) {
          map.current.removeLayer('local-zones-boundary');
        }
        if (map.current.getLayer('local-zones-labels')) {
          map.current.removeLayer('local-zones-labels');
        }
        
        // Remove source
        if (map.current.getSource('local-zones')) {
          map.current.removeSource('local-zones');
        }
      }
    };
  }, [map, showLocalZones, showLocalZoneBoundaries, showLocalZoneLabels]);

  // Add a separate effect to handle visibility changes
  useEffect(() => {
    if (!map.current) return;
    
    if (map.current.getLayer('local-zones-fill')) {
      map.current.setLayoutProperty(
        'local-zones-fill',
        'visibility',
        showLocalZones ? 'visible' : 'none'
      );
    }
    
    if (map.current.getLayer('local-zones-boundary')) {
      map.current.setLayoutProperty(
        'local-zones-boundary',
        'visibility',
        (showLocalZones && showLocalZoneBoundaries) ? 'visible' : 'none'
      );
    }
    
    if (map.current.getLayer('local-zones-labels')) {
      map.current.setLayoutProperty(
        'local-zones-labels',
        'visibility',
        (showLocalZones && showLocalZoneLabels) ? 'visible' : 'none'
      );
    }
  }, [map, showLocalZones, showLocalZoneBoundaries, showLocalZoneLabels]);

  return null;
};

export default LocalZonesLayer; 