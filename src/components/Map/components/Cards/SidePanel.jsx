import React, { useState, useEffect } from 'react';

const SidePanel = ({ aiState }) => {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [arrowPosition, setArrowPosition] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  
  // Calculate arrow position based on card height
  useEffect(() => {
    const calculateArrowPosition = () => {
      // Get the main card height dynamically
      const mainCard = document.querySelector('.base-card');
      if (mainCard) {
        const height = mainCard.offsetHeight;
        setCardHeight(height);
        
        // Position arrow at 1/3 from the top of the card, but ensure it's not above the card
        const topThird = Math.max(20, height * 0.33); // Minimum 20px from top
        setArrowPosition(topThird);
      }
    };
    
    // Calculate on mount and when card height changes
    calculateArrowPosition();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateArrowPosition);
    
    // Use ResizeObserver to detect card height changes
    const mainCard = document.querySelector('.base-card');
    if (mainCard) {
      const resizeObserver = new ResizeObserver(calculateArrowPosition);
      resizeObserver.observe(mainCard);
      
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', calculateArrowPosition);
      };
    }
  }, []);

  // Mock options for the side panel
  const SIDE_PANEL_OPTIONS = [
    {
      id: 'site_analysis',
      text: 'Site Analysis'
    },
    {
      id: 'infrastructure',
      text: 'Infrastructure'
    },
    {
      id: 'environmental',
      text: 'Environmental'
    },
    {
      id: 'regulatory',
      text: 'Regulatory'
    },
    {
      id: 'market_data',
      text: 'Market Data'
    }
  ];

  const toggleSidePanel = () => {
    setIsSidePanelOpen(!isSidePanelOpen);
  };

  return (
    <>
      {/* Hover Detection Area - Dynamic height to cover full card */}
      <div 
        style={{
          position: 'absolute',
          left: '-60px',
          top: '0px',
          width: '60px',
          height: `${cardHeight}px`, // Use dynamic height instead of 100%
          zIndex: 8
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      />
      
      {/* Left Arrow to Show Side Panel */}
      <div style={{
        position: 'absolute',
        left: isSidePanelOpen ? '-320px' : '-40px',
        top: `${arrowPosition}px`,
        zIndex: 10,
        opacity: (isHovering || isSidePanelOpen) ? 1 : 0, // Always visible when panel is open
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <button
          onClick={toggleSidePanel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
            e.target.style.transform = 'scale(1)';
          }}
          title="Click to show side panel options"
        >
          <span style={{
            fontSize: '16px',
            fontWeight: 'bold',
            transform: 'rotate(180deg)'
          }}>
            ▶
          </span>
        </button>
      </div>

      {/* Side Panel Content */}
      {isSidePanelOpen && (
        <div style={{
          position: 'absolute',
          left: '-280px',
          top: '0px', // Align with top of main card
          width: '260px',
          opacity: isSidePanelOpen ? 1 : 0,
          transform: isSidePanelOpen ? 'translateX(0)' : 'translateX(-20px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 9,
          paddingBottom: '35px' // Add bottom padding to align with bottom of main card
        }}>

          {SIDE_PANEL_OPTIONS.map((option, index) => (
            <div
              key={option.id}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                color: '#ffffff',
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`,
                marginBottom: '6px',
                textAlign: 'left',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transform: 'translateX(-20px)',
                animation: isSidePanelOpen ? 'buttonSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
                animationDelay: `${index * 0.05}s`,
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateX(-2px)';
                e.target.style.background = 'rgba(255, 255, 255, 0.18)';
                e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateX(0)';
                e.target.style.background = 'rgba(255, 255, 255, 0.06)';
                e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
              }}
              onClick={() => {
                console.log(`🎯 Side panel option clicked: ${option.text}`);
                // TODO: Handle side panel option clicks
              }}
            >
              {option.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default SidePanel;
