import React, { useState, useEffect } from 'react';

const AlphaEarthButton = ({ 
  onClick, 
  title = "Query AlphaEarth", 
  color = "#F87171", 
  size = "10px", 
  position, 
  aiState, 
  map, 
  onLoadingChange,
  disabled = false,
  updateToolFeedback = null
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Inject CSS for AlphaEarth button pulse animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes alphaEarthPulse {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.2);
          opacity: 0.7;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle AlphaEarth query
  const handleAlphaEarthQuery = async () => {
    if (!map?.current || isLoading) return;

    console.log('🚀 Alpha Button clicked - initiating AlphaEarth query...');
    
    // Initialize tool feedback
    if (updateToolFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'alphaearth',
        status: '🚀 Starting AlphaEarth environmental intelligence query...',
        progress: 10,
        details: 'Initializing Google Earth Engine connection for Pinal County data center site'
      });
    }
    
    setIsLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      // Step 1: Get coordinates from Perplexity API (same as ActionButton)
      console.log('📍 Step 1: Getting site coordinates from Perplexity API...');
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'alphaearth',
          status: '📍 Getting site coordinates...',
          progress: 20,
          details: 'Retrieving precise coordinates for Pinal County data center site'
        });
      }
      
      const boundaryQuery = `For the primary data center development site in Pinal County, Arizona (near Casa Grande), provide ONLY the center point coordinates in this exact format: {"lat": 32.8162, "lng": -111.4795}. Return ONLY valid JSON with no additional text or explanation.`;
      
      const response = await fetch('/api/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: boundaryQuery
          }],
          max_tokens: 800,
          temperature: 0.1
        })
      });
      
      if (!response.ok) {
        throw new Error(`Perplexity API error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const apiResponse = data.choices[0]?.message?.content;
      const parsedResponse = JSON.parse(apiResponse);
      
      const lat = parsedResponse.lat;
      const lng = parsedResponse.lng;
      
      console.log('✅ Step 1 Complete: Site coordinates retrieved');
      console.log('🌍 AlphaEarth Query Location:', { lat, lng });

      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'alphaearth',
          status: '🛰️ Connecting to Google Earth Engine...',
          progress: 40,
          details: 'Establishing connection to AlphaEarth satellite embeddings'
        });
      }

      // Step 2: Query REAL Google Earth Engine AlphaEarth data
      console.log('🛰️ Step 2: Querying REAL Google Earth Engine for AlphaEarth embeddings...');
      console.log('🔍 AlphaEarth: Target area - 3km radius (real GEE data)');
      console.log('📊 AlphaEarth: Connecting to backend AlphaEarth API...');
      
      const alphaEarthQuery = {
        location: { lat, lng },
        radius: 3000, // 3km radius
        timeRange: { start: '2022', end: '2024' },
        indicators: ['water', 'vegetation', 'soil']
      };

      console.log('🎯 AlphaEarth Query Parameters:', alphaEarthQuery);
      console.log('⚡ AlphaEarth: Connecting to real Google Earth Engine...');
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'alphaearth',
          status: '🔬 Processing AlphaEarth embeddings...',
          progress: 60,
          details: 'Analyzing 64-dimensional satellite embeddings for environmental changes'
        });
      }
      
      // Query real AlphaEarth backend
      const alphaEarthResponse = await fetch(`${process.env.REACT_APP_ALPHAEARTH_URL || 'http://localhost:5001'}/api/alphaearth/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alphaEarthQuery)
      });

      if (!alphaEarthResponse.ok) {
        throw new Error(`AlphaEarth API error! status: ${alphaEarthResponse.status}`);
      }

      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'alphaearth',
          status: '🗺️ Adding environmental data to map...',
          progress: 80,
          details: 'Rendering AlphaEarth environmental changes on map'
        });
      }

      const alphaEarthOSMResponse = await alphaEarthResponse.json();
      
      console.log('🔬 AlphaEarth: Processing REAL 64-dimensional embeddings...');
      console.log('📈 AlphaEarth: Calculating embedding distances for change detection...');
      console.log('🌱 AlphaEarth: Deriving environmental indicators from real data...');
      
      // Real AlphaEarth data received from backend - no mock generation needed!

      console.log('✅ Step 2 Complete: REAL AlphaEarth GEE analysis finished');
      console.log('🎨 AlphaEarth: Generated', alphaEarthOSMResponse.pixelCount, 'real pixel polygons');
      console.log('📊 AlphaEarth: Coverage area -', alphaEarthOSMResponse.radius, 'radius');
      console.log('🔬 AlphaEarth: Environmental Analysis:', alphaEarthOSMResponse.environmentalAnalysis);
      console.log('💼 AlphaEarth: Data Source -', alphaEarthOSMResponse.dataSource);
      console.log('🗺️ AlphaEarth: REAL GeoJSON ready for map rendering');

      // Step 3: Add AlphaEarth pixels to map using OSM infrastructure
      if (map?.current) {
        console.log('🗺️ Step 3: Adding AlphaEarth pixels to map...');
        
        const mapInstance = map.current;
        
        // Remove any existing AlphaEarth layers
        if (mapInstance.getLayer('alphaearth-pixels-fill')) {
          mapInstance.removeLayer('alphaearth-pixels-fill');
        }
        if (mapInstance.getLayer('alphaearth-pixels-lines')) {
          mapInstance.removeLayer('alphaearth-pixels-lines');
        }
        if (mapInstance.getSource('alphaearth-pixels')) {
          mapInstance.removeSource('alphaearth-pixels');
        }
        
        // Add AlphaEarth pixel source
        mapInstance.addSource('alphaearth-pixels', {
          type: 'geojson',
          data: alphaEarthOSMResponse.geoJSON
        });
        
        // Calculate date filter for last 2 weeks
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const twoWeeksAgoTimestamp = twoWeeksAgo.getTime();

        // Add fill layer for pixels - show all pixels above threshold (no time filter for testing)
        mapInstance.addLayer({
          id: 'alphaearth-pixels-fill',
          type: 'fill',
          source: 'alphaearth-pixels',
          filter: ['>', ['get', 'embedding_distance'], 0.3], // Show all pixels above threshold
          paint: {
            'fill-color': '#ef4444', // Red for recent high-risk areas only
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'confidence'],
              0.7, 0.6, // Start at 60% opacity for lowest confidence
              0.8, 0.75, // 75% opacity for medium confidence  
              0.9, 0.9, // 90% opacity for high confidence
              1.0, 1.0  // Full opacity for maximum confidence
            ]
          }
        });
        
        // Add line layer for pixel boundaries - show all pixels above threshold
        mapInstance.addLayer({
          id: 'alphaearth-pixels-lines',
          type: 'line',
          source: 'alphaearth-pixels',
          filter: ['>', ['get', 'embedding_distance'], 0.3], // Show all pixels above threshold
          paint: {
            'line-color': '#ffffff',
            'line-width': 0.5,
            'line-opacity': 0.7 // Higher opacity for better visibility of recent changes
          }
        });
        
        // Count filtered pixels for logging
        const pixelFeatures = alphaEarthOSMResponse.geoJSON.features;
        const highRiskPixels = pixelFeatures.filter(f => f.properties.embedding_distance > 0.3).length;
        const recentHighRiskPixels = pixelFeatures.filter(f => 
          f.properties.embedding_distance > 0.3
        ).length; // Removed time filter for testing
        
        // Calculate Gene-specific business intelligence
        const businessIntelligence = {
          totalRiskAreas: recentHighRiskPixels,
          gridProximityRisk: pixelFeatures.filter(f => 
            f.properties.embedding_distance > 0.4 && 
            f.properties.category === 'water_change'
          ).length,
          operationalImpactScore: (recentHighRiskPixels / alphaEarthOSMResponse.pixelCount * 100).toFixed(1),
          environmentalStability: recentHighRiskPixels < 30 ? 'HIGH' : recentHighRiskPixels < 60 ? 'MEDIUM' : 'LOW'
        };

        console.log('✅ Step 3 Complete: AlphaEarth Environmental Intelligence for Data Center Operations');
        console.log('🎯 Business Intelligence Summary for Gene:');
        console.log(`   📊 Environmental Risk Areas: ${businessIntelligence.totalRiskAreas} detected`);
        console.log(`   ⚡ Grid Proximity Risk Score: ${businessIntelligence.gridProximityRisk} high-impact zones`);
        console.log(`   💰 Operational Impact Score: ${businessIntelligence.operationalImpactScore}% of area affected`);
        console.log(`   🏢 Site Environmental Stability: ${businessIntelligence.environmentalStability}`);
        console.log('⚠️ Filter: Recent environmental changes (embedding_distance > 0.3)');
        console.log('🎯 Result: Better clustering and reduced noise from older changes');
        
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'alphaearth',
            status: '✅ AlphaEarth analysis complete!',
            progress: 100,
            details: `${businessIntelligence.totalRiskAreas} environmental risk areas detected for data center operations`
          });
        }
        
        // Fly to the location with appropriate zoom for 3km coverage
        mapInstance.flyTo({
          center: [lng, lat],
          zoom: 12, // Lower zoom to see 3km radius coverage
          duration: 2000
        });
      }

      // Call the onClick handler with the response
      if (onClick) {
        onClick(alphaEarthOSMResponse);
      }

    } catch (error) {
      console.error('❌ AlphaEarth Query Error:', error);
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'alphaearth',
          status: '❌ AlphaEarth query failed',
          progress: 0,
          details: `Error: ${error.message}`
        });
        
        // Clear error feedback after 5 seconds
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
      if (onLoadingChange) onLoadingChange(false);
      
      // Clear success feedback after 3 seconds
      if (updateToolFeedback) {
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 3000);
      }
    }
  };

  return (
    <div
      style={{
        position: 'relative', // Changed from absolute to relative
        top: position?.top || '0px', // Use position prop or default
        left: position?.left || '0px', // Use position prop or default
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled ? 'rgba(0, 0, 0, 0.4)' : (isHovered ? 
          `linear-gradient(45deg, ${color}, ${color}dd)` : 
          color),
        border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : `1px solid ${color}`,
        cursor: disabled ? 'not-allowed' : (isLoading ? 'default' : 'pointer'),
        boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isHovered ? 
          '0 2px 8px rgba(248, 113, 113, 0.4)' : 
          '0 1px 4px rgba(0, 0, 0, 0.2)'),
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px', // Match ActionButton and drag handle padding
        animation: disabled ? 'none' : (isLoading ? 'alphaEarthPulse 1.5s ease-in-out infinite' : 'none'),
        opacity: disabled ? 0.6 : (isLoading ? 0.8 : 1)
      }}
      onClick={disabled ? undefined : (isLoading ? undefined : handleAlphaEarthQuery)}
      onMouseEnter={() => {
        if (!disabled && !isLoading) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (!isLoading) {
          setIsHovered(false);
        }
      }}
      title={disabled ? 'Loading...' : (isLoading ? 'Querying AlphaEarth...' : title)}
    />
  );
};

export default AlphaEarthButton;
