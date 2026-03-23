import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { getCardsForScene } from './components/Cards/config/MemphisCardConfig';
import { useMemphisAssetCards } from '../../hooks/useGridPulse';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { MapContainer, ToggleButton } from './styles/MapStyles';

import { useAIConsensusAnimation } from './hooks/useAIConsensusAnimation';
import { useMapInitialization } from './hooks/useMapInitialization';
import { PopupManager } from './components/PopupManager';
import { 
    highlightPOIBuildings,
    initializeRoadGrid,
    loadHarveyData
} from './utils';
import LayerToggle from './components/LayerToggle';
import { mockDisagreementData } from './constants/mockData';
import { ErcotManager } from './components/ErcotManager';
import { 
    initializeRoadParticles,
    animateRoadParticles,
    stopRoadParticles,
    setRoadParticleThrottle
} from './hooks/mapAnimations';
import PowerCircleLayer from './components/PowerCircleLayer';
import * as turf from '@turf/turf';
import { OZONA_COORDS, SONORA_COORDS, ROCKSPRINGS_COORDS, LEAKEY_COORDS, HONDO_COORDS, CASTROVILLE_COORDS, JUNCTION_COORDS, BALMORHEA_COORDS, MONAHANS_COORDS, PECOS_COORDS, TOYAH_COORDS } from './constants/highwayConstants';
import LayerManager from './LayerManager';
import { debugLog, debugWarn, debugError, DEBUG } from './debug';
import crashMonitor from './utils/crashMonitor';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MOBILE_CONFIG } from './constants';
import { createRoot } from 'react-dom/client';
import SearchRadiusBadge from './components/SearchRadiusBadge';
import { initEventBusTracking, logEvent } from '../../services/analyticsApi';

const MCPSearchResults = React.lazy(() => import('./components/MCPSearchResults'));
const CardManager = React.lazy(() => import('./components/Cards/CardManager'));
const DetailExpandedModal = React.lazy(() => import('./components/DetailExpandedModal'));
const PowerConnectionsLayer = React.lazy(() => import('./components/PowerConnectionsLayer'));
const PlanningDocsLayer = React.lazy(() => import('./components/PlanningDocsLayer'));
const PlanningAnalysisLayer = React.lazy(() => import('./components/PlanningAnalysisLayer'));
const AITransmissionNav = React.lazy(() => import('./components/AITransmissionNav'));
const HIFLDTransmissionLayer = React.lazy(() => import('./components/HIFLDTransmissionLayer'));
const ERCOTGISReportsLayer = React.lazy(() => import('./components/ERCOTGISReportsLayer'));
const ProducerConsumerCountiesLayer = React.lazy(() => import('./components/ProducerConsumerCountiesLayer'));
const SpatialMismatchCountiesLayer = React.lazy(() => import('./components/SpatialMismatchCountiesLayer'));
const REITLayer = React.lazy(() => import('./components/REITLayer'));
const MemphisCountiesLayer = React.lazy(() => import('./components/MemphisCountiesLayer'));
const MemphisAIExpansionLayer = React.lazy(() => import('./components/MemphisAIExpansionLayer'));
const MLGW2026SubstationLayer = React.lazy(() => import('./components/MLGW2026SubstationLayer'));
const XAISitesPublicLayer = React.lazy(() => import('./components/XAISitesPublicLayer'));
const XAIToMLGWLinesLayer = React.lazy(() => import('./components/XAIToMLGWLinesLayer'));
const MemphisColossusChangeLayer = React.lazy(() => import('./components/MemphisColossusChangeLayer'));
const MemphisColossusTopParcelsLayer = React.lazy(() => import('./components/MemphisColossusTopParcelsLayer'));
const ColossusPermitsLayer = React.lazy(() => import('./components/ColossusPermitsLayer'));
const ColossusPermitsReviewQueueLayer = React.lazy(() => import('./components/ColossusPermitsReviewQueueLayer'));
const MemphisPermitsHeatmapLayer = React.lazy(() => import('./components/MemphisPermitsHeatmapLayer'));
const CouncilSignalsColossusLayer = React.lazy(() => import('./components/CouncilSignalsColossusLayer'));
const ColossusPowerSignalsLayer = React.lazy(() => import('./components/ColossusPowerSignalsLayer'));
const DesotoPermitsLayer = React.lazy(() => import('./components/DesotoPermitsLayer'));
const DesotoPermitsReviewQueueLayer = React.lazy(() => import('./components/DesotoPermitsReviewQueueLayer'));
const DesotoStatelineParcelLayer = React.lazy(() => import('./components/DesotoStatelineParcelLayer'));


// Global error handler
if (DEBUG) {
  window.addEventListener('error', (event) => {
    debugError('Global error caught:', {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });
}

// Set mapbox access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const LOCATION_SEARCH_RING_SOURCE_ID = 'location-search-ring-source';
const LOCATION_SEARCH_RING_LAYER_ID = 'location-search-ring-layer';
const LOCATION_SEARCH_RING_HALO_SOURCE_ID = 'location-search-ring-halo-source';
const LOCATION_SEARCH_RING_HALO_LAYER_ID = 'location-search-ring-halo-layer';
const SEARCH_LOCATION_RING_DEFAULT_RADIUS_MI = 25;
const MAP_STYLE_BY_THEME = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11'
};

// Define window level event bus for communication if it doesn't exist
if (!window.mapEventBus) {
  window.mapEventBus = {
    listeners: {},
    emit: function(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in mapEventBus listener for ${event}:`, error);
          }
        });
      }
    },
    on: function(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      // Return an unsubscribe function
      return () => {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
      };
    },
    off: function(event, callback) {
      if (this.listeners[event] && callback) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      } else if (this.listeners[event]) {
        // If no callback specified, remove all listeners for this event
        this.listeners[event] = [];
      }
    }
  };
}

// Wire event bus → Supabase persistence (idempotent, safe to call early)
initEventBusTracking();

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const roadAnimationFrame = useRef(null);
  const [mapTheme, setMapTheme] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('map-theme') : null;
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const mapStyleUrl = MAP_STYLE_BY_THEME[mapTheme] || MAP_STYLE_BY_THEME.dark;

  const [isErcotMode, setIsErcotMode] = useState(false);
  const [showRoadGrid, setShowRoadGrid] = useState(false);
  const [showMUDLayer, setShowMUDLayer] = useState(false);
  const [showHarveyData, setShowHarveyData] = useState(false);
  const [showSurfaceWater, setShowSurfaceWater] = useState(false);
  const [showWastewaterOutfalls, setShowWastewaterOutfalls] = useState(false);
  const [showZipCodes, setShowZipCodes] = useState(false);
  const [showZipFloodAnalysis, setShowZipFloodAnalysis] = useState(false);
  const [isLayerMenuCollapsed, setIsLayerMenuCollapsed] = useState(true);
  const [showAIConsensus, setShowAIConsensus] = useState(false);
  const [showRoadParticles, setShowRoadParticles] = useState(true); // Restore default to true
  const [is3DActive, setIs3DActive] = useState(false);
  const roadParticleAnimation = useRef(null);
  const [showPlanningDocsLayer, setShowPlanningDocsLayer] = useState(false);
  
  // Planning analysis states
  const [showPlanningAnalysis, setShowPlanningAnalysis] = useState(false);
  const [showAdaptiveReuse, setShowAdaptiveReuse] = useState(false);
  const [showDevelopmentPotential, setShowDevelopmentPotential] = useState(false);
  const [showTransportation, setShowTransportation] = useState(false);

  // Add these refs for drag functionality
  const isDraggingRef = useRef(false);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const initialXRef = useRef(0);
  const initialYRef = useRef(0);
  const xOffsetRef = useRef(0);
  const yOffsetRef = useRef(0);
  const popupRef = useRef(null);
  
  // Debug tracking refs
  const requestAnimationFrameIds = useRef([]);
  const timeoutIds = useRef([]);
  const intervalIds = useRef([]);
  const layerLoadErrors = useRef([]);
  const crashWarnings = useRef(false);
  
  // Fire app_loaded + session_started once per tab load
  const appLoadedFiredRef = useRef(false);
  useEffect(() => {
    if (appLoadedFiredRef.current) return;
    appLoadedFiredRef.current = true;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
    const utm = params
      ? {
          utm_source: params.get('utm_source') || null,
          utm_medium: params.get('utm_medium') || null,
          utm_campaign: params.get('utm_campaign') || null,
          utm_content: params.get('utm_content') || null,
          utm_term: params.get('utm_term') || null,
          ref: params.get('ref') || null,
        }
      : {};

    logEvent('app_loaded', {
      path: window.location.pathname,
      referrer: document.referrer || null,
      isMobile,
      build: 'vercel',
      ...utm,
    }, 'map');
    logEvent('session_started', { ...utm }, 'map');
  }, []);
  
  // Track layer operations
  const trackLayerOperation = (operation, layerId, error = null) => {
    if (!DEBUG) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      layerId
    };
    
    if (error) {
      entry.error = error.message;
      layerLoadErrors.current.push(entry);
      debugError(`Layer ${operation} error for ${layerId}:`, error);
    } else {
      debugLog(`Layer ${operation}:`, layerId);
    }
  };
  
  // Safe layer operation wrapper
  const safeLayerOperation = (operation, layerId, callback) => {
    if (!map.current) {
      debugWarn(`Can't ${operation} layer ${layerId} - map not initialized`);
      return false;
    }
    
    try {
      callback();
      trackLayerOperation(operation, layerId);
      return true;
    } catch (error) {
      trackLayerOperation(operation, layerId, error);
      return false;
    }
  };
  
  // Safe animation frame request
  const safeRequestAnimationFrame = (callback, name = 'unnamed') => {
    const id = requestAnimationFrame((time) => {
      try {
        callback(time);
        // Remove from tracking array once completed
        requestAnimationFrameIds.current = requestAnimationFrameIds.current.filter(item => item.id !== id);
      } catch (error) {
        debugError(`Animation frame error (${name}):`, error);
      }
    });
    
    // Track this animation frame request
    requestAnimationFrameIds.current.push({ id, name });
    return id;
  };
  
  // Monitor for potential memory leaks
  useEffect(() => {
    if (!DEBUG) return;
    
    const checkResourceUsage = () => {
      // Check for excessive animation frames
      if (requestAnimationFrameIds.current.length > 10) {
        debugWarn('Possible animation frame leak!', 
          requestAnimationFrameIds.current.map(item => item.name));
        crashWarnings.current = true;
      }
      
      // Report layer errors
      if (layerLoadErrors.current.length > 0) {
        debugWarn('Layer errors detected:', layerLoadErrors.current);
      }
    };
    
    const intervalId = setInterval(checkResourceUsage, 5000);
    intervalIds.current.push(intervalId);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Override animation functions with safe versions - FIX RECURSION ISSUE
  useEffect(() => {
    if (!DEBUG) return;
    
    // Store the original function
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    
    // Create a wrapper that uses the original
    const safeFn = (callback) => {
      return originalRequestAnimationFrame((time) => {
        try {
          // Track this request
          const id = Math.random().toString(36).substr(2, 9);
          requestAnimationFrameIds.current.push({ id, name: 'wrapped-raf' });
          
          // Call the callback
          callback(time);
          
          // Remove from tracking once done
          requestAnimationFrameIds.current = 
            requestAnimationFrameIds.current.filter(item => item.id !== id);
        } catch (error) {
          debugError('Error in requestAnimationFrame callback:', error);
        }
      });
    };
    
    // Replace the global function with our safe version
    window.requestAnimationFrame = safeFn;
    
    // Cleanup on unmount
    return () => {
      debugLog('Restoring original requestAnimationFrame');
      window.requestAnimationFrame = originalRequestAnimationFrame;
    };
  }, []);
  
  // Cleanup all resources on unmount
  useEffect(() => {
    return () => {
      if (DEBUG) {
        debugLog('Cleaning up resources on unmount');
      }
      
      // Cancel all animation frames
      requestAnimationFrameIds.current.forEach(item => {
        cancelAnimationFrame(item.id);
      });
      
      // Clear all timeouts
      timeoutIds.current.forEach(id => {
        clearTimeout(id);
      });
      
      // Clear all intervals
      intervalIds.current.forEach(id => {
        clearInterval(id);
      });
    };
  }, []);

  const { initializeParticleLayer, generateParticles } = useAIConsensusAnimation(map, showAIConsensus, mockDisagreementData);
  useMapInitialization(map, mapContainer, mapStyleUrl);

  const ercotManagerRef = useRef(null);

  // Add loading state for 3D buildings
  const [is3DLoading, setIs3DLoading] = useState(false);

  // Add missing state declarations for essential layers only
  const [showRoads, setShowRoads] = useState(true);
  const [showMainRoads, setShowMainRoads] = useState(false);
  const [showParks, setShowParks] = useState(true);
  
  // Add state for Fort Stockton radius toggle
  const [showFortStocktonRadius, setShowFortStocktonRadius] = useState(false);
  // Denver-specific state variables removed
  
  // Denver Strategy Layer States
  const [showLightRailStrategy, setShowLightRailStrategy] = useState(false);
  const [showUtilityCorridorStrategy, setShowUtilityCorridorStrategy] = useState(false);
  const [showPedestrianBridgesStrategy, setShowPedestrianBridgesStrategy] = useState(false);
  
  // Additional Denver Strategy Layer States
  const [showParkingLotsStrategy, setShowParkingLotsStrategy] = useState(false);
  const [showSportsAnchorStrategy, setShowSportsAnchorStrategy] = useState(false);
  const [showDevelopmentZonesStrategy, setShowDevelopmentZonesStrategy] = useState(false);
  
  // Downtown Denver Comparison Layer States
  const [showDowntownOfficeStrategy, setShowDowntownOfficeStrategy] = useState(false);
  const [showDowntownRetailStrategy, setShowDowntownRetailStrategy] = useState(false);
  const [showDowntownTransportStrategy, setShowDowntownTransportStrategy] = useState(false);
  const [showDowntownLargerStrategy, setShowDowntownLargerStrategy] = useState(false);
  
  // UPS Facilities Layer State
  const [showUPSFacilities, setShowUPSFacilities] = useState(false);
  
  // Amazon Fulfillment Layer State
  const [showAmazonFulfillment, setShowAmazonFulfillment] = useState(false);

  // 3D Buildings Layer State
  const [show3DBuildings, setShow3DBuildings] = useState(false);

  // HIFLD US Power Grid Transmission Layer State
  const [showHIFLDTransmission, setShowHIFLDTransmission] = useState(false);

  // Memphis Counties Layer State
  const [showMemphisCounties, setShowMemphisCounties] = useState(false);

  // Memphis AI Expansion Layer State
  const [showMemphisAIExpansion, setShowMemphisAIExpansion] = useState(false);

  // Memphis MLGW / xAI layers
  const [showMLGW2026, setShowMLGW2026] = useState(false);
  const [showXAISitesPublic, setShowXAISitesPublic] = useState(false);
  const [showXAIToMLGW, setShowXAIToMLGW] = useState(false);
  const [showMemphisColossusChange, setShowMemphisColossusChange] = useState(false);
  const [showMemphisColossusTopParcels, setShowMemphisColossusTopParcels] = useState(false);
  const [showColossusPermits, setShowColossusPermits] = useState(false);
  const [showColossusPermitsReviewQueue, setShowColossusPermitsReviewQueue] = useState(false);
  const [showMemphisPermitsHeatmap, setShowMemphisPermitsHeatmap] = useState(false);
  const [showCouncilSignalsColossus, setShowCouncilSignalsColossus] = useState(false);
  const [showColossusPowerSignals, setShowColossusPowerSignals] = useState(false);
  const [showDesotoPermits, setShowDesotoPermits] = useState(false);
  const [showDesotoPermitsReviewQueue, setShowDesotoPermitsReviewQueue] = useState(false);
  const [showDesotoStatelineParcel, setShowDesotoStatelineParcel] = useState(false);

  const [showREIT, setShowREIT] = useState(false);

  // ERCOT / Texas power layers (from Tx DRAFT)
  const [showERCOTGISReports, setShowERCOTGISReports] = useState(false);
  const [showProducerConsumerCounties, setShowProducerConsumerCounties] = useState(false);
  const [showSpatialMismatchCounties, setShowSpatialMismatchCounties] = useState(false);

  // Staggered layer mount: Producer/Consumer, Spatial Mismatch (REIT stays off)
  useEffect(() => {
    const delays = [400, 800]; // ms after app load
    const timers = [
      setTimeout(() => setShowProducerConsumerCounties(true), delays[0]),
      setTimeout(() => setShowSpatialMismatchCounties(true), delays[1])
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Power Circle (REIT popup power analysis)
  const [powerCircleActive, setPowerCircleActive] = useState(false);
  const [powerCircleCenter, setPowerCircleCenter] = useState(null);
  const [powerCircleRadius, setPowerCircleRadius] = useState(5);

  // Well Registry Layer State
  const [showWellRegistry, setShowWellRegistry] = useState(false);

  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const mapThemeStyleKey = `map-theme-${mapTheme}`;
  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
  const [isMapAboutOpen, setIsMapAboutOpen] = useState(false);
  const [isMapContactOpen, setIsMapContactOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [animateMenuIconPulse, setAnimateMenuIconPulse] = useState(false);
  const [isMobileMenuIconVisible, setIsMobileMenuIconVisible] = useState(false);
  const mapMenuRef = useRef(null);
  const mobileBottomMenuTriggerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__mapTheme = mapTheme;
    try {
      window.localStorage.setItem('map-theme', mapTheme);
    } catch {
      // Ignore storage failures in private mode.
    }
  }, [mapTheme]);

  useEffect(() => {
    if (!map.current) return;
    if (!map.current.isStyleLoaded()) return;

    let style = null;
    try {
      style = map.current.getStyle?.();
    } catch {
      return;
    }

    const currentSprite = style?.sprite || '';
    const desiredStyle = mapStyleUrl;
    const alreadyOnThemeStyle = currentSprite.includes(mapTheme === 'light' ? '/light-v11' : '/dark-v11');
    if (alreadyOnThemeStyle) return;

    map.current.setStyle(desiredStyle, { diff: false });
  }, [mapStyleUrl, mapTheme]);

  useEffect(() => {
    if (!isMapMenuOpen && !isMapAboutOpen && !isMapContactOpen) return;

    const handleClickOutside = (event) => {
      if (
        mapMenuRef.current &&
        !mapMenuRef.current.contains(event.target) &&
        !mobileBottomMenuTriggerRef.current?.contains(event.target)
      ) {
        setIsMapMenuOpen(false);
        setIsMapAboutOpen(false);
        setIsMapContactOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMapMenuOpen, isMapAboutOpen, isMapContactOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('map:menu:toggle', {
      detail: {
        open: !!(isMobile && isMapMenuOpen)
      }
    }));
  }, [isMobile, isMapMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isMobile) {
      setIsMobileMenuIconVisible(true);
      return;
    }

    let showTimer = null;
    let pulseTimer = null;

    const revealIcon = () => {
      showTimer = window.setTimeout(() => {
        setIsMobileMenuIconVisible(true);
        setAnimateMenuIconPulse(true);
        pulseTimer = window.setTimeout(() => setAnimateMenuIconPulse(false), 1000);
      }, 1000);
    };

    setIsMobileMenuIconVisible(false);
    if (document.readyState === 'complete') {
      revealIcon();
    } else {
      window.addEventListener('load', revealIcon, { once: true });
    }

    return () => {
      window.removeEventListener('load', revealIcon);
      if (showTimer) window.clearTimeout(showTimer);
      if (pulseTimer) window.clearTimeout(pulseTimer);
    };
  }, [isMobile]);

  // DIA Anchor Layer State
  const [showDIAAnchor, setShowDIAAnchor] = useState(false);

  // Cherry Creek Anchor Layer State
  const [showCherryCreekAnchor, setShowCherryCreekAnchor] = useState(false);

  // Denver Sports Facilities Layer State
  const [showSportsFacilities, setShowSportsFacilities] = useState(false);
  
  // Add state for AI Transmission Navigator
  const [isAITransmissionNavOpen, setIsAITransmissionNavOpen] = useState(false);
  const [transmissionLayerStates, setTransmissionLayerStates] = useState({});
  
  // Add state for card system
  const [activeCards, setActiveCards] = useState([]);
  const [showCards, setShowCards] = useState(true);

  // Add state for detail expanded modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedToolData, setSelectedToolData] = useState(null);

  // Load live GridPulse assets as the default card on mount
  const { cards: gridpulseCards, loading: gpLoading } = useMemphisAssetCards();
  useEffect(() => {
    if (showCards && activeCards.length === 0) {
      if (!gpLoading && gridpulseCards.length > 0) {
        setActiveCards(gridpulseCards);
      } else if (!gpLoading) {
        // Fallback to static config if DB returns nothing
        setActiveCards(getCardsForScene('scene-0'));
      }
    }
  }, [showCards, activeCards.length, gpLoading, gridpulseCards]);
  
      // Add state for scene management - only essential layers
  const [layerStates, setLayerStates] = useState({
    showTransportation,
    showRoads,
    showParks,
    showFortStocktonRadius,
    // Denver-specific state variables removed
    // Denver Strategy Layer States removed
    // UPS Facilities Layer State
    showUPSFacilities,
    // Amazon Fulfillment Layer State
    showAmazonFulfillment,
    // 3D Buildings Layer State
    show3DBuildings,
    // DIA Anchor Layer State
    showDIAAnchor,
    // Cherry Creek Anchor Layer State
    showCherryCreekAnchor,
    // Merge with transmission layer states from LayerToggle
    ...transmissionLayerStates
  });

  // Update layerStates whenever any layer state changes
  useEffect(() => {
    setLayerStates(prev => ({
      ...prev,
      showTransportation,
      showRoads,
      showParks,
      showFortStocktonRadius,
      // Denver state variables removed
      // UPS Facilities Layer State
      showUPSFacilities,
      // Amazon Fulfillment Layer State
      showAmazonFulfillment,
      // Merge with transmission layer states
      ...transmissionLayerStates
    }));
  }, [
    showTransportation,
    showRoads,
    showParks,
    showFortStocktonRadius,
    // Denver dependencies removed
    // UPS Facilities Layer dependency
    showUPSFacilities,
    // Amazon Fulfillment Layer dependency
    showAmazonFulfillment,
    // 3D Buildings Layer dependency
    show3DBuildings,
    // DIA Anchor Layer dependency
    showDIAAnchor,
    // Cherry Creek Anchor Layer dependency
    showCherryCreekAnchor,
    // Denver Strategy Layer dependencies removed
    showDowntownTransportStrategy
    // Removed transmissionLayerStates to prevent infinite loop
  ]);

  // Separate effect for transmission layer states to avoid infinite loop
  useEffect(() => {
    setLayerStates(prev => ({
      ...prev,
      ...transmissionLayerStates
    }));
  }, [transmissionLayerStates]);

  // Handler to receive layer states from LayerToggle component
  const handleTransmissionLayerStateUpdate = useCallback((newStates) => {
    setTransmissionLayerStates(prev => ({
      ...prev,
      ...newStates
    }));
  }, []);
  
  // Handler for card events from AI Transmission Nav
  useEffect(() => {
    const handleShowCards = (event) => {
      setActiveCards(event.cards);
      setShowCards(true);
    };
    
    const handleHideCards = () => {
      setActiveCards([]);
      setShowCards(false);
    };
    
    // Use the unsubscribe functions returned by mapEventBus.on
    const unsubscribeShow = window.mapEventBus.on('cards:show', handleShowCards);
    const unsubscribeHide = window.mapEventBus.on('cards:hide', handleHideCards);
    
    return () => {
      unsubscribeShow();
      unsubscribeHide();
    };
  }, []);

  // Event listener for Well Registry layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleWellRegistryToggle = (show) => {
      console.log('🟡 Map: Received Well Registry toggle event:', show);
      setShowWellRegistry(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('well-registry:toggle', handleWellRegistryToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('well-registry:toggle', handleWellRegistryToggle);
      }
    };
  }, [setShowWellRegistry]);

  // Event listener for Main Roads layer toggle from OSMCall
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMainRoadsToggle = (show) => {
      setShowMainRoads(show);
    };
    
    if (window.mapEventBus) {
      window.mapEventBus.on('main-roads:toggle', handleMainRoadsToggle);
    }
    
    return () => {
      if (window.mapEventBus) {
        window.mapEventBus.off('main-roads:toggle', handleMainRoadsToggle);
      }
    };
  }, [setShowMainRoads]);

  // Generic layer ensure event used by deterministic/precomputed question flows.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;

    const handleEnsureLayers = (payload = {}) => {
      if (payload.showERCOTGISReports !== undefined) setShowERCOTGISReports(Boolean(payload.showERCOTGISReports));
      if (payload.showProducerConsumerCounties !== undefined) setShowProducerConsumerCounties(Boolean(payload.showProducerConsumerCounties));
      if (payload.showSpatialMismatchCounties !== undefined) setShowSpatialMismatchCounties(Boolean(payload.showSpatialMismatchCounties));
      if (payload.showHIFLDTransmission !== undefined) setShowHIFLDTransmission(Boolean(payload.showHIFLDTransmission));
      if (payload.showMainRoads !== undefined) setShowMainRoads(Boolean(payload.showMainRoads));
    };

    window.mapEventBus.on('map:ensure-layers', handleEnsureLayers);
    return () => {
      window.mapEventBus?.off('map:ensure-layers', handleEnsureLayers);
    };
  }, [
    setShowERCOTGISReports,
    setShowProducerConsumerCounties,
    setShowSpatialMismatchCounties,
    setShowHIFLDTransmission,
    setShowMainRoads
  ]);


  // Helper functions to generate realistic infrastructure data based on node properties
  const generateInfrastructureCount = (nodeData, type) => {
    const powerScore = nodeData.powerScore || 0;
    const risk = nodeData.risk?.toLowerCase() || 'medium';
    
    if (type === 'powerPlants') {
      // Higher power score = more power plants nearby
      if (powerScore >= 8) return '8-12';
      if (powerScore >= 6) return '5-8';
      if (powerScore >= 4) return '3-5';
      return '1-3';
    } else if (type === 'substations') {
      // More substations for higher power scores
      if (powerScore >= 8) return '6-10';
      if (powerScore >= 6) return '4-6';
      if (powerScore >= 4) return '2-4';
      return '1-2';
    }
    return 'N/A';
  };

  const generateWaterAccess = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const risk = nodeData.risk?.toLowerCase() || 'medium';
    
    if (powerScore >= 8) return 'Multiple water sources available';
    if (powerScore >= 6) return 'Municipal + groundwater access';
    if (powerScore >= 4) return 'Limited water access';
    return 'Water access uncertain';
  };

  const generateFiberConnectivity = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Multiple carriers available';
    }
    if (powerScore >= 6) return 'Good fiber connectivity';
    if (powerScore >= 4) return 'Limited fiber options';
    return 'Fiber connectivity uncertain';
  };

  const generateLandUse = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Industrial zones present';
    }
    if (powerScore >= 6) return 'Mixed industrial/residential';
    return 'Mixed land use';
  };

  const generateTransportationAccess = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Major transportation nearby';
    }
    if (powerScore >= 6) return 'Good transportation access';
    if (powerScore >= 4) return 'Limited transportation';
    return 'Transportation access uncertain';
  };

  const generateCriticalInfrastructure = (nodeData) => {
    const powerScore = nodeData.powerScore || 0;
    const type = nodeData.type?.toLowerCase() || '';
    
    if (type.includes('utility') || type.includes('electric')) {
      return 'Critical facilities nearby';
    }
    if (powerScore >= 6) return 'Some critical facilities';
    return 'No critical facilities';
  };

  // Handler for detail expand events
  useEffect(() => {
    const handleDetailExpand = (event) => {
      console.log('🔍 Detail expand event received:', event);
      const { nodeId, nodeData, category } = event;
      
      if (nodeData) {
        // Use the actual node data from the table
        setSelectedNodeData(nodeData);
        setSelectedCategory(category || 'all');
        
        // Create mock toolData for now - this would come from actual tool execution
        // Calculate dynamic values based on nodeData properties
        // Use actual nodeData properties instead of calculated values
        const getNodeType = (nodeData) => {
          return nodeData.type || 'Unknown';
        };

        // Use actual nodeData properties instead of calculated values
        const getRedundancyValue = (nodeData) => {
          return nodeData.redundancy || 'Standard';
        };

        // Use actual nodeData properties instead of calculated values
        const getResilienceValue = (nodeData) => {
          return nodeData.resilience || 'Standard';
        };

        // Use nodeData as-is since it now contains real infrastructure data from tools
        const enhancedNodeData = {
          ...nodeData
        };

        const mockToolData = {
          powerGridAnalysis: {
            reliabilityScore: nodeData.powerScore || 8,
            stabilityScore: Math.min(10, (nodeData.powerScore || 8) + 2),
            transmissionCapacity: nodeData.powerScore >= 8 ? '400-500MW' : nodeData.powerScore >= 6 ? '200-300MW' : '100-200MW',
            ercotIntegration: nodeData.powerScore >= 8 ? 'Excellent' : nodeData.powerScore >= 6 ? 'Good' : 'Fair',
            riskFactors: nodeData.risk || 'Medium',
            redundancyValue: nodeData.powerScore >= 8 ? 'High' : nodeData.powerScore >= 6 ? 'Medium' : 'Low'
          },
          siteAssessment: {
            availableCapacity: nodeData.capacity || '500 MW',
            redundancy: getRedundancyValue(nodeData),
            queueTimeline: nodeData.queueDepth || '2.1 years',
            resilience: getResilienceValue(nodeData),
            nodeType: getNodeType(nodeData)
          },
          environmentalAnalysis: {
            waterAccess: 'Municipal + Groundwater',
            fiberConnectivity: 'Multiple carriers within 5 miles',
            environmentalConcerns: 'Phase I ESA completed, no major concerns',
            climateEfficiency: 'Favorable for cooling'
          }
        };
        
        console.log('🔍 Map component created mockToolData:', {
          nodeData: enhancedNodeData,
          mockToolData
        });
        
        setSelectedToolData(mockToolData);
        setSelectedNodeData(enhancedNodeData);
        setShowDetailModal(true);
      } else {
        // Fallback to mock data if no node data provided
        const mockNodeData = {
          id: nodeId,
          name: `Node ${nodeId}`,
          type: 'Infrastructure Node',
          powerScore: Math.floor(Math.random() * 10) + 1,
          risk: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
          capacity: 'N/A',
          queueDepth: 'N/A',
          resilience: 'Weather resilient design',
          redundancy: 'Multiple transmission paths',
          content: `Detailed analysis for Node ${nodeId}. This is a comprehensive overview of the infrastructure node including its capabilities, risks, and operational characteristics. The node represents a critical component in the power grid infrastructure with specific performance metrics and operational requirements.`,
          // Generate realistic infrastructure data for mock nodes too
          powerPlantsCount: generateInfrastructureCount({ powerScore: Math.floor(Math.random() * 10) + 1 }, 'powerPlants'),
          substationsCount: generateInfrastructureCount({ powerScore: Math.floor(Math.random() * 10) + 1 }, 'substations'),
          waterAccess: generateWaterAccess({ powerScore: Math.floor(Math.random() * 10) + 1 }),
          fiberConnectivity: generateFiberConnectivity({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          landUse: generateLandUse({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          transportationAccess: generateTransportationAccess({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' }),
          criticalInfrastructure: generateCriticalInfrastructure({ powerScore: Math.floor(Math.random() * 10) + 1, type: 'Infrastructure Node' })
        };
        
        setSelectedNodeData(mockNodeData);
        setSelectedCategory(category || 'all');
        setSelectedToolData(null);
        setShowDetailModal(true);
      }
    };
    
    const unsubscribeDetailExpand = window.mapEventBus.on('detail:expand', handleDetailExpand);
    
    return () => {
      unsubscribeDetailExpand();
    };
  }, []);

  // Listen for infrastructure data from tools
  useEffect(() => {
    const handleSerpInfrastructureCounts = (data) => {
      console.log('🔍 SERP infrastructure counts received:', data);
      setSelectedNodeData(prev => ({
        ...prev,
        powerPlantsCount: data.powerPlantsCount,
        fiberConnectivity: data.fiberConnectivity
      }));
    };

    const handleOsmInfrastructureData = (data) => {
      console.log('🔍 OSM infrastructure data received:', data);
      setSelectedNodeData(prev => ({
        ...prev,
        substationsCount: data.substationsCount,
        waterAccess: data.waterAccess,
        landUse: data.landUse,
        transportationAccess: data.transportationAccess,
        criticalInfrastructure: data.criticalInfrastructure
      }));
    };

    if (window.mapEventBus) {
      const unsubscribeSerp = window.mapEventBus.on('serp:infrastructureCounts', handleSerpInfrastructureCounts);
      const unsubscribeOsm = window.mapEventBus.on('osm:infrastructureData', handleOsmInfrastructureData);
      
      return () => {
        unsubscribeSerp();
        unsubscribeOsm();
      };
    }
  }, []);

  // Reference to LayerToggle component for direct state updates
  const layerToggleRef = useRef(null);

  // Handler to update individual layer states (for AI Navigation)
  const handleLoadTransmissionScene = (sceneLayerState) => {
    // Update main map states
    if (sceneLayerState.showTransportation !== undefined) setShowTransportation(sceneLayerState.showTransportation);
    if (sceneLayerState.showRoads !== undefined) setShowRoads(sceneLayerState.showRoads);
    if (sceneLayerState.showParks !== undefined) setShowParks(sceneLayerState.showParks);
    // Denver scene loading logic removed
    
    // UPS Facilities Layer State
    if (sceneLayerState.showUPSFacilities !== undefined) setShowUPSFacilities(sceneLayerState.showUPSFacilities);
    // Amazon Fulfillment Layer State
    if (sceneLayerState.showAmazonFulfillment !== undefined) setShowAmazonFulfillment(sceneLayerState.showAmazonFulfillment);
    // 3D Buildings Layer State
    if (sceneLayerState.show3DBuildings !== undefined) setShow3DBuildings(sceneLayerState.show3DBuildings);
    // DIA Anchor Layer State
    if (sceneLayerState.showDIAAnchor !== undefined) setShowDIAAnchor(sceneLayerState.showDIAAnchor);
    // Cherry Creek Anchor Layer State
    if (sceneLayerState.showCherryCreekAnchor !== undefined) setShowCherryCreekAnchor(sceneLayerState.showCherryCreekAnchor);

    // Update transmission layer states
    setTransmissionLayerStates(prev => ({
      ...prev,
      ...sceneLayerState
    }));

    // Directly update LayerToggle states if possible
    if (layerToggleRef.current && layerToggleRef.current.updateLayerStates) {
      layerToggleRef.current.updateLayerStates(sceneLayerState);
    }
  };

  // Function to handle all click events and throttle animations
  const setupMapInteractionHandlers = (map) => {
    if (!map) return;
    
    // Handle any click on the map - we throttle the animation temporarily
    map.on('click', (e) => {
      debugLog('Map click detected, temporarily throttling animations');
      setRoadParticleThrottle(2, 1500); // medium throttle for 1.5 seconds
    });
    
    // Also throttle during drag operations
    map.on('dragstart', () => {
      debugLog('Map drag started, throttling animations');
      setRoadParticleThrottle(2, 500); // medium throttle, shorter duration
    });
    
    // Heavy throttle during zoom operations which are more intensive
    map.on('zoomstart', () => {
      debugLog('Map zoom started, heavily throttling animations');
      setRoadParticleThrottle(3, 1000); // high throttle for 1 second
    });
    
    // Handle the end of these operations
    map.on('zoomend', () => {
      debugLog('Map zoom ended, restoring animations');
      setTimeout(() => setRoadParticleThrottle(1), 300);
    });
    
    // Listen for custom events from AIChatPanel or SceneManager
    window.mapEventBus.on('scene:loading', () => {
      debugLog('Scene loading detected, heavily throttling animations');
      setRoadParticleThrottle(3, 2000); // heavy throttle during scene changes
    });
    
    window.mapEventBus.on('scene:loaded', () => {
      debugLog('Scene loaded, restoring animations');
      setTimeout(() => setRoadParticleThrottle(1), 500);
    });
    
    window.mapEventBus.on('ai:processing', () => {
      debugLog('AI processing detected, throttling animations');
      setRoadParticleThrottle(2, 3000); // medium throttle during AI operations
    });
    
    // Clean up when component unmounts
    return () => {
      map.off('click');
      map.off('dragstart');
      map.off('zoomstart');
      map.off('zoomend');
    };
  };


  
  // Handler for loading scenes
  // Add effect to expose handleLoadScene on the map object and window.mapComponent
  useEffect(() => {
    
    // Create window.mapComponent if it doesn't exist
    if (!window.mapComponent) {
      window.mapComponent = {};
    }
    
    // First make sure handleLoadScene is exposed globally
    // window.mapComponent.handleLoadScene = handleLoadScene; // Removed
    
    // Then attach to map.current when available
    if (map.current) {
      // Expose handleLoadScene function directly on the map object
      // map.current.handleLoadScene = handleLoadScene; // Removed
      
      // Update global reference with map object
      // window.mapComponent.map = map.current; // Removed
      
      window.mapInstance = map.current;
      
    } else {
      console.warn('map.current not available yet, handleLoadScene only available on window.mapComponent');
    }
    
    // Return cleanup function
    return () => {
      // Keep the global reference available even after component unmounts
    };
  }, [map.current]);

  useEffect(() => {
    if (map.current) {
      if (showRoadGrid) {
        initializeRoadGrid(map.current, {
          minzoom: 5,
          maxzoom: 22
        });
      } else {
        if (map.current.getLayer('road-grid')) {
          map.current.removeLayer('road-grid');
        }
      }
    }
  }, [showRoadGrid]);

  // Add this effect for road particles
  useEffect(() => {
    if (!map.current) return;

    const initializeParticles = async () => {
      try {
        // Wait for style to fully load
        if (!map.current.isStyleLoaded()) {
          await new Promise(resolve => {
            map.current.once('style.load', resolve);
          });
        }

        if (showRoadParticles) {
          debugLog('Starting road particles animation...');
          initializeRoadParticles(map.current);
          
          // Set up interaction handlers for the map
          const cleanupHandlers = setupMapInteractionHandlers(map.current);
          
          // Use the original requestAnimationFrame for the animation loop
          // to avoid potential issues with our wrapped version
          const originalRequestAnimationFrame = window._originalRAF || window.requestAnimationFrame;
          
          const animate = (timestamp) => {
            try {
              if (!map.current) return;
              
              animateRoadParticles({ map: map.current, timestamp });
              roadParticleAnimation.current = originalRequestAnimationFrame(animate);
            } catch (error) {
              debugError('Error in road particles animation:', error);
              if (roadParticleAnimation.current) {
                cancelAnimationFrame(roadParticleAnimation.current);
                roadParticleAnimation.current = null;
              }
            }
          };
          
          // Start the animation loop
          roadParticleAnimation.current = originalRequestAnimationFrame(animate);
          debugLog('Road particles animation started');
          
          // Return cleanup function that also removes event handlers
          return () => {
            if (cleanupHandlers) cleanupHandlers();
          };
        } else {
          if (roadParticleAnimation.current) {
            debugLog('Stopping road particles animation');
            stopRoadParticles(map.current);
            cancelAnimationFrame(roadParticleAnimation.current);
            roadParticleAnimation.current = null;
          }
        }
      } catch (error) {
        debugError('Failed to initialize road particles:', error);
      }
    };

    // Store original requestAnimationFrame if not already stored
    if (!window._originalRAF) {
      window._originalRAF = window.requestAnimationFrame;
    }

    // Initialize when map is ready
    if (map.current && map.current.loaded()) {
      debugLog('Map already loaded, initializing particles immediately');
      initializeParticles();
    } else {
      debugLog('Waiting for map to load before initializing particles');
      map.current.once('load', initializeParticles);
    }

    // Cleanup function
    return () => {
      if (roadParticleAnimation.current) {
        debugLog('Cleaning up road particle animation on effect cleanup');
        cancelAnimationFrame(roadParticleAnimation.current);
        roadParticleAnimation.current = null;
      }
    };
  }, [showRoadParticles]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (roadParticleAnimation.current) {
        cancelAnimationFrame(roadParticleAnimation.current);
        roadParticleAnimation.current = null;
      }
    };
  }, []);

  // Add a Layer Manager utility to better control layer loading and unloading
  // const LayerManager = (() => {
  //   const loadedLayers = new Set();
  //   const layerLoadTimes = {};
  //   const pendingLayers = [];
  //   const layerTypes = {};
  //   let processingQueue = false;
    
  //   // Process the layer queue gradually to avoid overwhelming the GPU
  //   const processLayerQueue = () => {
  //     if (pendingLayers.length === 0 || processingQueue || !map.current) {
  //       return;
  //     }
      
  //     processingQueue = true;
      
  //     // Process just a few layers at a time
  //     const batchSize = 2;
  //     const layersToProcess = pendingLayers.splice(0, batchSize);
      
  //     debugLog(`Processing ${layersToProcess.length} layers from queue. ${pendingLayers.length} remaining.`);
      
  //     layersToProcess.forEach(({ layerId, setupFunction, type }) => {
  //       const startTime = performance.now();
        
  //       try {
  //         debugLog(`Loading layer: ${layerId} (${type})`);
  //         setupFunction();
  //         loadedLayers.add(layerId);
  //         layerTypes[layerId] = type;
  //         const loadTime = performance.now() - startTime;
  //         layerLoadTimes[layerId] = loadTime;
  //         debugLog(`Loaded layer ${layerId} in ${loadTime.toFixed(2)}ms`);
  //       } catch (error) {
  //         debugError(`Failed to load layer ${layerId}:`, error);
  //         trackLayerOperation('load', layerId, error);
  //       }
  //     });
      
  //     processingQueue = false;
      
  //     // Continue processing queue after a short delay
  //     if (pendingLayers.length > 0) {
  //       const timeoutId = setTimeout(processLayerQueue, 100);
  //       timeoutIds.current.push(timeoutId);
  //     } else {
  //       debugLog('All layers processed successfully');
  //     }
  //   };
    
  //   return {
  //     queueLayer: (layerId, setupFunction, type = 'unknown') => {
  //       if (loadedLayers.has(layerId)) {
  //         debugLog(`Layer ${layerId} already loaded, skipping`);
  //         return;
  //       }
        
  //       pendingLayers.push({ layerId, setupFunction, type });
  //       debugLog(`Queued layer: ${layerId} (${type})`);
        
  //       if (!processingQueue) {
  //         processLayerQueue();
  //       }
  //     },
        
  //     removeLayer: (layerId) => {
  //       if (!map.current || !loadedLayers.has(layerId)) {
  //         return;
  //       }
        
  //       try {
  //         if (map.current.getLayer(layerId)) {
  //           map.current.removeLayer(layerId);
  //         }
          
  //         // If this layer has a source with the same ID, remove it too
  //         if (map.current.getSource(layerId)) {
  //           map.current.removeSource(layerId);
  //         }
          
  //         loadedLayers.delete(layerId);
  //         debugLog(`Removed layer: ${layerId}`);
  //       } catch (error) {
  //         debugError(`Failed to remove layer ${layerId}:`, error);
  //       }
  //     },
        
  //     getLayerStats: () => {
  //       return {
  //         totalLayers: loadedLayers.size,
  //         loadedLayers: Array.from(loadedLayers),
  //         pendingLayers: pendingLayers.map(l => l.layerId),
  //         layerLoadTimes,
  //         layerTypeBreakdown: Object.entries(
  //           Array.from(loadedLayers).reduce((acc, layerId) => {
  //             const type = layerTypes[layerId] || 'unknown';
  //             acc[type] = (acc[type] || 0) + 1;
  //             return acc;
  //           }, {})
  //         )
  //       };
  //     }
  //   };
  // })();
  
  // Add effect to periodically check layer health
  useEffect(() => {
    if (!DEBUG) return;
    
    const checkLayerHealth = () => {
      const stats = LayerManager.getLayerStats();
      debugLog('Layer stats:', stats);
      
      // Check if we have too many layers which could cause memory issues
      if (stats.totalLayers > 50) {
        debugWarn('High number of layers detected:', stats.totalLayers);
      }
      
      // Identify slow-loading layers
      const slowLayers = Object.entries(stats.layerLoadTimes)
        .filter(([_, time]) => time > 500)
        .sort((a, b) => b[1] - a[1]);
        
      if (slowLayers.length > 0) {
        debugWarn('Slow-loading layers detected:', 
          slowLayers.map(([id, time]) => `${id}: ${time.toFixed(2)}ms`));
      }
      
      // Check memory usage in Chrome
      if (window.performance && window.performance.memory) {
        const memoryInfo = window.performance.memory;
        const memoryUsagePercent = 
          (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
          
        if (memoryUsagePercent > 70) {
          debugWarn('High memory usage detected:', 
            `${memoryUsagePercent.toFixed(2)}% of available JS heap`);
        }
      }
    };
    
    const intervalId = setInterval(checkLayerHealth, 10000);
    intervalIds.current.push(intervalId);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);



  useEffect(() => {
    if (map.current) return;

    // Remove duplicate initialization since it's handled in useMapInitialization
    const handleMapLoad = async () => {
      if (!map.current || !map.current.isStyleLoaded()) {
        await new Promise(resolve => map.current?.once('style.load', resolve));
      }
      
      window.mapInstance = map.current;

      // Add debug logging to inspect available layers
      if (!map.current || !map.current.getStyle) return;
      const style = map.current.getStyle();
      if (!style || !style.layers) return;
      const layers = style.layers;
      const transportationLayers = layers.filter(layer => {
        const layerId = layer.id.toLowerCase();
        return layerId.includes('road') || 
               layerId.includes('transit') || 
               layerId.includes('railway') ||
               layerId.includes('highway') ||
               layerId.includes('bridge') ||
               layerId.includes('tunnel') ||
               layerId.includes('traffic') ||
               layerId.includes('transportation');
      });

      // Style water in the base map layers
      const waterLayers = [
        'water',
        'water-shadow',
        'waterway',
        'water-depth',
        'water-pattern'
      ];

      waterLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          // Handle fill layers
          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#001f3d');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.8);
          }
          
          // Handle line layers
          if (layer.type === 'line') {
            map.current.setPaintProperty(layerId, 'line-color', '#001f3d');
            map.current.setPaintProperty(layerId, 'line-opacity', 0.8);
          }
        } catch (error) {
          console.warn(`Could not style water layer ${layerId}:`, error);
        }
      });

      // Style parks and green areas
      const parkLayers = [
        'landuse',
        'park',
        'park-label',
        'national-park',
        'natural',
        'golf-course',
        'pitch',
        'grass'
      ];

      parkLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#092407');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.3);
          }
          if (layer.type === 'symbol' && map.current.getPaintProperty(layerId, 'background-color') !== undefined) {
            map.current.setPaintProperty(layerId, 'background-color', '#092407');
          }
        } catch (error) {
          console.warn(`Could not style park layer ${layerId}:`, error);
        }
      });
    };

    if (map.current) {
      handleMapLoad();
    } else {
      map.current.once('load', handleMapLoad);
    }
  }, [isErcotMode]);

  // Add cleanup effect for AI consensus animation
  useEffect(() => {
    if (!map.current) return;

    return () => {
      // Clean up AI consensus particles layer
      if (map.current.getLayer('ai-consensus-particles')) {
        map.current.removeLayer('ai-consensus-particles');
      }
      if (map.current.getSource('ai-consensus-particles')) {
        map.current.removeSource('ai-consensus-particles');
      }
    };
  }, []);

  // Power Circle activation from REIT popup or location search "Analyze Power Capacity" button
  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;
    const handlePowerCircleActivate = (data) => {
      const center = Array.isArray(data?.center) ? data.center : null;
      const numericCenter = Array.isArray(center)
        && center.length >= 2
        && Number.isFinite(Number(center[0]))
        && Number.isFinite(Number(center[1]))
        ? [Number(center[0]), Number(center[1])]
        : null;
      const radiusMiles = Number.isFinite(Number(data?.radiusMiles)) && Number(data.radiusMiles) > 0
        ? Number(data.radiusMiles)
        : 5;
      if (!numericCenter) return;
      if (powerCircleActive) setPowerCircleActive(false);
      setPowerCircleCenter(numericCenter);
      setPowerCircleRadius(radiusMiles);
      setPowerCircleActive(true);
      logEvent('power_circle_activated', { source: data.source, center: numericCenter, radiusMiles }, 'map');
      if (data.source === 'location_search' && window.mapEventBus) {
        window.mapEventBus.emit('location-search:ring:clear', { source: 'power_circle_activate' });
      }
      if (map.current) {
        if (data.source === 'location_search' || data.source === 'texas_data_centers') {
          // Zoom out so full circle is visible; on mobile, position circle at top above response card
          const circlePoly = turf.circle(numericCenter, radiusMiles, { steps: 64, units: 'miles' });
          const bbox = turf.bbox(circlePoly);
          map.current.fitBounds(bbox, {
            padding: isMobile ? { top: 20, bottom: 320, left: 24, right: 24 } : { top: 20, bottom: 20, left: 24, right: 24 },
            duration: 1000,
            maxZoom: 11
          });
        } else {
          map.current.flyTo({
            center: numericCenter,
            zoom: 12,
            speed: 1.2,
            curve: 1.42,
            essential: true
          });
        }
      }
    };
    window.mapEventBus.on('power-circle:activate', handlePowerCircleActivate);
    return () => window.mapEventBus.off('power-circle:activate', handlePowerCircleActivate);
  }, [powerCircleActive, isMobile]);

  // Location-search ring highlight (red dashed, no fill)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return undefined;
    let ringAnimationInterval = null;
    let ringAnimationTimeout = null;
    let ringDistanceBadgeMarker = null;
    let badgeRoot = null;
    let pendingBadgeUnmountFrame = null;
    let currentRingCenter = null;
    let currentRingRadiusMiles = SEARCH_LOCATION_RING_DEFAULT_RADIUS_MI;
    let currentRingColor = '#ef4444';

    const clearRingAnimation = () => {
      if (ringAnimationInterval) {
        clearInterval(ringAnimationInterval);
        ringAnimationInterval = null;
      }
      if (ringAnimationTimeout) {
        clearTimeout(ringAnimationTimeout);
        ringAnimationTimeout = null;
      }
    };

    const clearRingDistanceBadge = () => {
      if (pendingBadgeUnmountFrame != null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(pendingBadgeUnmountFrame);
        pendingBadgeUnmountFrame = null;
      }
      if (badgeRoot) {
        const rootToUnmount = badgeRoot;
        badgeRoot = null;
        if (typeof window !== 'undefined') {
          pendingBadgeUnmountFrame = window.requestAnimationFrame(() => {
            pendingBadgeUnmountFrame = null;
            rootToUnmount.unmount();
          });
        } else {
          rootToUnmount.unmount();
        }
      }
      if (ringDistanceBadgeMarker) {
        ringDistanceBadgeMarker.remove();
        ringDistanceBadgeMarker = null;
      }
    };

    const setRingGeometryForRadius = (center, radiusMiles, color) => {
      if (!map.current || !Array.isArray(center) || center.length < 2) return;
      const ringColor = color || currentRingColor;
      currentRingColor = ringColor;
      const ringGeojson = turf.circle(center, radiusMiles, { steps: 96, units: 'miles' });

      if (map.current.getSource(LOCATION_SEARCH_RING_SOURCE_ID)) {
        map.current.getSource(LOCATION_SEARCH_RING_SOURCE_ID).setData(ringGeojson);
      } else {
        map.current.addSource(LOCATION_SEARCH_RING_SOURCE_ID, {
          type: 'geojson',
          data: ringGeojson
        });
      }

      if (!map.current.getLayer(LOCATION_SEARCH_RING_LAYER_ID)) {
        map.current.addLayer({
          id: LOCATION_SEARCH_RING_LAYER_ID,
          type: 'line',
          source: LOCATION_SEARCH_RING_SOURCE_ID,
          paint: {
            'line-color': ringColor,
            'line-width': 2,
            'line-opacity': 0.95,
            'line-dasharray': [2, 2]
          }
        });
      } else {
        map.current.setPaintProperty(LOCATION_SEARCH_RING_LAYER_ID, 'line-color', ringColor);
      }

      if (map.current.getSource(LOCATION_SEARCH_RING_HALO_SOURCE_ID)) {
        map.current.getSource(LOCATION_SEARCH_RING_HALO_SOURCE_ID).setData(ringGeojson);
      } else {
        map.current.addSource(LOCATION_SEARCH_RING_HALO_SOURCE_ID, {
          type: 'geojson',
          data: ringGeojson
        });
      }

      if (!map.current.getLayer(LOCATION_SEARCH_RING_HALO_LAYER_ID)) {
        map.current.addLayer({
          id: LOCATION_SEARCH_RING_HALO_LAYER_ID,
          type: 'line',
          source: LOCATION_SEARCH_RING_HALO_SOURCE_ID,
          paint: {
            'line-color': ringColor,
            'line-width': 3,
            'line-opacity': 0
          }
        });
      } else {
        map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-color', ringColor);
      }
    };

    const removeLocationSearchRing = () => {
      clearRingAnimation();
      clearRingDistanceBadge();
      currentRingCenter = null;
      currentRingRadiusMiles = SEARCH_LOCATION_RING_DEFAULT_RADIUS_MI;
      if (!map.current) return;
      if (map.current.getLayer(LOCATION_SEARCH_RING_LAYER_ID)) {
        map.current.removeLayer(LOCATION_SEARCH_RING_LAYER_ID);
      }
      if (map.current.getSource(LOCATION_SEARCH_RING_SOURCE_ID)) {
        map.current.removeSource(LOCATION_SEARCH_RING_SOURCE_ID);
      }
      if (map.current.getLayer(LOCATION_SEARCH_RING_HALO_LAYER_ID)) {
        map.current.removeLayer(LOCATION_SEARCH_RING_HALO_LAYER_ID);
      }
      if (map.current.getSource(LOCATION_SEARCH_RING_HALO_SOURCE_ID)) {
        map.current.removeSource(LOCATION_SEARCH_RING_HALO_SOURCE_ID);
      }
    };

    const renderLocationSearchRing = (center, color, radiusMiles) => {
      const numericCenter = Array.isArray(center)
        && center.length >= 2
        && Number.isFinite(Number(center[0]))
        && Number.isFinite(Number(center[1]))
        ? [Number(center[0]), Number(center[1])]
        : null;
      const numericRadius = Number.isFinite(Number(radiusMiles)) && Number(radiusMiles) > 0
        ? Number(radiusMiles)
        : SEARCH_LOCATION_RING_DEFAULT_RADIUS_MI;
      if (!map.current || !numericCenter) return;
      currentRingCenter = numericCenter;
      currentRingRadiusMiles = numericRadius;
      if (color) currentRingColor = color;

      const drawRing = () => {
        if (!map.current) return;
        setRingGeometryForRadius(numericCenter, currentRingRadiusMiles, currentRingColor);
        clearRingDistanceBadge();

        const topPoint = turf.destination(
          turf.point(numericCenter),
          currentRingRadiusMiles,
          0,
          { units: 'miles' }
        );

        const handleRadiusSelect = (nextRadius) => {
          currentRingRadiusMiles = nextRadius;
          if (!currentRingCenter) return;

          setRingGeometryForRadius(currentRingCenter, nextRadius, currentRingColor);

          const nextTopPoint = turf.destination(
            turf.point(currentRingCenter),
            nextRadius,
            0,
            { units: 'miles' }
          );
          ringDistanceBadgeMarker?.setLngLat(nextTopPoint.geometry.coordinates);

          if (map.current) {
            const ringPoly = turf.circle(currentRingCenter, nextRadius, { steps: 64, units: 'miles' });
            const bbox = turf.bbox(ringPoly);
            map.current.fitBounds(bbox, {
              padding: isMobile
                ? { top: 60, bottom: 320, left: 24, right: 24 }
                : { top: 60, bottom: 60, left: 60, right: 60 },
              duration: 600,
              maxZoom: 15
            });
          }

          renderBadge(nextRadius);
        };

        const renderBadge = (radius) => {
          if (!badgeRoot) return;
          badgeRoot.render(
            <SearchRadiusBadge
              currentRadius={radius}
              onRadiusSelect={handleRadiusSelect}
            />
          );
        };

        const badgeContainerEl = document.createElement('div');
        badgeContainerEl.style.cssText = 'position:relative;display:inline-block;pointer-events:auto';
        badgeRoot = createRoot(badgeContainerEl);
        renderBadge(currentRingRadiusMiles);

        ringDistanceBadgeMarker = new mapboxgl.Marker({
          element: badgeContainerEl,
          anchor: 'bottom',
          offset: [0, -9]
        })
          .setLngLat(topPoint.geometry.coordinates)
          .addTo(map.current);

        clearRingAnimation();
        const animationDurationMs = 4800;
        const pulseMs = 160;
        const start = performance.now();

        ringAnimationInterval = setInterval(() => {
          if (!map.current) return;
          const elapsed = performance.now() - start;
          const t = elapsed / animationDurationMs;
          if (t >= 1) return;

          const pulse = (Math.sin((elapsed / 760) * Math.PI * 2) + 1) / 2;

          if (map.current.getLayer(LOCATION_SEARCH_RING_HALO_LAYER_ID)) {
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-opacity', 0.08 + (pulse * 0.22));
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-width', 3.2 + (pulse * 4.8));
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-blur', 0.15 + (pulse * 0.7));
          }
          if (map.current.getLayer(LOCATION_SEARCH_RING_LAYER_ID)) {
            map.current.setPaintProperty(LOCATION_SEARCH_RING_LAYER_ID, 'line-opacity', 0.72 + (pulse * 0.23));
            map.current.setPaintProperty(LOCATION_SEARCH_RING_LAYER_ID, 'line-width', 1.7 + (pulse * 0.9));
          }
        }, pulseMs);

        ringAnimationTimeout = setTimeout(() => {
          clearRingAnimation();
          if (!map.current) return;
          if (map.current.getLayer(LOCATION_SEARCH_RING_HALO_LAYER_ID)) {
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-opacity', 0);
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-width', 3);
            map.current.setPaintProperty(LOCATION_SEARCH_RING_HALO_LAYER_ID, 'line-blur', 0);
          }
          if (map.current.getLayer(LOCATION_SEARCH_RING_LAYER_ID)) {
            map.current.setPaintProperty(LOCATION_SEARCH_RING_LAYER_ID, 'line-opacity', 0.95);
            map.current.setPaintProperty(LOCATION_SEARCH_RING_LAYER_ID, 'line-width', 2);
          }
        }, animationDurationMs + 80);
      };

      if (!map.current.isStyleLoaded()) {
        map.current.once('styledata', drawRing);
        return;
      }
      drawRing();
    };

    const handleShowRing = (data) => {
      renderLocationSearchRing(data?.center, data?.color, data?.radiusMiles);
    };

    const handleClearRing = () => {
      removeLocationSearchRing();
    };

    window.mapEventBus.on('location-search:ring:show', handleShowRing);
    window.mapEventBus.on('location-search:ring:clear', handleClearRing);

    return () => {
      window.mapEventBus.off('location-search:ring:show', handleShowRing);
      window.mapEventBus.off('location-search:ring:clear', handleClearRing);
      if (pendingBadgeUnmountFrame != null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(pendingBadgeUnmountFrame);
        pendingBadgeUnmountFrame = null;
      }
      removeLocationSearchRing();
    };
  }, [map]);

  // Deactivate Power Circle when clicking outside
  useEffect(() => {
    if (!map?.current || !powerCircleActive || !powerCircleCenter) return;
    const handleMapClick = (e) => {
      const handleMarker = document.querySelector('.power-circle-handle');
      if (handleMarker?.contains(e.originalEvent?.target) || e.originalEvent?.target?.closest('.power-circle-handle')) return;
      const clickPoint = turf.point([e.lngLat.lng, e.lngLat.lat]);
      const circlePolygon = turf.circle(powerCircleCenter, powerCircleRadius, { steps: 128, units: 'miles' });
      if (!turf.booleanPointInPolygon(clickPoint, circlePolygon)) {
        if (window.mapEventBus) {
          window.mapEventBus.emit('power-circle:deactivate', { center: powerCircleCenter });
        }
        setPowerCircleActive(false);
        setPowerCircleCenter(null);
      }
    };
    map.current.on('click', handleMapClick);
    return () => { map.current?.off('click', handleMapClick); };
  }, [map, powerCircleActive, powerCircleCenter, powerCircleRadius]);

  const dragStart = (e) => {
    if (e.type === "mousedown") {
      isDraggingRef.current = true;
      initialXRef.current = e.clientX - xOffsetRef.current;
      initialYRef.current = e.clientY - yOffsetRef.current;
    } else if (e.type === "touchstart") {
      isDraggingRef.current = true;
      initialXRef.current = e.touches[0].clientX - xOffsetRef.current;
      initialYRef.current = e.touches[0].clientY - yOffsetRef.current;
    }
  };

  const dragEnd = () => {
    isDraggingRef.current = false;
    initialXRef.current = currentXRef.current;
    initialYRef.current = currentYRef.current;
  };

  const drag = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      
      if (e.type === "mousemove") {
        currentXRef.current = e.clientX - initialXRef.current;
        currentYRef.current = e.clientY - initialYRef.current;
      } else if (e.type === "touchmove") {
        currentXRef.current = e.touches[0].clientX - initialXRef.current;
        currentYRef.current = e.touches[0].clientY - initialYRef.current;
      }

      xOffsetRef.current = currentXRef.current;
      yOffsetRef.current = currentYRef.current;
      
      if (popupRef.current) {
        popupRef.current.style.transform = 
          `translate3d(${currentXRef.current}px, ${currentYRef.current}px, 0)`;
      }
    }
  };

  useEffect(() => {
    if (!map.current) return;

    // Update bounds whenever the map moves
    const updateBounds = () => {
      const bounds = map.current.getBounds();
    };

    map.current.on('moveend', updateBounds);
    // Get initial bounds
    updateBounds();

    return () => {
      if (map.current) {
        map.current.off('moveend', updateBounds);
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Add touch event handlers
    const handleTouchStart = (e) => {
      if (!e || !e.touches) return;
      
      if (e.touches.length === 2) {
        e.preventDefault(); // Prevent default zoom behavior
      }
    };

    const handleTouchMove = (e) => {
      if (!e || !e.touches) return;
      
      if (e.touches.length === 2) {
        e.preventDefault();
      }
    };

    // Add the event listeners to the canvas container
    const mapCanvas = map.current.getCanvas();
    if (mapCanvas) {
      mapCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      mapCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        mapCanvas.removeEventListener('touchstart', handleTouchStart);
        mapCanvas.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, []);

  // Add cleanup effect for 3D buildings
  useEffect(() => {
    return () => {
      if (map.current) {
        debugLog('Cleaning up 3D building layers');
        
        // Use LayerManager to safely remove 3D layers
        LayerManager.removeLayer('buildings-3d-layer');
        LayerManager.removeLayer('osm-buildings-3d');
        
        // Remove the source last
        if (map.current.getSource('osm-buildings')) {
          try {
            map.current.removeSource('osm-buildings');
            debugLog('Removed osm-buildings source');
          } catch (error) {
            debugError('Error removing osm-buildings source:', error);
          }
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const allKeys = [
      'fort-stockton', 'ozona', 'sonora', 'rocksprings', 'leakey', 'hondo', 'castroville',
      'junction', 'balmorhea', 'monahans', 'pecos', 'toyah'
    ];

    const removeAll = () => {
      allKeys.forEach(key => {
        // Remove circle layers
        const layerId = `${key}-radius-layer`;
        const sourceId = `${key}-radius`;
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
        
        // Remove label layers
        const labelLayerId = `${key}-label-layer`;
        const labelSourceId = `${key}-label`;
        if (map.current.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
        if (map.current.getSource(labelSourceId)) map.current.removeSource(labelSourceId);
      });
    };

    if (!showFortStocktonRadius) {
      removeAll();
      return;
    }

    // Add circles and labels
    const FORT_STOCKTON_COORDS = [-102.879996, 30.894348];
    const radiusMiles = 5;
    const radiusKm = radiusMiles * 1.60934;
    const cityDefs = [
      { key: 'fort-stockton', coords: FORT_STOCKTON_COORDS, color: '#FFD600', name: 'Fort Stockton' },
      { key: 'ozona', coords: OZONA_COORDS, color: '#FFD600', name: 'Ozona' },
      { key: 'sonora', coords: SONORA_COORDS, color: '#FFD600', name: 'Sonora' },
      { key: 'rocksprings', coords: ROCKSPRINGS_COORDS, color: '#FFD600', name: 'Rocksprings' },
      { key: 'leakey', coords: LEAKEY_COORDS, color: '#FFD600', name: 'Leakey' },
      { key: 'hondo', coords: HONDO_COORDS, color: '#FFD600', name: 'Hondo' },
      { key: 'castroville', coords: CASTROVILLE_COORDS, color: '#FFD600', name: 'Castroville' },
      { key: 'junction', coords: JUNCTION_COORDS, color: '#2196F3', name: 'Junction' },
      { key: 'balmorhea', coords: BALMORHEA_COORDS, color: '#FFA500', name: 'Balmorhea' },
      { key: 'monahans', coords: MONAHANS_COORDS, color: '#FFA500', name: 'Monahans' },
      { key: 'pecos', coords: PECOS_COORDS, color: '#FFA500', name: 'Pecos' },
      { key: 'toyah', coords: TOYAH_COORDS, color: '#FFA500', name: 'Toyah' }
    ];
    
    cityDefs.forEach(({ key, coords, color, name }) => {
      // Add circle
      const geojson = turf.circle(coords, radiusKm, { steps: 128, units: 'kilometers', properties: { name: key + ' 5mi Radius' } });
      const sourceId = `${key}-radius`;
      const layerId = `${key}-radius-layer`;
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      map.current.addSource(sourceId, { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {},
        paint: {
          'line-color': color,
          'line-width': 3,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9
        }
      });
      
      // Add label
      const labelSourceId = `${key}-label`;
      const labelLayerId = `${key}-label-layer`;
      const labelFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coords[0], coords[1] + 0.07] // slightly north of center
        },
        properties: { name: name }
      };
      
      if (map.current.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
      if (map.current.getSource(labelSourceId)) map.current.removeSource(labelSourceId);
      
      map.current.addSource(labelSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [labelFeature] }
      });
      map.current.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: labelSourceId,
        layout: {
          'text-field': name,
          'text-font': ['Arial Unicode MS Regular'],
          'text-size': 12,
          'text-anchor': 'bottom',
          'text-offset': [0, -1.0],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#000',
          'text-halo-width': 8,
          'text-halo-blur': 1
        }
      });
    });

    return removeAll;
  }, [showFortStocktonRadius, map.current]);

  // One-time filter to hide default "Unnamed" labels from the basemap.
  // NOTE: We run this once after the style is fully loaded, instead of
  // on every 'styledata' event, to avoid repeated heavy work during tile loading.
  useEffect(() => {
    if (!map.current) return;

    const applyUnnamedLabelFilter = () => {
      if (!map.current || !map.current.getStyle) return;
      const style = map.current.getStyle();
      if (!style || !style.layers) return;

      style.layers.forEach((layer) => {
        // Only touch symbol layers that actually render text labels
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          try {
            const existingFilter = map.current.getFilter(layer.id);
            const unnamedFilter = [
              'all',
              ['!=', ['get', 'name'], 'Unnamed'],
              ['!=', ['get', 'name'], 'Unnamed Road'],
              ['!=', ['get', 'name'], 'Unnamed Area']
            ];

            if (!existingFilter) {
              map.current.setFilter(layer.id, unnamedFilter);
            } else {
              map.current.setFilter(layer.id, ['all', existingFilter, unnamedFilter]);
            }
          } catch (e) {
            // Ignore layers that don't support filters or don't have a 'name' property
          }
        }
      });
    };

    if (map.current.isStyleLoaded()) {
      // Style is already loaded, apply immediately
      applyUnnamedLabelFilter();
    } else {
      // Wait for the first complete style load, then apply once
      const onceHandler = () => {
        applyUnnamedLabelFilter();
        if (map.current && map.current.off) {
          map.current.off('styledata', onceHandler);
        }
      };
      map.current.on('styledata', onceHandler);

      return () => {
        if (map.current && map.current.off) {
          map.current.off('styledata', onceHandler);
        }
      };
    }
  }, []);

  // Map extends full height; card overlays the bottom. No bottom padding to avoid gap.
  const mapBottomPadding = 0;

  return (
    <MapContainer>
      <div 
        ref={mapContainer} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: mapBottomPadding,
          transition: 'bottom 0.3s ease'
        }} 
      />
      <div
        ref={mapMenuRef}
        style={{
          position: 'absolute',
          top: isMobile ? '7px' : 'auto',
          bottom: isMobile ? 'auto' : '16px',
          right: isMobile ? '9px' : '16px',
          zIndex: 1100,
          display: 'flex',
          flexDirection: isMobile ? 'column-reverse' : 'column',
          alignItems: 'flex-end',
          gap: '6px'
        }}
      >
        {isMapAboutOpen && (
          isMobile ? (
            <div
              onClick={() => setIsMapAboutOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.28)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 12010
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(420px, calc(100vw - 32px))',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  background: 'rgba(15,23,42,0.92)',
                  color: 'rgba(226,232,240,0.95)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: '12px',
                  padding: '14px 14px 18px',
                  fontSize: '11px',
                  lineHeight: 1.4,
                  transformOrigin: 'top center',
                  animation: 'menuSectionReveal 0.42s ease-out both'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>About</div>
                <div>Switchyard makes hidden infrastructure visible - search an address to see what is happening nearby.</div>
                <div style={{ marginTop: '6px' }}>Data from public reports + county queue aggregates (Texas), including 170 tracked projects. Overlaid with 76,001 ERCOT GIS interconnection records across all 254 Texas counties.</div>
                <div style={{ marginTop: '4px' }}>
                  <a
                    href="https://www.linkedin.com/in/yair-titelboim-aaa5ab18"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#8ab4f8', textDecoration: 'none' }}
                  >
                    Yair Titelboim on LinkedIn
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              width: '250px',
              background: 'rgba(15,23,42,0.92)',
              color: 'rgba(226,232,240,0.95)',
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
              fontSize: '11px',
              lineHeight: 1.4,
              transformOrigin: 'top center',
              animation: 'menuSectionReveal 0.42s ease-out both'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>About</div>
              <div>Switchyard makes hidden infrastructure visible - search an address to see what is happening nearby.</div>
              <div style={{ marginTop: '6px' }}>Data from public reports + county queue aggregates (Texas), including 170 tracked projects. Overlaid with 76,001 ERCOT GIS interconnection records across all 254 Texas counties.</div>
              <div style={{ marginTop: '4px' }}>
                <a
                  href="https://www.linkedin.com/in/yair-titelboim-aaa5ab18"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#8ab4f8', textDecoration: 'none' }}
                >
                  Yair Titelboim on LinkedIn
                </a>
              </div>
            </div>
          )
        )}
        {isMapContactOpen && (
          isMobile ? (
            <div
              onClick={() => setIsMapContactOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.28)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 12010
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(420px, calc(100vw - 32px))',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  background: 'rgba(15,23,42,0.92)',
                  color: 'rgba(226,232,240,0.95)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: '12px',
                  padding: '14px 14px 18px',
                  fontSize: '11px',
                  lineHeight: 1.4,
                  transformOrigin: 'top center',
                  animation: 'menuSectionReveal 0.42s ease-out both'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '8px' }}>Feedback</div>
                <input
                  type="email"
                  placeholder="Your email (optional)"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                    border: '1px solid rgba(148,163,184,0.4)',
                    borderRadius: '6px',
                    background: 'rgba(30,41,59,0.9)',
                    color: 'rgba(241,245,249,0.94)',
                    fontSize: '11px',
                    padding: '7px 8px',
                    outline: 'none'
                  }}
                />
                <textarea
                  placeholder="Share feedback..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid rgba(148,163,184,0.4)',
                    borderRadius: '6px',
                    background: 'rgba(30,41,59,0.9)',
                    color: 'rgba(241,245,249,0.94)',
                    fontSize: '11px',
                    padding: '7px 8px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const message = feedbackMessage.trim();
                    if (!message || isSendingFeedback) return;

                    setIsSendingFeedback(true);
                    try {
                      const response = await fetch('/api/ui/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          event_type: 'feedback_contact',
                          feedback_email: feedbackEmail.trim(),
                          feedback_message: message
                        })
                      });
                      const payload = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        throw new Error(payload?.message || payload?.error || 'Failed to send feedback');
                      }
                      setFeedbackEmail('');
                      setFeedbackMessage('');
                      setIsMapContactOpen(false);
                      if (typeof window !== 'undefined') {
                        window.alert('Feedback sent. Thank you.');
                      }
                    } catch (error) {
                      console.error('Failed to send feedback:', error);
                      if (typeof window !== 'undefined') {
                        window.alert(`Could not send feedback: ${error.message}`);
                      }
                    } finally {
                      setIsSendingFeedback(false);
                    }
                  }}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'rgba(30,41,59,0.9)',
                    color: 'rgba(241,245,249,0.94)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'center',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                  disabled={isSendingFeedback || !feedbackMessage.trim()}
                >
                  {isSendingFeedback ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              width: '250px',
              background: 'rgba(15,23,42,0.92)',
              color: 'rgba(226,232,240,0.95)',
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
              fontSize: '11px',
              lineHeight: 1.4,
              transformOrigin: 'top center',
              animation: 'menuSectionReveal 0.42s ease-out both'
            }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>Feedback</div>
            <input
              type="email"
              placeholder="Your email (optional)"
              value={feedbackEmail}
              onChange={(e) => setFeedbackEmail(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '8px',
                border: '1px solid rgba(148,163,184,0.4)',
                borderRadius: '6px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: '11px',
                padding: '7px 8px',
                outline: 'none'
              }}
            />
            <textarea
              placeholder="Share feedback..."
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid rgba(148,163,184,0.4)',
                borderRadius: '6px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: '11px',
                padding: '7px 8px',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const message = feedbackMessage.trim();
                if (!message || isSendingFeedback) return;

                setIsSendingFeedback(true);
                try {
                  const response = await fetch('/api/ui/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      event_type: 'feedback_contact',
                      feedback_email: feedbackEmail.trim(),
                      feedback_message: message
                    })
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    throw new Error(payload?.message || payload?.error || 'Failed to send feedback');
                  }
                  setFeedbackEmail('');
                  setFeedbackMessage('');
                  setIsMapContactOpen(false);
                  if (typeof window !== 'undefined') {
                    window.alert('Feedback sent. Thank you.');
                  }
                } catch (error) {
                  console.error('Failed to send feedback:', error);
                  if (typeof window !== 'undefined') {
                    window.alert(`Could not send feedback: ${error.message}`);
                  }
                } finally {
                  setIsSendingFeedback(false);
                }
              }}
              style={{
                marginTop: '8px',
                width: '100%',
                border: 'none',
                borderRadius: '8px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: '11px',
                fontWeight: 600,
                textAlign: 'center',
                padding: '8px 10px',
                cursor: 'pointer'
              }}
              disabled={isSendingFeedback || !feedbackMessage.trim()}
            >
              {isSendingFeedback ? 'Sending...' : 'Send Feedback'}
            </button>
            </div>
          )
        )}

        {isMapMenuOpen && (
          <div style={{
            minWidth: isMobile ? '160px' : '180px',
            background: 'rgba(15,23,42,0.92)',
            border: '1px solid rgba(148,163,184,0.35)',
            borderRadius: '10px',
            padding: '6px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            transformOrigin: 'top center',
            animation: 'menuSectionReveal 0.42s ease-out both'
          }}>
            <button
              type="button"
              onClick={() => {
                setIsMapAboutOpen((prev) => !prev);
                setIsMapContactOpen(false);
                setIsMapMenuOpen(false);
              }}
              style={{
                border: 'none',
                borderRadius: '8px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: 600,
                textAlign: 'left',
                padding: '8px 10px',
                cursor: 'pointer',
                animation: 'menuItemSlideDown 0.3s ease-out both',
                animationDelay: '0.07s'
              }}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMapContactOpen((prev) => !prev);
                setIsMapAboutOpen(false);
                setIsMapMenuOpen(false);
              }}
              style={{
                border: 'none',
                borderRadius: '8px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: 600,
                textAlign: 'left',
                padding: '8px 10px',
                cursor: 'pointer',
                animation: 'menuItemSlideDown 0.3s ease-out both',
                animationDelay: '0.13s'
              }}
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => {
                const nextTheme = mapTheme === 'dark' ? 'light' : 'dark';
                setMapTheme(nextTheme);
                setIsMapMenuOpen(false);
                setIsMapAboutOpen(false);
                setIsMapContactOpen(false);
                if (typeof window !== 'undefined') {
                  try {
                    window.localStorage.setItem('map-theme', nextTheme);
                  } catch {
                    // Ignore storage failures
                  }
                  window.location.reload();
                }
              }}
              style={{
                border: 'none',
                borderRadius: '8px',
                background: 'rgba(30,41,59,0.9)',
                color: 'rgba(241,245,249,0.94)',
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: 600,
                textAlign: 'left',
                padding: '8px 10px',
                cursor: 'pointer',
                animation: 'menuItemSlideDown 0.3s ease-out both',
                animationDelay: '0.19s'
              }}
              title={`Switch to ${mapTheme === 'dark' ? 'light' : 'dark'} map theme`}
            >
              {mapTheme === 'dark' ? 'Switch to Light Map' : 'Switch to Dark Map'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsMapMenuOpen((prev) => !prev)}
          style={{
            border: isMobile ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(148,163,184,0.42)',
            borderRadius: isMobile ? '6px' : '999px',
            background: isMobile ? 'rgba(10,13,18,0.25)' : 'rgba(15,23,42,0.72)',
            color: 'rgba(241,245,249,0.92)',
            width: isMobile ? '30px' : 'auto',
            height: isMobile ? '30px' : 'auto',
            fontSize: isMobile ? '8.5px' : '9.5px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: isMobile ? '0' : '6px 9px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            opacity: isMobile && !isMobileMenuIconVisible ? 0 : 1,
            pointerEvents: isMobile && !isMobileMenuIconVisible ? 'none' : 'auto',
            transition: 'opacity 0.2s ease'
          }}
          title="Open map menu"
        >
          {isMobile ? (
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#0a0d12',
              border: animateMenuIconPulse ? '2px solid rgba(250,204,21,0.95)' : '2px solid rgba(255,255,255,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: animateMenuIconPulse ? 'menuIconPulse 1s ease-out 2' : 'none',
              transition: 'border-color 0.2s ease'
            }}>
              <span style={{
                color: animateMenuIconPulse ? '#facc15' : '#ffffff',
                fontSize: '14px',
                fontWeight: 800,
                lineHeight: 1,
                marginTop: '-1px',
                transition: 'color 0.2s ease'
              }}>
                ?
              </span>
            </div>
          ) : (
            'INFO'
          )}
        </button>
      </div>
      <style>{`
        @keyframes menuSectionReveal {
          0% { opacity: 0; transform: translateY(-6px) scaleY(0.92); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes menuItemSlideDown {
          0% { opacity: 0; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes menuIconPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250,204,21,0.55); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(250,204,21,0.22); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(250,204,21,0); }
        }
      `}</style>
      {isMobile && (
        <button
          ref={mobileBottomMenuTriggerRef}
          type="button"
          onClick={() => setIsMapMenuOpen((prev) => !prev)}
          style={{
            position: 'absolute',
            right: '9px',
            bottom: '7px',
            zIndex: 1100,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            background: 'rgba(10,13,18,0.25)',
            color: 'rgba(241,245,249,0.92)',
            width: '30px',
            height: '30px',
            padding: 0,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            opacity: !isMobileMenuIconVisible ? 0 : 1,
            pointerEvents: !isMobileMenuIconVisible ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Open map menu"
        >
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#0a0d12',
            border: animateMenuIconPulse ? '2px solid rgba(250,204,21,0.95)' : '2px solid rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: animateMenuIconPulse ? 'menuIconPulse 1s ease-out 2' : 'none',
            transition: 'border-color 0.2s ease'
          }}>
            <span style={{
              color: animateMenuIconPulse ? '#facc15' : '#ffffff',
              fontSize: '14px',
              fontWeight: 800,
              lineHeight: 1,
              marginTop: '-1px',
              transition: 'color 0.2s ease'
            }}>
              ?
            </span>
          </div>
        </button>
      )}
      <PopupManager key={`popup-${mapThemeStyleKey}`} map={map} />
      <Suspense fallback={null}>
        <MCPSearchResults key={`mcp-${mapThemeStyleKey}`} map={map} />
      </Suspense>
      <ErcotManager key={`ercot-manager-${mapThemeStyleKey}`} ref={ercotManagerRef} map={map} isErcotMode={isErcotMode} setIsErcotMode={setIsErcotMode} />
      <Suspense fallback={null}>
        <PowerConnectionsLayer key={`power-connections-${mapThemeStyleKey}`} map={map} />
      </Suspense>
      <PowerCircleLayer
        key={`power-circle-${mapThemeStyleKey}`}
        map={map}
        center={powerCircleCenter}
        radiusMiles={powerCircleRadius}
        isActive={powerCircleActive}
        onRadiusChange={setPowerCircleRadius}
      />

      {/* On mobile the layer panel is hidden, so mount key layers here to keep map data visible. */}
      {isMobile && (
        <Suspense fallback={null}>
          <HIFLDTransmissionLayer key={`hifld-${mapThemeStyleKey}`} map={map} visible={!!showHIFLDTransmission} />
          <ERCOTGISReportsLayer key={`ercot-reports-${mapThemeStyleKey}`} map={map} visible={!!showERCOTGISReports} />
          <ProducerConsumerCountiesLayer key={`producer-consumer-${mapThemeStyleKey}`} map={map} visible={!!showProducerConsumerCounties} />
          <SpatialMismatchCountiesLayer key={`spatial-mismatch-${mapThemeStyleKey}`} map={map} visible={!!showSpatialMismatchCounties} />
          <REITLayer key={`reit-${mapThemeStyleKey}`} map={map} visible={!!showREIT} />
          <MemphisCountiesLayer key={`memphis-counties-${mapThemeStyleKey}`} map={map} visible={!!showMemphisCounties} />
          <MemphisAIExpansionLayer key={`memphis-ai-expansion-${mapThemeStyleKey}`} map={map} visible={!!showMemphisAIExpansion} />
          <MLGW2026SubstationLayer key={`mlgw-2026-${mapThemeStyleKey}`} map={map} visible={!!showMLGW2026} />
          <XAISitesPublicLayer key={`xai-sites-public-${mapThemeStyleKey}`} map={map} visible={!!showXAISitesPublic} />
          <XAIToMLGWLinesLayer key={`xai-to-mlgw-${mapThemeStyleKey}`} map={map} visible={!!showXAIToMLGW} />
          <MemphisColossusChangeLayer key={`memphis-colossus-change-${mapThemeStyleKey}`} map={map} visible={!!showMemphisColossusChange} />
          <MemphisColossusTopParcelsLayer key={`memphis-colossus-top-parcels-${mapThemeStyleKey}`} map={map} visible={!!showMemphisColossusTopParcels} />
          <ColossusPermitsLayer key={`colossus-permits-${mapThemeStyleKey}`} map={map} visible={!!showColossusPermits} />
          <ColossusPermitsReviewQueueLayer key={`colossus-permits-review-queue-${mapThemeStyleKey}`} map={map} visible={!!showColossusPermitsReviewQueue} />
          <MemphisPermitsHeatmapLayer key={`memphis-permits-heatmap-${mapThemeStyleKey}`} map={map} visible={!!showMemphisPermitsHeatmap} />
          <CouncilSignalsColossusLayer key={`council-signals-colossus-${mapThemeStyleKey}`} map={map} visible={!!showCouncilSignalsColossus} />
          <ColossusPowerSignalsLayer key={`colossus-power-signals-${mapThemeStyleKey}`} map={map} visible={!!showColossusPowerSignals} />
          <DesotoPermitsLayer key={`desoto-permits-${mapThemeStyleKey}`} map={map} visible={!!showDesotoPermits} />
          <DesotoPermitsReviewQueueLayer key={`desoto-permits-review-queue-${mapThemeStyleKey}`} map={map} visible={!!showDesotoPermitsReviewQueue} />
          <DesotoStatelineParcelLayer key={`desoto-stateline-parcel-${mapThemeStyleKey}`} map={map} visible={!!showDesotoStatelineParcel} />
        </Suspense>
      )}
      
      {/* SceneManager is rendered inside LayerToggle - single instance only (P0-1 fix) */}
      
      {showPlanningDocsLayer && (
        <Suspense fallback={null}>
          <PlanningDocsLayer map={map} visible={showPlanningDocsLayer} />
        </Suspense>
      )}
      
      {showPlanningAnalysis && (
        <Suspense fallback={null}>
          <PlanningAnalysisLayer
            map={map}
            showAdaptiveReuse={showAdaptiveReuse}
            showDevelopmentPotential={showDevelopmentPotential}
          />
        </Suspense>
      )}
      
              {/* DenverDowntownCircle component removed */}
      

      {/* Mobile: hide/disable the Tools/Layers panel entirely (avoid clutter + accidental opens). */}
      {!isMobile && (
        <LayerToggle
          key={`layer-toggle-${mapThemeStyleKey}`}
          ref={layerToggleRef}
          map={map}
          mapTheme={mapTheme}
          isLayerMenuCollapsed={isLayerMenuCollapsed}
          setIsLayerMenuCollapsed={setIsLayerMenuCollapsed}
          showTransportation={showTransportation}
          setShowTransportation={setShowTransportation}
          showRoads={showRoads}
          setShowRoads={setShowRoads}
          showMainRoads={showMainRoads}
          setShowMainRoads={setShowMainRoads}
          showParks={showParks}
          setShowParks={setShowParks}
          showFortStocktonRadius={showFortStocktonRadius}
          setShowFortStocktonRadius={setShowFortStocktonRadius}
          showAdaptiveReuse={showAdaptiveReuse}
          setShowAdaptiveReuse={setShowAdaptiveReuse}
          showDevelopmentPotential={showDevelopmentPotential}
          setShowDevelopmentPotential={setShowDevelopmentPotential}
          // Denver props removed
          showUPSFacilities={showUPSFacilities}
          setShowUPSFacilities={setShowUPSFacilities}
          showAmazonFulfillment={showAmazonFulfillment}
          setShowAmazonFulfillment={setShowAmazonFulfillment}
          show3DBuildings={show3DBuildings}
          setShow3DBuildings={setShow3DBuildings}
          
          // Well Registry Layer State
          showWellRegistry={showWellRegistry}
          setShowWellRegistry={setShowWellRegistry}
          
          showHIFLDTransmission={showHIFLDTransmission}
          setShowHIFLDTransmission={setShowHIFLDTransmission}

          // REIT Properties Layer State
          showREIT={showREIT}
          setShowREIT={setShowREIT}

          // ERCOT / Texas power layers
          showERCOTGISReports={showERCOTGISReports}
          setShowERCOTGISReports={setShowERCOTGISReports}
          showProducerConsumerCounties={showProducerConsumerCounties}
          setShowProducerConsumerCounties={setShowProducerConsumerCounties}
          showSpatialMismatchCounties={showSpatialMismatchCounties}
          setShowSpatialMismatchCounties={setShowSpatialMismatchCounties}
          showRoadParticles={showRoadParticles}
          setShowRoadParticles={setShowRoadParticles}

          // Memphis layer states
          showMemphisCounties={showMemphisCounties}
          setShowMemphisCounties={setShowMemphisCounties}
          showMemphisAIExpansion={showMemphisAIExpansion}
          setShowMemphisAIExpansion={setShowMemphisAIExpansion}
          showMLGW2026={showMLGW2026}
          setShowMLGW2026={setShowMLGW2026}
          showXAISitesPublic={showXAISitesPublic}
          setShowXAISitesPublic={setShowXAISitesPublic}
          showXAIToMLGW={showXAIToMLGW}
          setShowXAIToMLGW={setShowXAIToMLGW}
          showMemphisColossusChange={showMemphisColossusChange}
          setShowMemphisColossusChange={setShowMemphisColossusChange}
          showMemphisColossusTopParcels={showMemphisColossusTopParcels}
          setShowMemphisColossusTopParcels={setShowMemphisColossusTopParcels}
          showColossusPermits={showColossusPermits}
          setShowColossusPermits={setShowColossusPermits}
          showColossusPermitsReviewQueue={showColossusPermitsReviewQueue}
          setShowColossusPermitsReviewQueue={setShowColossusPermitsReviewQueue}
          showMemphisPermitsHeatmap={showMemphisPermitsHeatmap}
          setShowMemphisPermitsHeatmap={setShowMemphisPermitsHeatmap}
          showCouncilSignalsColossus={showCouncilSignalsColossus}
          setShowCouncilSignalsColossus={setShowCouncilSignalsColossus}
          showColossusPowerSignals={showColossusPowerSignals}
          setShowColossusPowerSignals={setShowColossusPowerSignals}
          showDesotoPermits={showDesotoPermits}
          setShowDesotoPermits={setShowDesotoPermits}
          showDesotoPermitsReviewQueue={showDesotoPermitsReviewQueue}
          setShowDesotoPermitsReviewQueue={setShowDesotoPermitsReviewQueue}
          showDesotoStatelineParcel={showDesotoStatelineParcel}
          setShowDesotoStatelineParcel={setShowDesotoStatelineParcel}

          onTransmissionLayerStateUpdate={handleTransmissionLayerStateUpdate}
        />
      )}

      {/* AI Transmission Navigator */}
      <Suspense fallback={null}>
        <AITransmissionNav
          map={map}
          layerState={layerStates}
          onLoadScene={handleLoadTransmissionScene}
          isOpen={isAITransmissionNavOpen}
          onClose={() => setIsAITransmissionNavOpen(false)}
          onToggle={() => setIsAITransmissionNavOpen(!isAITransmissionNavOpen)}
        />
      </Suspense>

        {/* P0-3: On mobile, Tools/Layers/Flow are accessible via LayerToggle and AITransmissionNav.
            Flow toggle moved into LayerToggle for unified access. This ToggleButton kept for desktop. */}
        {!isMobile && (
          <ToggleButton 
            $active={showRoadParticles}
            onClick={() => setShowRoadParticles(!showRoadParticles)}
            style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
          >
            {showRoadParticles ? 'Hide Flow' : 'Show Flow'}
          </ToggleButton>
        )}


        {/* Scanner Signals Panel - Now integrated into AITransmissionNav */}
        {/* <ScannerSignalsPanel /> */}

        {/* Card Manager */}
        <Suspense fallback={null}>
          <CardManager
            map={map}
            activeCards={activeCards}
            onCardClose={(cardId) => setActiveCards(prev => prev.filter(c => c.id !== cardId))}
            onSceneNavigate={(sceneId) => {
              if (window.mapComponent?.transmissionNav?.loadScene) {
                window.mapComponent.transmissionNav.loadScene(sceneId);
              }
            }}
          />
        </Suspense>

        {/* OSM Legend - disabled, using new LegendContainer in BaseCard instead */}
        {/* <OSMLegend /> */}

        {/* Detail Expanded Modal */}
        <Suspense fallback={null}>
          <DetailExpandedModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            nodeData={selectedNodeData}
            category={selectedCategory}
            toolData={selectedToolData}
          />
        </Suspense>

    </MapContainer>
  );
};

export default MapComponent;
