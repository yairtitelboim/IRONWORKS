import React, { useState, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const GEOJSON_URL = '/data/ercot/ercot_counties_aggregated.geojson';

// Fuel type color mapping (matching ERCOTGISReportsLayer)
const FUEL_COLORS = {
  'SOL': '#fbbf24',      // Yellow for Solar
  'WIN': '#60a5fa',      // Blue for Wind
  'BAT': '#a78bfa',      // Purple for Battery
  'GAS': '#f87171',      // Red for Gas
  'HYB': '#10b981',      // Green for Hybrid
  'OTH': '#9ca3af',      // Gray for Other
  'NUC': '#f59e0b',      // Orange for Nuclear
  'COA': '#6b7280',      // Dark gray for Coal
  'BIO': '#84cc16',      // Lime for Biomass
  'GEO': '#14b8a6',      // Teal for Geothermal
  'WAT': '#3b82f6',      // Blue for Water/Hydro
};

const getFuelColor = (fuel) => {
  if (!fuel || typeof fuel !== 'string') return '#9ca3af';
  return FUEL_COLORS[fuel.toUpperCase()] || '#9ca3af';
};

// County Details Section Component
const CountyDetailsSection = ({ props, formatCapacityGW, formatCapacityMW, getFuelColor }) => {
  const totalCapacity = props.total_capacity_mw || 0;
  
  // NEW CATEGORIES: Baseload, Renewable, Storage, Other
  const categories = [
    { 
      key: 'BASELOAD', 
      label: 'Baseload', 
      description: 'Gas + Nuclear',
      count: props.baseload_count || 0, 
      capacity: props.baseload_capacity || 0,
      percentage: props.baseload_pct || 0,
      color: '#f87171', // Red for Gas (primary baseload)
      index: props.baseload_index || 0,
      highlight: true // Highlight baseload as key correlation factor
    },
    { 
      key: 'RENEWABLE', 
      label: 'Renewable', 
      description: 'Solar + Wind',
      count: props.renewable_count || 0, 
      capacity: props.renewable_capacity || 0,
      percentage: props.renewable_pct || 0,
      color: '#60a5fa', // Blue for renewable
      index: (props.renewable_pct || 0) / 100
    },
    { 
      key: 'STORAGE', 
      label: 'Storage', 
      description: 'Battery + Storage',
      count: props.storage_count || 0, 
      capacity: props.storage_capacity || 0,
      percentage: props.storage_pct || 0,
      color: '#a78bfa', // Purple for storage
      index: (props.storage_pct || 0) / 100
    },
    { 
      key: 'OTHER', 
      label: 'Other', 
      description: 'Oil, Hydro, Biomass, etc.',
      count: props.fuel_other_count || 0, 
      capacity: props.fuel_other_capacity || 0,
      percentage: props.other_pct || 0,
      color: '#9ca3af', // Gray for other
      index: (props.other_pct || 0) / 100
    }
  ].filter(c => c.count > 0 || c.capacity > 0);

  return (
    <div style={{
      padding: '16px 20px',
      animation: 'slideDown 0.3s ease-out',
      borderTop: '1px solid #333333'
    }}>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 500px;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div style={{
        fontFamily: 'Roboto, Arial, sans-serif',
        maxWidth: '500px'
      }}>
        <h4 style={{
          margin: '0 0 16px 0',
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Capacity by Category
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {categories.map(category => {
            const percentage = category.percentage || (totalCapacity > 0 ? (category.capacity / totalCapacity) * 100 : 0);
            const categoryColor = category.color;
            
            return (
              <div 
                key={category.key} 
                className="category-row-hover"
                style={{ 
                  marginBottom: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: category.highlight ? `${categoryColor}15` : 'transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  position: 'relative',
                  border: category.highlight ? `1px solid ${categoryColor}40` : '1px solid transparent',
                  boxShadow: category.highlight ? `0 0 12px ${categoryColor}30` : 'none'
                }}
                onMouseEnter={(e) => {
                  const container = e.currentTarget;
                  container.style.backgroundColor = `${categoryColor}20`;
                  container.style.transform = 'translateX(4px)';
                  container.style.boxShadow = `0 0 24px ${categoryColor}50, 0 4px 16px ${categoryColor}30, inset 0 0 20px ${categoryColor}10`;
                  container.style.borderColor = `${categoryColor}40`;
                  
                  // Update child elements
                  const icon = container.querySelector('.category-icon');
                  const label = container.querySelector('.category-label');
                  const capacity = container.querySelector('.category-capacity');
                  const progressBar = container.querySelector('.category-progress-bar');
                  const progressFill = container.querySelector('.category-progress-fill');
                  
                  if (icon) {
                    icon.style.transform = 'scale(1.3)';
                    icon.style.boxShadow = `0 0 16px ${categoryColor}80`;
                  }
                  if (label) {
                    label.style.color = '#ffffff';
                    label.style.fontWeight = '600';
                  }
                  if (capacity) {
                    capacity.style.color = categoryColor;
                    capacity.style.textShadow = `0 0 12px ${categoryColor}70`;
                    capacity.style.transform = 'scale(1.05)';
                  }
                  if (progressBar) {
                    progressBar.style.height = '10px';
                    progressBar.style.boxShadow = `0 0 16px ${categoryColor}50`;
                  }
                  if (progressFill) {
                    progressFill.style.boxShadow = `0 0 20px ${categoryColor}80`;
                  }
                }}
                onMouseLeave={(e) => {
                  const container = e.currentTarget;
                  container.style.backgroundColor = 'transparent';
                  container.style.transform = 'translateX(0)';
                  container.style.boxShadow = 'none';
                  container.style.borderColor = 'transparent';
                  
                  // Reset child elements
                  const icon = container.querySelector('.category-icon');
                  const label = container.querySelector('.category-label');
                  const capacity = container.querySelector('.category-capacity');
                  const progressBar = container.querySelector('.category-progress-bar');
                  const progressFill = container.querySelector('.category-progress-fill');
                  
                  if (icon) {
                    icon.style.transform = 'scale(1)';
                    icon.style.boxShadow = `0 0 8px ${categoryColor}60`;
                  }
                  if (label) {
                    label.style.color = '#ffffff';
                    label.style.fontWeight = category.highlight ? '600' : '500';
                  }
                  if (capacity) {
                    capacity.style.color = '#ffffff';
                    capacity.style.textShadow = 'none';
                    capacity.style.transform = 'scale(1)';
                  }
                  if (progressBar) {
                    progressBar.style.height = '8px';
                    progressBar.style.boxShadow = 'none';
                  }
                  if (progressFill) {
                    progressFill.style.boxShadow = `0 0 8px ${categoryColor}40`;
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div 
                      className="category-icon"
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        backgroundColor: categoryColor,
                        boxShadow: `0 0 8px ${categoryColor}60`,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                    <span 
                      className="category-label"
                      style={{
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 500,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {category.label}
                    </span>
                    {category.highlight && (
                      <span style={{
                        color: categoryColor,
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: `${categoryColor}20`,
                        border: `1px solid ${categoryColor}40`,
                        marginLeft: '8px'
                      }}>
                        Key Factor
                      </span>
                    )}
                    <span style={{
                      color: '#6b7280',
                      fontSize: 10,
                      marginLeft: 'auto',
                      transition: 'color 0.3s ease'
                    }}>
                      ({category.count} projects)
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    marginLeft: '16px'
                  }}>
                    <span 
                      className="category-capacity"
                      style={{
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 600,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'inline-block'
                      }}
                    >
                      {formatCapacityGW(category.capacity)}
                    </span>
                    <span style={{
                      color: '#9aa0a6',
                      fontSize: 10,
                      minWidth: '40px',
                      textAlign: 'right',
                      transition: 'color 0.3s ease'
                    }}>
                      {percentage.toFixed(1)}%
                    </span>
                    {category.highlight && category.index !== undefined && (
                      <span style={{
                        color: categoryColor,
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: `${categoryColor}20`,
                        border: `1px solid ${categoryColor}40`
                      }}>
                        Index: {category.index.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div 
                  className="category-progress-bar"
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    marginTop: '8px'
                  }}
                >
                  <div 
                    className="category-progress-fill"
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      backgroundColor: categoryColor,
                      transition: 'all 0.5s ease-out',
                      borderRadius: '4px',
                      boxShadow: `0 0 8px ${categoryColor}40`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary row */}
      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #333333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <span style={{
            color: '#9aa0a6',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Total Capacity
          </span>
          <div style={{
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 600,
            marginTop: '4px'
          }}>
            {formatCapacityGW(totalCapacity)}
          </div>
        </div>
        <div>
          <span style={{
            color: '#9aa0a6',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Baseload Index
          </span>
          <div style={{
            color: props.baseload_index >= 0.3 ? '#f87171' : '#ffffff',
            fontSize: 16,
            fontWeight: 600,
            marginTop: '4px'
          }}>
            {props.baseload_index ? props.baseload_index.toFixed(2) : '0.00'}
          </div>
        </div>
        <div>
          <span style={{
            color: '#9aa0a6',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Total Projects
          </span>
          <div style={{
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 600,
            marginTop: '4px'
          }}>
            {props.project_count || 0}
          </div>
        </div>
      </div>
    </div>
  );
};

const ERCOTCountiesTable = ({ map, isExpanded, onCountChange, onCountySelectedFromMap }) => {
  const [ercotCounties, setErcotCounties] = useState([]);
  const [isLoadingCounties, setIsLoadingCounties] = useState(false);
  const [selectedCountyId, setSelectedCountyId] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const tableRowRefs = useRef({});

  // Load ERCOT counties data
  useEffect(() => {
    if (!isExpanded) return;

    const loadCounties = async () => {
      setIsLoadingCounties(true);
      try {
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) throw new Error('Failed to fetch counties');
        const data = await response.json();
        const features = data.features || [];

        // Filter counties with projects and sort by project count (descending)
        const countiesWithProjects = features
          .filter(f => f.properties?.has_projects && f.properties?.project_count > 0)
          .sort((a, b) => {
            const countA = a.properties?.project_count || 0;
            const countB = b.properties?.project_count || 0;
            return countB - countA; // Descending order
          });

        setErcotCounties(countiesWithProjects);
        
        // Notify parent of count change
        if (onCountChange) {
          onCountChange(countiesWithProjects.length);
        }
      } catch (error) {
        console.error('Failed to load ERCOT counties:', error);
        setErcotCounties([]);
        if (onCountChange) {
          onCountChange(0);
        }
      } finally {
        setIsLoadingCounties(false);
      }
    };

    loadCounties();
  }, [isExpanded, onCountChange]);

  // Listen for county selection from map layer
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleCountySelected = (data) => {
      if (data && data.countyId) {
        console.log('🗺️ [ERCOTCountiesTable] County selected on map:', {
          countyId: data.countyId,
          countyName: data.countyName
        });

        // Find the county in our loaded data - try multiple matching strategies
        let countyFeature = null;
        let matchedId = null;

        // Strategy 1: Match by exact ID
        countyFeature = ercotCounties.find(f => {
          const id = f.id || f.properties?.NAME || f.properties?.name;
          return id === data.countyId;
        });
        if (countyFeature) {
          matchedId = countyFeature.id || countyFeature.properties?.NAME || countyFeature.properties?.name;
        }

        // Strategy 2: Match by county name
        if (!countyFeature && data.countyName) {
          countyFeature = ercotCounties.find(f => {
            const name = f.properties?.NAME || f.properties?.name;
            return name === data.countyName || 
                   name?.toLowerCase() === data.countyName?.toLowerCase();
          });
          if (countyFeature) {
            matchedId = countyFeature.id || countyFeature.properties?.NAME || countyFeature.properties?.name;
          }
        }

        // Strategy 3: Match by normalized county name (remove "County" suffix)
        if (!countyFeature && data.countyName) {
          const normalizedName = data.countyName.replace(/\s+County$/i, '').trim();
          countyFeature = ercotCounties.find(f => {
            const name = (f.properties?.NAME || f.properties?.name || '').replace(/\s+County$/i, '').trim();
            return name === normalizedName || 
                   name?.toLowerCase() === normalizedName?.toLowerCase();
          });
          if (countyFeature) {
            matchedId = countyFeature.id || countyFeature.properties?.NAME || countyFeature.properties?.name;
          }
        }

        if (countyFeature && matchedId) {
          console.log('✅ [ERCOTCountiesTable] Found matching county:', {
            matchedId,
            countyName: countyFeature.properties?.NAME || countyFeature.properties?.name
          });

          // Notify parent to expand section if needed
          if (onCountySelectedFromMap) {
            onCountySelectedFromMap(matchedId);
          }

          // Set selected state
          setSelectedCountyId(matchedId);
          
          // Expand the details section
          setExpandedRowId(matchedId);

          // Scroll to the row if it exists
          setTimeout(() => {
            // Try multiple ID formats for the ref
            const possibleIds = [
              matchedId,
              countyFeature.id,
              countyFeature.properties?.NAME,
              countyFeature.properties?.name,
              data.countyId,
              data.countyName
            ];

            for (const id of possibleIds) {
              const rowElement = tableRowRefs.current[id];
              if (rowElement) {
                console.log('📍 [ERCOTCountiesTable] Scrolling to row with ID:', id);
                rowElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                });
                break;
              }
            }
          }, 300); // Delay to ensure row is rendered and expanded
        } else {
          console.warn('⚠️ [ERCOTCountiesTable] County not found in table data:', {
            countyId: data.countyId,
            countyName: data.countyName,
            availableCounties: ercotCounties.length
          });
        }
      }
    };

    const unsubscribe = window.mapEventBus.on('ercot-county:map-selected', handleCountySelected);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [ercotCounties, onCountySelectedFromMap]);

  // Calculate centroid from geometry for zooming
  const calculateCentroid = (geometry) => {
    if (!geometry) return null;

    try {
      const feature = turf.feature(geometry);
      const centroid = turf.centroid(feature);
      return centroid.geometry.coordinates; // [lng, lat]
    } catch (error) {
      // Fallback: try to get center from bbox
      if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
        const coords = geometry.coordinates[0];
        let sumLng = 0, sumLat = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          sumLng += coords[i][0];
          sumLat += coords[i][1];
        }
        return [sumLng / (coords.length - 1), sumLat / (coords.length - 1)];
      }
      return null;
    }
  };

  // Format capacity in GW
  const formatCapacityGW = (mw) => {
    if (!mw || mw === 0) return '0 GW';
    const gw = mw / 1000;
    return gw >= 1 ? `${gw.toFixed(1)} GW` : `${mw.toFixed(0)} MW`;
  };

  // Format capacity in MW
  const formatCapacityMW = (mw) => {
    if (!mw || mw === 0) return '0 MW';
    return `${mw.toFixed(0)} MW`;
  };

  const handleRowClick = (feature) => {
    const props = feature.properties;
    const countyId = feature.id || props.NAME || props.name;

    console.log('🖱️ [ERCOTCountiesTable] Row clicked:', {
      countyId,
      countyName: props.NAME || props.name,
      hasGeometry: !!feature.geometry
    });

    if (!map?.current) {
      console.warn('⚠️ [ERCOTCountiesTable] Map not available');
      return;
    }

    // Calculate centroid for zooming and click simulation
    const centroid = calculateCentroid(feature.geometry);
    if (!centroid) {
      console.warn('⚠️ [ERCOTCountiesTable] Could not calculate centroid');
      return;
    }

    console.log('📍 [ERCOTCountiesTable] Centroid calculated:', centroid);

    // First, zoom to the county
    map.current.flyTo({
      center: centroid,
      zoom: 8,
      duration: 1000
    });

    console.log('✈️ [ERCOTCountiesTable] Flying to county, waiting for moveend...');

    // Wait for map to finish moving, then simulate click
    map.current.once('moveend', () => {
      console.log('✅ [ERCOTCountiesTable] Map moveend event fired');
      
      // Function to simulate the click
      const simulateClick = () => {
        console.log('🎯 [ERCOTCountiesTable] Simulating click...');
        
        // Convert centroid coordinates to pixel point on map
        const point = map.current.project(centroid);
        console.log('🎯 [ERCOTCountiesTable] Projected point:', point);

        // Query for the county feature at this point
        const FILL_LAYER_ID = 'ercot-counties-fill';

        // Check if layer exists
        if (!map.current.getLayer(FILL_LAYER_ID)) {
          console.warn('⚠️ [ERCOTCountiesTable] Layer does not exist:', FILL_LAYER_ID);
          setSelectedCountyId(countyId);
          return;
        }

        // Try to find the feature by querying rendered features
        let renderedFeatures = [];
        try {
          renderedFeatures = map.current.queryRenderedFeatures(point, {
            layers: [FILL_LAYER_ID]
          });
          console.log('🔍 [ERCOTCountiesTable] Query rendered features result:', {
            count: renderedFeatures.length,
            features: renderedFeatures.map(f => ({
              id: f.id,
              name: f.properties?.NAME || f.properties?.name
            }))
          });
        } catch (error) {
          console.error('❌ [ERCOTCountiesTable] Error querying rendered features:', error);
        }

        // If we found the feature, simulate a click event on the map canvas
        if (renderedFeatures.length > 0) {
          const clickedFeature = renderedFeatures.find(f => 
            f.id === countyId || 
            f.properties?.NAME === props.NAME ||
            f.properties?.name === props.name
          ) || renderedFeatures[0];

          console.log('✅ [ERCOTCountiesTable] Found feature, simulating click:', {
            featureId: clickedFeature.id,
            featureName: clickedFeature.properties?.NAME || clickedFeature.properties?.name
          });

          try {
            // Get the map canvas container
            const canvas = map.current.getCanvasContainer();
            if (canvas) {
              // Get the bounding rect to calculate correct client coordinates
              const rect = canvas.getBoundingClientRect();
              
              const clientX = rect.left + point.x;
              const clientY = rect.top + point.y;
              
              console.log('🖱️ [ERCOTCountiesTable] Creating click event at:', {
                clientX,
                clientY,
                pointX: point.x,
                pointY: point.y,
                rectLeft: rect.left,
                rectTop: rect.top
              });
              
              // Create a DOM click event at the calculated pixel coordinates
              // Mapbox will handle this click and route it to the layer handler
              const domEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: clientX,
                clientY: clientY,
                button: 0,
                buttons: 1,
                view: window
              });

              console.log('📤 [ERCOTCountiesTable] Dispatching click event on canvas');
              
              // Dispatch the event on the canvas - Mapbox will process it
              canvas.dispatchEvent(domEvent);
              
              console.log('✅ [ERCOTCountiesTable] Click event dispatched');
            } else {
              console.warn('⚠️ [ERCOTCountiesTable] Canvas container not found');
            }
          } catch (error) {
            console.error('❌ [ERCOTCountiesTable] Error dispatching click event:', error);
            
            // Fallback: if DOM event fails, try to manually trigger selection
            // by querying source and setting feature state directly
            try {
              const SOURCE_ID = 'ercot-counties-source';
              const sourceFeatures = map.current.querySourceFeatures(SOURCE_ID, {
                filter: ['==', ['id'], countyId]
              });

              console.log('🔄 [ERCOTCountiesTable] Fallback: querying source features:', {
                count: sourceFeatures.length
              });

              if (sourceFeatures.length > 0 && window.mapEventBus) {
                window.mapEventBus.emit('ercot-county:table-selected', {
                  countyId: countyId,
                  properties: props,
                  geometry: feature.geometry,
                  point: point
                });
                console.log('📡 [ERCOTCountiesTable] Emitted fallback event');
              }
            } catch (fallbackError) {
              console.error('❌ [ERCOTCountiesTable] Fallback also failed:', fallbackError);
            }
          }
        } else {
          console.warn('⚠️ [ERCOTCountiesTable] No features found at point, retrying...');
          
          // Feature not rendered yet, try after a short delay
          setTimeout(() => {
            console.log('🔄 [ERCOTCountiesTable] Retrying query after delay...');
            const retryFeatures = map.current.queryRenderedFeatures(point, {
              layers: [FILL_LAYER_ID]
            });
            
            console.log('🔍 [ERCOTCountiesTable] Retry query result:', {
              count: retryFeatures.length
            });
            
            if (retryFeatures.length > 0) {
              const canvas = map.current.getCanvasContainer();
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const domEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + point.x,
                  clientY: rect.top + point.y,
                  button: 0,
                  buttons: 1,
                  view: window
                });
                console.log('📤 [ERCOTCountiesTable] Dispatching retry click event');
                canvas.dispatchEvent(domEvent);
              }
            } else {
              console.warn('⚠️ [ERCOTCountiesTable] Still no features found after retry');
            }
          }, 200);
        }
      };

      // Try idle event first, but also set a timeout fallback
      let clickSimulated = false;
      
      const executeClick = () => {
        if (clickSimulated) return;
        clickSimulated = true;
        console.log('✅ [ERCOTCountiesTable] Executing click simulation...');
        simulateClick();
      };

      // Set timeout fallback (500ms after moveend)
      const timeoutId = setTimeout(() => {
        if (!clickSimulated) {
          console.log('⏰ [ERCOTCountiesTable] Idle event timeout, simulating click anyway...');
          executeClick();
        }
      }, 500);

      // Wait for map to be idle and rendered
      map.current.once('idle', () => {
        console.log('✅ [ERCOTCountiesTable] Map idle event fired');
        clearTimeout(timeoutId);
        executeClick();
      });

      // Also try after a short delay as backup (in case idle doesn't fire)
      setTimeout(() => {
        if (!clickSimulated) {
          console.log('⏰ [ERCOTCountiesTable] Short delay backup, simulating click...');
          executeClick();
        }
      }, 300);
    });

    // Set selected state in table
    setSelectedCountyId(countyId);
    
    // Toggle expanded row
    setExpandedRowId(prev => prev === countyId ? null : countyId);
  };

  return (
    <div style={{ paddingBottom: 24, paddingTop: 16 }}>
      {isLoadingCounties ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#9aa0a6',
          fontSize: 12,
          fontFamily: 'Roboto, Arial, sans-serif'
        }}>
          Loading counties...
        </div>
      ) : ercotCounties.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#9aa0a6',
          fontSize: 12,
          fontFamily: 'Roboto, Arial, sans-serif'
        }}>
          No counties found
        </div>
      ) : (
        <div style={{
          margin: '0 20px',
          overflowX: 'auto',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: 11
          }}>
            <thead>
              <tr style={{
                background: '#2a2a2a',
                borderBottom: '1px solid #333333',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>County</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Projects</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Total Capacity</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Avg Capacity</th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Dominant Fuel</th>
              </tr>
            </thead>
            <tbody>
              {ercotCounties.map((feature, index) => {
                const props = feature.properties;
                const countyId = feature.id || props.NAME || props.name || index;
                const isSelected = selectedCountyId === countyId;
                const dominantFuel = props.dominant_fuel_type || props.dominantFuel || 'N/A';
                const fuelColor = getFuelColor(dominantFuel);

                return (
                  <React.Fragment key={countyId}>
                    <tr
                      ref={(el) => {
                        if (el) {
                          // Store ref with multiple keys for easier lookup
                          tableRowRefs.current[countyId] = el;
                          if (props.NAME) tableRowRefs.current[props.NAME] = el;
                          if (props.name) tableRowRefs.current[props.name] = el;
                          // Also store with feature ID if different
                          if (feature.id && feature.id !== countyId) {
                            tableRowRefs.current[feature.id] = el;
                          }
                        }
                      }}
                      style={{
                        borderBottom: expandedRowId === countyId ? 'none' : '1px solid #333333',
                        transition: 'background-color 0.3s ease, border-left 0.3s ease',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#1a4d3a' : 'transparent',
                        borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#333333';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      onClick={() => handleRowClick(feature)}
                    >
                    <td style={{
                      padding: '10px 12px',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 500
                    }}>
                      {props.NAME || props.name || 'Unknown'}
                    </td>
                    <td style={{
                      padding: '10px 12px',
                      color: '#d1d5db',
                      fontSize: 11
                    }}>
                      {props.project_count || 0}
                    </td>
                    <td style={{
                      padding: '10px 12px',
                      color: '#9aa0a6',
                      fontSize: 10
                    }}>
                      {formatCapacityGW(props.total_capacity_mw || 0)}
                    </td>
                    <td style={{
                      padding: '10px 12px',
                      color: '#9aa0a6',
                      fontSize: 10
                    }}>
                      {formatCapacityMW(props.avg_capacity_mw || 0)}
                    </td>
                    <td style={{
                      padding: '10px 12px'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: 9,
                        fontWeight: 500,
                        backgroundColor: fuelColor,
                        color: '#000000',
                        textTransform: 'uppercase'
                      }}>
                        {dominantFuel}
                      </span>
                    </td>
                    </tr>
                    {/* Expandable details section */}
                    {expandedRowId === countyId && (
                      <tr>
                        <td colSpan={5} style={{
                          padding: 0,
                          borderBottom: '1px solid #333333',
                          backgroundColor: '#1a1a1a'
                        }}>
                          <CountyDetailsSection
                            props={props}
                            formatCapacityGW={formatCapacityGW}
                            formatCapacityMW={formatCapacityMW}
                            getFuelColor={getFuelColor}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ERCOTCountiesTable;

