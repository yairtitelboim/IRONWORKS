import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const FirecrawlCall = ({ 
  onClick, 
  title = "Web Crawling with Firecrawl",
  color = "rgba(255, 165, 0, 0.8)", // Orange color for Firecrawl
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

  // Function to perform web crawling with Firecrawl
  const performWebCrawling = async (lat, lng, marker) => {
    try {
      console.log('🕷️ Starting web crawling with Firecrawl...');
      
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Starting web crawl...', 0);
      }

      // Simulate web crawling process
      const crawlResponse = {
        success: true,
        data: {
          urls: [
            'https://www.ercot.com/gridmgt/real-time',
            'https://www.txdot.gov/inside-txdot/division/transportation-planning/planning-studies.html',
            'https://www.bosquecountytexas.org/planning-zoning'
          ],
          extractedData: {
            ercotGridStatus: 'Normal operations',
            transmissionCapacity: 'Adequate for current load',
            planningUpdates: 'Recent zoning changes in Bosque County',
            infrastructureProjects: 'I-35 expansion project in planning phase'
          },
          metadata: {
            crawlTime: new Date().toISOString(),
            pagesProcessed: 15,
            dataPoints: 47
          }
        }
      };

      // Update tool feedback
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Web crawl completed successfully', 100);
      }

      // Call the onClick callback with the response
      if (onClick) {
        onClick(crawlResponse);
      }

      console.log('✅ Firecrawl web crawling completed:', crawlResponse);

    } catch (error) {
      console.error('❌ Firecrawl web crawling error:', error);
      
      if (updateToolFeedback) {
        updateToolFeedback('firecrawl', 'Web crawl failed', 0);
      }

      // Return error response
      if (onClick) {
        onClick({
          success: false,
          error: error.message,
          data: null
        });
      }
    }
  };

  const handleClick = () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }

    // Get current map center if available
    let lat = 31.9686; // Default to Texas center
    let lng = -99.9018;
    
    if (map && map.current) {
      const center = map.current.getCenter();
      lat = center.lat;
      lng = center.lng;
    }

    // Perform the web crawling
    performWebCrawling(lat, lng).finally(() => {
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    });
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        border: `1px solid ${color.replace('0.8', '0.6')}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(255, 165, 0, 0.3)',
        padding: '8px',
        opacity: disabled ? 0.5 : 1,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
    >
      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderTop: '2px solid rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}

      {/* Firecrawl icon (spider web) */}
      {!isLoading && (
        <div style={{
          width: '6px',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '50%',
          position: 'relative'
        }}>
          {/* Web lines radiating from center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(0deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(45deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(90deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'translate(-50%, -50%) rotate(135deg)'
          }} />
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FirecrawlCall;
