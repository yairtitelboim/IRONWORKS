import React, { useState, useEffect, useCallback, useRef } from 'react';
import MarkerPopupCard from './MarkerPopupCard';

const MarkerPopupManager = ({ map }) => {
  const [popupData, setPopupData] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [originalCoordinates, setOriginalCoordinates] = useState(null);
  
  // Multiple popups state for Whitney markers
  const [whitneyPopups, setWhitneyPopups] = useState([]);
  const whitneyPopupsRef = useRef([]);
  
  // Update ref when state changes
  useEffect(() => {
    whitneyPopupsRef.current = whitneyPopups;
  }, [whitneyPopups]);
  
  // Update Whitney popup positions when map moves/zooms
  const updateWhitneyPopupPositions = useCallback(() => {
    if (!map?.current || whitneyPopups.length === 0) return;
    
    setWhitneyPopups(prev => prev.map(popup => {
      if (popup.data.coordinates && map.current) {
        const screenPos = map.current.project(popup.data.coordinates);
        const offsetX = popup.id === 'lucid-motors-casa-grande' ? 200 : 0;
        const offsetY = popup.id === 'lucid-motors-casa-grande' ? 100 : 
                       popup.id === 'casa-grande-marker' ? -50 : 0;
        
        return {
          ...popup,
          position: {
            x: screenPos.x + offsetX,
            y: screenPos.y + offsetY
          }
        };
      }
      return popup;
    }));
  }, [map, whitneyPopups.length]);
  const popupDataRef = useRef(null);
  const clickOutsideHandlerRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const whitneyAutoCloseTimeoutsRef = useRef({});

  // Function to highlight a marker for 5 seconds
  const highlightMarker = useCallback((markerData) => {
    if (!map?.current) return;

    const mapInstance = map.current;
    
    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Check if the SERP layer exists (used for real estate data)
    if (!mapInstance.getLayer('serp-startup-ecosystem-markers')) {
      console.warn('SERP layer not found for highlighting');
      return;
    }

    // Get the marker identifier (use serp_id if available, otherwise use name or id)
    const markerId = markerData.serp_id || markerData.id || markerData.nodeId;
    const markerName = markerData.name || markerData.nodeName || markerData.title;

    if (!markerId && !markerName) {
      console.warn('No marker identifier found for highlighting');
      return;
    }

    // Highlighting marker

    // Highlight the marker with a bright color and larger size
    const highlightColor = '#ff6b35'; // Bright orange for highlighting
    const highlightRadius = 15; // Larger radius for highlighted marker

    // Create the condition for highlighting - try multiple identifier fields
    // For real estate data, we need to be more flexible with matching
    let highlightCondition;
    
    if (markerId) {
      // Try serp_id first, then id, then name
      highlightCondition = [
        'any',
        ['==', ['get', 'serp_id'], markerId],
        ['==', ['get', 'id'], markerId],
        ['==', ['get', 'name'], markerId]
      ];
    } else if (markerName) {
      // Try name matching
      highlightCondition = ['==', ['get', 'name'], markerName];
    } else {
      console.warn('No valid identifier for highlighting');
      return;
    }

    // Update marker color to highlight the selected one
    mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-color', [
      'case',
      highlightCondition,
      highlightColor, // Bright orange for selected marker
      // Keep original colors for other markers based on category
      ['==', ['get', 'category'], 'Residential Sale'], '#10b981',
      ['==', ['get', 'category'], 'Residential Lease'], '#3b82f6',
      ['==', ['get', 'category'], 'Commercial Sale'], '#f59e0b',
      ['==', ['get', 'category'], 'Commercial Lease'], '#8b5cf6',
      ['==', ['get', 'category'], 'Luxury'], '#ef4444',
      ['==', ['get', 'category'], 'Budget'], '#84cc16',
      ['==', ['get', 'category'], 'Mid-Range'], '#06b6d4',
      ['==', ['get', 'category'], 'Premium'], '#a855f7',
      ['==', ['get', 'category'], 'Other'], '#6b7280',
      '#6b7280' // Default gray
    ]);

    // Make highlighted marker larger
    mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-radius', [
      'case',
      highlightCondition,
      highlightRadius, // Larger for highlighted marker
      // Keep original sizes for other markers
      ['==', ['get', 'category'], 'Residential Sale'], 8,
      ['==', ['get', 'category'], 'Residential Lease'], 7,
      ['==', ['get', 'category'], 'Commercial Sale'], 9,
      ['==', ['get', 'category'], 'Commercial Lease'], 8,
      ['==', ['get', 'category'], 'Luxury'], 10,
      ['==', ['get', 'category'], 'Budget'], 6,
      ['==', ['get', 'category'], 'Mid-Range'], 7,
      ['==', ['get', 'category'], 'Premium'], 9,
      ['==', ['get', 'category'], 'Other'], 6,
      6 // Default size
    ]);

    // Make highlighted marker more opaque
    mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', [
      'case',
      highlightCondition,
      1.0, // Full opacity for highlighted marker
      0.8 // Normal opacity for others
    ]);

    // Set timeout to reset the marker after 5 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      // Resetting marker highlight after 5 seconds
      
      // Reset to original colors
      mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-color', [
        'case',
        ['==', ['get', 'category'], 'Residential Sale'], '#10b981',
        ['==', ['get', 'category'], 'Residential Lease'], '#3b82f6',
        ['==', ['get', 'category'], 'Commercial Sale'], '#f59e0b',
        ['==', ['get', 'category'], 'Commercial Lease'], '#8b5cf6',
        ['==', ['get', 'category'], 'Luxury'], '#ef4444',
        ['==', ['get', 'category'], 'Budget'], '#84cc16',
        ['==', ['get', 'category'], 'Mid-Range'], '#06b6d4',
        ['==', ['get', 'category'], 'Premium'], '#a855f7',
        ['==', ['get', 'category'], 'Other'], '#6b7280',
        '#6b7280' // Default gray
      ]);

      // Reset to original sizes
      mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-radius', [
        'case',
        ['==', ['get', 'category'], 'Residential Sale'], 8,
        ['==', ['get', 'category'], 'Residential Lease'], 7,
        ['==', ['get', 'category'], 'Commercial Sale'], 9,
        ['==', ['get', 'category'], 'Commercial Lease'], 8,
        ['==', ['get', 'category'], 'Luxury'], 10,
        ['==', ['get', 'category'], 'Budget'], 6,
        ['==', ['get', 'category'], 'Mid-Range'], 7,
        ['==', ['get', 'category'], 'Premium'], 9,
        ['==', ['get', 'category'], 'Other'], 6,
        6 // Default size
      ]);

      // Reset opacity
      mapInstance.setPaintProperty('serp-startup-ecosystem-markers', 'circle-opacity', 0.8);
      
    }, 5000); // 5 seconds

  }, [map]);

  // Listen for table row clicks to show popup above matching markers
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handleTableNodeSelected = (bridgeData) => {
      const { tableNode, coordinates } = bridgeData;
      
      // Clear any existing popup first
      setIsVisible(false);
      setPopupData(null);
      setPopupPosition(null);
      setOriginalCoordinates(null);
      popupDataRef.current = null;
      
      // Auto-close timer removed - popup stays visible until user interaction
      
      // Store the table node data for when we get coordinates from legend
      const newPopupData = {
        id: tableNode.id,
        name: tableNode.name,
        type: tableNode.type
      };
      setPopupData(newPopupData);
      popupDataRef.current = newPopupData;
      
      // If we have coordinates directly, use them
      if (coordinates && map?.current) {
        // Validate and normalize coordinates
        let coords = coordinates;
        
        // Convert to [lng, lat] format if needed
        if (Array.isArray(coords) && coords.length === 2) {
          // Check if both are valid numbers
          if (typeof coords[0] === 'number' && typeof coords[1] === 'number' && 
              !isNaN(coords[0]) && !isNaN(coords[1]) &&
              isFinite(coords[0]) && isFinite(coords[1])) {
            coords = coords;
          } else {
            console.error('❌ MarkerPopupManager: Invalid coordinate values (NaN or Infinity):', coords);
            return;
          }
        } else if (typeof coords === 'object' && coords !== null) {
          // Convert from {lng, lat} or {lon, lat}
          if (coords.lng !== undefined && coords.lat !== undefined) {
            if (typeof coords.lng === 'number' && typeof coords.lat === 'number' &&
                !isNaN(coords.lng) && !isNaN(coords.lat) &&
                isFinite(coords.lng) && isFinite(coords.lat)) {
              coords = [coords.lng, coords.lat];
            } else {
              console.error('❌ MarkerPopupManager: Invalid coordinate values in object:', coords);
              return;
            }
          } else if (coords.lon !== undefined && coords.lat !== undefined) {
            if (typeof coords.lon === 'number' && typeof coords.lat === 'number' &&
                !isNaN(coords.lon) && !isNaN(coords.lat) &&
                isFinite(coords.lon) && isFinite(coords.lat)) {
              coords = [coords.lon, coords.lat];
            } else {
              console.error('❌ MarkerPopupManager: Invalid coordinate values in object:', coords);
              return;
            }
          } else {
            console.error('❌ MarkerPopupManager: Invalid coordinates object format:', coords);
            return;
          }
        } else {
          console.error('❌ MarkerPopupManager: Invalid coordinates type:', typeof coords, coords);
          return;
        }
        
        try {
          const screenPosition = map.current.project(coords);
        setPopupPosition({
          x: screenPosition.x,
          y: screenPosition.y
        });
          setOriginalCoordinates(coords);
        setIsVisible(true);
        } catch (error) {
          console.error('❌ MarkerPopupManager: Error projecting coordinates:', error, 'Coordinates:', coords);
          return;
        }
        
        // Set auto-close timer for 6 seconds
        if (autoCloseTimeoutRef.current) {
          clearTimeout(autoCloseTimeoutRef.current);
        }
        autoCloseTimeoutRef.current = setTimeout(() => {
          closePopup();
        }, 9000);
      }
    };

    // Listen for direct marker clicks to show popup
    const handleMarkerClicked = (markerData) => {
      console.log('🔍 [MarkerPopupManager] handleMarkerClicked called', {
        markerData,
        timestamp: new Date().toISOString(),
        hasSource: !!markerData.source,
        source: markerData.source,
        formatter: markerData.formatter,
        id: markerData.id,
        name: markerData.name,
        stackTrace: new Error().stack?.split('\n').slice(0, 15).join('\n')
      });
      
      // Skip popup for MCP markers - they show details in AIResponseDisplayRefactored instead
      if (markerData.source === 'mcp') {
        console.log('🔍 [MarkerPopupManager] Skipping MCP marker popup');
        return;
      }
      
      // Skip popup for PA site markers - they have their own popup system in OSMCallCached
      const isPASiteMarker = markerData.id && (
        markerData.id.includes('three_mile_island_pa') ||
        markerData.id.includes('susquehanna_nuclear_pa') ||
        (markerData.id.includes('-marker') && (
          markerData.id.includes('three_mile_island') ||
          markerData.id.includes('susquehanna')
        ))
      );
      
      if (isPASiteMarker) {
        console.log('🔍 [MarkerPopupManager] Skipping PA site marker popup - using OSMCallCached popup instead', {
          markerId: markerData.id
        });
        return;
      }
      
      // Debug logging removed - TDLR popup working correctly
      
      // Marker clicked event received
      // Check if this is an automatic popup (from OSMCall.jsx auto-triggers)
      const isAutomaticPopup = markerData.isAutomatic === true;
      
      // Prevent duplicate popups for the same marker
      const markerId = markerData.id || markerData.serp_id || markerData.nodeId;
      if (popupDataRef.current && popupDataRef.current.id === markerId && isVisible) {
        // Popup already visible for this marker, ignoring duplicate click
        return;
      }
      
      // Check if this is a Whitney marker first
      const isWhitneyMarker = markerData.formatter === 'whitney' || 
                              markerData.zonesAnalyzed ||
                              markerData.category === 'Texas Data Center Development';
      
      // Only clear existing popup if it's for a different marker AND not a Whitney marker
      if (!isWhitneyMarker && popupDataRef.current && popupDataRef.current.id !== markerId) {
        setIsVisible(false);
        setPopupData(null);
        setPopupPosition(null);
        setOriginalCoordinates(null);
        popupDataRef.current = null;
      }
      
      // Check if this is a TDLR marker (only if not Whitney)
      const isTDLRMarker = !isWhitneyMarker && (
        markerData.formatter === 'tdlr' || 
        markerData.type === 'tdlr' || 
        markerData.facility_name || 
        markerData.work_type ||
        markerData.project_name ||
        markerData.project_id
      );
      
      // PRIORITIZE PINAL over startup: green-button OSM markers should be Pinal/typewriter
      const isPinalMarker = !isWhitneyMarker && !isTDLRMarker && (
        markerData.formatter === 'pinal' ||
        markerData.category === 'North Carolina Megasite'
      );

      // Check if this is a startup marker (only if not Whitney, TDLR, or Pinal)
      const isStartupMarker = !isWhitneyMarker && !isTDLRMarker && !isPinalMarker && (
        markerData.formatter === 'startup' ||
        markerData.geographicIntelligence || 
        markerData.spatialInsights || 
        markerData.categoryColor || 
        markerData.fundingStage
      );

      const isPowerMarker = !isWhitneyMarker && !isTDLRMarker && !isPinalMarker && !isStartupMarker && (
        markerData.formatter === 'power'
      );
      
      let newPopupData;
      
      if (isWhitneyMarker) {
        // Create Whitney popup data
        newPopupData = {
          id: markerData.id || 'whitney-marker',
          name: markerData.name || 'Whitney Data Center Campus',
          type: 'whitney',
          category: markerData.category,
          zonesAnalyzed: markerData.zonesAnalyzed,
          cachedDataAvailable: markerData.cachedDataAvailable,
          analysisStatus: markerData.analysisStatus,
          coordinates: markerData.coordinates ? {
            lng: markerData.coordinates[0],
            lat: markerData.coordinates[1]
          } : null,
          geometry: markerData.coordinates ? {
            type: 'Point',
            coordinates: markerData.coordinates
          } : null,
          formatter: 'pinal'
        };
      } else if (isTDLRMarker) {
        // Create TDLR popup data
        newPopupData = {
          id: markerData.id || `tdlr_${Date.now()}`,
          name: markerData.name || markerData.title || markerData.project_name,
          title: markerData.title || markerData.project_name,
          type: 'tdlr',
          category: markerData.category || 'Construction Project',
          address: markerData.address || markerData.formatted_address,
          // TDLR-specific properties
          project_name: markerData.project_name,
          project_id: markerData.project_id,
          facility_name: markerData.facility_name,
          work_type: markerData.work_type,
          status: markerData.status,
          cost: markerData.cost,
          city: markerData.city,
          county: markerData.county,
          formatted_address: markerData.formatted_address,
          geocoded_method: markerData.geocoded_method,
          scraped_at: markerData.scraped_at,
          estimated_completion: markerData.estimated_completion,
          contractor: markerData.contractor,
          owner: markerData.owner,
          // Add coordinates for auto-zoom functionality
          coordinates: markerData.coordinates ? {
            lng: markerData.coordinates[0],
            lat: markerData.coordinates[1]
          } : null,
          geometry: markerData.coordinates ? {
            type: 'Point',
            coordinates: markerData.coordinates
          } : null,
          // Use the TDLR formatter
          formatter: 'tdlr'
        };
      } else if (isStartupMarker) {
        // Parse JSON strings for geographic intelligence and spatial insights if they exist
        let geographicIntelligence = null;
        let spatialInsights = null;
        
        try {
          if (typeof markerData.geographicIntelligence === 'string') {
            geographicIntelligence = JSON.parse(markerData.geographicIntelligence);
          } else {
            geographicIntelligence = markerData.geographicIntelligence;
          }
        } catch (error) {
          console.warn('Failed to parse geographicIntelligence:', error);
        }
        
        try {
          if (typeof markerData.spatialInsights === 'string') {
            spatialInsights = JSON.parse(markerData.spatialInsights);
          } else {
            spatialInsights = markerData.spatialInsights;
          }
        } catch (error) {
          console.warn('Failed to parse spatialInsights:', error);
        }
        
        // Create rich startup popup data
        newPopupData = {
          id: markerData.id || `startup_${Date.now()}`,
          name: markerData.name || markerData.title,
          type: 'startup',
          category: markerData.category,
          categoryColor: markerData.categoryColor,
          fundingStage: markerData.fundingStage,
          industries: markerData.industries,
          address: markerData.address,
          headquarters: markerData.headquarters,
          geographicIntelligence: geographicIntelligence,
          spatialInsights: spatialInsights,
          description: markerData.description,
          url: markerData.url,
          cbRank: markerData.cbRank,
          isActive: markerData.isActive,
          lastFundingDate: markerData.lastFundingDate,
          lastFundingType: markerData.lastFundingType,
          // Add coordinates for auto-zoom functionality
          coordinates: markerData.coordinates ? {
            lng: markerData.coordinates[0],
            lat: markerData.coordinates[1]
          } : null,
          geometry: markerData.coordinates ? {
            type: 'Point',
            coordinates: markerData.coordinates
          } : null,
          // Use the startup formatter
          formatter: 'startup'
        };
      } else if (isPinalMarker) {
        console.log('🔍 [MarkerPopupManager] Creating Pinal marker popup', {
          markerData,
          isPinalMarker,
          timestamp: new Date().toISOString(),
          willCreatePopup: true
        });
        
        newPopupData = {
          id: markerData.id || `pinal_${Date.now()}`,
          name: markerData.name,
          type: markerData.type || 'Infrastructure Analysis',
          category: markerData.category,
          siteMetadata: markerData.siteMetadata,
          summary: markerData.summary,
          categories: markerData.categories,
          analysisStatus: markerData.analysisStatus,
          zonesAnalyzed: markerData.zonesAnalyzed,
          cachedDataAvailable: markerData.cachedDataAvailable,
          coordinates: markerData.coordinates ? {
            lng: markerData.coordinates[0],
            lat: markerData.coordinates[1]
          } : null,
          geometry: markerData.coordinates ? {
            type: 'Point',
            coordinates: markerData.coordinates
          } : null,
          formatter: 'pinal'
        };
        
        console.log('🔍 [MarkerPopupManager] Pinal popup data created', {
          newPopupData,
          timestamp: new Date().toISOString()
        });
      } else if (isPowerMarker) {
        const coordinates = markerData.coordinates || markerData.geometry?.coordinates || null;
        const arrayCoords = Array.isArray(coordinates)
          ? coordinates
          : coordinates && coordinates.lng !== undefined && coordinates.lat !== undefined
            ? [coordinates.lng, coordinates.lat]
            : null;

        newPopupData = {
          id: markerData.id || `power_${Date.now()}`,
          name: markerData.name || markerData.title || 'Critical Power Node',
          type: 'power',
          siteName: markerData.siteName,
          shortName: markerData.shortName,
          voltageCategory: markerData.voltageCategory,
          maxVoltageKv: markerData.maxVoltageKv,
          component: markerData.component,
          operator: markerData.operator,
          importance: markerData.importance,
          content: markerData.content || {
            description: markerData.popupDescription,
            data: markerData.popupData
          },
          theme: markerData.theme || 'blue',
          coordinates: arrayCoords
            ? { lng: arrayCoords[0], lat: arrayCoords[1] }
            : null,
          geometry: arrayCoords
            ? { type: 'Point', coordinates: arrayCoords }
            : null,
          formatter: 'power'
        };
      } else {
        // Create standard popup data for other markers
        newPopupData = {
          id: `marker_${Date.now()}`,
          name: markerData.title,
          type: markerData.category,
          address: markerData.address,
          rating: markerData.rating,
          phone: markerData.phone,
          website: markerData.website,
          distance: markerData.distance,
          description: markerData.description,
          hours: markerData.hours,
          // Add coordinates for auto-zoom functionality
          coordinates: markerData.coordinates ? {
            lng: markerData.coordinates[0],
            lat: markerData.coordinates[1]
          } : null,
          geometry: markerData.coordinates ? {
            type: 'Point',
            coordinates: markerData.coordinates
          } : null,
          formatter: 'standard'
        };
      }
      
      // Handle Whitney markers differently - allow multiple popups
      if (isWhitneyMarker) {
        // Check if this Pinal popup already exists - use functional update to ensure we check current state
        setWhitneyPopups(prev => {
          const existingPopup = prev.find(popup => popup.id === markerId);
          if (existingPopup) {
            // Remove existing popup if clicked again
            return prev.filter(popup => popup.id !== markerId);
          }
          
          // Add new Whitney popup with offset position
          const offsetX = markerData.id === 'lucid-motors-casa-grande' ? 200 : 0;
          const offsetY = markerData.id === 'lucid-motors-casa-grande' ? 100 : 
                         markerData.id === 'casa-grande-marker' ? -50 : 0;
          
          let position = null;
          if (markerData.coordinates && map.current) {
            const screenPos = map.current.project(markerData.coordinates);
            position = { 
              x: screenPos.x + offsetX, 
              y: screenPos.y + offsetY 
            };
          }
          
          // Add to Whitney popups array - ensure no duplicates by checking again
          const alreadyExists = prev.some(popup => popup.id === markerId);
          if (alreadyExists) {
            console.warn('⚠️ [MarkerPopupManager] Duplicate popup detected, skipping:', markerId);
            return prev; // Return unchanged if duplicate
          }
          
          return [...prev, {
            id: markerId,
            data: newPopupData,
            position: position,
            isVisible: true,
            isManualClick: !isAutomaticPopup // Manual click if not automatic
          }];
        });
        
        // Set auto-close timer for this Pinal popup (extended for typewriter animation)
        // Check if this is a typewriter-enhanced popup (Whitney Data Center Campus)
        const isTypewriterPopup = markerData.name === 'Whitney Data Center Campus';
        const autoCloseDelay = isTypewriterPopup ? 12000 : 9000; // +3 seconds across the board
        
        const timeoutId = setTimeout(() => {
          setWhitneyPopups(prev => prev.filter(p => p.id !== markerId));
          delete whitneyAutoCloseTimeoutsRef.current[markerId];
        }, autoCloseDelay);
        whitneyAutoCloseTimeoutsRef.current[markerId] = timeoutId;
        
        return; // Skip the regular popup logic for Whitney markers
      }
      
      console.log('🔍 [MarkerPopupManager] Setting popup data and showing popup', {
        newPopupData,
        hasCoordinates: !!markerData.coordinates,
        coordinates: markerData.coordinates,
        timestamp: new Date().toISOString()
      });
      
      setPopupData(newPopupData);
      popupDataRef.current = newPopupData;
      
      // Show popup at marker coordinates immediately (no delay for table clicks)
      if (markerData.coordinates && map?.current) {
        // Ensure coordinates are in the correct format for Mapbox project()
        let coords = markerData.coordinates;
        
        // Convert to [lng, lat] if needed
        if (Array.isArray(coords) && coords.length === 2) {
          // Already in correct format
        } else if (typeof coords === 'object' && coords !== null) {
          // Convert from {lng, lat} or {lon, lat} to [lng, lat]
          if (coords.lng !== undefined && coords.lat !== undefined) {
            coords = [coords.lng, coords.lat];
          } else if (coords.lon !== undefined && coords.lat !== undefined) {
            coords = [coords.lon, coords.lat];
          } else {
            console.error('❌ MarkerPopupManager: Invalid coordinates format in markerData:', coords);
            return; // Don't show popup if coordinates are invalid
          }
        } else {
          console.error('❌ MarkerPopupManager: Coordinates must be an array or object:', coords);
          return; // Don't show popup if coordinates are invalid
        }
        
        try {
          const screenPosition = map.current.project(coords);
          setPopupPosition({
            x: screenPosition.x,
            y: screenPosition.y
          });
          setOriginalCoordinates(coords);
          
          // Show popup immediately for table row clicks
          console.log('🔍 [MarkerPopupManager] Setting popup to visible', {
            popupPosition: { x: screenPosition.x, y: screenPosition.y },
            coordinates: coords,
            popupData: newPopupData,
            timestamp: new Date().toISOString()
          });
          
          setIsVisible(true);
        } catch (error) {
          console.error('❌ MarkerPopupManager: Error projecting coordinates:', error, 'Coordinates:', coords);
          return; // Don't show popup if projection fails
        }
        
        // Set auto-close timer for 6 seconds
        if (autoCloseTimeoutRef.current) {
          clearTimeout(autoCloseTimeoutRef.current);
        }
        autoCloseTimeoutRef.current = setTimeout(() => {
          closePopup();
        }, 9000);
        // Popup now visible
      }
    };

    // Listen for legend matching results to get coordinates
    const handleLegendMatchFound = (markerData) => {
      const currentPopupData = popupDataRef.current;
      
      if (markerData.coordinates && map?.current && currentPopupData) {
        const screenPosition = map.current.project(markerData.coordinates);
        
        setPopupPosition({
          x: screenPosition.x,
          y: screenPosition.y
        });
        
        setOriginalCoordinates(markerData.coordinates);
        setIsVisible(true);
        
        // Set auto-close timer for 6 seconds
        if (autoCloseTimeoutRef.current) {
          clearTimeout(autoCloseTimeoutRef.current);
        }
        autoCloseTimeoutRef.current = setTimeout(() => {
          closePopup();
        }, 9000);
        
        // Trigger animation when marker is found
        if (window.nodeAnimation) {
          const animationType = markerData.category === 'power plants' ? 'pulse' :
                               markerData.category === 'electric utilities' ? 'ripple' :
                               markerData.category === 'water facilities' ? 'glow' :
                               markerData.category === 'data centers' ? 'heartbeat' : 'pulse';
          
          window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
            type: animationType,
            intensity: 0.8,
            duration: 3.0,
            nodeData: markerData,
            category: markerData.category // Use the actual marker category
          });
          console.log('Animation triggered for:', markerData.title, 'category:', markerData.category);
        }
      }
    };

    // Handle table row clicks to highlight corresponding map markers
    const handleTableRowClicked = (data) => {
      console.log('Table row clicked, highlighting marker:', data);
      
      // Highlight the marker immediately
      highlightMarker(data);
      
      // Get the actual map instance from the ref
      const mapInstance = map?.current || map;
      
      // Check if map is available and has the required methods
      if (!mapInstance || typeof mapInstance.getSource !== 'function') {
        console.warn('Map not available or not a Mapbox GL JS instance', { 
          map, 
          mapInstance, 
          hasGetSource: typeof mapInstance?.getSource 
        });
        return;
      }
      
      // Define proceedWithHighlighting function inside the scope where data and mapInstance are available
      const proceedWithHighlighting = () => {
        // For real estate data, the highlighting is already handled by the highlightMarker function
        // This function is mainly for startup data, so we can skip it for real estate
        if (data.nodeType && (data.nodeType.includes('Commercial') || data.nodeType.includes('Residential'))) {
          console.log('Real estate data - highlighting already handled by highlightMarker function');
          return;
        }
        
        // Find the corresponding marker on the map
        if (data.nodeData) {
          // Try to find marker by name match
          const markerName = data.nodeName || data.nodeData.name;
          if (markerName) {
            // Look for SERP markers first
            let serpSource;
            try {
              serpSource = mapInstance.getSource('serp-startup-ecosystem');
            } catch (error) {
              console.warn('🎯 Error accessing SERP source:', error);
              serpSource = null;
            }
            
            if (serpSource) {
              const features = serpSource._data?.features || [];
              // SERP source found
              
              const matchingFeature = features.find(feature => {
                const featureName = feature.properties?.name || feature.properties?.title || '';
                const featureNameLower = featureName.toLowerCase();
                const markerNameLower = markerName.toLowerCase();
                
                // Try exact match first
                if (featureNameLower === markerNameLower) {
                  return true;
                }
                
                // Try partial match
                if (featureNameLower.includes(markerNameLower) || markerNameLower.includes(featureNameLower)) {
                  return true;
                }
                
                // Try matching key words (remove common prefixes/suffixes)
                const cleanMarkerName = markerNameLower
                  .replace(/^(startup company|investor\/vc|co-working space|university\/research)\s*[–-]\s*/i, '')
                  .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
                  .trim();
                
                const cleanFeatureName = featureNameLower
                  .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
                  .trim();
                
                if (cleanMarkerName && cleanFeatureName && 
                    (cleanFeatureName.includes(cleanMarkerName) || cleanMarkerName.includes(cleanFeatureName))) {
                  return true;
                }
                
                return false;
              });
              
              if (matchingFeature) {
                // Found matching SERP feature
                
                // Use serp_id for filtering, fallback to name if serp_id is not available
                const filterValue = matchingFeature.properties.serp_id || matchingFeature.properties.name;
                
                if (filterValue) {
                  // Highlight the marker
                  mapInstance.setFilter('serp-startup-ecosystem-markers', [
                    '==', ['get', 'serp_id'], filterValue
                  ]);
                } else {
                  console.warn('🎯 No valid identifier found for SERP feature:', matchingFeature.properties);
                  return;
                }
                
                // Center map on the marker
                mapInstance.flyTo({
                  center: matchingFeature.geometry.coordinates,
                  zoom: Math.max(mapInstance.getZoom(), 15),
                  duration: 1000
                });
                
                // Highlighted SERP marker
                return;
              } else {
                console.log('🎯 No SERP marker match found for:', markerName);
              }
            }
            
            // Look for OSM markers if SERP not found
            // Checking OSM layers for marker
            const osmLayers = ['osm-universities', 'osm-offices', 'osm-transportation-stations'];
            for (const layer of osmLayers) {
              try {
                if (mapInstance.getLayer(layer)) {
                  const source = mapInstance.getSource(layer.replace('-markers', ''));
                  if (source) {
                    const features = source._data?.features || [];
                    // OSM layer features found
                    
                    if (features.length > 0) {
                      // Sample OSM names available
                    }
                    
                    const matchingFeature = features.find(feature => {
                      const featureName = feature.properties?.name || feature.properties?.title || '';
                      const featureNameLower = featureName.toLowerCase();
                      const markerNameLower = markerName.toLowerCase();
                      
                      // Try exact match first
                      if (featureNameLower === markerNameLower) {
                        return true;
                      }
                      
                      // Try partial match
                      if (featureNameLower.includes(markerNameLower) || markerNameLower.includes(featureNameLower)) {
                        return true;
                      }
                      
                      // Try clean matching (remove prefixes/suffixes)
                      const cleanMarkerName = markerNameLower
                        .replace(/^(startup company|investor\/vc|co-working space|university\/research)\s*[–-]\s*/i, '')
                        .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
                        .trim();
                      
                      const cleanFeatureName = featureNameLower
                        .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
                        .trim();
                      
                      if (cleanMarkerName && cleanFeatureName && 
                          (cleanFeatureName.includes(cleanMarkerName) || cleanMarkerName.includes(cleanFeatureName))) {
                        return true;
                      }
                      
                      return false;
                    });
                    
                    if (matchingFeature) {
                      // Found matching OSM feature
                      
                      // Use osm_id for filtering, fallback to name if osm_id is not available
                      const filterValue = matchingFeature.properties.osm_id || matchingFeature.properties.name;
                      
                      if (filterValue) {
                        // Highlight the marker
                        mapInstance.setFilter(`${layer}-markers`, [
                          '==', ['get', 'osm_id'], filterValue
                        ]);
                      } else {
                        console.warn('🎯 No valid identifier found for OSM feature:', matchingFeature.properties);
                        return;
                      }
                      
                      // Center map on the marker
                      mapInstance.flyTo({
                        center: matchingFeature.geometry.coordinates,
                        zoom: Math.max(mapInstance.getZoom(), 15),
                        duration: 1000
                      });
                      
                      // Highlighted OSM marker
                      return;
                    }
                  }
                }
              } catch (error) {
                console.warn('🎯 Error accessing OSM layer:', layer, error);
              }
            }
            
            // Final fallback: Try to find any marker with similar characteristics
            
            // Try to find by category/type matching
            
            const nodeType = data.nodeType || '';
            const nodeCategory = data.nodeData?.type || '';
            
            // Fallback - Node type analysis
            
            // Try to find by category in SERP data
            if (serpSource) {
              const features = serpSource._data?.features || [];
              const categoryMatch = features.find(feature => {
                const featureCategory = feature.properties?.category || '';
                const featureName = feature.properties?.name || feature.properties?.title || '';
                
                // Try category matching
                if (nodeCategory && featureCategory.toLowerCase().includes(nodeCategory.toLowerCase())) {
                  return true;
                }
                
                // Try type matching
                if (nodeType && featureName.toLowerCase().includes(nodeType.toLowerCase())) {
                  return true;
                }
                
                return false;
              });
              
              if (categoryMatch) {
                // Found fallback match
                
                // Use serp_id for filtering, fallback to name if serp_id is not available
                const filterValue = categoryMatch.properties.serp_id || categoryMatch.properties.name;
                
                if (filterValue) {
                  // Highlight the marker
                  mapInstance.setFilter('serp-startup-ecosystem-markers', [
                    '==', ['get', 'serp_id'], filterValue
                  ]);
                } else {
                  console.warn('🎯 No valid identifier found for fallback match:', categoryMatch.properties);
                  return;
                }
                
                // Center map on the marker
                mapInstance.flyTo({
                  center: categoryMatch.geometry.coordinates,
                  zoom: Math.max(mapInstance.getZoom(), 15),
                  duration: 1000
                });
                
                // Highlighted fallback marker
                return;
              }
            }
            
            console.warn('No matching marker found for:', markerName);
          }
        }
      };
      
      // Try to proceed immediately first, with fallback for style loading
      try {
        // Check if we can access sources directly
        const testSource = mapInstance.getSource('serp-startup-ecosystem');
        if (testSource) {
          // Map sources accessible, proceeding with highlighting
          proceedWithHighlighting();
          return;
        }
      } catch (error) {
        // Sources not accessible yet, waiting for map to load
      }
      
      // If sources aren't accessible, wait for map to load
      if (!mapInstance.isStyleLoaded()) {
        console.warn('Map style not loaded yet, waiting...');
        
        // Add timeout to prevent infinite waiting
        const timeoutId = setTimeout(() => {
          console.warn('Map style loading timeout, proceeding anyway...');
          proceedWithHighlighting();
        }, 2000); // 2 second timeout
        
        // Wait for map to load
        mapInstance.once('styledata', () => {
          clearTimeout(timeoutId);
          // Map style loaded, proceeding with highlighting
          proceedWithHighlighting();
        });
        
        return;
      }
      
      proceedWithHighlighting();
    };

    // Listen for startup marker clicks directly as well
    const handleStartupMarkerClick = (eventData) => {
      // MarkerPopupManager received startup:markerClick event
      
      // Convert startup marker click to marker:clicked format
      const markerData = {
        ...eventData,
        coordinates: eventData.coordinates,
        id: eventData.nodeId || eventData.id
      };
      
      // Call the same handler as marker:clicked
      handleMarkerClicked(markerData);
    };

    // Listen for real estate marker clicks
    const handleRealEstateMarkerClick = (eventData) => {
      // MarkerPopupManager received realEstate:markerClick event
      
      // Ensure coordinates are in the correct format for Mapbox
      let coordinates = eventData.coordinates;
      
      // Convert coordinates to [lng, lat] format if needed
      if (coordinates) {
        if (Array.isArray(coordinates) && coordinates.length === 2) {
          // Already in [lng, lat] format
          coordinates = coordinates;
        } else if (typeof coordinates === 'object') {
          // Convert from {lng, lat} or {lon, lat} to [lng, lat]
          if (coordinates.lng !== undefined && coordinates.lat !== undefined) {
            coordinates = [coordinates.lng, coordinates.lat];
          } else if (coordinates.lon !== undefined && coordinates.lat !== undefined) {
            coordinates = [coordinates.lon, coordinates.lat];
          } else {
            console.warn('⚠️ MarkerPopupManager: Invalid coordinates format:', coordinates);
            coordinates = null;
          }
        } else {
          console.warn('⚠️ MarkerPopupManager: Coordinates must be an array or object:', coordinates);
          coordinates = null;
        }
      }
      
      // Convert real estate marker click to marker:clicked format
      const markerData = {
        ...eventData,
        coordinates: coordinates,
        id: eventData.nodeId || eventData.id,
        title: eventData.nodeName || eventData.name,
        type: 'realEstate',
        category: eventData.category,
        propertyType: eventData.propertyType,
        price: eventData.price,
        address: eventData.address
      };
      
      // Only call handler if we have valid coordinates
      if (coordinates) {
      handleMarkerClicked(markerData);
      } else {
        console.warn('⚠️ MarkerPopupManager: Cannot show popup - invalid or missing coordinates');
      }
    };

    // TDLR marker clicks are handled by the main handleMarkerClicked function
    // No need for separate handler since TDLR layer emits marker:clicked directly

    window.mapEventBus.on('table:nodeSelected', handleTableNodeSelected);
    window.mapEventBus.on('table:rowClicked', handleTableRowClicked);
    window.mapEventBus.on('legend:matchFound', handleLegendMatchFound);
    window.mapEventBus.on('marker:clicked', handleMarkerClicked);
    window.mapEventBus.on('startup:markerClick', handleStartupMarkerClick);
    window.mapEventBus.on('realEstate:markerClick', handleRealEstateMarkerClick);

    return () => {
      // Clear any pending highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      window.mapEventBus.off('table:nodeSelected', handleTableNodeSelected);
      window.mapEventBus.off('table:rowClicked', handleTableRowClicked);
      window.mapEventBus.off('legend:matchFound', handleLegendMatchFound);
      window.mapEventBus.off('marker:clicked', handleMarkerClicked);
      window.mapEventBus.off('startup:markerClick', handleStartupMarkerClick);
      window.mapEventBus.off('realEstate:markerClick', handleRealEstateMarkerClick);
    };
  }, [map, isVisible, popupData?.id, highlightMarker]);

  // Update popup position when map moves
  useEffect(() => {
    if (!map?.current || !isVisible || !popupData) return;

    const mapInstance = map.current; // Store reference to avoid stale closure

    const updatePopupPosition = () => {
      if (popupData && originalCoordinates && mapInstance) {
        // Recalculate position based on current map state
        const newScreenPosition = mapInstance.project(originalCoordinates);
        setPopupPosition({
          x: newScreenPosition.x,
          y: newScreenPosition.y
        });
        // Removed verbose logging - only log on initial setup
      }
    };

    // Add map movement listeners
    mapInstance.on('move', updatePopupPosition);
    mapInstance.on('zoom', updatePopupPosition);
    mapInstance.on('pitch', updatePopupPosition);
    mapInstance.on('bearing', updatePopupPosition);

    return () => {
      // Cleanup map movement listeners
      mapInstance.off('move', updatePopupPosition);
      mapInstance.off('zoom', updatePopupPosition);
      mapInstance.off('pitch', updatePopupPosition);
      mapInstance.off('bearing', updatePopupPosition);
    };
  }, [map, isVisible, popupData, originalCoordinates]);

  // Close popup function
  const closePopup = useCallback(() => {
    setIsVisible(false);
    setPopupData(null);
    setPopupPosition(null);
    setOriginalCoordinates(null);
    popupDataRef.current = null;
    
    // Clear auto-close timeout
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear single popup timeout
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
      
      // Clear all Pinal popup timeouts
      Object.values(whitneyAutoCloseTimeoutsRef.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      whitneyAutoCloseTimeoutsRef.current = {};
    };
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    if (!isVisible) {
      // Clean up any existing click-outside handler when popup is not visible
      if (clickOutsideHandlerRef.current) {
        document.removeEventListener('click', clickOutsideHandlerRef.current);
        clickOutsideHandlerRef.current = null;
      }
      return;
    }

    const handleClickOutside = (event) => {
      // Check if click is outside the popup
      const popupElement = document.querySelector('[data-marker-popup]');
      if (popupElement && !popupElement.contains(event.target)) {
        // Don't close if clicking on table rows or their children
        const isTableRow = event.target.closest('tr[data-node-id]') || 
                          event.target.closest('td') || 
                          event.target.closest('th') ||
                          event.target.closest('table');
        
        if (isTableRow) {
          return;
        }
        
        closePopup();
      }
    };

    // Store the handler reference
    clickOutsideHandlerRef.current = handleClickOutside;

    // Add click listener with a longer delay to avoid immediate closure from table row clicks
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (clickOutsideHandlerRef.current) {
        document.removeEventListener('click', clickOutsideHandlerRef.current);
        clickOutsideHandlerRef.current = null;
      }
    };
  }, [isVisible, closePopup, popupData?.id]);

  // Add map event listeners for Whitney popup position updates
  useEffect(() => {
    if (!map?.current || whitneyPopups.length === 0) return;

    const mapInstance = map.current;
    
    const handleMapMove = () => {
      updateWhitneyPopupPositions();
    };

    // Add event listeners
    mapInstance.on('move', handleMapMove);
    mapInstance.on('zoom', handleMapMove);
    mapInstance.on('rotate', handleMapMove);
    mapInstance.on('pitch', handleMapMove);

    return () => {
      mapInstance.off('move', handleMapMove);
      mapInstance.off('zoom', handleMapMove);
      mapInstance.off('rotate', handleMapMove);
      mapInstance.off('pitch', handleMapMove);
    };
  }, [map, whitneyPopups.length, updateWhitneyPopupPositions]);

  return (
    <>
      {/* Regular popup */}
      <MarkerPopupCard
        nodeData={popupData}
        position={popupPosition}
        isVisible={isVisible}
        onClose={closePopup}
        map={map}
      />
      
      {/* Multiple Whitney popups */}
      {whitneyPopups.map((popup, index) => (
        <MarkerPopupCard
          key={`${popup.id}-${index}-${popup.data?.timestamp || Date.now()}`}
          nodeData={popup.data}
          position={popup.position}
          isVisible={popup.isVisible}
          isManualClick={popup.isManualClick}
          onClose={() => {
            // Clear the auto-close timeout for this popup
            if (whitneyAutoCloseTimeoutsRef.current[popup.id]) {
              clearTimeout(whitneyAutoCloseTimeoutsRef.current[popup.id]);
              delete whitneyAutoCloseTimeoutsRef.current[popup.id];
            }
            setWhitneyPopups(prev => prev.filter(p => p.id !== popup.id));
          }}
          map={map}
        />
      ))}
    </>
  );
};

export default MarkerPopupManager;
