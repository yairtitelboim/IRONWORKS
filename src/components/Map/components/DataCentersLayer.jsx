import React, { useEffect, useState, useRef } from 'react';
import * as turf from '@turf/turf';
import { COLORS } from '../constants/layerConstants';
import { getLayerManager } from '../utils/layerManager';
import DataCenterPopup from './DataCenterPopup';
import { createPortal } from 'react-dom';

const { centroid, circle } = turf;

const DataCentersLayer = ({ map, visible }) => {
  const [selectedDataCenter, setSelectedDataCenter] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [clickedCoordinates, setClickedCoordinates] = useState(null);
  const popupContainerRef = useRef(null);
  const [clickedLngLat, setClickedLngLat] = useState(null);
  const [showRadiusCircle, setShowRadiusCircle] = useState(false);
  const [radiusCircleSource, setRadiusCircleSource] = useState(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;
    const layerManager = getLayerManager(mapInstance);
    
    const DATA_CENTERS_SOURCE_ID = 'data-centers-source';
    const DATA_CENTERS_FILL_LAYER_ID = 'data-centers-fill-layer';
    const DATA_CENTERS_LINE_LAYER_ID = 'data-centers-line-layer';
    const DATA_CENTERS_POINT_SOURCE_ID = 'data-centers-point-source';
    const DATA_CENTERS_POINT_LAYER_ID = 'data-centers-point-layer';
    const DATA_CENTERS_CIRCLES_SOURCE_ID = 'data-centers-circles-source';
    const DATA_CENTERS_CIRCLES_LAYER_ID = 'data-centers-circles-layer';
    const DATA_CENTERS_CIRCLES_5MI_SOURCE_ID = 'data-centers-circles-5mi-source';
    const DATA_CENTERS_CIRCLES_5MI_LAYER_ID = 'data-centers-circles-5mi-layer';

    // Always add the global navigation function
    window.goToDataCenters = () => {
      console.log(`🛫 Flying to San Antonio data centers area...`);
      mapInstance.flyTo({
        center: [-98.6858, 29.4724], // Center of San Antonio data centers
        zoom: 11,
        duration: 2000
      });
    };

    // Handle click events
    const handleClick = (e) => {
      const properties = e.features[0].properties;
      console.log(`🏢 Clicked data center:`, properties);
      
      // Calculate popup position
      const point = mapInstance.project(e.lngLat);
      const coords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      
      console.log(`📍 Popup position:`, { x: point.x, y: point.y });
      console.log(`📍 Coordinates:`, coords);
      
      setPopupPosition({ x: point.x, y: point.y });
      setSelectedDataCenter(properties);
      setClickedCoordinates(coords);
      setClickedLngLat(e.lngLat);
      
      // Create and show radius circle
      const radiusCircle = turf.circle([e.lngLat.lng, e.lngLat.lat], 900, { 
        steps: 64, 
        units: 'feet' 
      });
      setRadiusCircleSource(radiusCircle);
      setShowRadiusCircle(true);
    };

    if (visible) {
      // Always re-create centroid and circle sources/layers when toggled ON
      fetch('/data/osm/corridor_data_center.geojson')
        .then(response => response.json())
        .then(data => {
          // Safely remove old layers and sources using LayerManager
          const layersToRemove = [
            DATA_CENTERS_POINT_LAYER_ID,
            'data-centers-circles-fill-layer',
            'data-centers-circles-5mi-fill-layer'
          ];
          
          const sourcesToRemove = [
            DATA_CENTERS_POINT_SOURCE_ID,
            DATA_CENTERS_CIRCLES_SOURCE_ID,
            DATA_CENTERS_CIRCLES_5MI_SOURCE_ID
          ];
          
          layerManager.removeLayersAndSources(layersToRemove, sourcesToRemove);
          
          // Wait for cleanup to complete before adding new layers
          setTimeout(() => {
            // Compute centroids for point markers
            const pointFeatures = data.features.map(f => {
              const c = centroid(f);
              c.properties = { ...f.properties };
              return c;
            });
            const pointGeojson = { type: 'FeatureCollection', features: pointFeatures };
            
            // Safely add new source and layer
            if (layerManager.addSource(DATA_CENTERS_POINT_SOURCE_ID, { type: 'geojson', data: pointGeojson })) {
              layerManager.addLayer({
                id: DATA_CENTERS_POINT_LAYER_ID,
                type: 'circle',
                source: DATA_CENTERS_POINT_SOURCE_ID,
                paint: {
                  'circle-radius': 7,
                  'circle-color': COLORS.dataCenter,
                  'circle-opacity': 0.95
                },
                layout: { visibility: 'visible' }
              });
            }

            // Create circle features
            const circleFeatures = pointFeatures.map((f, i) => {
              const circ = circle(f.geometry.coordinates, 0.25, { steps: 80, units: 'miles' });
              circ.properties = { ...f.properties, id: `data-center-circle-${i}`, pulse: 0 };
              return circ;
            });
            
            const circle5miFeatures = pointFeatures.map((f, i) => {
              const circ = circle(f.geometry.coordinates, 2.5, { steps: 80, units: 'miles' });
              circ.properties = { ...f.properties, id: `data-center-circle5mi-${i}`, pulse: 0 };
              return circ;
            });

            const circlesGeojson = { type: 'FeatureCollection', features: circleFeatures };
            const circles5miGeojson = { type: 'FeatureCollection', features: circle5miFeatures };

            // Add circle layers
            if (layerManager.addSource(DATA_CENTERS_CIRCLES_SOURCE_ID, { type: 'geojson', data: circlesGeojson })) {
              // Add fill layer for circles (visible when zoomed out)
              layerManager.addLayer({
                id: 'data-centers-circles-fill-layer',
                type: 'fill',
                source: DATA_CENTERS_CIRCLES_SOURCE_ID,
                paint: {
                  'fill-color': COLORS.dataCenter,
                  'fill-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.02,
                      0.5, 0.15,
                      1, 0.02
                    ],
                    10, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.05,
                      0.5, 0.2,
                      1, 0.05
                    ],
                    12, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.03,
                      0.5, 0.12,
                      1, 0.03
                    ]
                  ]
                },
                layout: { visibility: 'visible' },
                maxzoom: 12
              });
              
              // Add line layer for circles (DISABLED - keeping only fill)
              // layerManager.addLayer({
              //   id: DATA_CENTERS_CIRCLES_LAYER_ID,
              //   type: 'line',
              //   source: DATA_CENTERS_CIRCLES_SOURCE_ID,
              //   paint: {
              //     'line-color': COLORS.dataCenter,
              //     'line-width': 2,
              //     'line-dasharray': [2, 2],
              //     'line-opacity': 0.7
              //   },
              //   layout: { visibility: 'visible' }
              // });
            }

            // Add 5-mile circles
            if (layerManager.addSource(DATA_CENTERS_CIRCLES_5MI_SOURCE_ID, { type: 'geojson', data: circles5miGeojson })) {
              // Add fill layer for 5-mile circles (visible when zoomed out)
              layerManager.addLayer({
                id: 'data-centers-circles-5mi-fill-layer',
                type: 'fill',
                source: DATA_CENTERS_CIRCLES_5MI_SOURCE_ID,
                paint: {
                  'fill-color': '#00FF00',
                  'fill-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.01,
                      0.5, 0.1,
                      1, 0.01
                    ],
                    8, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.03,
                      0.5, 0.15,
                      1, 0.03
                    ],
                    10, [
                      'interpolate',
                      ['linear'],
                      ['get', 'pulse'],
                      0, 0.02,
                      0.5, 0.1,
                      1, 0.02
                    ]
                  ]
                },
                layout: { visibility: 'visible' },
                maxzoom: 10
              });
              
              // Add line layer for 5-mile circles (DISABLED - keeping only fill)
              // layerManager.addLayer({
              //   id: DATA_CENTERS_CIRCLES_5MI_LAYER_ID,
              //   type: 'line',
              //   source: DATA_CENTERS_CIRCLES_5MI_SOURCE_ID,
              //   paint: {
              //     'line-color': '#00FF00',
              //     'line-width': 1,
              //     'line-dasharray': [6, 4],
              //     'line-opacity': 0.5
              //   },
              //   layout: { visibility: 'visible' },
              //   maxzoom: 10
              // });
            }
            
            // Safely move layers to top after a delay
            setTimeout(() => {
              layerManager.moveLayer(DATA_CENTERS_POINT_LAYER_ID);
              layerManager.moveLayer('data-centers-circles-fill-layer');
              layerManager.moveLayer('data-centers-circles-5mi-fill-layer');
            }, 100);

            // Start pulse animation for fill layers
            let pulseValue = 0;
            const pulseAnimation = () => {
              pulseValue = (pulseValue + 0.005) % 1;
              
              // Update pulse property for both circle sources
              if (layerManager.sourceExists(DATA_CENTERS_CIRCLES_SOURCE_ID)) {
                const source = mapInstance.getSource(DATA_CENTERS_CIRCLES_SOURCE_ID);
                if (source && source._data) {
                  source._data.features.forEach(feature => {
                    feature.properties.pulse = pulseValue;
                  });
                  source.setData(source._data);
                }
              }
              
              if (layerManager.sourceExists(DATA_CENTERS_CIRCLES_5MI_SOURCE_ID)) {
                const source = mapInstance.getSource(DATA_CENTERS_CIRCLES_5MI_SOURCE_ID);
                if (source && source._data) {
                  source._data.features.forEach(feature => {
                    feature.properties.pulse = pulseValue;
                  });
                  source.setData(source._data);
                }
              }
              
              requestAnimationFrame(pulseAnimation);
            };
            
            // Start the pulse animation
            pulseAnimation();
          }, 100);
        })
        .catch(error => {
          console.error('Error loading data centers data:', error);
        });

      // Add main source if it doesn't exist
      if (!layerManager.sourceExists(DATA_CENTERS_SOURCE_ID)) {
        layerManager.addSource(DATA_CENTERS_SOURCE_ID, {
          type: 'geojson',
          data: '/data/osm/corridor_data_center.geojson'
        });
      }

      // Add fill layer for data center buildings
      if (!layerManager.layerExists(DATA_CENTERS_FILL_LAYER_ID)) {
        console.log(`✅ Adding data centers fill layer with bright green color: ${COLORS.dataCenter}`);
        layerManager.addLayer({
          id: DATA_CENTERS_FILL_LAYER_ID,
          type: 'fill',
          source: DATA_CENTERS_SOURCE_ID,
          paint: {
            'fill-color': COLORS.dataCenter,
            'fill-opacity': 0.6
          },
          layout: { visibility: 'visible' }
        });

        // Verify the layer was added
        setTimeout(() => {
          const layerExists = layerManager.layerExists(DATA_CENTERS_FILL_LAYER_ID);
          const sourceExists = layerManager.sourceExists(DATA_CENTERS_SOURCE_ID);
          console.log(`🔍 Layer verification - Layer exists: ${layerExists}, Source exists: ${sourceExists}`);
        }, 50);
      } else {
        console.log(`🔄 Updating existing data centers fill layer visibility to visible`);
        if (mapInstance.setLayoutProperty) {
          mapInstance.setLayoutProperty(DATA_CENTERS_FILL_LAYER_ID, 'visibility', 'visible');
          mapInstance.setPaintProperty(DATA_CENTERS_FILL_LAYER_ID, 'fill-color', COLORS.dataCenter);
          mapInstance.setPaintProperty(DATA_CENTERS_FILL_LAYER_ID, 'fill-opacity', 0.6);
        }
      }

      // Add outline layer for better visibility
      if (!layerManager.layerExists(DATA_CENTERS_LINE_LAYER_ID)) {
        console.log(`✅ Adding data centers outline layer with bright green color: ${COLORS.dataCenter}`);
        layerManager.addLayer({
          id: DATA_CENTERS_LINE_LAYER_ID,
          type: 'line',
          source: DATA_CENTERS_SOURCE_ID,
          paint: {
            'line-color': COLORS.dataCenter,
            'line-width': 2,
            'line-opacity': 0.8
          },
          layout: { visibility: 'visible' }
        });

        // Move layers to top
        setTimeout(() => {
          layerManager.moveLayer(DATA_CENTERS_FILL_LAYER_ID);
          layerManager.moveLayer(DATA_CENTERS_LINE_LAYER_ID);
          console.log(`⬆️  Moved data center layers to top of layer stack`);
        }, 50);
      } else {
        console.log(`🔄 Updating existing data centers outline layer visibility to visible`);
        if (mapInstance.setLayoutProperty) {
          mapInstance.setLayoutProperty(DATA_CENTERS_LINE_LAYER_ID, 'visibility', 'visible');
          mapInstance.setPaintProperty(DATA_CENTERS_LINE_LAYER_ID, 'line-color', COLORS.dataCenter);
          mapInstance.setPaintProperty(DATA_CENTERS_LINE_LAYER_ID, 'line-width', 2);
          mapInstance.setPaintProperty(DATA_CENTERS_LINE_LAYER_ID, 'line-opacity', 0.8);
        }
      }

      // Add event listeners
      mapInstance.on('click', DATA_CENTERS_FILL_LAYER_ID, handleClick);
      mapInstance.on('click', DATA_CENTERS_LINE_LAYER_ID, handleClick);
      mapInstance.on('click', DATA_CENTERS_POINT_LAYER_ID, handleClick);

      // Change cursor on hover
      mapInstance.on('mouseenter', DATA_CENTERS_FILL_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', DATA_CENTERS_FILL_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      mapInstance.on('mouseenter', DATA_CENTERS_LINE_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', DATA_CENTERS_LINE_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      mapInstance.on('mouseenter', DATA_CENTERS_POINT_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', DATA_CENTERS_POINT_LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = '';
      });

    } else {
      // Hide layers
      if (layerManager.layerExists(DATA_CENTERS_FILL_LAYER_ID)) {
        mapInstance.setLayoutProperty(DATA_CENTERS_FILL_LAYER_ID, 'visibility', 'none');
      }
      if (layerManager.layerExists(DATA_CENTERS_LINE_LAYER_ID)) {
        mapInstance.setLayoutProperty(DATA_CENTERS_LINE_LAYER_ID, 'visibility', 'none');
      }
      if (layerManager.layerExists(DATA_CENTERS_POINT_LAYER_ID)) {
        mapInstance.setLayoutProperty(DATA_CENTERS_POINT_LAYER_ID, 'visibility', 'none');
      }
      if (layerManager.layerExists('data-centers-circles-fill-layer')) {
        mapInstance.setLayoutProperty('data-centers-circles-fill-layer', 'visibility', 'none');
      }
      if (layerManager.layerExists('data-centers-circles-5mi-fill-layer')) {
        mapInstance.setLayoutProperty('data-centers-circles-5mi-fill-layer', 'visibility', 'none');
      }
    }

    return () => {
      // Cleanup event listeners
      mapInstance.off('click', DATA_CENTERS_FILL_LAYER_ID, handleClick);
      mapInstance.off('click', DATA_CENTERS_LINE_LAYER_ID, handleClick);
      mapInstance.off('click', DATA_CENTERS_POINT_LAYER_ID, handleClick);
      mapInstance.off('mouseenter', DATA_CENTERS_FILL_LAYER_ID);
      mapInstance.off('mouseleave', DATA_CENTERS_FILL_LAYER_ID);
      mapInstance.off('mouseenter', DATA_CENTERS_LINE_LAYER_ID);
      mapInstance.off('mouseleave', DATA_CENTERS_LINE_LAYER_ID);
      mapInstance.off('mouseenter', DATA_CENTERS_POINT_LAYER_ID);
      mapInstance.off('mouseleave', DATA_CENTERS_POINT_LAYER_ID);
      
      // Cleanup layers and sources
      const cleanupLayers = [
        DATA_CENTERS_POINT_LAYER_ID,
        'data-centers-circles-fill-layer',
        'data-centers-circles-5mi-fill-layer'
      ];
      
      const cleanupSources = [
        DATA_CENTERS_POINT_SOURCE_ID,
        DATA_CENTERS_CIRCLES_SOURCE_ID,
        DATA_CENTERS_CIRCLES_5MI_SOURCE_ID
      ];
      
      layerManager.removeLayersAndSources(cleanupLayers, cleanupSources);
    };
  }, [map, visible]);

  // Separate effect for popup positioning
  useEffect(() => {
    if (!map?.current || !selectedDataCenter || !clickedLngLat) return;

    const mapInstance = map.current;
    
    // Function to update popup position when map moves
    const updatePopupPosition = () => {
      if (selectedDataCenter && clickedLngLat) {
        const point = mapInstance.project(clickedLngLat);
        setPopupPosition({ x: point.x, y: point.y });
      }
    };

    // Add map movement listeners to update popup position
    mapInstance.on('move', updatePopupPosition);
    mapInstance.on('zoom', updatePopupPosition);
    mapInstance.on('pitch', updatePopupPosition);
    mapInstance.on('bearing', updatePopupPosition);

    return () => {
      // Cleanup map movement listeners
      mapInstance.off('move', updatePopupPosition);
      mapInstance.off('zoom', updatePopupPosition);
      mapInstance.off('pitch', updatePopupPosition);
      mapInstance.off('bearing', updatePopupPosition);
    };
  }, [map, selectedDataCenter, clickedLngLat]);

  // Effect for radius circle layer
  useEffect(() => {
    if (!map?.current || !showRadiusCircle || !radiusCircleSource) return;

    const mapInstance = map.current;
    const RADIUS_CIRCLE_SOURCE_ID = 'data-center-radius-circle-source';
    const RADIUS_CIRCLE_LAYER_ID = 'data-center-radius-circle-layer';

    // Remove existing radius circle if any
    if (mapInstance.getLayer(RADIUS_CIRCLE_LAYER_ID)) {
      mapInstance.removeLayer(RADIUS_CIRCLE_LAYER_ID);
    }
    if (mapInstance.getSource(RADIUS_CIRCLE_SOURCE_ID)) {
      mapInstance.removeSource(RADIUS_CIRCLE_SOURCE_ID);
    }

    // Add radius circle source and layer
    mapInstance.addSource(RADIUS_CIRCLE_SOURCE_ID, {
      type: 'geojson',
      data: radiusCircleSource
    });

    mapInstance.addLayer({
      id: RADIUS_CIRCLE_LAYER_ID,
      type: 'fill',
      source: RADIUS_CIRCLE_SOURCE_ID,
      paint: {
        'fill-color': '#00FF00',
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse'],
          0, 0.1,
          0.5, 0.4,
          1, 0.1
        ]
      }
    });

    // Start pulse animation
    let pulseValue = 0;
    const pulseAnimation = () => {
      if (!showRadiusCircle) return;
      
      pulseValue = (pulseValue + 0.005) % 1;
      
      if (mapInstance.getSource(RADIUS_CIRCLE_SOURCE_ID)) {
        const source = mapInstance.getSource(RADIUS_CIRCLE_SOURCE_ID);
        if (source) {
          // Create new data with updated pulse value
          const updatedData = {
            type: 'FeatureCollection',
            features: [{
              ...radiusCircleSource,
              properties: { pulse: pulseValue }
            }]
          };
          source.setData(updatedData);
        }
      }
      
      requestAnimationFrame(pulseAnimation);
    };
    
    pulseAnimation();

    return () => {
      if (mapInstance.getLayer(RADIUS_CIRCLE_LAYER_ID)) {
        mapInstance.removeLayer(RADIUS_CIRCLE_LAYER_ID);
      }
      if (mapInstance.getSource(RADIUS_CIRCLE_SOURCE_ID)) {
        mapInstance.removeSource(RADIUS_CIRCLE_SOURCE_ID);
      }
    };
  }, [map, showRadiusCircle, radiusCircleSource]);

  return (
    <>
      {selectedDataCenter && createPortal(
        <DataCenterPopup
          dataCenter={selectedDataCenter}
          position={popupPosition}
          coordinates={clickedCoordinates}
          onClose={() => {
            console.log(`❌ Closing popup`);
            setSelectedDataCenter(null);
            setClickedCoordinates(null);
            setClickedLngLat(null);
            setShowRadiusCircle(false);
            setRadiusCircleSource(null);
          }}
        />,
        document.body
      )}
    </>
  );
};

export default DataCentersLayer;
