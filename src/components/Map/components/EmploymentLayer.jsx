import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const EmploymentLayer = ({ map, showEmployment, showLabels = false }) => {
  useEffect(() => {
    if (!map.current) return;

    const addEmploymentLayer = async () => {
      try {
        const response = await fetch('/employment_clusters.geojson');
        const data = await response.json();

        if (!map.current.getSource('employment-clusters')) {
          map.current.addSource('employment-clusters', {
            type: 'geojson',
            data: data
          });
        }

        // Remove old circle layer if it exists
        if (map.current.getLayer('employment-clusters-layer')) {
          map.current.removeLayer('employment-clusters-layer');
        }

        // Add heatmap layer
        if (!map.current.getLayer('employment-clusters-heatmap')) {
          map.current.addLayer({
            id: 'employment-clusters-heatmap',
            type: 'heatmap',
            source: 'employment-clusters',
            paint: {
              // Increase the heatmap weight based on job count
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'job_count'],
                10000, 0.3,   // Increased minimum weight
                500000, 1.0   // Maximum weight
              ],
              // Increase the heatmap color weight by zoom level
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 0.7,    // Increased base intensity
                15, 2.0    // Increased max intensity
              ],
              // Brighter color gradient
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(255,247,236,0)',
                0.2, '#ffeda0', // Brighter light yellow
                0.4, '#ffae43', // Brighter yellow-orange
                0.6, '#ff7c43', // Brighter orange
                0.8, '#ff4e4e', // Brighter red-orange
                1, '#ff0000'    // Pure red for max density
              ],
              // Larger radius
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                  'interpolate',
                  ['linear'],
                  ['get', 'job_count'],
                  10000, 20,    // Increased min radius
                  500000, 45    // Increased max radius
                ],
                15, [
                  'interpolate',
                  ['linear'],
                  ['get', 'job_count'],
                  10000, 30,    // Increased min radius
                  500000, 60    // Increased max radius
                ]
              ],
              // Slightly increased opacity
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 0.8,
                15, 0.9
              ]
            }
          });

          // Add labels layer on top of heatmap
          map.current.addLayer({
            id: 'employment-clusters-labels',
            type: 'symbol',
            source: 'employment-clusters',
            layout: {
              'text-field': [
                'format',
                ['get', 'name'],
                { 'font-scale': 1 },
                '\n',
                {},
                ['number-format', ['get', 'job_count'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }],
                { 'font-scale': 0.8 },
                ' jobs',
                { 'font-scale': 0.8 }
              ],
              'text-anchor': 'center',
              'text-offset': [0, 0],
              'text-size': 12
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1
            }
          });

          // Add click interaction
          map.current.on('click', 'employment-clusters-heatmap', (e) => {
            if (!e.features.length) return;

            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const { name, job_count, primary_sectors, major_employers } = feature.properties;

            const description = `
              <h3>${name}</h3>
              <p><strong>Jobs:</strong> ${job_count.toLocaleString()}</p>
              <p><strong>Sectors:</strong> ${JSON.parse(primary_sectors).join(', ')}</p>
              <p><strong>Major Employers:</strong> ${JSON.parse(major_employers).join(', ')}</p>
            `;

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup()
              .setLngLat(coordinates)
              .setHTML(description)
              .addTo(map.current);
          });

          // Change cursor on hover
          map.current.on('mouseenter', 'employment-clusters-heatmap', () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', 'employment-clusters-heatmap', () => {
            map.current.getCanvas().style.cursor = '';
          });
        }

        // Update visibility based on props
        updateLayerVisibility();
      } catch (error) {
        console.error('Error loading employment clusters:', error);
      }
    };

    const updateLayerVisibility = () => {
      // Main heatmap layer depends only on showEmployment
      map.current.setLayoutProperty(
        'employment-clusters-heatmap',
        'visibility',
        showEmployment ? 'visible' : 'none'
      );
      
      // Labels layer depends on both showEmployment and showLabels
      map.current.setLayoutProperty(
        'employment-clusters-labels',
        'visibility',
        (showEmployment && showLabels) ? 'visible' : 'none'
      );
    };

    addEmploymentLayer();

    // Cleanup function
    return () => {
      if (map.current) {
        // Remove event listeners
        map.current.off('click', 'employment-clusters-heatmap');
        map.current.off('mouseenter', 'employment-clusters-heatmap');
        map.current.off('mouseleave', 'employment-clusters-heatmap');

        // Remove layers
        if (map.current.getLayer('employment-clusters-heatmap')) {
          map.current.removeLayer('employment-clusters-heatmap');
        }
        if (map.current.getLayer('employment-clusters-labels')) {
          map.current.removeLayer('employment-clusters-labels');
        }
        
        // Remove source
        if (map.current.getSource('employment-clusters')) {
          map.current.removeSource('employment-clusters');
        }
      }
    };
  }, [map, showEmployment, showLabels]);

  // Add a separate effect to handle visibility changes
  useEffect(() => {
    if (!map.current) return;
    
    // Check if layers exist before trying to update their visibility
    if (map.current.getLayer('employment-clusters-heatmap') && 
        map.current.getLayer('employment-clusters-labels')) {
      // Main heatmap layer depends only on showEmployment
      map.current.setLayoutProperty(
        'employment-clusters-heatmap',
        'visibility',
        showEmployment ? 'visible' : 'none'
      );
      
      // Labels layer depends on both showEmployment and showLabels
      map.current.setLayoutProperty(
        'employment-clusters-labels',
        'visibility',
        (showEmployment && showLabels) ? 'visible' : 'none'
      );
    }
  }, [map, showEmployment, showLabels]);

  return null;
};

export default EmploymentLayer; 