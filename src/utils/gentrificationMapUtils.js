// Gentrification Map Utilities
// Extracted from PerplexityCall.jsx for better organization

import { GENTRIFICATION_CONFIG } from '../constants/gentrificationConfig';

// Clean up existing gentrification layers and sources
export const cleanupGentrificationLayers = (map) => {
  // Check if map is valid
  if (!map || !map.current) {
    console.warn('⚠️ Map not available for cleanup');
    return;
  }

  // Remove any existing gentrification layers (using isolated naming)
  const layersToRemove = [
    'perplexity-gentrification-fill',
    'perplexity-gentrification-lines',
    'perplexity-gentrification-markers',
    GENTRIFICATION_CONFIG.LAYER_IDS.circles,
    GENTRIFICATION_CONFIG.LAYER_IDS.pulse,
    GENTRIFICATION_CONFIG.LAYER_IDS.particles
  ];
  
  layersToRemove.forEach(layerId => {
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
  });
  
  // Remove sources after layers are removed
  if (map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data)) {
    map.current.removeSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data);
  }
  
  // Clean up radius particles animation
  if (window.perplexityGentrificationRadiusAnimationFrame) {
    cancelAnimationFrame(window.perplexityGentrificationRadiusAnimationFrame);
    window.perplexityGentrificationRadiusAnimationFrame = null;
  }
  
  // Clean up pulse animation
  if (window.perplexityGentrificationPulseAnimation) {
    cancelAnimationFrame(window.perplexityGentrificationPulseAnimation);
    window.perplexityGentrificationPulseAnimation = null;
  }
  
  // Remove radius particles source
  if (map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.particles)) {
    map.current.removeSource(GENTRIFICATION_CONFIG.SOURCE_IDS.particles);
  }
  
  // Remove pulse source
  if (map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse)) {
    map.current.removeSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse);
  }
};

// Add CSS styles for gentrification popups
export const addGentrificationStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .gentrification-popup .mapboxgl-popup-content {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 0 !important;
    }
    .gentrification-popup .mapboxgl-popup-tip {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
};

// Add gentrification data source to map
export const addGentrificationDataSource = (map, gentrificationData) => {
  // Check if map is valid
  if (!map || !map.current) {
    console.warn('⚠️ Map not available for adding data source');
    return;
  }

  if (!map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data)) {
    map.current.addSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data, {
      type: 'geojson',
      data: gentrificationData
    });
  } else {
    map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data).setData(gentrificationData);
  }
};

// Add pulse source for animated markers
export const addPulseSource = (map) => {
  // Check if map is valid
  if (!map || !map.current) {
    console.warn('⚠️ Map not available for adding pulse source');
    return;
  }

  if (!map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse)) {
    map.current.addSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
};

// Add pulse markers layer
export const addPulseMarkersLayer = (map) => {
  // Check if map is valid
  if (!map || !map.current) {
    console.warn('⚠️ Map not available for adding pulse markers layer');
    return;
  }

  if (!map.current.getLayer(GENTRIFICATION_CONFIG.LAYER_IDS.pulse)) {
    map.current.addLayer({
      id: GENTRIFICATION_CONFIG.LAYER_IDS.pulse,
      type: 'circle',
      source: GENTRIFICATION_CONFIG.SOURCE_IDS.pulse,
      paint: {
        // TEMPORAL URGENCY: Radius scales with timeline urgency (shorter timeline = larger pulse)
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'], // Based on timeline_to_unaffordable
              0.5, 4,   // Low urgency: small start (doubled)
              1.0, 8    // High urgency: larger start (doubled)
            ],
            0.3, [
              'interpolate', 
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 16,  // Low urgency: moderate peak (doubled)
              1.0, 32   // High urgency: large peak (doubled)
            ],
            0.7, [
              'interpolate',
              ['linear'], 
              ['get', 'timeline_urgency_factor'],
              0.5, 20,  // Low urgency: small overshoot (doubled)
              1.0, 40   // High urgency: large overshoot (doubled)
            ],
            1.0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 4,   // Return to start (doubled)
              1.0, 8
            ]
          ],
          12, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 8,
              1.0, 16
            ],
            0.3, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 32,
              1.0, 64
            ],
            0.7, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 40,
              1.0, 80
            ],
            1.0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 8,
              1.0, 16
            ]
          ],
          16, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 12,
              1.0, 24
            ],
            0.3, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 48,
              1.0, 96
            ],
            0.7, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 60,
              1.0, 120
            ],
            1.0, [
              'interpolate',
              ['linear'],
              ['get', 'timeline_urgency_factor'],
              0.5, 12,
              1.0, 24
            ]
          ]
        ],
        // NEIGHBORHOOD IDENTITY: Color themes based on neighborhood character
        'circle-color': [
          'case',
          // Downtown: Green-red gradient based on risk (matching Midtown colors)
          ['==', ['get', 'neighborhood_name'], 'Downtown'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#059669', // Green for lower risk
            0.85, '#059669', // Green for medium risk
            0.9, '#dc2626'  // Red for highest risk
          ],
          // Midtown: Green-orange gradient based on risk
          ['==', ['get', 'neighborhood_name'], 'Midtown'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#059669', // Green for lower risk
            0.85, '#ea580c', // Orange for medium risk
            0.9, '#dc2626'  // Red for highest risk
          ],
          // EaDo: Teal-red gradient based on risk
          ['==', ['get', 'neighborhood_name'], 'EaDo'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#0891b2', // Teal for lower risk
            0.85, '#c2410c', // Dark orange for medium risk
            0.9, '#dc2626'  // Red for highest risk
          ],
          // Default fallback based on risk only
          [
            'case',
            ['>=', ['get', 'gentrification_risk'], 0.85], '#dc2626', // Critical risk - red
            ['>=', ['get', 'gentrification_risk'], 0.8], '#ea580c',  // High risk - orange
            '#6b7280' // Default - gray
          ]
        ],
        // DEVELOPMENT MOMENTUM: Opacity based on development activity
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, [
            'interpolate',
            ['linear'],
            ['get', 'development_momentum_score'],
            7.0, 0.4,  // Low momentum: lower opacity
            8.5, 0.6,  // Medium momentum: medium opacity
            10.0, 0.8  // High momentum: high opacity
          ],
          0.3, [
            'interpolate',
            ['linear'],
            ['get', 'development_momentum_score'],
            7.0, 0.7,  // Peak opacity varies with momentum
            8.5, 0.9,
            10.0, 1.0
          ],
          0.7, [
            'interpolate',
            ['linear'],
            ['get', 'development_momentum_score'],
            7.0, 0.3,
            8.5, 0.5,
            10.0, 0.7
          ],
          1.0, 0      // Complete fade regardless of momentum
        ],
        'circle-blur': [
          'interpolate',
          ['linear'],
          ['get', 'development_momentum_score'],
          7.0, 1.0,   // Higher blur for lower momentum (less sharp)
          10.0, 0.3   // Lower blur for higher momentum (more sharp)
        ]
      }
    });
  }
};

// Add static circle markers layer
export const addStaticCircleMarkersLayer = (map) => {
  // Check if map is valid
  if (!map || !map.current) {
    console.warn('⚠️ Map not available for adding static circle markers layer');
    return;
  }

  if (!map.current.getLayer(GENTRIFICATION_CONFIG.LAYER_IDS.circles)) {
    map.current.addLayer({
      id: GENTRIFICATION_CONFIG.LAYER_IDS.circles,
      type: 'circle',
      source: GENTRIFICATION_CONFIG.SOURCE_IDS.data,
      paint: {
        // IMPACT RADIUS UTILIZATION: Size based on actual impact radius and development momentum
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, [
            'max', 
            ['interpolate', ['linear'], ['get', 'development_momentum_score'], 7.0, 3, 10.0, 5], 
            ['min', 15, ['*', ['get', 'impact_radius_meters'], 0.008]]
          ],
          12, [
            'max',
            ['interpolate', ['linear'], ['get', 'development_momentum_score'], 7.0, 4, 10.0, 8],
            ['min', 30, ['*', ['get', 'impact_radius_meters'], 0.015]]
          ],
          16, [
            'max',
            ['interpolate', ['linear'], ['get', 'development_momentum_score'], 7.0, 6, 10.0, 12],
            ['min', 60, ['*', ['get', 'impact_radius_meters'], 0.03]]
          ],
          20, [
            'max',
            ['interpolate', ['linear'], ['get', 'development_momentum_score'], 7.0, 8, 10.0, 16],
            ['min', 100, ['*', ['get', 'impact_radius_meters'], 0.06]]
          ]
        ],
        // NEIGHBORHOOD IDENTITY: Color themes with risk intensity
        'circle-color': [
          'case',
          // Downtown: Green-red gradient (matching Midtown colors)
          ['==', ['get', 'neighborhood_name'], 'Downtown'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#059669',
            0.85, '#059669', 
            0.9, '#dc2626'
          ],
          // Midtown: Green-orange gradient
          ['==', ['get', 'neighborhood_name'], 'Midtown'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#059669',
            0.85, '#ea580c',
            0.9, '#dc2626'
          ],
          // EaDo: Teal-red gradient
          ['==', ['get', 'neighborhood_name'], 'EaDo'], [
            'interpolate',
            ['linear'],
            ['get', 'gentrification_risk'],
            0.8, '#0891b2',
            0.85, '#c2410c',
            0.9, '#dc2626'
          ],
          // Default fallback
          [
            'case',
            ['>=', ['get', 'gentrification_risk'], 0.85], '#dc2626',
            ['>=', ['get', 'gentrification_risk'], 0.8], '#ea580c',
            '#6b7280'
          ]
        ],
        // DEVELOPMENT MOMENTUM: No stroke to keep markers clean
        'circle-stroke-width': 0,
        // TEMPORAL URGENCY: Very low opacity to let pulse show through
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'timeline_to_unaffordable'],
          12, 0.15,   // High urgency (12 months): very transparent
          18, 0.1,    // Medium urgency: very transparent
          24, 0.05    // Low urgency (24 months): barely visible
        ]
      }
    });
  }
};
