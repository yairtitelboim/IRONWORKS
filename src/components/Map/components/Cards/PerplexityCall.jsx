import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  addGentrificationClickHandler, 
  addGentrificationHoverEffects 
} from '../../../../utils/gentrificationPopupUtils';
import { 
  addGentrificationDataSource,
  addGentrificationStyles,
  addPulseSource,
  addPulseMarkersLayer,
  addStaticCircleMarkersLayer,
  cleanupGentrificationLayers 
} from '../../../../utils/gentrificationMapUtils';
import { 
  addParticlesLayer,
  startParticleAnimation 
} from '../../../../utils/gentrificationParticleUtils';
import { 
  startGentrificationPulseAnimation 
} from '../../../../utils/gentrificationPulseUtils';

const PerplexityCall = ({ 
  onClick, 
  title = "Gentrification Analysis with Perplexity AI",
  color = "rgba(0, 0, 0, 0.8)", // Black color for Perplexity
  size = "10px",
  position = { top: '0px', left: '0px' },
  aiState = null,
  map = null,
  onLoadingChange = null,
  disabled = false,
  updateToolFeedback = null
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGentrificationLoaded, setIsGentrificationLoaded] = useState(false);

  // Load gentrification analysis data and create map layers
  const loadGentrificationAnalysis = async () => {
    try {
      console.log('🧠 Loading gentrification analysis data...');
      
      // Update feedback for data loading
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '📊 Loading gentrification data...',
          progress: 20,
          details: 'Fetching gentrification analysis from JSON file'
        });
      }

      // Check for local gentrification data file first (following OSMCall pattern)
      console.log('🔍 Checking for local gentrification data file...');
      try {
        const response = await fetch('/gentrification-analysis-geojson.json');
        console.log('📡 Gentrification fetch response:', response.status, response.statusText);
        
        if (response.ok) {
          const gentrificationData = await response.json();
          console.log('⚡ Gentrification: Using local gentrification data file');
          console.log('📊 Gentrification data:', gentrificationData);
          
          // Update feedback for local data
          if (updateToolFeedback) {
            updateToolFeedback({
              isActive: true,
              tool: 'perplexity',
              status: '⚡ Loading local gentrification data...',
              progress: 40,
              details: `Using local gentrification data (${gentrificationData.features?.length || 0} features)`
            });
          }
          
          // Process the data
          await processGentrificationData(gentrificationData);
          return;
        } else {
          console.error('❌ Gentrification: HTTP error:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Gentrification: Fetch error:', error);
      }

      // If no local file, show error (since we need the data file)
      throw new Error('Gentrification analysis data file not found. Please run the analysis pipeline first.');

    } catch (error) {
      console.error('❌ Error loading gentrification analysis:', error);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '❌ Analysis failed',
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
    }
  };

  // Add tear-drop style markers at gentrification risk points (Google-style location pins)
  const addTearDropMarkers = (map, gentrificationData) => {
    try {
      console.log('💧 Adding tear-drop markers for gentrification risk points...');
      
      // Remove any existing tear-drop markers
      if (map.current.getLayer('gentrification-teardrop-markers')) {
        map.current.removeLayer('gentrification-teardrop-markers');
      }
      if (map.current.getSource('gentrification-teardrop-markers')) {
        map.current.removeSource('gentrification-teardrop-markers');
      }

      // Create tear-drop markers for each gentrification risk point
      const teardropFeatures = gentrificationData.features.map(feature => {
        const riskLevel = feature.properties.gentrification_risk || 0;
        const neighborhood = feature.properties.neighborhood_name || 'default';
        
        // Use the same color scheme as pulse markers with proper color names
        let riskColor, colorName, riskSize;
        if (riskLevel >= 0.85) {
          riskColor = '#dc2626'; // Red for critical risk
          colorName = 'red';
          riskSize = 'large';
        } else if (riskLevel >= 0.8) {
          riskColor = '#ea580c'; // Orange for high risk
          colorName = 'orange';
          riskSize = 'medium';
        } else if (riskLevel >= 0.6) {
          riskColor = '#f59e0b'; // Yellow for medium risk
          colorName = 'yellow';
          riskSize = 'medium';
        } else {
          riskColor = '#6b7280'; // Gray for low risk
          colorName = 'gray';
          riskSize = 'small';
        }
        
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            teardrop_color: riskColor,
            teardrop_colorName: colorName,
            teardrop_size: riskSize,
            risk_level: riskLevel,
            icon: `teardrop-${colorName}`
          }
        };
      });

      // Add teardrop markers using Mapbox's built-in marker system (same as OSMCall.jsx)
      const teardropMarkers = [];
      
      teardropFeatures.forEach(feature => {
        const riskLevel = feature.properties.risk_level;
        const neighborhood = feature.properties.neighborhood;
        
        // Determine color and size based on risk level (same as OSMCall.jsx approach)
        let markerColor, markerSize;
        if (riskLevel >= 0.85) {
          markerColor = '#dc2626'; // Red for critical risk
          markerSize = 1.5;
        } else if (riskLevel >= 0.8) {
          markerColor = '#ea580c'; // Orange for high risk
          markerSize = 1.2;
        } else if (riskLevel >= 0.6) {
          markerColor = '#f59e0b'; // Yellow for medium risk
          markerSize = 1.0;
        } else {
          markerColor = '#6b7280'; // Gray for low risk
          markerSize = 0.8;
        }
        
        // Create Mapbox marker (same as OSMCall.jsx)
        const marker = new mapboxgl.Marker({
          color: markerColor,
          scale: markerSize
        })
        .setLngLat(feature.geometry.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div style="padding: 8px; font-family: Inter, sans-serif;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">🏠 Gentrification Risk</h4>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              ${neighborhood || 'Unknown Area'}
            </p>
            <hr style="margin: 8px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: ${markerColor}; font-size: 11px; font-weight: 600;">
              Risk Level: ${(riskLevel * 100).toFixed(1)}%
            </p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 10px;">
              ${riskLevel >= 0.85 ? 'Critical Risk' : 
                riskLevel >= 0.8 ? 'High Risk' : 
                riskLevel >= 0.6 ? 'Medium Risk' : 'Low Risk'}
            </p>
          </div>
        `))
        .addTo(map.current);
        
        teardropMarkers.push(marker);
      });

      // Store markers for cleanup (same as OSMCall.jsx approach)
      window.gentrificationTeardropMarkers = teardropMarkers;

      console.log('✅ Tear-drop markers added:', teardropFeatures.length);
      
    } catch (error) {
      console.error('❌ Error adding tear-drop markers:', error);
    }
  };

  // Process gentrification data and add to map (following OSMCall pattern)
  const processGentrificationData = async (gentrificationData) => {
    try {
      console.log('📊 Processing gentrification data:', gentrificationData);

      // Update feedback for map layer creation
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '🗺️ Creating map layers...',
          progress: 50,
          details: 'Adding gentrification circles and markers to map'
        });
      }

      // Check if map is available
      if (!map?.current) {
        throw new Error('Map is not available');
      }

      // Remove any existing gentrification layers first (following OSMCall pattern)
      const layersToRemove = [
        'perplexity-gentrification-circles',
        'perplexity-gentrification-pulse-markers',
        'perplexity-gentrification-radius-particles-layer'
      ];
      
      layersToRemove.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });

      // Remove sources after layers are removed
      const sourcesToRemove = [
        'perplexity-gentrification-data',
        'perplexity-gentrification-pulse-source',
        'perplexity-gentrification-radius-particles'
      ];
      
      sourcesToRemove.forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      // Remove teardrop markers (same as OSMCall.jsx approach)
      if (window.gentrificationTeardropMarkers) {
        window.gentrificationTeardropMarkers.forEach(marker => marker.remove());
        window.gentrificationTeardropMarkers = [];
      }

      // Add gentrification styles first
      addGentrificationStyles();

      // Add data source
      addGentrificationDataSource(map, gentrificationData);

      // Add pulse source and markers
      addPulseSource(map);
      addPulseMarkersLayer(map);

      // Add static circle markers
      addStaticCircleMarkersLayer(map);

      // Add particles layer
      addParticlesLayer(map, gentrificationData);

      // Update feedback for animation setup
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✨ Starting animations...',
          progress: 70,
          details: 'Initializing particle and pulse animations'
        });
      }

      // Start particle animations
      startParticleAnimation(map, gentrificationData, 'perplexity-gentrification-radius-particles');
      
      // Start pulse animations
      startGentrificationPulseAnimation(map);

      // Add tear-drop style markers at gentrification risk points
      addTearDropMarkers(map, gentrificationData);

      // Add click and hover handlers
      addGentrificationClickHandler(map);
      addGentrificationHoverEffects(map);

      // Update feedback for completion
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✅ Gentrification analysis loaded!',
          progress: 100,
          details: 'Interactive gentrification risk visualization ready'
        });
      }

      setIsGentrificationLoaded(true);

      // Clear feedback after a delay
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

      // Emit analysis data to global event bus
      if (window.mapEventBus) {
        window.mapEventBus.emit('perplexity:gentrificationLoaded', {
          data: gentrificationData,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ Error processing gentrification data:', error);
      throw error;
    }
  };

  // Clean up gentrification layers
  const cleanupGentrification = () => {
    try {
      console.log('🧹 Cleaning up gentrification layers...');
      cleanupGentrificationLayers(map.current);
      setIsGentrificationLoaded(false);
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '🧹 Gentrification analysis removed',
          progress: 0,
          details: 'Map layers cleaned up'
        });
        
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error cleaning up gentrification:', error);
    }
  };

  const handleClick = async () => {
    if (isLoading) return;
    
    // Check if map is available
    if (!map?.current) {
      console.error('❌ Map is not available for gentrification analysis');
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '❌ Map not ready',
          progress: 0,
          details: 'Map is not available. Please wait for map to load.'
        });
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
      return;
    }
    
    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    console.log('🧠 Perplexity Gentrification Button clicked');
    
    try {
      // Call the original onClick if provided
      if (onClick) {
        onClick();
      }
      
      // Toggle gentrification analysis
      if (isGentrificationLoaded) {
        cleanupGentrification();
      } else {
        await loadGentrificationAnalysis();
      }
      
    } catch (error) {
      console.error('❌ Perplexity Gentrification Error:', error.message);
      
      // Update feedback for error
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '❌ Gentrification analysis failed',
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
      @keyframes perplexityButtonPulse {
        0% { 
          transform: scale(1);
          background-color: rgba(0, 0, 0, 0.8);
        }
        50% { 
          transform: scale(1.1);
          background-color: rgba(0, 0, 0, 1);
        }
        100% { 
          transform: scale(1);
          background-color: rgba(0, 0, 0, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isGentrificationLoaded && map?.current) {
        cleanupGentrification();
      }
    };
  }, [isGentrificationLoaded, map]);

  return (
    <div
      style={{
        position: 'relative',
        top: position?.top || '0px',
        left: position?.left || '0px',
        width: size,
        height: size,
        borderRadius: '50%',
        background: disabled ? 'rgba(0, 0, 0, 0.4)' : (isLoading ? '#000000' : (isHovered ? 'rgba(0, 0, 0, 1)' : (isGentrificationLoaded ? 'rgba(220, 38, 38, 0.8)' : color))),
        border: disabled ? '1px solid rgba(0, 0, 0, 0.2)' : (isGentrificationLoaded ? '1px solid rgba(220, 38, 38, 0.5)' : '1px solid rgba(59, 130, 246, 0.2)'),
        cursor: disabled ? 'not-allowed' : (isLoading ? 'default' : 'pointer'),
        boxShadow: disabled ? '0 1px 4px rgba(0, 0, 0, 0.1)' : (isHovered 
          ? '0 2px 8px rgba(0, 0, 0, 0.4)' 
          : '0 1px 4px rgba(0, 0, 0, 0.2)'),
        transition: 'all 0.2s ease',
        zIndex: 1001,
        padding: '8px',
        opacity: disabled ? 0.6 : (isLoading ? 0.7 : 1),
        animation: disabled ? 'none' : (isLoading ? 'perplexityButtonPulse 1.5s ease-out infinite' : 'none')
      }}
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={() => !disabled && !isLoading && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={disabled ? 'Loading...' : (isLoading ? 'Loading gentrification analysis...' : (isGentrificationLoaded ? 'Remove gentrification analysis' : title))}
    />
  );
};

export default PerplexityCall;