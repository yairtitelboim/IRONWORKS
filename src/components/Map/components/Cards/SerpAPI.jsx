import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import styled from 'styled-components';

// Styled components for the popup
const PopupCard = styled.div`
  position: absolute;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid rgba(75, 85, 99, 0.5);
  border-radius: 8px;
  padding: 12px 16px;
  color: #f9fafb;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 1001;
  min-width: 200px;
  max-width: 280px;
  pointer-events: auto;
`;

const PopupTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  color: #ffffff;
`;

const PopupInfo = styled.div`
  color: #d1d5db;
  margin-bottom: 4px;
  font-size: 11px;
`;

const PopupCategory = styled.div`
  display: inline-block;
  background: ${props => props.color};
  color: #000000;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
  margin-top: 8px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(75, 85, 99, 0.5);
  border: none;
  color: #d1d5db;
  border-radius: 4px;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(75, 85, 99, 0.8);
    color: #ffffff;
  }
`;

const PopupValue = styled.span`
  color: #d1d5db;
  font-size: 11px;
  margin-left: 8px;
`;

const PopupLabel = styled.span`
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
`;

const PopupCloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
`;

const SerpAPI = ({ 
  onClick, 
  title = "Query SERP Infrastructure", 
  aiState, 
  map, 
  onLoadingChange,
  disabled = false,
  position = { top: '0px', left: '0px' },
  updateToolFeedback = null // Add tool feedback callback prop
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [popup, setPopup] = useState(null);
  const [popupData, setPopupData] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Function to fetch infrastructure data from SERP API
  const fetchInfrastructureData = async (lat, lng, marker) => {
    try {
      console.log('🔍 Fetching SERP infrastructure data around:', { lat, lng });
      
      // Clear any existing SERP data before starting new search
      clearSerpData();
      
      // Array of infrastructure queries to search for - using location parameters instead of embedding coordinates
      const infrastructureQueries = [
        'power plants',
        'electric utilities',
        'data centers',
        'highways',
        'telecommunications',
        'industrial facilities',
        'airports',
        'businesses'
      ];

      // Fallback queries if primary ones don't work
      const fallbackQueries = [
        'power plants',
        'water infrastructure',
        'data centers',
        'highways',
        'electric utilities',
        'telecommunications'
      ];

      const allInfrastructureFeatures = [];
      
      // Fetch data for each infrastructure type
      for (const query of infrastructureQueries) {
        console.log(`🔍 Querying SERP for: ${query} at location ${lat},${lng}`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
          
          const response = await fetch(`http://localhost:3001/api/serp?engine=google&q=${encodeURIComponent(query)}&ll=${lat},${lng}&radius=3`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.warn(`⚠️ SERP API error for query "${query}":`, response.status);
            continue;
          }
          
          const data = await response.json();
          console.log(`📡 SERP Response for "${query}":`, data);
          console.log(`🔍 Data structure check:`, {
            hasLocalResults: !!data.local_results,
            hasPlaces: !!(data.local_results && data.local_results.places),
            localResultsKeys: data.local_results ? Object.keys(data.local_results) : 'none',
            placesType: data.local_results?.places ? typeof data.local_results.places : 'none',
            placesLength: data.local_results?.places ? data.local_results.places.length : 'none'
          });
          
          // Process local results if available
          if (data.local_results && data.local_results.places) {
            const places = data.local_results.places;
            console.log(`📍 Found ${places.length} places for "${query}"`);
            
            places.forEach((place, index) => {
              console.log(`📍 Processing place ${index}:`, {
                title: place.title,
                type: place.type,
                hasGps: !!(place.gps_coordinates),
                gpsKeys: place.gps_coordinates ? Object.keys(place.gps_coordinates) : 'none',
                lat: place.gps_coordinates?.latitude,
                lng: place.gps_coordinates?.longitude
              });
              
              if (place.gps_coordinates && place.gps_coordinates.latitude && place.gps_coordinates.longitude) {
                // Determine infrastructure category based on query and place type
                let category = 'other';
                let icon = '🏢';
                
                if (query.includes('power') || place.type?.toLowerCase().includes('power')) {
                  category = 'power';
                  icon = '⚡';
                } else if (query.includes('water') || place.type?.toLowerCase().includes('water')) {
                  category = 'water';
                  icon = '💧';
                } else if (query.includes('data center') || place.type?.toLowerCase().includes('data')) {
                  category = 'datacenter';
                  icon = '🖥️';
                } else if (query.includes('highway') || place.type?.toLowerCase().includes('highway')) {
                  category = 'transportation';
                  icon = '🛣️';
                } else if (query.includes('electric') || place.type?.toLowerCase().includes('electric')) {
                  category = 'electricity';
                  icon = '🔌';
                } else if (query.includes('telecommunications') || place.type?.toLowerCase().includes('telecom')) {
                  category = 'telecom';
                  icon = '📡';
                } else if (query.includes('industrial') || place.type?.toLowerCase().includes('industrial')) {
                  category = 'industrial';
                  icon = '🏭';
                } else if (query.includes('manufacturing') || place.type?.toLowerCase().includes('manufacturing')) {
                  category = 'manufacturing';
                  icon = '🏭';
                } else if (query.includes('warehouse') || place.type?.toLowerCase().includes('warehouse')) {
                  category = 'warehouse';
                  icon = '📦';
                } else if (query.includes('refinery') || place.type?.toLowerCase().includes('refinery')) {
                  category = 'refinery';
                  icon = '🛢️';
                } else if (query.includes('chemical') || place.type?.toLowerCase().includes('chemical')) {
                  category = 'chemical';
                  icon = '🧪';
                } else if (query.includes('steel') || place.type?.toLowerCase().includes('steel')) {
                  category = 'steel';
                  icon = '🏭';
                } else if (query.includes('oil') || query.includes('gas') || place.type?.toLowerCase().includes('oil')) {
                  category = 'oil_gas';
                  icon = '🛢️';
                } else if (query.includes('railroad') || place.type?.toLowerCase().includes('rail')) {
                  category = 'railroad';
                  icon = '🚂';
                } else if (query.includes('airport') || place.type?.toLowerCase().includes('airport')) {
                  category = 'airport';
                  icon = '✈️';
                } else if (query.includes('business') || place.type?.toLowerCase().includes('business')) {
                  category = 'business';
                  icon = '🏢';
                } else if (query.includes('facility') || place.type?.toLowerCase().includes('facility')) {
                  category = 'facility';
                  icon = '🏭';
                } else if (query.includes('building') || place.type?.toLowerCase().includes('building')) {
                  category = 'building';
                  icon = '🏗️';
                }
                
                const feature = {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [place.gps_coordinates.longitude, place.gps_coordinates.latitude]
                  },
                  properties: {
                    serp_id: `${place.place_id || index}`,
                    name: place.title || 'Unnamed Facility',
                    category: category,
                    type: place.type || 'Unknown',
                    rating: place.rating || null,
                    reviews: place.reviews || null,
                    phone: place.phone || null,
                    address: place.address || null,
                    website: place.links?.website || null,
                    directions: place.links?.directions || null,
                    icon: icon,
                    source: 'serp_api',
                    query: query
                  }
                };
                
                allInfrastructureFeatures.push(feature);
                console.log(`📍 Added ${category} facility:`, place.title, 'at', [place.gps_coordinates.longitude, place.gps_coordinates.latitude]);
                console.log(`✅ Feature created:`, feature);
              }
            });
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.warn(`⚠️ SERP API timeout for query "${query}" (20s limit)`);
          } else {
            console.warn(`⚠️ SERP API fetch error for query "${query}":`, error.message);
          }
          continue;
        }
        
        // Small delay between queries to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`🏗️ Total infrastructure features found: ${allInfrastructureFeatures.length}`);
      
      // Update feedback for data processing - consistent with OSM pattern
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'serp',
          status: '🏗️ Processing SERP data...',
          progress: 85,
          details: `Processed ${allInfrastructureFeatures.length} infrastructure facilities. Adding to map...`
        });
      }
      
      // Emit SERP data to global event bus for legend component
      if (window.mapEventBus) {
        window.mapEventBus.emit('serp:dataLoaded', {
          features: allInfrastructureFeatures,
          timestamp: Date.now()
        });
      }
      
      // Add infrastructure features to the map
      if (map.current && allInfrastructureFeatures.length > 0) {
        // Create GeoJSON for SERP data
        const serpGeoJSON = {
          type: 'FeatureCollection',
          features: allInfrastructureFeatures
        };
        
        // Add SERP data source
        map.current.addSource('serp-infrastructure', {
          type: 'geojson',
          data: serpGeoJSON
        });
        
        // Add markers for all infrastructure points
        map.current.addLayer({
          id: 'serp-infrastructure-markers',
          type: 'circle',
          source: 'serp-infrastructure',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'category'], 'power'], 8,
              ['==', ['get', 'category'], 'datacenter'], 10,
              ['==', ['get', 'category'], 'water'], 7,
              ['==', ['get', 'category'], 'transportation'], 6,
              ['==', ['get', 'category'], 'electricity'], 8,
              ['==', ['get', 'category'], 'telecom'], 7,
              ['==', ['get', 'category'], 'industrial'], 9,
              ['==', ['get', 'category'], 'manufacturing'], 9,
              ['==', ['get', 'category'], 'warehouse'], 8,
              ['==', ['get', 'category'], 'refinery'], 10,
              ['==', ['get', 'category'], 'chemical'], 9,
              ['==', ['get', 'category'], 'steel'], 9,
              ['==', ['get', 'category'], 'oil_gas'], 10,
              ['==', ['get', 'category'], 'railroad'], 8,
              ['==', ['get', 'category'], 'airport'], 12,
              ['==', ['get', 'category'], 'business'], 7,
              ['==', ['get', 'category'], 'facility'], 8,
              ['==', ['get', 'category'], 'building'], 7,
              6
            ],
            'circle-color': [
              'case',
              ['==', ['get', 'category'], 'power'], '#f59e0b', // Orange for power
              ['==', ['get', 'category'], 'datacenter'], '#3b82f6', // Blue for data centers
              ['==', ['get', 'category'], 'water'], '#0ea5e9', // Blue for water
              ['==', ['get', 'category'], 'transportation'], '#10b981', // Green for transportation
              ['==', ['get', 'category'], 'electricity'], '#f59e0b', // Orange for electricity
              ['==', ['get', 'category'], 'telecom'], '#8b5cf6', // Purple for telecom
              ['==', ['get', 'category'], 'industrial'], '#dc2626', // Red for industrial
              ['==', ['get', 'category'], 'manufacturing'], '#dc2626', // Red for manufacturing
              ['==', ['get', 'category'], 'warehouse'], '#7c3aed', // Purple for warehouse
              ['==', ['get', 'category'], 'refinery'], '#b91c1c', // Dark red for refinery
              ['==', ['get', 'category'], 'chemical'], '#059669', // Green for chemical
              ['==', ['get', 'category'], 'steel'], '#1f2937', // Dark gray for steel
              ['==', ['get', 'category'], 'oil_gas'], '#92400e', // Brown for oil/gas
              ['==', ['get', 'category'], 'railroad'], '#1e40af', // Blue for railroad
              ['==', ['get', 'category'], 'airport'], '#be185d', // Pink for airport
              ['==', ['get', 'category'], 'business'], '#6366f1', // Indigo for business
              ['==', ['get', 'category'], 'facility'], '#f97316', // Orange for facility
              ['==', ['get', 'category'], 'building'], '#84cc16', // Lime for building
              '#6b7280' // Gray for others
            ],
            'circle-stroke-width': 0,
            'circle-stroke-color': '#ffffff'
          }
        });
        



        
        console.log('✅ Added SERP infrastructure data to map');
        
        // Update feedback for map completion - consistent with OSM pattern
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'serp',
            status: '🗺️ Adding data to map...',
            progress: 95,
            details: `Added ${allInfrastructureFeatures.length} features to map. Flying to site location...`
          });
        }
        
        // Fly to the location
        map.current.flyTo({
          center: [lng, lat],
          zoom: 12,
          duration: 2000
        });
        
        // Update popup to show SERP data completion
        marker.setPopup(new mapboxgl.Popup().setHTML(`
          <div style="padding: 8px; font-family: Inter, sans-serif;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏗️ Infrastructure Analysis</h4>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              Lat: ${lat.toFixed(4)}<br>
              Lng: ${lng.toFixed(4)}
            </p>
            <hr style="margin: 8px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #8b5cf6; font-size: 11px; font-weight: 600;">
              ✅ SERP Infrastructure Data Loaded
            </p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 10px;">
              Found ${allInfrastructureFeatures.length} infrastructure facilities
            </p>
          </div>
        `));
        
      } else {
        console.log('⚠️ No infrastructure data found from SERP API');
        marker.setPopup(new mapboxgl.Popup().setHTML(`
          <div style="padding: 8px; font-family: Inter, sans-serif;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏗️ Infrastructure Analysis</h4>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              Lat: ${lat.toFixed(4)}<br>
              Lng: ${lng.toFixed(4)}
            </p>
            <hr style="margin: 8px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #ef4444; font-size: 11px; font-weight: 600;">
              ⚠️ No Infrastructure Data Found
            </p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 10px;">
              SERP API returned no results for this area
            </p>
          </div>
        `));
      }
      
    } catch (error) {
      console.error('❌ Error fetching SERP infrastructure data:', error);
      marker.setPopup(new mapboxgl.Popup().setHTML(`
        <div style="padding: 8px; font-family: Inter, sans-serif;">
          <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏗️ Infrastructure Analysis</h4>
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Lat: ${lat.toFixed(4)}<br>
            Lng: ${lng.toFixed(4)}
          </p>
          <hr style="margin: 8px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #ef4444; font-size: 11px; font-weight: 600;">
            ❌ SERP API Error
          </p>
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 10px;">
            ${error.message}
          </p>
        </div>
      `));
    }
  };

  // Function to clear SERP data from map
  const clearSerpData = () => {
    if (map.current) {
      // Remove SERP layers
      if (map.current.getLayer('serp-infrastructure-markers')) {
        map.current.removeLayer('serp-infrastructure-markers');
      }
      if (map.current.getLayer('serp-search-radius')) {
        map.current.removeLayer('serp-search-radius');
      }
      if (map.current.getLayer('serp-search-radius-fill')) {
        map.current.removeLayer('serp-search-radius-fill');
      }
      
      // Remove SERP sources
      if (map.current.getSource('serp-infrastructure')) {
        map.current.removeSource('serp-infrastructure');
      }
      if (map.current.getSource('serp-search-radius')) {
        map.current.removeSource('serp-search-radius');
      }
      
      console.log('🧹 SERP data cleared from map');
      
      // Emit clear event for legend
      if (window.mapEventBus) {
        window.mapEventBus.emit('serp:dataCleared');
      }
    }
  };

  // Function to handle marker clicks
  const handleMarkerClick = (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      const coordinates = feature.geometry.coordinates;
      const properties = feature.properties;
      
      // Convert map coordinates to screen coordinates
      const point = map.current.project(coordinates);
      
      // Set popup data and position
      setPopupData({
        title: properties.title || properties.name || 'Infrastructure',
        category: properties.category || 'Unknown',
        address: properties.address || 'No address available',
        rating: properties.rating || null,
        phone: properties.phone || null,
        website: properties.website || null
      });
      
      setPopupPosition({
        x: point.x,
        y: point.y
      });
      
      setPopup(true);
      
      // Create marker data for animation and popup
      const markerData = {
        title: properties.title || properties.name || 'Infrastructure',
        category: properties.category || 'Unknown',
        coordinates: coordinates,
        serp_id: properties.serp_id || null,
        address: properties.address || 'No address available',
        rating: properties.rating || null,
        phone: properties.phone || null,
        website: properties.website || null,
        distance: properties.distance || null,
        description: properties.description || null,
        hours: properties.hours || null
      };
      
      // Emit marker clicked event for popup display
      if (window.mapEventBus) {
        window.mapEventBus.emit('marker:clicked', markerData);
      }
      
      // Trigger animation when marker is clicked directly on map
      if (window.nodeAnimation) {
        const animationType = properties.category === 'power plants' ? 'pulse' :
                             properties.category === 'electric utilities' ? 'ripple' :
                             properties.category === 'water facilities' ? 'glow' :
                             properties.category === 'data centers' ? 'heartbeat' : 'pulse';
        
        window.nodeAnimation.triggerNodeAnimation(coordinates, {
          type: animationType,
          intensity: 0.8,
          duration: 3.0,
          nodeData: markerData,
          category: properties.category
        });
        console.log('🎬 Map marker animation triggered for:', markerData.title, 'category:', properties.category);
      }
      
      console.log('🎯 Marker clicked:', {
        coordinates,
        properties,
        screenPosition: point
      });
    }
  };

  // Function to close popup
  const closePopup = () => {
    setPopup(false);
    setPopupData(null);
  };

  // Clear SERP data when component unmounts or when starting new search
  useEffect(() => {
    return () => {
      // Only clear map data if this is a genuine unmount (not just hiding)
      // We'll let the parent component manage when to clear the data
      // clearSerpData(); // Commented out to prevent auto-clearing on hide
      
      // Remove event listeners
      if (map.current) {
        map.current.off('click', 'serp-infrastructure-markers', handleMarkerClick);
        map.current.off('mouseenter', 'serp-infrastructure-markers');
        map.current.off('mouseleave', 'serp-infrastructure-markers');
        
        // Remove global click handler
        map.current.off('click');
      }
    };
  }, []);

  // Add click event listener to the map
  useEffect(() => {
    if (map.current) {
      // Add click event listener for markers
      map.current.on('click', 'serp-infrastructure-markers', handleMarkerClick);
      
      // Change cursor to pointer when hovering over markers
      map.current.on('mouseenter', 'serp-infrastructure-markers', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      
      map.current.on('mouseleave', 'serp-infrastructure-markers', () => {
        map.current.getCanvas().style.cursor = '';
      });
      
      // Add global click handler to close popup when clicking elsewhere
      const handleMapClick = (e) => {
        if (popup && !e.originalEvent.target.closest('[data-popup]')) {
          setPopup(false);
        }
      };
      
      map.current.on('click', handleMapClick);
      
      return () => {
        map.current.off('click', 'serp-infrastructure-markers', handleMarkerClick);
        map.current.off('mouseenter', 'serp-infrastructure-markers');
        map.current.off('mouseleave', 'serp-infrastructure-markers');
        map.current.off('click', handleMapClick);
      };
    }
  }, [map.current, popup]);



  const handleClick = async () => {
    if (isLoading) return;
    
    // Clear previous SERP data from legend
    if (window.mapEventBus) {
      window.mapEventBus.emit('serp:dataCleared');
      window.mapEventBus.emit('serp:loading');
    }
    
    // Start SERP feedback - consistent with OSM pattern
    if (updateToolFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'serp',
        status: '🚀 Starting SERP infrastructure query...',
        progress: 10,
        details: 'Initializing infrastructure analysis for Bosque County data center site'
      });
    }
    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    console.log('🎯 SERP Button clicked - querying Perplexity API for coordinates, then SERP for infrastructure');
    
    try {
      // Step 1: Use Perplexity API to get coordinates (similar to ActionButton)
      const coordinateQuery = `For the specific data center site in Bosque County, Texas (DFW10, with Calpine), provide ONLY the center point coordinates in this exact format: {"lat": 31.9315, "lng": -97.3470}. Return ONLY valid JSON with no additional text or explanation.`;
      
      // Update feedback for Perplexity API call - consistent with OSM pattern
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'serp',
          status: '📡 Querying Perplexity API for coordinates...',
          progress: 30,
          details: 'Requesting site boundary coordinates from AI service'
        });
      }
      
      const response = await fetch('/api/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: coordinateQuery
          }],
          max_tokens: 800,
          temperature: 0.1
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const apiResponse = data.choices[0]?.message?.content;
      
      console.log('📡 SERP Button Perplexity Response:', apiResponse);
      
      // Call the original onClick if provided
      if (onClick) {
        onClick(apiResponse);
      }
      
      // Step 2: Map the coordinate and fetch SERP infrastructure data
      if (map?.current && apiResponse) {
        try {
          const parsedResponse = JSON.parse(apiResponse);
          
          // Remove any existing SERP marker
          if (map.current.getLayer('serp-site-marker')) {
            map.current.removeLayer('serp-site-marker');
          }
          if (map.current.getSource('serp-site-marker')) {
            map.current.removeSource('serp-site-marker');
          }
          
          // Extract lat and lng from the response
          const lat = parsedResponse.lat;
          const lng = parsedResponse.lng;
          
          if (lat && lng) {
            // Create a purple marker for SERP analysis
            const marker = new mapboxgl.Marker({
              color: '#8b5cf6', // Purple to match SERP button
              scale: 1.5
            })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <div style="padding: 8px; font-family: Inter, sans-serif;">
                <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏗️ Infrastructure Analysis Site</h4>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Lat: ${lat.toFixed(4)}<br>
                  Lng: ${lng.toFixed(4)}
                </p>
                <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 10px;">
                  <em>Step 1: Site marker placed</em>
                </p>
              </div>
            `))
            .addTo(map.current);
            
            console.log('✅ SERP site marker added to map at:', { lat, lng });
            
            // Step 2: Fetch infrastructure data from SERP API
            console.log('🏗️ Step 2: Fetching infrastructure data from SERP API...');
            
            // Update feedback for SERP data fetching - consistent with OSM pattern
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'serp',
                status: '🏗️ Fetching SERP infrastructure data...',
                progress: 60,
                details: `Querying SERP API for infrastructure facilities around coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              });
            }
            
            await fetchInfrastructureData(lat, lng, marker);
            
            // Fly to the location
            map.current.flyTo({
              center: [lng, lat],
              zoom: 12, // Slightly zoomed out to see infrastructure
              duration: 2000
            });
            
            console.log('🚁 Flying to SERP analysis location...');
            
            // Update feedback for completion - consistent with OSM pattern
            if (updateToolFeedback) {
              updateToolFeedback({
                isActive: true,
                tool: 'serp',
                status: '✅ SERP infrastructure analysis completed successfully!',
                progress: 100,
                details: 'Infrastructure data loaded and mapped. Flying to site location...'
              });
            }
            
            // Clear feedback after a delay - consistent with OSM pattern
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
            }, 3000);
            
          } else {
            console.log('❌ Invalid coordinate format in response:', parsedResponse);
          }
          
        } catch (error) {
          console.error('❌ Error mapping SERP site marker:', error);
        }
      }
      
    } catch (error) {
      console.error('❌ SERP Button API Error:', error.message);
      
      // Update feedback for error - consistent with OSM pattern
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'serp',
          status: '❌ SERP query failed',
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

  // Add CSS animations for pulsing effects
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes serpButtonPulse {
        0% { 
          transform: translateX(-50%) scale(1);
          background-color: rgba(147, 51, 234, 0.8);
        }
        50% { 
          transform: translateX(-50%) scale(1.1);
          background-color: rgba(147, 51, 234, 1);
        }
        100% { 
          transform: translateX(-50%) scale(1);
          background-color: rgba(147, 51, 234, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Helper function to get category color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'power':
        return '#f59e0b'; // Orange
      case 'water':
        return '#0ea5e9'; // Blue
      case 'datacenter':
        return '#3b82f6'; // Blue
      case 'transportation':
        return '#10b981'; // Green
      case 'electricity':
        return '#f59e0b'; // Orange
      case 'telecom':
        return '#8b5cf6'; // Purple
      case 'industrial':
        return '#dc2626'; // Red
      case 'manufacturing':
        return '#dc2626'; // Red
      case 'warehouse':
        return '#7c3aed'; // Purple
      case 'refinery':
        return '#b91c1c'; // Dark red
      case 'chemical':
        return '#059669'; // Green
      case 'steel':
        return '#1f2937'; // Dark gray
      case 'oil_gas':
        return '#92400e'; // Brown
      case 'railroad':
        return '#1e40af'; // Blue
      case 'airport':
        return '#be185d'; // Pink
      case 'business':
        return '#6366f1'; // Indigo
      case 'facility':
        return '#f97316'; // Orange
      case 'building':
        return '#84cc16'; // Lime
      default:
        return '#6b7280'; // Gray for others
    }
  };

  return (
    <>
      <div
        style={{
          width: '10px',
          height: '10px',
          backgroundColor: disabled ? 'rgba(0, 0, 0, 0.4)' : 'rgba(147, 51, 234, 0.8)',
          borderRadius: '50%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative', // Changed from absolute to relative
          top: position?.top || '0px', // Use position prop or default
          left: position?.left || '0px', // Use position prop or default
          transition: 'all 0.2s ease',
          transform: disabled ? 'scale(1)' : (isLoading ? 'scale(1.2)' : 'scale(1)'),
          boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isLoading ? '0 0 10px rgba(147, 51, 234, 0.6)' : 'none'),
          padding: '8px',
          border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : '1px solid rgba(147, 51, 234, 0.25)',
          zIndex: 1001,
          opacity: disabled ? 0.6 : 1
        }}
        onClick={disabled ? undefined : handleClick}
        title={disabled ? 'Loading...' : title}
      />
      
      {/* Popup Card */}
      {popup && popupData && (
        <PopupCard
          data-popup="true"
          style={{
            position: 'fixed',
            left: popupPosition.x,
            top: popupPosition.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex: 1001
          }}
        >
          <PopupCloseButton onClick={() => setPopup(false)}>×</PopupCloseButton>
          <PopupTitle>{popupData.title}</PopupTitle>
          <PopupInfo>
            <PopupLabel>Category:</PopupLabel>
            <PopupValue>{popupData.category}</PopupValue>
          </PopupInfo>
          {popupData.address && (
            <PopupInfo>
              <PopupLabel>Address:</PopupLabel>
              <PopupValue>{popupData.address}</PopupValue>
            </PopupInfo>
          )}
          {popupData.rating && (
            <PopupInfo>
              <PopupLabel>Rating:</PopupLabel>
              <PopupValue>{popupData.rating}</PopupValue>
            </PopupInfo>
          )}
          {popupData.phone && (
            <PopupInfo>
              <PopupLabel>Phone:</PopupLabel>
              <PopupValue>{popupData.phone}</PopupValue>
            </PopupInfo>
          )}
          {popupData.website && (
            <PopupInfo>
              <PopupLabel>Website:</PopupLabel>
              <PopupValue>
                <a 
                  href={popupData.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'none' }}
                >
                  Visit Site
                </a>
              </PopupValue>
            </PopupInfo>
          )}
        </PopupCard>
      )}
    </>
  );
};

export default SerpAPI;
