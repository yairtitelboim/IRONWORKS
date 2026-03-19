import React, { useState, useEffect, useRef } from 'react';

const ScenePopupCard = ({ 
  card, 
  screenPosition, 
  onClose, 
  onNavigate,
  onPinChange,
  isVisible = true 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDataRows, setShowDataRows] = useState(false);
  const [showToggleBall, setShowToggleBall] = useState(false);
  const [isDataExpanded, setIsDataExpanded] = useState(false);
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Only follow map coordinates if not manually positioned
  useEffect(() => {
    if (screenPosition && !isPinned && !isDragging) {
      setPosition({
        x: screenPosition.x - 112, // Half card width
        y: screenPosition.y - 48   // Offset above point
      });
    }
  }, [screenPosition, isPinned, isDragging]);

  // AI text animation effect
  useEffect(() => {
    if (card.content?.description && !isTyping) {
      setIsTyping(true);
      setDisplayedText('');
      
      const fullText = card.content.description;
      let currentIndex = 0;
      
      const typeNextChar = () => {
        if (currentIndex < fullText.length) {
          setDisplayedText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
          setTimeout(typeNextChar, 10); // Faster typing speed
        } else {
          setIsTyping(false);
          // Show toggle ball at the end of text animation
          if (card.content?.data && Object.keys(card.content.data).length > 0) {
            setShowToggleBall(true);
          }
        }
      };
      
      typeNextChar();
    }
  }, [card.content?.description]);

  // Cleanup effect to remove any lingering event listeners
  useEffect(() => {
    return () => {
      // Clean up any remaining event listeners when component unmounts
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const cleanupMouseMove = () => {};
      const cleanupMouseUp = () => {};
      document.removeEventListener('mousemove', cleanupMouseMove);
      document.removeEventListener('mouseup', cleanupMouseUp);
    };
  }, []);

  // Drag handling with auto-pin
  const handleMouseDown = (e) => {
    if (e.target.closest('.card-action-button')) return; // Don't drag when clicking buttons
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    // Store the offset between mouse position and card position
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    // Update cursor for drag handle
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    // Define mouse move handler (inside mouseDown for closure access)
    const handleMouseMove = (e) => {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    // Define mouse up handler
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPinned(true); // Auto-pin when dragged
      
      // Restore cursor
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Notify parent component of pin state and position change
      if (onPinChange) {
        onPinChange(card.id, true, {
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y
        });
      }
      
      // Clean up global event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Add global mouse event listeners (works even if cursor leaves card)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Navigation handler
  const handleNavigateClick = () => {
    if (card.nextSceneId && onNavigate) {
      onNavigate(card.nextSceneId);
    }
  };

  // Pin/unpin handler
  const handlePinToggle = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);
    
    // Notify parent component of pin state change
    if (onPinChange) {
      onPinChange(card.id, newPinnedState, position);
    }
  };

  // Toggle ball click handler
  const handleToggleBallClick = (e) => {
    e.stopPropagation(); // Prevent triggering navigation
    setIsDataExpanded(!isDataExpanded);
    if (!isDataExpanded) {
      setShowDataRows(true);
    }
  };

  // Add CSS for animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      @keyframes toggleBallPulse {
        0%, 100% { 
          opacity: 0.7;
          transform: scale(1);
        }
        50% { 
          opacity: 1;
          transform: scale(1.1);
        }
      }
      @keyframes dataRowsSlideIn {
        0% {
          max-height: 0;
          opacity: 0;
          transform: translateY(-10px);
        }
        100% {
          max-height: 200px;
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes dataRowFadeIn {
        0% {
          opacity: 0;
          transform: translateX(-5px);
        }
        100% {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!isVisible) return null;

  // Determine if this is a red-themed or yellow-themed card
  const isRedTheme = card.style?.borderColor === '#dc2626';
  const isYellowTheme = card.style?.borderColor === '#f59e0b';
  const primaryColor = isRedTheme ? '#dc2626' : isYellowTheme ? '#f59e0b' : '#4caf50';
  const primaryColorRgba = isRedTheme ? '220, 38, 38' : isYellowTheme ? '245, 158, 11' : '76, 175, 80';

  const cardStyle = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: '224px',
    minHeight: '120px',
    backgroundColor: card.style?.backgroundColor || 'rgba(26, 26, 26, 0.95)',
    border: `1px solid ${primaryColor}`,
    borderRadius: '8px',
    padding: '12px',
    cursor: isDragging ? 'grabbing' : 'default',
    userSelect: 'none',
    zIndex: 1000 + (card.style?.priority || 0),
    boxShadow: isHovered 
      ? `0 8px 25px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(${primaryColorRgba}, 0.3)`
      : `0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(${primaryColorRgba}, 0.2)`,
    transition: isDragging ? 'none' : 'all 0.3s ease',
    transform: isHovered && !isDragging ? 'scale(1.02)' : 'scale(1)',
    backdropFilter: 'blur(10px)',
    fontFamily: 'Roboto, Arial, sans-serif',
    // Add visual feedback for pinned state
    opacity: isPinned ? 1 : 0.95,
    borderWidth: isPinned ? '2px' : '1px'
  };

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px',
          borderBottom: '1px solid #333333',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          transition: 'background-color 0.2s'
        }}
        onMouseDown={handleMouseDown}
        title={isPinned ? "Drag handle (card is pinned)" : "Drag handle (card follows map)"}
      >
        {/* Drag handle dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <div style={{ width: '4px', height: '4px', backgroundColor: '#999999', borderRadius: '50%' }}></div>
            <div style={{ width: '4px', height: '4px', backgroundColor: '#999999', borderRadius: '50%' }}></div>
            <div style={{ width: '4px', height: '4px', backgroundColor: '#999999', borderRadius: '50%' }}></div>
            <div style={{ width: '4px', height: '4px', backgroundColor: '#999999', borderRadius: '50%' }}></div>
            <div style={{ width: '4px', height: '4px', backgroundColor: '#999999', borderRadius: '50%' }}></div>
          </div>

        </div>
      </div>



      {/* Content */}
      <div 
        style={{ 
          padding: '16px 8px 0 8px',
          cursor: card.nextSceneId ? 'pointer' : 'default',
          transition: 'all 0.2s ease'
        }}
        onClick={card.nextSceneId ? handleNavigateClick : undefined}
        onMouseEnter={card.nextSceneId ? () => setIsHovered(true) : undefined}
        onMouseLeave={card.nextSceneId ? () => setIsHovered(false) : undefined}
      >
        {/* Description */}
        {card.content?.description && (
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '11px',
            color: isRedTheme ? '#f5b2b2' : isYellowTheme ? '#fef3c7' : '#a8dab5',
            lineHeight: '1.3',
            fontFamily: 'monospace',
            position: 'relative'
          }}>
            {displayedText.split('**').map((part, index) => {
              if (index % 2 === 1) {
                // Bold red text
                return (
                  <span key={index} style={{
                    fontWeight: 'bold',
                    color: isRedTheme ? '#dc2626' : isYellowTheme ? '#f59e0b' : '#4caf50'
                  }}>
                    {part}
                  </span>
                );
              }
              return part;
            })}
            {isTyping && (
              <span style={{
                color: isRedTheme ? '#dc2626' : isYellowTheme ? '#f59e0b' : '#4caf50',
                animation: 'blink 1s infinite'
              }}>|</span>
            )}
            {showToggleBall && !isTyping && (
              <span 
                onClick={handleToggleBallClick}
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  backgroundColor: primaryColor,
                  borderRadius: '50%',
                  marginLeft: '4px',
                  cursor: 'pointer',
                  animation: 'toggleBallPulse 2s ease-in-out infinite',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
                title="Click to expand data"
              />
            )}
          </p>
        )}

        {/* Data - Only show if data exists and is expanded */}
        {card.content?.data && Object.keys(card.content.data).length > 0 && isDataExpanded && showDataRows && (
          <div style={{ 
            marginBottom: '12px',
            animation: 'dataRowsSlideIn 0.5s ease-out',
            overflow: 'hidden'
          }}>
            {Object.entries(card.content.data).map(([key, value], index) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                fontSize: '10px',
                animation: `dataRowFadeIn 0.3s ease-out ${index * 0.1}s both`
              }}>
                <span style={{ color: '#9aa0a6' }}>{key}:</span>
                <span style={{ 
                  color: primaryColor,
                  fontWeight: '500',
                  textAlign: 'right',
                  maxWidth: '60%',
                  wordBreak: 'break-word'
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}


      </div>

      {/* Small close button and status indicators */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
        right: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {isDragging && (
          <span style={{
            fontSize: '8px',
            color: '#666'
          }} title="Dragging">🔄</span>
        )}
        <button
          onClick={() => onClose(card.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px',
            borderRadius: '2px',
            transition: 'color 0.2s ease',
            lineHeight: '1',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = '#999';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#666';
          }}
          title="Close card"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ScenePopupCard;