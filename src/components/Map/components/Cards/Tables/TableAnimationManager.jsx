/**
 * TableAnimationManager - Manages animations for table components
 * 
 * This component provides animation management for table interactions,
 * including row highlighting, scroll effects, and map integration.
 */

import React, { useCallback, useEffect } from 'react';

const TableAnimationManager = ({ 
  tableData, 
  nodeAnimation, 
  onTableRowClick 
}) => {
  // Calculate distance between two coordinates
  const calculateDistance = useCallback((coord1, coord2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  }, []);

  // Extract coordinates from node content
  const extractCoordinatesFromNode = useCallback((node) => {
    const coordRegex = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/g;
    const matches = [...node.content.matchAll(coordRegex)];
    
    if (matches.length > 0) {
      const lat = parseFloat(matches[0][1]);
      const lng = parseFloat(matches[0][2]);
      return [lng, lat]; // [longitude, latitude] format for Mapbox
    }
    
    return null;
  }, []);

  // Find matching table node based on legend marker data
  const findMatchingTableNode = useCallback((markerData, category, coordinates) => {
    if (!tableData || !Array.isArray(tableData)) {
      return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    // Search through all available table nodes
    tableData.forEach((node, index) => {
      let score = 0;

      // 1. Coordinate matching (highest priority)
      if (coordinates && node.content) {
        const nodeCoordinates = extractCoordinatesFromNode(node);
        if (nodeCoordinates) {
          const distance = calculateDistance(coordinates, nodeCoordinates);
          
          if (distance < 0.5) { // Within 0.5 miles
            score += 50;
          } else if (distance < 2) { // Within 2 miles
            score += 25;
          }
        }
      }

      // 2. Name matching
      const markerName = (markerData.title || '').toLowerCase();
      const nodeName = node.name.toLowerCase();
      
      // Direct name matching
      if (markerName.includes(nodeName.split(' ')[0]) || nodeName.includes(markerName.split(' ')[0])) {
        score += 30;
      }

      // 3. Category-based matching
      const nodeType = node.type.toLowerCase();
      
      if (category === 'power plants' && (nodeType.includes('power') || nodeType.includes('plant'))) {
        score += 20;
      }
      if (category === 'electric utilities' && (nodeType.includes('substation') || nodeType.includes('transmission'))) {
        score += 20;
      }
      if (category === 'data centers' && nodeType.includes('data')) {
        score += 20;
      }

      // Update best match if this score is higher
      if (score > bestScore) {
        bestScore = score;
        bestMatch = node;
      }
    });

    if (bestMatch && bestScore >= 20) { // Minimum threshold for a valid match
      return bestMatch;
    }

    return null;
  }, [tableData, extractCoordinatesFromNode, calculateDistance]);

  // Highlight the matching table row
  const highlightTableRow = useCallback((node) => {
    const tableRow = document.querySelector(`[data-node-id="${node.id}"]`);
    if (tableRow) {
      tableRow.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      tableRow.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      tableRow.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.3)';
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        tableRow.style.backgroundColor = '';
        tableRow.style.border = '';
        tableRow.style.boxShadow = '';
      }, 3000);
    }
  }, []);

  // Scroll to the table row if it's visible
  const scrollToTableRow = useCallback((node) => {
    const tableRow = document.querySelector(`[data-node-id="${node.id}"]`);
    if (tableRow) {
      tableRow.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, []);

  // Listen for legend item clicks to highlight corresponding table rows
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleLegendItemSelected = (legendBridgeData) => {
      const { markerData, actualCategory, coordinates } = legendBridgeData;
      
      // Find matching table node based on the legend selection
      const matchingTableNode = findMatchingTableNode(markerData, actualCategory, coordinates);
      
      if (matchingTableNode) {
        // Highlight the matching table row
        highlightTableRow(matchingTableNode);
        
        // Scroll to the table row if it's visible
        scrollToTableRow(matchingTableNode);
      }
    };

    window.mapEventBus.on('legend:itemSelected', handleLegendItemSelected);

    return () => {
      window.mapEventBus.off('legend:itemSelected', handleLegendItemSelected);
    };
  }, [tableData, findMatchingTableNode, highlightTableRow, scrollToTableRow]);

  // This component doesn't render anything, it just manages animations
  return null;
};

export default TableAnimationManager;
