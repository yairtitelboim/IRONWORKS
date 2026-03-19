import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AIQuestionsSection from './AIQuestionsSection';
import SidePanel from './SidePanel';
import NestedCircleButton from './NestedCircleButton';
import LegendContainer from './LegendContainer';
import MarkerPopupManager from './MarkerPopupManager';
import OnboardingTour from './OnboardingTour';

import { useAIQuery } from '../../../../hooks/useAIQuery';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../../constants';
import '../../../../utils/CacheDebugger.js'; // Initialize cache debugger
import { getGeographicConfig } from '../../../../config/geographicConfig.js';
import { resetGlobalMarkerStyling, updateGlobalToolExecutorLocation, setGlobalToolExecutor, getGlobalToolExecutor } from '../../../../utils/PowerGridToolExecutor';
import { clearResponseCache, getResponseCacheStats } from '../../../../utils/ResponseCache';
import { 
  createClickableTruncation
} from './textUtils';
import NodeAnimation from '../../../../utils/nodeAnimation';
import * as turf from '@turf/turf';

const DEFAULT_SEARCH_MARKET_RADIUS_MI = 25;

// Add CSS animations for card effects
const cardStyles = `
  @keyframes cardSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes cardPulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  @keyframes questionCardShimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes buttonSlideIn {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeIn {
    0% {
      opacity: 0;
      transform: translateY(-5px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes cacheCountdownPulse {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }
  
  @keyframes buttonShimmer {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    20% {
      opacity: 0.3;
    }
    80% {
      opacity: 0.3;
    }
    100% {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes skeletonPulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
  
  @keyframes skeletonShimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
  
  @keyframes slideInFromRight {
    0% {
      opacity: 0;
      transform: translateX(20px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  /* Custom scrollbar styling */
  .sources-scroll::-webkit-scrollbar {
    width: 6px;
  }
  
  .sources-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .sources-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  .sources-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = cardStyles;
  if (!document.head.querySelector('style[data-card-animations]')) {
    styleElement.setAttribute('data-card-animations', 'true');
    document.head.appendChild(styleElement);
  }
}

const BaseCard = ({
  id,
  title,
  content,
  style,
  position,
  onClose,
  onNavigate,
  children,
  draggable = true,
  pinnable = true,
  closable = true,
  map
}) => {
  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const effectiveDraggable = draggable && !isMobile;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const perplexityContainerRef = useRef(null);
  
  // UI state variables (non-AI related)
  const [currentQuestions, setCurrentQuestions] = useState('initial');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFollowupButtons, setShowFollowupButtons] = useState(false);
  const [showFollowupContent, setShowFollowupContent] = useState(false);
  const [hasShownFollowup, setHasShownFollowup] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState('claude');
  const [aiProviderDropdownOpen, setAiProviderDropdownOpen] = useState(false);
  
  // Location state - Default to Austin, TX for Tx transmission analysis
  const [currentLocation, setCurrentLocation] = useState('texas');
  const [isLucidAnimationVisible, setIsLucidAnimationVisible] = useState(false);
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const [lucidStats, setLucidStats] = useState(null);
  
  // Location change handler
  const handleLocationChange = (newLocationKey) => {
    console.log('🔄 BaseCard: Location changing to', newLocationKey);
    setCurrentLocation(newLocationKey);
    setAvailableAnimations([]);
    if (newLocationKey !== 'lucid_ev_campus') {
      setLucidStats(null);
    }
    // Update the global tool executor location for location-aware analysis
    updateGlobalToolExecutorLocation(newLocationKey);
  };

  // Ensure global tool executor is available for location changes
  useEffect(() => {
    if (map?.current && !getGlobalToolExecutor()) {
      // Create a global tool executor instance for location management
      const { createPowerGridToolExecutor } = require('../../../../utils/PowerGridToolExecutor');
      const toolExecutor = createPowerGridToolExecutor(map, () => {}, null);
      setGlobalToolExecutor(toolExecutor);
    }
  }, [map]);
  const [collapsedResponses, setCollapsedResponses] = useState(new Set()); // Track which responses are collapsed
  const [selectedResponseIndex, setSelectedResponseIndex] = useState(-1); // Which response to show in main card
  const [responseMenuOpen, setResponseMenuOpen] = useState(false); // Yellow + menu open (dim main card)
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is the initial load
  
  // Tool feedback state
  const [toolFeedback, setToolFeedback] = useState({
    isActive: false,
    tool: null, // 'osm', 'serp', 'alphaearth', 'claude', etc.
    status: '',
    progress: 0,
    details: '',
    timestamp: null
  });

  // Marker details state
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Legend state
  const [showLegend, setShowLegend] = useState(false);

  // View mode state for dual analysis
  const [viewMode, setViewMode] = useState('node'); // 'node' | 'site' - Default to NODE for table display
  
  // Perplexity mode state
  const [isPerplexityMode, setIsPerplexityMode] = useState(false);
  
  // Animation system state
  const [nodeAnimation, setNodeAnimation] = useState(null);

  // Function to update tool feedback from nested circle tools
  const updateToolFeedback = useCallback((feedback) => {
    setToolFeedback({
      ...feedback,
      timestamp: Date.now()
    });
  }, []);

  // Function to handle marker clicks - memoized to prevent unnecessary re-renders
  const handleMarkerClick = useCallback((markerData) => {
    setSelectedMarker(markerData);
    setViewMode('node');
    setSelectedAIProvider('perplexity'); // Switch to Perplexity in TopBar
    
    // Emit marker selection event for legend highlighting
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:selected', markerData);
    }
    
    // Emit marker clicked event for popup display
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', markerData);
    }
    
    // Trigger animation when marker is clicked
    if (window.nodeAnimation && markerData.coordinates) {
      const animationType = markerData.category === 'power plants' ? 'pulse' :
                           markerData.category === 'electric utilities' ? 'ripple' :
                           markerData.category === 'water facilities' ? 'glow' :
                           markerData.category === 'data centers' ? 'heartbeat' : 'pulse';
      
      window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
        type: animationType,
        intensity: 0.8,
        duration: 3.0,
        nodeData: markerData,
        category: markerData.category
      });
    }
  }, []);

  // Function to return to Claude response
  const handleBackToAnalysis = () => {
    setSelectedMarker(null);
    setViewMode('site');
    setSelectedAIProvider('claude'); // Switch back to Claude in TopBar
    // Reset marker styling to remove red highlight
    resetGlobalMarkerStyling();
    
    // Emit marker deselection event for legend
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:deselected');
    }
  };

  // Function to toggle legend - memoized to prevent unnecessary re-renders
  const toggleLegend = useCallback(() => {
    console.log('🔄 BaseCard: toggleLegend called');
    console.log('🔄 BaseCard: Current showLegend:', showLegend);
    console.log('🔄 BaseCard: About to toggle showLegend from', showLegend, 'to', !showLegend);
    
    setShowLegend(prev => {
      console.log('🔄 BaseCard: setShowLegend called, changing from', prev, 'to', !prev);
      return !prev;
    });
    
    console.log('🔄 BaseCard: toggleLegend completed');
  }, [showLegend]);

  // Function to handle view mode changes
  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    
    // Update AI provider based on mode
    if (newViewMode === 'node') {
      setSelectedAIProvider('perplexity');
    } else {
      setSelectedAIProvider('claude');
    }
    
    // If switching to node mode but no marker is selected, automatically switch back to site
    if (newViewMode === 'node' && !selectedMarker) {
      setViewMode('site');
      setSelectedAIProvider('claude');
      return;
    }
  };

  // Function to handle Perplexity mode toggle - memoized to prevent unnecessary re-renders
  const handlePerplexityModeToggle = useCallback(() => {
    console.log('🔄 BaseCard: handlePerplexityModeToggle called');
    console.log('🔄 BaseCard: Current isPerplexityMode:', isPerplexityMode);
    console.log('🔄 BaseCard: Current showLegend:', showLegend);
    console.log('🔄 BaseCard: About to toggle isPerplexityMode from', isPerplexityMode, 'to', !isPerplexityMode);
    
    setIsPerplexityMode(prev => {
      console.log('🔄 BaseCard: setIsPerplexityMode called, changing from', prev, 'to', !prev);
      return !prev;
    });
    
    // Reset other modes when entering Perplexity mode
    if (!isPerplexityMode) {
      console.log('🔄 BaseCard: Entering Perplexity mode - resetting other states');
      setSelectedMarker(null);
      setViewMode('site');
      setSelectedAIProvider('perplexity');
    } else {
      console.log('🔄 BaseCard: Exiting Perplexity mode - keeping current states');
    }
    
    console.log('🔄 BaseCard: handlePerplexityModeToggle completed');
  }, [isPerplexityMode, showLegend]);

  // Use AI Query hook for all AI-related functionality
  const {
    isLoading,
    responses,
    citations,
    pendingRequests,
    handleAIQuery,
    addResponse,
    onLocationFlyTo
  } = useAIQuery(map, updateToolFeedback, handleMarkerClick, currentLocation);

  const hasSearched = (responses?.length ?? 0) > 0 || isLoading;

  const loadLucidSummary = useCallback(async () => {
    if (lucidStats) {
      console.log('🌾 BaseCard: Lucid stats already loaded');
      return lucidStats;
    }

    console.log('🌾 BaseCard: fetching Lucid stats for summary');

    const statPeriods = [
      { period: '2017 → 2018', file: '/data/lucid/lucid_ev_campus_2017_2018_stats.json' },
      { period: '2018 → 2019', file: '/data/lucid/lucid_ev_campus_2018_2019_stats.json' },
      { period: '2019 → 2020', file: '/data/lucid/lucid_ev_campus_2019_2020_stats.json' },
      { period: '2020 → 2021', file: '/data/lucid/lucid_ev_campus_2020_2021_stats.json' },
      { period: '2021 → 2022', file: '/data/lucid/lucid_ev_campus_2021_2022_stats.json' },
      { period: '2022 → 2023', file: '/data/lucid/lucid_ev_campus_2022_2023_stats.json' },
      { period: '2023 → 2024', file: '/data/lucid/lucid_ev_campus_2023_2024_stats.json' },
      { period: '2024 → 2025', file: '/data/lucid/lucid_ev_campus_2024_2025_stats.json' }
    ];

    try {
      const results = await Promise.all(statPeriods.map(async ({ period, file }) => {
        const response = await fetch(file, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`Failed to load ${file} (${response.status})`);
        }
        const data = await response.json();
        const changes = (data.change_stats || [])
          .filter(entry => entry.change_code !== 0)
          .map(entry => ({
            code: entry.change_code,
            label: entry.change_label,
            areaHa: entry.area_ha || 0,
            areaM2: entry.area_m2 || 0
          }));
        return {
          period,
          yearStart: data.year_start,
          yearEnd: data.year_end,
          generatedAt: data.generated_at,
          changes
        };
      }));

      const totals = results.reduce((acc, item) => {
        item.changes.forEach(({ label, areaHa }) => {
          acc[label] = (acc[label] || 0) + areaHa;
        });
        return acc;
      }, {});

      const preparedStats = { periods: results, totals };
      setLucidStats(preparedStats);
      console.log('🌾 Lucid stats ready', totals);
      return preparedStats;
    } catch (error) {
      console.warn('Lucid stats load failed:', error);
      setLucidStats(null);
      return null;
    }
  }, [lucidStats]);

  const handleAnimationSelect = useCallback(async (animation) => {
    console.log('🛰️ BaseCard: handleAnimationSelect invoked', {
      animation
    });
    if (!map?.current || !animation) return;
    
    // Handle PA Nuclear site selection
    if (animation.key === 'three_mile_island_pa' || animation.key === 'susquehanna_nuclear_pa') {
      console.log('⚛️ BaseCard: PA Nuclear site selected', {
        siteKey: animation.key,
        timestamp: new Date().toISOString()
      });
      
      // Update location if needed
      if (currentLocation !== animation.key) {
        setCurrentLocation(animation.key);
      }
      
      // Update tool feedback
      updateToolFeedback({
        isActive: true,
        tool: 'pa_nuclear_gee',
        status: 'Loading PA nuclear GEE change detection data...',
        progress: 10,
        details: `Processing land use change frames for ${animation.key === 'three_mile_island_pa' ? 'Three Mile Island' : 'Susquehanna'}`
      });
      
      // Simulate loading progress
      setTimeout(() => {
        updateToolFeedback({
          isActive: true,
          tool: 'pa_nuclear_gee',
          status: 'Processing land use change frames...',
          progress: 50,
          details: 'Loading GEE change detection data from local JSON files'
        });
      }, 1000);
      
      setTimeout(() => {
        updateToolFeedback({
          isActive: true,
          tool: 'pa_nuclear_gee',
          status: '✅ PA Nuclear GEE animation ready',
          progress: 100,
          details: 'GEE change detection animation mounted and ready'
        });
        
        setTimeout(() => {
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
        }, 2500);
      }, 2000);
      
      return;
    }
    
    // Handle Lucid site selection (existing logic)
    if (animation.key === 'lucid_ev_campus') {
      const config = getGeographicConfig('lucid_ev_campus');
      if (currentLocation !== 'lucid_ev_campus') {
        setCurrentLocation('lucid_ev_campus');
      }
      
      const stats = await loadLucidSummary();
      
      // Create and display the response
      console.log('🌾 BaseCard: creating GeoAI response');
      const analysisTimestamp = new Date().toLocaleString();
      const totals = stats?.totals || {};
      const formatHa = (value) => (typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0.0');
      const summary = `## 🧠 GeoAI Satellite Intelligence (Pre-cached)\n` +
        `**Focus Area:** Pinal County Mega-Project Portfolio  \n` +
        `**Analysis Timestamp:** ${analysisTimestamp}  \n` +
        `**Sites Processed:** 1 (Lucid EV Campus precomputed overlays)\n\n` +
        `### Lucid EV Campus Change Highlights (2017–2025)\n` +
        `- 🟠 Agriculture loss: ${formatHa(totals.agriculture_loss)} ha\n` +
        `- 🟢 Agriculture gain: ${formatHa(totals.agriculture_gain)} ha\n` +
        `- 🟥 Industrial expansion: ${formatHa(totals.industrial_expansion)} ha\n` +
        `- 💧 Water change: ${formatHa(totals.water_change)} ha\n\n` +
        `### Acquisition Window\n` +
        `- Sentinel composites & NAIP overlays retrieved from cached Earth Engine exports\n\n` +
        `### Recommended Next Steps\n` +
        `1. Use layer visibility controls when overlays are re-enabled.\n` +
        `2. Capture Lucid EV corridor screenshots for water and infrastructure briefings.\n` +
        `3. Compare Lucid EV trends with LG Energy and Resolution Copper for regional negotiations.\n\n` +
        `*Pre-computed from Sentinel-2 SR and USDA NAIP via Google Earth Engine.*`;

      const citations = [
        {
          url: 'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR',
          title: 'Sentinel-2 MSI Surface Reflectance',
          snippet: 'Primary dataset for cached true-color composites.'
        },
        {
          url: 'https://developers.google.com/earth-engine/datasets/catalog/USDA_NAIP_DOQQ',
          title: 'USDA NAIP DOQQ',
          snippet: 'High-resolution aerial imagery used in pre-rendered overlays.'
        }
      ];

      const metadata = {
        responseType: 'geoai_change_summary',
        sentinelLookbackDays: 365,
        analysisTimestamp,
        summaryText: summary,
        sites: [
          {
            id: 'lucid_ev_campus',
            name: 'Lucid EV Campus (precomputed)',
            center: { lat: 32.8529, lng: -111.7761 },
            radiusMeters: 2250,
            imagery: {}
          }
        ],
        stats
      };

      await handleAIQuery({
        id: 'geoai_analysis',
        source: 'loading_card_trigger',
        description: 'GeoAI imagery and change summary request',
        shouldRenderOverlays: false,
        shouldExecuteGeoAI: false,
        precomputedSummary: summary,
        precomputedCitations: citations,
        precomputedMetadata: metadata
      });
      
      // Auto-zoom removed - map stays at current position
      setAvailableAnimations([]);
      setIsLucidAnimationVisible(true);
      updateToolFeedback({
        isActive: false,
        tool: null,
        status: '',
        progress: 0,
        details: ''
      });
    }
  }, [map, currentLocation, loadLucidSummary, updateToolFeedback, handleAIQuery]);

  const handleLucidAnimationStart = useCallback(() => {
    handleAnimationSelect({ key: 'lucid_ev_campus' });
  }, [handleAnimationSelect]);

  const handleGeoAIQuery = useCallback(async () => {
    console.log('🌾 BaseCard: handleGeoAIQuery triggered - showing PA Nuclear GEE options', {
      currentLocation
    });
    
    // Always show two PA site options when GeoAI is clicked
    console.log('⚛️ BaseCard: Preparing PA Nuclear GEE animation options');
    
    const paAnimations = [
      {
        key: 'three_mile_island_pa',
        label: 'Site 1 – Three Mile Island (2020–2025)',
        description: 'Land use change detection around Three Mile Island Nuclear Plant'
      },
      {
        key: 'susquehanna_nuclear_pa',
        label: 'Site 2 – Susquehanna Nuclear (2020–2025)',
        description: 'Land use change detection around Susquehanna Nuclear Plant'
      }
    ];
    
    setAvailableAnimations(paAnimations);

    updateToolFeedback({
      isActive: true,
      tool: 'geoai',
      status: 'PA Nuclear sites ready',
      progress: 100,
      details: 'Auto-triggering both site cards in 1 second...'
    });

    console.log('🌾 BaseCard: LoadingCard prepared with PA site options - auto-triggering in 1 second');
    
    // Auto-trigger both site cards 1 second after GeoAI button is clicked
    setTimeout(() => {
      console.log('⚛️ BaseCard: Auto-triggering PA Nuclear site cards', {
        timestamp: new Date().toISOString(),
        sites: paAnimations.map(a => a.key)
      });
      
      // Trigger first site (Three Mile Island)
      handleAnimationSelect(paAnimations[0]);
      
      // Trigger second site (Susquehanna) after a short delay to allow first to initialize
      setTimeout(() => {
        handleAnimationSelect(paAnimations[1]);
      }, 500); // 500ms delay between triggers
      
    }, 1000); // 1 second delay after GeoAI click
  }, [updateToolFeedback, handleAnimationSelect]);

  const handleLucidNaipOverlay = useCallback(async () => {
    console.log('🌾 BaseCard: handleLucidNaipOverlay triggered');
    const expandedRadius = 2250 * 5;
    const expandedRadiusKm = (expandedRadius / 1000).toFixed(1);
    if (currentLocation !== 'lucid_ev_campus') {
      setCurrentLocation('lucid_ev_campus');
    }

    updateToolFeedback({
      isActive: true,
      tool: 'geoai',
      status: 'Rendering Lucid NAIP overlay…',
      progress: 30,
      details: `Requesting live Sentinel + NAIP tiles (~${expandedRadiusKm} km radius)`
    });

    try {
      await handleAIQuery({
        id: 'geoai_analysis',
        source: 'geoai_naip_overlay',
        description: 'Lucid NAIP overlay (live)',
        shouldRenderOverlays: true,
        shouldExecuteGeoAI: true,
        allowedSiteIds: ['lucid_ev_campus'],
        radiusMeters: expandedRadius,
        suppressHalo: false,
        disableRaster: true
      });

      updateToolFeedback({
        isActive: true,
        tool: 'geoai',
        status: 'Lucid NAIP overlay ready',
        progress: 100,
        details: `Live NAIP + Sentinel tiles rendered (~${expandedRadiusKm} km radius)`
      });

      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 2500);

    } catch (error) {
      console.error('❌ Lucid NAIP overlay error:', error);
      updateToolFeedback({
        isActive: true,
        tool: 'geoai',
        status: 'NAIP overlay failed',
        progress: 0,
        details: error.message || 'Unknown error'
      });

      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 2500);
    }
  }, [currentLocation, handleAIQuery, updateToolFeedback]);
  
  // Select which response to show in main card (called from yellow + menu)
  const handleSelectResponse = useCallback((index) => {
    setSelectedResponseIndex(index);
  }, []);

  // Auto-select latest response when a new one is added
  useEffect(() => {
    if (responses.length === 0) return;
    setSelectedResponseIndex(responses.length - 1);
  }, [responses.length]);

  const effectiveSelectedIndex = responses.length > 0
    ? (selectedResponseIndex >= 0 ? Math.min(selectedResponseIndex, responses.length - 1) : responses.length - 1)
    : -1;

  // Fly map to selected response's location when switching via menu
  useEffect(() => {
    if (!map?.current || responses.length === 0 || effectiveSelectedIndex < 0) return;
    const responseData = responses[effectiveSelectedIndex];
    const meta = responseData?.metadata || {};

    if (meta.responseType === 'location_search' && meta.coordinates?.length >= 2) {
      const [lng, lat] = meta.coordinates;
      const isCountyShapeSelection =
        (meta.source === 'ercot-counties' || meta.txPrecomputedType === 'tx_county_detail') &&
        !!meta.geometry;

      if (isCountyShapeSelection) {
        try {
          const bbox = turf.bbox(turf.feature(meta.geometry));
          map.current.fitBounds(bbox, {
            padding: isMobile
              ? { top: 80, right: 24, bottom: 300, left: 24 }
              : { top: 90, right: 90, bottom: 90, left: 90 },
            duration: 1000,
            maxZoom: 9
          });
        } catch (err) {
          console.warn('BaseCard: Error fitting county bounds from location_search metadata', err);
          onLocationFlyTo?.([lng, lat], meta.displayName || '', { radiusMiles: DEFAULT_SEARCH_MARKET_RADIUS_MI });
        }
      } else {
        onLocationFlyTo?.([lng, lat], meta.displayName || '', { radiusMiles: DEFAULT_SEARCH_MARKET_RADIUS_MI });
      }
      if (window.mapEventBus) {
        window.mapEventBus.emit('location-search:ring:show', {
          center: [lng, lat],
          radiusMiles: DEFAULT_SEARCH_MARKET_RADIUS_MI,
          source: 'location_search'
        });
      }
    } else if (meta.responseType === 'texas_data_center_detail') {
      const globalStore = typeof window !== 'undefined' ? window.__lastTexasDataCenterPowerCircle : null;
      const center = (globalStore?.center && Array.isArray(globalStore.center) && globalStore.center.length >= 2)
        ? [Number(globalStore.center[0]), Number(globalStore.center[1])]
        : (meta.coordinates?.length >= 2 ? meta.coordinates : null);
      if (center && center.length >= 2) {
        const [lng, lat] = center;
        map.current.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
        if (window.mapEventBus) {
          window.mapEventBus.emit('location-search:ring:show', { center: [lng, lat], source: 'texas_data_centers' });
          window.mapEventBus.emit('power-circle:activate', {
            center: [lng, lat],
            address: globalStore?.address || meta.properties?.project_name || meta.displayName || 'Data center',
            source: 'texas_data_centers'
          });
        }
      }
    } else if ((meta.responseType === 'mcp_infrastructure_search' || meta.source === 'mcp') && meta.features?.length > 0) {
      try {
        const bbox = turf.bbox(turf.featureCollection(meta.features));
        map.current.fitBounds(bbox, {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          duration: 1000
        });
      } catch (err) {
        console.warn('BaseCard: Error fitting MCP bounds', err);
      }
    } else if (meta.responseType === 'ercot_county_detail' && meta.geometry) {
      try {
        const center = turf.center(turf.feature(meta.geometry));
        const [lng, lat] = center.geometry.coordinates;
        map.current.flyTo({ center: [lng, lat], zoom: 10, duration: 800 });
      } catch (err) {
        console.warn('BaseCard: Error flying to ERCOT county', err);
      }
    } else if (String(meta.responseType || '').startsWith('tx_precomputed_') && meta.coordinates?.length >= 2) {
      const [lng, lat] = meta.coordinates;
      map.current.flyTo({ center: [lng, lat], zoom: 9, duration: 800 });
    }
  }, [effectiveSelectedIndex, responses, map, onLocationFlyTo, isMobile]);

  // Function to clear response cache (Claude only, preserve Perplexity cache)
  const handleClearResponseCache = useCallback(() => {
    clearResponseCache(); // Only clears Claude responses
  }, []);

  // Create a memoized aiState object to prevent unnecessary re-renders
  const aiState = useMemo(() => ({
    isLoading,
    response: responses.length > 0 ? responses[effectiveSelectedIndex] || responses[responses.length - 1] : null,
    responses,
    citations,
    currentQuestions,
    selectedCard,
    showFollowupButtons,
    showFollowupContent,
    hasShownFollowup,
    sourcesExpanded,
    responseExpanded,
    selectedAIProvider,
    aiProviderDropdownOpen,
    collapsedResponses,
    selectedResponseIndex: effectiveSelectedIndex,
    responseMenuOpen,
    pendingRequests,
    selectedMarker
  }), [
    isLoading, responses, citations, currentQuestions, selectedCard,
    showFollowupButtons, showFollowupContent, hasShownFollowup,
    sourcesExpanded, responseExpanded, selectedAIProvider, aiProviderDropdownOpen, collapsedResponses, effectiveSelectedIndex, responseMenuOpen, pendingRequests, selectedMarker
  ]);
  
  // Create setter functions for UI state properties (non-AI related)
  const setAiStateProperty = useCallback((property, value) => {
    switch (property) {
      case 'currentQuestions':
        setCurrentQuestions(value);
        break;
      case 'selectedCard':
        setSelectedCard(value);
        break;
      case 'showFollowupButtons':
        setShowFollowupButtons(value);
        break;
      case 'showFollowupContent':
        setShowFollowupContent(value);
        break;
      case 'hasShownFollowup':
        setHasShownFollowup(value);
        break;
      case 'sourcesExpanded':
        setSourcesExpanded(value);
        break;
      case 'responseExpanded':
        setResponseExpanded(value);
        break;
      case 'selectedAIProvider':
        setSelectedAIProvider(value);
        break;
      case 'aiProviderDropdownOpen':
        setAiProviderDropdownOpen(value);
        break;
      case 'collapsedResponses':
        setCollapsedResponses(value);
        break;
      default:
        console.warn(`Unknown AI state property: ${property}`);
    }
  }, []);
  
  const [cacheCountdown, setCacheCountdown] = useState(10);
  
  // State to track OSM Button loading for card border animation
  const [isOSMButtonLoading, setIsOSMButtonLoading] = useState(false);
  const cardRef = useRef(null);

  // Auto-show initial questions after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentQuestions('initial');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Track when cards first appear to trigger shimmer animation
  const [hasShimmered, setHasShimmered] = useState(false);
  
  // Trigger shimmer animation when cards first appear
  useEffect(() => {
    if (currentQuestions === 'initial' && !hasShimmered) {
      // Wait for the full shimmer animation to complete (1.5s) before disabling
      const timer = setTimeout(() => {
        setHasShimmered(true);
      }, 1500); // Match the animation duration
      return () => clearTimeout(timer);
    }
  }, [currentQuestions, hasShimmered]);

  // Cleanup is now handled by the useAIQuery hook

    // Handle drag functionality
  const handleMouseDown = (e) => {
    if (!effectiveDraggable) return;
    
    // Get the appropriate ref based on mode
    const currentRef = isPerplexityMode ? perplexityContainerRef.current : cardRef.current;
    if (!currentRef) return;
    
    e.preventDefault();
    e.stopPropagation();
    

    setIsDragging(true);
    
    // Calculate offset from the card's current position, not the drag handle
    const rect = currentRef.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !effectiveDraggable) return;

    // Get the appropriate ref based on mode
    const currentRef = isPerplexityMode ? perplexityContainerRef.current : cardRef.current;
    if (!currentRef) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    currentRef.style.left = `${newX}px`;
    currentRef.style.top = `${newY}px`;
  }, [isDragging, effectiveDraggable, dragOffset.x, dragOffset.y, isPerplexityMode]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

    // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);





  // Auto-clear cache after 10 seconds when it appears
  const [cacheStats, setCacheStats] = useState({ totalEntries: 0 });
  
  // Update cache stats periodically
  useEffect(() => {
    const updateCacheStats = () => {
      const stats = getResponseCacheStats();
      setCacheStats(stats);
    };
    
    updateCacheStats();
    const interval = setInterval(updateCacheStats, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (cacheStats.totalEntries > 8) { // Increased threshold to reduce aggressive clearing
      setCacheCountdown(10);
      
      const countdownTimer = setInterval(() => {
        setCacheCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      const clearTimer = setTimeout(() => {
        handleClearResponseCache(); // This only clears Claude cache, not Perplexity
        setCacheCountdown(10);
      }, 10000);
      
      return () => {
        clearTimeout(clearTimer);
        clearInterval(countdownTimer);
      };
    }
  }, [cacheStats.totalEntries, handleClearResponseCache]);

  // Toggle follow-up content visibility
  const toggleFollowupContent = () => {
    setShowFollowupContent(prev => !prev);
    setShowFollowupButtons(prev => !prev);
  };
  
  // Follow-up content functions (UI-only, not moved to hook)
  // Note: These functions are available but may not be used in the refactored version
  
  // Function to toggle response collapse state
  const toggleResponseCollapse = (responseIndex) => {
    setCollapsedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseIndex)) {
        newSet.delete(responseIndex);
      } else {
        newSet.add(responseIndex);
      }
      return newSet;
    });
  };

  // Auto-collapse previous responses when a new response is added
  useEffect(() => {
    if (responses.length > 1) {
      // When we have more than one response, automatically collapse all previous responses
      // except the latest one (which should remain expanded)
      const previousResponseIndices = Array.from({ length: responses.length - 1 }, (_, i) => i);
      
      setCollapsedResponses(prev => {
        const newSet = new Set(prev);
        // Add all previous response indices to collapsed set
        previousResponseIndices.forEach(index => {
          newSet.add(index);
        });
        return newSet;
      });
    }
  }, [responses.length]); // Trigger when the number of responses changes

  // Responses now show open by default - no auto-collapse

  // Add background animation when response is ready (but keep collapsed)
  const [responseReadyAnimation, setResponseReadyAnimation] = useState(false);
  
  useEffect(() => {
    if (responses.length > 0 && !isLoading && isInitialLoad) {
      // When we have responses and loading is complete, trigger background animation
      setResponseReadyAnimation(true);
      
      // Mark initial load as complete
      setIsInitialLoad(false);
      
      // Remove animation after 3 seconds
      setTimeout(() => {
        setResponseReadyAnimation(false);
      }, 3000);
    }
  }, [responses.length, isLoading, isInitialLoad]); // Trigger when responses change or loading completes
  
  // Response rendering logic moved to AIResponseDisplay component

  // handleAIQuery is now provided by useAIQuery hook
  
  // Initialize NodeAnimation system
  useEffect(() => {
    if (map && updateToolFeedback) {
      const animation = new NodeAnimation(map, updateToolFeedback);
      setNodeAnimation(animation);
      
      // Store globally for MarkerPopupManager access
      window.nodeAnimation = animation;
      
      // NodeAnimation system initialized
      
      // Cleanup on unmount
      return () => {
        if (animation) {
          animation.stopAnimations();
          window.nodeAnimation = null;
          // NodeAnimation system cleaned up
        }
      };
    }
  }, [map, updateToolFeedback]);

  // Handle Perplexity mode
  const handlePerplexityMode = useCallback(() => {
    console.log('🧠 BaseCard: Entering Perplexity mode');
    
    // Trigger Perplexity analysis through useAIQuery
    const perplexityQuery = {
      id: 'perplexity_analysis',
      query: 'Analyze Pinal County regional development with comprehensive innovation potential assessment',
      isPerplexityMode: true,
      isCustom: false
    };
    
    handleAIQuery(perplexityQuery);
  }, [handleAIQuery]);

  // Listen for Perplexity analysis data and store globally for table access
  useEffect(() => {
    if (!window.mapEventBus) return;

    const handlePerplexityAnalysisComplete = (data) => {
      console.log('🧠 BaseCard: Storing Perplexity analysis data globally:', data);
      // Store Perplexity analysis data globally for table access
      window.lastPerplexityAnalysisData = {
        geoJsonFeatures: data.geoJsonFeatures || [],
        analysis: data.analysis || '',
        citations: data.citations || [],
        summary: data.summary || {},
        insights: data.insights || {},
        legendItems: data.legendItems || [],
        timestamp: data.timestamp || Date.now()
      };
    };

    window.mapEventBus.on('perplexity:analysisComplete', handlePerplexityAnalysisComplete);

    return () => {
      window.mapEventBus.off('perplexity:analysisComplete', handlePerplexityAnalysisComplete);
    };
  }, []);

  // If in Perplexity mode, render only the AskAnythingInput without BaseCard wrapper
  if (isPerplexityMode) {
    return (
      <>
        <div 
          ref={perplexityContainerRef}
          data-perplexity-container="true"
          style={isMobile ? {
            position: 'fixed',
            ...(hasSearched ? { bottom: 'calc(max(48px, env(safe-area-inset-bottom, 24px) + 14px) - 20px)', top: 'auto' } : { top: 'calc(max(6px, env(safe-area-inset-top, 6px)) + 40px)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            zIndex: 1000,
            userSelect: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            transition: 'top 0.3s ease, bottom 0.3s ease'
          } : {
            position: 'fixed',
            left: position.lng || 0,
            top: position.lat || 0,
            zIndex: 1000,
            userSelect: 'none',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
          }}
        >
          {/* Nested Circle Button - Only show the Perplexity toggle when in Perplexity mode */}
          <NestedCircleButton 
            aiState={aiState}
            map={map}
            onLoadingChange={setIsOSMButtonLoading}
            setIsOSMButtonLoading={setIsOSMButtonLoading}
            setAiState={setAiStateProperty}
            updateToolFeedback={updateToolFeedback}
            onSelectResponse={handleSelectResponse}
            onResponseMenuOpenChange={setResponseMenuOpen}
            isDragging={isDragging}
            handleMouseDown={handleMouseDown}
            hideDragHandle={isMobile}
            currentLocation={currentLocation}
            onLocationChange={handleLocationChange}
            onPerplexityModeToggle={handlePerplexityModeToggle}
            isPerplexityMode={isPerplexityMode}
            onGeoAIQuery={handleGeoAIQuery}
          />
          
          {/* AI Questions Container - Only show AskAnythingInput in Perplexity mode */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: isMobile ? '100%' : '320px',
            borderRadius: '12px',
            transition: 'all 0.3s ease'
          }}>
            <AIQuestionsSection 
              aiState={aiState}
              hasShimmered={hasShimmered}
              handleAIQuery={handleAIQuery}
              createClickableTruncation={createClickableTruncation}
              setAiState={setAiStateProperty}
              map={map}
              isOSMButtonLoading={isOSMButtonLoading}
              toggleFollowupContent={toggleFollowupContent}
              toolFeedback={toolFeedback}
              toggleResponseCollapse={toggleResponseCollapse}
              handleMarkerClick={handleMarkerClick}
              handleBackToAnalysis={handleBackToAnalysis}
              viewMode={viewMode}
              currentLocation={currentLocation}
              onViewModeChange={handleViewModeChange}
              selectedMarker={selectedMarker}
              nodeAnimation={nodeAnimation}
              responseReadyAnimation={responseReadyAnimation}
              isPerplexityMode={isPerplexityMode}
              onPerplexityModeToggle={handlePerplexityModeToggle}
              onLucidAnimationStart={handleLucidAnimationStart}
              lucidAnimationActive={isLucidAnimationVisible}
              availableAnimations={availableAnimations}
              onAnimationSelect={handleAnimationSelect}
              lucidStats={lucidStats}
              onLucidNaipOverlay={handleLucidNaipOverlay}
              addResponse={addResponse}
              onLocationFlyTo={onLocationFlyTo}
            />
          </div>
          {/* Legend Container - Hidden on mobile */}
          {!isMobile && (
            <LegendContainer 
              key="legend-container"
              aiState={aiState}
              isVisible={showLegend}
              onToggle={toggleLegend}
              map={map}
              handleMarkerClick={handleMarkerClick}
              currentLocation={currentLocation}
            />
          )}
        </div>

        {/* Marker Popup Manager - Still needed for marker interactions */}
        <MarkerPopupManager 
          map={map}
        />
      </>
    );
  }

  // Normal BaseCard rendering when not in Perplexity mode
  return (
    <>
      <div 
        ref={cardRef}
        className="base-card"
        style={isMobile ? {
          position: 'fixed',
          ...(hasSearched ? { bottom: 'calc(max(48px, env(safe-area-inset-bottom, 34px) + 24px) - 25px)', top: 'auto' } : { top: 'calc(max(16px, env(safe-area-inset-top, 16px)) + 40px)' }),
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '400px',
          zIndex: 1000,
          userSelect: 'none',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          transition: 'top 0.3s ease, bottom 0.3s ease'
        } : {
          position: 'fixed',
          left: position.lng || 0,
          top: position.lat || 0,
          zIndex: 1000,
          userSelect: 'none',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
      {/* Nested Circle Button - Replaces the three individual colored circles and includes drag handle (desktop only) */}
      <NestedCircleButton 
        aiState={aiState}
        map={map}
        onLoadingChange={setIsOSMButtonLoading}
        setIsOSMButtonLoading={setIsOSMButtonLoading}
        setAiState={setAiStateProperty}
        updateToolFeedback={updateToolFeedback}
        onSelectResponse={handleSelectResponse}
        onResponseMenuOpenChange={setResponseMenuOpen}
        isDragging={isDragging}
        handleMouseDown={handleMouseDown}
        hideDragHandle={isMobile}
        currentLocation={currentLocation}
        onLocationChange={handleLocationChange}
        onPerplexityModeToggle={handlePerplexityModeToggle}
        isPerplexityMode={isPerplexityMode}
        onGeoAIQuery={handleGeoAIQuery}
      />
      
      {/* AI Questions Container - Fixed Structure */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: isMobile ? '100%' : '320px',
        borderRadius: '12px',
        transition: 'all 0.3s ease',
        ...(isMobile && { marginTop: '-12px' })
      }}>
        <AIQuestionsSection 
          aiState={aiState}
          hasShimmered={hasShimmered}
          handleAIQuery={handleAIQuery}
          createClickableTruncation={createClickableTruncation}
          setAiState={setAiStateProperty}
          map={map}
          isOSMButtonLoading={isOSMButtonLoading}
          toggleFollowupContent={toggleFollowupContent}
          toolFeedback={toolFeedback}
          toggleResponseCollapse={toggleResponseCollapse}
          handleMarkerClick={handleMarkerClick}
          handleBackToAnalysis={handleBackToAnalysis}
          viewMode={viewMode}
          currentLocation={currentLocation}
          onViewModeChange={handleViewModeChange}
          selectedMarker={selectedMarker}
          nodeAnimation={nodeAnimation}
          responseReadyAnimation={responseReadyAnimation}
          isPerplexityMode={isPerplexityMode}
          onPerplexityModeToggle={handlePerplexityModeToggle}
          onLucidAnimationStart={handleLucidAnimationStart}
          lucidAnimationActive={isLucidAnimationVisible}
          availableAnimations={availableAnimations}
          onAnimationSelect={handleAnimationSelect}
          lucidStats={lucidStats}
          onLucidNaipOverlay={handleLucidNaipOverlay}
          addResponse={addResponse}
          onLocationFlyTo={onLocationFlyTo}
        />

        {/* Side Panel - Left Side */}
        <SidePanel aiState={aiState} />
        

        {/* Cache Management */}
        {cacheStats.totalEntries > 0 && (
          <div style={{
            marginTop: sourcesExpanded ? '20px' : '22px',
            marginBottom: '-16px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center'
          }}>
            <span>{cacheStats.totalEntries} cached responses</span>
            <span style={{ 
              marginLeft: '8px', 
              color: cacheCountdown > 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 193, 7, 0.7)',
              fontWeight: cacheCountdown <= 1 ? '600' : '400',
              transition: 'all 0.3s ease',
              animation: cacheCountdown <= 1 ? 'cacheCountdownPulse 1s ease-in-out infinite' : 'none'
            }}>
              {cacheCountdown > 0 ? `(auto-clear in ${cacheCountdown}s)` : '(clearing now...)'}
            </span>
            <button
              onClick={handleClearResponseCache}
              style={{
                background: 'none',
                border: 'none',
                color: cacheCountdown <= 1 ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '10px',
                cursor: 'pointer',
                marginLeft: '8px',
                textDecoration: 'underline',
                fontWeight: cacheCountdown <= 1 ? '600' : '400',
                transition: 'all 0.3s ease'
              }}
              title="Clear all cached responses now"
            >
              Clear now
            </button>
          </div>
        )}

      </div>

        {/* Legend Container - Hidden on mobile */}
        {!isMobile && (
          <LegendContainer 
            key="legend-container"
            aiState={aiState}
            isVisible={showLegend}
            onToggle={toggleLegend}
            map={map}
            handleMarkerClick={handleMarkerClick}
            currentLocation={currentLocation}
          />
        )}
      </div>

      {/* Onboarding Tour - contextual 3-step hints for new users */}
      <OnboardingTour hasResponses={!!(aiState.responses && aiState.responses.length > 0)} />

      {/* Marker Popup Manager - Rendered outside BaseCard for proper z-index */}
      <MarkerPopupManager 
        map={map}
      />
      {isLucidAnimationVisible && null}
    </>
  );
};

export default BaseCard;
