import React, { useEffect } from 'react';
import styled from 'styled-components';
import * as turf from '@turf/turf';

// Styled components for the legend
const LegendContainer = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 6px;
  font-size: 12px;
`;

const LegendTitle = styled.div`
  color: #fff;
  margin-bottom: 8px;
  font-weight: 500;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.8);
`;

const LegendColor = styled.div`
  width: 16px;
  height: 16px;
  margin-right: 8px;
  border-radius: 2px;
  background: ${props => props.color};
`;

const NeighborhoodBoundaries = ({ map, visible, showLabels = false, planningData, onNeighborhoodClick }) => {
  useEffect(() => {
    if (!map?.current || !planningData) return;

    const setupBoundaries = async () => {
      try {
        console.log('\n=== Setting up Neighborhood Boundaries ===');

        // Load boundaries data
        const response = await fetch('/LA_Times_Neighborhood_Boundaries.geojson');
        const data = await response.json();
        console.log(`Loaded ${data.features.length} neighborhoods`);

        // Calculate marker counts and prepare data
        const markerCounts = {};
        const allMarkers = [
          ...(planningData.adaptiveReuse || []),
          ...(planningData.development || [])
        ];

        data.features.forEach(neighborhood => {
          const name = neighborhood.properties.name;
          markerCounts[name] = 0;

          allMarkers.forEach(marker => {
            if (marker.geometry?.coordinates) {
              const point = [...marker.geometry.coordinates];
              if (Math.abs(point[0]) < 90 && Math.abs(point[1]) > 90) {
                point.reverse();
              }
              if (turf.booleanPointInPolygon(point, neighborhood.geometry)) {
                markerCounts[name]++;
              }
            }
          });
        });

        // Add density to features
        data.features = data.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            marker_count: markerCounts[feature.properties.name] || 0
          }
        }));

        // Clean up existing layers and source
        const layersToRemove = [
          'neighborhood-boundaries-outline',
          'neighborhood-boundaries-layer',
          'neighborhood-labels'
        ];

        // Remove layers first
        layersToRemove.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });

        // Then remove source
        if (map.current.getSource('neighborhood-boundaries')) {
          map.current.removeSource('neighborhood-boundaries');
        }

        // Add source
        map.current.addSource('neighborhood-boundaries', {
          type: 'geojson',
          data: data,
          generateId: true
        });

        // Add layers with initial visibility state
        const boundariesVisibility = visible ? 'visible' : 'none';
        const labelsVisibility = (visible && showLabels) ? 'visible' : 'none';

        // Add fill layer
        map.current.addLayer({
          id: 'neighborhood-boundaries-layer',
          type: 'fill',
          source: 'neighborhood-boundaries',
          layout: {
            visibility: boundariesVisibility
          },
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'marker_count'],
              0, 'rgba(255, 0, 217, 0.1)',
              10, 'rgba(255, 0, 217, 0.3)',
              50, 'rgba(255, 0, 217, 0.5)',
              150, 'rgba(255, 0, 217, 0.7)',
              400, 'rgba(255, 0, 217, 0.9)'
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0.9,
              ['boolean', ['feature-state', 'hover'], false],
              0.8,
              0.6
            ]
          }
        });

        // Add outline layer
        map.current.addLayer({
          id: 'neighborhood-boundaries-outline',
          type: 'line',
          source: 'neighborhood-boundaries',
          layout: {
            visibility: boundariesVisibility
          },
          paint: {
            'line-color': 'white',
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              3,
              ['boolean', ['feature-state', 'hover'], false],
              2,
              0
            ],
            'line-opacity': 1
          }
        });

        // Add labels layer
        map.current.addLayer({
          id: 'neighborhood-labels',
          type: 'symbol',
          source: 'neighborhood-boundaries',
          layout: {
            visibility: labelsVisibility,
            'text-field': [
              'format',
              ['get', 'name'],
              { 
                'font-scale': 1.2,
                'font-weight': 'bold',
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                'text-halo-width': 2,
                'text-halo-blur': 1
              },
              '\n',
              {},
              ['get', 'marker_count'],
              { 
                'font-scale': 0.9,
                'text-color': '#FF00D9',
                'font-weight': 'bold',
                'background-color': '#1E293B',
                'padding-left': 8,
                'padding-right': 8,
                'padding-top': 2,
                'padding-bottom': 2,
                'border-radius': 4,
                'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                'text-halo-width': 1,
                'text-halo-blur': 0.5
              },
              ' sites',
              { 
                'font-scale': 0.9,
                'text-color': 'rgba(255, 255, 255, 0.8)',
                'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                'text-halo-width': 1,
                'text-halo-blur': 0.5
              }
            ],
            'text-size': 14,
            'text-anchor': 'center',
            'text-justify': 'center',
            'text-allow-overlap': false,
            'text-variable-anchor': ['center'],
            'text-radial-offset': 0,
            'text-optional': true,
            'symbol-sort-key': ['get', 'marker_count']
          }
        });

        // Variables to track the hovered and selected features
        let hoveredStateId = null;
        let selectedStateId = null;

        // Add hover effect
        map.current.on('mousemove', 'neighborhood-boundaries-layer', (e) => {
          if (e.features.length > 0) {
            map.current.getCanvas().style.cursor = 'pointer';
            
            if (hoveredStateId !== null && hoveredStateId !== selectedStateId) {
              map.current.setFeatureState(
                { source: 'neighborhood-boundaries', id: hoveredStateId },
                { hover: false }
              );
            }

            hoveredStateId = e.features[0].id;
            if (hoveredStateId !== selectedStateId) {
              map.current.setFeatureState(
                { source: 'neighborhood-boundaries', id: hoveredStateId },
                { hover: true }
              );
            }
          }
        });

        map.current.on('mouseleave', 'neighborhood-boundaries-layer', () => {
          map.current.getCanvas().style.cursor = '';
          if (hoveredStateId !== null && hoveredStateId !== selectedStateId) {
            map.current.setFeatureState(
              { source: 'neighborhood-boundaries', id: hoveredStateId },
              { hover: false }
            );
          }
          hoveredStateId = null;
        });

        // Update click handler to maintain selection
        map.current.on('click', 'neighborhood-boundaries-layer', (e) => {
          if (!e.features?.length) return;
          
          const feature = e.features[0];
          const neighborhoodName = feature.properties.name;
          const markerCount = feature.properties.marker_count;
          
          console.log('\n=== Neighborhood Click ===');
          console.log(`Clicking ${neighborhoodName} (${markerCount} sites)`);

          // Clear previous selection if exists and it's not the same feature
          if (selectedStateId !== null && selectedStateId !== feature.id) {
            map.current.setFeatureState(
              { source: 'neighborhood-boundaries', id: selectedStateId },
              { selected: false, hover: false }
            );
          }

          // Toggle selection if clicking the same feature, otherwise select new feature
          if (selectedStateId === feature.id) {
            console.log('Deselecting neighborhood');
            selectedStateId = null;
            map.current.setFeatureState(
              { source: 'neighborhood-boundaries', id: feature.id },
              { selected: false, hover: false }
            );
          } else {
            console.log('Selecting neighborhood');
            selectedStateId = feature.id;
            map.current.setFeatureState(
              { source: 'neighborhood-boundaries', id: feature.id },
              { selected: true, hover: false }
            );
          }

          // Find all markers in this neighborhood
          const markersInNeighborhood = {
            adaptiveReuse: [],
            development: []
          };

          allMarkers.forEach(marker => {
            if (marker.geometry?.coordinates) {
              const point = [...marker.geometry.coordinates];
              if (Math.abs(point[0]) < 90 && Math.abs(point[1]) > 90) {
                point.reverse();
              }
              if (turf.booleanPointInPolygon(point, feature.geometry)) {
                if (planningData.adaptiveReuse.includes(marker)) {
                  markersInNeighborhood.adaptiveReuse.push(marker);
                } else if (planningData.development.includes(marker)) {
                  markersInNeighborhood.development.push(marker);
                }
              }
            }
          });

          onNeighborhoodClick({
            name: neighborhoodName,
            markerCount,
            adaptiveReuse: markersInNeighborhood.adaptiveReuse,
            development: markersInNeighborhood.development,
            geometry: feature.geometry
          });
        });

        console.log('=== Neighborhood Boundaries Setup Complete ===\n');
      } catch (error) {
        console.error('Error setting up neighborhood boundaries:', error);
      }
    };

    setupBoundaries();

    return () => {
      if (map.current) {
        // Remove event listeners
        map.current.off('mousemove', 'neighborhood-boundaries-layer');
        map.current.off('mouseleave', 'neighborhood-boundaries-layer');
        map.current.off('click', 'neighborhood-boundaries-layer');

        // Remove layers first
        const layersToRemove = [
          'neighborhood-boundaries-outline',
          'neighborhood-boundaries-layer',
          'neighborhood-labels'
        ];

        layersToRemove.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });

        // Then remove source
        if (map.current.getSource('neighborhood-boundaries')) {
          map.current.removeSource('neighborhood-boundaries');
        }
      }
    };
  }, [map, planningData]);

  // Handle visibility changes separately
  useEffect(() => {
    if (!map?.current) return;
    
    // Boundaries and outline layers depend only on the 'visible' prop
    const boundaryLayers = [
      'neighborhood-boundaries-outline',
      'neighborhood-boundaries-layer'
    ];

    boundaryLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
    });

    // Labels layer depends on both 'visible' and 'showLabels' props
    if (map.current.getLayer('neighborhood-labels')) {
      map.current.setLayoutProperty(
        'neighborhood-labels',
        'visibility',
        (visible && showLabels) ? 'visible' : 'none'
      );
    }
  }, [map, visible, showLabels]);

  if (!visible) return null;

  return (
    <LegendContainer>
      <LegendTitle>Planning Analysis Density</LegendTitle>
      <LegendItem>
        <LegendColor color="rgba(255, 0, 217, 0.1)" />
        <span>Very Low (0-10)</span>
      </LegendItem>
      <LegendItem>
        <LegendColor color="rgba(255, 0, 217, 0.3)" />
        <span>Low (11-50)</span>
      </LegendItem>
      <LegendItem>
        <LegendColor color="rgba(255, 0, 217, 0.5)" />
        <span>Medium (51-150)</span>
      </LegendItem>
      <LegendItem>
        <LegendColor color="rgba(255, 0, 217, 0.7)" />
        <span>High (151-400)</span>
      </LegendItem>
    </LegendContainer>
  );
};

export default NeighborhoodBoundaries; 