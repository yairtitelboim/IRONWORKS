/**
 * InfrastructureSummaryTable - Houston real estate properties table component
 * 
 * This component renders the "ALL" category table with Houston real estate data
 * and handles table row clicks for map integration.
 */

import React, { useState, useCallback, useEffect } from 'react';
import AnimatedTableRow from './AnimatedTableRow';

const InfrastructureSummaryTable = ({ 
  nodes, 
  onTableRowClick, 
  nodeAnimation, 
  animationConfig = {},
  onDetailToggle = null // New prop for detail toggle callback
}) => {
  // State for selected row
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [highlightedRowId, setHighlightedRowId] = useState(null);

  // Function to find matching table row based on marker data
  const findMatchingTableRow = useCallback((markerData) => {
    if (!markerData || !nodes) return null;
    
    // Try to match by ID first (most reliable)
    if (markerData.id) {
      const idMatch = nodes.find(node => node.id === markerData.id);
      if (idMatch) return idMatch;
    }
    
    // Try to match by name/title
    const nameMatch = nodes.find(node => 
      node.name && (markerData.name || markerData.title) && 
      node.name.toLowerCase().includes((markerData.name || markerData.title).toLowerCase())
    );
    
    if (nameMatch) return nameMatch;
    
    // Try to match by category/type
    const categoryMatch = nodes.find(node => 
      node.type && markerData.category && 
      node.type.toLowerCase().includes(markerData.category.toLowerCase())
    );
    
    if (categoryMatch) return categoryMatch;
    
    // Try to match by address if available
    if (markerData.address) {
      const addressMatch = nodes.find(node => 
        node.address && node.address.toLowerCase().includes(markerData.address.toLowerCase())
      );
      
      if (addressMatch) return addressMatch;
    }
    
    return null;
  }, [nodes]);

  // Listen for marker clicks to highlight corresponding table rows
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleMarkerClicked = (markerData) => {
      // Table received marker click
      
      // Try to find matching table row based on marker data
      const matchingNode = findMatchingTableRow(markerData);
      
      if (matchingNode) {
        // Found matching table row
        setHighlightedRowId(matchingNode.id);
        setSelectedRowId(matchingNode.id);
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedRowId(null);
        }, 3000);
      } else {
        console.log('🎯 No matching table row found for marker:', markerData);
      }
    };

    const unsubscribe = window.mapEventBus.on('marker:clicked', handleMarkerClicked);
    
    return () => {
      unsubscribe();
    };
  }, [findMatchingTableRow]);

  // Handle table row click with animation and selection
  const handleRowClick = (node) => {
    if (selectedRowId === node.id) {
      // Second click on selected row - toggle expansion
      const newExpandedId = expandedRowId === node.id ? null : node.id;
      setExpandedRowId(newExpandedId);
    } else {
      // First click - select the row (change background color)
      setSelectedRowId(node.id);
      // Don't expand on first click
      setExpandedRowId(null);
    }
    
    // Call the original table row click handler
    if (onTableRowClick) {
      onTableRowClick(node);
    }

    // Emit event to highlight corresponding map marker and trigger popup
    if (window.mapEventBus) {
      // Ensure coordinates are in the correct format [lng, lat]
      let coordinates = node.geometry?.coordinates || node.coordinates;
      
      // Handle different geometry types
      if (coordinates) {
        // If it's an object with lng/lat properties
        if (typeof coordinates === 'object' && !Array.isArray(coordinates) && coordinates.lng && coordinates.lat) {
        coordinates = [coordinates.lng, coordinates.lat];
        }
        // If it's an array
        else if (Array.isArray(coordinates)) {
          // For Point geometry: [lng, lat]
          if (coordinates.length === 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
            coordinates = coordinates;
          }
          // For LineString: [[lng, lat], [lng, lat], ...] - take first point
          else if (coordinates.length > 0 && Array.isArray(coordinates[0]) && coordinates[0].length === 2) {
            coordinates = coordinates[0];
          }
          // For Polygon: [[[lng, lat], ...], ...] - take first point of first ring
          else if (coordinates.length > 0 && Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && coordinates[0][0].length === 2) {
            coordinates = coordinates[0][0];
          }
          // Invalid format
          else {
            console.warn('⚠️ InfrastructureSummaryTable: Invalid coordinates format:', coordinates);
            coordinates = null;
          }
        }
        // Invalid format
        else {
          console.warn('⚠️ InfrastructureSummaryTable: Invalid coordinates type:', typeof coordinates, coordinates);
          coordinates = null;
        }
      }
      
      console.log('🎯 InfrastructureSummaryTable: Emitting table:rowClicked event with data:', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type || node.category,
        nodeData: node,
        coordinates: coordinates
      });
      
      window.mapEventBus.emit('table:rowClicked', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type || node.category,
        nodeData: node,
        coordinates: coordinates
      });
      
      // Also emit a specific event for real estate markers to trigger popup
      if (node.propertyType || node.category) {
        console.log('🏠 Emitting real estate marker click event for popup trigger');
        window.mapEventBus.emit('realEstate:markerClick', {
          nodeId: node.id,
          nodeName: node.name,
          category: node.category,
          categoryColor: node.color,
          propertyType: node.propertyType,
          price: node.price,
          squareFootage: node.squareFootage,
          bedrooms: node.bedrooms,
          address: node.address,
          zipCode: node.zipCode,
          scrapedAt: node.scrapedAt,
          coordinates: coordinates,
          nodeData: node,
          formatter: 'realEstate' // Ensure formatter is set for proper popup sizing
        });
      }
      
      // Direct map navigation for real estate data
      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        console.log('🗺️ Navigating map to coordinates:', coordinates);
        
        // Try multiple ways to get the map instance
        let mapInstance = null;
        
        // Method 1: Check global mapComponent reference
        if (window.mapComponent && window.mapComponent.map) {
          mapInstance = window.mapComponent.map;
        }
        // Method 2: Check if map is stored in a global variable
        else if (window.mapInstance) {
          mapInstance = window.mapInstance;
        }
        // Method 3: Try to get map from the global map ref
        else if (window.mapRef && window.mapRef.current) {
          mapInstance = window.mapRef.current;
        }
        
        if (mapInstance && typeof mapInstance.flyTo === 'function') {
          mapInstance.flyTo({
            center: coordinates,
            zoom: Math.max(mapInstance.getZoom(), 14), // Ensure minimum zoom level
            duration: 1000,
            essential: true
          });
          console.log('✅ Map navigation completed');
        } else {
          console.warn('⚠️ Map instance not available for navigation. Available:', {
            mapComponent: !!window.mapComponent?.map,
            mapInstance: !!window.mapInstance,
            mapRef: !!window.mapRef?.current
          });
        }
      } else {
        console.warn('⚠️ Invalid coordinates for map navigation:', coordinates);
      }
    }
  };

  // Handle detail toggle
  const handleDetailToggle = useCallback((nodeId, isExpanded, nodeData) => {
    if (isExpanded === 'expand') {
      // Find the actual node data to pass along
      const actualNodeData = nodeData || nodes.find(node => node.id === nodeId);
      // Handle expand action - pass to parent with nodeData
      if (onDetailToggle) {
        onDetailToggle(nodeId, isExpanded, actualNodeData);
      }
    } else {
      // Handle normal toggle
      setExpandedRowId(isExpanded ? nodeId : null);
      if (onDetailToggle) {
        onDetailToggle(nodeId, isExpanded, nodeData);
      }
    }
  }, [onDetailToggle, nodes]);
  // Define table columns for Houston real estate properties
  const columns = [
    {
      key: 'address',
      align: 'left',
      color: '#ffffff',
      fontWeight: '500',
      render: (node) => {
        // Clean up Houston addresses by removing redundant "Houston, TX" text
        let address = node.address || node.name || 'Property Address';
        
        if (typeof address === 'string') {
          // Remove common Houston, TX variations
          address = address
            .replace(/,?\s*Houston,?\s*TX\s*,?/gi, '')
            .replace(/,?\s*Houston,?\s*Texas\s*,?/gi, '')
            .replace(/,?\s*Houston\s*,?/gi, '')
            .replace(/\s*,\s*$/, '') // Remove trailing comma
            .replace(/^\s*,\s*/, '') // Remove leading comma
            .trim();
        }
        
        return (
          <span style={{
            fontSize: '10px',
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block'
          }}>
            {address}
          </span>
        );
      }
    },
    {
      key: 'propertyType',
      align: 'left',
      color: '#d1d5db',
      render: (node) => {
        // Always use the mapped category (clean, user-friendly) instead of raw propertyType
        let propertyType = node.category || 'Property';
        
        // Clean up the property type string
        if (typeof propertyType === 'string') {
          // Remove any extra whitespace and ensure single value
          propertyType = propertyType.trim();
          
          // If it contains multiple values separated by comma or other delimiters, take the first one
          if (propertyType.includes(',')) {
            propertyType = propertyType.split(',')[0].trim();
          }
          if (propertyType.includes('|')) {
            propertyType = propertyType.split('|')[0].trim();
          }
          if (propertyType.includes(';')) {
            propertyType = propertyType.split(';')[0].trim();
          }
        }
        
        // Ensure we only return a single span element
        return (
          <span 
            key={`property-type-${node.id}`}
            style={{
              fontSize: '9px',
              background: node.color || '#6b7280',
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '500',
              marginLeft: '-70px',
              display: 'inline-block'
            }}
          >
            {propertyType}
          </span>
        );
      }
    }
  ];

  return (
    <div>
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '11px'
        }}>
          <thead className="table-header-gradient" style={{
            background: '#6b7280'
          }}>
            <tr>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Address
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ marginLeft: '-40px' }}>Type</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, index) => (
              <AnimatedTableRow
                key={node.id}
                node={node}
                index={index}
                columns={columns}
                onTableRowClick={handleRowClick}
                nodeAnimation={nodeAnimation}
                animationConfig={animationConfig}
                isSelected={selectedRowId === node.id}
                isExpanded={expandedRowId === node.id}
                isHighlighted={highlightedRowId === node.id}
                onDetailToggle={handleDetailToggle}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Key Insights */}
      <div className="insight-card" style={{
        marginTop: '20px',
        padding: '12px'
      }}>
        <div style={{
          fontSize: '9.6px', // 20% smaller than 12px
          fontWeight: '600',
          color: '#60a5fa',
          marginBottom: '8px'
        }}>
          Houston Real Estate Insights
        </div>
        <div style={{
          fontSize: '8.8px', // 20% smaller than 11px
          color: '#d1d5db',
          lineHeight: '1.4'
        }}>
          • <strong>Property Types:</strong> Mix of residential and commercial properties<br/>
          • <strong>Location Coverage:</strong> Downtown Houston real estate inventory<br/>
          • <strong>Market Data:</strong> Live property listings and availability
        </div>
      </div>
    </div>
  );
};

export default InfrastructureSummaryTable;

