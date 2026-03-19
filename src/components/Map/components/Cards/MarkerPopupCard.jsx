import React, { useEffect, useRef, useState, useCallback } from 'react';
import { formatStartupData, formatTDLRData, formatPinalData } from '../PopupCards';
import { TypewriterPopupCard } from './TypewriterPopupCard';

const MarkerPopupCard = ({ 
  nodeData, 
  position, 
  isVisible = false,
  isManualClick = false,
  onClose,
  map // Add map prop for zoom functionality
}) => {
  const popupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState(position || { x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Update popup position when position prop changes (but not when dragging)
  useEffect(() => {
    if (position && !isDragging) {
      setPopupPosition(position);
    }
  }, [position, isDragging]);

  // Handle drag functionality
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    
    // Calculate offset from the popup's current position
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep popup within viewport bounds (use default width for bounds checking)
    const popupWidth = 240; // 20% thinner for Pinal/startup/TDLR markers
    const popupHeight = 250; // Reduced height by 50px
    
    const boundedX = Math.max(0, Math.min(newX, window.innerWidth - popupWidth));
    const boundedY = Math.max(0, Math.min(newY, window.innerHeight - popupHeight));

    setPopupPosition({ x: boundedX, y: boundedY });
  }, [isDragging, dragOffset.x, dragOffset.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []); // Remove popupPosition dependency to prevent recreation during drag

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Only show auto-typed content when expanded
  useEffect(() => {
    if (!isExpanded) {
      setIsTyping(false);
      return;
    }

    const description = nodeData?.content || null;
    if (!description || isTyping) return;

    setIsTyping(true);
    const fullText = typeof description === 'string' ? description : '';
    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        currentIndex += 1;
        setTimeout(typeNextChar, 10);
      } else {
        setIsTyping(false);
      }
    };

    typeNextChar();
  }, [isExpanded, isTyping, nodeData]);

  // Enhanced visibility check - popup should be visible if isVisible is true and we have nodeData
  if (!isVisible || !nodeData) {
    return null;
  }

  // Popup visibility check complete

  // Check if this is a Pinal marker that should use the Pinal formatter (check first)
  const isPinalMarker = Boolean(
    nodeData?.formatter === 'pinal' || 
    nodeData?.zonesAnalyzed ||
    nodeData?.category === 'Arizona Infrastructure Development'
  );
  
  // Check if this is a TDLR marker that should use the TDLR formatter (only if not Pinal)
  const isTDLRMarker = !isPinalMarker && Boolean(
    nodeData?.formatter === 'tdlr' || 
    nodeData?.type === 'tdlr' || 
    nodeData?.facility_name || 
    nodeData?.work_type ||
    nodeData?.project_name ||
    nodeData?.project_id
  );
  
  // Check if this is a startup marker that should use the rich formatter (only if not Pinal or TDLR)
  const isStartupMarker = !isPinalMarker && !isTDLRMarker && Boolean(
    nodeData?.formatter === 'startup' || 
    nodeData?.geographicIntelligence || 
    nodeData?.spatialInsights || 
    nodeData?.categoryColor
  );

  const isPowerMarker = !isPinalMarker && !isTDLRMarker && !isStartupMarker && Boolean(
    nodeData?.formatter === 'power'
  );
  
  // Check if this is a water marker
  const isWaterMarker = Boolean(
    nodeData?.category === 'water' ||
    nodeData?.category === 'water_allocation' ||
    nodeData?.category === 'agricultural_water' ||
    nodeData?.category === 'state_trust_land' ||
    nodeData?.waterway ||
    nodeData?.man_made === 'water_tower' ||
    nodeData?.man_made === 'water_works' ||
    nodeData?.man_made === 'reservoir_covered' ||
    (nodeData?.source === 'mcp' && (nodeData?.color === '#06b6d4' || nodeData?.properties?.category === 'water'))
  );
  
  // Debug logging removed - TDLR popup working correctly

  const rawX = popupPosition?.x || position?.x || 0;
  const rawY = popupPosition?.y || position?.y || 0;
  
  // Ensure position values are valid numbers and within reasonable bounds
  const currentX = isNaN(rawX) ? 0 : Math.max(0, Math.min(rawX, window.innerWidth - 50));
  const currentY = isNaN(rawY) ? 0 : Math.max(0, Math.min(rawY, window.innerHeight - 50));
  
  // Calculate final position with offsets, ensuring no negative values
  const finalLeft = (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? Math.max(0, currentX - 120) : Math.max(0, currentX - 40);
  
  // Dynamic top offset based on marker type
  let topOffset = 200; // Default offset (moved down 40px from 270)
  if (isPinalMarker && nodeData?.id === 'casa-grande-marker') {
    topOffset = 326; // Casa Grande popup (moved down 40px from 366)
  }
  const finalTop = Math.max(0, currentY - topOffset);
  
  // Debug log to track position changes (only log significant changes)
  // Position calculation complete

  const popupStyle = {
    position: 'fixed',
    left: `${finalLeft}px`,
    top: `${finalTop}px`,
    width: (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? '238px' : '80px', // Reduced by 15% for rich popups
    maxHeight: (isPinalMarker || isStartupMarker || isTDLRMarker || isPowerMarker) ? '250px' : 'auto', // Reduced height for rich data
    backgroundColor: 'transparent', // Remove background from main container
    border: 'none', // Remove border from main container
    borderRadius: '0', // Remove border radius from main container
    padding: '0', // Remove padding from main container
    color: '#ffffff',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', // Match BaseCard font
    fontSize: (isStartupMarker || isTDLRMarker || isPowerMarker) ? '11px' : '11px', // Match BaseCard font size
    lineHeight: '1.4',
    zIndex: 1000, // Match BaseCard z-index
    boxShadow: 'none', // Remove box shadow from main container
    backdropFilter: 'none', // Remove backdrop filter from main container
    pointerEvents: 'auto',
    animation: 'fadeIn 0.2s ease-out',
    textAlign: 'left',
    overflowY: (isStartupMarker || isTDLRMarker || isPowerMarker) ? 'auto' : 'visible', // Allow scrolling for rich data
    userSelect: 'none' // Match BaseCard user select
  };

  const addressStyle = {
    fontSize: '11px',
    fontWeight: '600',
    color: isWaterMarker ? '#22d3ee' : '#60a5fa', // Cyan for water, blue for others
    margin: '0 0 6px 0',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    lineHeight: '1.3',
    wordWrap: 'break-word'
  };

  const categoryStyle = {
    fontSize: '9px',
    color: '#9ca3af',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '500'
  };

  const nameStyle = {
    fontSize: '10px',
    color: '#d1d5db',
    margin: '0',
    fontWeight: '400'
  };

  return (
    <>
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      
      <div ref={popupRef} style={popupStyle} data-marker-popup>
      {/* Drag Handle - Large invisible area for easier dragging */}
      <div
        style={{
          position: 'absolute',
          top: '0',
          right: '25px', // Adjusted to avoid the closer close button (was 40px)
          width: '60px',
          height: '40px',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1001,
          pointerEvents: 'auto',
          background: 'transparent' // Completely invisible
        }}
        onMouseDown={handleMouseDown}
        title="Drag to move popup"
      />
      
      {isPinalMarker ? (
        // Check if this is a typewriter-enhanced popup
        (() => {
          const formattedData = formatPinalData(nodeData);
          if (formattedData.includes('__PINALTYPEWRITER__')) {
            // Extract the typewriter data
            const match = formattedData.match(/__PINALTYPEWRITER__(.*?)__PINALTYPEWRITER__/);
            if (match) {
              try {
                const typewriterData = JSON.parse(match[1]);

                // Reusable header markup
                const headerContent = (
                  <div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#f9fafb',
                        marginBottom: '4px'
                      }}
                    >
                      {typewriterData.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#9ca3af'
                      }}
                    >
                      {typewriterData.zone}
                    </div>
                  </div>
                );

                // Collapsed: show header only, no body
                if (!isExpanded) {
                  // Get theme background color from TypewriterPopupCard config
                  const themeBg = typewriterData.theme === 'red' 
                    ? 'rgba(220, 38, 38, 0.95)' 
                    : typewriterData.theme === 'orange'
                    ? 'rgba(249, 115, 22, 0.95)'
                    : 'rgba(17, 24, 39, 0.96)';
                  
                  return (
                    <div
                      onClick={() => setIsExpanded(true)}
                      style={{
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 1000,
                        background: themeBg,
                        borderRadius: '10px',
                        padding: '12px 14px',
                        border: '1px solid rgba(148, 163, 184, 0.4)',
                        boxShadow: '0 8px 26px rgba(15, 23, 42, 0.7)'
                      }}
                    >
                      {headerContent}
                    </div>
                  );
                }

                // Expanded: use TypewriterPopupCard as before
                return (
                  <TypewriterPopupCard
                    content={typewriterData.enhancedContent}
                    theme={typewriterData.theme}
                    header={headerContent}
                    shouldStart={isVisible}
                    enableTypewriter={!isManualClick} // Disable typewriter for manual clicks
                    style={{
                      position: 'relative',
                      zIndex: 1000
                    }}
                  />
                );
              } catch (error) {
                console.warn('Failed to parse typewriter data:', error);
                // Fallback to regular HTML
                return <div dangerouslySetInnerHTML={{ __html: formattedData }} />;
              }
            }
          }
          // Fallback to regular HTML for non-typewriter popups
          return <div dangerouslySetInnerHTML={{ __html: formattedData }} />;
        })()
      ) : isStartupMarker ? (
        // Use rich startup data formatter
        <div dangerouslySetInnerHTML={{ __html: formatStartupData(nodeData) }} />
      ) : isTDLRMarker ? (
        // Use TDLR data formatter
        <div dangerouslySetInnerHTML={{ __html: formatTDLRData(nodeData) }} />
      ) : isPowerMarker && nodeData.content ? (
        <div
          style={{
            position: 'relative',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.96)',
            borderRadius: '10px',
            padding: '12px 14px',
            border: '1px solid rgba(148, 163, 184, 0.4)',
            boxShadow: '0 8px 26px rgba(15, 23, 42, 0.7)'
          }}
        >
          {/* Header – click to expand/collapse body */}
          <div
            onClick={() => setIsExpanded((prev) => !prev)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#f9fafb',
                  marginBottom: '4px'
                }}
              >
                {nodeData.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#9ca3af'
                }}
              >
                {nodeData.siteName
                  ? `${nodeData.siteName}${
                      nodeData.maxVoltageKv ? ` • ${nodeData.maxVoltageKv} kV` : ''
                    }`
                  : nodeData.maxVoltageKv
                    ? `${nodeData.maxVoltageKv} kV tier`
                    : 'Power infrastructure'}
              </div>
            </div>
            <div
              style={{
                fontSize: '16px',
                color: '#9ca3af',
                fontWeight: '700',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease-out'
              }}
            >
              ▶
            </div>
          </div>

          {/* Body – typewriter + details, only when expanded */}
          {isExpanded && (
            <div
              style={{
                marginTop: '8px',
                borderTop: '1px solid rgba(148, 163, 184, 0.3)',
                paddingTop: '8px',
                fontSize: '11px',
                color: '#e5e7eb',
                maxHeight: '150px',
                overflowY: 'auto'
              }}
            >
              <TypewriterPopupCard
                content={nodeData.content}
                theme={nodeData.theme || 'blue'}
                header={null}
                shouldStart={isVisible}
                enableTypewriter={!isManualClick}
              />
            </div>
          )}
        </div>
      ) : (
        // Use simple formatter for other markers
        <>
          <div style={addressStyle}>
            {nodeData.address || nodeData.name || 'Infrastructure'}
          </div>
          
          <div style={categoryStyle}>
            {nodeData.type?.split(' ')[0] || 'INFRASTRUCTURE'}
          </div>
          
          <div style={nameStyle} title={nodeData.name}>
            {nodeData.name || 'Unknown'}
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default MarkerPopupCard;
