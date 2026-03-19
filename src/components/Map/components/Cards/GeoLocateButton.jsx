import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const GeoLocateButton = ({ 
  aiState, 
  map, 
  onGeoLocateComplete,
  onGeoLocateError 
}) => {
  const [isGeoLocating, setIsGeoLocating] = useState(false);
  const [geoLocateTriggered, setGeoLocateTriggered] = useState(false);

  // Auto-trigger GEO LOCATE after main text loads
  useEffect(() => {
    if (aiState.response && !geoLocateTriggered) {
      const timer = setTimeout(() => {
        handleGeoLocate();
      }, 2000); // Wait 2 seconds after response loads
      
      return () => clearTimeout(timer);
    }
  }, [aiState.response, geoLocateTriggered]);

  // Handle GEO LOCATE functionality
  const handleGeoLocate = async () => {
    console.log('🗺️ GEO LOCATE:', aiState.response ? 'Using response' : 'No response');
    
    if (!aiState.response) {
      console.log('❌ No AI response available for geolocation');
      return;
    }

    setIsGeoLocating(true);
    
    try {
      const startTime = Date.now();
      
      // Create a specific query for coordinates
      const geoQuery = `For the location mentioned in this context: "${(aiState.response?.content || aiState.response || '').substring(0, 200)}...", provide ONLY the latitude and longitude coordinates in decimal degrees format (e.g., "30.2672, -97.7431"). If multiple locations are mentioned, provide the primary one. If no specific location is found, respond with "No specific location found."`;
      
      const response = await fetch('/api/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: geoQuery
          }],
          max_tokens: 100,
          temperature: 0.1
        })
      });
      
      const responseTime = Date.now() - startTime;
      console.log('📡 GEO API Response:', responseTime, 'ms');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const geoResponse = data.choices[0]?.message?.content;
      
      if (geoResponse && !geoResponse.includes('No specific location found')) {
        // Extract coordinates from response
        const coordMatch = geoResponse.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          
          console.log('🎯 Coordinates:', { lat, lng });
          
          // Use the map prop passed from CardManager
          const mapInstance = map?.current;
          
          if (mapInstance) {
            // Create a new marker
            const marker = new mapboxgl.Marker({
              color: '#10b981',
              scale: 1.2
            })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <div style="padding: 8px; font-family: Inter, sans-serif;">
                <h4 style="margin: 0 0 8px 0; color: #1f2937;">📍 Location Found</h4>
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Lat: ${lat.toFixed(4)}<br>
                  Lng: ${lng.toFixed(4)}
                </p>
              </div>
            `))
            .addTo(mapInstance);
            
            console.log('✅ Marker added to map');
            
            // Fly to the location
            mapInstance.flyTo({
              center: [lng, lat],
              zoom: 12,
              duration: 2000
            });
            
            console.log('🚁 Flying to location...');
            
            // Notify parent component of success
            if (onGeoLocateComplete) {
              onGeoLocateComplete({ lat, lng, marker });
            }
            
          } else {
            console.log('❌ Map not available');
            if (onGeoLocateError) {
              onGeoLocateError('Map not available');
            }
          }
          
        } else {
          console.log('❌ Could not extract coordinates');
          if (onGeoLocateError) {
            onGeoLocateError('Could not extract coordinates');
          }
        }
      } else {
        console.log('❌ No specific location found');
        if (onGeoLocateError) {
          onGeoLocateError('No specific location found');
        }
      }
      
    } catch (error) {
      console.error('❌ GEO LOCATE Error:', error.message);
      if (onGeoLocateError) {
        onGeoLocateError(error.message);
      }
    } finally {
      setIsGeoLocating(false);
      setGeoLocateTriggered(true);
    }
  };

  // Add CSS animation for GEO LOCATE pulsing
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes geoLocatePulse {
        0% { 
          background-color: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        50% { 
          background-color: #059669;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3);
        }
        100% { 
          background-color: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: '-6px',
      left: '70px',
      zIndex: 10
    }}>
      <span 
        style={{
          background: isGeoLocating ? '#10b981' : 'transparent',
          color: isGeoLocating ? 'white' : 'rgba(255, 255, 255, 0.9)',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '0px',
          border: isGeoLocating ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.3)',
          fontFamily: 'Inter, monospace',
          fontWeight: '400',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          cursor: isGeoLocating ? 'default' : 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          animation: isGeoLocating ? 'geoLocatePulse 1.5s ease-in-out infinite' : 'none'
        }}
        onClick={isGeoLocating ? undefined : handleGeoLocate}
        onMouseEnter={(e) => {
          if (!isGeoLocating) {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            e.target.style.border = '1px solid rgba(255, 255, 255, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isGeoLocating) {
            e.target.style.background = 'transparent';
            e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
          }
        }}
        title={isGeoLocating ? 'Locating on map...' : 'Click to locate on map'}
      >
        {isGeoLocating ? 'locating...' : 'geo locate'}
      </span>
    </div>
  );
};

export default GeoLocateButton;
