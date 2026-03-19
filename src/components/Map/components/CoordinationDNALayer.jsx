import React, { useEffect, useState, useRef } from 'react';

const COORDINATION_DNA_SOURCE_ID = 'coordination-dna-source';
const COORDINATION_DNA_LAYER_ID = 'coordination-dna-layer';

// Infrastructure DNA strands - different types of coordinated development
const DNA_STRANDS = {
  transit: { color: '#10B981', name: 'Transit Infrastructure' },
  utility: { color: '#3B82F6', name: 'Utility Infrastructure' },
  development: { color: '#F59E0B', name: 'Development Projects' },
  financing: { color: '#EF4444', name: 'Financing/Bonds' }
};

const CoordinationDNALayer = ({ map, visible, permitData }) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [selectedStrand, setSelectedStrand] = useState(null);
  const animationRef = useRef(null);

  // Categorize permits into DNA strands
  const categorizePermitIntoDNA = (permit) => {
    const address = (permit.properties.ADDRESS || '').toLowerCase();
    const permitClass = (permit.properties.CLASS || '').toLowerCase();
    const neighborhood = (permit.properties.NEIGHBORHOOD || '').toLowerCase();
    
    // Transit-related permits
    if (address.includes('station') || address.includes('transit') || 
        address.includes('rail') || neighborhood.includes('union station')) {
      return 'transit';
    }
    
    // Utility infrastructure
    if (permitClass.includes('utility') || address.includes('utility') ||
        address.includes('water') || address.includes('sewer')) {
      return 'utility';
    }
    
    // Large development projects
    if (permit.properties.VALUATION > 10000000) {
      return 'development';
    }
    
    // Default to financing/other
    return 'financing';
  };

  // Create DNA helix geometry
  const createDNAHelixGeometry = (permits, centerCoords, radius = 2000) => {
    if (!permits || !permits.features) return [];
    
    const features = [];
    const sortedPermits = permits.features
      .filter(p => p.properties.DATE_ISSUED)
      .sort((a, b) => new Date(a.properties.DATE_ISSUED) - new Date(b.properties.DATE_ISSUED));
    
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2025-12-31');
    const timeSpan = endDate - startDate;
    
    sortedPermits.forEach((permit, index) => {
      const permitDate = new Date(permit.properties.DATE_ISSUED);
      const timeProgress = (permitDate - startDate) / timeSpan;
      const strandType = categorizePermitIntoDNA(permit);
      
      // Calculate helix position
      const angle = timeProgress * 8 * Math.PI; // 4 full rotations over time
      const helixRadius = radius * (0.3 + 0.7 * Math.sin(timeProgress * Math.PI)); // Variable radius
      const height = timeProgress; // Height represents time
      
      // Calculate coordinates for the helix point
      const x = centerCoords[0] + (helixRadius / 111320) * Math.cos(angle);
      const y = centerCoords[1] + (helixRadius / 110540) * Math.sin(angle);
      
      // Create connecting lines between related permits (DNA bonds)
      const connections = [];
      if (index > 0 && index < sortedPermits.length - 1) {
        const prevPermit = sortedPermits[index - 1];
        const nextPermit = sortedPermits[index + 1];
        
        // Connect to permits of complementary types
        if (categorizePermitIntoDNA(prevPermit) !== strandType) {
          connections.push({
            type: 'Feature',
            properties: {
              connectionType: 'dna_bond',
              strandType,
              bondStrength: Math.min(permit.properties.VALUATION / 1000000, 10)
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [x, y],
                permit.geometry.coordinates
              ]
            }
          });
        }
      }
      
      features.push({
        type: 'Feature',
        properties: {
          ...permit.properties,
          strandType,
          helixPosition: { x, y, height },
          timeProgress,
          angle,
          originalCoords: permit.geometry.coordinates,
          dnaIndex: index
        },
        geometry: {
          type: 'Point',
          coordinates: [x, y]
        }
      });
      
      features.push(...connections);
    });
    
    return features;
  };

  // Create DNA backbone (the connecting spiral)
  const createDNABackbone = (centerCoords, radius = 2000) => {
    const backboneFeatures = [];
    const steps = 200;
    
    // Create two intertwined spirals
    for (let strand = 0; strand < 2; strand++) {
      const coordinates = [];
      const strandOffset = strand * Math.PI; // Offset second strand by 180°
      
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const angle = progress * 8 * Math.PI + strandOffset;
        const helixRadius = radius * (0.3 + 0.7 * Math.sin(progress * Math.PI));
        
        const x = centerCoords[0] + (helixRadius / 111320) * Math.cos(angle);
        const y = centerCoords[1] + (helixRadius / 110540) * Math.sin(angle);
        
        coordinates.push([x, y]);
      }
      
      backboneFeatures.push({
        type: 'Feature',
        properties: {
          backboneStrand: strand,
          strandType: 'backbone'
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      });
    }
    
    return backboneFeatures;
  };

  // Animate DNA rotation
  const animateDNARotation = () => {
    if (!map?.current || !visible) return;
    
    const startTime = Date.now();
    const rotationDuration = 10000; // 10 second rotation
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const rotationProgress = (elapsed % rotationDuration) / rotationDuration;
      setAnimationPhase(rotationProgress);
      
      // Update DNA helix visualization based on rotation
      if (map.current.getLayer(COORDINATION_DNA_LAYER_ID)) {
        // Animate the opacity and size based on rotation phase
        const pulseStrength = (Math.sin(rotationProgress * 4 * Math.PI) + 1) / 2;
        
        map.current.setPaintProperty(COORDINATION_DNA_LAYER_ID, 'circle-opacity', 
          0.6 + (pulseStrength * 0.3)
        );
        
        map.current.setPaintProperty(COORDINATION_DNA_LAYER_ID, 'circle-radius', [
          'case',
          ['==', ['get', 'strandType'], 'transit'], 6 + (pulseStrength * 2),
          ['==', ['get', 'strandType'], 'utility'], 5 + (pulseStrength * 2),
          ['==', ['get', 'strandType'], 'development'], 7 + (pulseStrength * 3),
          4 + (pulseStrength * 2)
        ]);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Initialize DNA visualization
  useEffect(() => {
    if (!map?.current || !visible || !permitData) return;

    const centerCoords = [-105.0050, 39.7550]; // Downtown Denver center
    
    // Create DNA helix geometry
    const dnaFeatures = createDNAHelixGeometry(permitData, centerCoords);
    const backboneFeatures = createDNABackbone(centerCoords);
    const allFeatures = [...dnaFeatures, ...backboneFeatures];

    // Add DNA source and layer
    if (!map.current.getSource(COORDINATION_DNA_SOURCE_ID)) {
      map.current.addSource(COORDINATION_DNA_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: allFeatures
        }
      });

      // Add backbone layer (lines)
      map.current.addLayer({
        id: COORDINATION_DNA_LAYER_ID + '-backbone',
        type: 'line',
        source: COORDINATION_DNA_SOURCE_ID,
        filter: ['==', ['get', 'strandType'], 'backbone'],
        paint: {
          'line-color': '#6B7280',
          'line-width': 2,
          'line-opacity': 0.3
        }
      });

      // Add DNA bonds layer (connection lines)
      map.current.addLayer({
        id: COORDINATION_DNA_LAYER_ID + '-bonds',
        type: 'line',
        source: COORDINATION_DNA_SOURCE_ID,
        filter: ['==', ['get', 'connectionType'], 'dna_bond'],
        paint: {
          'line-color': '#E5E7EB',
          'line-width': 1,
          'line-opacity': 0.4,
          'line-dasharray': [2, 2]
        }
      });

      // Add DNA points layer
      map.current.addLayer({
        id: COORDINATION_DNA_LAYER_ID,
        type: 'circle',
        source: COORDINATION_DNA_SOURCE_ID,
        filter: ['!=', ['get', 'strandType'], 'backbone'],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'strandType'], 'transit'], DNA_STRANDS.transit.color,
            ['==', ['get', 'strandType'], 'utility'], DNA_STRANDS.utility.color,
            ['==', ['get', 'strandType'], 'development'], DNA_STRANDS.development.color,
            DNA_STRANDS.financing.color
          ],
          'circle-radius': [
            'case',
            ['==', ['get', 'strandType'], 'development'], 7,
            ['==', ['get', 'strandType'], 'transit'], 6,
            ['==', ['get', 'strandType'], 'utility'], 5,
            4
          ],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1
        }
      });
    }

    // Start animation
    animateDNARotation();

    // Click handler
    const handleClick = (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [COORDINATION_DNA_LAYER_ID]
      });

      if (features.length > 0) {
        const strandType = features[0].properties.strandType;
        setSelectedStrand(strandType);
      } else {
        setSelectedStrand(null);
      }
    };

    map.current.on('click', handleClick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      map.current?.off('click', handleClick);
      
      ['', '-backbone', '-bonds'].forEach(suffix => {
        if (map.current?.getLayer(COORDINATION_DNA_LAYER_ID + suffix)) {
          map.current.removeLayer(COORDINATION_DNA_LAYER_ID + suffix);
        }
      });
      
      if (map.current?.getSource(COORDINATION_DNA_SOURCE_ID)) {
        map.current.removeSource(COORDINATION_DNA_SOURCE_ID);
      }
    };
  }, [map, visible, permitData]);

  return (
    <div style={{
      position: 'absolute',
      top: '140px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '14px',
      minWidth: '220px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        🧬 Coordination DNA Helix
      </div>
      
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '15px' }}>
        Infrastructure types interweave over time like DNA strands
      </div>
      
      {/* DNA Strands Legend */}
      <div style={{ fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>DNA Strands:</div>
        {Object.entries(DNA_STRANDS).map(([key, strand]) => (
          <div key={key} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '5px',
            opacity: selectedStrand === key ? 1 : (selectedStrand ? 0.5 : 0.8)
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              backgroundColor: strand.color,
              borderRadius: '50%',
              marginRight: '8px'
            }} />
            <span>{strand.name}</span>
          </div>
        ))}
      </div>
      
      {/* Animation Status */}
      <div style={{ 
        marginTop: '15px', 
        fontSize: '10px', 
        color: '#6B7280',
        borderTop: '1px solid #374151',
        paddingTop: '8px'
      }}>
        Rotation Phase: {(animationPhase * 100).toFixed(0)}%
      </div>
      
      {selectedStrand && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <div style={{ color: DNA_STRANDS[selectedStrand]?.color, fontWeight: 'bold' }}>
            {DNA_STRANDS[selectedStrand]?.name}
          </div>
          <div style={{ color: '#D1D5DB', marginTop: '3px' }}>
            Selected strand in coordination helix
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinationDNALayer;
