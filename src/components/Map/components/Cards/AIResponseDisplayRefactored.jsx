/**
 * AIResponseDisplayRefactored - Simplified main component with extracted table logic
 * 
 * This is the refactored version of AIResponseDisplay with separated concerns
 * and animation integration support.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import InfrastructureSummaryTable from './Tables/InfrastructureSummaryTable';
import PowerTable from './Tables/PowerTable';
import TransmissionTable from './Tables/TransmissionTable';
import UtilitiesTable from './Tables/UtilitiesTable';
import RiskTable from './Tables/RiskTable';
import TableAnimationManager from './Tables/TableAnimationManager';
import { 
  renderTruncatedView, 
  renderFullView
} from '../../../../utils/responseUtils/responseTextProcessor';
import { parseTableData, filterNodesByCategory } from '../../../../utils/tableUtils/tableDataParser';
import { buildStartupTableData } from '../../../../utils/tableUtils/domainMappers';
import { parseQuery } from '../../../../mcp/queryParser';
import { searchInfrastructure } from '../../../../services/mcpClient';
import { mapBus } from '../../../../utils/mapBus';
import { formatResponseText } from './textUtils';
import { buildLocationSearchMetadataFromCountySelection } from '../../../../utils/locationSearchMetadata';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from 'recharts';
import LocationSearchCard from './LocationSearchCard';
import TexasDataCenterCard from './TexasDataCenterCard';
import { MOBILE_CONFIG } from '../../constants';
import MarketSignal from '../marketSignal';

const TEXAS_GUARDRAIL_NOTE = 'Currently supporting Texas locations only. Try a TX address.';
const TEXAS_BOUNDS = {
  minLat: 25.8,
  maxLat: 36.6,
  minLng: -106.7,
  maxLng: -93.4
};

const isWithinTexasBounds = (lng, lat) => (
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= TEXAS_BOUNDS.minLat &&
  lat <= TEXAS_BOUNDS.maxLat &&
  lng >= TEXAS_BOUNDS.minLng &&
  lng <= TEXAS_BOUNDS.maxLng
);

const isTexasLocationMetadata = (metadata) => {
  if (!metadata) return true;
  const coords = metadata?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return isWithinTexasBounds(Number(lng), Number(lat));
    }
  }
  const text = String(metadata?.displayName || metadata?.query || '').toLowerCase();
  return /\btx\b|\btexas\b/.test(text);
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const haversineMiles = (lat1, lng1, lat2, lng2) => {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const extractSignalCoords = (signal) => {
  const raw = signal?.raw_payload || {};

  if (Array.isArray(raw?.coordinates) && raw.coordinates.length >= 2) {
    const [lng, lat] = raw.coordinates;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }

  if (raw?.geometry?.type === 'Point' && Array.isArray(raw?.geometry?.coordinates) && raw.geometry.coordinates.length >= 2) {
    const [lng, lat] = raw.geometry.coordinates;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }

  const lat =
    raw?.lat ?? raw?.latitude ?? signal?.lat ?? signal?.latitude ??
    raw?.properties?.lat ?? raw?.properties?.latitude;
  const lng =
    raw?.lng ?? raw?.lon ?? raw?.longitude ?? signal?.lng ?? signal?.lon ?? signal?.longitude ??
    raw?.properties?.lng ?? raw?.properties?.lon ?? raw?.properties?.longitude;

  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }

  return null;
};

const AIResponseDisplay = ({ 
  response, 
  citations = [], 
  maxHeight = 300,
  showTruncation = true,
  truncationLength = 200,
  onResponseExpandedChange = null,
  onSourcesExpandedChange = null,
  isLoading = false,
  onCollapseClick = null,
  showCollapseButton = false,
  selectedMarker = null,
  showMarkerDetails = false,
  onBackToAnalysis = null,
  // NEW PROPS FOR TABLE RENDERING
  renderMode = 'text',
  tableData = null,
  category = 'all',
  // ANIMATION PROPS
  nodeAnimation = null,
  onTableRowClick = null,
  onDetailToggle = null, // New prop for detail toggle callback
  // MCP response metadata
  responseMetadata = null, // Metadata to identify MCP responses
  onLocationFlyTo = null, // Callback for location search circle button: (coords) => void
  isDimmed = false // Dim when response menu (yellow +) is open
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSummaryTable, setShowSummaryTable] = useState(false); // New state to control summary visibility
  const [isAnimating, setIsAnimating] = useState(false); // Track animation state for marker click
  const [expandedQuickAction, setExpandedQuickAction] = useState(null); // Track which quick action is expanded
  const [isCardClicked, setIsCardClicked] = useState(false); // Track if card is clicked/active
  const [isCardDimmed, setIsCardDimmed] = useState(false); // Track if card should be dimmed (another marker clicked)
  const [expandedCitation, setExpandedCitation] = useState(null); // Track which citation is expanded (citation index)
  const [isLocationCardFullscreenMobile, setIsLocationCardFullscreenMobile] = useState(false);
  const [isCarouselFlipActive, setIsCarouselFlipActive] = useState(false);
  const [dailyMotion, setDailyMotion] = useState({
    updatedAt: null,
    market: { count7d: 0, top: [], lastIngestedAt: null },
    grid: { newCount: 0, updatedCount: 0, lastIngestedAt: null },
    local: null
  });
  const [dailyMotionLoading, setDailyMotionLoading] = useState(false);
  const [dailyMotionError, setDailyMotionError] = useState(null);
  const scrollContainerRef = useRef(null);
  const previousShowMarkerDetailsRef = useRef(false);
  const [relevanceDisplayedText, setRelevanceDisplayedText] = useState(''); // For typewriter effect
  const [isRelevanceTyping, setIsRelevanceTyping] = useState(false); // Track typing state
  const relevanceTypewriterTimeoutRef = useRef(null); // Track timeout for cleanup
  const [contentBufferReady, setContentBufferReady] = useState(false); // 1s skeleton buffer before showing content
  const contentBufferTimerRef = useRef(null);

  // 1 second skeleton buffer when content becomes ready (smooths appearance)
  useEffect(() => {
    if (contentBufferTimerRef.current) {
      clearTimeout(contentBufferTimerRef.current);
      contentBufferTimerRef.current = null;
    }
    if (isLoading) {
      setContentBufferReady(false);
      return;
    }
    const hasContent = response || responseMetadata;
    if (hasContent) {
      setContentBufferReady(false);
      contentBufferTimerRef.current = setTimeout(() => {
        setContentBufferReady(true);
        contentBufferTimerRef.current = null;
      }, 1000);
    } else {
      setContentBufferReady(false);
    }
    return () => {
      if (contentBufferTimerRef.current) {
        clearTimeout(contentBufferTimerRef.current);
      }
    };
  }, [isLoading, response, responseMetadata]);

  const fetchDailyMotion = useCallback(async () => {
    setDailyMotionLoading(true);
    setDailyMotionError(null);

    const parseDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    try {
      const [newsRes, ercotRes] = await Promise.all([
        fetch('/api/scanner/signals?source_type=TAVILY&limit=200'),
        fetch('/api/scanner/signals?source_type=ERCOT_QUEUE&limit=500')
      ]);

      if (!newsRes.ok) throw new Error(`NEWS signals error (${newsRes.status})`);
      if (!ercotRes.ok) throw new Error(`ERCOT signals error (${ercotRes.status})`);

      const newsData = await newsRes.json();
      const ercotData = await ercotRes.json();

      const now = Date.now();
      const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

      const newsSignals = Array.isArray(newsData?.signals) ? newsData.signals : [];
      const recentNews = newsSignals
        .filter((s) => {
          const ing = parseDate(s.ingested_at)?.getTime();
          const pub = parseDate(s.published_at)?.getTime();
          const t = Number.isFinite(pub) ? pub : ing;
          return Number.isFinite(t) && t >= cutoff7d;
        })
        .sort((a, b) => {
          const ta = parseDate(a.published_at)?.getTime() ?? parseDate(a.ingested_at)?.getTime() ?? 0;
          const tb = parseDate(b.published_at)?.getTime() ?? parseDate(b.ingested_at)?.getTime() ?? 0;
          return tb - ta;
        });

      const topNews = recentNews.slice(0, 3).map((s) => ({
        signal_id: s.signal_id,
        headline: s.headline || s.source_name || s.url || 'News item',
        url: s.url || null,
        published_at: s.published_at || s.ingested_at || null
      }));

      const lastNewsIngestedAt = newsSignals[0]?.ingested_at || null;

      const ercotSignals = Array.isArray(ercotData?.signals) ? ercotData.signals : [];
      const newCount = ercotSignals.filter((s) => s.status === 'NEW' && (s.change_type === 'NEW' || s.change_type === 'ADDED' || !s.change_type)).length;
      const updatedCount = ercotSignals.filter((s) => s.change_type && String(s.change_type).toUpperCase() === 'UPDATED').length;
      const lastErcotIngestedAt = ercotSignals[0]?.ingested_at || null;

      const isLocationContext =
        responseMetadata?.responseType === 'location_search' ||
        responseMetadata?.responseType === 'texas_data_center_detail' ||
        responseMetadata?.responseType === 'ercot_county_detail';

      const coords = Array.isArray(responseMetadata?.coordinates) ? responseMetadata.coordinates : [];
      let [searchLng, searchLat] = coords;
      if (!(Number.isFinite(Number(searchLat)) && Number.isFinite(Number(searchLng)))) {
        const featureCoords = responseMetadata?.geometry?.type === 'Point'
          ? responseMetadata?.geometry?.coordinates
          : null;
        if (Array.isArray(featureCoords) && featureCoords.length >= 2) {
          [searchLng, searchLat] = featureCoords;
        }
      }

      const searchLabel =
        responseMetadata?.displayName ||
        responseMetadata?.countyName ||
        responseMetadata?.query ||
        '';
      const radiusMiles = 30;
      const tokenStoplist = new Set(['texas', 'county', 'street', 'road', 'avenue', 'drive', 'north', 'south', 'east', 'west']);
      const locationTokens = String(searchLabel)
        .toLowerCase()
        .split(/[\s,/-]+/)
        .filter((token) => token.length >= 4 && !tokenStoplist.has(token))
        .slice(0, 8);

      const matchLocalSignal = (signal) => {
        const signalCoords = extractSignalCoords(signal);
        const canUseDistance = Number.isFinite(Number(searchLat)) && Number.isFinite(Number(searchLng)) && signalCoords;
        if (canUseDistance) {
          const distanceMi = haversineMiles(Number(searchLat), Number(searchLng), signalCoords.lat, signalCoords.lng);
          if (distanceMi <= radiusMiles) return true;
        }

        if (!locationTokens.length) return false;
        const haystack = [
          signal?.headline,
          signal?.raw_text,
          signal?.source_name,
          signal?.url,
          JSON.stringify(signal?.raw_payload || {})
        ].join(' ').toLowerCase();
        return locationTokens.some((token) => haystack.includes(token));
      };

      const localRecentNews = isLocationContext ? recentNews.filter(matchLocalSignal) : [];
      const localErcotSignals = isLocationContext ? ercotSignals.filter(matchLocalSignal) : [];
      const localNewCount = localErcotSignals.filter((s) => s.status === 'NEW' && (s.change_type === 'NEW' || s.change_type === 'ADDED' || !s.change_type)).length;
      const localUpdatedCount = localErcotSignals.filter((s) => s.change_type && String(s.change_type).toUpperCase() === 'UPDATED').length;

      setDailyMotion({
        updatedAt: new Date().toISOString(),
        market: {
          count7d: recentNews.length,
          top: topNews,
          lastIngestedAt: lastNewsIngestedAt
        },
        grid: {
          newCount,
          updatedCount,
          lastIngestedAt: lastErcotIngestedAt
        },
        local: isLocationContext ? {
          marketCount7d: localRecentNews.length,
          gridNewCount: localNewCount,
          gridUpdatedCount: localUpdatedCount,
          topLocalMarketItems: localRecentNews.slice(0, 3).map((s) => ({
            signal_id: s.signal_id,
            headline: s.headline || s.source_name || s.url || 'News item',
            url: s.url || null
          }))
        } : null
      });
    } catch (error) {
      console.error('[DailyMotion] fetch failed', error);
      setDailyMotionError(error.message || 'Failed to load daily motion');
    } finally {
      setDailyMotionLoading(false);
    }
  }, [responseMetadata]);

  const handleRefreshMarket = useCallback(async () => {
    try {
      await fetch('/api/scanner/ingest/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '"data center" (moratorium OR lawsuit OR zoning) Texas',
          days: 7
        })
      });
    } finally {
      await fetchDailyMotion();
    }
  }, [fetchDailyMotion]);

  const handleRefreshGrid = useCallback(async () => {
    try {
      await fetch('/api/scanner/ingest/ercot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useGisReports: true, downloadFresh: true })
      });
    } finally {
      await fetchDailyMotion();
    }
  }, [fetchDailyMotion]);

  const shouldRenderMarketSignal = (() => {
    const isTexasDataCenterResponse = responseMetadata?.responseType === 'texas_data_center_detail';
    const isLegacyCountyDetailResponse = responseMetadata?.responseType === 'ercot_county_detail';
    const isLocationSearchResponse =
      responseMetadata?.responseType === 'location_search' || isLegacyCountyDetailResponse;
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= MOBILE_CONFIG.breakpoint;
    const showLocationCardForTexasMobile = isTexasDataCenterResponse && isMobileViewport;
    return isLocationSearchResponse || showLocationCardForTexasMobile;
  })();

  useEffect(() => {
    if (!shouldRenderMarketSignal) return;
    fetchDailyMotion();
  }, [fetchDailyMotion, shouldRenderMarketSignal]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return undefined;

    const off = window.mapEventBus.on('location-search:mobile-fullscreen', (payload = {}) => {
      const shouldExpand = payload?.expanded !== false;
      const isMobile = window.innerWidth <= MOBILE_CONFIG.breakpoint;
      if (!isMobile) return;
      setIsLocationCardFullscreenMobile(Boolean(shouldExpand));
      if (shouldExpand) {
        setIsExpanded(true);
      }
    });

    return () => {
      if (off) off();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return undefined;
    const off = window.mapEventBus.on('location-search:carousel-flip-state', (payload = {}) => {
      const isMobile = window.innerWidth <= MOBILE_CONFIG.breakpoint;
      if (!isMobile) {
        setIsCarouselFlipActive(false);
        return;
      }
      setIsCarouselFlipActive(Boolean(payload?.flipped));
    });
    return () => {
      if (off) off();
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const isMobile = window.innerWidth <= MOBILE_CONFIG.breakpoint;
    const isLocationType =
      responseMetadata?.responseType === 'location_search' ||
      (responseMetadata?.responseType === 'texas_data_center_detail' && isMobile);
    if (!(isMobile && isLocationCardFullscreenMobile && isLocationType)) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLocationCardFullscreenMobile, responseMetadata]);

  // Detect if this is a Power/Energy response vs Water response
  const isPowerResponse = useCallback(() => {
    if (!responseMetadata) return false;
    
    const query = responseMetadata.query || response?.query || '';
    const queryLower = query.toLowerCase();
    
    // Check for power/energy keywords
    const isPowerQuery = queryLower.includes('power') ||
                        queryLower.includes('substation') ||
                        queryLower.includes('transmission') ||
                        queryLower.includes('tower') ||
                        queryLower.includes('transformer') ||
                        queryLower.includes('electrical') ||
                        queryLower.includes('energy');
    
    // Check category in metadata if available
    const category = responseMetadata.category || '';
    const isPowerCategory = category === 'power' || category === 'transmission';
    
    return isPowerQuery || isPowerCategory;
  }, [responseMetadata, response]);

  // Helper function to process features into chart data (distance distribution)
  const processFeaturesForChart = useCallback((features) => {
    if (!features || features.length === 0) return [];

    // Define distance bins (in km)
    const bins = [
      { range: '0-1', min: 0, max: 1, count: 0 },
      { range: '1-2', min: 1, max: 2, count: 0 },
      { range: '2-5', min: 2, max: 5, count: 0 },
      { range: '5-10', min: 5, max: 10, count: 0 },
      { range: '10+', min: 10, max: Infinity, count: 0 }
    ];

    // Count features in each bin
    features.forEach((feature) => {
      const props = feature.properties || {};
      const distanceKm = props.distance_m ? props.distance_m / 1000 : null;
      
      if (distanceKm !== null) {
        for (let i = 0; i < bins.length; i++) {
          if (distanceKm >= bins[i].min && distanceKm < bins[i].max) {
            bins[i].count++;
            break;
          }
        }
      }
    });

    return bins.map(bin => ({
      range: bin.range,
      count: bin.count,
      label: bin.range === '10+' ? '10+ km' : `${bin.range} km`
    }));
  }, []);

  // Render MCP response with clickable feature names
  const renderMCPResponseWithClickableFeatures = useCallback((responseText, features, isExpanded, onExpansionChange, truncationLength) => {
    if (!responseText || typeof responseText !== 'string') return null;

    // Determine if this is a power response for color scheme
    const isPower = isPowerResponse();
    const accentColor = isPower ? '#c084fc' : '#22d3ee'; // Purple for power, cyan for water
    const accentColorHover = isPower ? '#a78bfa' : '#06b6d4'; // Darker purple/cyan for hover
    const accentColorRgba = isPower ? 'rgba(192, 132, 252, 0.5)' : 'rgba(34, 211, 238, 0.5)';
    const accentColorRgbaHover = isPower ? 'rgba(167, 139, 250, 0.8)' : 'rgba(6, 182, 212, 0.8)';

    // Handle truncation
    const displayText = isExpanded ? responseText : (responseText.length > truncationLength ? responseText.substring(0, truncationLength) + '...' : responseText);
    
    // Split by lines to find feature list
    const lines = displayText.split('\n');
    const renderedLines = [];

    lines.forEach((line, lineIndex) => {
      // Check if this line is a feature entry (e.g., "1. **Name** - category (distance)")
      const featureMatch = line.match(/^(\d+)\.\s*\*\*(.*?)\*\*\s*-\s*(.+?)\s*\((.+?)\)/);
      
      if (featureMatch && features.length > 0) {
        const featureIndex = parseInt(featureMatch[1], 10) - 1; // Convert to 0-based index
        const featureName = featureMatch[2];
        const category = featureMatch[3];
        const distance = featureMatch[4];
        
        // Filter out "Unnamed" features
        if (featureName === 'Unnamed' || featureName.trim() === '') {
          return; // Skip this line
        }
        
        const feature = features[featureIndex];

        if (feature && feature.geometry) {
          // Extract coordinates based on geometry type (same logic as MCPSearchResults)
          let coordinates = null;
          if (feature.geometry.type === 'Point') {
            coordinates = feature.geometry.coordinates;
          } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            // For polygons, we'll need to calculate centroid, but for now use first coordinate
            // The MCPSearchResults will handle this properly when zooming
            try {
              // Try to use turf to get centroid if available
              if (window.turf && window.turf.centroid) {
                const centroid = window.turf.centroid(feature);
                coordinates = centroid.geometry.coordinates;
              } else {
                // Fallback: use first coordinate of first ring
                const coords = feature.geometry.coordinates[0];
                coordinates = (coords && coords[0]) || null;
              }
            } catch (err) {
              const coords = feature.geometry.coordinates[0];
              coordinates = (coords && coords[0]) || null;
            }
          } else if (feature.geometry.type === 'LineString') {
            // Use first coordinate
            coordinates = feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'MultiLineString') {
            // Use first coordinate of first line
            const coords = feature.geometry.coordinates[0];
            coordinates = (coords && coords[0]) || null;
          }

          if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
            // This is a clickable feature line
            renderedLines.push(
              <div key={`feature-${lineIndex}`} style={{ marginBottom: '4px' }}>
                <span>{featureMatch[1]}. </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    // Emit event to zoom to this marker
                    if (window.mapEventBus) {
                      window.mapEventBus.emit('mcp:zoomToFeature', {
                        featureIndex: featureIndex,
                        coordinates: coordinates,
                        feature: feature
                      });
                    }
                  }}
                  style={{
                    fontWeight: '800',
                    color: accentColor, // Dynamic color based on response type
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: accentColorRgba,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = accentColorHover;
                    e.target.style.textDecorationColor = accentColorRgbaHover;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = accentColor;
                    e.target.style.textDecorationColor = accentColorRgba;
                  }}
                >
                  {featureName}
                </span>
                <span> - {category} ({distance})</span>
              </div>
            );
          } else {
            // Coordinates invalid, render as regular text
            renderedLines.push(
              <div key={`line-${lineIndex}`} style={{ marginBottom: '4px' }}>
                {formatResponseText(line)}
              </div>
            );
          }
        } else {
          // Feature not found, render as regular text
          renderedLines.push(
            <div key={`line-${lineIndex}`} style={{ marginBottom: '4px' }}>
              {formatResponseText(line)}
            </div>
          );
        }
      } else {
        // Regular line, format normally
        renderedLines.push(
          <div key={`line-${lineIndex}`} style={{ marginBottom: '4px' }}>
            {formatResponseText(line)}
          </div>
        );
      }
    });

    // Add clickable dots if truncated
    if (!isExpanded && responseText.length > truncationLength) {
      renderedLines.push(
        <span
          key="clickable-dots"
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            fontWeight: '600',
            marginLeft: '2px',
            transition: 'color 0.2s ease'
          }}
          onClick={() => onExpansionChange(true)}
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
    }

    return <>{renderedLines}</>;
  }, [isPowerResponse]);


  // Format Perplexity answer with water blue or purple emphasis on key terms
  const formatPerplexityAnswer = useCallback((text, citations = [], isPower = false) => {
    if (!text || typeof text !== 'string') return text;
    
    // Get citations from metadata if available
    const perplexityCitations = responseMetadata?.perplexityCitations || citations || [];
    
    // Determine if this is a power response
    const isPowerAnswer = isPower || isPowerResponse();
    
    // Color scheme: purple for power, water blue for water
    const accentColor = isPowerAnswer ? '#c084fc' : '#22d3ee'; // Purple for power, cyan for water
    
    // Key water-related terms to highlight in water blue (ordered by length to match longer terms first)
    const waterTerms = [
      'agricultural water rights',
      'Central Arizona Project',
      'State Trust land',
      'water allocation',
      'water rights',
      'water supply',
      'water sources',
      'water resources',
      'water needs',
      'water gap',
      'water transfers',
      'water infrastructure',
      'canal system',
      'Colorado River',
      'Fabs 2 and 3',
      'TSMC',
      'CAP',
      'Fab 1',
      'Phoenix'
    ];
    
    // Key power/energy-related terms to highlight in purple
    const powerTerms = [
      'substation',
      'transmission line',
      'transmission tower',
      'power line',
      'power transmission',
      'electrical infrastructure',
      'transformer',
      'power grid',
      'electrical grid',
      'voltage',
      'kilovolt',
      'kV',
      'megawatt',
      'MW',
      'power plant',
      'generation',
      'TSMC',
      'Phoenix'
    ];
    
    // First, split by markdown bold (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      // Handle markdown bold
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2); // Remove **
        // Check if this bold term should be highlighted
        const isWaterTerm = !isPowerAnswer && waterTerms.some(term => 
          boldText.toLowerCase().includes(term.toLowerCase())
        );
        const isPowerTerm = isPowerAnswer && powerTerms.some(term => 
          boldText.toLowerCase().includes(term.toLowerCase())
        );
        
        return (
          <span
            key={`bold-${index}`}
            style={{
              fontWeight: '800', // Extra bold
              color: (isWaterTerm || isPowerTerm) ? accentColor : 'rgba(255, 255, 255, 0.95)', // Accent color for terms, white for others
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
            }}
          >
            {boldText}
          </span>
        );
      }
      
      // Handle regular text - check for water or power terms and highlight them
      if (!part || part.trim() === '') return null;
      
      // Build segments by finding terms AND numbers
      const segments = [];
      let lastIndex = 0;
      
      // Find all terms in this segment (sort by position)
      const matches = [];
      const termsToSearch = isPowerAnswer ? powerTerms : waterTerms;
      termsToSearch.forEach(term => {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        let match;
        while ((match = regex.exec(part)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            term: term,
            isTerm: true
          });
        }
      });
      
      // Find all numbers (including decimals, with units like "million", "M", "%", etc.)
      // Pattern: numbers like "4.75", "7-13", "4.7M", "7-13M gal/day", "4.75 million", "20%", etc.
      const numberPatterns = [
        /\d+\.\d+\s*(million|billion|thousand|M|B|K|gal\/day|gal\/d|mgd|afy|%)/gi, // "4.75 million", "4.7M gal/day", "4.75%"
        /\d+-\d+\s*(million|billion|thousand|M|B|K|gal\/day|gal\/d|mgd|afy|%)/gi, // "7-13M gal/day", "7-13%"
        /\d+%/g, // "20%", "50%"
        /\d+\.\d+%/g, // "4.75%", "7.5%"
        /\d+\.\d+/g, // "4.75", "7.5"
        /\d+-\d+/g, // "7-13"
        /\d+/g // Any standalone number
      ];
      
      // Find numbers using each pattern
      for (let patternIdx = 0; patternIdx < numberPatterns.length; patternIdx++) {
        const pattern = numberPatterns[patternIdx];
        const patternMatches = [];
        let match;
        while ((match = pattern.exec(part)) !== null) {
          patternMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
          });
        }
        
        // Add non-overlapping number matches
        for (let pmIdx = 0; pmIdx < patternMatches.length; pmIdx++) {
          const numMatch = patternMatches[pmIdx];
          // Check if this number is already captured by a longer pattern or water term
          const isOverlapping = matches.some(m => 
            (numMatch.start >= m.start && numMatch.start < m.end) ||
            (numMatch.end > m.start && numMatch.end <= m.end)
          );
          if (!isOverlapping) {
            matches.push({
              start: numMatch.start,
              end: numMatch.end,
              text: numMatch.text,
              isNumber: true
            });
          }
        }
      }
      
      // Sort matches by start position
      matches.sort((a, b) => a.start - b.start);
      
      // Remove overlapping matches (keep first/longest)
      const filteredMatches = [];
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const overlaps = filteredMatches.some(fm => 
          (match.start >= fm.start && match.start < fm.end) ||
          (match.end > fm.start && match.end <= fm.end)
        );
        if (!overlaps) {
          filteredMatches.push(match);
        }
      }
      
      // Build segments from matches
      filteredMatches.forEach(match => {
        // Add text before match
        if (match.start > lastIndex) {
          segments.push({
            text: part.substring(lastIndex, match.start),
            isWaterTerm: false,
            isNumber: false
          });
        }
        // Add matched term (water/power term or number)
        segments.push({
          text: match.text,
          isTerm: match.isTerm || false,
          isNumber: match.isNumber || false
        });
        lastIndex = match.end;
      });
      
      // Add remaining text
      if (lastIndex < part.length) {
        segments.push({
          text: part.substring(lastIndex),
          isTerm: false,
          isNumber: false
        });
      }
      
      // If no water terms found, return the whole segment as regular text (thin font)
      if (segments.length === 0) {
        // Still check for citations
        if (/\[\d+\]/.test(part)) {
          return part.split(/(\[\d+\])/g).map((subPart, subIdx) => {
            if (/\[\d+\]/.test(subPart)) {
              const citationNum = parseInt(subPart.match(/\d+/)?.[0] || '0');
              const citationIndex = citationNum - 1; // Convert [1] to index 0
              const citationUrl = perplexityCitations[citationIndex];
              const isExpanded = expandedCitation === citationIndex;
              
              return (
                <span key={`text-${index}-${subIdx}`} style={{ position: 'relative', display: 'inline-block' }}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCitation(isExpanded ? null : citationIndex);
                    }}
                    style={{
                      color: '#22d3ee', // Water blue for citations
                      fontWeight: '800', // Bold
                      fontSize: '13px',
                      verticalAlign: 'baseline',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textDecorationColor: '#22d3ee',
                      textUnderlineOffset: '2px'
                    }}
                    title={citationUrl || 'Citation'}
                  >
                    {subPart}
                  </span>
                  {isExpanded && citationUrl && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '0',
                        marginBottom: '8px',
                        padding: '12px',
                        background: 'rgba(30, 41, 59, 0.98)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        zIndex: 10000,
                        minWidth: '250px',
                        maxWidth: '400px',
                        fontSize: '12px',
                        lineHeight: '1.5'
                      }}
                    >
                      <div style={{
                        color: '#22d3ee',
                        fontWeight: '600',
                        marginBottom: '8px',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Source {citationNum}
                      </div>
                      <a
                        href={citationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#22d3ee',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          display: 'block',
                          padding: '8px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          borderRadius: '4px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
                      >
                        {citationUrl}
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCitation(null);
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          background: 'transparent',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '4px',
                          color: '#22d3ee',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </span>
              );
            }
            return (
              <span
                key={`text-${index}-${subIdx}`}
                style={{
                  fontWeight: '200', // Thinner font
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
              >
                {subPart}
              </span>
            );
          });
        }
        return (
          <span
            key={`text-${index}`}
            style={{
              fontWeight: '200', // Thinner font
              color: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            {part}
          </span>
        );
      }
      
      // Render segments
      return (
        <React.Fragment key={`fragment-${index}`}>
          {segments.map((segment, segIdx) => {
            // Check if segment contains citation numbers like [1], [2]
            if (/\[\d+\]/.test(segment.text)) {
              return segment.text.split(/(\[\d+\])/g).map((subSegment, subIdx) => {
                if (/\[\d+\]/.test(subSegment)) {
                  const citationNum = parseInt(subSegment.match(/\d+/)?.[0] || '0');
                  const citationIndex = citationNum - 1; // Convert [1] to index 0
                  const citationUrl = perplexityCitations[citationIndex];
                  const isExpanded = expandedCitation === citationIndex;
                  
                  return (
                    <span key={`segment-${index}-${segIdx}-${subIdx}`} style={{ position: 'relative', display: 'inline-block' }}>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCitation(isExpanded ? null : citationIndex);
                        }}
                        style={{
                          color: '#22d3ee', // Water blue for citations
                          fontWeight: '800', // Bold
                          fontSize: '13px',
                          verticalAlign: 'baseline',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textDecorationColor: '#22d3ee',
                          textUnderlineOffset: '2px'
                        }}
                        title={citationUrl || 'Citation'}
                      >
                        {subSegment}
                      </span>
                      {isExpanded && citationUrl && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '0',
                            marginBottom: '8px',
                            padding: '12px',
                            background: 'rgba(30, 41, 59, 0.98)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: '8px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            zIndex: 10000,
                            minWidth: '250px',
                            maxWidth: '400px',
                            fontSize: '12px',
                            lineHeight: '1.5'
                          }}
                        >
                          <div style={{
                            color: '#22d3ee',
                            fontWeight: '600',
                            marginBottom: '8px',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Source {citationNum}
                          </div>
                          <a
                            href={citationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#22d3ee',
                              textDecoration: 'none',
                              wordBreak: 'break-all',
                              display: 'block',
                              padding: '8px',
                              background: 'rgba(6, 182, 212, 0.1)',
                              borderRadius: '4px',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.2)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
                          >
                            {citationUrl}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCitation(null);
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '4px 8px',
                              background: 'transparent',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              borderRadius: '4px',
                              color: '#22d3ee',
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </span>
                  );
                }
                return (
                  <span
                    key={`segment-${index}-${segIdx}-${subIdx}`}
                    style={{
                      fontWeight: segment.isTerm ? '800' : (segment.isNumber ? '800' : '200'), // Extra bold for terms and numbers, thinner for regular text
                      color: (segment.isTerm || segment.isNumber) ? accentColor : 'rgba(255, 255, 255, 0.9)' // Accent color for terms and numbers
                    }}
                  >
                    {subSegment}
                  </span>
                );
              });
            }
            
            return (
              <span
                key={`segment-${index}-${segIdx}`}
                style={{
                  fontWeight: segment.isTerm ? '800' : (segment.isNumber ? '800' : '200'), // Extra bold for terms and numbers, thinner for regular
                  color: (segment.isTerm || segment.isNumber) ? accentColor : 'rgba(255, 255, 255, 0.9)', // Accent color for terms and numbers, regular for text
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                }}
              >
                {segment.text}
              </span>
            );
          })}
        </React.Fragment>
      );
    }).filter(Boolean);
  }, [expandedCitation, responseMetadata?.perplexityCitations, isPowerResponse]);

  // Handle response expansion state change
  const handleExpansionChange = (expanded) => {
    setIsExpanded(expanded);
    if (onResponseExpandedChange) {
      onResponseExpandedChange(expanded);
    }
  };

  // Handle table row click with animation
  const handleTableRowClick = useCallback((node) => {
    if (onTableRowClick) {
      onTableRowClick(node);
    }
  }, [onTableRowClick]);

  // Handle detail toggle
  const handleDetailToggle = useCallback((nodeId, isExpanded, nodeData) => {
    if (onDetailToggle) {
      onDetailToggle(nodeId, isExpanded, nodeData);
    }
  }, [onDetailToggle]);

  // Handle summary table toggle
  const handleSummaryToggle = useCallback(() => {
    setShowSummaryTable(prev => !prev);
  }, []);

  // Handle quick action click for MCP searches
  const handleQuickActionClick = useCallback(async (actionQuery, actionIndex) => {
    // Log click event for "Power plants within 20km" specifically
    const isPowerPlantsQuery = actionQuery.toLowerCase().includes('power plants within 20km');
    if (isPowerPlantsQuery) {
      console.log('🔍 [Power Plants 20km] Click event triggered:', {
        actionQuery,
        actionIndex,
        expandedQuickAction,
        timestamp: new Date().toISOString()
      });
    }
    
    if (expandedQuickAction === actionIndex) {
      // Toggle closed
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Toggling closed');
      }
      setExpandedQuickAction(null);
      return;
    }

    // Toggle open
    if (isPowerPlantsQuery) {
      console.log('🔍 [Power Plants 20km] Toggling open, starting search');
    }
    setExpandedQuickAction(actionIndex);

    try {
      // Parse the query
      const parsed = parseQuery(actionQuery);
      
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Query parsed:', parsed);
      }
      
      if (parsed.error || !parsed.facilityKey) {
        console.error('❌ Quick action error:', parsed.error || 'Could not identify facility');
        if (isPowerPlantsQuery) {
          console.error('🔍 [Power Plants 20km] Parse error:', parsed.error);
        }
        return;
      }

      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Calling MCP search service with:', {
          facilityName: parsed.facilityName,
          facilityKey: parsed.facilityKey,
          radius: parsed.radius,
          category: parsed.category
        });
      }

      // Call MCP service
      const data = await searchInfrastructure({
        facilityName: parsed.facilityName,
        facilityKey: parsed.facilityKey,
        radius: parsed.radius,
        category: parsed.category
      });
      
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] MCP search completed:', {
          featuresCount: data?.features?.length || 0,
          timestamp: new Date().toISOString()
        });
      }
      
      // Emit search results to MCPSearchResults component
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Emitting mcp:searchResults event');
      }
      mapBus.emit('mcp:searchResults', {
          results: data,
        parsed
      });
      
      if (isPowerPlantsQuery) {
        console.log('🔍 [Power Plants 20km] Event emitted, checking OSM state:', {
          pinalSiteMarkers: typeof window !== 'undefined' && window.pinalSiteMarkers ? Object.keys(window.pinalSiteMarkers).length : 0,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Quick action search error:', error);
      if (isPowerPlantsQuery) {
        console.error('🔍 [Power Plants 20km] Search error:', error);
      }
    }
  }, [expandedQuickAction]);

  // Auto-scroll to highlighted row
  const scrollToHighlightedRow = useCallback((nodeId) => {
    if (!nodeId || !scrollContainerRef.current) return;
    
    // Find the table row element by data attribute or ID
    let rowElement = scrollContainerRef.current.querySelector(`[data-node-id="${nodeId}"]`);
    
    // Fallback: try to find by text content if data attribute doesn't work
    if (!rowElement) {
      const allRows = scrollContainerRef.current.querySelectorAll('tr');
      rowElement = Array.from(allRows).find(row => {
        const textContent = row.textContent || '';
        return textContent.includes(nodeId) || textContent.includes(nodeId.split('-')[0]);
      });
    }
    
    if (rowElement) {
      console.log('🎯 Found row element, scrolling to it:', nodeId);
      
      // Calculate the position to scroll to (center the row in the viewport)
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const scrollTop = scrollContainerRef.current.scrollTop;
      
      // Calculate the target scroll position to center the row
      const targetScrollTop = scrollTop + rowRect.top - containerRect.top - (containerRect.height / 2) + (rowRect.height / 2);
      
      // Smooth scroll to the target position
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      console.warn('🎯 Could not find row element for nodeId:', nodeId);
    }
  }, []);

  // Handle scroll detection
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    const isScrolledNow = scrollTop > 5; // Lowered threshold from 10px to 5px
    setIsScrolled(isScrolledNow); // Trigger when scrolled more than 5px
  }, []);

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll, renderMode, category]);


  // Emit scroll state to CategoryToggle
  useEffect(() => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('response:scrolled', { isScrolled });
    }
  }, [isScrolled, renderMode]);

  // Listen for marker clicks to auto-scroll to highlighted row
  // Only handle MCP markers - OSM markers use their own popup system
  useEffect(() => {
    if (!window.mapEventBus || renderMode !== 'table') return;

    const handleMarkerClicked = (markerData) => {
      // Skip OSM markers - they use their own popup system and shouldn't trigger scrolling
      const isOSMMarker = markerData.formatter === 'pinal' || 
                         markerData.formatter === 'tsmc-phoenix' ||
                         markerData.formatter === 'whitney' ||
                         (markerData.source !== 'mcp' && !markerData.source);
      
      // Only scroll for MCP markers
      if (!isOSMMarker && markerData.source === 'mcp') {
      // Add a small delay to allow the table to update first
      setTimeout(() => {
        scrollToHighlightedRow(markerData.id);
      }, 100);
      }
    };

    const unsubscribe = window.mapEventBus.on('marker:clicked', handleMarkerClicked);
    
    return () => {
      unsubscribe();
    };
  }, [renderMode, scrollToHighlightedRow]);

  // Inject CSS animations for marker details pulse and halo
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const styleId = 'mcp-marker-details-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes mcpMarkerDetailsPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(139, 92, 246, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
          }
        }
        
        @keyframes waterMarkerDetailsPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(6, 182, 212, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0);
          }
        }
        
        @keyframes mcpMarkerDetailsHalo {
          0% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
        }
        
        @keyframes waterMarkerDetailsHalo {
          0% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .mcp-marker-details-animating {
          animation: mcpMarkerDetailsPulse 3s ease-in-out;
        }
        
        .water-marker-details-animating {
          animation: waterMarkerDetailsPulse 3s ease-in-out;
        }
        
        .mcp-marker-details-halo {
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(192, 132, 252, 0.2));
          pointer-events: none;
          z-index: -1;
          animation: mcpMarkerDetailsHalo 3s ease-in-out;
        }
        
        .water-marker-details-halo {
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(34, 211, 238, 0.2));
          pointer-events: none;
          z-index: -1;
          animation: waterMarkerDetailsHalo 3s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Listen for marker clicks to dim this card if another marker is clicked
  useEffect(() => {
    if (!showMarkerDetails || !selectedMarker) {
      setIsCardDimmed(false);
      return;
    }

    const handleMarkerClick = (clickedMarkerData) => {
      // Check if the clicked marker is different from the currently selected marker
      const clickedMarkerId = clickedMarkerData.id || clickedMarkerData.name || clickedMarkerData.coordinates?.join(',');
      const currentMarkerId = selectedMarker.id || selectedMarker.name || selectedMarker.coordinates?.join(',');
      
      // If different marker clicked, dim this card; if same marker, keep it bright
      if (clickedMarkerId !== currentMarkerId) {
        setIsCardDimmed(true);
      } else {
        setIsCardDimmed(false);
      }
    };

    // Listen for marker clicks
    mapBus.on('marker:clicked', handleMarkerClick);
    mapBus.on('marker:selected', handleMarkerClick);

    return () => {
      mapBus.off('marker:clicked', handleMarkerClick);
      mapBus.off('marker:selected', handleMarkerClick);
    };
  }, [showMarkerDetails, selectedMarker]);

  // Trigger animation when marker details are shown (especially for MCP markers)
  useEffect(() => {
    // Check if we just transitioned from not showing to showing marker details
    if (showMarkerDetails && !previousShowMarkerDetailsRef.current && selectedMarker) {
      const isMCPMarker = selectedMarker.source === 'mcp';
      if (isMCPMarker) {
        // Trigger animation
        setIsAnimating(true);
        // Animation lasts 3 seconds
        setTimeout(() => {
          setIsAnimating(false);
        }, 3000);
      }
      // Reset card clicked state when new marker is selected
      setIsCardClicked(false);
      // Reset dimmed state when new marker is selected
      setIsCardDimmed(false);
    }
    // Update ref for next comparison
    previousShowMarkerDetailsRef.current = showMarkerDetails;
  }, [showMarkerDetails, selectedMarker]);

  // Typewriter effect for "Why This Matters" section
  useEffect(() => {
    // Clean up any existing timeout
    if (relevanceTypewriterTimeoutRef.current) {
      clearTimeout(relevanceTypewriterTimeoutRef.current);
      relevanceTypewriterTimeoutRef.current = null;
    }

    // Only start typewriter if marker details are shown
    if (!showMarkerDetails || !selectedMarker) {
      setRelevanceDisplayedText('');
      setIsRelevanceTyping(false);
      return;
    }

    // Generate relevance text (same logic as in renderMarkerDetails)
    const props = selectedMarker.properties || selectedMarker;
    const category = props.category || selectedMarker.category || 'infrastructure';
    const markerColor = selectedMarker.color || props.color;
    const isMCPMarker = selectedMarker.source === 'mcp';
    const isWaterMarker = isMCPMarker && (
      markerColor === '#06b6d4' ||
      category === 'water' ||
      category === 'water_allocation' ||
      category === 'agricultural_water' ||
      category === 'state_trust_land' ||
      props.waterway ||
      props.man_made === 'water_tower' ||
      props.man_made === 'water_works' ||
      props.man_made === 'reservoir_covered'
    );
    
    let relevanceText = null;
    let name = props.name || selectedMarker.name || selectedMarker.title || '';
    if (!name || name === 'Unnamed' || name.trim() === '') {
      if (props.operator && props.operator.trim() !== '') {
        name = props.operator;
      } else if (props.ref && props.ref.trim() !== '') {
        name = `Ref: ${props.ref}`;
      } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
        name = props['operator:ref'];
      } else {
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} Infrastructure`;
      }
    }

    // Generate relevance text (simplified version of the logic in renderMarkerDetails)
    if (props.relevance || props.importance || props.why_matters) {
      relevanceText = props.relevance || props.importance || props.why_matters;
    } else if (responseMetadata?.perplexityAnswer && name) {
      const markerNameLower = name.toLowerCase();
      const sentences = responseMetadata.perplexityAnswer.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const relevantSentences = sentences.filter(sentence => {
        const sentenceLower = sentence.toLowerCase();
        return sentenceLower.includes(markerNameLower) || 
               sentenceLower.includes(category.toLowerCase()) ||
               (isWaterMarker && (sentenceLower.includes('water') || sentenceLower.includes('supply'))) ||
               (!isWaterMarker && (sentenceLower.includes('power') || sentenceLower.includes('electrical')));
      });
      
      if (relevantSentences.length > 0) {
        relevanceText = relevantSentences[0].trim().replace(/\*\*/g, '').trim();
        if (relevanceText.length > 200) {
          relevanceText = relevanceText.substring(0, 197) + '...';
        }
      } else {
        const query = responseMetadata?.query || '';
        const queryLower = query.toLowerCase();
        
        if (isWaterMarker) {
          if (queryLower.includes('fab') || queryLower.includes('tsmc')) {
            relevanceText = `This water infrastructure facility is critical for supporting TSMC's manufacturing operations. It provides essential water supply capacity needed for semiconductor production processes.`;
          } else if (queryLower.includes('water')) {
            relevanceText = `This facility is part of the water infrastructure network that addresses regional water supply needs and allocation requirements.`;
          } else {
            relevanceText = `This water infrastructure facility plays a key role in the regional water supply system, providing essential capacity for industrial and municipal needs.`;
          }
        } else if (isMCPMarker) {
          if (queryLower.includes('power') || queryLower.includes('electrical')) {
            relevanceText = `This power infrastructure facility is essential for maintaining reliable electrical service and supporting industrial operations in the region.`;
          } else if (queryLower.includes('transmission')) {
            relevanceText = `This transmission infrastructure component is critical for distributing power across the regional electrical grid.`;
          } else {
            relevanceText = `This infrastructure facility is strategically located to support regional development and industrial operations.`;
          }
        } else {
          relevanceText = `This facility is an important component of the regional infrastructure network.`;
        }
      }
    } else {
      if (isWaterMarker) {
        relevanceText = `This water infrastructure facility provides essential water supply capacity for regional industrial and municipal needs.`;
      } else if (isMCPMarker) {
        relevanceText = `This infrastructure facility is strategically positioned to support regional development and operational requirements.`;
      } else {
        relevanceText = `This facility is an important component of the regional infrastructure network.`;
      }
    }

    // Start typewriter animation if we have text
    if (relevanceText) {
      setIsRelevanceTyping(true);
      setRelevanceDisplayedText('');
      
      let currentIndex = 0;
      const typingSpeed = 15; // milliseconds per character (faster than the popup typewriter)
      
      const typeNextChar = () => {
        if (currentIndex < relevanceText.length) {
          setRelevanceDisplayedText(relevanceText.slice(0, currentIndex + 1));
          currentIndex++;
          relevanceTypewriterTimeoutRef.current = setTimeout(typeNextChar, typingSpeed);
        } else {
          setIsRelevanceTyping(false);
          relevanceTypewriterTimeoutRef.current = null;
        }
      };
      
      // Small delay before starting to type
      relevanceTypewriterTimeoutRef.current = setTimeout(typeNextChar, 300);
    } else {
      setRelevanceDisplayedText('');
      setIsRelevanceTyping(false);
    }

    // Cleanup on unmount or when marker changes
    return () => {
      if (relevanceTypewriterTimeoutRef.current) {
        clearTimeout(relevanceTypewriterTimeoutRef.current);
        relevanceTypewriterTimeoutRef.current = null;
      }
    };
  }, [showMarkerDetails, selectedMarker, responseMetadata]);

  // Render marker details view (for MCP markers and others)
  // Define this BEFORE it's used in the early return check
  const renderMarkerDetails = useCallback(() => {
    if (!selectedMarker) {
      return null;
    }

    // Check if this is an MCP marker
    const isMCPMarker = selectedMarker.source === 'mcp';
    
    // Get properties from marker data (could be in properties object or directly on marker)
    const props = selectedMarker.properties || selectedMarker;
    
    // Check if this is a water marker (for color scheme)
    const category = props.category || selectedMarker.category || 'infrastructure';
    // Check marker color first, then category and properties
    const markerColor = selectedMarker.color || props.color;
    const isWaterMarker = isMCPMarker && (
      markerColor === '#06b6d4' || // Check color first
      category === 'water' ||
      category === 'water_allocation' ||
      category === 'agricultural_water' ||
      category === 'state_trust_land' ||
      props.waterway ||
      props.man_made === 'water_tower' ||
      props.man_made === 'water_works' ||
      props.man_made === 'reservoir_covered'
    );
    
    // Color scheme: water uses cyan/teal, other MCP markers use purple
    const primaryColorBright = isWaterMarker ? '#22d3ee' : (isMCPMarker ? '#c084fc' : '#ffffff');
    // Background: use darker water color when clicked, otherwise default dark
    // Check water marker first since water markers are also MCP markers
    let bgGradient = 'rgba(30, 41, 59, 0.95)'; // Default dark
    let headerBgGradient = 'rgba(255, 255, 255, 0.03)'; // Default
    
    if (isCardClicked) {
      if (isWaterMarker) {
        // Darker water/cyan colors for clicked water markers
        bgGradient = 'linear-gradient(135deg, rgba(8, 145, 178, 0.95), rgba(6, 182, 212, 0.95))';
        headerBgGradient = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(34, 211, 238, 0.1))';
      } else if (isMCPMarker && !isWaterMarker) {
        // Only use purple if it's MCP but NOT water
        bgGradient = 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(55, 48, 163, 0.95))';
        headerBgGradient = 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(192, 132, 252, 0.1))';
      }
    }
    // Use water-colored borders when clicked for water markers, otherwise default
    const borderColor = isCardClicked && isWaterMarker 
      ? 'rgba(6, 182, 212, 0.3)' 
      : (isCardClicked && isMCPMarker && !isWaterMarker
        ? 'rgba(139, 92, 246, 0.3)'
        : 'rgba(255, 255, 255, 0.1)');
    const borderColorLight = isCardClicked && isWaterMarker 
      ? 'rgba(6, 182, 212, 0.2)' 
      : (isCardClicked && isMCPMarker && !isWaterMarker
        ? 'rgba(139, 92, 246, 0.2)'
        : 'rgba(255, 255, 255, 0.1)');
    const borderColorMedium = isCardClicked && isWaterMarker 
      ? 'rgba(6, 182, 212, 0.4)' 
      : (isCardClicked && isMCPMarker && !isWaterMarker
        ? 'rgba(139, 92, 246, 0.4)'
        : 'rgba(255, 255, 255, 0.2)');
    const iconBgGradient = 'rgba(255, 255, 255, 0.1)';
    // Keep water colors for buttons and badges, but use default backgrounds
    const buttonBgGradient = isWaterMarker
      ? 'rgba(6, 182, 212, 0.15)'
      : (isMCPMarker 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(255, 255, 255, 0.1)');
    const buttonBgGradientHover = isWaterMarker
      ? 'rgba(6, 182, 212, 0.25)'
      : (isMCPMarker 
        ? 'rgba(139, 92, 246, 0.25)' 
        : 'rgba(255, 255, 255, 0.15)');
    const buttonShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    const buttonShadowHover = '0 4px 12px rgba(0, 0, 0, 0.3)';
    const categoryBadgeBg = isWaterMarker
      ? 'rgba(6, 182, 212, 0.2)'
      : (isMCPMarker ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)');
    const categoryBadgeColor = isWaterMarker
      ? '#22d3ee'  // Bright water color for text
      : (isMCPMarker ? 'rgba(192, 132, 252, 0.9)' : 'rgba(255, 255, 255, 0.7)');
    
    // Better name extraction - prioritize operator, ref, power type over "Unnamed"
    let name = props.name || selectedMarker.name || selectedMarker.title;
    if (!name || name === 'Unnamed' || name.trim() === '') {
      if (props.operator && props.operator.trim() !== '') {
        name = props.operator;
      } else if (props.ref && props.ref.trim() !== '') {
        name = `Ref: ${props.ref}`;
      } else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
        name = props['operator:ref'];
      } else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
        name = props.power;
      } else if (props.substation && props.substation.trim() !== '') {
        name = props.substation;
      } else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
        name = props.man_made;
      } else if (props.type && props.type.trim() !== '') {
        name = props.type;
      } else {
        // Fallback to category-based name
        const cat = props.category || props.power || props.man_made || 'infrastructure';
        name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} Infrastructure`;
      }
    }
    
    const distance = selectedMarker.distance ? (selectedMarker.distance / 1000).toFixed(2) + ' km' : 
                     selectedMarker.distance_m ? (selectedMarker.distance_m / 1000).toFixed(2) + ' km' :
                     props.distance ? props.distance : null;

    // Get coordinates for display
    const coords = selectedMarker.coordinates || 
                   (props.coordinates && typeof props.coordinates === 'object' ? props.coordinates : null);
    const lat = coords?.lat || coords?.latitude;
    const lng = coords?.lng || coords?.longitude;

    // Group properties for better organization
    const powerInfo = {
      power: props.power || selectedMarker.power,
      voltage: props.voltage || selectedMarker.voltage,
      type: props.man_made || props.type || selectedMarker.type
    };
    
    const infrastructureInfo = {
      material: props.material || selectedMarker.material,
      operator: props.operator || selectedMarker.operator,
      ref: props.ref || props['operator:ref']
    };

    return (
      <div 
        ref={scrollContainerRef}
        onClick={() => setIsCardClicked(!isCardClicked)}
        style={{
          maxHeight: `${maxHeight}px`,
          overflow: 'auto',
          padding: '0',
          borderRadius: '12px',
          marginBottom: '2px',
          width: '100%',
          maxWidth: '340px',
          position: 'relative',
          background: bgGradient,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'background 0.3s ease, opacity 0.3s ease',
          cursor: 'pointer',
          opacity: isCardDimmed ? 0.01 : 1, // Very transparent when dimmed (1%)
          filter: isCardDimmed ? 'grayscale(50%)' : 'none'
        }}
        className={isAnimating ? (isWaterMarker ? 'water-marker-details-animating' : 'mcp-marker-details-animating') : ''}
      >
        {/* Halo effect overlay */}
        {isAnimating && (
          <div className={isWaterMarker ? "water-marker-details-halo" : "mcp-marker-details-halo"} />
        )}
        
        {/* Header Section */}
        <div style={{
          padding: '20px 20px 16px 20px',
          background: headerBgGradient,
          borderBottom: `1px solid ${borderColorLight}`,
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: iconBgGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${borderColor}`
            }}>
              {isWaterMarker ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill={primaryColorBright} stroke={primaryColorBright} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
                  <path d="M12 2v6M12 8l-5.66 5.66M12 8l5.66 5.66" stroke={primaryColorBright} strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 4.5 7 13 7 13s7-8.5 7-13c0-3.87-3.13-7-7-7z" fill="none" stroke={primaryColorBright} strokeWidth="1.5"/>
                  <path d="M12 6c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill={primaryColorBright} opacity="0.6"/>
                </svg>
              ) : isMCPMarker ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill={primaryColorBright} stroke={primaryColorBright} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#ffffff" opacity="0.3"/>
                  <circle cx="12" cy="10" r="3" fill="#ffffff"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                color: (isMCPMarker || isWaterMarker) ? primaryColorBright : '#ffffff',
                fontSize: '18px',
                fontWeight: '700',
                margin: '0 0 6px 0',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                lineHeight: '1.3',
                wordBreak: 'break-word'
              }}>
                {name}
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  color: categoryBadgeColor,
                  fontSize: '12px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  padding: '2px 8px',
                  background: categoryBadgeBg,
                  borderRadius: '4px'
                }}>
                  {category}
                </span>
                {distance && (
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 12h18M3 8h18M3 16h18" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M2 4h4v16H2z" fill="rgba(255, 255, 255, 0.6)"/>
                      <path d="M18 4h4v16h-4z" fill="rgba(255, 255, 255, 0.6)"/>
                    </svg>
                    {distance}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div style={{
          padding: '16px 20px',
          lineHeight: '1.6',
          color: '#e5e7eb',
          fontSize: '14px'
        }}>
          {/* Why This Matters Section - Contextual relevance to the broader answer */}
          {(() => {
            // Generate relevance text based on available context
            let relevanceText = null;
            
            // First, check if there's explicit relevance in marker data
            if (props.relevance || props.importance || props.why_matters) {
              relevanceText = props.relevance || props.importance || props.why_matters;
            } 
            // Second, try to extract relevant context from Perplexity answer
            else if (responseMetadata?.perplexityAnswer && name) {
              const markerNameLower = name.toLowerCase();
              
              // Try to find sentences that mention this marker or its category
              const sentences = responseMetadata.perplexityAnswer.split(/[.!?]+/).filter(s => s.trim().length > 20);
              
              // Look for sentences that mention the marker name or category
              const relevantSentences = sentences.filter(sentence => {
                const sentenceLower = sentence.toLowerCase();
                return sentenceLower.includes(markerNameLower) || 
                       sentenceLower.includes(category.toLowerCase()) ||
                       (isWaterMarker && (sentenceLower.includes('water') || sentenceLower.includes('supply'))) ||
                       (!isWaterMarker && (sentenceLower.includes('power') || sentenceLower.includes('electrical')));
              });
              
              if (relevantSentences.length > 0) {
                // Use the first relevant sentence, clean it up
                relevanceText = relevantSentences[0].trim();
                // Remove markdown formatting
                relevanceText = relevanceText.replace(/\*\*/g, '').trim();
                // Limit length
                if (relevanceText.length > 200) {
                  relevanceText = relevanceText.substring(0, 197) + '...';
                }
              } else {
                // Generate contextual description based on marker type and query
                const query = responseMetadata?.query || '';
                const queryLower = query.toLowerCase();
                
                if (isWaterMarker) {
                  if (queryLower.includes('fab') || queryLower.includes('tsmc')) {
                    relevanceText = `This water infrastructure facility is critical for supporting TSMC's manufacturing operations. It provides essential water supply capacity needed for semiconductor production processes.`;
                  } else if (queryLower.includes('water')) {
                    relevanceText = `This facility is part of the water infrastructure network that addresses regional water supply needs and allocation requirements.`;
                  } else {
                    relevanceText = `This water infrastructure facility plays a key role in the regional water supply system, providing essential capacity for industrial and municipal needs.`;
                  }
                } else if (isMCPMarker) {
                  if (queryLower.includes('power') || queryLower.includes('electrical')) {
                    relevanceText = `This power infrastructure facility is essential for maintaining reliable electrical service and supporting industrial operations in the region.`;
                  } else if (queryLower.includes('transmission')) {
                    relevanceText = `This transmission infrastructure component is critical for distributing power across the regional electrical grid.`;
                  } else {
                    relevanceText = `This infrastructure facility is strategically located to support regional development and industrial operations.`;
                  }
                } else {
                  relevanceText = `This facility is an important component of the regional infrastructure network.`;
                }
              }
            }
            // Third, generate a simple contextual description
            else {
              if (isWaterMarker) {
                relevanceText = `This water infrastructure facility provides essential water supply capacity for regional industrial and municipal needs.`;
              } else if (isMCPMarker) {
                relevanceText = `This infrastructure facility is strategically positioned to support regional development and operational requirements.`;
              } else {
                relevanceText = `This facility is an important component of the regional infrastructure network.`;
              }
            }
            
            // Only show if we have relevance text
            if (relevanceText) {
              return (
                <div style={{
                  marginBottom: '20px',
                  padding: '12px',
                  background: isWaterMarker 
                    ? 'rgba(6, 182, 212, 0.08)' 
                    : (isMCPMarker ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.03)'),
                  borderRadius: '8px',
                  border: `1px solid ${isWaterMarker 
                    ? 'rgba(6, 182, 212, 0.2)' 
                    : (isMCPMarker ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)')}`
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: isWaterMarker 
                      ? 'rgba(34, 211, 238, 0.8)' 
                      : (isMCPMarker ? 'rgba(192, 132, 252, 0.8)' : 'rgba(255, 255, 255, 0.5)'),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                    Why This Matters
                  </div>
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontWeight: '300',
                    position: 'relative'
                  }}>
                    {formatPerplexityAnswer(relevanceDisplayedText || '', [], isPowerResponse())}
                    {isRelevanceTyping && (
                      <span style={{
                        color: isWaterMarker ? '#22d3ee' : (isMCPMarker ? '#c084fc' : '#ffffff'),
                        animation: 'blink 1s infinite',
                        marginLeft: '2px'
                      }}>
                        |
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Location & Distance Group */}
          {(distance || lat || lng) && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Location
              </div>
              {distance && (
                <div style={{ 
                  marginBottom: lat || lng ? '8px' : '0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="rgba(255, 255, 255, 0.3)"/>
                    <circle cx="12" cy="10" r="3" fill="rgba(255, 255, 255, 0.7)"/>
                  </svg>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', marginBottom: '2px' }}>
                      Distance from facility
                    </div>
                    <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '500' }}>
                      {distance}
                    </div>
                  </div>
                </div>
              )}
              {(lat && lng) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1.5" fill="none"/>
                    <path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10 15.3 15.3 0 0 0 4-10 15.3 15.3 0 0 0-4-10z" fill="rgba(255, 255, 255, 0.3)"/>
                    <circle cx="12" cy="12" r="2" fill="rgba(255, 255, 255, 0.7)"/>
                  </svg>
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', marginBottom: '2px' }}>
                      Coordinates
                    </div>
                    <div style={{ 
                      color: '#ffffff', 
                      fontSize: '13px', 
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}>
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Power & Electrical Info Group */}
          {(powerInfo.power || powerInfo.voltage || powerInfo.type) && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
                marginBottom: '10px'
              }}>
                Power & Electrical
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {powerInfo.power && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Power Type</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {powerInfo.power}
                    </span>
                  </div>
                )}
                {powerInfo.voltage && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Voltage</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500' }}>
                      {powerInfo.voltage}
                    </span>
                  </div>
                )}
                {powerInfo.type && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Type</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {powerInfo.type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Infrastructure Details Group */}
          {(infrastructureInfo.material || infrastructureInfo.operator || infrastructureInfo.ref) && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
                marginBottom: '10px'
              }}>
                Infrastructure Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {infrastructureInfo.operator && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Operator</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500' }}>
                      {infrastructureInfo.operator}
                    </span>
                  </div>
                )}
                {infrastructureInfo.ref && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Reference</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500', fontFamily: 'monospace' }}>
                      {infrastructureInfo.ref}
                    </span>
                  </div>
                )}
                {infrastructureInfo.material && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Material</span>
                    <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {infrastructureInfo.material}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description (if available and not redundant) */}
          {(props.description || selectedMarker.description) && 
           !name.includes(props.description || selectedMarker.description || '') && (
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Description
              </div>
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.9)', 
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {props.description || selectedMarker.description}
              </div>
            </div>
          )}

          {/* Back Button */}
          {onBackToAnalysis && (
            <div style={{
              padding: '16px 20px 20px 20px',
              borderTop: `1px solid ${borderColorLight}`,
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px'
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click toggle
                  if (onBackToAnalysis) onBackToAnalysis();
                }}
                style={{
                  width: '100%',
                  background: buttonBgGradient,
                  border: `1px solid ${borderColorMedium}`,
                  borderRadius: '8px',
                  color: (isMCPMarker || isWaterMarker) ? primaryColorBright : 'rgba(255, 255, 255, 0.9)',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: buttonShadow
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = buttonBgGradientHover;
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = buttonShadowHover;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = buttonBgGradient;
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = buttonShadow;
                }}
              >
                <span>←</span>
                <span>Back to Analysis</span>
              </button>
              
              {/* Quick Actions Button - Only show for MCP markers */}
              {(isMCPMarker || isWaterMarker) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click toggle
                    // Emit event to highlight Quick Actions in AITransmissionNav
                    if (window.mapEventBus) {
                      window.mapEventBus.emit('mcp:highlightQuickActions');
                    }
                  }}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    background: buttonBgGradient,
                    border: `1px solid ${borderColorMedium}`,
                    borderRadius: '8px',
                    color: primaryColorBright,
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: buttonShadow
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = buttonBgGradientHover;
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = buttonShadowHover;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = buttonBgGradient;
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = buttonShadow;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={primaryColorBright} strokeWidth="2" fill="none"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke={primaryColorBright} strokeWidth="2" fill="none"/>
                  </svg>
                  <span>View Quick Actions</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [selectedMarker, maxHeight, onBackToAnalysis, isAnimating, isCardClicked, isCardDimmed, responseMetadata, formatPerplexityAnswer, isPowerResponse, relevanceDisplayedText, isRelevanceTyping]);

  // Show marker details if requested - this takes priority over everything else (even loading)
  // Check this FIRST before any other conditions
  // Only show marker details for MCP markers (not OSM markers - they use their own popup system)
  if (showMarkerDetails && selectedMarker) {
    // Comprehensive check for OSM markers - they should NOT render in this component
    const isOSMMarker = selectedMarker.formatter === 'pinal' || 
                       selectedMarker.formatter === 'tsmc-phoenix' ||
                       selectedMarker.formatter === 'whitney' ||
                       // Also check if it's NOT an MCP marker (OSM markers don't have source: 'mcp')
                       (selectedMarker.source !== 'mcp' && !selectedMarker.source);
    
    // Only render marker details if it's NOT an OSM marker AND it's an MCP marker
    // This ensures only MCP markers show details in this component
    const isMCPMarker = selectedMarker.source === 'mcp';
    
    if (!isOSMMarker && isMCPMarker) {
    return renderMarkerDetails();
    }
    
    // If it's an OSM marker or not an MCP marker, return null (they use their own popup system)
    return null;
  }
  
  // If showMarkerDetails is false but selectedMarker exists, this is likely an OSM marker
  // OSM markers should not trigger any rendering in this component
  if (!showMarkerDetails && selectedMarker) {
    return null;
  }

  // Show skeleton loading when isLoading or during 1s content buffer
  const showSkeletonBuffer = isLoading || (!contentBufferReady && (response || responseMetadata));
  if (showSkeletonBuffer) {
    return (
      <div style={{
        maxHeight: `${maxHeight}px`,
        overflow: 'hidden',
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '2px',
        width: '100%',
        maxWidth: '340px',
        position: 'relative',
        background: 'rgba(30, 41, 59, 0.8)', // Darker blue background
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {/* Skeleton Loading Animation */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {[1, 2, 3, 4, 5].map((line) => (
            <div
              key={line}
              style={{
                height: '16px',
                background: 'rgba(51, 65, 85, 0.6)', // Darker blue for skeleton bars
                borderRadius: '4px',
                marginBottom: line === 5 ? '0' : '12px',
                width: line === 1 ? '90%' : line === 2 ? '85%' : line === 3 ? '70%' : line === 4 ? '60%' : '40%',
                animation: 'skeletonPulse 1.5s ease-in-out infinite',
                animationDelay: `${line * 0.1}s`
              }}
            />
          ))}
          
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

  // Note: renderMarkerDetails is now defined above, before the early return check
  
  // IMPORTANT: Only return null if there's no response AND no marker details to show
  // If there's a response, we should still show it even if an OSM marker was clicked
  // OSM markers should NOT show marker details in this component - they use their own popup system
  if (!response && !showMarkerDetails) {
    return null;
  }
  
  // If selectedMarker is set but showMarkerDetails is false, this is likely an OSM marker
  // OSM markers should not trigger marker details rendering, but we should still show existing responses
  // So only return null if there's also no response to show
  if (selectedMarker && !showMarkerDetails && !response) {
    return null;
  }
  
  // If we have marker details to show, don't require a response
  // But skip OSM markers - they use their own popup system
  // This check should be redundant now since we handle it above, but keeping for safety
  if (!response && showMarkerDetails && selectedMarker) {
    // Comprehensive check for OSM markers
    const isOSMMarker = selectedMarker.formatter === 'pinal' || 
                       selectedMarker.formatter === 'tsmc-phoenix' ||
                       selectedMarker.formatter === 'whitney' ||
                       (selectedMarker.source !== 'mcp' && !selectedMarker.source);
    
    // Only render marker details if it's NOT an OSM marker AND it's an MCP marker
    const isMCPMarker = selectedMarker.source === 'mcp';
    
    if (!isOSMMarker && isMCPMarker) {
    return renderMarkerDetails();
    }
    // If it's an OSM marker or not an MCP marker, return null (they use their own popup system)
    return null;
  }

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
        maxWidth: '340px',
        position: 'relative'
      }}>
        {response}
      </div>
    );
  }

  // Check if response needs truncation
  const needsTruncation = response.length > truncationLength && showTruncation;


  // Handle table rendering mode
  if (renderMode === 'table' && tableData) {
    
    let filteredData = [];
    
    if (tableData && Array.isArray(tableData)) {
      filteredData = tableData; // Already filtered by CategoryToggle
    } else {
      const parsedData = parseTableData(response);
      filteredData = filterNodesByCategory(parsedData, category);
    }
    
    // For MCP responses, show text response first, then table
    // Check metadata first, then fallback to response content pattern
    const isMCPResponse = responseMetadata?.responseType === 'mcp_infrastructure_search' || 
                         responseMetadata?.source === 'mcp' ||
                         (response && typeof response === 'string' && response.includes('Found **') && response.includes('infrastructure feature'));
    
    // For startup companies / properties (category === 'all'), delegate to domain mappers
    if (category === 'all' && filteredData.length > 0) {
      filteredData = buildStartupTableData(filteredData);
    }
    
    return (
      <>
        {/* Table Animation Manager */}
        <TableAnimationManager 
          tableData={filteredData}
          nodeAnimation={nodeAnimation}
          onTableRowClick={handleTableRowClick}
        />
        
        <div 
          ref={scrollContainerRef}
          style={{
            maxHeight: `${maxHeight}px`,
            overflow: 'auto',
            padding: '12px 16px 16px 16px',
            borderRadius: '12px',
            marginBottom: '2px',
            marginTop: category === 'all' ? '8px' : '5px',
            width: '100%',
            maxWidth: category === 'risk' ? '300px' : '340px',
            position: 'relative',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            backdropFilter: 'none',
            animation: 'fadeInUp 0.6s ease-out'
          }}>
          
      {/* Marker Distribution Graph - Show before Answer for MCP responses */}
      {isMCPResponse && responseMetadata?.features && responseMetadata.features.length > 0 && (() => {
        const isPower = isPowerResponse();
        const chartData = processFeaturesForChart(responseMetadata.features);
        const maxCount = Math.max(...chartData.map(d => d.count), 1);
        const chartColor = isPower ? '#c084fc' : '#22d3ee';
        const bgGradient = isPower
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)';
        const borderColor = isPower ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)';
        const boxShadow = isPower
          ? '0 2px 8px rgba(139, 92, 246, 0.15)'
          : '0 2px 8px rgba(6, 182, 212, 0.15)';
        
        return (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: bgGradient,
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            boxShadow: boxShadow,
            animation: 'fadeIn 0.4s ease forwards',
            opacity: 1
          }}>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📊</span>
              Marker Distribution by Distance
            </div>
            <div style={{ 
              width: '100%', 
              height: '180px',
              backgroundColor: 'transparent'
            }}>
              <ResponsiveContainer>
                <BarChart 
                  data={chartData} 
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  style={{ cursor: 'default' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255, 255, 255, 0.5)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                    tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                  />
                  <YAxis
                    stroke="rgba(255, 255, 255, 0.5)"
                    tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                    tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                    width={30}
                    domain={[0, maxCount > 0 ? Math.ceil(maxCount * 1.2) : 5]}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={chartColor} 
                        opacity={0.7 + (entry.count / maxCount) * 0.3}
                        style={{ cursor: 'default' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{
              marginTop: '8px',
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Total: {responseMetadata.features.length} markers found
            </div>
          </div>
        );
      })()}

      {/* Show Perplexity answer for MCP responses (if available) */}
      {isMCPResponse && responseMetadata?.perplexityAnswer && (() => {
        const isPower = isPowerResponse();
        const accentColor = isPower ? '#c084fc' : '#22d3ee'; // Purple for power, cyan for water
        
        return (
          <div style={{
            marginBottom: '16px',
            padding: '0',
            lineHeight: '1.6',
            position: 'relative',
            zIndex: 100,
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            pointerEvents: 'auto'
          }}>
            <div style={{
              fontSize: '10px',
              color: accentColor, // Dynamic color based on response type
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '300', // Thin font for label
              marginBottom: '10px',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text'
            }}>
              Answer
            </div>
            <div style={{
              color: '#ffffff',
              lineHeight: '1.6',
              fontSize: '13px',
              fontWeight: '200', // Thinner font weight for body text
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text',
              cursor: 'text'
            }}>
              {formatPerplexityAnswer(responseMetadata.perplexityAnswer, responseMetadata.perplexityCitations || [], isPower)}
            </div>
          </div>
        );
      })()}
          
          {/* Show text response for MCP responses before the table */}
          {isMCPResponse && response && (() => {
            const isPower = isPowerResponse();
            const bgColor = isPower ? 'rgba(139, 92, 246, 0.1)' : 'rgba(6, 182, 212, 0.1)'; // Purple for power, cyan for water
            const borderColor = isPower ? 'rgba(139, 92, 246, 0.3)' : 'rgba(6, 182, 212, 0.3)'; // Purple for power, cyan for water
            
            return (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
                background: bgColor,
              borderRadius: '8px',
                border: `1px solid ${borderColor}`,
              lineHeight: '1.6',
              color: '#e5e7eb',
              fontSize: '14px',
              fontWeight: '700'
            }}>
                {renderMCPResponseWithClickableFeatures(response, responseMetadata?.features || [], isExpanded, handleExpansionChange, truncationLength)}
            </div>
            );
          })()}
          
          <style>
            {`
              @keyframes fadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
              
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
          
          {/* Render appropriate table based on category */}
          {category === 'all' && (
            <>
              {/* Clickable header to toggle summary */}
              <div 
                onClick={handleSummaryToggle}
                style={{
                  background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(30, 64, 175, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <span>Infrastructure Summary</span>
                  <span style={{
                    fontSize: '12px',
                    opacity: 0.8,
                    transform: showSummaryTable ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}>
                    ▼
                  </span>
                </div>
                <div style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '11px',
                  marginTop: '4px',
                  fontWeight: '400'
                }}>
                  Click to {showSummaryTable ? 'hide' : 'show'} detailed analysis
                </div>
                
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  animation: 'shimmer 2s infinite',
                  pointerEvents: 'none'
                }} />
              </div>
              
              {/* Summary table - only show when toggled */}
              {showSummaryTable && (
                <div style={{
                  animation: 'slideDown 0.5s ease'
                }}>
                  <InfrastructureSummaryTable
                    nodes={filteredData}
                    onTableRowClick={handleTableRowClick}
                    nodeAnimation={nodeAnimation}
                    animationConfig={{
                      hoverEffect: true,
                      clickAnimation: true,
                      pulseOnHover: false
                    }}
                    onDetailToggle={handleDetailToggle}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Startup Ecosystem Categories */}
          {category === 'inn' && (
            <PowerTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'fnd' && (
            <TransmissionTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'tlt' && (
            <UtilitiesTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'net' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'mkt' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
          
          {category === 'imp' && (
            <RiskTable
              nodes={filteredData}
              onTableRowClick={handleTableRowClick}
              nodeAnimation={nodeAnimation}
              animationConfig={{
                hoverEffect: true,
                clickAnimation: true,
                pulseOnHover: false
              }}
            />
          )}
        </div>
      </>
    );
  }

  // Default text rendering mode
  // Check if this is an MCP response
  const isMCPResponse = responseMetadata?.responseType === 'mcp_infrastructure_search' || 
                       responseMetadata?.source === 'mcp' ||
                       (response && typeof response === 'string' && response.includes('Found **') && response.includes('infrastructure feature'));

  const isTexasDataCenter = responseMetadata?.responseType === 'texas_data_center_detail';
  const isLegacyCountyDetail = responseMetadata?.responseType === 'ercot_county_detail';
  const isLocationSearch = responseMetadata?.responseType === 'location_search' || isLegacyCountyDetail;
  const legacyCountyLocationMetadata = isLegacyCountyDetail
    ? {
        ...buildLocationSearchMetadataFromCountySelection({
          properties: responseMetadata?.properties || {},
          geometry: responseMetadata?.geometry || null,
          source: responseMetadata?.source || 'ercot-counties',
          query: responseMetadata?.query || 'ERCOT county detail',
          txPrecomputedType: 'tx_county_detail',
          timestamp: responseMetadata?.timestamp || Date.now()
        }),
        countyId: responseMetadata?.countyId,
        countyName: responseMetadata?.countyName,
        properties: responseMetadata?.properties,
        geometry: responseMetadata?.geometry
      }
    : null;
  const locationCardMetadata = isTexasDataCenter
    ? {
        ...responseMetadata,
        responseType: 'location_search',
        displayName:
          responseMetadata?.displayName ||
          responseMetadata?.properties?.project_name ||
          responseMetadata?.properties?.company ||
          'Texas Data Center',
        source: responseMetadata?.source || 'texas-data-centers'
      }
    : (isLegacyCountyDetail ? legacyCountyLocationMetadata : responseMetadata);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= MOBILE_CONFIG.breakpoint;
  const showLocationCardForTexasMobile = isTexasDataCenter && isMobileViewport;
  const useCompactTexasCardLayout = isTexasDataCenter && isMobileViewport;
  const isTexasSupportedLocation = isTexasDataCenter
    ? true
    : isLocationSearch
      ? isTexasLocationMetadata(locationCardMetadata)
      : true;
  const locationContextForMarketSignal = shouldRenderMarketSignal
    ? {
        label: locationCardMetadata?.displayName || locationCardMetadata?.query || 'Selected location',
        radiusMiles: 30
      }
    : null;
  const isLocationMobileFullscreen =
    isMobileViewport &&
    isLocationCardFullscreenMobile &&
    (isLocationSearch || showLocationCardForTexasMobile);
  const shouldRenderLocationCard = isLocationSearch || isTexasDataCenter || showLocationCardForTexasMobile;
  const isMobileFlipExpandedLocationCard =
    isMobileViewport &&
    isCarouselFlipActive &&
    shouldRenderLocationCard &&
    !isLocationMobileFullscreen;
  const locationSearchBaseHeight = isExpanded
    ? Math.max(120, Math.floor((maxHeight - 20) * 0.72))
    : Math.max(100, Math.floor((maxHeight - 70) * 0.72));
  const locationSearchMaxHeight = isLocationMobileFullscreen
    ? '100dvh'
    : `${locationSearchBaseHeight + (isMobileFlipExpandedLocationCard ? 30 : 0)}px`;

  return (
    <div
      style={{
        opacity: isDimmed ? 0.25 : 1,
        transform: isCarouselFlipActive && !shouldRenderLocationCard ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: isDimmed ? 'none' : 'auto'
      }}
    >
    {/* Scroll container — location search renders outside below for full card width */}
    <div 
      ref={scrollContainerRef}
      style={{
        maxHeight: shouldRenderLocationCard
          ? 0
          : useCompactTexasCardLayout
            ? locationSearchMaxHeight
            : (isExpanded ? `${maxHeight + 30}px` : `${maxHeight}px`),
        overflow: shouldRenderLocationCard ? 'hidden' : 'auto',
        padding: shouldRenderLocationCard
          ? 0
          : useCompactTexasCardLayout
            ? '8px 12px 8px 12px'
            : isTexasDataCenter
              ? '8px 16px 16px 16px'
              : '16px',
        borderRadius: '12px',
        marginBottom: shouldRenderLocationCard ? 0 : '2px',
        marginTop: shouldRenderLocationCard ? 0 : (isExpanded ? '5px' : '0px'),
        width: '100%',
        maxWidth: '340px',
        position: 'relative'
      }}>
          {/* Marker Distribution Graph - Show before Answer for MCP responses */}
          {isMCPResponse && responseMetadata?.features && responseMetadata.features.length > 0 && (() => {
            const isPower = isPowerResponse();
            const chartData = processFeaturesForChart(responseMetadata.features);
            const maxCount = Math.max(...chartData.map(d => d.count), 1);
            const chartColor = isPower ? '#c084fc' : '#22d3ee';
            const bgGradient = isPower
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)';
            const borderColor = isPower ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)';
            const boxShadow = isPower
              ? '0 2px 8px rgba(139, 92, 246, 0.15)'
              : '0 2px 8px rgba(6, 182, 212, 0.15)';
            
            return (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: bgGradient,
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                boxShadow: boxShadow,
                animation: 'fadeIn 0.4s ease forwards',
                opacity: 1
              }}>
                <div style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📊</span>
                  Marker Distribution by Distance
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '180px',
                  backgroundColor: 'transparent'
                }}>
                  <ResponsiveContainer>
                    <BarChart 
                      data={chartData} 
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                      style={{ cursor: 'default' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(255, 255, 255, 0.5)"
                        tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                        tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                      />
                      <YAxis
                        stroke="rgba(255, 255, 255, 0.5)"
                        tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                        tickLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                        width={30}
                        domain={[0, maxCount > 0 ? Math.ceil(maxCount * 1.2) : 5]}
                      />
                      <Bar 
                        dataKey="count" 
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={chartColor} 
                            opacity={0.7 + (entry.count / maxCount) * 0.3}
                            style={{ cursor: 'default' }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{
                  marginTop: '8px',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}>
                  Total: {responseMetadata.features.length} markers found
                </div>
              </div>
            );
          })()}

          {/* Show Perplexity answer for MCP responses (if available) */}
          {isMCPResponse && responseMetadata?.perplexityAnswer && (() => {
            const isPower = isPowerResponse();
            const accentColor = isPower ? '#c084fc' : '#22d3ee'; // Purple for power, cyan for water
            
            return (
              <div style={{
                marginBottom: '16px',
                padding: '0',
                lineHeight: '1.6',
                color: '#e5e7eb',
                fontSize: '13px',
                position: 'relative',
                zIndex: 100,
                userSelect: 'text',
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text',
                pointerEvents: 'auto'
              }}>
                <div style={{
                  fontSize: '10px',
                  color: accentColor, // Dynamic color based on response type
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '800', // Extra bold
                  marginBottom: '10px',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text'
                }}>
                  Answer
                </div>
                <div style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: '1.6',
                  fontWeight: '200', // Thinner font for base text
                  fontSize: '13px',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text',
                  cursor: 'text'
                }}>
                  {formatPerplexityAnswer(responseMetadata.perplexityAnswer, responseMetadata.perplexityCitations || [], isPower)}
                </div>
              </div>
            );
          })()}

      {/* ERCOT County header - power/generation stats for selected area */}
      {responseMetadata?.responseType === 'ercot_county_detail' && responseMetadata?.properties && !shouldRenderLocationCard && (() => {
        const props = responseMetadata.properties;
        const countyName = props.NAME || props.name || 'County';
        const projectCount = props.project_count || 0;
        const totalMW = props.total_capacity_mw || 0;
        const totalGW = totalMW >= 1000 ? `${(totalMW / 1000).toFixed(1)} GW` : `${totalMW.toFixed(0)} MW`;
        const dominantFuel = props.dominant_fuel_type || 'N/A';
        return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div>
            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
              {countyName} County
            </span>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', marginTop: '2px' }}>
              {projectCount} projects • {totalGW} • {dominantFuel}
            </div>
          </div>
        </div>
        );
      })()}


      {/* Response Content - location_search and texas_data_center_detail use LocationSearchCard (mobile + desktop); other types use generic response */}
      {responseMetadata?.responseType !== 'location_search' && responseMetadata?.responseType !== 'texas_data_center_detail' && (
        <div style={{
          lineHeight: '1.6',
          color: '#e5e7eb',
          fontSize: '14px'
        }}>
          {isExpanded ? renderFullView(response, citations) : renderTruncatedView(response, truncationLength, handleExpansionChange)}
        </div>
      )}


      {/* Controls - skip for cards that render specialized compact UIs */}
      {needsTruncation &&
        responseMetadata?.responseType !== 'location_search' &&
        responseMetadata?.responseType !== 'texas_data_center_detail' && (
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
          
          {/* Collapse Button */}
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
    {/* Location search: renders outside the constrained scroll container for full card width */}
    {shouldRenderLocationCard && !isLocationMobileFullscreen && (
      <div style={{
        maxHeight: locationSearchMaxHeight,
        overflow: 'auto',
        borderRadius: '12px',
        marginTop: isExpanded ? '5px' : '0px',
        width: '100%',
        transition: 'max-height 0.25s ease'
      }}>
        {!isTexasSupportedLocation && (
          <div
            style={{
              marginBottom: '8px',
              border: '1px solid rgba(248,113,113,0.4)',
              borderRadius: '8px',
              padding: '7px 9px',
              background: 'rgba(127,29,29,0.2)',
              color: 'rgba(254,226,226,0.9)',
              fontSize: '10px',
              lineHeight: 1.35
            }}
          >
            {TEXAS_GUARDRAIL_NOTE}
          </div>
        )}
        <LocationSearchCard
          responseMetadata={locationCardMetadata}
          onLocationFlyTo={onLocationFlyTo}
          isTexasSupportedAddress={isTexasSupportedLocation}
          texasSupportNote={TEXAS_GUARDRAIL_NOTE}
        />
        <MarketSignal
          dailyMotion={dailyMotion}
          dailyMotionLoading={dailyMotionLoading}
          dailyMotionError={dailyMotionError}
          onRefreshMarket={handleRefreshMarket}
          onRefreshGrid={handleRefreshGrid}
          locationContext={locationContextForMarketSignal}
          localMotion={dailyMotion?.local}
          containerMode="flush"
        />
      </div>
    )}
    {shouldRenderLocationCard && isLocationMobileFullscreen && typeof document !== 'undefined' && createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5000,
          height: '100dvh',
          overflow: 'auto',
          padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 10px calc(env(safe-area-inset-bottom, 0px) + 10px) 10px',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(148,163,184,0.2)',
          boxShadow: '0 20px 50px rgba(2,6,23,0.55)'
        }}
      >
        {!isTexasSupportedLocation && (
          <div
            style={{
              marginBottom: '8px',
              border: '1px solid rgba(248,113,113,0.4)',
              borderRadius: '8px',
              padding: '7px 9px',
              background: 'rgba(127,29,29,0.2)',
              color: 'rgba(254,226,226,0.9)',
              fontSize: '10px',
              lineHeight: 1.35
            }}
          >
            {TEXAS_GUARDRAIL_NOTE}
          </div>
        )}
        <LocationSearchCard
          responseMetadata={locationCardMetadata}
          onLocationFlyTo={onLocationFlyTo}
          onExitMobileFullscreen={() => setIsLocationCardFullscreenMobile(false)}
          isTexasSupportedAddress={isTexasSupportedLocation}
          texasSupportNote={TEXAS_GUARDRAIL_NOTE}
        />
        <MarketSignal
          dailyMotion={dailyMotion}
          dailyMotionLoading={dailyMotionLoading}
          dailyMotionError={dailyMotionError}
          onRefreshMarket={handleRefreshMarket}
          onRefreshGrid={handleRefreshGrid}
          locationContext={locationContextForMarketSignal}
          localMotion={dailyMotion?.local}
          containerMode="flush"
        />
      </div>,
      document.body
    )}
    </div>
  );
};

export default AIResponseDisplay;
