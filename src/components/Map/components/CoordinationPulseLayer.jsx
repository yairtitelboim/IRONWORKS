import React, { useEffect, useState, useRef } from 'react';

const COORDINATION_PULSE_SOURCE_ID = 'coordination-pulse-source';
const COORDINATION_PULSE_LAYER_ID = 'coordination-pulse-layer';
const PERMIT_IGNITION_SOURCE_ID = 'permit-ignition-source';
const PERMIT_IGNITION_LAYER_ID = 'permit-ignition-layer';

// Ball Arena coordinates (approximate)
const BALL_ARENA_COORDS = [-104.9999, 39.7486];

// Major infrastructure events that triggered coordination
const COORDINATION_EVENTS = [
  { date: '2020-01-01', type: 'transit', name: 'Light Rail Expansion', budget: 650000000, radius: 3000 },
  { date: '2021-06-01', type: 'arena', name: 'Ball Arena Redevelopment', budget: 650000000, radius: 4000 },
  { date: '2021-09-01', type: 'utility', name: 'South Platte Utility Expansion', budget: 140000000, radius: 2500 },
  { date: '2022-03-01', type: 'development', name: 'River Mile Development', budget: 140000000, radius: 2000 },
  { date: '2023-01-01', type: 'bonds', name: 'Infrastructure Bonds', budget: 570000000, radius: 5000 }
];

const CoordinationPulseLayer = ({ map, visible, permitData, animationSpeed = 1000 }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const animationRef = useRef(null);
  const pulseAnimationRef = useRef(null);

  // Function to create pulse geometry
  const createPulseGeometry = (center, radius, timestamp) => {
    const steps = 64;
    const coordinates = [];
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const lng = center[0] + (radius / 111320) * Math.cos(angle); // Rough conversion to degrees
      const lat = center[1] + (radius / 110540) * Math.sin(angle);
      coordinates.push([lng, lat]);
    }
    
    return {
      type: 'Feature',
      properties: {
        timestamp,
        radius,
        opacity: 1.0
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    };
  };

  // Function to get infrastructure color
  const getInfrastructureColor = (type) => {
    const colors = {
      'transit': '#10B981',    // Green for transit
      'arena': '#8B5CF6',      // Purple for Ball Arena
      'utility': '#3B82F6',    // Blue for utilities  
      'development': '#F59E0B', // Amber for development
      'bonds': '#EF4444'       // Red for bonds/financing
    };
    return colors[type] || '#6B7280';
  };

  // Function to calculate permits within influence radius
  const getInfluencedPermits = (event, permits) => {
    if (!permits || !permits.features) return [];
    
    const eventDate = new Date(event.date);
    const influenceEndDate = new Date(eventDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year influence
    
    return permits.features.filter(permit => {
      const permitDate = new Date(permit.properties.DATE_ISSUED);
      const distance = calculateDistance(
        BALL_ARENA_COORDS,
        permit.geometry.coordinates
      );
      
      return permitDate >= eventDate && 
             permitDate <= influenceEndDate && 
             distance <= event.radius;
    });
  };

  // Haversine distance calculation
  const calculateDistance = (coord1, coord2) => {
    const R = 6371000; // Earth's radius in meters
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Animation control functions
  const startCoordinationAnimation = () => {
    if (!permitData || isAnimating) return;
    
    setIsAnimating(true);
    setCurrentEventIndex(0);
    
    const animateEvent = (eventIndex) => {
      if (eventIndex >= COORDINATION_EVENTS.length) {
        setIsAnimating(false);
        return;
      }
      
      const event = COORDINATION_EVENTS[eventIndex];
      triggerCoordinationPulse(event);
      
      setTimeout(() => {
        setCurrentEventIndex(eventIndex + 1);
        animateEvent(eventIndex + 1);
      }, animationSpeed);
    };
    
    animateEvent(0);
  };

  const triggerCoordinationPulse = (event) => {
    if (!map?.current) return;
    
    console.log(`🌊 Triggering coordination pulse: ${event.name}`);
    
    // Create expanding pulse animation
    const startTime = Date.now();
    const duration = 3000; // 3 second pulse
    const maxRadius = event.radius;
    
    const animatePulse = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress >= 1) {
        // Pulse complete, trigger permit ignitions
        triggerPermitIgnitions(event);
        return;
      }
      
      // Calculate current pulse radius and opacity
      const currentRadius = maxRadius * progress;
      const opacity = 1 - progress; // Fade out as it expands
      
      // Update pulse geometry
      const pulseGeometry = createPulseGeometry(BALL_ARENA_COORDS, currentRadius, Date.now());
      pulseGeometry.properties.opacity = opacity;
      
      // Update map source
      if (map.current.getSource(COORDINATION_PULSE_SOURCE_ID)) {
        map.current.getSource(COORDINATION_PULSE_SOURCE_ID).setData({
          type: 'FeatureCollection',
          features: [pulseGeometry]
        });
      }
      
      pulseAnimationRef.current = requestAnimationFrame(animatePulse);
    };
    
    // Start pulse animation
    pulseAnimationRef.current = requestAnimationFrame(animatePulse);
  };

  const triggerPermitIgnitions = (event) => {
    const influencedPermits = getInfluencedPermits(event, permitData);
    console.log(`🔥 Igniting ${influencedPermits.length} permits for ${event.name}`);
    
    // Animate permits lighting up in sequence
    influencedPermits.forEach((permit, index) => {
      setTimeout(() => {
        // Add ignition effect to permit
        const ignitionFeature = {
          type: 'Feature',
          properties: {
            ...permit.properties,
            ignition_type: event.type,
            ignition_color: getInfrastructureColor(event.type)
          },
          geometry: permit.geometry
        };
        
        // Update permit ignition layer
        if (map.current.getSource(PERMIT_IGNITION_SOURCE_ID)) {
          const currentData = map.current.getSource(PERMIT_IGNITION_SOURCE_ID)._data;
          const newFeatures = [...(currentData.features || []), ignitionFeature];
          
          map.current.getSource(PERMIT_IGNITION_SOURCE_ID).setData({
            type: 'FeatureCollection',
            features: newFeatures
          });
        }
      }, index * 100); // Stagger ignitions by 100ms
    });
  };

  // Initialize layers when component mounts
  useEffect(() => {
    if (!map?.current || !visible) return;

    // Add coordination pulse source and layer
    if (!map.current.getSource(COORDINATION_PULSE_SOURCE_ID)) {
      map.current.addSource(COORDINATION_PULSE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.current.addLayer({
        id: COORDINATION_PULSE_LAYER_ID,
        type: 'fill',
        source: COORDINATION_PULSE_SOURCE_ID,
        paint: {
          'fill-color': '#8B5CF6',
          'fill-opacity': ['get', 'opacity'],
          'fill-outline-color': '#8B5CF6'
        }
      });
    }

    // Add permit ignition source and layer
    if (!map.current.getSource(PERMIT_IGNITION_SOURCE_ID)) {
      map.current.addSource(PERMIT_IGNITION_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.current.addLayer({
        id: PERMIT_IGNITION_LAYER_ID,
        type: 'circle',
        source: PERMIT_IGNITION_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'ignition_color'],
          'circle-radius': 8,
          'circle-opacity': 0.8,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2
        }
      });
    }

    return () => {
      // Cleanup
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
      }
      
      if (map.current?.getLayer(COORDINATION_PULSE_LAYER_ID)) {
        map.current.removeLayer(COORDINATION_PULSE_LAYER_ID);
      }
      if (map.current?.getSource(COORDINATION_PULSE_SOURCE_ID)) {
        map.current.removeSource(COORDINATION_PULSE_SOURCE_ID);
      }
      if (map.current?.getLayer(PERMIT_IGNITION_LAYER_ID)) {
        map.current.removeLayer(PERMIT_IGNITION_LAYER_ID);
      }
      if (map.current?.getSource(PERMIT_IGNITION_SOURCE_ID)) {
        map.current.removeSource(PERMIT_IGNITION_SOURCE_ID);
      }
    };
  }, [map, visible]);

  // Control interface
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '14px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        🌊 Coordination Pulse Animation
      </div>
      
      <button
        onClick={startCoordinationAnimation}
        disabled={isAnimating}
        style={{
          background: isAnimating ? '#6B7280' : '#8B5CF6',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: isAnimating ? 'not-allowed' : 'pointer',
          marginBottom: '10px',
          width: '100%'
        }}
      >
        {isAnimating ? 'Animating...' : 'Start Coordination Animation'}
      </button>
      
      {isAnimating && (
        <div style={{ fontSize: '12px', color: '#D1D5DB' }}>
          Event {currentEventIndex + 1} of {COORDINATION_EVENTS.length}
          <br />
          {COORDINATION_EVENTS[currentEventIndex]?.name}
        </div>
      )}
      
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '10px' }}>
        Shows how infrastructure decisions create cascading development
      </div>
    </div>
  );
};

export default CoordinationPulseLayer;
