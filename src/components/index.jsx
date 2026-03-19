import React, { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_CONFIG, BUILDING_COLORS } from './constants';
import { brickellGEOIDs } from './constants/geoIds';
import { 
    initializeGEOIDParticleLayers,
    animateGEOIDParticles,
    stopGEOIDAnimation
} from './hooks/mapAnimations';
import { askClaude, parseClaudeResponse } from '../../services/claude';
import styled from 'styled-components';
import AIChatPanel from './AIChatPanel';
import { 
    addGeoIdTags,
    createPOIToggle,
    highlightPOIBuildings,
    calculateBuildingArea
} from './utils';
import { initializeGEOIDLayer, getGEOIDLayerId, getAllGEOIDLayerIds } from './layers/GEOIDLayer';
import { 
  initializeRoadGrid,
  animateRoadGrid,
  stopRoadAnimation
} from './hooks/mapAnimations';
import crashMonitor from './Map/utils/crashMonitor';

// Set mapbox access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const MapContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  .callout-annotation {
    cursor: default;
    
    &:hover {
      z-index: 2;
    }
  }

  .mapboxgl-marker {
    z-index: 1;
  }

  .custom-popup .mapboxgl-popup-content {
    background: none;
    padding: 0;
    border: none;
    box-shadow: none;
  }

  .custom-popup .mapboxgl-popup-close-button {
    color: white;
    font-size: 16px;
    padding: 4px 8px;
    right: 4px;
    top: 4px;
  }

  .custom-popup .mapboxgl-popup-tip {
    display: none;
  }
`;

const LayerToggleContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px;
  border-radius: 4px;
  z-index: 1;
`;

const ToggleButton = styled.button`
  padding: 8px 12px;
  background: ${props => props.active ? '#4CAF50' : '#666'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 150px;
  text-align: left;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.active ? '#45a049' : '#777'};
  }
`;

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const buildingStates = useRef(new Map());
  const previousHighlight = useRef([]);
  const currentFilter = useRef(null);
  const poiToggleRef = useRef(null);
  const roadAnimationFrame = useRef(null);
  
  const [messages, setMessages] = useState([]);
  // POI state removed - focusing on Denver area
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [isGeoIDVisible, setIsGeoIDVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  // Census blocks state removed - focusing on Denver area
  const [mudVisible, setMudVisible] = useState(true);
  const [selectedPolygonId, setSelectedPolygonId] = useState(null);
  // ERCOT state removed - focusing on Denver area

  const loadingMessages = [
    "Analyzing spatial data...",
    "Processing urban patterns...",
    "Calculating density metrics...",
    "Mapping neighborhood features...",
    "Evaluating development zones..."
  ];

  useEffect(() => {
    let messageInterval;
    if (isLoading) {
      let index = 0;
      setLoadingMessage(loadingMessages[0]);
      messageInterval = setInterval(() => {
        index = (index + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[index]);
      }, 2000);
    }
    return () => clearInterval(messageInterval);
  }, [isLoading]);

  const handleQuestion = async (question) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { isUser: true, content: question }]);

    try {
      const bounds = map.current.getBounds();
      const mapBounds = {
        sw: bounds.getSouthWest(),
        ne: bounds.getNorthEast()
      };

      const response = await askClaude(question, {}, mapBounds);
      const parsedResponse = parseClaudeResponse(response);

      if (parsedResponse.mainText !== "Could not process the response. Please try again.") {
        setMessages(prev => [...prev, {
          isUser: false,
          content: parsedResponse
        }]);
        
        handleLLMResponse(parsedResponse);
      } else {
        throw new Error('Failed to parse response');
      }
    } catch (error) {
      console.error('Error in handleQuestion:', error);
      setMessages(prev => [...prev, {
        isUser: false,
        content: {
          mainText: "I apologize, but I encountered an error processing your request. Please try asking your question again.",
          poiInfo: null,
          followUps: []
        }
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_CONFIG.style,
      center: MAP_CONFIG.center,
      zoom: 1,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      pitch: 0
    });

    const initializeMapLayers = async () => {
      try {
        if (!map.current.isStyleLoaded()) {
          await new Promise(resolve => map.current.once('style.load', resolve));
        }

        // Note: Census blocks data removed - focusing on Denver area
        // Census blocks can be added later with Denver-specific data

        // Then add 3D building layer
        map.current.addLayer({
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 12,
          'paint': {
            'fill-extrusion-color': [
              'case',
              ['boolean', ['feature-state', 'inPowerGrid'], false],
              [
                'interpolate',
                ['linear'],
                ['feature-state', 'yellowIntensity'],
                0, '#8B7355',    // Darker yellow/brown for far buildings
                0.5, '#DAA520',  // Golden yellow for medium distance
                1, '#f7db05'     // Bright yellow for closest buildings
              ],
              ['case',
                ['boolean', ['feature-state', 'isNegative'], false],
                '#380614', // Dark red for negative performance
                ['case',
                  ['boolean', ['feature-state', 'isGreen'], false],
                  '#51ff00', // Bright lime green for high-performing buildings
                  '#1a1a1a'  // Dark gray for other buildings
                ]
              ]
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.7
          }
        });

        // Wait a bit to ensure all base layers are loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize road grid LAST and explicitly on top
        initializeRoadGrid(map.current, {
          beforeId: null  // This ensures it goes on top of everything
        });
        
        // Start road animation
        roadAnimationFrame.current = animateRoadGrid(map.current);

        // Census blocks click handler removed - focusing on Denver area




          // Always show popup when we have ERCOT data
          if (feature.properties.price !== undefined && feature.properties.mw !== undefined) {
            // Remove existing popups
            const existingPopups = document.getElementsByClassName('mapboxgl-popup');
            Array.from(existingPopups).forEach(popup => popup.remove());

            new mapboxgl.Popup({
              className: 'custom-popup',
              closeButton: true,
              maxWidth: '360px',
              closeOnClick: false
            })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="
                  background: rgba(26, 26, 26, 0.95); 
                  padding: 20px;
                  border-radius: 8px; 
                  color: white;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  min-width: 320px;
                ">
                  <div style="
                    display: grid;
                    grid-gap: 12px;
                  ">
                    <div style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    ">
                      <div>
                        <div style="font-size: 24px; color: ${feature.properties.price > 100 ? '#ff4d4d' : '#4CAF50'};">
                          $${feature.properties.price?.toFixed(2)}
                        </div>
                        <div style="font-size: 12px; color: #888;">Current Price/MWh</div>
                      </div>
                      <div style="
                        padding: 4px 8px;
                        border-radius: 4px;
                        background: ${feature.properties.price > 100 ? '#ff4d4d33' : '#4CAF5033'};
                        color: ${feature.properties.price > 100 ? '#ff4d4d' : '#4CAF50'};
                        font-size: 12px;
                      ">
                        ${feature.properties.price > 100 ? '⚠️ High' : '✓ Normal'}
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 20px;">${feature.properties.mw?.toFixed(1)} MW</div>
                      <div style="font-size: 12px; color: #888;">Power Consumption</div>
                    </div>

                    <div style="
                      margin-top: 4px;
                      padding-top: 12px;
                      border-top: 1px solid rgba(255, 255, 255, 0.1);
                      font-size: 12px;
                      color: #888;
                    ">
                      <div style="margin-bottom: 4px;">Source: ERCOT</div>
                      <div style="display: flex; justify-content: space-between;">
                        <div>Block #${feature.properties.OBJECTID}</div>
                        <div>${new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              `)
              .addTo(map.current);
          }
        });

        // Note: POI layers removed - focusing on Denver area
        // POIs can be added later with Denver-specific data

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    map.current.on('load', initializeMapLayers);

    return () => {
      if (map.current) {
        stopRoadAnimation(roadAnimationFrame.current);
      }
    };
  }, [isErcotMode]);

  // POI toggle removed - focusing on Denver area
  // POI functionality can be restored later with Denver-specific data

  // POI visibility toggle removed - focusing on Denver area

  const handleLLMResponse = (response) => {
    if (!map.current) return;

    const clearExistingElements = () => {
      const existingElements = document.querySelectorAll('.mapboxgl-popup, .callout-annotation, .mapboxgl-marker');
      existingElements.forEach(el => el.remove());
      
      if (map.current.getSource('area-highlights')) {
        map.current.getSource('area-highlights').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    };

    clearExistingElements();

    if (response?.coordinates) {
      map.current.flyTo({
        center: response.coordinates,
        zoom: response.zoomLevel,
        duration: 1000
      });

      map.current.once('moveend', () => {
        map.current.once('idle', () => {
          getAllGEOIDLayerIds().forEach((layerId) => {
            if (map.current.getLayer(layerId)) {
              const startTime = performance.now();
              const animationDuration = 500;

              function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);
                const newOpacity = Math.max(0, 1 - (progress * 0.6));

                map.current.setPaintProperty(layerId, 'fill-opacity', newOpacity);

                if (progress < 1) {
                  requestAnimationFrame(animate);
                }
              }

              requestAnimationFrame(animate);
            }
          });

          // POI highlighting removed - focusing on Denver area
        });
      });
    }
  };

  // Census blocks toggle function removed - focusing on Denver area

  const toggleMUD = () => {
    if (!map.current) return;
    
    setMudVisible(prev => {
      const newVisibility = !prev;
      if (map.current.getLayer('mud-districts')) {
        map.current.setLayoutProperty(
          'mud-districts',
          'visibility',
          newVisibility ? 'visible' : 'none'
        );
      }
      return newVisibility;
    });
  };

  const onEachFeature = (feature, layer) => {
    layer.on('click', (e) => {
      const polygonId = feature.properties.OBJECTID;
      console.log('Clicked polygon:', {
        id: polygonId,
        properties: feature.properties
      });
      setSelectedPolygonId(polygonId);
    });
  };

  // ERCOT functions removed - focusing on Denver area

  return (
    <MapContainer>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      
      <LayerToggleContainer>
        {/* Census blocks toggle removed - focusing on Denver area */}
        <ToggleButton 
          active={mudVisible}
          onClick={toggleMUD}
          style={{ height: '20px', padding: '0 8px', fontSize: '12px' }}
        >
          MUD Districts
        </ToggleButton>
        {/* ERCOT functionality removed - focusing on Denver area */}
        {/* POI toggle removed - focusing on Denver area */}
      </LayerToggleContainer>

      <AIChatPanel 
        messages={messages}
        setMessages={setMessages}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleQuestion={handleQuestion}
        map={map}
      />

    </MapContainer>
  );
};

export default MapComponent;

