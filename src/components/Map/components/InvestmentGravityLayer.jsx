import React, { useEffect, useState, useRef } from 'react';

const GRAVITY_WELLS_SOURCE_ID = 'gravity-wells-source';
const GRAVITY_WELLS_LAYER_ID = 'gravity-wells-layer';
const ATTRACTED_PERMITS_SOURCE_ID = 'attracted-permits-source';
const ATTRACTED_PERMITS_LAYER_ID = 'attracted-permits-layer';

// Major infrastructure "gravity wells" with their economic mass
const GRAVITY_WELLS = [
  {
    name: 'Ball Arena',
    coordinates: [-104.9999, 39.7486],
    mass: 650000000, // $650M redevelopment
    type: 'entertainment',
    color: '#8B5CF6'
  },
  {
    name: 'Union Station',
    coordinates: [-105.0014, 39.7539],
    mass: 500000000, // Major transit hub investment
    type: 'transit',
    color: '#10B981'
  },
  {
    name: 'River Mile',
    coordinates: [-105.0100, 39.7600],
    mass: 140000000, // $140M River Mile development
    type: 'development',
    color: '#F59E0B'
  },
  {
    name: 'South Platte Utilities',
    coordinates: [-105.0050, 39.7500],
    mass: 200000000, // Utility infrastructure investment
    type: 'utility',
    color: '#3B82F6'
  }
];

const InvestmentGravityLayer = ({ map, visible, permitData }) => {
  const [selectedWell, setSelectedWell] = useState(null);
  const [showGravityField, setShowGravityField] = useState(true);
  const animationRef = useRef(null);

  // Calculate gravitational influence on permits
  const calculateGravitationalPull = (permit, wells) => {
    let totalForce = 0;
    let dominantWell = null;
    let maxForce = 0;

    wells.forEach(well => {
      const distance = calculateDistance(
        well.coordinates,
        permit.geometry.coordinates
      );
      
      // Gravitational force: F = G * (m1 * m2) / r^2
      // Simplified: force proportional to mass / distance^2
      const force = well.mass / Math.pow(Math.max(distance, 100), 1.5); // Prevent division by zero
      
      totalForce += force;
      
      if (force > maxForce) {
        maxForce = force;
        dominantWell = well;
      }
    });

    return {
      totalForce,
      dominantWell,
      maxForce,
      attractionStrength: Math.min(maxForce / 1000, 1) // Normalize to 0-1
    };
  };

  // Calculate distance between two coordinates
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

  // Create gravity well visualization (3D depression effect)
  const createGravityWellGeometry = (well) => {
    const steps = 32;
    const maxRadius = Math.sqrt(well.mass / 1000000) * 500; // Radius based on mass
    const rings = 8;
    
    const features = [];
    
    // Create concentric circles for 3D effect
    for (let ring = 0; ring < rings; ring++) {
      const radius = (maxRadius / rings) * (ring + 1);
      const opacity = 1 - (ring / rings) * 0.7; // Fade outward
      const height = (rings - ring) * 20; // Height decreases outward
      
      const coordinates = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const lng = well.coordinates[0] + (radius / 111320) * Math.cos(angle);
        const lat = well.coordinates[1] + (radius / 110540) * Math.sin(angle);
        coordinates.push([lng, lat]);
      }
      
      features.push({
        type: 'Feature',
        properties: {
          wellName: well.name,
          wellType: well.type,
          ring: ring,
          opacity: opacity,
          height: height,
          color: well.color,
          mass: well.mass
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      });
    }
    
    return features;
  };

  // Create attraction field visualization
  const createAttractionField = (wells, permits) => {
    if (!permits || !permits.features) return [];
    
    return permits.features.map(permit => {
      const gravity = calculateGravitationalPull(permit, wells);
      
      return {
        type: 'Feature',
        properties: {
          ...permit.properties,
          attractionStrength: gravity.attractionStrength,
          dominantWell: gravity.dominantWell?.name || 'None',
          dominantWellColor: gravity.dominantWell?.color || '#6B7280',
          totalForce: gravity.totalForce
        },
        geometry: permit.geometry
      };
    });
  };

  // Animate gravity effect
  const animateGravityEffect = () => {
    if (!map?.current || !visible) return;
    
    const startTime = Date.now();
    const duration = 4000; // 4 second cycle
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % duration) / duration;
      const pulseStrength = (Math.sin(progress * 2 * Math.PI) + 1) / 2; // 0 to 1
      
      // Update gravity well opacity based on pulse
      if (map.current.getLayer(GRAVITY_WELLS_LAYER_ID)) {
        map.current.setPaintProperty(GRAVITY_WELLS_LAYER_ID, 'fill-opacity', [
          '*',
          ['get', 'opacity'],
          0.3 + (pulseStrength * 0.4) // Pulse between 0.3 and 0.7
        ]);
      }
      
      // Update attracted permits size based on attraction strength
      if (map.current.getLayer(ATTRACTED_PERMITS_LAYER_ID)) {
        map.current.setPaintProperty(ATTRACTED_PERMITS_LAYER_ID, 'circle-radius', [
          '+',
          4,
          ['*', ['get', 'attractionStrength'], 6 * pulseStrength] // Pulse radius
        ]);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Initialize layers
  useEffect(() => {
    if (!map?.current || !visible) return;

    // Create gravity wells geometry
    const gravityWellsFeatures = GRAVITY_WELLS.flatMap(well => 
      createGravityWellGeometry(well)
    );

    // Add gravity wells source and layer
    if (!map.current.getSource(GRAVITY_WELLS_SOURCE_ID)) {
      map.current.addSource(GRAVITY_WELLS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: gravityWellsFeatures
        }
      });

      map.current.addLayer({
        id: GRAVITY_WELLS_LAYER_ID,
        type: 'fill',
        source: GRAVITY_WELLS_SOURCE_ID,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['*', ['get', 'opacity'], 0.5]
        }
      });
    }

    // Add attracted permits layer if permit data is available
    if (permitData && !map.current.getSource(ATTRACTED_PERMITS_SOURCE_ID)) {
      const attractedPermits = createAttractionField(GRAVITY_WELLS, permitData);
      
      map.current.addSource(ATTRACTED_PERMITS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: attractedPermits
        }
      });

      map.current.addLayer({
        id: ATTRACTED_PERMITS_LAYER_ID,
        type: 'circle',
        source: ATTRACTED_PERMITS_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'dominantWellColor'],
          'circle-radius': [
            '+',
            4,
            ['*', ['get', 'attractionStrength'], 6]
          ],
          'circle-opacity': 0.7,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1
        }
      });
    }

    // Start animation
    if (visible) {
      animateGravityEffect();
    }

    // Click handler for gravity wells
    const handleClick = (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [GRAVITY_WELLS_LAYER_ID]
      });

      if (features.length > 0) {
        const wellName = features[0].properties.wellName;
        const well = GRAVITY_WELLS.find(w => w.name === wellName);
        setSelectedWell(well);
      } else {
        setSelectedWell(null);
      }
    };

    map.current.on('click', handleClick);

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      map.current?.off('click', handleClick);
      
      if (map.current?.getLayer(GRAVITY_WELLS_LAYER_ID)) {
        map.current.removeLayer(GRAVITY_WELLS_LAYER_ID);
      }
      if (map.current?.getSource(GRAVITY_WELLS_SOURCE_ID)) {
        map.current.removeSource(GRAVITY_WELLS_SOURCE_ID);
      }
      if (map.current?.getLayer(ATTRACTED_PERMITS_LAYER_ID)) {
        map.current.removeLayer(ATTRACTED_PERMITS_LAYER_ID);
      }
      if (map.current?.getSource(ATTRACTED_PERMITS_SOURCE_ID)) {
        map.current.removeSource(ATTRACTED_PERMITS_SOURCE_ID);
      }
    };
  }, [map, visible, permitData]);

  return (
    <>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: '80px',
        right: '20px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        minWidth: '200px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
          🌌 Investment Gravity Wells
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showGravityField}
              onChange={(e) => setShowGravityField(e.target.checked)}
              style={{ marginRight: '5px' }}
            />
            Show Gravity Field
          </label>
        </div>
        
        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
          Infrastructure investments create "gravity wells" that attract development
        </div>
        
        {/* Gravity Wells Legend */}
        <div style={{ marginTop: '15px', fontSize: '11px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Gravity Wells:</div>
          {GRAVITY_WELLS.map(well => (
            <div key={well.name} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '3px',
              opacity: selectedWell?.name === well.name ? 1 : 0.7
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: well.color,
                borderRadius: '50%',
                marginRight: '5px'
              }} />
              <span>{well.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9CA3AF' }}>
                ${(well.mass / 1000000).toFixed(0)}M
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Well Info */}
      {selectedWell && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '14px',
          maxWidth: '300px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '16px',
            color: selectedWell.color,
            marginBottom: '8px'
          }}>
            {selectedWell.name}
          </div>
          <div style={{ marginBottom: '5px' }}>
            Investment: ${(selectedWell.mass / 1000000).toFixed(0)}M
          </div>
          <div style={{ marginBottom: '5px' }}>
            Type: {selectedWell.type}
          </div>
          <div style={{ fontSize: '12px', color: '#D1D5DB' }}>
            This infrastructure investment creates economic "gravity" that attracts 
            surrounding development projects. Larger investments = stronger gravitational pull.
          </div>
        </div>
      )}
    </>
  );
};

export default InvestmentGravityLayer;
