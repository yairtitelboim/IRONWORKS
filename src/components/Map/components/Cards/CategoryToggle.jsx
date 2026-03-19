import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLocationSpecificFiltering, matchesLocationCriteria } from '../../../../config/locationFilteringConfig.js';

const CategoryToggle = ({ 
  perplexityResponse = '',
  originalClaudeResponse = '', // NEW: Original Claude response for text mode
  selectedCategory = 'all',
  onCategoryChange = null,
  isVisible = true,
  // New props for dual analysis (backward compatible)
  viewMode = 'node',           // 'node' | 'site' - Default to NODE for table display
  onViewModeChange = null,     // Callback for view mode changes
  selectedMarker = null,       // Currently selected marker data for node-specific filtering
  currentLocation = 'default' // Location-aware filtering
}) => {

  // State to track selected marker for node-specific filtering
  const [currentSelectedMarker, setCurrentSelectedMarker] = useState(selectedMarker);
  const [isResponseScrolled, setIsResponseScrolled] = useState(false);
  
  // Listen for marker selection events to update filtering
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleMarkerSelected = (markerData) => {
      setCurrentSelectedMarker(markerData);
    };

    const handleMarkerDeselected = () => {
      setCurrentSelectedMarker(null);
    };

    const handleResponseScrolled = (data) => {
      setIsResponseScrolled(data.isScrolled);
    };

    window.mapEventBus.on('marker:selected', handleMarkerSelected);
    window.mapEventBus.on('marker:deselected', handleMarkerDeselected);
    window.mapEventBus.on('response:scrolled', handleResponseScrolled);

    return () => {
      window.mapEventBus.off('marker:selected', handleMarkerSelected);
      window.mapEventBus.off('marker:deselected', handleMarkerDeselected);
      window.mapEventBus.off('response:scrolled', handleResponseScrolled);
    };
  }, []);

  // Update local state when prop changes
  useEffect(() => {
    setCurrentSelectedMarker(selectedMarker);
  }, [selectedMarker]);

  // SIMPLIFIED: Use the simple flow - just return the perplexityResponse prop
  const getActiveResponse = () => {
    return perplexityResponse;
  };

  const activeResponse = getActiveResponse();

  // Define categories with context-aware descriptions (Updated for Startup Ecosystem and Pinal County)
  const getCategories = (currentViewMode) => {
    // Check if this is a Pinal County agricultural analysis
    const isPinalAnalysis = activeResponse.toLowerCase().includes('pinal county') ||
                           activeResponse.toLowerCase().includes('agricultural change') ||
                           activeResponse.toLowerCase().includes('lucid ev campus') ||
                           activeResponse.toLowerCase().includes('agriculture loss') ||
                           activeResponse.toLowerCase().includes('agriculture gain') ||
                           activeResponse.toLowerCase().includes('industrial expansion') ||
                           activeResponse.toLowerCase().includes('water change');

    if (isPinalAnalysis) {
      return [
        {
          id: 'text',
          icon: 'TXT',
          description: 'Original Claude Response (Text View)'
        },
        {
          id: 'all',
          icon: 'ALL',
          description: 'Complete Agricultural Change Analysis'
        },
        {
          id: 'agr', // Agriculture changes
          icon: 'AGR',
          description: 'Agriculture Loss & Gain Analysis'
        },
        {
          id: 'ind', // Industrial expansion
          icon: 'IND',
          description: 'Industrial Development Analysis'
        },
        {
          id: 'wat', // Water changes
          icon: 'WAT',
          description: 'Water Resource Changes'
        }
      ];
    }

    // Default startup ecosystem categories
    return [
      {
        id: 'text',
        icon: 'TXT',
        description: 'Original Claude Response (Text View)'
      },
      {
        id: 'all',
        icon: 'ALL',
        description: currentViewMode === 'site' ? 'Complete Startup Ecosystem Analysis' : 'Full Startup Details'
      },
      {
        id: 'inn', // Innovation potential
        icon: 'INN',
        description: currentViewMode === 'site' ? 'Ecosystem Innovation Score' : 'Startup Innovation Potential'
      },
      {
        id: 'fnd', // Funding access
        icon: 'FND',
        description: currentViewMode === 'site' ? 'Funding Landscape' : 'Startup Funding Access'
      },
      {
        id: 'tlt', // Talent access
        icon: 'TLT',
        description: currentViewMode === 'site' ? 'Talent Ecosystem' : 'Startup Talent Access'
      }
    ];
  };

  const categories = getCategories(viewMode);

  // DISABLED: Site-level analysis - only NODE analysis supported
  // const siteLevelCategories = [
  //   { id: 'ecosystem', icon: 'ECO', description: 'Ecosystem Overview' },
  //   { id: 'innovation', icon: 'INN', description: 'Innovation Landscape' },
  //   { id: 'funding', icon: 'FND', description: 'Funding Environment' },
  //   { id: 'talent', icon: 'TLT', description: 'Talent Pool' },
  //   { id: 'network', icon: 'NET', description: 'Network Effects' },
  //   { id: 'market', icon: 'MKT', description: 'Market Opportunities' },
  //   { id: 'impact', icon: 'IMP', description: 'Ecosystem Impact' }
  // ];

  // Filter response based on selected category
  const filterNodeLevelResponse = (categoryId) => {
    if (categoryId === 'text') {
      return originalClaudeResponse;
    }

    if (categoryId === 'all') {
      return perplexityResponse;
    }

    // Parse the perplexity response to extract individual nodes
    const nodeMatches = perplexityResponse.match(/## NODE[\s\S]*?(?=## NODE|$)/g);
    const targetNodes = nodeMatches ? nodeMatches.map(node => node.trim()) : [];

    let filteredContent = '';

    switch (categoryId) {
      // Pinal County Agricultural Analysis Categories
      case 'agr': // Agriculture changes
        const agricultureNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('agriculture loss') ||
                 nodeText.includes('agriculture gain') ||
                 nodeText.includes('cropland') ||
                 nodeText.includes('farming') ||
                 nodeText.includes('agricultural');
        });
        if (agricultureNodes.length > 0) {
          filteredContent = '## Agriculture Changes\n\n' + agricultureNodes.join('\n\n');
        } else {
          filteredContent = '## Agriculture Changes\n\nNo agriculture change analysis found.';
        }
        break;

      case 'ind': // Industrial expansion
        const industrialNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('industrial expansion') ||
                 nodeText.includes('manufacturing') ||
                 nodeText.includes('facility') ||
                 nodeText.includes('lucid') ||
                 nodeText.includes('industrial');
        });
        if (industrialNodes.length > 0) {
          filteredContent = '## Industrial Expansion\n\n' + industrialNodes.join('\n\n');
        } else {
          filteredContent = '## Industrial Expansion\n\nNo industrial expansion analysis found.';
        }
        break;

      case 'wat': // Water changes
        const waterNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('water change') ||
                 nodeText.includes('water resource') ||
                 nodeText.includes('irrigation') ||
                 nodeText.includes('water') ||
                 nodeText.includes('hydrology');
        });
        if (waterNodes.length > 0) {
          filteredContent = '## Water Changes\n\n' + waterNodes.join('\n\n');
        } else {
          filteredContent = '## Water Changes\n\nNo water change analysis found.';
        }
        break;


      // Startup Ecosystem Categories (original)
      case 'inn': // Innovation potential
        const innovationNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('innovation potential') ||
                 nodeText.includes('technology') ||
                 nodeText.includes('startup') ||
                 nodeText.includes('innovation score') ||
                 nodeText.includes('1. innovation potential');
        });
        if (innovationNodes.length > 0) {
          filteredContent = '## Innovation Potential\n\n' + innovationNodes.join('\n\n');
        } else {
          filteredContent = '## Innovation Potential\n\nNo innovation potential analysis found.';
        }
        break;

      case 'fnd': // Funding access
        const fundingNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('funding access') ||
                 nodeText.includes('funding') ||
                 nodeText.includes('investment') ||
                 nodeText.includes('capital') ||
                 nodeText.includes('2. funding access');
        });
        if (fundingNodes.length > 0) {
          filteredContent = '## Funding Access\n\n' + fundingNodes.join('\n\n');
        } else {
          filteredContent = '## Funding Access\n\nNo funding access analysis found.';
        }
        break;

      case 'tlt': // Talent access
        const talentNodes = targetNodes.filter(node => {
          const nodeText = node.toLowerCase();
          return nodeText.includes('talent access') ||
                 nodeText.includes('talent') ||
                 nodeText.includes('skills') ||
                 nodeText.includes('workforce') ||
                 nodeText.includes('3. talent access');
        });
        if (talentNodes.length > 0) {
          filteredContent = '## Talent Access\n\n' + talentNodes.join('\n\n');
        } else {
          filteredContent = '## Talent Access\n\nNo talent access analysis found.';
        }
        break;


      default:
        filteredContent = perplexityResponse;
    }

    return filteredContent;
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    const filteredContent = filterNodeLevelResponse(categoryId);
    
    if (onCategoryChange) {
      onCategoryChange(categoryId, filteredContent, null);
    }
  };


  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: 'relative',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8px', // Reduced gap to fit more buttons
      padding: '8px 0',
      marginBottom: '8px',
      width: '100%',
      maxWidth: '100%', // Ensure it doesn't exceed container
      justifyContent: 'flex-start',
      flexWrap: 'wrap', // Allow wrapping if needed
      overflow: 'hidden' // Prevent overflow
    }}>
      {/* Category Buttons */}
      <div style={{
        display: 'flex',
        gap: '1px', // Reduced gap between buttons
        alignItems: 'center',
        flexWrap: 'wrap' // Allow wrapping if needed
      }}>
        {categories.map((category) => {
          const isSelected = selectedCategory === category.id;
          const isDisabled = viewMode === 'site';
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              disabled={isDisabled}
              style={{
                padding: '4px 8px', // Reduced padding for more compact buttons
                fontSize: '8px', // 20% smaller (10px * 0.8 = 8px)
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                transition: 'all 0.2s ease',
                opacity: isDisabled ? 0.5 : 1,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !isSelected) {
                  e.target.style.color = 'rgba(255, 255, 255, 0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !isSelected) {
                  e.target.style.color = 'rgba(255, 255, 255, 0.7)';
                }
              }}
              title={category.description}
            >
              {category.icon}
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default CategoryToggle;