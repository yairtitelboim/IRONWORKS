import React, { useState } from 'react';

const GeoAI = ({ 
  onTriggerGeoAI, 
  title, 
  color, 
  size, 
  position, 
  aiState, 
  map, 
  onLoadingChange, 
  disabled = false,
  updateToolFeedback 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled) {
      console.warn('🛰️ GeoAI click ignored: control disabled');
      return;
    }

    if (isLoading) {
      console.warn('🛰️ GeoAI click ignored: request already in-flight');
      return;
    }

    if (!onTriggerGeoAI) {
      console.error('🛰️ GeoAI click ignored: missing onTriggerGeoAI handler');
      return;
    }

    const clickStartedAt = Date.now();
    console.groupCollapsed('🛰️ GeoAI button clicked');
    console.log('Preparing GeoAI analysis request', {
      clickTimestamp: new Date(clickStartedAt).toISOString(),
      hasAiState: Boolean(aiState),
      hasMapRef: Boolean(map?.current)
    });

    try {
      setIsLoading(true);
      onLoadingChange?.(true);
      console.log('Dispatching geoai_analysis query payload', {
        source: 'geoai_button'
      });
      await onTriggerGeoAI({
        id: 'geoai_analysis',
        source: 'geoai_button'
      });
      console.log('GeoAI query promise resolved', {
        durationMs: Date.now() - clickStartedAt
      });

    } catch (error) {
      console.error('GeoAI processing error:', error);
      
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: true,
          tool: 'geoai',
          status: '❌ GeoAI analysis failed',
          progress: 0,
          details: error.message || 'Unknown error occurred'
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
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
      console.log('GeoAI button handler finished', {
        totalDurationMs: Date.now() - clickStartedAt
      });
      console.groupEnd();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        top: position?.top || '0px',
        left: position?.left || '0px',
        width: size || '10px',
        height: size || '10px',
        borderRadius: '50%',
        background: color || 'rgba(236, 72, 153, 0.8)', // Hot pink default
        border: `1px solid ${color?.replace('0.8', '0.5') || 'rgba(236, 72, 153, 0.5)'}`,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 2px 8px ${color?.replace('0.8', '0.3') || 'rgba(236, 72, 153, 0.3)'}`,
        padding: '8px',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: 'auto'
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.background = color?.replace('0.8', '1') || 'rgba(236, 72, 153, 1)';
          e.target.style.boxShadow = `0 4px 16px ${color?.replace('0.8', '0.5') || 'rgba(236, 72, 153, 0.5)'}`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.target.style.transform = 'scale(1)';
          e.target.style.background = color || 'rgba(236, 72, 153, 0.8)';
          e.target.style.boxShadow = `0 2px 8px ${color?.replace('0.8', '0.3') || 'rgba(236, 72, 153, 0.3)'}`;
        }
      }}
      title={title || "GeoAI Spatial Intelligence"}
    >
      {/* Intentionally empty - no icon for GeoAI */}
    </div>
  );
};

export default GeoAI;
