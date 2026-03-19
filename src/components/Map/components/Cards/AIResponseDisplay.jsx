import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatResponseText, processFullResponse } from './textUtils';

const AIResponseDisplay = ({ 
  response, 
  citations = [], 
  maxHeight = 300, // Fixed height for the container
  showTruncation = true, // Whether to show truncation with [...]
  truncationLength = 200, // Characters to show before truncating
  onResponseExpandedChange = null, // Callback for parent component to track expansion state
  onSourcesExpandedChange = null, // Callback for parent component to track sources expansion state
  isLoading = false, // New prop for loading state
  onCollapseClick = null, // New prop for collapse functionality
  showCollapseButton = false, // New prop to control when to show collapse button
  selectedMarker = null, // Marker data when marker is clicked
  showMarkerDetails = false, // Toggle between Claude response and marker details
  onBackToAnalysis = null, // Callback to return to Claude response
  // NEW PROPS FOR TABLE RENDERING (Phase 1)
  renderMode = 'text', // 'text' | 'table' - backward compatible, defaults to text
  tableData = null, // Structured data for tables
  category = 'all' // Current category for table type
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [expandedTable, setExpandedTable] = useState(null); // Track which table is expanded

  // Calculate distance between two coordinates (same as LegendContainer)
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
    // Look for coordinate patterns in node content
    const coordRegex = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/g;
    const matches = [...node.content.matchAll(coordRegex)];
    
    if (matches.length > 0) {
      // Return the first coordinate pair found
      const lat = parseFloat(matches[0][1]);
      const lng = parseFloat(matches[0][2]);
      return [lng, lat]; // [longitude, latitude] format for Mapbox
    }
    
    // Fallback: try to extract from node name or type
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
    // Add a visual highlight to the table row
    // This could be implemented with CSS classes or inline styles
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

  // Show skeleton loading when isLoading is true
  if (isLoading) {
    return (
      <div style={{
        maxHeight: `${maxHeight}px`,
        overflow: 'hidden',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        width: '100%',
        maxWidth: '320px',
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {/* Skeleton Loading Animation */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Skeleton lines */}
          {[1, 2, 3, 4, 5].map((line) => (
            <div
              key={line}
              style={{
                height: '16px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                marginBottom: line === 5 ? '0' : '12px',
                width: line === 1 ? '90%' : line === 2 ? '85%' : line === 3 ? '70%' : line === 4 ? '60%' : '40%',
                animation: 'skeletonPulse 1.5s ease-in-out infinite',
                animationDelay: `${line * 0.1}s`
              }}
            />
          ))}
          
          {/* Shimmer effect overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'skeletonShimmer 2s ease-in-out infinite',
            pointerEvents: 'none'
          }} />
        </div>
      </div>
    );
  }

  if (!response) return null;

  // Handle case where response might be React elements
  if (typeof response !== 'string') {
      return (
    <div style={{
      maxHeight: `${maxHeight}px`,
      overflow: 'auto',
      padding: '16px',
      borderRadius: '12px',
      marginBottom: '2px',
      width: '100%',
      maxWidth: '320px',
      position: 'relative'
    }}>
        {response}
      </div>
    );
  }

  // Check if response needs truncation
  const needsTruncation = response.length > truncationLength && showTruncation;
  
  // Handle response expansion state change
  const handleExpansionChange = (expanded) => {
    setIsExpanded(expanded);
    if (onResponseExpandedChange) {
      onResponseExpandedChange(expanded);
    }
  };

  // Render response with clickable citations, bold formatting, and clickable dots
  const renderResponseWithCitations = (responseText, citations) => {
    if (!responseText) return null;
    
    // Handle case where responseText might be React elements
    if (typeof responseText !== 'string') {
      return responseText;
    }
    
    if (!citations || citations.length === 0) {
      // No citations, just format bold text and add clickable dots if truncated
      return (
        <>
          {formatResponseText(responseText)}
          {!isExpanded && responseText.includes('...') && (
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontWeight: '600',
                marginLeft: '2px'
              }}
              onClick={() => handleExpansionChange(true)}
              onMouseEnter={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              title="Click to show full response"
            >
              ...
            </span>
          )}
        </>
      );
    }
    
    // Handle truncated text with clickable dots
    if (responseText.includes('...')) {
      if (!isExpanded) {
        // Show truncated version with clickable dots
        const lastDotIndex = responseText.lastIndexOf('...');
        if (lastDotIndex !== -1) {
          // Get text before dots
          const beforeDots = responseText.substring(0, lastDotIndex);
          
          // Process the text before dots
          const beforeDotsParts = beforeDots.split(/(\[\d+\])/g);
          const beforeDotsFormatted = beforeDotsParts.map((part, index) => {
            const citationMatch = part.match(/\[(\d+)\]/);
            if (citationMatch) {
              const citationNumber = citationMatch[1];
              const citationIndex = parseInt(citationNumber) - 1;
              const citation = citations[citationIndex];
              
              if (citation) {
                const url = typeof citation === 'string' ? citation : citation.url;
                return (
                  <span
                    key={`citation-before-${index}`}
                    style={{
                      color: '#60a5fa',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: '600',
                      padding: '0px 1px',
                      margin: '0px'
                    }}
                    title={url ? `Click to open: ${url}` : `Source ${citationNumber}`}
                    onClick={() => {
                      if (url) {
                        window.open(url, '_blank');
                      }
                    }}
                  >
                    {part}
                  </span>
                );
              }
            }
            return formatResponseText(part);
          });
          
          // Flatten the before dots parts
          const beforeDotsFlattened = [];
          beforeDotsFormatted.forEach((part) => {
            if (Array.isArray(part)) {
              beforeDotsFlattened.push(...part);
            } else {
              beforeDotsFlattened.push(part);
            }
          });
          
          // Add clickable dots
          beforeDotsFlattened.push(
            <span
              key="clickable-dots"
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontWeight: '600',
                marginLeft: '2px'
              }}
              onClick={() => handleExpansionChange(true)}
              onMouseEnter={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              title="Click to show full response"
            >
              ...
            </span>
          );
          
          return beforeDotsFlattened;
        }
      } else {
        // Show full response when expanded
        return processFullResponse(responseText, citations);
      }
    }
    
    // If no dots, process normally
    return processFullResponse(responseText, citations);
  };

  // Get truncated text if needed
  const getTruncatedText = () => {
    if (!needsTruncation) return response;
    
    const truncated = response.substring(0, truncationLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    // Try to truncate at a word boundary
    if (lastSpaceIndex > truncationLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex);
    }
    
    return truncated;
  };

  // Render truncated view with clickable dots
  const renderTruncatedView = () => {
    const truncatedText = getTruncatedText();
    
    return (
      <>
        {formatResponseText(truncatedText)}
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            fontWeight: '600',
            marginLeft: '2px',
            transition: 'color 0.2s ease'
          }}
          onClick={() => handleExpansionChange(true)}
          onMouseEnter={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
          }}
          title="Click to show full response"
        >
          ...
        </span>
      </>
    );
  };

  // Render full view with scroll
  const renderFullView = () => {
    if (citations && citations.length > 0) {
      return processFullResponse(response, citations);
    }
    
    return formatResponseText(response);
  };

  // Render marker details view
  const renderMarkerDetails = () => {
    if (!selectedMarker) return null;

    return (
      <div style={{
        lineHeight: '1.6',
        color: '#e5e7eb',
        fontSize: '14px'
      }}>
        <div style={{
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
          }}>
            {selectedMarker.title}
          </h3>
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '12px',
            marginBottom: '4px'
          }}>
            {selectedMarker.category} • {selectedMarker.distance} miles from Whitney site
          </div>
        </div>

        {selectedMarker.address && selectedMarker.address !== 'No address available' && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Address:</strong>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
              {selectedMarker.address}
            </div>
          </div>
        )}

        {selectedMarker.rating && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Rating:</strong>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
              ⭐ {selectedMarker.rating}
            </div>
          </div>
        )}

        {selectedMarker.phone && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Phone:</strong>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
              {selectedMarker.phone}
            </div>
          </div>
        )}

        {selectedMarker.website && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Website:</strong>
            <div style={{ marginTop: '2px' }}>
              <a 
                href={selectedMarker.website} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#60a5fa',
                  textDecoration: 'underline',
                  fontSize: '13px'
                }}
              >
                {selectedMarker.website}
              </a>
            </div>
          </div>
        )}

        {selectedMarker.description && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Description:</strong>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
              {selectedMarker.description}
            </div>
          </div>
        )}

        {selectedMarker.hours && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#ffffff' }}>Hours:</strong>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '2px' }}>
              {selectedMarker.hours}
            </div>
          </div>
        )}

        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          Coordinates: {selectedMarker.coordinates[1].toFixed(4)}, {selectedMarker.coordinates[0].toFixed(4)}
        </div>
      </div>
    );
  };

  // ===== PHASE 1: TABLE RENDERING FUNCTIONS =====
  
  // Table-Legend Bridge: Handle table row clicks
  const handleTableRowClick = (node) => {
    // Extract coordinates from node content if available
    const coordinates = extractCoordinatesFromNode(node);

    // Create bridge data for legend matching
    const bridgeData = {
      tableNode: node,
      coordinates: coordinates,
      searchTerms: generateSearchTerms(node),
      timestamp: Date.now()
    };

    // Emit event to legend/map system
    if (window.mapEventBus) {
      window.mapEventBus.emit('table:nodeSelected', bridgeData);
    } else {
      console.warn('⚠️ mapEventBus not available');
    }
  };




  // Generate search terms for matching with legend data
  const generateSearchTerms = (node) => {
    const terms = [];
    
    // Add node name words
    if (node.name) {
      terms.push(...node.name.toLowerCase().split(' '));
    }
    
    // Add type-based terms
    if (node.type) {
      const type = node.type.toLowerCase();
      if (type.includes('power') || type.includes('plant')) {
        terms.push('power', 'plant', 'generation');
      }
      if (type.includes('substation') || type.includes('transmission')) {
        terms.push('substation', 'transmission', 'electric', 'utility');
      }
      if (type.includes('water') || type.includes('utility')) {
        terms.push('water', 'utility', 'municipal');
      }
      if (type.includes('data') || type.includes('center')) {
        terms.push('data', 'center', 'facility');
      }
    }
    
    return [...new Set(terms)]; // Remove duplicates
  };
  
  // Parse Perplexity response into structured data for tables
  const parseTableData = (response) => {
    if (!response || typeof response !== 'string') return [];
    
    const nodes = [];
    const nodeRegex = /## NODE (\d+): \*\*(.*?)\*\*/g;
    let match;
    
    while ((match = nodeRegex.exec(response)) !== null) {
      const nodeNumber = match[1];
      const nodeName = match[2];
      
      // Extract data for this node
      const nodeStart = match.index;
      const remainingText = response.substring(nodeStart + match[0].length);
      const nextNodeMatch = /## NODE (\d+): \*\*(.*?)\*\*/.exec(remainingText);
      const nodeEnd = nextNodeMatch ? nodeStart + match[0].length + nextNodeMatch.index : response.length;
      
      const nodeContent = response.substring(nodeStart, nodeEnd);
      
      // Updated regex patterns to match the actual Perplexity response format
      const typeMatch = nodeContent.match(/\*\*Type:\*\* (.+?)(?:\s*\(|$)/);
      
      // Try to match numeric scores first, then fallback to "Data not available"
      const powerScoreMatch = nodeContent.match(/\*\*1\. POWER SCORE:\*\* \*\*(\d+)\/10\*\*/) || 
                             nodeContent.match(/\*\*1\. POWER SCORE:\*\* (\d+)\/10/) ||
                             nodeContent.match(/\*\*1\. POWER SCORE:\*\* \*\*(\d+)\/10\*\*/);
      const stabilityScoreMatch = nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* \*\*(\d+)\/10\*\*/) || 
                                 nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* (\d+)\/10/) ||
                                 nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* \*\*(\d+)\/10\*\*/);
      const capacityMatch = nodeContent.match(/\*\*Nameplate Capacity:\*\* \*\*(.+?)\*\*/) ||
                           nodeContent.match(/\*\*Nameplate Capacity:\*\* (.+?)(?:\s*\[|\n|$)/) ||
                           nodeContent.match(/\*\*Nameplate Capacity:\*\* \*(.+?)\*/);
      
      // Extract resilience and redundancy data from the new format
      const resilienceMatch = nodeContent.match(/\*\*Weather Resilience:\*\* \*(.+?)\*/) ||
                             nodeContent.match(/\*\*Weather Resilience:\*\* (.+?)(?:\n|$)/) ||
                             nodeContent.match(/\*\*Reliability Metrics:\*\* \*(.+?)\*/) ||
                             nodeContent.match(/\*\*Reliability Metrics:\*\* (.+?)(?:\n|$)/);
      const redundancyDataMatch = nodeContent.match(/\*\*Transmission Redundancy:\*\* \*(.+?)\*/) ||
                                 nodeContent.match(/\*\*Transmission Redundancy:\*\* (.+?)(?:\n|$)/) ||
                                 nodeContent.match(/\*\*Power Availability:\*\* \*(.+?)\*/) ||
                                 nodeContent.match(/\*\*Power Availability:\*\* (.+?)(?:\n|$)/);
      
      // Use stability score as power score if available, otherwise use power score
      const finalPowerScore = stabilityScoreMatch ? parseInt(stabilityScoreMatch[1]) : 
                             (powerScoreMatch ? parseInt(powerScoreMatch[1]) : 0);
      
      // Determine risk level based on power score (primary method)
      let riskLevel = 'N/A';
      const score = finalPowerScore;
      if (score >= 8) {
        riskLevel = 'Low';
      } else if (score >= 5) {
        riskLevel = 'Medium';
      } else if (score > 0) {
        riskLevel = 'High';
      } else {
        riskLevel = 'High'; // Default to High for 0 scores
      }
      
      const nodeData = {
        id: nodeNumber,
        name: nodeName,
        type: typeMatch ? typeMatch[1].trim() : 'Unknown',
        powerScore: finalPowerScore,
        risk: riskLevel,
        capacity: capacityMatch ? capacityMatch[1].trim() : 'N/A',
        queueDepth: 'N/A', // Not available in this response format
        resilience: resilienceMatch ? resilienceMatch[1].trim() : 'N/A',
        redundancy: redundancyDataMatch ? redundancyDataMatch[1].trim() : 'N/A',
        content: nodeContent
      };
      
      nodes.push(nodeData);
    }
    
    return nodes;
  };

  // Get type abbreviation for display
  const getTypeAbbreviation = (type) => {
    if (type.includes('Power Plant') || type.includes('Hydroelectric')) return 'PWR';
    if (type.includes('Substation')) return 'TXM';
    if (type.includes('Data Center')) return 'DST';
    if (type.includes('Water')) return 'UTL';
    return 'UNK';
  };

  // Filter nodes by category
  const filterNodesByCategory = (nodes, category) => {
    if (category === 'all') return nodes;
    
    const keywords = {
      'pwr': ['Power Plant', 'Coal-fired', 'Generation', 'plant', 'Hydroelectric'],
      'trn': ['Substation', 'Transmission', '345 kV', '138 kV', 'Grid'],
      'utl': ['Water Supply', 'Water Treatment', 'Utility', 'Municipal'],
      'risk': ['Weather', 'Resilience', 'Redundancy', 'Risk', 'Vulnerable']
    };
    
    const categoryKeywords = keywords[category] || [];
    let filteredNodes = nodes.filter(node => 
      categoryKeywords.some(keyword => 
        node.content.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Additional filtering for specific categories
    if (category === 'utl') {
      filteredNodes = filteredNodes.filter(node => 
        node.type.includes('Water') || 
        node.type.includes('Utility')
      );
    }
    if (category === 'trn') {
      filteredNodes = filteredNodes.filter(node => 
        node.type.includes('Substation') || 
        node.type.includes('Transmission')
      );
    }
    if (category === 'pwr') {
      filteredNodes = filteredNodes.filter(node => 
        node.type.includes('Power Plant') || 
        node.type.includes('Generation') ||
        node.type.includes('Hydroelectric')
      );
    }

    return filteredNodes;
  };

  // Render infrastructure summary table (ALL category)
  const renderInfrastructureSummaryTable = (nodes) => {
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
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Node</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Type</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  data-node-id={node.id}
                  className="table-row-hover" 
                  onClick={() => handleTableRowClick(node)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    animationDelay: `${index * 0.1}s`,
                    animation: 'slideInFromLeft 0.5s ease-out',
                    cursor: 'pointer'
                  }}
                >
                  <td style={{ padding: '8px 6px', color: '#ffffff', fontWeight: '500' }}>{node.id}</td>
                  <td style={{ padding: '8px 6px', color: '#d1d5db' }}>{getTypeAbbreviation(node.type)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{node.powerScore}/10</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.risk === 'Low' ? '#10b981' : node.risk === 'Medium' ? '#f59e0b' : '#ef4444', fontWeight: '500' }}>{node.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Key Insights */}
        <div className="insight-card" style={{
          marginTop: '16px',
          padding: '12px'
        }}>
      <div style={{
            fontSize: '9.6px', // 20% smaller than 12px
            fontWeight: '600',
            color: '#60a5fa',
            marginBottom: '8px'
          }}>
            Key Insights
      </div>
          <div style={{
            fontSize: '8.8px', // 20% smaller than 11px
            color: '#d1d5db',
            lineHeight: '1.4'
          }}>
            • <strong>Primary Recommendation:</strong> Node 2 (Whitney Substation) - Highest score, lowest risk<br/>
            • <strong>Capacity Leader:</strong> Node 1 (Whitney Power Plant) - 1,200 MW available<br/>
            • <strong>Queue Status:</strong> 1.8-4.1 years across all nodes
          </div>
        </div>
      </div>
    );
  };

  // Render power generation table (PWR category)
  const renderPowerTable = (nodes) => {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '13.25px', // 15% larger than 11.52px
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'left',
            flex: 1
          }}>
            Power Generation Analysis
          </div>
          <button
            onClick={() => setExpandedTable('pwr')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            title="Expand table"
          >
            ⛶
          </button>
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.8px' // 20% smaller than 11px
          }}>
            <thead style={{
              background: 'linear-gradient(135deg, #ef4444, #f59e0b)'
            }}>
              <tr>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Plant</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Capacity</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Efficiency</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Queue</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  data-node-id={node.id}
                  className="table-row-hover" 
                  onClick={() => handleTableRowClick(node)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                  <td style={{ padding: '8px 6px', color: '#ffffff', fontWeight: '500' }}>{node.name.split(' ')[0]}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>{node.capacity}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{node.powerScore}/10</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: '#d1d5db' }}>{node.queueDepth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Power Insights */}
        <div className="insight-card" style={{
          marginTop: '16px',
          padding: '12px'
        }}>
          <div style={{
            fontSize: '7.68px', // 20% smaller than 9.6px
            fontWeight: '600',
            color: '#fca5a5',
            marginBottom: '8px'
          }}>
            Power Generation Insights
          </div>
          <div style={{
            fontSize: '7.04px', // 20% smaller than 8.8px
            color: '#d1d5db',
            lineHeight: '1.4'
          }}>
            • <strong>Total Capacity:</strong> {nodes.reduce((sum, node) => {
              const match = node.content.match(/\*\*Available Capacity:\*\* (.+?)(?:\n|$)/);
              return sum + (match ? parseInt(match[1]) : 0);
            }, 0)} MW across {nodes.length} plants<br/>
            • <strong>Efficiency Range:</strong> {Math.min(...nodes.map(n => n.powerScore))}-{Math.max(...nodes.map(n => n.powerScore))}/10<br/>
            • <strong>Queue Pressure:</strong> {nodes.map(node => node.queueDepth).join(', ')} average wait time
          </div>
        </div>
      </div>
    );
  };

  // Render transmission table (TRN category)
  const renderTransmissionTable = (nodes) => {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '13.25px', // 15% larger than 11.52px
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'left',
            flex: 1
          }}>
            Transmission & Grid Analysis
          </div>
          <button
            onClick={() => setExpandedTable('trn')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            title="Expand table"
          >
            ⛶
          </button>
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.8px' // 20% smaller than 11px
          }}>
            <thead style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
            }}>
              <tr>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Node</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Type</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Voltage</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Capacity</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  data-node-id={node.id}
                  className="table-row-hover" 
                  onClick={() => handleTableRowClick(node)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                  <td style={{ padding: '8px 6px', color: '#ffffff', fontWeight: '500' }}>{node.id}</td>
                  <td style={{ padding: '8px 6px', color: '#d1d5db' }}>{getTypeAbbreviation(node.type)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: '#d1d5db' }}>
                    {node.content.includes('345 kV') ? '345 kV' : 
                     node.content.includes('138 kV') ? '138 kV' : 
                     node.content.includes('69 kV') ? '69 kV' : 'N/A'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>{node.capacity}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{node.powerScore}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Transmission Insights */}
        <div className="insight-card" style={{
          marginTop: '16px',
          padding: '12px'
        }}>
          <div style={{
            fontSize: '7.68px', // 20% smaller than 9.6px
            fontWeight: '600',
            color: '#60a5fa',
            marginBottom: '8px'
          }}>
            Transmission Insights
          </div>
          <div style={{
            fontSize: '7.04px', // 20% smaller than 8.8px
            color: '#d1d5db',
            lineHeight: '1.4'
          }}>
            • <strong>Grid Integration:</strong> {nodes.filter(n => n.type.includes('Substation')).length} substations, {nodes.filter(n => n.type.includes('Transmission')).length} transmission lines<br/>
            • <strong>Voltage Levels:</strong> {[...new Set(nodes.map(n => 
              n.content.includes('345 kV') ? '345 kV' : 
              n.content.includes('138 kV') ? '138 kV' : 
              n.content.includes('69 kV') ? '69 kV' : null
            ).filter(Boolean))].join(', ')}<br/>
            • <strong>Reliability Score:</strong> {Math.round(nodes.reduce((sum, n) => sum + n.powerScore, 0) / nodes.length)}/10 average
          </div>
        </div>
      </div>
    );
  };

  // Render utilities table (UTL category)
  const renderUtilitiesTable = (nodes) => {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '13.25px', // 15% larger than 11.52px
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'left',
            flex: 1
          }}>
            Utilities & Infrastructure
          </div>
          <button
            onClick={() => setExpandedTable('utl')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            title="Expand table"
          >
            ⛶
          </button>
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.8px' // 20% smaller than 11px
          }}>
            <thead style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)'
            }}>
              <tr>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Node</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Utility</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Type</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Capacity</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  data-node-id={node.id}
                  className="table-row-hover" 
                  onClick={() => handleTableRowClick(node)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                  <td style={{ padding: '8px 6px', color: '#ffffff', fontWeight: '500' }}>{node.id}</td>
                  <td style={{ padding: '8px 6px', color: '#d1d5db' }}>{node.name.split(' ')[0]}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>
                    {node.type.includes('Water') ? 'Water' : 
                     node.type.includes('Electric') ? 'Electric' : 
                     node.type.includes('Utility') ? 'Utility' : 'Other'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>{node.capacity}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{node.powerScore}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Utilities Insights */}
        <div className="insight-card" style={{
          marginTop: '16px',
          padding: '12px'
        }}>
          <div style={{
            fontSize: '7.68px', // 20% smaller than 9.6px
            fontWeight: '600',
            color: '#22d3ee',
            marginBottom: '8px'
          }}>
            Utilities Insights
          </div>
          <div style={{
            fontSize: '7.04px', // 20% smaller than 8.8px
            color: '#d1d5db',
            lineHeight: '1.4'
          }}>
            • <strong>Water Infrastructure:</strong> {nodes.filter(n => n.type.includes('Water')).length} facilities<br/>
            • <strong>Electric Utilities:</strong> {nodes.filter(n => n.type.includes('Electric')).length} providers<br/>
            • <strong>Service Coverage:</strong> {nodes.length} total utility nodes in analysis area
          </div>
        </div>
      </div>
    );
  };

  // Render risk analysis table (RISK category)
  const renderRiskTable = (nodes) => {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '11.93px', // 15% larger than 10.37px
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'left',
            flex: 1
          }}>
            Risk & Resilience Analysis
          </div>
          <button
            onClick={() => setExpandedTable('risk')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              marginLeft: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            title="Expand table"
          >
            ⛶
          </button>
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '7.92px' // 10% smaller than 8.8px
          }}>
            <thead style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)'
            }}>
              <tr>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Node</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Risk Level</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Resilience</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Redundancy</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', fontWeight: '600', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <tr 
                  key={node.id} 
                  data-node-id={node.id}
                  className="table-row-hover" 
                  onClick={() => handleTableRowClick(node)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                  <td style={{ padding: '8px 6px', color: '#ffffff', fontWeight: '500' }}>{node.id}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: node.risk === 'Low' ? '#10b981' : node.risk === 'Medium' ? '#f59e0b' : '#ef4444', fontWeight: '500' }}>{node.risk}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>{node.resilience}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'left', color: '#d1d5db' }}>{node.redundancy}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{node.powerScore}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Risk Insights */}
        <div className="insight-card" style={{
          marginTop: '16px',
          padding: '12px'
        }}>
          <div style={{
            fontSize: '6.91px', // 10% smaller than 7.68px
            fontWeight: '600',
            color: '#fbbf24',
            marginBottom: '8px'
          }}>
            Risk Analysis Insights
          </div>
          <div style={{
            fontSize: '6.34px', // 10% smaller than 7.04px
            color: '#d1d5db',
            lineHeight: '1.4'
          }}>
            • <strong>High Risk Nodes:</strong> {nodes.filter(n => n.risk === 'High').length} facilities require immediate attention<br/>
            • <strong>Weather Resilience:</strong> {nodes.filter(n => n.resilience && n.resilience !== 'N/A').length} nodes have resilience data<br/>
            • <strong>Redundancy Coverage:</strong> {nodes.filter(n => n.redundancy && n.redundancy !== 'N/A').length} nodes have backup systems
          </div>
        </div>
      </div>
    );
  };

  // Expanded PWR table - clean, large view
  const renderExpandedPWRTable = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    const expandedTableContent = (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '20px',
          width: '90vw',
          maxWidth: '90vw',
          maxHeight: '85vh',
      overflow: 'auto',
          position: 'relative',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Header with close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
              flex: 1
            }}>
              Power Generation & Storage Analysis
            </h2>
            <button
              onClick={() => setExpandedTable(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: '16px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              ✕ Close
            </button>
          </div>

          {/* Large, clean table */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <table style={{
              width: '100%',
              minWidth: '800px',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead style={{
                background: 'linear-gradient(135deg, #10b981, #059669)'
              }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Node</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Capacity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, index) => (
                  <tr 
                    key={node.id} 
                    data-node-id={node.id}
                    className="table-row-hover" 
                    onClick={() => handleTableRowClick(node)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'background 0.2s ease',
                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
                    }}>
                    <td style={{ padding: '12px', color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>{node.id}</td>
                    <td style={{ padding: '12px', color: '#d1d5db', fontSize: '14px' }}>
                      {node.type.includes('Solar') ? 'Solar' : 
                       node.type.includes('Wind') ? 'Wind' : 
                       node.type.includes('Battery') ? 'Battery' : 
                       node.type.includes('Power') ? 'Power' : 'Other'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>{node.capacity}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: node.status === 'Active' ? '#10b981' : node.status === 'Maintenance' ? '#f59e0b' : '#ef4444', fontWeight: '600', fontSize: '14px' }}>{node.status}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: '16px' }}>{node.powerScore}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // Render the expanded table outside the BaseCard using a portal
    return createPortal(expandedTableContent, document.body);
  };

  // Expanded RISK table - clean, large view
  const renderExpandedRISKTable = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    const expandedTableContent = (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '20px',
          width: '90vw',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          position: 'relative',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Header with close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
              flex: 1
            }}>
              Risk & Resilience Analysis
            </h2>
            <button
              onClick={() => setExpandedTable(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: '16px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              ✕ Close
            </button>
          </div>

          {/* Large, clean table */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <table style={{
              width: '100%',
              minWidth: '800px',
              borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
              <thead style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)'
              }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Node</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Risk Level</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Resilience</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Redundancy</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, index) => (
                  <tr 
                    key={node.id} 
                    data-node-id={node.id}
                    className="table-row-hover" 
                    onClick={() => handleTableRowClick(node)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'background 0.2s ease',
                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
                    }}>
                    <td style={{ padding: '12px', color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>{node.id}</td>
                    <td style={{ padding: '12px', textAlign: 'left', color: node.risk === 'Low' ? '#10b981' : node.risk === 'Medium' ? '#f59e0b' : '#ef4444', fontWeight: '600', fontSize: '14px' }}>{node.risk}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>{node.resilience}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>{node.redundancy}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: '16px' }}>{node.powerScore}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
      </div>
        </div>
      </div>
    );

    // Render the expanded table outside the BaseCard using a portal
    return createPortal(expandedTableContent, document.body);
  };

  // Expanded UTL table - clean, large view
  const renderExpandedUTLTable = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    const expandedTableContent = (
        <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
          display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '20px',
          width: '90vw',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          position: 'relative',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Header with close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
              flex: 1
            }}>
              Utilities & Infrastructure
            </h2>
          <button
              onClick={() => setExpandedTable(null)}
            style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
                color: '#ffffff',
                padding: '8px 16px',
              cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: '16px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              ✕ Close
            </button>
          </div>

          {/* Large, clean table */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <table style={{
              width: '100%',
              minWidth: '800px',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)'
              }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Node</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Utility</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Capacity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, index) => (
                  <tr 
                    key={node.id} 
                    data-node-id={node.id}
                    className="table-row-hover" 
                    onClick={() => handleTableRowClick(node)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'background 0.2s ease',
                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
                    }}>
                    <td style={{ padding: '12px', color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>{node.id}</td>
                    <td style={{ padding: '12px', color: '#d1d5db', fontSize: '14px' }}>{node.name.split(' ')[0]}</td>
                    <td style={{ padding: '12px', textAlign: 'left', color: '#d1d5db', fontSize: '14px' }}>
                      {node.type.includes('Water') ? 'Water' : 
                       node.type.includes('Electric') ? 'Electric' : 
                       node.type.includes('Utility') ? 'Utility' : 'Other'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>{node.capacity}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: '16px' }}>{node.powerScore}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // Render the expanded table outside the BaseCard using a portal
    return createPortal(expandedTableContent, document.body);
  };

  // Expanded TRN table - clean, large view
  const renderExpandedTRNTable = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    const expandedTableContent = (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '20px',
          width: '90vw',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          position: 'relative',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Header with close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
              flex: 1
            }}>
              Transmission & Grid Analysis
            </h2>
            <button
              onClick={() => setExpandedTable(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                marginLeft: '16px'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              ✕ Close
          </button>
        </div>

          {/* Large, clean table */}
        <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <table style={{
              width: '100%',
              minWidth: '800px',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead style={{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
              }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Node</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Voltage</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Capacity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ffffff', fontWeight: '700', borderBottom: '2px solid rgba(255, 255, 255, 0.2)', fontSize: '16px' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, index) => (
                  <tr 
                    key={node.id} 
                    data-node-id={node.id}
                    className="table-row-hover" 
                    onClick={() => handleTableRowClick(node)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'background 0.2s ease',
                      backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent';
                    }}>
                    <td style={{ padding: '12px', color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>{node.id}</td>
                    <td style={{ padding: '12px', textAlign: 'left', color: '#d1d5db', fontSize: '14px' }}>
                      {node.type.includes('Substation') ? 'Substation' : 
                       node.type.includes('Transmission') ? 'Transmission' : 
                       node.type.includes('Grid') ? 'Grid' : 'Other'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>
                      {node.content.includes('345 kV') ? '345 kV' : 
                       node.content.includes('138 kV') ? '138 kV' : 
                       node.content.includes('69 kV') ? '69 kV' : 'N/A'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#d1d5db', fontSize: '14px' }}>{node.capacity}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: node.powerScore >= 8 ? '#10b981' : node.powerScore >= 6 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: '16px' }}>{node.powerScore}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    // Render the expanded table outside the BaseCard using a portal
    return createPortal(expandedTableContent, document.body);
  };

  // Expanded table view component
  const renderExpandedTable = (data, category) => {
    if (!data || data.length === 0) {
      return null;
    }

    // Handle all table categories
    if (category === 'pwr') {
      return renderExpandedPWRTable(data);
    }
    
    if (category === 'risk') {
      return renderExpandedRISKTable(data);
    }
    
    if (category === 'utl') {
      return renderExpandedUTLTable(data);
    }
    
    if (category === 'trn') {
      return renderExpandedTRNTable(data);
    }

    // For other categories, show a placeholder
    const placeholderContent = (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#ffffff',
              margin: 0
            }}>
              {category.toUpperCase()} Table - Coming Soon
            </h2>
            <button
              onClick={() => setExpandedTable(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              ✕ Close
            </button>
          </div>
          <div style={{ color: '#ffffff', textAlign: 'center', padding: '40px' }}>
            Expanded view for {category.toUpperCase()} category will be available soon.
          </div>
        </div>
      </div>
    );

    return createPortal(placeholderContent, document.body);
  };

  // Main table rendering function
  const renderTable = (data, category) => {
    if (!data || data.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px',
          padding: '40px 20px'
        }}>
          No {category.toUpperCase()} infrastructure found
        </div>
      );
    }

    switch (category) {
      case 'all':
        return renderInfrastructureSummaryTable(data);
      case 'pwr':
        return renderPowerTable(data);
      case 'trn':
        return renderTransmissionTable(data);
      case 'utl':
        return renderUtilitiesTable(data);
      case 'risk':
        return renderRiskTable(data);
      default:
        return renderInfrastructureSummaryTable(data);
    }
  };

  // ===== PHASE 1: RENDER MODE LOGIC =====
  
  // Handle table rendering mode (Phase 2: All categories with enhanced styling)
  if (renderMode === 'table' && tableData) {
    // Use pre-parsed tableData if available (Phase 4 optimization)
    let filteredData = [];
    
    if (tableData && Array.isArray(tableData)) {
      filteredData = tableData; // Already filtered by CategoryToggle
    } else {
      const parsedData = parseTableData(response);
      filteredData = filterNodesByCategory(parsedData, category);
    }
    
    return (
      <>
        {/* Expanded table overlay */}
        {expandedTable && tableData && renderExpandedTable(tableData, expandedTable)}
        
        <div style={{
          maxHeight: `${maxHeight}px`,
          overflow: 'auto',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '2px',
          marginTop: '0px',
          width: '100%',
          maxWidth: category === 'risk' ? '280px' : '320px', // Smaller width for Risk category
          position: 'relative',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          backdropFilter: 'none',
          animation: 'fadeInUp 0.6s ease-out'
        }}>
        <style>
          {`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            @keyframes slideInFromLeft {
              from {
                opacity: 0;
                transform: translateX(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.7;
              }
            }
            
            .table-row-hover {
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .table-row-hover:hover {
              background: rgba(255, 255, 255, 0.08) !important;
              transform: translateX(4px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .table-header-gradient {
              background: linear-gradient(135deg, #1e40af, #7c3aed);
              position: relative;
              overflow: hidden;
            }
            
            .table-header-gradient::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
              animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
              0% {
                left: -100%;
              }
              100% {
                left: 100%;
              }
            }
            
            .insight-card {
              background: transparent;
              border: none;
              border-radius: 8px;
              padding: 12px;
              margin-top: 16px;
              position: relative;
              overflow: hidden;
            }
            
            .insight-card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
              background-size: 200% 100%;
              animation: gradientShift 3s ease-in-out infinite;
            }
            
            @keyframes gradientShift {
              0%, 100% {
                background-position: 0% 50%;
              }
              50% {
                background-position: 100% 50%;
              }
            }
          `}
        </style>
        {renderTable(filteredData, category)}
      </div>
      </>
    );
  }

  return (
    <>
      {/* Expanded table overlay */}
      {expandedTable && tableData && renderExpandedTable(tableData, expandedTable)}
      
      <div style={{
        maxHeight: isExpanded ? `${maxHeight + 30}px` : `${maxHeight}px`,
        overflow: 'auto',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        marginTop: isExpanded ? '5px' : '0px',
        width: '100%', // Changed from fixed 320px to 100% to inherit parent width
        maxWidth: '320px', // Added maxWidth to maintain the design constraint
        position: 'relative'
      }}>
      {/* Response Content */}
      <div style={{
        lineHeight: '1.6',
        color: '#e5e7eb',
        fontSize: '14px'
      }}>
        {isExpanded ? renderFullView() : renderTruncatedView()}
      </div>

      {/* Controls */}
      {needsTruncation && (
        <div style={{
          marginTop: isExpanded ? '28px' : '28px',
          marginBottom: '0px',
          marginLeft: '2px',
          opacity: '0.5',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-start',
          alignItems: 'center'
        }}>
          {isExpanded ? (
            <button
              onClick={() => handleExpansionChange(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Show Less
            </button>
          ) : (
            <button
              onClick={() => handleExpansionChange(true)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Show More
            </button>
          )}
          
          {/* Collapse Button - Only show when showCollapseButton is true */}
          {showCollapseButton && onCollapseClick && (
            <button
              onClick={onCollapseClick}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, monospace',
                fontWeight: '400',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title="Click to collapse response"
            >
              Collapse
            </button>
          )}
          
          {/* Sources Toggle Button */}
          {citations && citations.length > 0 && (
            <button
              onClick={() => {
                const newState = !sourcesExpanded;
                setSourcesExpanded(newState);
                if (onSourcesExpandedChange) {
                  onSourcesExpandedChange(newState);
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '6px 12px',
                fontSize: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              title={sourcesExpanded ? 'Click to hide sources' : 'Click to show sources'}
            >
              Sources ({citations.length})
            </button>
          )}
        </div>
      )}


    </div>
    </>
  );
};

export default AIResponseDisplay;
