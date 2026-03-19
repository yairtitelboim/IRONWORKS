/**
 * MCP Chat Panel - Phase 2 Enhanced
 * Natural language infrastructure search with message history and statistics
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { parseQuery } from '../../../mcp/queryParser';
import * as turf from '@turf/turf';
import { queryPerplexity } from '../../../services/perplexityClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from 'recharts';

// Add fadeIn animation style
const fadeInStyle = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes answerPulse {
    0%, 100% {
      transform: scale(1) translateY(0);
    }
    50% {
      transform: scale(1.01) translateY(-1px);
    }
  }
  
  @keyframes answerHover {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3px);
    }
    100% {
      transform: translateY(0);
    }
  }
  
  /* Override Recharts default hover effects */
  .recharts-wrapper,
  .recharts-wrapper:hover,
  .recharts-surface,
  .recharts-surface:hover,
  .recharts-tooltip-wrapper,
  .recharts-tooltip-wrapper:hover {
    background: transparent !important;
    background-color: transparent !important;
  }
  
  .recharts-bar-rectangle:hover {
    opacity: 1 !important;
  }
`;

// Inject animation styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = fadeInStyle;
  if (!document.head.querySelector('style[data-mcp-fadein]')) {
    styleElement.setAttribute('data-mcp-fadein', 'true');
    document.head.appendChild(styleElement);
  }
}

const MCPChatPanel = ({ map, onClose, isOpen, inlineMode = false }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]); // Message history
  const [lastResults, setLastResults] = useState(null); // Last search results for stats
  const [expandedQuickAction, setExpandedQuickAction] = useState(null); // Track which quick action is expanded
  const [quickActionResponses, setQuickActionResponses] = useState({}); // Store responses per quick action
  const [showAnswer, setShowAnswer] = useState({}); // Track when to show answer (after delay)
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Helper function to process features into chart data (distance distribution)
  const processFeaturesForChart = (features) => {
    if (!features || features.length === 0) return [];

    // Define distance bins (in km)
    const bins = [
      { range: '0-1', min: 0, max: 1, count: 0 },
      { range: '1-2', min: 1, max: 2, count: 0 },
      { range: '2-5', min: 2, max: 5, count: 0 },
      { range: '5-10', min: 5, max: 10, count: 0 },
      { range: '10+', min: 10, max: Infinity, count: 0 }
    ];

    // Count features in each bin
    features.forEach((feature) => {
      const props = feature.properties || {};
      const distanceKm = props.distance_m ? props.distance_m / 1000 : null;
      
      if (distanceKm !== null) {
        for (let i = 0; i < bins.length; i++) {
          if (distanceKm >= bins[i].min && distanceKm < bins[i].max) {
            bins[i].count++;
            break;
          }
        }
      }
    });

    return bins.map(bin => ({
      range: bin.range,
      count: bin.count,
      label: bin.range === '10+' ? '10+ km' : `${bin.range} km`
    }));
  };

  // Helper function to render clickable response text with feature links
  const renderClickableResponseText = (responseText, features, section = 'power') => {
    if (!responseText || typeof responseText !== 'string') return responseText;

    const sectionColors = {
      power: {
        text: '#c084fc',
        textHover: '#a78bfa',
        textRgba: 'rgba(192, 132, 252, 0.5)',
        textRgbaHover: 'rgba(167, 139, 250, 0.8)'
      },
      water: {
        text: '#22d3ee',
        textHover: '#06b6d4',
        textRgba: 'rgba(34, 211, 238, 0.5)',
        textRgbaHover: 'rgba(6, 182, 212, 0.8)'
      }
    };
    const colors = sectionColors[section] || sectionColors.power;

    // Split by lines to find feature list
    const lines = responseText.split('\n');
    const renderedLines = [];

    lines.forEach((line, lineIndex) => {
      // Check if this line is a feature entry (e.g., "1. **Name** - category (distance)")
      const featureMatch = line.match(/^(\d+)\.\s*\*\*(.*?)\*\*\s*-\s*(.+?)\s*\((.+?)\)/);
      
      if (featureMatch && features.length > 0) {
        const featureIndex = parseInt(featureMatch[1], 10) - 1; // Convert to 0-based index
        const featureName = featureMatch[2];
        const category = featureMatch[3];
        const distance = featureMatch[4];
        const feature = features[featureIndex];

        if (feature && feature.geometry) {
          // Extract coordinates based on geometry type
          let coordinates = null;
          if (feature.geometry.type === 'Point') {
            coordinates = feature.geometry.coordinates;
          } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            try {
              const centroid = turf.centroid(feature);
              coordinates = centroid.geometry.coordinates;
            } catch (err) {
              // Fallback: use first coordinate of first ring
              const coords = feature.geometry.coordinates[0];
              coordinates = (coords && coords[0]) || null;
            }
          } else if (feature.geometry.type === 'LineString') {
            coordinates = feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'MultiLineString') {
            const coords = feature.geometry.coordinates[0];
            coordinates = (coords && coords[0]) || null;
          }

          if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
            // This is a clickable feature line
            renderedLines.push(
              <div key={`feature-${lineIndex}`} style={{ marginBottom: '4px' }}>
                <span>{featureMatch[1]}. </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    // Emit event to zoom to this marker
                    if (window.mapEventBus) {
                      window.mapEventBus.emit('mcp:zoomToFeature', {
                        featureIndex: featureIndex,
                        coordinates: coordinates,
                        feature: feature
                      });
                    }
                  }}
                  style={{
                    fontWeight: '800',
                    color: colors.text,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: colors.textRgba,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = colors.textHover;
                    e.target.style.textDecorationColor = colors.textRgbaHover;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = colors.text;
                    e.target.style.textDecorationColor = colors.textRgba;
                  }}
                >
                  {featureName}
                </span>
                <span> - {category} ({distance})</span>
              </div>
            );
            return;
          }
        }
      }
      
      // Regular line, render with markdown formatting
      const parts = line.split(/(\*\*.*?\*\*)/g);
      renderedLines.push(
        <div key={`line-${lineIndex}`} style={{ marginBottom: '4px' }}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              return (
                <strong key={partIdx} style={{ color: colors.text, fontWeight: '600' }}>
                  {boldText}
                </strong>
              );
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </div>
      );
    });

    return <>{renderedLines}</>;
  };

  // Helper function to render quick action button
  const renderQuickActionButton = (action, actionIdx, isExpanded, response, isThisActionLoading, section = 'power') => {
    const sectionColors = {
      power: {
        bg: 'rgba(139, 92, 246, 0.1)',
        bgExpanded: 'rgba(139, 92, 246, 0.3)',
        border: 'rgba(139, 92, 246, 0.2)',
        borderExpanded: 'rgba(139, 92, 246, 0.4)',
        text: '#c084fc',
        hover: 'rgba(139, 92, 246, 0.2)',
        hoverExpanded: 'rgba(139, 92, 246, 0.4)'
      },
      water: {
        bg: 'rgba(6, 182, 212, 0.1)',
        bgExpanded: 'rgba(6, 182, 212, 0.3)',
        border: 'rgba(6, 182, 212, 0.2)',
        borderExpanded: 'rgba(6, 182, 212, 0.4)',
        text: '#22d3ee',
        hover: 'rgba(6, 182, 212, 0.2)',
        hoverExpanded: 'rgba(6, 182, 212, 0.4)'
      }
    };
    const colors = sectionColors[section] || sectionColors.power;

    return (
      <>
        <button
          onClick={async () => {
            // Log click event for "Power plants within 20km" specifically
            const isPowerPlantsQuery = action.query?.toLowerCase().includes('power plants within 20km');
            if (isPowerPlantsQuery) {
              console.log('🔍 [Power Plants 20km] MCPChatPanel click event:', {
                actionLabel: action.label,
                actionQuery: action.query,
                actionIdx,
                isExpanded,
                timestamp: new Date().toISOString(),
                pinalSiteMarkers: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0
              });
            }
            
            if (isExpanded) {
              if (isPowerPlantsQuery) {
                console.log('🔍 [Power Plants 20km] Toggling closed in MCPChatPanel');
              }
              setExpandedQuickAction(null);
              setShowAnswer(prev => ({ ...prev, [actionIdx]: false }));
            } else {
              if (isPowerPlantsQuery) {
                console.log('🔍 [Power Plants 20km] Toggling open in MCPChatPanel, setting query and submitting form');
              }
              setExpandedQuickAction(actionIdx);
              setQuery(action.query);
              // Hide answer initially, will show after delay
              setShowAnswer(prev => ({ ...prev, [actionIdx]: false }));
              setTimeout(() => {
                const form = inputRef.current?.form;
                if (form) {
                  if (isPowerPlantsQuery) {
                    console.log('🔍 [Power Plants 20km] Dispatching form submit event');
                  }
                  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
              }, 100);
            }
          }}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: isExpanded ? colors.bgExpanded : colors.bg,
            border: `1px solid ${isExpanded ? colors.borderExpanded : colors.border}`,
            borderRadius: '4px',
            color: colors.text,
            fontSize: '12px',
            textAlign: 'left',
            cursor: isThisActionLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            pointerEvents: isThisActionLoading ? 'none' : 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => {
            if (!isThisActionLoading) {
              e.target.style.background = isExpanded ? colors.hoverExpanded : colors.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isThisActionLoading) {
              e.target.style.background = isExpanded ? colors.bgExpanded : colors.bg;
            }
          }}
        >
          <span>{action.label}</span>
          <span style={{ 
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>
        </button>
        
        {/* Expanded Answer Section - Only shows answer, no question */}
        {isExpanded && (
          <div style={{
            marginTop: '8px',
            opacity: 0,
            animation: 'fadeIn 0.3s ease forwards'
          }}>
            {isThisActionLoading ? (
              <div style={{
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                textAlign: 'center',
                padding: '20px'
              }}>
                Searching...
              </div>
            ) : response && showAnswer[actionIdx] ? (
              <>
                {/* Answer Card - Appears after delay with pulse and hover animations */}
                <div style={{
                  padding: '12px 16px',
                  background: section === 'power' 
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)',
                  borderRadius: '8px',
                  border: `1px solid ${colors.borderExpanded}`,
                  boxShadow: section === 'power'
                    ? '0 4px 12px rgba(139, 92, 246, 0.2), 0 2px 4px rgba(139, 92, 246, 0.1)'
                    : '0 4px 12px rgba(6, 182, 212, 0.2), 0 2px 4px rgba(6, 182, 212, 0.1)',
                  animation: 'fadeIn 0.3s ease forwards, answerPulse 1s ease-in-out 0.3s, answerHover 1s ease-in-out 1.3s',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    fontWeight: '600'
                  }}>
                    Answer
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: colors.text,
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Roboto, Arial, sans-serif'
                  }}>
                    {renderClickableResponseText(response.response, response.features || [], section)}
                  </div>
                </div>
                
                {/* Statistics Graph Card - Below Answer */}
                {response.features && response.features.length > 0 && (() => {
                  const chartData = processFeaturesForChart(response.features);
                  const maxCount = Math.max(...chartData.map(d => d.count), 1);
                  const chartColor = section === 'power' ? '#c084fc' : '#22d3ee';
                  
                  return (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      background: section === 'power'
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)'
                        : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      boxShadow: section === 'power'
                        ? '0 2px 8px rgba(139, 92, 246, 0.15)'
                        : '0 2px 8px rgba(6, 182, 212, 0.15)',
                      animation: 'fadeIn 0.4s ease forwards 0.5s',
                      opacity: 0
                    }}>
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>📊</span>
                        Marker Distribution by Distance
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '180px',
                        backgroundColor: 'transparent'
                      }}>
                        <ResponsiveContainer>
                          <BarChart 
                            data={chartData} 
                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                            style={{ cursor: 'default' }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis
                              dataKey="label"
                              stroke="rgba(255, 255, 255, 0.5)"
                              tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                              tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                            />
                            <YAxis
                              stroke="rgba(255, 255, 255, 0.5)"
                              tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                              tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                              width={30}
                              domain={[0, maxCount > 0 ? Math.ceil(maxCount * 1.2) : 5]}
                            />
                            <Bar 
                              dataKey="count" 
                              radius={[4, 4, 0, 0]}
                              isAnimationActive={false}
                            >
                              {chartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={chartColor} 
                                  opacity={0.7 + (entry.count / maxCount) * 0.3}
                                  style={{ cursor: 'default' }}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{
                        marginTop: '8px',
                        fontSize: '10px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        Total: {response.features.length} markers found
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : response ? (
              /* Waiting state - response received but waiting for delay */
              <div style={{
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                textAlign: 'center',
                padding: '20px'
              }}>
                Loading answer...
              </div>
            ) : (
              <div style={{
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                textAlign: 'center',
                padding: '20px'
              }}>
                Click to search
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Listen for event to trigger first quick action
  useEffect(() => {
    if (!window.mapEventBus || !isOpen) return;

    const handleTriggerFirstQuickAction = () => {
      // Only trigger if panel is open
      if (!isOpen) return;
      
      // Trigger a Pennsylvania-focused quick action:
      // Substations near Three Mile Island (uses new PA facility config)
      const firstQuickAction = { 
        label: 'Substations near Three Mile Island', 
        query: 'substations near Three Mile Island' 
      };
      
      setExpandedQuickAction(0);
      setQuery(firstQuickAction.query);
      
      // Auto-submit after a brief delay to ensure state is updated
      setTimeout(() => {
        const form = inputRef.current?.form;
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 150);
    };

    const unsubscribe = window.mapEventBus.on('mcp:triggerFirstQuickAction', handleTriggerFirstQuickAction);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  // Format results as table data for AIResponseDisplayRefactored
  const formatResultsForTable = (data, parsed) => {
    if (!data || !data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map((feature, index) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [];
      
      // Calculate centroid if needed
      let coordinates = coords;
      if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
        try {
          const centroid = turf.centroid(feature);
          coordinates = centroid.geometry.coordinates;
        } catch (e) {
          console.warn('Could not calculate centroid', e);
        }
      }

      // Extract name - skip "Unnamed" and try multiple OSM property fields
      let name = null;
      if (props.name && props.name !== 'Unnamed' && props.name.trim() !== '') {
        name = props.name;
      } else if (props.operator && props.operator.trim() !== '') {
        name = props.operator;
      } else if (props.ref && props.ref.trim() !== '') {
        name = `Ref: ${props.ref}`;
      } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
        name = props['operator:ref'];
      } else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
        name = props.power;
      } else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
        name = props.man_made;
      } else if (props.substation && props.substation.trim() !== '') {
        name = props.substation;
      } else if (props.type && props.type.trim() !== '') {
        name = props.type;
      } else {
        // Fallback to category-based name
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${index + 1}`;
      }

      return {
        id: props.id || `mcp-${index}`,
        name: name,
        category: props.category || props.power || props.man_made || 'infrastructure',
        distance: props.distance_m ? (props.distance_m / 1000).toFixed(2) + ' km' : null,
        distance_m: props.distance_m || 0,
        power: props.power || null,
        voltage: props.voltage || null,
        material: props.material || null,
        operator: props.operator || null,
        type: props.man_made || props.type || null,
        color: '#8b5cf6', // Purple for MCP search
        description: `${props.name || 'Infrastructure'} - ${props.category || 'infrastructure'}`,
        geometry: feature.geometry,
        coordinates: coordinates.length >= 2 ? {
          lng: coordinates[0],
          lat: coordinates[1]
        } : null
      };
    });
  };

  // Format results as text response for AIResponseDisplayRefactored
  const formatResultsAsText = (data, parsed) => {
    const summary = data.summary || {};
    const count = summary.withinRadius || data.features?.length || 0;
    const facility = parsed.facilityName || parsed.facilityKey || 'facility';
    const radius = parsed.radius ? (parsed.radius / 1000).toFixed(1) : 'unknown';
    const category = parsed.category ? ` (${parsed.category})` : '';
    
    if (count === 0) {
      return `No infrastructure found within ${radius}km of ${facility}${category}.`;
    }
    
    let text = `Found **${count}** infrastructure feature${count !== 1 ? 's' : ''} within ${radius}km of ${facility}${category}.\n\n`;
    
    if (data.features && data.features.length > 0) {
      text += '**Results:**\n\n';
      data.features.slice(0, 10).forEach((feature, index) => {
        const props = feature.properties || {};
        
        // Extract name - skip "Unnamed" and try multiple OSM property fields
        let name = null;
        if (props.name && props.name !== 'Unnamed' && props.name.trim() !== '') {
          name = props.name;
        } else if (props.operator && props.operator.trim() !== '') {
          name = props.operator;
        } else if (props.ref && props.ref.trim() !== '') {
          name = `Ref: ${props.ref}`;
        } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
          name = props['operator:ref'];
        } else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
          name = props.power;
        } else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
          name = props.man_made;
        } else if (props.substation && props.substation.trim() !== '') {
          name = props.substation;
        } else if (props.type && props.type.trim() !== '') {
          name = props.type;
        } else {
          // Fallback to category-based name
          const cat = props.category || props.power || props.man_made || 'infrastructure';
          name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${index + 1}`;
        }
        
        const distance = props.distance_m ? (props.distance_m / 1000).toFixed(2) + ' km' : 'unknown';
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        text += `${index + 1}. **${name}** - ${cat} (${distance})\n`;
      });
      
      if (data.features.length > 10) {
        text += `\n... and ${data.features.length - 10} more results.`;
      }
    }
    
    return text;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    // Log for Power Plants 20km query
    const isPowerPlantsQuery = query.toLowerCase().includes('power plants within 20km');
    if (isPowerPlantsQuery) {
      console.log('🔍 [Power Plants 20km] handleSubmit called:', {
        query,
        isLoading,
        expandedQuickAction,
        pinalSiteMarkers: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0,
        timestamp: new Date().toISOString()
      });
    }

    setIsLoading(true);
    setError(null);
    
    // Track if this is from a quick action
    const currentQuickAction = expandedQuickAction;

    try {
      // Parse the query
      const parsed = parseQuery(query);
      
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Query parsed:', parsed);
      }
      
      if (parsed.error) {
        setError(parsed.error);
        setIsLoading(false);
        return;
      }

      if (!parsed.facilityKey) {
        setError('Could not identify facility. Try: "substations near Three Mile Island" or "water infrastructure near Susquehanna"');
        setIsLoading(false);
        return;
      }

      // Call API
      let response;
      try {
        response = await fetch('http://localhost:3001/api/mcp/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            facilityName: parsed.facilityName,
            facilityKey: parsed.facilityKey,
            radius: parsed.radius,
            category: parsed.category
          })
        });
      } catch (fetchError) {
        // Network error - server likely not running
        console.error('❌ Network error:', fetchError);
        if (fetchError.message.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          throw new Error('Cannot connect to server. Make sure the backend server is running on port 3001. Run: node server.js');
        }
        throw fetchError;
      }

      if (!response.ok) {
        // Check content-type before parsing JSON
        const contentType = response.headers.get('content-type');
        let errorData;
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (parseErr) {
            const text = await response.text();
            console.error('❌ Failed to parse error response as JSON:', text);
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
          }
        } else {
          const text = await response.text();
          console.error('❌ Non-JSON error response:', text);
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }
        throw new Error(errorData.message || errorData.error || `Search failed (${response.status})`);
      }

      // Check content-type before parsing successful response
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          const text = await response.text();
          console.error('❌ Failed to parse response as JSON:', text);
          throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
        }
      } else {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }


      // Add user message to history
      const userMessage = {
        role: 'user',
        content: query,
        timestamp: Date.now()
      };

      // Add assistant response to history
      const assistantMessage = {
        role: 'assistant',
        content: formatResultsMessage(data, parsed),
        results: data,
        parsed: parsed,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setLastResults(data);
      
      // Store response for quick actions if this was triggered by one
      if (currentQuickAction !== null) {
        const formattedResponse = formatResultsAsText(data, parsed);
        setQuickActionResponses(prev => ({
          ...prev,
          [currentQuickAction]: {
            query: query,
            response: formattedResponse,
            results: data,
            features: data.features || [], // Store features for clickable rendering
            timestamp: Date.now()
          }
        }));
        // Show answer after 0.5 second delay with animation
        setTimeout(() => {
          setShowAnswer(prev => ({ ...prev, [currentQuickAction]: true }));
        }, 500);
      }

      // Emit results to map via event bus
      if (window.mapEventBus) {
        if (isPowerPlantsQuery) {
          console.log('🔍 [Power Plants 20km] About to emit mcp:searchResults:', {
            featuresCount: data?.features?.length || 0,
            pinalSiteMarkers: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0,
            timestamp: new Date().toISOString()
          });
        }
        window.mapEventBus.emit('mcp:searchResults', {
          query: query,
          parsed: parsed,
          results: data,
          timestamp: Date.now()
        });
        if (isPowerPlantsQuery) {
          console.log('🔍 [Power Plants 20km] mcp:searchResults event emitted');
        }
        
        // Also emit formatted results for AIResponseDisplayRefactored
        const formattedTableData = formatResultsForTable(data, parsed);
        const formattedResponse = formatResultsAsText(data, parsed);
        
        // Call Perplexity for a short answer (for both water and energy/power questions)
        let perplexityAnswer = null;
        let perplexityCitations = [];
        const isWaterQuestion = query.toLowerCase().includes('water') || 
                                parsed.category === 'water' ||
                                parsed.category === 'water_allocation' ||
                                parsed.category === 'agricultural_water' ||
                                parsed.category === 'state_trust_land';
        const isEnergyQuestion = query.toLowerCase().includes('power') ||
                                query.toLowerCase().includes('substation') ||
                                query.toLowerCase().includes('transmission') ||
                                query.toLowerCase().includes('tower') ||
                                query.toLowerCase().includes('transformer') ||
                                query.toLowerCase().includes('electrical') ||
                                parsed.category === 'power' ||
                                parsed.category === 'transmission';
        
        // Call Perplexity for all questions (water and energy/power)
        if (isWaterQuestion || isEnergyQuestion || true) { // Call for all questions
          try {
            const summary = data.summary || {};
            const count = summary.withinRadius || data.features?.length || 0;
            const context = `Found ${count} infrastructure features. ${formattedResponse}`;
            const perplexityResult = await queryPerplexity(query, context);
            if (perplexityResult && perplexityResult.answer) {
              perplexityAnswer = perplexityResult.answer;
              perplexityCitations = perplexityResult.citations || [];
            }
          } catch (perplexityError) {
            console.warn('⚠️ Perplexity query failed:', perplexityError);
            // Don't block the flow if Perplexity fails
          }
        }
        
        if (window.mapEventBus) {
          window.mapEventBus.emit('mcp:displayResults', {
            query: query,
            response: formattedResponse,
            tableData: formattedTableData,
            citations: perplexityCitations, // Pass Perplexity citations
            perplexityAnswer: perplexityAnswer, // Add Perplexity answer
            perplexityCitations: perplexityCitations, // Also pass separately for metadata
            features: data.features || [], // Store features for clickable functionality
            timestamp: Date.now()
          });
        }
      }

      // Clear query on success
      setQuery('');
      setIsLoading(false);

    } catch (err) {
      console.error('❌ MCP Search error:', err);
      console.error('❌ Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      // Provide user-friendly error messages
      let errorMsg = err.message || 'Search failed. Please try again.';
      if (err.message.includes('Failed to fetch') || err.message.includes('Cannot connect')) {
        errorMsg = 'Cannot connect to server. Please make sure the backend server is running on port 3001.';
      }
      
      setError(errorMsg);
      
      // Add error message to history
      const userMessage = {
        role: 'user',
        content: query,
        timestamp: Date.now()
      };
      const errorMessage = {
        role: 'assistant',
        content: `❌ Error: ${errorMsg}`,
        isError: true,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage, errorMessage]);
      
      setIsLoading(false);
    }
  };

  // Format results message for display
  const formatResultsMessage = (data, parsed) => {
    const summary = data.summary || {};
    const count = summary.withinRadius || 0;
    const facility = parsed.facilityName || parsed.facilityKey || 'facility';
    const radius = (parsed.radius / 1000).toFixed(1);
    const category = parsed.category ? ` (${parsed.category})` : '';
    
    if (count === 0) {
      return `No infrastructure found within ${radius}km of ${facility}${category}.`;
    }
    
    return `Found **${count}** infrastructure feature${count !== 1 ? 's' : ''} within ${radius}km of ${facility}${category}.`;
  };

  // Calculate statistics from results
  const calculateStats = (results) => {
    if (!results || !results.features) return null;
    
    const features = results.features;
    const categories = {};
    let totalDistance = 0;
    let minDistance = Infinity;
    let maxDistance = 0;
    
    features.forEach(feature => {
      const category = feature.properties?.category || feature.properties?.power || feature.properties?.man_made || 'other';
      categories[category] = (categories[category] || 0) + 1;
      
      const distance = feature.properties?.distance_m || 0;
      if (distance > 0) {
        totalDistance += distance;
        minDistance = Math.min(minDistance, distance);
        maxDistance = Math.max(maxDistance, distance);
      }
    });
    
    return {
      total: features.length,
      categories,
      avgDistance: totalDistance > 0 ? (totalDistance / features.length / 1000).toFixed(2) : 0,
      minDistance: minDistance !== Infinity ? (minDistance / 1000).toFixed(2) : 0,
      maxDistance: (maxDistance / 1000).toFixed(2)
    };
  };

  const stats = lastResults ? calculateStats(lastResults) : null;


  if (!isOpen) return null;

  // Inline mode styling (for use inside AITransmissionNav)
  if (inlineMode) {
    return (
      <div style={{
        width: '100%',
        minHeight: '600px',
        maxHeight: '1000px',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.3)',
        bordr: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'auto',
        overflow: 'hidden', // Prevent content from bleeding out
        boxSizing: 'border-box'
      }}>
      {/* Header - hide in inline mode, SectionHeader handles it */}
      {false && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            🔍 Infrastructure Search
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setLastResults(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                  pointerEvents: 'auto' // Ensure button is clickable
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                title="Clear history"
              >
                Clear
              </button>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background 0.2s',
                zIndex: 10001, // Higher than container
                position: 'relative',
                pointerEvents: 'auto' // Ensure button is clickable
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* Clear button for inline mode */}
      {inlineMode && messages.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={() => {
              setMessages([]);
              setLastResults(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a78bfa',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.2s',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Clear history"
          >
            Clear History
          </button>
        </div>
      )}

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: inlineMode ? '11px' : '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        lineHeight: '1.4',
        marginBottom: inlineMode ? '8px' : '0'
      }}>
        Ask questions like: "substations near Three Mile Island" or "water infrastructure near Susquehanna"
      </p>

      {/* Message History */}
      {messages.length > 0 && (
        <div style={{
          flex: '0 1 auto',
          minHeight: '200px',
          maxHeight: '600px',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'auto', // Ensure scrollable area is interactive
          boxSizing: 'border-box'
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                padding: '8px 12px',
                background: msg.role === 'user'
                  ? 'rgba(139, 92, 246, 0.2)'
                  : msg.isError
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(139, 92, 246, 0.1)',
                borderRadius: '8px',
                maxWidth: '85%',
                fontSize: '13px',
                color: msg.isError ? '#fca5a5' : '#e9d5ff',
                lineHeight: '1.4',
                border: msg.role === 'user'
                  ? '1px solid rgba(139, 92, 246, 0.3)'
                  : '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                {msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <div>
                    <div style={{ marginBottom: msg.results ? '8px' : '0' }}>
                      {msg.content.split('**').map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.4)',
                padding: '0 4px'
              }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Summary Statistics */}
      {stats && stats.total > 0 && (
        <div style={{
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}>
          <div style={{
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Summary Statistics
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '12px',
            color: '#e9d5ff'
          }}>
            <div>
              <strong>Total Results:</strong> {stats.total}
            </div>
            <div>
              <strong>Avg Distance:</strong> {stats.avgDistance} km
            </div>
            <div>
              <strong>Min Distance:</strong> {stats.minDistance} km
            </div>
            <div>
              <strong>Max Distance:</strong> {stats.maxDistance} km
            </div>
          </div>
          {Object.keys(stats.categories).length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <strong style={{ color: '#e9d5ff' }}>Categories:</strong>
              <div style={{
                marginTop: '4px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px'
              }}>
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <span
                    key={cat}
                    style={{
                      padding: '2px 6px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#c084fc'
                    }}
                  >
                    {cat}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px', 
        pointerEvents: 'auto',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., substations near Three Mile Island"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            pointerEvents: 'auto', // Ensure input is clickable
            boxSizing: 'border-box'
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)'}
        />

        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px',
            boxSizing: 'border-box'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          style={{
            padding: '10px 16px',
            background: isLoading || !query.trim() 
              ? 'rgba(139, 92, 246, 0.2)' 
              : 'rgba(139, 92, 246, 0.8)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            pointerEvents: 'auto', // Ensure button is clickable
            boxSizing: 'border-box'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && query.trim()) {
              e.target.style.background = 'rgba(139, 92, 246, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && query.trim()) {
              e.target.style.background = 'rgba(139, 92, 246, 0.8)';
            }
          }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Quick Actions */}
      <div style={{
        marginTop: '8px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        flexShrink: 0,
        boxSizing: 'border-box',
        maxHeight: '400px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: '600'
        }}>
          Quick Actions
        </p>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Three Mile Island Section */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              padding: '8px 12px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: 'rgba(139, 92, 246, 0.8)',
                border: '1px solid rgba(139, 92, 246, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#ffffff',
                fontWeight: '700'
              }}>
                T
              </div>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: 'rgba(139, 92, 246, 0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '700',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
              }}>
                Three Mile Island
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingLeft: '4px'
            }}>
              {/* Power - Three Mile Island */}
              {[
                { 
                  label: 'Substations near Three Mile Island', 
                  query: 'substations within 100km of Three Mile Island',
                  category: 'power',
                  icon: '⚡'
                }
              ].map((action, idx) => {
                const actionIdx = 0; // Three Mile Island power action
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'power')}
                  </div>
                );
              })}
              
              {/* Water - Three Mile Island */}
              {[
                { 
                  label: 'Water infrastructure near Three Mile Island', 
                  query: 'water infrastructure within 30km of Three Mile Island',
                  category: 'water',
                  description: 'Shows cooling water and municipal water infrastructure near Three Mile Island.',
                  icon: '💧'
                },
                { 
                  label: 'Susquehanna River water near Three Mile Island', 
                  query: 'water infrastructure along Susquehanna River near Three Mile Island',
                  category: 'water',
                  description: 'Highlights river and water infrastructure context around Three Mile Island.',
                  icon: '💧'
                }
              ].map((action, idx) => {
                const actionIdx = idx === 0 ? 1 : 2; // Three Mile Island water actions
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'water')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Susquehanna Section */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              padding: '8px 12px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(6, 182, 212, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'rgba(6, 182, 212, 1)',
                fontWeight: '700'
              }}>
                S
              </div>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: 'rgba(6, 182, 212, 0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '700',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
              }}>
                Susquehanna Nuclear
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingLeft: '4px'
            }}>
              {/* Power - Susquehanna */}
              {[
                { 
                  label: 'Substations near Susquehanna', 
                  query: 'substations within 100km of Susquehanna',
                  category: 'power',
                  icon: '⚡'
                },
                { 
                  label: 'Transmission lines near Susquehanna', 
                  query: 'transmission lines within 100km of Susquehanna',
                  category: 'power',
                  icon: '⚡'
                }
              ].map((action, idx) => {
                const actionIdx = 3 + idx; // Susquehanna power actions (3, 4)
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'power')}
                  </div>
                );
              })}
              
              {/* Water - Susquehanna */}
              {[
                { 
                  label: 'Water infrastructure near Susquehanna', 
                  query: 'water infrastructure within 30km of Susquehanna',
                  category: 'water',
                  description: 'Shows cooling water and municipal water infrastructure near Susquehanna Steam Electric Station.',
                  icon: '💧'
                }
              ].map((action, idx) => {
                const actionIdx = 5; // Susquehanna water action
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'water')}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
      </div>
    );
  }

  // Regular mode (fixed position panel)
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '450px',
      maxHeight: '700px',
      background: 'rgba(0, 0, 0, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(139, 92, 246, 0.1)',
      backdropFilter: 'blur(20px)',
      zIndex: 10000, // High z-index to ensure it's above map and other elements
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'auto' // Ensure the panel can receive pointer events
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: '600',
          color: '#a78bfa',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          🔍 Infrastructure Search
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setLastResults(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background 0.2s',
                pointerEvents: 'auto' // Ensure button is clickable
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              title="Clear history"
            >
              Clear
            </button>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onClose) onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a78bfa',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s',
              zIndex: 10001, // Higher than container
              position: 'relative',
              pointerEvents: 'auto' // Ensure button is clickable
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        lineHeight: '1.4'
      }}>
        Ask questions like: "substations near Three Mile Island" or "water infrastructure near Susquehanna"
      </p>

      {/* Message History */}
      {messages.length > 0 && (
        <div style={{
          flex: 1,
          minHeight: '200px',
          maxHeight: '300px',
          overflowY: 'auto',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'auto' // Ensure scrollable area is interactive
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                padding: '8px 12px',
                background: msg.role === 'user'
                  ? 'rgba(139, 92, 246, 0.2)'
                  : msg.isError
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(139, 92, 246, 0.1)',
                borderRadius: '8px',
                maxWidth: '85%',
                fontSize: '13px',
                color: msg.isError ? '#fca5a5' : '#e9d5ff',
                lineHeight: '1.4',
                border: msg.role === 'user'
                  ? '1px solid rgba(139, 92, 246, 0.3)'
                  : '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                {msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <div>
                    <div style={{ marginBottom: msg.results ? '8px' : '0' }}>
                      {msg.content.split('**').map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.4)',
                padding: '0 4px'
              }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Summary Statistics */}
      {stats && stats.total > 0 && (
        <div style={{
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}>
          <div style={{
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Summary Statistics
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '12px',
            color: '#e9d5ff'
          }}>
            <div>
              <strong>Total Results:</strong> {stats.total}
            </div>
            <div>
              <strong>Avg Distance:</strong> {stats.avgDistance} km
            </div>
            <div>
              <strong>Min Distance:</strong> {stats.minDistance} km
            </div>
            <div>
              <strong>Max Distance:</strong> {stats.maxDistance} km
            </div>
          </div>
          {Object.keys(stats.categories).length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <strong style={{ color: '#e9d5ff' }}>Categories:</strong>
              <div style={{
                marginTop: '4px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px'
              }}>
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <span
                    key={cat}
                    style={{
                      padding: '2px 6px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#c084fc'
                    }}
                  >
                    {cat}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., substations near Three Mile Island"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            pointerEvents: 'auto' // Ensure input is clickable
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)'}
        />

        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          style={{
            padding: '10px 16px',
            background: isLoading || !query.trim() 
              ? 'rgba(139, 92, 246, 0.2)' 
              : 'rgba(139, 92, 246, 0.8)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            pointerEvents: 'auto' // Ensure button is clickable
          }}
          onMouseEnter={(e) => {
            if (!isLoading && query.trim()) {
              e.target.style.background = 'rgba(139, 92, 246, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && query.trim()) {
              e.target.style.background = 'rgba(139, 92, 246, 0.8)';
            }
          }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Quick Actions */}
      <div style={{
        marginTop: '8px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        maxHeight: '400px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: '600'
        }}>
          Quick Actions
        </p>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Three Mile Island Section */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              padding: '8px 12px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: 'rgba(139, 92, 246, 0.8)',
                border: '1px solid rgba(139, 92, 246, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#ffffff',
                fontWeight: '700'
              }}>
                T
              </div>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: 'rgba(139, 92, 246, 0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '700',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
              }}>
                Three Mile Island
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingLeft: '4px'
            }}>
              {/* Power - Three Mile Island */}
              {[
                { 
                  label: 'Substations near Three Mile Island', 
                  query: 'substations within 100km of Three Mile Island',
                  category: 'power',
                  icon: '⚡'
                }
              ].map((action, idx) => {
                const actionIdx = 0; // Three Mile Island power action
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'power')}
                  </div>
                );
              })}
              
              {/* Water - Three Mile Island */}
              {[
                { 
                  label: 'Water infrastructure near Three Mile Island', 
                  query: 'water infrastructure within 30km of Three Mile Island',
                  category: 'water',
                  description: 'Shows cooling water and municipal water infrastructure near Three Mile Island.',
                  icon: '💧'
                },
                { 
                  label: 'Susquehanna River water near Three Mile Island', 
                  query: 'water infrastructure along Susquehanna River near Three Mile Island',
                  category: 'water',
                  description: 'Highlights river and water infrastructure context around Three Mile Island.',
                  icon: '💧'
                }
              ].map((action, idx) => {
                const actionIdx = idx === 0 ? 1 : 2; // Three Mile Island water actions
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'water')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Susquehanna Section */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              padding: '8px 12px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(6, 182, 212, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'rgba(6, 182, 212, 1)',
                fontWeight: '700'
              }}>
                S
              </div>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: 'rgba(6, 182, 212, 0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '700',
                fontFamily: 'Google Sans, Roboto, Arial, sans-serif'
              }}>
                Susquehanna Nuclear
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingLeft: '4px'
            }}>
              {/* Power - Susquehanna */}
              {[
                { 
                  label: 'Substations near Susquehanna', 
                  query: 'substations within 100km of Susquehanna',
                  category: 'power',
                  icon: '⚡'
                },
                { 
                  label: 'Transmission lines near Susquehanna', 
                  query: 'transmission lines within 100km of Susquehanna',
                  category: 'power',
                  icon: '⚡'
                }
              ].map((action, idx) => {
                const actionIdx = 3 + idx; // Susquehanna power actions (3, 4)
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'power')}
                  </div>
                );
              })}
              
              {/* Water - Susquehanna */}
              {[
                { 
                  label: 'Water infrastructure near Susquehanna', 
                  query: 'water infrastructure within 30km of Susquehanna',
                  category: 'water',
                  description: 'Shows cooling water and municipal water infrastructure near Susquehanna Steam Electric Station.',
                  icon: '💧'
                }
              ].map((action, idx) => {
                const actionIdx = 5; // Susquehanna water action
                const isExpanded = expandedQuickAction === actionIdx;
                const response = quickActionResponses[actionIdx];
                const isThisActionLoading = isLoading && expandedQuickAction === actionIdx && !response;
                
                return (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {renderQuickActionButton(action, actionIdx, isExpanded, response, isThisActionLoading, 'water')}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPChatPanel;

