import { useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { createStartupEcosystemToolExecutor, setGlobalToolExecutor, getGlobalToolExecutor } from '../utils/StartupEcosystemToolExecutor';
import { cleanExpiredResponseCache } from '../utils/ResponseCache';
import { getGeographicConfig } from '../config/geographicConfig.js';
import { geocodeQuery } from '../utils/geocodeQuery';
import { logEvent } from '../services/analyticsApi';
import {
  buildLocationSearchMetadataFromPrecomputedCluster,
  formatLocationSearchResponseContent
} from '../utils/locationSearchMetadata';
import { 
  getWorkflowCache,
  setWorkflowCache,
  setCurrentLocation
} from '../utils/HolisticCacheManager.js';

const getGeoaiApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__GEOAI_API_BASE_URL__) {
    return window.__GEOAI_API_BASE_URL__;
  }
  if (process.env.REACT_APP_GEOAI_API_BASE_URL) {
    return process.env.REACT_APP_GEOAI_API_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_GEOAI_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_GEOAI_API_BASE_URL;
  }
  return '';
};

const joinUrl = (base, path) => {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

const buildCacheBustedUrl = (base, relativeUrl, versionToken) => {
  const absolute = joinUrl(base, relativeUrl);
  if (!versionToken) {
    return absolute;
  }
  const separator = absolute.includes('?') ? '&' : '?';
  return `${absolute}${separator}v=${encodeURIComponent(versionToken)}`;
};

const LOCATION_SEARCH_MARKER_SOURCE = 'location-search-marker-source';
const LOCATION_SEARCH_MARKER_LAYER = 'location-search-marker-layer';
const LOCATION_SEARCH_PULSE_SOURCE = 'location-search-pulse-source';
const LOCATION_SEARCH_PULSE_LAYER = 'location-search-pulse-layer';
const LOCATION_SEARCH_RED = '#e53935';
const LOCATION_QUEUE_METRICS_TIMEOUT_MS = 2400;
const ALLOW_DIRECT_QUEUE_METRICS_FALLBACK =
  String(process.env.REACT_APP_QUEUE_METRICS_ALLOW_DIRECT_FALLBACK || '').toLowerCase() === 'true';

function animateLocationSearchMarker(map, lng, lat, displayName = '') {
  if (!map || !map.getStyle()) return;
  const coords = [lng, lat];

  // After the pulse animation ends, only remove the pulse ring — keep the red dot
  const cleanup = () => {
    try {
      if (map.getLayer(LOCATION_SEARCH_PULSE_LAYER)) map.removeLayer(LOCATION_SEARCH_PULSE_LAYER);
      if (map.getSource(LOCATION_SEARCH_PULSE_SOURCE)) map.removeSource(LOCATION_SEARCH_PULSE_SOURCE);
      // Fade the marker dot to a smaller, subtler size so it stays visible but isn't distracting
      if (map.getLayer(LOCATION_SEARCH_MARKER_LAYER)) {
        map.setPaintProperty(LOCATION_SEARCH_MARKER_LAYER, 'circle-radius', 7);
        map.setPaintProperty(LOCATION_SEARCH_MARKER_LAYER, 'circle-opacity', 0.85);
      }
    } catch (_) {}
  };

  try {
    if (map.getLayer(LOCATION_SEARCH_PULSE_LAYER)) map.removeLayer(LOCATION_SEARCH_PULSE_LAYER);
    if (map.getSource(LOCATION_SEARCH_PULSE_SOURCE)) map.removeSource(LOCATION_SEARCH_PULSE_SOURCE);
    if (map.getLayer(LOCATION_SEARCH_MARKER_LAYER)) map.removeLayer(LOCATION_SEARCH_MARKER_LAYER);
    if (map.getSource(LOCATION_SEARCH_MARKER_SOURCE)) map.removeSource(LOCATION_SEARCH_MARKER_SOURCE);
  } catch (_) {}

  const zoom = map.getZoom();
  const highlightRadius = zoom < 7.5 ? 15 : zoom < 12.5 ? 25 : 40;
  const basePulseRadius = zoom < 7.5 ? 20 : zoom < 12.5 ? 35 : 50;

  map.addSource(LOCATION_SEARCH_MARKER_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }] }
  });
  map.addLayer({
    id: LOCATION_SEARCH_MARKER_LAYER,
    type: 'circle',
    source: LOCATION_SEARCH_MARKER_SOURCE,
    paint: {
      'circle-radius': highlightRadius,
      'circle-color': LOCATION_SEARCH_RED,
      'circle-opacity': 0.9,
      'circle-stroke-width': 0
    }
  });

  map.addSource(LOCATION_SEARCH_PULSE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }] }
  });
  map.addLayer({
    id: LOCATION_SEARCH_PULSE_LAYER,
    type: 'circle',
    source: LOCATION_SEARCH_PULSE_SOURCE,
    paint: {
      'circle-radius': basePulseRadius,
      'circle-color': '#ffffff',
      'circle-opacity': 0.8,
      'circle-blur': 0.2
    }
  });

  if (displayName) {
    const shortName = displayName.split(/\s+/).slice(0, 3).join(' ').replace(/</g, '&lt;') || displayName.replace(/</g, '&lt;');
    const labelHtml = `<div style="background:#1a1a1a;color:#e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${shortName}</div>`;
    const popup = new mapboxgl.Popup({
      closeButton: false,
      anchor: 'bottom',
      offset: [0, -18],
      className: 'marker-label-popup'
    }).setLngLat(coords).setHTML(labelHtml).addTo(map);
    setTimeout(() => { popup.remove(); }, 10000);
  }

  const startTime = Date.now();
  const durationMs = 2000;
  let rafId = null;

  const animate = () => {
    if (!map.getStyle() || !map.getLayer(LOCATION_SEARCH_PULSE_LAYER)) {
      rafId = null;
      return;
    }
    const elapsed = Date.now() - startTime;
    if (elapsed >= durationMs) {
      cleanup();
      rafId = null;
      return;
    }
    const progress = elapsed / durationMs;
    const pulsePhase = Math.sin(progress * Math.PI);
    const opacity = 0.4 + pulsePhase * 0.6;
    const radius = basePulseRadius + pulsePhase * 12;
    try {
      map.setPaintProperty(LOCATION_SEARCH_PULSE_LAYER, 'circle-opacity', opacity);
      map.setPaintProperty(LOCATION_SEARCH_PULSE_LAYER, 'circle-radius', radius);
    } catch (_) {}
    rafId = requestAnimationFrame(animate);
  };
  animate();
}

const normalizeQueueMetrics = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const activeQueueCount = Number(raw.activeQueueCount);
  const activeQueueMw = Number(raw.activeQueueMw);
  const totalQueueCount = Number(raw.totalQueueCount);
  if (!Number.isFinite(activeQueueCount) || !Number.isFinite(activeQueueMw)) return null;

  return {
    schemaVersion: raw.schemaVersion || '1.0.0',
    source: raw.source || 'supabase',
    countyName: raw.countyName || null,
    countyGeoid: raw.countyGeoid || null,
    activeQueueCount: Math.max(0, Math.round(activeQueueCount)),
    totalQueueCount: Number.isFinite(totalQueueCount)
      ? Math.max(Math.round(totalQueueCount), Math.round(activeQueueCount))
      : Math.round(activeQueueCount),
    activeQueueMw: Math.max(0, Number(activeQueueMw)),
    avgCapacityMw: Number.isFinite(Number(raw.avgCapacityMw)) ? Number(raw.avgCapacityMw) : 0,
    dominantFuelType: raw.dominantFuelType || null,
    baseloadPct: Number.isFinite(Number(raw.baseloadPct)) ? Number(raw.baseloadPct) : null,
    renewablePct: Number.isFinite(Number(raw.renewablePct)) ? Number(raw.renewablePct) : null,
    storagePct: Number.isFinite(Number(raw.storagePct)) ? Number(raw.storagePct) : null,
    countyType: raw.countyType === 'consumer' ? 'consumer' : 'producer',
    netMw: Number.isFinite(Number(raw.netMw)) ? Number(raw.netMw) : Math.max(0, Number(activeQueueMw)),
    queueWithdrawnCount: Number.isFinite(Number(raw.queueWithdrawnCount)) ? Math.max(0, Math.round(Number(raw.queueWithdrawnCount))) : 0,
    queueCompletedCount: Number.isFinite(Number(raw.queueCompletedCount)) ? Math.max(0, Math.round(Number(raw.queueCompletedCount))) : 0,
    dataCenterCount: Number.isFinite(Number(raw.dataCenterCount)) ? Math.max(0, Math.round(Number(raw.dataCenterCount))) : null,
    dataCenterExistingCount: Number.isFinite(Number(raw.dataCenterExistingCount)) ? Math.max(0, Math.round(Number(raw.dataCenterExistingCount))) : null,
    dataCenterUnderConstructionCount: Number.isFinite(Number(raw.dataCenterUnderConstructionCount))
      ? Math.max(0, Math.round(Number(raw.dataCenterUnderConstructionCount)))
      : null,
    dataCenterAnnouncedCount: Number.isFinite(Number(raw.dataCenterAnnouncedCount))
      ? Math.max(0, Math.round(Number(raw.dataCenterAnnouncedCount)))
      : null,
    nearestSubDistanceMi: Number.isFinite(Number(raw.nearestSubDistanceMi)) ? Number(raw.nearestSubDistanceMi) : null,
    nearestSubName: raw.nearestSubName || null,
    nearestSubVoltageKv: Number.isFinite(Number(raw.nearestSubVoltageKv)) ? Number(raw.nearestSubVoltageKv) : null,
    nearestSubOperator: raw.nearestSubOperator || null,
    nearestSubPoiCount: Number.isFinite(Number(raw.nearestSubPoiCount)) ? Math.max(0, Math.round(Number(raw.nearestSubPoiCount))) : null,
    estWaitMonthsLow: Number.isFinite(Number(raw.estWaitMonthsLow)) ? Math.round(Number(raw.estWaitMonthsLow)) : null,
    estWaitMonthsHigh: Number.isFinite(Number(raw.estWaitMonthsHigh)) ? Math.round(Number(raw.estWaitMonthsHigh)) : null,
    estWaitSource: raw.estWaitSource || null,
    ercotAvgActiveQueueCount: Number.isFinite(Number(raw.ercotAvgActiveQueueCount)) ? Number(raw.ercotAvgActiveQueueCount) : null,
    queriedAt: raw.queriedAt || Date.now(),
    units: raw.units || {
      activeQueueCount: 'projects',
      totalQueueCount: 'projects',
      activeQueueMw: 'mw',
      avgCapacityMw: 'mw',
      netMw: 'mw'
    },
    isFallback: !!raw.isFallback
  };
};

const normalizeSupabaseRpcRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const projectCount = Number(row.project_count) || 0;
  const totalMw = Number(row.total_capacity_mw) || 0;
  return {
    activeQueueCount: projectCount,
    totalQueueCount: Number(row.total_queue_count) || projectCount,
    activeQueueMw: totalMw,
    avgCapacityMw: Number(row.avg_capacity_mw) || 0,
    countyName: row.county_name || null,
    countyType: row.county_type || 'producer',
    netMw: Number(row.net_mw) || totalMw,
    dominantFuelType: row.dominant_fuel_type || null,
    baseloadPct: row.baseload_pct ?? null,
    renewablePct: row.renewable_pct ?? null,
    storagePct: row.storage_pct ?? null,
    queueCompletedCount: Number(row.queue_completed_count) || 0,
    queueWithdrawnCount: Number(row.queue_withdrawn_count) || 0,
    dataCenterCount: row.dc_count != null ? Number(row.dc_count) : null,
    dataCenterExistingCount: row.data_centers_existing != null ? Number(row.data_centers_existing) : null,
    dataCenterUnderConstructionCount: row.data_centers_under_construction != null ? Number(row.data_centers_under_construction) : null,
    dataCenterAnnouncedCount: row.data_centers_announced != null ? Number(row.data_centers_announced) : null,
    nearestSubDistanceMi: row.nearest_sub_distance_mi != null ? Number(row.nearest_sub_distance_mi) : null,
    nearestSubName: row.nearest_sub_name || null,
    nearestSubVoltageKv: row.nearest_sub_voltage_kv != null ? Number(row.nearest_sub_voltage_kv) : null,
    nearestSubOperator: row.nearest_sub_operator || null,
    nearestSubPoiCount: row.nearest_sub_poi_count != null ? Number(row.nearest_sub_poi_count) : null,
    estWaitMonthsLow: row.est_wait_months_low != null ? Number(row.est_wait_months_low) : null,
    estWaitMonthsHigh: row.est_wait_months_high != null ? Number(row.est_wait_months_high) : null,
    estWaitSource: row.est_wait_source || null,
    ercotAvgActiveQueueCount: row.ercot_avg_active_queue_count != null ? Number(row.ercot_avg_active_queue_count) : null,
    source: 'supabase',
    queriedAt: Date.now(),
  };
};

const fetchFromSupabaseDirect = async (lat, lng) => {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCATION_QUEUE_METRICS_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_location_queue_metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ lat, lng }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    return normalizeQueueMetrics(normalizeSupabaseRpcRow(data));
  } catch {
    clearTimeout(timer);
    return null;
  }
};

const fetchLocationQueueMetrics = async (lat, lng) => {
  // Primary path: call the server API route (KV cache + server-side credentials).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCATION_QUEUE_METRICS_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    const response = await fetch(`/api/location-queue-metrics?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const normalized = normalizeQueueMetrics(data);
      if (normalized) {
        console.log('[queueMetrics] via API route', normalized.countyName, normalized.activeQueueCount, 'projects');
        return normalized;
      }
    }
  } catch {
    // Fall through to optional direct fallback.
  } finally {
    clearTimeout(timeout);
  }

  if (!ALLOW_DIRECT_QUEUE_METRICS_FALLBACK) {
    return null;
  }

  // Optional local/dev fallback: call Supabase RPC directly from frontend.
  console.log('[queueMetrics] API route unavailable, trying direct Supabase RPC fallback');
  const direct = await fetchFromSupabaseDirect(lat, lng);
  if (direct) {
    console.log('[queueMetrics] via direct Supabase fallback', direct.countyName, direct.activeQueueCount, 'projects');
  }
  return direct;
};


export const useAIQuery = (map, updateToolFeedback, handleMarkerClick = null, locationKey = 'default') => {
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState([]);
  const [citations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(new Set());
  const [responseCache, setResponseCache] = useState({});

  // Function to add a pending request
  const addPendingRequest = useCallback((queryId) => {
    setPendingRequests(prev => new Set(prev).add(queryId));
    console.log(`Added pending request: ${queryId}`);
  }, []);
  
  // Function to remove a pending request
  const removePendingRequest = useCallback((queryId) => {
    setPendingRequests(prev => {
      const newSet = new Set(prev);
      newSet.delete(queryId);
      return newSet;
    });
    console.log(`Removed pending request: ${queryId}`);
  }, []);

  // Get location-specific configuration
  const locationConfig = getGeographicConfig(locationKey);

  // Function to update only response-related state (for suggestion questions)
  const updateResponseOnly = (
    queryId,
    newResponse,
    newCitations,
    isLoadingState = false,
    options = {}
  ) => {
    const { metadata } = options;
    if (isLoadingState) {
      setIsLoading(true);
      
      // Track this as a pending request
      addPendingRequest(queryId);
      
      // Immediately collapse all existing responses when loading starts
      if (responses.length > 0) {
        // Note: This would need to be handled by parent component
        // setCollapsedResponses logic moved to parent
      }
      
      // Add a loading response to the array - this shows the skeleton loading
      setResponses(prev => [
        ...prev,
        {
          id: queryId,
          content: null,
          citations: [],
          isLoading: true,
          metadata: metadata ?? null
        }
      ]);
    } else {
      // Remove from pending requests
      removePendingRequest(queryId);
      
      // Replace the loading response with the actual response using the reliable ID system
      setResponses(prev => {
        const newResponses = [...prev];
        const responseIndex = newResponses.findIndex(r => r.id === queryId);
        
        if (responseIndex !== -1) {
          const existingMetadata = newResponses[responseIndex]?.metadata;
          newResponses[responseIndex] = { 
            ...newResponses[responseIndex], 
            content: newResponse, 
            citations: newCitations, 
            isLoading: false,
            metadata: metadata !== undefined ? metadata : existingMetadata ?? null
          };
        } else {
          // Fallback for safety, though it shouldn't be needed
          console.warn(`Response ID ${queryId} not found - adding as new response`);
          newResponses.push({ 
            id: queryId, 
            content: newResponse, 
            citations: newCitations, 
            isLoading: false,
            metadata: metadata ?? null
          });
        }
        return newResponses;
      });
      
      setIsLoading(false);
    }
  };

  // Main AI query handler
  const handleAIQuery = async (questionData) => {
    // Set current location for cache management
    setCurrentLocation(locationKey);
    
    // Generate a unique ID for the new request
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (questionData.manualResponse) {
      const manualId = questionData.manualId || queryId;
      console.log('🧠 useAIQuery: registering manual response', {
        manualId,
        locationKey,
        hasCitations: !!(questionData.manualCitations && questionData.manualCitations.length)
      });
      setResponses(prev => {
        const filtered = manualId ? prev.filter(r => r.manualId !== manualId) : prev;
        return [
          ...filtered,
          {
            id: manualId,
            manualId,
            content: questionData.manualResponse,
            citations: questionData.manualCitations || [],
            isLoading: false
          }
        ];
      });
      setIsLoading(false);
      return manualId;
    }

    // Location search: custom queries → geocode → flyTo + red marker + pulse
    if (questionData.isCustom && questionData.query) {
      const query = String(questionData.query || '').trim();
      if (!query) return queryId;

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

      logEvent('search_submitted', {
        queryType: 'address',
        query,
        queryLen: query.length,
        hasComma: query.includes(','),
        ...utm,
      }, 'useAIQuery');

      updateResponseOnly(queryId, null, [], true);
      const result = await geocodeQuery(query);

      if (!result) {
        logEvent('geocode_failed', { query, ...utm }, 'useAIQuery');
        updateResponseOnly(queryId, '**Location not found.**\n\nTry a different address or place name.', [], false);
        return queryId;
      }

      const { lat, lng, displayName } = result;
      logEvent('geocode_success', { query, lat, lng, displayName, ...utm }, 'useAIQuery');
      const m = map?.current;
      if (m) {
        const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;
        m.flyTo({
          center: [lng, lat],
          zoom: 14,
          duration: 1000,
          offset: [0, isMobileViewport ? -150 : -80]
        });
        animateLocationSearchMarker(m, lng, lat, displayName);
      }

      const content = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const baseMetadata = {
        responseType: 'location_search',
        source: 'ask-anything',
        coordinates: [lng, lat],
        displayName,
        timestamp: Date.now(),
        queueMetricsSchemaVersion: '1.0.0',
        queueMetricsSource: 'supabase_county_aggregate',
        queueMetricsStatus: 'pending',
        queueMetrics: null
      };
      updateResponseOnly(queryId, content, [], false, {
        metadata: baseMetadata
      });

      // Resolve queue metrics asynchronously so map fly-to and card render stay snappy.
      const metricsStartMs = Date.now();
      void fetchLocationQueueMetrics(lat, lng).then((queueMetrics) => {
        const latencyMs = Date.now() - metricsStartMs;
        const status = queueMetrics ? 'ready' : 'fallback';
        logEvent('queue_metrics_loaded', {
          lat, lng, displayName, status,
          countyName: queueMetrics?.countyName,
          countyType: queueMetrics?.countyType,
          activeQueueCount: queueMetrics?.activeQueueCount,
          dataCenterCount: queueMetrics?.dataCenterCount,
          ...utm,
        }, 'useAIQuery');
        logEvent('queue_metrics_status', { status, latencyMs, displayName, ...utm }, 'useAIQuery');
        setResponses(prev => {
          const next = [...prev];
          const idx = next.findIndex(r => r.id === queryId);
          if (idx === -1) return prev;
          const existingMetadata = next[idx]?.metadata || {};
          next[idx] = {
            ...next[idx],
            metadata: {
              ...existingMetadata,
              queueMetricsStatus: status,
              queueMetrics: queueMetrics || null
            }
          };
          return next;
        });
      }).catch((err) => {
        logEvent('queue_metrics_failed', {
          displayName, lat, lng,
          errorMessage: err?.message || 'unknown',
          ...utm,
        }, 'useAIQuery');
      });
      return queryId;
    }
    
    // Log AI query submission
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

    logEvent('search_submitted', {
      queryType: 'ai',
      queryLen: String(questionData.text || questionData.id || '').length,
      hasComma: false,
      ...utm,
    }, 'useAIQuery');

    // Simple cache key - just question type + location name
    const simpleLocationKey = locationConfig?.city || locationConfig?.name || 'default';
    
    // Get coordinates from location config
    const coordinates = locationConfig?.coordinates || { lat: 42.3601, lng: -71.0589 };
    
    // GEOAI: Spatial intelligence workflow triggered from NestedCircleButton GeoAI control
    if (questionData.id === 'geoai_analysis') {
      console.log('🧠 GeoAI Mode: Requesting Sentinel-2 composites');

      updateResponseOnly(queryId, null, [], true);

      const shouldExecuteGeoAI = questionData.shouldExecuteGeoAI !== false;
      const shouldRenderOverlays = questionData.shouldRenderOverlays !== false;

      try {
        if (!shouldExecuteGeoAI) {
          const summary = questionData.precomputedSummary || 'GeoAI summary unavailable.';
          const citations = questionData.precomputedCitations || [];
          const metadata = questionData.precomputedMetadata || null;

          updateResponseOnly(queryId, summary, citations, false, { metadata });
          setIsLoading(false);
          return;
        }

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '🛰️ Loading pre-rendered GeoAI imagery...',
            progress: 20,
            details: 'Retrieving cached Sentinel & NAIP overlays for key sites'
          });
        }

        let geoaiApiBaseUrl = getGeoaiApiBaseUrl();
        const candidateBases = [];
        if (geoaiApiBaseUrl) {
          candidateBases.push(geoaiApiBaseUrl);
        }
        if (typeof window !== 'undefined') {
          candidateBases.push('');
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const localBase = `${window.location.protocol}//localhost:5001`;
            candidateBases.push(localBase);
            candidateBases.push(`${window.location.protocol}//127.0.0.1:5001`);
          }
        }
        const uniqueBases = [...new Set(candidateBases.length ? candidateBases : [''])];

        let metadataPayload = null;
        let lastMetadataError = null;

        const cachedOverlayUrl = questionData.siteOverlayUrl;
        if (cachedOverlayUrl) {
          console.log('🧠 GeoAI: loading cached overlay metadata', { cachedOverlayUrl });
          try {
            const cacheResponse = await fetch(cachedOverlayUrl, { cache: 'no-cache' });
            if (!cacheResponse.ok) {
              throw new Error(`Failed to load cached overlay (${cacheResponse.status})`);
            }
            const payload = await cacheResponse.json();
            metadataPayload = payload;
          } catch (cacheError) {
            console.warn('🧠 GeoAI: cached overlay load failed, falling back to API', cacheError);
          }
        }

        if (!metadataPayload) {
          for (const baseCandidate of uniqueBases) {
            const batchUrl = joinUrl(baseCandidate, '/api/geoai/imagery/batch');
            console.log('🧠 GeoAI: requesting dynamic tile metadata…', { batchUrl });
            try {
            const requestBody = {};
            if (Array.isArray(questionData.allowedSiteIds) && questionData.allowedSiteIds.length) {
              requestBody.siteIds = questionData.allowedSiteIds;
            }
            if (typeof questionData.radiusMeters === 'number') {
              requestBody.radius = questionData.radiusMeters;
            }

            const metadataResponse = await fetch(batchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
              if (!metadataResponse.ok) {
                lastMetadataError = new Error(`GeoAI tile metadata request failed (${metadataResponse.status})`);
                continue;
              }

              const payload = await metadataResponse.json();
              if (payload.success === false) {
                lastMetadataError = new Error(payload.error || 'GeoAI tile metadata request failed');
                continue;
              }

              metadataPayload = payload;
              geoaiApiBaseUrl = baseCandidate;
              break;
            } catch (requestError) {
              lastMetadataError = requestError;
            }
          }

          if (!metadataPayload) {
            throw lastMetadataError || new Error('GeoAI tile metadata request failed');
          }
        }

        const metadataVersionToken = metadataPayload.generatedAt || new Date().toISOString();
        const batchResults = metadataPayload.results || {};
        let sites = Object.values(batchResults)
          .map(entry => ({
            site: entry.site,
            result: entry.result
          }))
          .filter(entry => entry.site && entry.result && entry.result.success)
          .map(entry => ({
            id: entry.site.id,
            name: entry.site.name,
            center: entry.site.coordinates,
            radiusMeters: entry.result.imagery?.trueColor?.radiusMeters || entry.site.radius || 3000,
            imagery: entry.result.imagery || {},
            metadata: entry.result.metadata || {}
          }));

        if (questionData.radiusMeters) {
          sites = sites.map(site => ({
            ...site,
            radiusMeters: questionData.radiusMeters
          }));
        }

        if (Array.isArray(questionData.allowedSiteIds) && questionData.allowedSiteIds.length) {
          const allowed = new Set(questionData.allowedSiteIds);
          sites = sites.filter(site => allowed.has(site.id));
        }

        console.log('🧠 GeoAI: tile metadata ready for', sites.length, 'sites');
        if (!sites.length) {
          throw new Error('GeoAI tile metadata returned no sites');
        }
        const sentinelLookbackDays = 365;

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '🧠 Preparing overlays...',
            progress: 60,
            details: `Applying ${sites.length} cached overlays to the map`
          });
        }

        const mapInstance = map?.current;
        if (shouldRenderOverlays && mapInstance) {
          console.log('🧠 GeoAI: clearing previous GeoAI layers and sources');
          if (!mapInstance.isStyleLoaded()) {
            const waitStartedAt = Date.now();
            console.log('🧠 GeoAI: map style not yet loaded — awaiting styledata event');
            await new Promise(resolve => {
              const onceHandler = () => {
                mapInstance.off('styledata', styledataHandler);
                console.log('🧠 GeoAI: styledata event received', {
                  waitedMs: Date.now() - waitStartedAt
                });
                resolve();
              };
              const timeoutId = setTimeout(() => {
                mapInstance.off('styledata', styledataHandler);
                console.warn('🧠 GeoAI: styledata wait timed out after 5000ms — continuing rendering');
                resolve();
              }, 5000);
              const styledataHandler = () => {
                clearTimeout(timeoutId);
                onceHandler();
              };
              mapInstance.on('styledata', styledataHandler);
            });
          } else {
            console.log('🧠 GeoAI: map style already loaded — proceeding immediately');
          }

          const removedBaseLayers = [];
          ['geoai-truecolor-layer', 'geoai-ndvi-layer', 'geoai-falsecolor-layer', 'geoai-naip-layer']
            .forEach(id => {
              if (mapInstance.getLayer(id)) {
                mapInstance.removeLayer(id);
                removedBaseLayers.push(id);
              }
            });
          const removedBaseSources = [];
          ['geoai-truecolor-source', 'geoai-ndvi-source', 'geoai-falsecolor-source', 'geoai-naip-source']
            .forEach(id => {
              if (mapInstance.getSource(id)) {
                mapInstance.removeSource(id);
                removedBaseSources.push(id);
              }
            });
          if (removedBaseLayers.length || removedBaseSources.length) {
            console.log('🧠 GeoAI: removed legacy GeoAI artifacts', {
              layers: removedBaseLayers,
              sources: removedBaseSources
            });
          }

          const removedSiteLayers = [];
          const removedSiteSources = [];
          const currentStyle = mapInstance.getStyle();
          if (currentStyle?.layers) {
            currentStyle.layers
              .filter(layer => layer.id.startsWith('geoai-site-'))
              .forEach(layer => {
                if (mapInstance.getLayer(layer.id)) {
                  mapInstance.removeLayer(layer.id);
                  removedSiteLayers.push(layer.id);
                }
              });
          }
          if (currentStyle?.sources) {
            Object.keys(currentStyle.sources)
              .filter(sourceId => sourceId.startsWith('geoai-site-'))
              .forEach(sourceId => {
                if (mapInstance.getSource(sourceId)) {
                  mapInstance.removeSource(sourceId);
                  removedSiteSources.push(sourceId);
                }
              });
          }
          if (removedSiteLayers.length || removedSiteSources.length) {
            console.log('🧠 GeoAI: removed per-site overlays from previous runs', {
              layers: removedSiteLayers,
              sources: removedSiteSources
            });
          }

          console.log('🧠 GeoAI: applying cached overlays for sites', {
            siteCount: sites.length
          });
          const createCirclePolygon = (center, radiusMeters, steps = 128) => {
            const coords = [];
            const earthRadius = 6378137;
            const angularDistance = radiusMeters / earthRadius;
            const centerLatRad = (center.lat * Math.PI) / 180;
            const centerLngRad = (center.lng * Math.PI) / 180;

            for (let i = 0; i <= steps; i += 1) {
              const bearing = (2 * Math.PI * i) / steps;
              const sinLat = Math.sin(centerLatRad);
              const cosLat = Math.cos(centerLatRad);
              const sinAngular = Math.sin(angularDistance);
              const cosAngular = Math.cos(angularDistance);
              const latRad = Math.asin(
                sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing)
              );
              const lngRad = centerLngRad + Math.atan2(
                Math.sin(bearing) * sinAngular * cosLat,
                cosAngular - sinLat * Math.sin(latRad)
              );
              coords.push([
                (lngRad * 180) / Math.PI,
                (latRad * 180) / Math.PI
              ]);
            }

            return {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [coords]
              }
            };
          };

          const firstSuccessfulSite = sites[0];

          sites.forEach(site => {
            console.groupCollapsed(`🛰️ GeoAI overlay: ${site.name} (${site.id})`);
            if (!questionData.disableRaster) {
              const availableLayers = site.imagery || {};
              const layerConfigs = [
                { key: 'naip', opacity: 1, defaultMinZoom: 11 },
                { key: 'trueColor', opacity: 0.4, defaultMinZoom: 10 }
              ];

              layerConfigs.forEach(config => {
                const layerInfo = availableLayers[config.key];
                if (!layerInfo || !layerInfo.tileUrl) {
                  return;
                }

                const tileSourceId = `geoai-site-${site.id}-${config.key}-tilesource`;
                const tileLayerId = `geoai-site-${site.id}-${config.key}-tilelayer`;
                const tileUrl = buildCacheBustedUrl(geoaiApiBaseUrl, layerInfo.tileUrl, metadataVersionToken);
                console.log('🛰️ GeoAI: adding tile layer', {
                  layer: config.key,
                  sourceId: tileSourceId,
                  layerId: tileLayerId,
                  tileUrl
                });

                mapInstance.addSource(tileSourceId, {
                  type: 'raster',
                  tiles: [tileUrl],
                  tileSize: 256,
                  minzoom: layerInfo.minZoom ?? config.defaultMinZoom ?? 6,
                  maxzoom: layerInfo.maxZoom ?? 19
                });

                mapInstance.addLayer({
                  id: tileLayerId,
                  type: 'raster',
                  source: tileSourceId,
                  paint: {
                    'raster-opacity': config.opacity,
                    'raster-fade-duration': 0
                  }
                });
                console.log('🛰️ GeoAI: tile layer added successfully');
              });
            }

            if (!questionData.suppressHalo && site.radiusMeters) {
              const haloDefinitions = [
                { suffix: 'halo-2x', multiplier: 2, opacity: 0.18, color: '#ec4899' },
                { suffix: 'halo-3x', multiplier: 3, opacity: 0.12, color: '#ec4899' }
              ];

              haloDefinitions.forEach(halo => {
                const haloSourceId = `geoai-site-${site.id}-${halo.suffix}-source`;
                const haloLayerId = `geoai-site-${site.id}-${halo.suffix}-layer`;
                const radius = site.radiusMeters * halo.multiplier;
                const circleFeature = createCirclePolygon(site.center, radius);

                mapInstance.addSource(haloSourceId, {
                  type: 'geojson',
                  data: circleFeature
                });

                mapInstance.addLayer({
                  id: haloLayerId,
                  type: 'fill',
                  source: haloSourceId,
                  paint: {
                    'fill-color': halo.color,
                    'fill-opacity': halo.opacity,
                    'fill-outline-color': '#ec489966'
                  }
                });
              });
            }
            console.groupEnd();
          });

          if (firstSuccessfulSite) {
            console.log('🧠 GeoAI: first successful site identified (auto-zoom removed)', {
              siteId: firstSuccessfulSite.id,
              center: firstSuccessfulSite.center
            });
            // Auto-zoom removed - map stays at current position
          }
        } else if (!shouldRenderOverlays) {
          console.log('🧠 GeoAI: overlay rendering disabled, skipping map layer updates');
        } else {
          console.warn('🧠 GeoAI: map reference missing, skipping overlay rendering');
        }

        const analysisTimestamp = new Date().toLocaleString();
        const overlaySummaryLines = sites.map(site => {
          const hasNaip = Boolean(site.imagery?.naip?.tileUrl);
          const hasSentinel = Boolean(site.imagery?.trueColor?.tileUrl);
          if (!hasNaip && !hasSentinel) {
            return `- ⚠️ ${site.name}: imagery unavailable`;
          }
          const available = [];
          if (hasNaip) available.push('NAIP');
          if (hasSentinel) available.push('Sentinel');
          return `- ✅ ${site.name}: ${available.join(' + ')}`;
        }).join('\n');

        const summary = `## 🧠 GeoAI Satellite Intelligence\n**Focus Area:** Pinal County Mega-Project Portfolio  \n**Analysis Timestamp:** ${analysisTimestamp}  \n**Sites Processed:** ${sites.length} (Sentinel composites${sites.some(site => site.imagery?.naip?.tileUrl) ? ' + NAIP basemaps' : ''})\n\n### Overlay Coverage by Site\n${overlaySummaryLines}\n\n### Acquisition Window\n- Cached Sentinel lookback: last ${sentinelLookbackDays} days  \n- NAIP coverage: latest available within past 5 years\n\n### Recommended Next Steps\n1. Use layer visibility controls to inspect NAIP vs. Sentinel overlays per site.\n2. Capture screenshots of key manufacturing corridors (Lucid/LG/P&G) for water negotiations.\n3. Compare mining sites (Resolution, Florence) against Sentinel overlays to monitor reclamation impacts.\n\n*Imagery sourced from Sentinel-2 Surface Reflectance and USDA NAIP via Google Earth Engine (pre-generated).*`;

        const citations = [
          {
            url: 'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR',
            title: 'Sentinel-2 MSI Surface Reflectance',
            snippet: 'Primary dataset for true-color composites delivered by GeoAI.'
          },
          {
            url: 'https://developers.google.com/earth-engine',
            title: 'Google Earth Engine',
            snippet: 'Processing environment used to generate cached imagery.'
          },
        ];

        if (sites.some(site => site.imagery?.naip?.tileUrl)) {
          citations.push({
            url: 'https://developers.google.com/earth-engine/datasets/catalog/USDA_NAIP_DOQQ',
            title: 'USDA NAIP DOQQ',
            snippet: 'High-resolution aerial imagery (≈1m) sourced from the National Agriculture Imagery Program.'
          });
        }

        const geoaiMetadata = {
          responseType: 'geoai_change_summary',
          sites,
          sentinelLookbackDays,
          analysisTimestamp,
          summaryText: summary
        };

        updateResponseOnly(queryId, summary, citations, false, { metadata: geoaiMetadata });
        console.log('🧠 GeoAI: overlays applied and summary updated', {
          responseId: queryId,
          sitesWithImagery: sites.filter(site => site.imagery && (site.imagery.naip?.tileUrl || site.imagery.trueColor?.tileUrl)).length
        });

        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '✅ GeoAI imagery ready',
            progress: 100,
            details: `Rendered ${sites.length} site overlays across Pinal County`
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

      } catch (error) {
        console.error('❌ GeoAI imagery error:', error);
        if (updateToolFeedback) {
          updateToolFeedback({
            isActive: true,
            tool: 'geoai',
            status: '❌ GeoAI imagery failed',
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
        updateResponseOnly(queryId, `GeoAI imagery request failed: ${error.message || error}`, [], false);
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // PERPLEXITY MODE: Handle direct Perplexity analysis
    if (questionData.id === 'perplexity_analysis' || questionData.isPerplexityMode) {
      console.log('🧠 Perplexity Mode: Starting Pinal County regional development analysis');
      
      // Execute Perplexity-first analysis with user's actual query
      const userQuery = questionData.query || questionData.text || 'pinal county regional development analysis';
      await executePerplexityAnalysis(queryId, coordinates, simpleLocationKey, userQuery);
      return;
    }
    
    // Startup ecosystem analysis now runs with deterministic tool actions (no Claude step).
    if (questionData.id === 'startup_ecosystem_analysis') {
      const startupToolActions = [
        {
          tool: 'SERP',
          queries: [
            `startup companies ${locationConfig?.city || 'Austin'} ${locationConfig?.state || 'TX'}`,
            `venture capital firms ${locationConfig?.county || 'Texas'}`,
            `co-working spaces ${locationConfig?.city || 'Austin'}`
          ],
          reason: 'Startup ecosystem data collection'
        },
        {
          tool: 'OSM',
          queries: ['universities', 'offices', 'transportation'],
          reason: 'Urban infrastructure context analysis'
        },
        {
          tool: 'PERPLEXITY',
          queries: [
            `startup ecosystem analysis ${locationConfig?.city || 'Austin'}`,
            `${locationConfig?.region || 'Texas'} innovation potential`
          ],
          reason: 'Ecosystem narrative synthesis'
        }
      ];

      updateResponseOnly(queryId, null, [], true);
      try {
        await executeStartupEcosystemTools(startupToolActions, queryId, coordinates, simpleLocationKey);
      } catch (error) {
        const errorResponse = `## Startup Ecosystem Analysis\n\nTool execution failed: ${error.message || 'Unknown error'}`;
        updateResponseOnly(queryId, errorResponse, [], false);
      }
      return;
    }

    // Check complete workflow cache first (highest priority)
    const workflowCache = getWorkflowCache(questionData.id, simpleLocationKey, coordinates);
    console.log('🔍 Workflow cache check:', {
      questionId: questionData.id,
      simpleLocationKey: simpleLocationKey,
      found: !!workflowCache
    });
    
    // Debug: Check if there are any workflow cache entries
    if (typeof window !== 'undefined' && window.holisticCache && window.holisticCache.caches) {
      const workflowCacheSize = window.holisticCache.caches.workflow?.size || 0;
      console.log('🔍 Workflow cache size:', workflowCacheSize);
    }
    
    if (workflowCache) {
      console.log('🎯 Workflow Cache HIT - returning complete cached workflow');
      console.log('⚡ Performance: Cached response loaded in <100ms (vs 30+ seconds for fresh analysis)');
      
      // Update AI state with cached workflow data
      setResponses(prev => [...prev, {
        id: queryId,
        content: workflowCache.finalResponse,
        citations: workflowCache.citations || [],
        isLoading: false,
        cached: true
      }]);
      
      // Update tool feedback to show cached completion
      updateToolFeedback({
        isActive: true,
        tool: 'workflow',
        status: '⚡ Complete workflow loaded from cache',
        progress: 100,
        details: `Using cached ecosystem analysis (${workflowCache.toolResults?.length || 0} tools completed) - 99% faster than fresh analysis`
      });
      
      // Hide feedback after 3 seconds to show the performance benefit
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 3000);
      
      return;
    }
    
    // Generate cache key - use hash for custom questions to avoid collisions
    const cacheKey = questionData.isCustom ? 
      `custom_${questionData.text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}` : 
      questionData.id;
    
    // Check cache first
    if (responseCache[cacheKey]) {
      console.log('Cache hit for:', cacheKey);
      const cachedData = responseCache[cacheKey];
      const responseText = typeof cachedData === 'string' ? cachedData : cachedData.content;
      const cachedCitations = typeof cachedData === 'string' ? [] : (cachedData.citations || []);
      
      // Use updateResponseOnly to avoid affecting other UI elements
      updateResponseOnly(queryId, responseText, cachedCitations, false);
      
      return;
    }
    

    
    // Set loading state for response only
    updateResponseOnly(queryId, null, [], true);
    cleanExpiredResponseCache();

    // Claude path removed. Non-tool queries now return deterministic local status text.
    const formattedResponse = questionData.isCustom
      ? `## Custom Analysis\n**${locationConfig.businessContext}**\n\n**Question:** ${questionData.text}\n\nLive Claude analysis has been removed. Use address search or the preset Texas questions while precomputed insights are being wired.\n\n---\n\n### Status\nLocal deterministic mode is active.`
      : `## Local Insight Mode\n\nQuery received: **${questionData.text || questionData.id || 'Untitled query'}**\n\nLive Claude analysis has been removed. This question will use precomputed Texas datasets in the next phase.`;

    const responseMetadata = {
      responseType: 'local_precomputed_pending',
      source: 'local',
      questionId: questionData.id,
      query: questionData.query || questionData.text || '',
      timestamp: Date.now()
    };

    // Store response in cache
    setResponseCache(prev => ({
      ...prev,
      [cacheKey]: { content: formattedResponse, citations: [] }
    }));

    updateResponseOnly(queryId, formattedResponse, [], false, { metadata: responseMetadata });
    return queryId;
  };

  // Perplexity-first analysis function
  const executePerplexityAnalysis = async (queryId, coordinates, simpleLocationKey = 'default', userQuery = 'pinal county regional development analysis') => {
    console.log('🧠 Executing Perplexity-first startup ecosystem analysis');
    
    try {
      // Check for local Perplexity data file first
      try {
        const response = await fetch('/perplexity-houston-startup-analysis.json');
        if (response.ok) {
          const localData = await response.json();
          console.log('⚡ useAIQuery: Using local Perplexity analysis file');
          
          updateToolFeedback({
            isActive: true,
            tool: 'perplexity',
            status: '⚡ Loading local analysis...',
            progress: 60,
            details: 'Using local Houston startup analysis file'
          });
          
          // Store Perplexity analysis data globally
          window.lastPerplexityAnalysisData = {
            geoJsonFeatures: localData.geoJsonFeatures || [],
            analysis: localData.analysis || '',
            citations: localData.citations || [],
            summary: localData.summary || {},
            insights: localData.insights || {},
            legendItems: localData.legendItems || [],
            timestamp: localData.timestamp || Date.now()
          };
          
          // Update response with Perplexity analysis
          updateResponseOnly(queryId, localData.analysis, localData.citations || [], false);
          
          // Emit to map components
          if (window.mapEventBus) {
            window.mapEventBus.emit('perplexity:analysisComplete', localData);
            window.mapEventBus.emit('perplexity:dataLoaded', localData);
          }
          
          updateToolFeedback({
            isActive: false,
            tool: null,
            status: '',
            progress: 0,
            details: ''
          });
          
          return;
        }
      } catch (error) {
        console.log('📁 useAIQuery: No local Perplexity file found, proceeding with API call');
      }
      
      // If no local file, call Perplexity API through tool executor
      updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '🧠 Calling Perplexity API...',
        progress: 30,
        details: 'Analyzing Pinal County regional development with Perplexity'
      });
      
      // Create Perplexity-specific tool actions with user query
      const perplexityToolActions = [
        {
          tool: 'PERPLEXITY',
          queries: [userQuery],
          reason: `Direct Perplexity analysis: ${userQuery}`
        }
      ];
      
      // Execute through existing tool executor
      const toolResults = await executeStartupEcosystemTools(perplexityToolActions, queryId, coordinates, simpleLocationKey);
      
      // Check if Perplexity tool returned structured data
      console.log('🔍 useAIQuery: Tool results received:', {
        hasToolResults: !!toolResults,
        toolDataKeys: toolResults?.toolData ? Object.keys(toolResults.toolData) : [],
        perplexityExists: !!toolResults?.toolData?.perplexity,
        hasStructuredData: !!toolResults?.toolData?.perplexity?.structuredData
      });
      
      if (toolResults?.toolData?.perplexity?.structuredData) {
        const structuredData = toolResults.toolData.perplexity.structuredData;
        
        console.log('🎯 useAIQuery: Processing Perplexity structured data:', {
          geoJsonFeatures: structuredData.geoJsonFeatures?.length || 0,
          legendItems: structuredData.legendItems?.length || 0,
          hasMapEventBus: !!window.mapEventBus
        });
        
        // Store structured data globally
        window.lastPerplexityAnalysisData = {
          geoJsonFeatures: structuredData.geoJsonFeatures || [],
          analysis: structuredData.analysis || '',
          citations: structuredData.citations || [],
          summary: structuredData.summary || {},
          insights: structuredData.insights || {},
          legendItems: structuredData.legendItems || [],
          timestamp: structuredData.timestamp || Date.now()
        };
        
        // Emit structured data to map components
        if (window.mapEventBus) {
          window.mapEventBus.emit('perplexity:analysisComplete', structuredData);
          window.mapEventBus.emit('perplexity:dataLoaded', structuredData);
          console.log('📡 Emitted Perplexity events to map components');
        } else {
          console.warn('⚠️ No mapEventBus available for emitting Perplexity events');
        }
        
        console.log('🧠 Perplexity structured data processed and emitted to map components');
      } else {
        console.log('❌ useAIQuery: No structured data found in toolResults.toolData.perplexity');
      }
      
    } catch (error) {
      console.error('❌ Perplexity analysis failed:', error);
      
      updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '❌ Analysis failed',
        progress: 0,
        details: `Error: ${error.message}`
      });
      
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: ''
        });
      }, 5000);
    }
  };

  // Tool execution function (Phase 2 implementation)
  const executeStartupEcosystemTools = async (toolActions, queryId, coordinates, simpleLocationKey = 'default') => {
    console.log('Executing Startup Ecosystem tools:', toolActions);
    
    // Initialize variables for workflow caching
    let perplexityAnalysis = null;
    let perplexityCitations = [];
    let dataSources = [];
    
    try {
      // Use existing global tool executor if available, otherwise create new one
      let toolExecutor = getGlobalToolExecutor();
      if (!toolExecutor) {
        // console.log('🔄 useAIQuery: No global tool executor found, creating new one');
        toolExecutor = createStartupEcosystemToolExecutor(map, updateToolFeedback, handleMarkerClick);
        setGlobalToolExecutor(toolExecutor);
      } else {
        // CRITICAL FIX: Update the updateToolFeedback function for reused executor
        toolExecutor.updateToolFeedback = updateToolFeedback;
        
        // Also update the feedback function for all individual tools
        if (toolExecutor.serpTool) {
          toolExecutor.serpTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.osmTool) {
          toolExecutor.osmTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.perplexityTool) {
          toolExecutor.perplexityTool.updateToolFeedback = updateToolFeedback;
        }
        if (toolExecutor.firecrawlTool) {
          toolExecutor.firecrawlTool.updateToolFeedback = updateToolFeedback;
        }
        
        // Update location if it has changed
        if (toolExecutor.updateLocation && locationKey !== 'default') {
          toolExecutor.updateLocation(locationKey);
        }
      }
      
      // Clear existing map data before adding new startup ecosystem data
      if (toolExecutor.clearSerpData) {
        toolExecutor.clearSerpData();
        console.log('🧹 Cleared existing SERP data from map');
        
        // Small delay to ensure map layers are properly removed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Execute the requested tool sequence
      const toolStartTime = performance.now();
      const results = await toolExecutor.executeMultipleTools(toolActions);
      const toolEndTime = performance.now();
      console.log(`⏱️ Total tool execution time: ${(toolEndTime - toolStartTime).toFixed(0)}ms`);
      
      console.log('Tool execution results:', results);
      
      // Store startup ecosystem data globally BEFORE processing Perplexity response
      // This ensures parseTableData has access to the data when it runs
      const serpResult = results.results.find(r => r.tool === 'SERP' && r.success);
      const osmResult = results.results.find(r => r.tool === 'OSM' && r.success);
      
      if (serpResult || osmResult) {
        // Store startup ecosystem data in a global variable for parseTableData to access
        window.lastStartupEcosystemData = {
          serp: serpResult ? {
            startupsCount: serpResult.data?.data?.startupsCount || 0,
            investorsCount: serpResult.data?.data?.investorsCount || 0,
            coWorkingSpaces: serpResult.data?.data?.coWorkingSpaces || 0,
            features: serpResult.data?.data?.features || []
          } : null,
          osm: osmResult ? {
            universitiesCount: osmResult.data?.data?.universitiesCount || 0,
            officesCount: osmResult.data?.data?.officesCount || 0,
            transportationAccess: osmResult.data?.data?.transportationAccess || 'Unknown',
            parksCount: osmResult.data?.data?.parksCount || 0,
            features: osmResult.data?.data?.features || []
          } : null,
          timestamp: Date.now()
        };
        
      }
      
      // Check if Perplexity analysis is available and update response
      const processingStartTime = performance.now();
      const perplexityResult = results.results.find(r => r.tool === 'PERPLEXITY' && r.success);
      if (perplexityResult) {
        
        // Handle different data structures (dual analysis vs original)

        // Check for Perplexity analysis in data field (nested structure)
        if (typeof perplexityResult.data === 'string') {
          perplexityAnalysis = perplexityResult.data;
          perplexityCitations = perplexityResult.citations || [];
          dataSources = perplexityResult.dataSourcesUsed || [];
          console.log('🎯 Using Perplexity analysis from data field (simple flow)');
        } else if (perplexityResult.data && typeof perplexityResult.data.data === 'string') {
          perplexityAnalysis = perplexityResult.data.data;
          perplexityCitations = perplexityResult.data.citations || perplexityResult.citations || [];
          dataSources = perplexityResult.data.dataSourcesUsed || perplexityResult.dataSourcesUsed || [];
          console.log('🎯 Using Perplexity analysis from nested data.data field');
        } else if (perplexityResult.data && perplexityResult.data.data && typeof perplexityResult.data.data.data === 'string') {
          perplexityAnalysis = perplexityResult.data.data.data;
          perplexityCitations = perplexityResult.data.data.citations || perplexityResult.data.citations || perplexityResult.citations || [];
          dataSources = perplexityResult.data.data.dataSourcesUsed || perplexityResult.data.dataSourcesUsed || perplexityResult.dataSourcesUsed || [];
        }

        // Debug: Perplexity analysis structure (only log on error)
        
        if (perplexityAnalysis) {
          // Create enhanced response with data source information
          const enhancedResponse = dataSources.length > 0 
            ? `${perplexityAnalysis}\n\n---\n\n**Analysis Based On:**\n${dataSources.map(source => 
                `• ${source.name} (${source.features} ${source.type.toLowerCase()} features within ${source.radius})`
              ).join('\n')}`
            : perplexityAnalysis;
          
          // Update the response display with Perplexity results
          updateResponseOnly(queryId, enhancedResponse, perplexityCitations, false);
          
          console.log('✅ Updated response with Perplexity analysis');
        } else {
          console.log('⚠️ Perplexity result found but no analysis content available');
        }
      } else {
        console.log('⚠️ No Perplexity analysis available, keeping original response');
      }
      
      const processingEndTime = performance.now();
      console.log(`⏱️ Data processing time: ${(processingEndTime - processingStartTime).toFixed(0)}ms`);
      
      // Cache the complete workflow for future use
      const workflowData = {
        questionId: 'startup_ecosystem_analysis', // Default question ID for ecosystem analysis
        toolResults: results.results,
        finalResponse: perplexityAnalysis || 'Analysis completed',
        citations: perplexityCitations || [],
        dataSources: dataSources,
        executionTime: processingEndTime - processingStartTime,
        timestamp: Date.now(),
        locationKey: locationKey,
        coordinates: coordinates
      };
      
      // Store in workflow cache
      console.log('🔍 Storing workflow cache:', {
        questionId: 'startup_ecosystem_analysis',
        simpleLocationKey: simpleLocationKey
      });
      
      setWorkflowCache('startup_ecosystem_analysis', simpleLocationKey, coordinates, workflowData);
      console.log('💾 Workflow cached for future use:', {
        questionId: 'startup_ecosystem_analysis',
        simpleLocationKey: simpleLocationKey,
        toolResults: workflowData.toolResults?.length || 0
      });
      
      if (results.hasFailures) {
        console.warn('Some tools failed:', results.errors);
      }
      
      return results;
    } catch (error) {
      console.error('Tool execution failed:', error);
      
      // Show error feedback
      updateToolFeedback({
        isActive: true,
        tool: 'error',
        status: 'Tool execution failed',
        progress: 100,
        details: `Error: ${error.message}`
      });
      
      // Auto-hide error feedback after 5 seconds
      setTimeout(() => {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: '',
          timestamp: null
        });
      }, 5000);
      
      throw error;
    }
  };

  // Clear cache function
  const clearCache = () => {
    const cacheSize = Object.keys(responseCache).length;
    setResponseCache({});
    console.log('Cache cleared - removed', cacheSize, 'responses');
    console.log('API calls saved:', cacheSize);
  };

  // Function to add a response directly (for MCP search results, etc.)
  const addResponse = useCallback((responseData) => {
    setResponses(prev => [...prev, responseData]);
  }, []);

  // Fly to location and re-animate marker (for location search card circle button)
  const onLocationFlyTo = useCallback((coords, displayName = '', options = {}) => {
    const m = map?.current;
    if (!m || !Array.isArray(coords) || coords.length < 2) return;
    const [lng, lat] = coords;
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;
    const radiusMiles = Number.isFinite(Number(options?.radiusMiles)) && Number(options.radiusMiles) > 0
      ? Number(options.radiusMiles)
      : null;
    if (radiusMiles) {
      const circlePoly = turf.circle([lng, lat], radiusMiles, { steps: 64, units: 'miles' });
      const bbox = turf.bbox(circlePoly);
      m.fitBounds(bbox, {
        padding: isMobileViewport
          ? { top: 20, right: 24, bottom: 320, left: 24 }
          : { top: 40, right: 40, bottom: 40, left: 40 },
        duration: 1000,
        maxZoom: 11
      });
    } else {
      m.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1000,
        offset: [0, isMobileViewport ? -150 : -80]
      });
    }
    animateLocationSearchMarker(m, lng, lat, displayName);
  }, [map]);

  return {
    // State
    isLoading,
    responses,
    citations,
    pendingRequests,
    responseCache,
    
    // Functions
    handleAIQuery,
    updateResponseOnly,
    clearCache,
    executeStartupEcosystemTools,
    addResponse, // New function to add responses directly
    onLocationFlyTo, // Fly to + animate for location search card
    
    // Utilities
    addPendingRequest,
    removePendingRequest
  };
};
