import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLocationDisplayName, getGeographicConfig } from '../../../../config/geographicConfig.js';

const LoadingCard = ({ 
  toolFeedback, 
  currentLocation = 'default',
  onLucidAnimationStart = null,
  lucidAnimationActive = false,
  availableAnimations = [],
  onAnimationSelect = null,
  onLucidNaipOverlay = null,
  disableSkeletonAnimation = false
}) => {
  // Get location-specific display name
  const locationDisplayName = useMemo(() => {
    return getLocationDisplayName(currentLocation);
  }, [currentLocation]);
  
  const locationConfig = useMemo(() => {
    return getGeographicConfig(currentLocation);
  }, [currentLocation]);
  const [expandedTool, setExpandedTool] = useState(null);
  const [toolStates, setToolStates] = useState({
    osm: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
    serp: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
    perplexity: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
    pa_nuclear_gee: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false }
  });
  
  const [isInitialPhase, setIsInitialPhase] = useState(true);
  const [typewriterText, setTypewriterText] = useState('');
  const [showToolRows, setShowToolRows] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  
  const [processDescription, setProcessDescription] = useState('');
  const [showDescription, setShowDescription] = useState(true);
  
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [messageCycleActive, setMessageCycleActive] = useState(false);
  const [locationChanging, setLocationChanging] = useState(false);
  const [previousLocation, setPreviousLocation] = useState(currentLocation);
  const [showLucidCTA, setShowLucidCTA] = useState(false);
  const [showSkeletonAnimation, setShowSkeletonAnimation] = useState(false);

  const handleLucidClick = useCallback((animation) => {
    if (onAnimationSelect) {
      onAnimationSelect(animation);
    } else if (onLucidAnimationStart) {
      onLucidAnimationStart();
    }
    setShowLucidCTA(false);
  }, [onAnimationSelect, onLucidAnimationStart, availableAnimations, lucidAnimationActive, disableSkeletonAnimation, showSkeletonAnimation, showLucidCTA, cardExpanded, isInitialPhase, showToolRows]);



  const toolMessages = useMemo(() => ({
    osm: [
      `Loading ${locationDisplayName} infrastructure data`,
      `Processing ${locationConfig.city} zones`,
      'Finalizing infrastructure analysis'
    ],
    serp: [
      'Loading real estate intelligence',
      'Processing property data',
      'Finalizing market analysis'
    ],
    perplexity: [
      'Analyzing agricultural change data',
      'Processing land use insights',
      'Finalizing change analysis'
    ],
    pa_nuclear_gee: [
      'Loading GEE change detection data',
      'Processing land use change frames',
      'Finalizing PA nuclear animation'
    ]
  }), [locationDisplayName, locationConfig.city]);

  useEffect(() => {
    if (isInitialPhase && toolFeedback?.isActive) {
      const text = toolFeedback?.tool === 'claude' ? "Activating Claude..." : "Activating Claude...";
      let index = 0;
      
      const typewriterInterval = setInterval(() => {
        if (index < text.length) {
          setTypewriterText(text.substring(0, index + 1));
          index++;
        } else {
          clearInterval(typewriterInterval);
          setTimeout(() => {
            setCardExpanded(true);
            setTimeout(() => {
              setShowToolRows(true);
              // Start the first tool (osm) when card expands
              setToolStates(prev => ({
                ...prev,
                osm: {
                  ...prev.osm,
                  isVisible: true,
                  isActive: true,
                  status: 'Starting...',
                  progress: 0,
                  details: '',
                  timestamp: Date.now(),
                  isCompletionHighlight: false
                }
              }));
              if (toolFeedback?.tool && toolFeedback.tool !== 'claude') {
                setIsInitialPhase(false);
              }
            }, 300);
          }, 500);
        }
      }, 80);
      
      return () => clearInterval(typewriterInterval);
    }
  }, [isInitialPhase, toolFeedback?.tool, toolFeedback?.isActive]);

  useEffect(() => {
    if (toolFeedback?.isActive && toolFeedback.tool && toolMessages[toolFeedback.tool]) {
      setMessageCycleActive(true);
      setCurrentMessageIndex(0);
      
      const messages = toolMessages[toolFeedback.tool];
      let messageIndex = 0;
      
      const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setCurrentMessageIndex(messageIndex);
      }, 2000);
      
      return () => {
        clearInterval(messageInterval);
        setMessageCycleActive(false);
      };
    } else {
      setMessageCycleActive(false);
    }
  }, [toolFeedback?.isActive, toolFeedback?.tool, toolMessages]);

  useEffect(() => {
    if (availableAnimations.length > 0 && !lucidAnimationActive) {
      setIsInitialPhase(false);
      setShowToolRows(false);
      setCardExpanded(true);
      
      if (!disableSkeletonAnimation) {
        setShowSkeletonAnimation(true);
        setShowLucidCTA(false);
      } else {
        setShowSkeletonAnimation(false);
        setShowLucidCTA(true);
      }
      
      if (!disableSkeletonAnimation) {
        setTimeout(() => {
          setShowSkeletonAnimation(false);
          setShowLucidCTA(true);
        }, 1000);
      }
    } else {
      setShowLucidCTA(false);
      setShowSkeletonAnimation(false);
    }
  }, [availableAnimations, lucidAnimationActive, disableSkeletonAnimation]);


  useEffect(() => {
    if (toolFeedback?.isActive && toolFeedback.tool) {
      const isCompletionStatus = toolFeedback.progress === 100 && 
                                 (toolFeedback.status.includes('completed') || 
                                  toolFeedback.status.includes('execution completed'));
      
      // Show the current tool when it becomes active
      setToolStates(prev => ({
        ...prev,
        [toolFeedback.tool]: {
          ...prev[toolFeedback.tool],
          isVisible: true,
          isActive: toolFeedback.isActive,
          status: toolFeedback.status,
          progress: toolFeedback.progress,
          details: toolFeedback.details,
          timestamp: toolFeedback.timestamp,
          isCompletionHighlight: isCompletionStatus
        }
      }));
      
      if (isCompletionStatus) {
        setTimeout(() => {
          setToolStates(prev => ({
            ...prev,
            [toolFeedback.tool]: {
              ...prev[toolFeedback.tool],
              isCompletionHighlight: false
            }
          }));
          
          // Show the next tool after current one completes
          // For PA sites, show pa_nuclear_gee after geoai
          const isPASite = currentLocation === 'three_mile_island_pa' || currentLocation === 'susquehanna_nuclear_pa';
          const toolOrder = isPASite && toolFeedback.tool === 'geoai' 
            ? ['geoai', 'pa_nuclear_gee', 'osm', 'serp', 'perplexity']
            : ['osm', 'serp', 'perplexity'];
          const currentIndex = toolOrder.indexOf(toolFeedback.tool);
          const nextTool = toolOrder[currentIndex + 1];
          
          if (nextTool) {
            setTimeout(() => {
              setToolStates(prev => ({
                ...prev,
                [nextTool]: {
                  ...prev[nextTool],
                  isVisible: true,
                  isActive: true,
                  status: 'Starting...',
                  progress: 0,
                  details: '',
                  timestamp: Date.now(),
                  isCompletionHighlight: false
                }
              }));
            }, 500);
          }
        }, 2000);
      }
      
      setExpandedTool(toolFeedback.tool);
      
    } else if (toolFeedback?.isActive === false && toolFeedback.tool) {
      setToolStates(prev => ({
        ...prev,
        [toolFeedback.tool]: {
          ...prev[toolFeedback.tool],
          isActive: false,
          timestamp: prev[toolFeedback.tool].timestamp || Date.now(),
          isCompletionHighlight: false
        }
      }));
      
    } else if (toolFeedback?.isActive === false && !toolFeedback.tool) {
    }
    
    if (toolFeedback?.tool === 'claude' && toolFeedback?.isActive) {
    } else if (toolFeedback?.tool && ['serp', 'osm', 'perplexity'].includes(toolFeedback.tool) && toolFeedback?.isActive) {
      if (isInitialPhase) {
        setIsInitialPhase(false);
        setShowToolRows(true);
        setCardExpanded(true);
      }
    }
  }, [toolFeedback, isInitialPhase, currentLocation]);

  useEffect(() => {
    if (currentLocation !== previousLocation) {
      setLocationChanging(true);
      setPreviousLocation(currentLocation);
      
      setTimeout(() => {
        setLocationChanging(false);
      }, 2000);
    }
  }, [currentLocation, previousLocation]);

  useEffect(() => {
    if (isInitialPhase) {
      setProcessDescription('Starting...');
      setShowDescription(true);
    } else if (showToolRows) {
      setShowDescription(true);
      
      if (locationChanging) {
        setProcessDescription(`🔄 Switching to ${currentLocation} analysis...`);
      } else if (toolFeedback?.isActive && toolFeedback.tool) {
        const locationText = currentLocation !== 'default' ? ` for ${currentLocation}` : '';
        
        switch (toolFeedback.tool) {
          case 'serp':
            setProcessDescription(`Loading real estate intelligence${locationText}...`);
            break;
          case 'osm':
            setProcessDescription(`Loading ${locationDisplayName} infrastructure${locationText}...`);
            break;
          case 'perplexity':
            setProcessDescription(`Analyzing agricultural changes${locationText}...`);
            break;
          case 'alphaearth':
            setProcessDescription(`Loading satellite data${locationText}...`);
            break;
          case 'pa_nuclear_gee':
            setProcessDescription(`Loading PA nuclear GEE animation${locationText}...`);
            break;
          default:
            setProcessDescription(`Processing data${locationText}...`);
        }
        
        // Hide description after 3 seconds when tool is active
        setTimeout(() => {
          setShowDescription(false);
        }, 3000);
      } else {
        const completedTools = Object.values(toolStates).filter(tool => tool.timestamp && !tool.isActive);
        if (completedTools.length > 0) {
          const locationText = currentLocation !== 'default' ? ` for ${currentLocation}` : '';
          
        const allToolsComplete = Object.values(toolStates).every(tool => tool.timestamp !== null && !tool.isActive);
        if (allToolsComplete) {
          setProcessDescription(`✅ ${locationDisplayName} analysis complete${locationText} - Ready to display results`);
        } else {
          setProcessDescription(`Processing ${locationDisplayName} data${locationText}...`);
        }
        } else {
          setProcessDescription(`Loading ${locationDisplayName} data...`);
        }
      }
    }
  }, [isInitialPhase, showToolRows, toolFeedback, toolStates, currentLocation, locationChanging, messageCycleActive, currentMessageIndex, toolMessages, locationDisplayName, locationConfig]);

  const isCurrentlyActive = toolFeedback?.isActive;
  const hasAnyToolBeenActive = Object.values(toolStates).some(tool => tool.timestamp !== null);
  const isInCompletionPhase = hasAnyToolBeenActive && !isCurrentlyActive;
  
  const shouldShowCard = isCurrentlyActive || isInCompletionPhase;
  
  const resetAllStates = useCallback(() => {
    setToolStates({
      osm: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
      serp: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
      perplexity: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false },
      pa_nuclear_gee: { isActive: false, status: '', progress: 0, details: '', timestamp: null, isCompletionHighlight: false, isVisible: false }
    });
    setIsInitialPhase(true);
    setShowToolRows(false);
    setCardExpanded(false);
  }, []);
  
  useEffect(() => {
    if (isInCompletionPhase && !isCurrentlyActive) {
      const hideTimer = setTimeout(resetAllStates, 3000);
      return () => clearTimeout(hideTimer);
    }
  }, [isInCompletionPhase, isCurrentlyActive, resetAllStates]);
  
  if (!shouldShowCard) {
    return null;
  }

  // Don't show LoadingCard at all when skeleton is disabled (for GeoAI responses)
  if (disableSkeletonAnimation) {
    return null;
  }

  const getToolDisplayName = (tool) => {
    switch (tool) {
      case 'osm':
        return `${locationDisplayName} Infrastructure`;
      case 'serp':
        return 'REAL ESTATE INTELLIGENCE';
      case 'perplexity':
        return 'AGRICULTURAL CHANGE ANALYSIS';
      case 'alphaearth':
        return 'ALPHAEARTH INTELLIGENCE';
      case 'pa_nuclear_gee':
        return 'PA NUCLEAR GEE ANIMATION';
      default:
        return 'TOOL';
    }
  };

  const getToolColor = (tool) => {
    switch (tool) {
      case 'osm':
        return '#10b981';
      case 'serp':
        return '#8b5cf6';
      case 'perplexity':
        return '#6b7280';
      case 'alphaearth':
        return '#f87171';
      case 'pa_nuclear_gee':
        return '#f97316'; // Orange to match PA nuclear theme
      default:
        return '#6b7280';
    }
  };

  const renderToolRow = (toolKey, toolData) => {
    const isActive = toolData.isActive;
    const isExpanded = expandedTool === toolKey;
    const hasBeenActive = toolData.timestamp !== null;
    const toolColor = getToolColor(toolKey);
    const toolDisplayName = getToolDisplayName(toolKey);
    const isCompletionHighlight = toolData.isCompletionHighlight || false;
    
    const isWaiting = !isActive && !hasBeenActive;
    const isCompleted = !isActive && hasBeenActive;
    const isUpcoming = isWaiting && Object.values(toolStates).some(tool => tool.isActive);
    
    const allToolsCompleted = Object.values(toolStates).every(tool => tool.timestamp !== null && !tool.isActive);
    
    const finalIsCompleted = isCompleted;
    const getPlaceholderStatus = (toolKey) => {
      switch (toolKey) {
        case 'osm':
          return isWaiting ? `Waiting to analyze ${locationDisplayName} infrastructure...` : `Completed ${locationDisplayName} infrastructure analysis`;
        case 'serp':
          return isWaiting ? 'Waiting to load real estate intelligence...' : 'Completed real estate intelligence loading';
        case 'perplexity':
          return isWaiting ? 'Waiting for agricultural change analysis...' : 'Completed agricultural change analysis';
        case 'pa_nuclear_gee':
          return isWaiting ? 'Waiting to load PA nuclear GEE animation...' : 'Completed PA nuclear GEE animation';
        default:
          return isWaiting ? 'Waiting...' : 'Completed';
      }
    };
    
    return (
      <div key={toolKey} style={{
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: isCompletionHighlight ? `${toolColor}20` : (isActive ? 'rgba(255, 255, 255, 0.05)' : (isCompleted ? 'rgba(255, 255, 255, 0.05)' : 'transparent')),
          border: isCompletionHighlight ? `2px solid ${toolColor}` : (isActive ? `1px solid ${toolColor}40` : (isCompleted ? `1px solid ${toolColor}40` : '1px solid transparent')),
          cursor: (hasBeenActive || isActive) ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          opacity: 1,
          position: 'relative',
          overflow: 'hidden',
          animation: isCompletionHighlight ? 'completionPulse 1s ease-in-out' : 'none',
          width: '100%',
          minWidth: '280px'
        }}
        onClick={() => (hasBeenActive || isActive) && setExpandedTool(isExpanded ? null : toolKey)}
        >
          <div style={{
            width: finalIsCompleted ? '11.7px' : '9px',
            height: finalIsCompleted ? '11.7px' : '9px',
            borderRadius: '50%',
            background: isActive ? toolColor : finalIsCompleted ? toolColor : `${toolColor}60`,
            border: `1px solid ${isActive ? toolColor : finalIsCompleted ? toolColor : `${toolColor}50`}`,
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            animation: finalIsCompleted ? 'checkmarkPulse 0.6s ease-out' : 'none'
          }}>
            {finalIsCompleted && (
              <div style={{
                color: '#ffffff',
                fontSize: '6px',
                fontWeight: 'bold',
                lineHeight: '1',
                textShadow: '0 0 2px rgba(0,0,0,0.5)',
                animation: 'checkmarkFadeIn 0.4s ease-out 0.2s both'
              }}>
                ✓
              </div>
            )}
          </div>
          
          <span style={{
            color: isActive ? '#ffffff' : isCompleted ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.9)',
            fontSize: '12px',
            fontWeight: isActive ? '700' : isCompleted ? '500' : '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            flex: '1 1 auto',
            minWidth: '0'
          }}>
            {toolDisplayName}
          </span>
          
          
          {toolData.timestamp && (
            <div style={{
              fontSize: '10px',
              color: isCompleted ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'monospace',
              marginLeft: 'auto',
              transition: 'all 0.3s ease'
            }}>
              {new Date(toolData.timestamp).toLocaleTimeString()}
            </div>
          )}
          
          {isUpcoming && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              animation: 'skeletonShimmer 2s infinite',
              pointerEvents: 'none'
            }} />
          )}
        </div>

        {isExpanded && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            border: `1px solid ${toolColor}30`,
            animation: 'slideDown 0.3s ease'
          }}>
            <div style={{
              color: isActive ? '#e5e7eb' : isCompleted ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)',
              fontSize: '12px',
              lineHeight: '1.4',
              marginBottom: '8px',
              transition: 'opacity 0.3s ease'
            }}>
              {isActive ? (
                messageCycleActive && toolMessages[toolKey] ? 
                  (toolMessages[toolKey][currentMessageIndex] || toolData.status || 'Processing...') :
                  (toolData.status || 'Processing...')
              ) : getPlaceholderStatus(toolKey)}
            </div>
            
            {isActive && toolData.progress > 0 && (
              <div style={{
                width: '100%',
                height: '3px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                marginBottom: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${toolData.progress}%`,
                  height: '100%',
                  background: toolColor,
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    animation: 'shimmer 2s infinite'
                  }} />
                </div>
              </div>
            )}
            
            {isActive && toolData.details && (
              <div style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '10px',
                lineHeight: '1.3',
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {toolData.details}
              </div>
            )}
            
            {!isActive && (
              <div style={{
                color: isCompleted ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '10px',
                lineHeight: '1.3',
                fontStyle: 'italic'
              }}>
                {isCompleted ? `This tool has completed its ${locationDisplayName} analysis` : 'This tool will activate when the current process completes'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      marginBottom: '16px',
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      padding: cardExpanded ? '16px' : '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      animation: 'fadeIn 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.5s ease',
      height: cardExpanded ? 'auto' : '60px'
    }}>
      {isInitialPhase && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '36px'
        }}>
          <div style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: '#00A86B',
            animation: 'pulse 1.5s infinite'
          }} />
          <span style={{
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {typewriterText}
            <span style={{
              animation: 'blink 1s infinite',
              marginLeft: '2px'
            }}>|</span>
          </span>
        </div>
      )}
      
      
      {showToolRows && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '4px',
          animation: 'slideDown 0.5s ease',
          minHeight: '120px'
        }}>
          {toolStates.osm.isVisible && renderToolRow('osm', toolStates.osm)}
          {toolStates.serp.isVisible && renderToolRow('serp', toolStates.serp)}
          {toolStates.perplexity.isVisible && renderToolRow('perplexity', toolStates.perplexity)}
          {toolStates.pa_nuclear_gee.isVisible && renderToolRow('pa_nuclear_gee', toolStates.pa_nuclear_gee)}
        </div>
      )}
      
      {Object.values(toolStates).some(tool => tool.isActive) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)',
          animation: 'shimmerOverlay 3s infinite',
          pointerEvents: 'none',
          zIndex: 1
        }} />
      )}

      {/* Skeleton Animation */}
      {showSkeletonAnimation && availableAnimations.length > 0 && !lucidAnimationActive && !disableSkeletonAnimation && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(59, 130, 246, 0.18))',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'relative',
            zIndex: 2,
            overflow: 'hidden'
          }}
        >
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: 'transparent',
            position: 'relative',
            overflow: 'hidden',
            height: '16px'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'skeletonShimmer 2s infinite'
            }} />
            Site animations ready
          </div>
          
          {/* Skeleton buttons */}
          {[1, 2].map((index) => (
            <div
              key={index}
              style={{
                width: '100%',
                height: '48px',
                background: 'rgba(236, 72, 153, 0.3)',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '10px 12px',
                gap: '4px',
                animation: 'skeletonPulse 1s ease-in-out infinite',
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                animation: 'skeletonShimmer 1s infinite',
                animationDelay: `${index * 0.2}s`
              }} />
              <div style={{
                height: '12px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                width: '70%',
                marginBottom: '4px'
              }} />
              <div style={{
                height: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                width: '50%'
              }} />
            </div>
          ))}
        </div>
      )}

      {showLucidCTA && availableAnimations.length > 0 && !lucidAnimationActive && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(59, 130, 246, 0.18))',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'relative',
            zIndex: 2
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f9fafb' }}>
            {availableAnimations.some(a => a.key === 'three_mile_island_pa' || a.key === 'susquehanna_nuclear_pa')
              ? 'PA Nuclear GEE animations ready'
              : 'Site animations ready'}
          </div>
      {availableAnimations.map((animation, index) => {
        // Check if this is a PA Nuclear site
        const isPASite = animation.key === 'three_mile_island_pa' || animation.key === 'susquehanna_nuclear_pa';
        const buttonBg = isPASite 
          ? 'rgba(249, 115, 22, 0.75)' // Orange for PA sites
          : 'rgba(236, 72, 153, 0.75)'; // Pink for Lucid
        const buttonShadow = isPASite
          ? '0 6px 14px rgba(249, 115, 22, 0.25)'
          : '0 6px 14px rgba(236, 72, 153, 0.25)';
        const headerText = isPASite
          ? 'PA Nuclear GEE animations ready'
          : 'Site animations ready';
        
        return (
          <button
            key={animation.key || index}
            onClick={() => handleLucidClick(animation)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: buttonBg,
              border: 'none',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: buttonShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span>Site {index + 1} — {animation.label || 'Lucid EV Campus'}</span>
            {animation.description && (
              <span style={{ fontWeight: 400, opacity: 0.85 }}>
                {animation.description}
              </span>
            )}
          </button>
        );
      })}
      {onLucidNaipOverlay && (
        <button
          onClick={onLucidNaipOverlay}
          style={{
            width: '100%',
            background: '#1e40af',
            border: 'none',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 6px 14px rgba(30, 64, 175, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Lucid NAIP overlay</span>
          <span style={{ fontSize: '12px' }}>🛰️</span>
        </button>
      )}
    </div>
  )}
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes slideDown {
            from {
              opacity: 0;
              max-height: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              max-height: 200px;
              transform: translateY(0);
            }
          }
          
          @keyframes shimmer {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
          
          @keyframes shimmerOverlay {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          
          @keyframes skeletonShimmer {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
          
          @keyframes skeletonPulse {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }
          
          @keyframes blink {
            0%, 50% {
              opacity: 1;
            }
            51%, 100% {
              opacity: 0;
            }
          }
          
          @keyframes checkmarkPulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.2);
            }
            100% {
              transform: scale(1);
            }
          }
          
          @keyframes checkmarkFadeIn {
            0% {
              opacity: 0;
              transform: scale(0.5);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes completionPulse {
            0% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.8);
            }
            25% {
              transform: scale(1.05);
              box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.4);
            }
            50% {
              transform: scale(1.02);
              box-shadow: 0 0 0 12px rgba(255, 255, 255, 0.1);
            }
            75% {
              transform: scale(1.05);
              box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.4);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
            }
          }
          
          @keyframes cachePulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.2);
            }
          }
        `
      }} />
    </div>
  );
};

export default LoadingCard;
