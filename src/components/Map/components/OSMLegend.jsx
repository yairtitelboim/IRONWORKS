import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';

const LegendContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid rgba(75, 85, 99, 0.5);
  border-radius: 8px;
  padding: 16px;
  color: #f9fafb;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 1000;
  min-width: 200px;
  max-width: 280px;
  transition: all 0.3s ease;
`;

const LegendHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(75, 85, 99, 0.3);
`;

const LegendTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f9fafb;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TotalCount = styled.span`
  font-size: 11px;
  font-weight: 400;
  color: #6b7280;
  background: rgba(107, 114, 128, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    color: #f9fafb;
    background: rgba(75, 85, 99, 0.3);
  }
`;

const LegendSection = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const CollapsibleContent = styled.div`
  overflow: hidden;
  transition: all 0.3s ease;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transform: ${props => props.$isVisible ? 'translateY(0)' : 'translateY(-10px)'};
  max-height: ${props => props.$isVisible ? '1000px' : '0px'};
  padding-left: 8px;
  border-left: 2px solid rgba(75, 85, 99, 0.2);
  margin-left: 8px;
`;

const CollapsibleSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 10px;
  margin: 0 -10px 10px -10px;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  
  &:hover {
    background: rgba(75, 85, 99, 0.15);
    border-color: rgba(75, 85, 99, 0.3);
  }
  
  &:active {
    background: rgba(75, 85, 99, 0.2);
    transform: scale(0.98);
  }
`;

const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CollapsibleSectionTitle = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: ${props => props.$isCollapsed ? 0.7 : 1};
  transition: opacity 0.2s ease;
`;

const CollapsedIndicator = styled.span`
  font-size: 9px;
  color: #6b7280;
  background: rgba(107, 114, 128, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: auto;
  font-weight: 400;
`;

const SectionToggleIcon = styled.span`
  font-size: 10px;
  color: #6b7280;
  transition: transform 0.2s ease;
  transform: ${props => props.$isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
  padding: 4px 0;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &:hover {
    background: rgba(75, 85, 99, 0.1);
    border-radius: 4px;
    padding: 4px 6px;
    margin: 0 -6px 8px -6px;
  }
`;

const ColorSwatch = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 2px;
  margin-right: 8px;
  border: 1px solid rgba(75, 85, 99, 0.3);
  flex-shrink: 0;
`;

const LineSwatch = styled.div`
  width: 20px;
  height: 2px;
  margin-right: 8px;
  border-radius: 1px;
  flex-shrink: 0;
`;

const CircleSwatch = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
`;

const ItemLabel = styled.span`
  color: #d1d5db;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ItemCount = styled.span`
  color: #6b7280;
  font-size: 10px;
  margin-left: 4px;
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 10px;
  font-style: italic;
`;

const LoadingSpinner = styled.div`
  width: 8px;
  height: 8px;
  border: 1px solid #6b7280;
  border-top: 1px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Wrapper component to handle isVisible prop without passing it to DOM
const LegendContainerWrapper = ({ isVisible, children, ...props }) => {
  // Destructure isVisible and don't pass it to the styled component
  const { isVisible: _, ...restProps } = props;
  return (
    <LegendContainer style={{ 
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
      pointerEvents: isVisible ? 'auto' : 'none'
    }} {...restProps}>
      {children}
    </LegendContainer>
  );
};

const OSMLegend = React.memo(() => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [osmFeatures, setOsmFeatures] = useState([]);
  const [serpFeatures, setSerpFeatures] = useState([]);
  const [featureCounts, setFeatureCounts] = useState({});
  const [serpCounts, setSerpCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for collapsible sections
  const [osmSectionCollapsed, setOsmSectionCollapsed] = useState(false);
  const [serpSectionCollapsed, setSerpSectionCollapsed] = useState(false);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleOSMDataLoaded = useCallback((data) => {
    console.log('🗺️ OSM Legend: Received OSM data:', data);
    setOsmFeatures(data.features || []);
    setIsVisible(true);
    setIsLoading(false);
    
    // Calculate feature counts
    const counts = {};
    (data.features || []).forEach(feature => {
      const category = feature.properties?.category || 'other';
      counts[category] = (counts[category] || 0) + 1;
    });
    setFeatureCounts(counts);
  }, []);

  const handleOSMDataCleared = useCallback(() => {
    console.log('🗺️ OSM Legend: OSM data cleared');
    setOsmFeatures([]);
    setFeatureCounts({});
    // Only hide if no SERP data either
    if (serpFeatures.length === 0) {
      setIsVisible(false);
    }
  }, [serpFeatures.length]);

  const handleSerpDataLoaded = useCallback((data) => {
    console.log('🗺️ OSM Legend: Received SERP data:', data);
    setSerpFeatures(data.features || []);
    setIsVisible(true);
    setIsLoading(false);
    
    // Calculate SERP feature counts
    const counts = {};
    (data.features || []).forEach(feature => {
      const category = feature.properties?.category || 'other';
      counts[category] = (counts[category] || 0) + 1;
    });
    setSerpCounts(counts);
  }, []);

  const handleSerpDataCleared = useCallback(() => {
    console.log('🗺️ OSM Legend: SERP data cleared');
    setSerpFeatures([]);
    setSerpCounts({});
    // Only hide if no OSM data either
    if (osmFeatures.length === 0) {
      setIsVisible(false);
    }
  }, [osmFeatures.length]);

  // Listen for loading states
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleOSMLoading = () => {
      setIsLoading(true);
    };

    const handleSerpLoading = () => {
      setIsLoading(true);
    };

    // Listen for both OSM and SERP data events
    window.mapEventBus.on('osm:dataLoaded', handleOSMDataLoaded);
    window.mapEventBus.on('osm:dataCleared', handleOSMDataCleared);
    window.mapEventBus.on('serp:dataLoaded', handleSerpDataLoaded);
    window.mapEventBus.on('serp:dataCleared', handleSerpDataCleared);
    
    // Listen for loading states
    window.mapEventBus.on('osm:loading', handleOSMLoading);
    window.mapEventBus.on('serp:loading', handleSerpLoading);

    return () => {
      window.mapEventBus.off('osm:dataLoaded', handleOSMDataLoaded);
      window.mapEventBus.off('osm:dataCleared', handleOSMDataCleared);
      window.mapEventBus.off('serp:dataLoaded', handleSerpDataLoaded);
      window.mapEventBus.off('serp:dataCleared', handleSerpDataCleared);
      window.mapEventBus.off('osm:loading', handleOSMLoading);
      window.mapEventBus.off('serp:loading', handleSerpLoading);
    };
  }, [handleOSMDataLoaded, handleOSMDataCleared, handleSerpDataLoaded, handleSerpDataCleared]);

  // Memoized legend data to prevent unnecessary re-renders
  const legendData = useMemo(() => ({
    lines: [
      { label: 'Buildings', color: '#3b82f6', category: 'building' },
      { label: 'Roads', color: '#f59e0b', category: 'road' },
      { label: 'Waterways', color: '#0ea5e9', category: 'waterway' },
      { label: 'Land Use', color: '#10b981', category: 'landuse' },
      { label: 'Other', color: '#6b7280', category: 'other' }
    ],
    fills: [
      { label: 'Buildings', color: 'rgba(59, 130, 246, 0.1)', category: 'building' },
      { label: 'Land Use', color: 'rgba(16, 185, 129, 0.1)', category: 'landuse' },
      { label: 'Other', color: 'rgba(107, 114, 128, 0.05)', category: 'other' }
    ],
    points: [
      { label: 'Points of Interest', color: '#10b981', category: 'poi' }
    ],
    search: [
      { label: 'Search Radius (6km)', color: '#ffffff', type: 'dashed' }
    ]
  }), []);

  // Enhanced SERP legend data with better organization and grouping
  const serpLegendData = useMemo(() => ({
    energy: [
      { label: 'Power Plants', color: '#f59e0b', category: 'power', icon: '⚡' },
      { label: 'Electric Utilities', color: '#f59e0b', category: 'electricity', icon: '🔌' },
      { label: 'Oil & Gas', color: '#92400e', category: 'oil_gas', icon: '🛢️' },
      { label: 'Refineries', color: '#b91c1c', category: 'refinery', icon: '🏭' }
    ],
    infrastructure: [
      { label: 'Data Centers', color: '#3b82f6', category: 'datacenter', icon: '🖥️' },
      { label: 'Water Treatment', color: '#0ea5e9', category: 'water', icon: '💧' },
      { label: 'Telecommunications', color: '#8b5cf6', category: 'telecom', icon: '📡' },
      { label: 'Railroad', color: '#1e40af', category: 'railroad', icon: '🚂' },
      { label: 'Airports', color: '#be185d', category: 'airport', icon: '✈️' }
    ],
    industrial: [
      { label: 'Industrial Facilities', color: '#dc2626', category: 'industrial', icon: '🏭' },
      { label: 'Manufacturing', color: '#dc2626', category: 'manufacturing', icon: '🏭' },
      { label: 'Chemical Plants', color: '#059669', category: 'chemical', icon: '🧪' },
      { label: 'Steel Mills', color: '#1f2937', category: 'steel', icon: '🏭' }
    ],
    commercial: [
      { label: 'Warehouses', color: '#7c3aed', category: 'warehouse', icon: '📦' },
      { label: 'Businesses', color: '#6366f1', category: 'business', icon: '🏢' },
      { label: 'General Facilities', color: '#f97316', category: 'facility', icon: '🏭' },
      { label: 'Buildings', color: '#84cc16', category: 'building', icon: '🏗️' }
    ],
    search: [
      { label: 'SERP Search Radius (3mi)', color: '#8b5cf6', type: 'dashed' }
    ]
  }), []);

  // Memoized title to prevent unnecessary re-renders
  const legendTitle = useMemo(() => {
    if (osmFeatures.length > 0 && serpFeatures.length > 0) {
      return 'Map Features (OSM + SERP)';
    } else if (osmFeatures.length > 0) {
      return 'OSM Features';
    } else if (serpFeatures.length > 0) {
      return 'SERP Infrastructure';
    }
    return 'Map Features';
  }, [osmFeatures.length, serpFeatures.length]);

  // Calculate total feature count
  const totalFeatureCount = useMemo(() => {
    const osmCount = Object.values(featureCounts).reduce((sum, count) => sum + count, 0);
    const serpCount = Object.values(serpCounts).reduce((sum, count) => sum + count, 0);
    return osmCount + serpCount;
  }, [featureCounts, serpCounts]);

  // Memoized section toggle handlers
  const toggleOsmSection = useCallback(() => {
    setOsmSectionCollapsed(prev => !prev);
  }, []);

  const toggleSerpSection = useCallback(() => {
    setSerpSectionCollapsed(prev => !prev);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  if (!isVisible || (osmFeatures.length === 0 && serpFeatures.length === 0)) {
    return null;
  }

  if (isCollapsed) {
    return (
      <LegendContainer isVisible={isVisible}>
        <ToggleButton onClick={toggleCollapsed} aria-label="Expand legend">
          <span>🗺️</span>
        </ToggleButton>
      </LegendContainer>
    );
  }

  return (
    <LegendContainerWrapper isVisible={isVisible}>
      <LegendHeader>
        <LegendTitle>
          {legendTitle}
          {totalFeatureCount > 0 && (
            <TotalCount>{totalFeatureCount} features</TotalCount>
          )}
          {isLoading && (
            <LoadingIndicator>
              <LoadingSpinner />
              Loading...
            </LoadingIndicator>
          )}
        </LegendTitle>
        <ToggleButton onClick={toggleCollapsed} aria-label="Collapse legend">
          <span>−</span>
        </ToggleButton>
      </LegendHeader>

      {/* OSM Features Section - Collapsible */}
      {osmFeatures.length > 0 && (
        <LegendSection>
          <CollapsibleSectionHeader onClick={toggleOsmSection}>
            <CollapsibleSectionTitle $isCollapsed={osmSectionCollapsed}>
              <SectionToggleIcon $isCollapsed={osmSectionCollapsed}>▶</SectionToggleIcon>
              OSM Features
              {osmSectionCollapsed && (
                <CollapsedIndicator>
                  {Object.values(featureCounts).reduce((sum, count) => sum + count, 0)} items
                </CollapsedIndicator>
              )}
            </CollapsibleSectionTitle>
            <ToggleButton onClick={(e) => {
              e.stopPropagation();
              toggleOsmSection();
            }} aria-label="Toggle OSM section">
              <span>{osmSectionCollapsed ? '▶' : '▼'}</span>
            </ToggleButton>
          </CollapsibleSectionHeader>
          
          <CollapsibleContent $isVisible={!osmSectionCollapsed}>
            <LegendSection>
              <SectionTitle>Lines & Outlines</SectionTitle>
              {legendData.lines.map((item, index) => (
                <LegendItem key={`line-${index}`}>
                  <LineSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.label}</ItemLabel>
                  {featureCounts[item.category] && (
                    <ItemCount>({featureCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            <LegendSection>
              <SectionTitle>Fill Areas</SectionTitle>
              {legendData.fills.map((item, index) => (
                <LegendItem key={`fill-${index}`}>
                  <ColorSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.label}</ItemLabel>
                  {featureCounts[item.category] && (
                    <ItemCount>({featureCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            <LegendSection>
              <SectionTitle>Points</SectionTitle>
              {legendData.points.map((item, index) => (
                <LegendItem key={`point-${index}`}>
                  <CircleSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.label}</ItemLabel>
                  {featureCounts[item.category] && (
                    <ItemCount>({featureCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            <LegendSection>
              <SectionTitle>Search Area</SectionTitle>
              {legendData.search.map((item, index) => (
                <LegendItem key={`search-${index}`}>
                  <LineSwatch style={{ 
                    backgroundColor: item.color, 
                    border: '1px dashed #ffffff',
                    opacity: 0.6
                  }} />
                  <ItemLabel>{item.label}</ItemLabel>
                </LegendItem>
              ))}
            </LegendSection>
          </CollapsibleContent>
        </LegendSection>
      )}

      {/* Enhanced SERP Infrastructure Section - Better Organized */}
      {serpFeatures.length > 0 && (
        <LegendSection>
          <CollapsibleSectionHeader onClick={toggleSerpSection}>
            <CollapsibleSectionTitle $isCollapsed={serpSectionCollapsed}>
              <SectionToggleIcon $isCollapsed={serpSectionCollapsed}>▶</SectionToggleIcon>
              SERP Infrastructure
              {serpSectionCollapsed && (
                <CollapsedIndicator>
                  {Object.values(serpCounts).reduce((sum, count) => sum + count, 0)} items
                </CollapsedIndicator>
              )}
            </CollapsibleSectionTitle>
            <ToggleButton onClick={(e) => {
              e.stopPropagation();
              toggleSerpSection();
            }} aria-label="Toggle SERP section">
              <span>{serpSectionCollapsed ? '▶' : '▼'}</span>
            </ToggleButton>
          </CollapsibleSectionHeader>
          
          <CollapsibleContent $isVisible={!serpSectionCollapsed}>
            {/* Energy Infrastructure */}
            <LegendSection>
              <SectionTitle>⚡ Energy & Utilities</SectionTitle>
              {serpLegendData.energy.map((item, index) => (
                <LegendItem key={`serp-energy-${index}`}>
                  <CircleSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.icon} {item.label}</ItemLabel>
                  {serpCounts[item.category] && (
                    <ItemCount>({serpCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            {/* Core Infrastructure */}
            <LegendSection>
              <SectionTitle>🏗️ Core Infrastructure</SectionTitle>
              {serpLegendData.infrastructure.map((item, index) => (
                <LegendItem key={`serp-infra-${index}`}>
                  <CircleSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.icon} {item.label}</ItemLabel>
                  {serpCounts[item.category] && (
                    <ItemCount>({serpCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            {/* Industrial Facilities */}
            <LegendSection>
              <SectionTitle>🏭 Industrial & Manufacturing</SectionTitle>
              {serpLegendData.industrial.map((item, index) => (
                <LegendItem key={`serp-industrial-${index}`}>
                  <CircleSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.icon} {item.label}</ItemLabel>
                  {serpCounts[item.category] && (
                    <ItemCount>({serpCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            {/* Commercial & Business */}
            <LegendSection>
              <SectionTitle>🏢 Commercial & Business</SectionTitle>
              {serpLegendData.commercial.map((item, index) => (
                <LegendItem key={`serp-commercial-${index}`}>
                  <CircleSwatch style={{ backgroundColor: item.color }} />
                  <ItemLabel>{item.icon} {item.label}</ItemLabel>
                  {serpCounts[item.category] && (
                    <ItemCount>({serpCounts[item.category]})</ItemCount>
                  )}
                </LegendItem>
              ))}
            </LegendSection>

            <LegendSection>
              <SectionTitle>Search Area</SectionTitle>
              {serpLegendData.search.map((item, index) => (
                <LegendItem key={`serp-search-${index}`}>
                  <LineSwatch style={{ 
                    backgroundColor: item.color, 
                    border: '1px dashed #8b5cf6',
                    opacity: 0.6
                  }} />
                  <ItemLabel>{item.label}</ItemLabel>
                </LegendItem>
              ))}
            </LegendSection>
          </CollapsibleContent>
        </LegendSection>
      )}
    </LegendContainerWrapper>
  );
});

OSMLegend.displayName = 'OSMLegend';

export default OSMLegend;
