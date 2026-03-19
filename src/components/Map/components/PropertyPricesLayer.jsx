import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

// Helper function to normalize neighborhood names for comparison
const normalizeNeighborhoodName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

// Array of Mapbox green spaces layers
const greenSpacesLayers = [
  'landuse',
  'park',
  'park-label',
  'national-park',
  'natural',
  'golf-course',
  'pitch',
  'grass'
];

// Mock data for neighborhood stats if needed
const mockNeighborhoodStats = {
  "koreatown": {
    "residents": "120K",
    "score": 78,
    "zoningDocs": 24,
    "connectivityGaps": 5,
    "employmentHubs": 43,
    "strategicSites": 13
  },
  "downtown": {
    "residents": "85K",
    "score": 82,
    "zoningDocs": 31,
    "connectivityGaps": 3,
    "employmentHubs": 56,
    "strategicSites": 18
  },
  "hollywood": {
    "residents": "95K",
    "score": 71,
    "zoningDocs": 19,
    "connectivityGaps": 8,
    "employmentHubs": 36,
    "strategicSites": 11
  }
};

// Get neighborhood stats (real or mock)
const getNeighborhoodStats = (neighborhoodName) => {
  const normalized = normalizeNeighborhoodName(neighborhoodName);
  
  // Try to find a match in our mock data
  const mockMatch = Object.keys(mockNeighborhoodStats).find(key => 
    normalized.includes(key) || key.includes(normalized)
  );
  
  if (mockMatch) {
    return mockNeighborhoodStats[mockMatch];
  }
  
  // Return default values if no match found
  return {
    residents: Math.floor(Math.random() * 100 + 50) + "K",
    score: Math.floor(Math.random() * 30 + 60),
    zoningDocs: Math.floor(Math.random() * 20 + 10),
    connectivityGaps: Math.floor(Math.random() * 10 + 1),
    employmentHubs: Math.floor(Math.random() * 40 + 20),
    strategicSites: Math.floor(Math.random() * 15 + 5)
  };
};

const PropertyPricesLayer = ({ map, showPropertyPrices }) => {
  const [propertyData, setPropertyData] = useState(null);
  const [boundariesData, setBoundariesData] = useState(null);
  const [combinedData, setCombinedData] = useState(null);
  const [developmentData, setDevelopmentData] = useState(null);
  const [adaptiveReuseData, setAdaptiveReuseData] = useState(null);
  const eventListenersAttached = useRef(false);
  const totalSites = useRef(1204); // Mock total sites count from design

  // Function to toggle visibility of green spaces layers
  const toggleGreenSpacesLayers = (visible) => {
    if (!map.current) return;
    
    greenSpacesLayers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
    });
  };

  // Function to format development site descriptions with highlighted keywords
  const formatDescription = (description) => {
    if (!description) return '';
    
    // List of keywords to highlight
    const keywords = [
      'Los Angeles', 'Affordable Housing Linkage Fee', 'Policy', 'AHLF', 
      '15-minute', 'Rent Stabilization Ordinance', 'Density Bonus'
    ];
    
    let formattedDesc = description;
    
    // Replace keywords with highlighted versions
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formattedDesc = formattedDesc.replace(regex, `<strong>${keyword}</strong>`);
    });
    
    return formattedDesc;
  };

  // Function to find development opportunities and adaptive reuse sites for a neighborhood
  const findNeighborhoodOpportunities = (neighborhoodName) => {
    if (!adaptiveReuseData || !developmentData) {
      return { adaptiveReuse: [], development: [] };
    }
    
    const normalizedName = normalizeNeighborhoodName(neighborhoodName);
    
    // More flexible matching - try different matching strategies
    const findMatches = (data, name) => {
      // First try direct matching
      let matches = data.features.filter(feature => {
        const siteName = normalizeNeighborhoodName(feature.properties.name);
        return siteName === name;
      });
      
      // If no direct matches, try substring matching
      if (matches.length === 0) {
        matches = data.features.filter(feature => {
          const siteName = normalizeNeighborhoodName(feature.properties.name);
          return siteName.includes(name) || name.includes(siteName);
        });
      }
      
      // If no matches found, include some mock data for demonstration
      if (matches.length === 0 && (name === 'koreatown' || name.includes('korea'))) {
        matches = [
          {
            properties: {
              name: 'koreatown',
              type: 'development_potential',
              description: '"This residential property in Los Angeles is targeted for development under the Affordable Housing Linkage Fee (AHLF) program, with financial incentives available for the construction of affordable units to meet the city\'s housing needs. The development will adhere to the principles of a 15-minute city, ensuring residents have access to essential services within a short walk of their homes."',
              source_document: 'City Planning Commission'
            }
          },
          {
            properties: {
              name: 'koreatown',
              type: 'development_potential',
              description: '"Targeted by Policy 2.2, this Los Angeles site is identified for development under the Affordable Housing Linkage Fee (AHLF) program, with potential funding available for affordable housing projects. The site\'s transformation into a mixed-use development with affordable housing units and retail spaces aligns with the city\'s objective to increase housing availability and stimulate local economy. This development will enhance the 15-minute neighborhood concept, providing residents with essential services within a short walk, and will be supported by the Rent Stabilization Ordinance (RSO) to ensure long-term affordability. The project will utilize the city\'s Density Bonus program, offering incentives for developers to include affordable housing in their plans."',
              source_document: 'Housing Department'
            }
          }
        ];
      }
      
      // Add scoring to each match (mock scores for demonstration)
      matches = matches.map(match => ({
        ...match,
        score: Math.floor(Math.random() * 30 + 30) // Random score between 30-60
      }));
      
      return matches;
    };
    
    // Find matches in both datasets
    const adaptiveReuseSites = findMatches(adaptiveReuseData, normalizedName);
    const developmentSites = findMatches(developmentData, normalizedName);
    
    return {
      adaptiveReuse: adaptiveReuseSites,
      development: developmentSites
    };
  };

  // Fetch all data sources
  useEffect(() => {
    if (!map.current) return;

    // Fetch property prices data
    fetch('/property_prices.geojson')
      .then(response => response.json())
      .then(data => {
        setPropertyData(data);
      })
      .catch(error => {
        console.error('Error loading property prices data:', error);
      });

    // Fetch neighborhood boundaries data
    fetch('/LA_Times_Neighborhood_Boundaries.geojson')
      .then(response => response.json())
      .then(data => {
        setBoundariesData(data);
      })
      .catch(error => {
        console.error('Error loading neighborhood boundaries data:', error);
      });

    // Remove fetches for development potential and adaptive reuse data
    // Add cleanup for existing event listeners
    return () => {
      cleanupEventListeners();
    };
  }, [map]);

  // Function to clean up event listeners
  const cleanupEventListeners = () => {
    if (map.current) {
      // Remove all event listeners
      map.current.off('mousemove', 'property-prices-fill');
      map.current.off('mouseleave', 'property-prices-fill');
      map.current.off('click', 'property-prices-fill');
      map.current.off('mouseenter', 'property-prices-fill');
      map.current.off('mouseleave', 'property-prices-fill');
      
      // Close any open popups
      const popups = document.querySelectorAll('.property-price-popup');
      popups.forEach(popup => {
        popup.remove();
      });
    }
  };

  // Add the CSS styles for the enhanced popup
  useEffect(() => {
    if (!document.getElementById('enhanced-popup-styles')) {
      const style = document.createElement('style');
      style.id = 'enhanced-popup-styles';
      style.innerHTML = `
        .property-price-popup .mapboxgl-popup-content {
          background-color: rgba(15, 15, 20, 0.95);
          color: #ffffff;
          border-radius: 6px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
          padding: 0;
          overflow: hidden;
          max-width: 323px !important;
          width: 323px !important;
          min-width: 323px !important;
          position: relative;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .property-price-popup .mapboxgl-popup-close-button {
          font-size: 18px;
          right: 8px;
          top: 6px;
          color: rgba(255, 255, 255, 0.8);
          z-index: 100;
          background: transparent;
          border: none;
        }
        
        /* Position the popup tip consistently */
        .property-price-popup .mapboxgl-popup-tip {
          transition: none !important;
        }
        
        /* Prevent the popup from moving */
        .property-price-popup.mapboxgl-popup {
          will-change: unset !important;
          transition: none !important;
          /* Don't disable transforms completely as it breaks positioning */
        }
        
        /* Additional specificity for width control */
        .mapboxgl-popup.property-price-popup .mapboxgl-popup-content {
          width: 263px !important;
          max-width: 263px !important;
        }
        
        /* Allow content to transform for positioning but make transitions immediate */
        .property-price-popup .mapboxgl-popup-content {
          transition: none !important;
          /* Allow normal transforms for positioning */
        }
        
        /* Fix the position of the popup when expanded to prevent jumping */
        .property-price-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
        .property-price-popup.mapboxgl-popup-anchor-top .mapboxgl-popup-tip,
        .property-price-popup.mapboxgl-popup-anchor-left .mapboxgl-popup-tip,
        .property-price-popup.mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
          transition: none !important;
        }
        
        .site-count-header {
          background-color: rgba(20, 20, 25, 0.8);
          padding: 6px 12px;
          display: flex;
          align-items: center;
        }
        
        .site-count-icon {
          width: 18px;
          height: 18px;
          background-color: #2a9d2a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 7px;
          font-size: 10px;
        }
        
        .site-count-number {
          font-size: 12px;
          font-weight: 600;
          color: #aaeeaa;
        }
        
        .neighborhood-header {
          padding: 12px;
          background-color: rgb(15, 15, 15);
          position: relative;
        }
        
        .resident-count {
          color: rgba(255, 255, 255, 0.6);
          font-size: 10px;
          margin-bottom: 3px;
        }
        
        .neighborhood-name {
          font-size: 26px;
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
          margin-bottom: 12px;
        }
        
        .score-circle {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 34px;
          height: 34px;
          background-color: rgba(75, 192, 192, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #4bc0c0;
        }
        
        .stats-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        
        .stats-list li {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          line-height: 1.2;
        }
        
        .stats-list li:last-child {
          margin-bottom: 0;
        }
        
        .stat-label {
          display: flex;
          align-items: center;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.8);
          margin-right: 6px;
        }
        
        .stat-label:before {
          content: "•";
          margin-right: 7px;
          font-size: 14px;
        }
        
        .stat-value {
          font-size: 9px;
          font-weight: 600;
          color: #ff9966;
          margin-left: auto;
        }
        
        .popup-detail-section {
          padding: 9px 12px;
          background-color: rgba(30, 30, 40, 0.5);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out;
          padding-top: 0;
          padding-bottom: 0;
        }
        
        .popup-detail-section.expanded {
          max-height: 1000px;
          padding: 9px 12px;
          overflow-y: auto;
        }
        
        .section-summary {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 6px;
        }
        
        .section-title {
          font-size: 12px;
          color: #aaeeaa;
          margin-bottom: 7px;
          font-weight: 500;
        }
        
        .development-site {
          background-color: rgba(40, 45, 70, 0.6);
          border-radius: 4px;
          padding: 9px;
          margin-bottom: 9px;
          position: relative;
        }
        
        .site-header {
          display: flex;
          align-items: center;
          margin-bottom: 7px;
        }
        
        .site-icon {
          width: 18px;
          height: 18px;
          background-color: #9966ff;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 7px;
        }
        
        .site-title {
          font-size: 11px;
          font-weight: 600;
          color: white;
        }
        
        .site-score {
          position: absolute;
          top: 9px;
          right: 9px;
          background-color: rgba(0, 0, 0, 0.4);
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 9px;
          font-weight: 600;
        }
        
        .site-description {
          font-size: 10px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 7px;
        }
        
        .site-description strong {
          color: white;
          font-weight: 600;
        }
        
        .site-source {
          font-size: 8px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 4px;
        }
        
        .site-action {
          font-size: 9px;
          color: #6699ff;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        
        .popup-expand-indicator {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 6px 0;
          background-color: rgba(20, 20, 25, 0.8);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .popup-expand-indicator:hover {
          background-color: rgba(30, 30, 35, 0.8);
        }
        
        .popup-expand-indicator svg {
          width: 14px;
          height: 14px;
          fill: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s ease;
        }
        
        .popup-expand-indicator.expanded svg {
          transform: rotate(180deg);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Combine the data when both sources are loaded
  useEffect(() => {
    if (!propertyData || !boundariesData || !map.current) return;

    // Create a map of property data by normalized neighborhood name
    const propertyDataMap = {};
    propertyData.features.forEach(feature => {
      const normalizedName = normalizeNeighborhoodName(feature.properties.name);
      propertyDataMap[normalizedName] = feature.properties;
    });

    // Combine the data
    const combined = {
      type: 'FeatureCollection',
      features: boundariesData.features.map((feature, index) => {
        const normalizedName = normalizeNeighborhoodName(feature.properties.name);
        const propertyData = propertyDataMap[normalizedName];

        return {
          type: 'Feature',
          id: index,
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            feature_id: index,
            avg_price: propertyData?.avg_price || 0,
            price_level: propertyData?.price_level || 0,
            color: propertyData?.color || '#ffffff',
            original_name: feature.properties.name,
            property_name: propertyData?.name || null
          }
        };
      })
    };

    setBoundariesData(boundariesData);
    setCombinedData(combined);

    // Clean up existing event listeners before adding new ones
    cleanupEventListeners();

    // Add source and layers if they don't exist
    if (!map.current.getSource('property-prices')) {
      map.current.addSource('property-prices', {
        type: 'geojson',
        data: combined,
        generateId: false
      });

      // Add fill layer
      map.current.addLayer({
        id: 'property-prices-fill',
        type: 'fill',
        source: 'property-prices',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'price_level'], 0], 'rgba(0, 0, 0, 0)',
            [
              'step',
              ['get', 'price_level'],
              'rgba(10, 50, 120, 0.4)',
              1.5, 'rgba(20, 70, 150, 0.5)', 
              2, 'rgba(30, 90, 180, 0.6)',
              2.5, 'rgba(40, 110, 200, 0.65)',
              3, 'rgba(50, 130, 220, 0.7)', 
              3.5, 'rgba(60, 130, 210, 0.75)',
              4, 'rgba(50, 120, 200, 0.8)',
              4.5, 'rgba(40, 100, 180, 0.85)',
              5, 'rgba(30, 80, 160, 0.9)'
            ]
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.6,
            [
              'interpolate',
              ['linear'],
              ['get', 'price_level'],
              0, 0,
              1, 0.45,
              2, 0.42,
              3, 0.39,
              4, 0.36,
              5, 0.33
            ]
          ]
        }
      });

      // Add outline layer with minimal visibility
      map.current.addLayer({
        id: 'property-prices-line',
        type: 'line',
        source: 'property-prices',
        paint: {
          'line-color': 'rgba(0, 0, 0, 0)',
          'line-width': 0,
          'line-opacity': 0
        }
      });
    } else {
      // Update existing source
      map.current.getSource('property-prices').setData(combined);
    }

    // Only attach event listeners if they haven't been attached yet
    if (!eventListenersAttached.current) {
      // Add hover effect
      let hoveredStateId = null;

      map.current.on('mousemove', 'property-prices-fill', (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          const featureId = feature.id !== undefined ? feature.id : feature.properties.feature_id;
          
          if (featureId === undefined) return;

          if (hoveredStateId !== null) {
            try {
              map.current.setFeatureState(
                { source: 'property-prices', id: hoveredStateId },
                { hover: false }
              );
            } catch (error) {}
          }
          
          hoveredStateId = featureId;
          
          try {
            map.current.setFeatureState(
              { source: 'property-prices', id: hoveredStateId },
              { hover: true }
            );
          } catch (error) {}
        }
      });

      map.current.on('mouseleave', 'property-prices-fill', () => {
        if (hoveredStateId !== null) {
          try {
            map.current.setFeatureState(
              { source: 'property-prices', id: hoveredStateId },
              { hover: false }
            );
          } catch (error) {}
        }
        hoveredStateId = null;
      });

      // Set the flag to indicate event listeners are attached
      eventListenersAttached.current = true;

      // Add click handler for enhanced popup
      map.current.on('click', 'property-prices-fill', (e) => {
        // Close any existing popups first
        const existingPopups = document.querySelectorAll('.mapboxgl-popup');
        existingPopups.forEach(popup => popup.remove());

        if (e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = e.lngLat;
          const neighborhoodName = feature.properties.name;
          
          // Add mock data for specific neighborhoods
          mockNeighborhoodStats["encino"] = {
            "residents": "143K",
            "score": 72,
            "zoningDocs": 18,
            "connectivityGaps": 6,
            "employmentHubs": 31,
            "strategicSites": 6
          };
          
          // Get neighborhood stats (real or mock)
          const stats = getNeighborhoodStats(neighborhoodName);
                           
          // Find development opportunities for this neighborhood
          const opportunities = findNeighborhoodOpportunities(neighborhoodName);
          const totalOpportunities = opportunities.adaptiveReuse.length + opportunities.development.length;
          
          // If no opportunities found and we have real data, force some mock data for demonstration
          if (totalOpportunities === 0 && developmentData && adaptiveReuseData) {
            
            // Add sample development opportunities
            const sampleOpportunity1 = {
              properties: {
                name: neighborhoodName,
                type: 'development_potential',
                description: `"This site in ${neighborhoodName} is targeted for development under the Affordable Housing Linkage Fee program, with potential funding for affordable housing projects. The proposed mixed-use development will include retail spaces and housing units, supporting the 15-minute city concept."`,
                source_document: 'City Planning Commission'
              },
              score: 44
            };
            
            const sampleOpportunity2 = {
              properties: {
                name: neighborhoodName,
                type: 'development_potential',
                description: `"Located in ${neighborhoodName}, this site has been identified as a potential location for transit-oriented development that would address the area's housing needs while providing convenient access to public transportation. The project could qualify for density bonuses under current zoning regulations."`,
                source_document: 'Transit Authority'
              },
              score: 38
            };
            
            // Add two highlighted sites
            opportunities.development = [sampleOpportunity1, sampleOpportunity2];
          }
          
          // Create development site HTML
          const createSiteHTML = (site, index) => {
            const siteType = site.properties?.type || 'development_potential';
            const siteTitle = `${siteType === 'development_potential' ? 'Development' : 'Adaptive Reuse'} Site ${index + 1}`;
            const siteIcon = siteType === 'development_potential' ? '📊' : '🔄';
            const siteDesc = formatDescription(site.properties?.description || '');
            const siteSource = site.properties?.source_document || 'City Planning Document';
            const siteScore = site.score || Math.floor(Math.random() * 20 + 40);
            
            return `
              <div class="development-site">
                <div class="site-score">Score: ${siteScore}</div>
                <div class="site-header">
                  <div class="site-icon">${siteIcon}</div>
                  <div class="site-title">${siteTitle}</div>
                </div>
                <div class="site-description">${siteDesc}</div>
                <div class="site-source">Source: ${siteSource}</div>
                <a href="#" class="site-action">${index === 0 ? 'Read more...' : 'Show less'}</a>
              </div>
            `;
          };
          
          // Combine all sites for display
          const allSites = [
            ...opportunities.development.map((site, i) => ({ ...site, index: i })),
            ...opportunities.adaptiveReuse.map((site, i) => ({ ...site, index: i }))
          ];
          
          // Sort by score (if available)
          allSites.sort((a, b) => (b.score || 50) - (a.score || 50));
          
          // Generate HTML for each site (limit to 2 for initial view)
          const sitesHTML = allSites.slice(0, 2).map((site, idx) => createSiteHTML(site, idx)).join('');
          
          // Update total number of opportunities after adding mock data if needed
          const updatedTotalOpportunities = opportunities.development.length + opportunities.adaptiveReuse.length;
          
          // Create the expandable section markup (using CSS max-height transition instead of display:none)
          const expandableSection = `
            <div class="popup-detail-section">
              <div class="section-summary">
                ${updatedTotalOpportunities > 0 ? 
                  `${updatedTotalOpportunities} Total Development Sites (Showing first ${Math.min(2, updatedTotalOpportunities)} of each type)` :
                  'Development opportunities for this area'}
              </div>
              <div class="section-title">
                ${opportunities.development.length > 0 ? 
                  `Development Potential Sites (${opportunities.development.length})` :
                  'Highlighted Sites'}
              </div>
              ${sitesHTML || `
                <div class="development-site">
                  <div class="site-score">Score: 42</div>
                  <div class="site-header">
                    <div class="site-icon">📊</div>
                    <div class="site-title">Highlighted Site 1</div>
                  </div>
                  <div class="site-description">This is a highlighted site for ${neighborhoodName}. In a real scenario, this would show actual development opportunities from the <strong>GeoJSON</strong> data.</div>
                  <div class="site-source">Source: City Development Plan</div>
                  <a href="#" class="site-action">Read more...</a>
                </div>
                <div class="development-site">
                  <div class="site-score">Score: 39</div>
                  <div class="site-header">
                    <div class="site-icon">📊</div>
                    <div class="site-title">Highlighted Site 2</div>
                  </div>
                  <div class="site-description">Another highlighted site in ${neighborhoodName} with development potential. This area has been identified as having strategic importance for future growth in the planning documents.</div>
                  <div class="site-source">Source: Urban Planning Department</div>
                  <a href="#" class="site-action">Read more...</a>
                </div>
              `}
            </div>
          `;

          // Create the enhanced popup
          const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            anchor: 'top-right', // Position to the top-right of the click point
            offset: [50, 20], // Larger offset to push it right and down
            className: 'property-price-popup',
            trackPointer: false // Don't follow the mouse pointer
          })
            .setLngLat(coordinates)
            .setHTML(`
              <div class="site-count-header">
                <div class="site-count-icon">🏗️</div>
                <div class="site-count-number">${totalSites.current} sites</div>
              </div>
              
              <div class="neighborhood-header">
                <div class="resident-count">${stats.residents} residents</div>
                <h1 class="neighborhood-name">${neighborhoodName}</h1>
                <div class="score-circle">${stats.score}</div>
                
                <ul class="stats-list">
                  <li>
                    <div class="stat-label">Zoning & Policy:</div>
                    <div class="stat-value">${stats.zoningDocs} Relevant Documents</div>
                  </li>
                  <li>
                    <div class="stat-label">Transportation:</div>
                    <div class="stat-value">${stats.connectivityGaps} connectivity gaps</div>
                  </li>
                  <li>
                    <div class="stat-label">Property & Employment:</div>
                    <div class="stat-value">${stats.employmentHubs} Hubs</div>
                  </li>
                  <li>
                    <div class="stat-label">Infrastructure Capacity:</div>
                    <div class="stat-value">${stats.strategicSites} Strategic Sites</div>
                  </li>
                </ul>
              </div>
              
              ${expandableSection}
              
              <div class="popup-expand-indicator">
                <svg viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </div>
            `)
            .addTo(map.current);
            
          // Add event listener for expand/collapse with a longer delay and proper direct DOM manipulation
          setTimeout(() => {
            // Ensure the popup is still in the DOM
            const popupContainer = document.querySelector('.property-price-popup');
            if (!popupContainer) {
              console.error('Popup container not found in DOM, it may have been closed');
              return;
            }
            
            // Force width in JS as well to be sure
            const popupContent = popupContainer.querySelector('.mapboxgl-popup-content');
            if (popupContent) {
              popupContent.style.width = '263px';
              popupContent.style.maxWidth = '263px';
              popupContent.style.minWidth = '263px';
            }
            
            // Get the current position and size before expansion
            const originalRect = popupContainer.getBoundingClientRect();
            
            const expandIndicator = popupContainer.querySelector('.popup-expand-indicator');
            const detailSection = popupContainer.querySelector('.popup-detail-section');
            
            if (expandIndicator && detailSection) {
              // Store a reference to help with toggling
              let isExpanded = false;
              
              expandIndicator.addEventListener('click', function(e) {
                // Prevent event bubbling to map click handler
                e.stopPropagation();
                e.preventDefault();
                
                // Toggle expanded state
                isExpanded = !isExpanded;
                
                if (isExpanded) {
                  detailSection.classList.add('expanded');
                  expandIndicator.classList.add('expanded');
                  // Change the arrow direction
                  this.querySelector('svg').innerHTML = '<path d="M7 14l5-5 5 5z"/>';
                } else {
                  detailSection.classList.remove('expanded');
                  expandIndicator.classList.remove('expanded');
                  // Change the arrow direction back
                  this.querySelector('svg').innerHTML = '<path d="M7 10l5 5 5-5z"/>';
                }
                
                // After the change, ensure the popup hasn't moved
                setTimeout(() => {
                  const afterRect = popupContainer.getBoundingClientRect();
                  
                  // If needed, we could adjust position here, but our CSS fixes should handle it
                }, 50);
              });

              // Make sure pointer events work
              expandIndicator.style.cursor = 'pointer';
              expandIndicator.style.pointerEvents = 'auto';
              
            } else {
              console.error('Failed to find expand indicator or detail section in DOM');
            }
          }, 500); // Increased delay to ensure DOM is ready
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'property-prices-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'property-prices-fill', () => {
        map.current.getCanvas().style.cursor = '';
      });
    }

    // Update property prices layer visibility
    map.current.setLayoutProperty(
      'property-prices-fill',
      'visibility',
      showPropertyPrices ? 'visible' : 'none'
    );
    map.current.setLayoutProperty(
      'property-prices-line',
      'visibility',
      showPropertyPrices ? 'visible' : 'none'
    );

    // Toggle green spaces layers visibility to match property prices layer
    toggleGreenSpacesLayers(showPropertyPrices);

    // Cleanup
    return () => {
      if (map.current) {
        // Clean up event listeners
        cleanupEventListeners();
        
        // Reset the flag when component is unmounting
        eventListenersAttached.current = false;
        
        if (map.current.getLayer('property-prices-line')) {
          map.current.removeLayer('property-prices-line');
        }
        if (map.current.getLayer('property-prices-fill')) {
          map.current.removeLayer('property-prices-fill');
        }
        if (map.current.getSource('property-prices')) {
          map.current.removeSource('property-prices');
        }
        
        // Remove custom CSS on unmount
        const styleElement = document.getElementById('enhanced-popup-styles');
        if (styleElement) {
          styleElement.remove();
        }
      }
    };
  }, [map, propertyData, boundariesData, showPropertyPrices]);

  // Additional effect to handle visibility changes when showPropertyPrices changes
  useEffect(() => {
    if (!map.current) return;
    
    // Check if the layers exist before trying to update visibility
    if (map.current.getLayer('property-prices-fill') && map.current.getLayer('property-prices-line')) {
      // Update property prices layer visibility
      map.current.setLayoutProperty(
        'property-prices-fill',
        'visibility',
        showPropertyPrices ? 'visible' : 'none'
      );
      map.current.setLayoutProperty(
        'property-prices-line',
        'visibility',
        showPropertyPrices ? 'visible' : 'none'
      );
      
      // Toggle green spaces layers visibility to match property prices layer
      toggleGreenSpacesLayers(showPropertyPrices);
    }
  }, [showPropertyPrices]);

  return null;
};

export default PropertyPricesLayer; 