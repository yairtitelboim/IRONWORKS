import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import FeasibilityVerdictCard from './FeasibilityVerdictCard';
import LocationFocusBlock from './LocationFocusBlock';
import NearbyDataCenterCarousel from './NearbyDataCenterCarousel';
import Opposition from './opposition';
import { createOncePerKeyEmitter, logEvent } from '../../../../services/analyticsApi';
import {
  fetchTexasDataCentersAddressSearchIndex,
  fetchFacilityLatestSignals,
  fetchFacilitySignalLinks
} from '../../../../utils/texasDataCentersDataset';
import {
  deriveTexasDataCenterStatus,
  formatTexasDataCenterStatusLabel
} from '../../../../utils/texasDataCenterStatus';

const SEARCH_MARKET_RADIUS_OPTIONS_MI = [15, 25, 50];
const DEFAULT_SEARCH_MARKET_RADIUS_MI = SEARCH_MARKET_RADIUS_OPTIONS_MI[1];
const DEFAULT_OPPOSITION_CLUSTER_RADIUS_MI = DEFAULT_SEARCH_MARKET_RADIUS_MI;
const SHARE_INSIGHT_TEMPLATE_ID = 'opposition_brief_v1';
const SELECTED_STORY_STORAGE_KEY = 'pha_selected_story_title';
const SELECTED_STORY_SITE_STORAGE_KEY = 'pha_selected_story_site';
const LOCATION_OVERRIDE_STORAGE_KEY = 'pha_location_override';
const normalizeMarketFacilityKeyPart = (value) => String(value || '').trim().toLowerCase();

const getOppositionColor = (dataCenterCount) => {
  if (dataCenterCount == null) return '#9ca3af';
  if (dataCenterCount === 0) return '#22c55e';
  if (dataCenterCount <= 2) return '#f59e0b';
  return '#ef4444';
};

function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (target <= 0) {
      setDisplay(0);
      return undefined;
    }

    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setDisplay(target);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

const CONGESTION_LEVELS = [
  { max: 6, label: 'Low', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
  { max: 14, label: 'Moderate', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  { max: 25, label: 'High', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  { max: Infinity, label: 'Critical', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' }
];

const getCongestion = (activeCount) => CONGESTION_LEVELS.find((level) => activeCount <= level.max) || CONGESTION_LEVELS[1];
const getQueueStatusLabel = (status) => {
  if (status === 'ready') return 'Ready';
  if (status === 'pending') return 'Pending';
  if (status === 'fallback') return 'Fallback';
  return 'Preliminary';
};

const buildSyntheticSiteFromDataCenter = (payload) => {
  if (!payload) return null;
  const coordinates = Array.isArray(payload?._coordinates) ? payload._coordinates : null;
  const lng = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    projectId: payload.project_id || null,
    displayName: payload.display_name || payload.project_name || payload.company || 'Selected data center',
    lat,
    lng,
    status: payload.status_label || payload.status || 'unknown',
    statusLabel: payload.status_label || null,
    owner: payload.company_name || payload.company || null,
    location: payload.location_label || payload.location || payload.city || null,
    city: payload.city || null,
    county: payload.county || null,
    sizeMw: Number.isFinite(Number(payload.total_mw)) ? Number(payload.total_mw) : null,
    plannedMw: Number.isFinite(Number(payload.planned_mw)) ? Number(payload.planned_mw) : null,
    totalMw: Number.isFinite(Number(payload.total_mw)) ? Number(payload.total_mw) : null,
    installedMw: Number.isFinite(Number(payload.installed_mw)) ? Number(payload.installed_mw) : null,
    sourceCount: Number.isFinite(Number(payload.source_count)) ? Number(payload.source_count) : null,
    probabilityScore: payload.probability_score || null,
    dataSource: payload.data_source || null,
    type: payload.type || null,
    typeLabel: payload.type_label || null,
    tenant: payload.tenant || null,
    powerSource: payload.power_source || null,
    articleTitle: payload.latest_signal_title || payload.article_title || payload.articleTitle || null,
    sourceUrl: payload.latest_signal_url || payload.source_url || payload.sourceUrl || null,
    sourceName: payload.latest_signal_source || payload.source_name || null,
    publishedAt: payload.latest_signal_published_at || payload.published_at || null,
    announcedDate: payload.announced_date || payload.announcedDate || null
  };
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

const normalizePlaceKey = (value) => {
  const text = String(value || '')
    .toLowerCase()
    .replace(/\b(texas|tx|united states|usa)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
};

const LocationSearchCard = ({
  responseMetadata,
  onLocationFlyTo = null,
  onExitMobileFullscreen = null,
  isTexasSupportedAddress = true,
  texasSupportNote = 'Currently supporting Texas locations only. Try a TX address.'
}) => {
  const [powerAnalysis, setPowerAnalysis] = useState(null);
  const [showPowerAnalysis, setShowPowerAnalysis] = useState(false);
  const [showInlineSubAnalysis, setShowInlineSubAnalysis] = useState(false);
  const [chartView, setChartView] = useState('capacity');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [gasLinesVisible, setGasLinesVisible] = useState(true);
  const [expandedTile, setExpandedTile] = useState(null);
  const [nearbySites, setNearbySites] = useState([]);
  const [allNearbySites, setAllNearbySites] = useState([]);
  const [nearbySitesLoading, setNearbySitesLoading] = useState(false);
  const [selectedNearbyProjectId, setSelectedNearbyProjectId] = useState(null);
  const [selectedNearbySite, setSelectedNearbySite] = useState(null);
  const [promotedFocusSite, setPromotedFocusSite] = useState(null);
  const [selectedHeadlineTitle, setSelectedHeadlineTitle] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(SELECTED_STORY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [selectedHeadlineSite, setSelectedHeadlineSite] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SELECTED_STORY_SITE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [flippedCarouselSiteKey, setFlippedCarouselSiteKey] = useState(null);
  const [highlightCarouselSiteKey, setHighlightCarouselSiteKey] = useState(null);
  const [powerCircleRadiusMiles, setPowerCircleRadiusMiles] = useState(null);
  const [forceOpenClusterToken, setForceOpenClusterToken] = useState(0);
  const [latestSelectedDataCenter, setLatestSelectedDataCenter] = useState(null);
  const [showPencilSite, setShowPencilSite] = useState(false);
  const [pencilRentPerKwMo, setPencilRentPerKwMo] = useState(14);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareInsightPreview, setShowShareInsightPreview] = useState(false);
  const [shareInsightPreviewText, setShareInsightPreviewText] = useState('');
  const [shareInsightCopySuccess, setShareInsightCopySuccess] = useState(false);
  const [recentStoryExpanded, setRecentStoryExpanded] = useState(false);
  const [locationOverride, setLocationOverride] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(LOCATION_OVERRIDE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }); // { lat, lng, displayName }
  const [pendingNearestClusterAutoOpen, setPendingNearestClusterAutoOpen] = useState(false);
  const skipNextLocationStateResetRef = useRef(false);
  const menuRef = useRef(null);
  const shareMenuRef = useRef(null);
  const seenRef = useRef(new Map());
  const nearbySectionRef = useRef(null);
  const pencilSectionRef = useRef(null);
  const insightSectionRef = useRef(null);
  const oppositionSectionRef = useRef(null);
  const verdictSectionRef = useRef(null);
  const lastAutoScrollKeyRef = useRef('');
  const powerAnalysisDisplayModeRef = useRef('top');
  const lastSelectedMarkerCenterRef = useRef(null);
  const lastDisplayNameRef = useRef('');
  const lastBaseDisplayNameRef = useRef('');
  const lastBaseCoordsRef = useRef('');

  const coords = responseMetadata?.coordinates || [];
  const [baseLng, baseLat] = coords;
  const baseDisplayName = responseMetadata?.displayName || responseMetadata?.query || '';
  const baseCoordStr = baseLat != null && baseLng != null ? `${Number(baseLat).toFixed(4)}, ${Number(baseLng).toFixed(4)}` : '';
  const lng = locationOverride?.lng ?? baseLng;
  const lat = locationOverride?.lat ?? baseLat;
  const displayName = locationOverride?.displayName || baseDisplayName;
  const coordStr = lat != null && lng != null ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : '';
  const sourceLabel = responseMetadata?.source ? String(responseMetadata.source).replace(/_/g, ' ') : 'OpenStreetMap';
  const updatedAt = responseMetadata?.timestamp
    ? new Date(responseMetadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const queueMetrics = responseMetadata?.queueMetrics || null;
  const queueMetricsStatus = responseMetadata?.queueMetricsStatus || 'fallback';
  const hasRealQueueMetrics = queueMetricsStatus === 'ready' && Number.isFinite(Number(queueMetrics?.activeQueueCount));
  const isTexasSupported = Boolean(isTexasSupportedAddress);
  const responseQuery = responseMetadata?.query || '';
  const persistedSelectedDataCenter = useMemo(() => {
    const isTexasDataCenterDetail = responseMetadata?.responseType === 'texas_data_center_detail';
    const metadataProps = responseMetadata?.properties;
    const metadataCoords = Array.isArray(responseMetadata?.coordinates) ? responseMetadata.coordinates : null;
    if (
      isTexasDataCenterDetail &&
      metadataProps &&
      (metadataProps.project_id || metadataProps.project_name || metadataProps.company)
    ) {
      return {
        ...metadataProps,
        _coordinates: metadataCoords || metadataProps._coordinates || null
      };
    }
    if (isTexasDataCenterDetail && typeof window !== 'undefined') {
      const fallback = window.__lastSelectedTexasDataCenterCardPayload;
      if (fallback?.properties) {
        return {
          ...fallback.properties,
          _coordinates: Array.isArray(fallback.coordinates) ? fallback.coordinates : fallback.properties._coordinates || null
        };
      }
    }
    return null;
  }, [responseMetadata]);

  const previewModel = useMemo(() => {
    const latSeed = lat != null ? Math.abs(Math.round(Number(lat) * 1000)) : 0;
    const lngSeed = lng != null ? Math.abs(Math.round(Number(lng) * 1000)) : 0;
    const nameSeed = displayName.length * 17;
    const seed = latSeed + lngSeed + nameSeed;

    const activeQueue = (seed % 17) + 5;
    const totalQueue = activeQueue + (seed % 31) + 12;
    const activeMw = activeQueue * 42 + (seed % 220) + 80;
    const nearestSubDistanceMi = (((seed % 55) + 10) / 10).toFixed(1);
    const countyNetMw = (seed % 2 === 0 ? 1 : -1) * ((seed % 900) + 80);
    const countyType = countyNetMw >= 0 ? 'producer' : 'consumer';
    const dataCenters = (seed % 10) + 2;
    const announcedCenters = Math.max(1, Math.round(dataCenters * 0.35));

    return {
      activeQueue,
      totalQueue,
      activeMw,
      nearestSubDistanceMi,
      countyNetMw,
      countyType,
      dataCenters,
      announcedCenters,
      queueWithdrawn: Math.max(1, Math.floor(totalQueue * 0.25)),
      queueCompleted: Math.max(1, Math.floor(totalQueue * 0.2))
    };
  }, [displayName, lat, lng]);
  const modeledQueueWithdrawnCount = Number(previewModel?.queueWithdrawn ?? 0);
  const modeledQueueTotalCount = Number(previewModel?.totalQueue ?? 0);
  const modeledBlockedRate = modeledQueueTotalCount > 0
    ? (modeledQueueWithdrawnCount / modeledQueueTotalCount) * 100
    : null;

  const formatCompactNumber = (value) => Number(value || 0).toLocaleString();
  const formatPct = (value) => (value == null || Number.isNaN(Number(value)) ? 'n/a' : `${Number(value).toFixed(1)}%`);
  const formatMultiplier = (value) => (value == null || !Number.isFinite(Number(value)) ? null : `${Number(value).toFixed(1)}x`);

  const previewMetrics = useMemo(() => [
    (() => {
      const count = hasRealQueueMetrics ? Number(queueMetrics.activeQueueCount) : previewModel.activeQueue;
      const avg = hasRealQueueMetrics
        ? Number(queueMetrics.ercotAvgActiveQueueCount ?? queueMetrics.ercotAverageActiveQueueCount ?? 275)
        : null;
      const mult = hasRealQueueMetrics && Number.isFinite(avg) && avg > 0
        ? (count / avg).toFixed(1)
        : null;
      return {
        label: 'Active Queue',
        textValue: mult ? `${mult}x` : null,
        textSuffix: mult ? 'ERCOT avg' : null,
        value: mult ? null : count,
        unit: '',
        sublabel: hasRealQueueMetrics
          ? `${formatCompactNumber(count)} projects · ${formatCompactNumber(Math.round(queueMetrics.activeQueueMw || 0))} MW`
          : `${previewModel.totalQueue} total · ${previewModel.activeMw} MW in queue`,
        color: '#fca5a5',
        bg: 'rgba(239, 68, 68, 0.09)'
      };
    })(),
    (() => {
      const dist = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics.nearestSubDistanceMi))
        ? Number(queueMetrics.nearestSubDistanceMi)
        : Number(previewModel.nearestSubDistanceMi);
      const name = hasRealQueueMetrics && queueMetrics.nearestSubName
        ? queueMetrics.nearestSubName : null;
      const kv = hasRealQueueMetrics && queueMetrics.nearestSubVoltageKv
        ? queueMetrics.nearestSubVoltageKv : null;
      const poiCount = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics.nearestSubPoiCount))
        ? Number(queueMetrics.nearestSubPoiCount) : null;
      const poiPart = poiCount > 0 ? `${poiCount} projects targeting this sub` : null;
      const sublabelParts = [kv ? `${kv} kV` : null, poiPart].filter(Boolean);
      return {
        label: 'Nearest Sub',
        textValue: name ? `${dist} mi` : null,
        textSuffix: name || null,
        value: name ? null : dist,
        unit: name ? '' : 'mi',
        sublabel: hasRealQueueMetrics
          ? sublabelParts.join(' — ') || name || 'Nearest substation'
          : 'Run circle analysis for exact station match',
        color: '#93c5fd',
        bg: 'rgba(59, 130, 246, 0.08)'
      };
    })(),
    (() => {
      const cType = (hasRealQueueMetrics ? queueMetrics.countyType : previewModel.countyType) || 'producer';
      return {
        label: hasRealQueueMetrics && queueMetrics.countyName
          ? `${queueMetrics.countyName} County`
          : 'County Type',
        textValue: cType.charAt(0).toUpperCase() + cType.slice(1),
        value: null,
        unit: '',
        sublabel: hasRealQueueMetrics
          ? `${formatCompactNumber(Math.round(Number(queueMetrics.netMw || 0)))} MW net capacity`
          : `${formatCompactNumber(Math.abs(previewModel.countyNetMw))} MW net capacity`,
        color: cType === 'producer' ? '#86efac' : '#fca5a5',
        bg: cType === 'producer' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'
      };
    })(),
    {
      label: 'Data Centers',
      value: hasRealQueueMetrics && Number.isFinite(Number(queueMetrics.dataCenterCount))
        ? Number(queueMetrics.dataCenterCount)
        : previewModel.dataCenters,
      unit: '',
      sublabel: hasRealQueueMetrics && Number.isFinite(Number(queueMetrics.dataCenterCount))
        ? `${Math.round(Number(queueMetrics.dataCenterAnnouncedCount || 0))} announced nearby`
        : `${previewModel.announcedCenters} announced nearby`,
      color: '#c4b5fd',
      bg: 'rgba(139, 92, 246, 0.08)'
    },
    (() => {
      const lo = hasRealQueueMetrics ? queueMetrics.estWaitMonthsLow : null;
      const hi = hasRealQueueMetrics ? queueMetrics.estWaitMonthsHigh : null;
      const src = hasRealQueueMetrics ? queueMetrics.estWaitSource : null;
      const hasWait = Number.isFinite(Number(lo)) && Number.isFinite(Number(hi));
      return {
        label: 'Est. Wait',
        textValue: hasWait ? `${lo}–${hi} mo` : null,
        textSuffix: null,
        value: hasWait ? null : '—',
        unit: '',
        sublabel: hasWait
          ? `Based on queue depth & clearance rate (${src === 'county' ? 'county' : 'ERCOT'} data)`
          : 'Waiting for queue metrics',
        color: '#fde68a',
        bg: 'rgba(253, 230, 138, 0.08)'
      };
    })()
  ], [previewModel, hasRealQueueMetrics, queueMetrics]);

  const queueBreakdown = useMemo(() => {
    if (hasRealQueueMetrics) {
      return {
        active: Math.max(1, Math.round(Number(queueMetrics.activeQueueCount || 1))),
        withdrawn: Math.max(1, Math.round(Number(queueMetrics.queueWithdrawnCount || 1))),
        completed: Math.max(1, Math.round(Number(queueMetrics.queueCompletedCount || 1)))
      };
    }
    return {
      active: previewModel.activeQueue,
      withdrawn: previewModel.queueWithdrawn,
      completed: previewModel.queueCompleted
    };
  }, [hasRealQueueMetrics, queueMetrics, previewModel]);

  const activeQueueCount = hasRealQueueMetrics ? Number(queueMetrics.activeQueueCount || 0) : previewModel.activeQueue;
  const ercotAvgActiveQueueCount = hasRealQueueMetrics
    ? Number(
        queueMetrics.ercotAvgActiveQueueCount ??
        queueMetrics.ercotAverageActiveQueueCount ??
        275
      )
    : null;
  const activeQueueVsErcot = hasRealQueueMetrics && Number.isFinite(ercotAvgActiveQueueCount) && ercotAvgActiveQueueCount > 0
    ? activeQueueCount / ercotAvgActiveQueueCount
    : null;
  const congestion = useMemo(() => getCongestion(activeQueueCount), [activeQueueCount]);
  const queueStatusLabel = useMemo(() => getQueueStatusLabel(queueMetricsStatus), [queueMetricsStatus]);
  const selectedHeadlineUrl = useMemo(() => {
    const raw = String(selectedHeadlineSite?.sourceUrl || '').trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : null;
  }, [selectedHeadlineSite?.sourceUrl]);
  const selectedHeadlineStories = useMemo(() => {
    const stories = [];
    const seen = new Set();
    const primaryTitle = String(selectedHeadlineSite?.articleTitle || selectedHeadlineTitle || '').trim();
    const primaryUrl = String(selectedHeadlineSite?.sourceUrl || '').trim();
    if (primaryTitle) {
      const key = primaryUrl || `title:${primaryTitle.toLowerCase()}`;
      seen.add(key);
      stories.push({
        title: primaryTitle,
        url: /^https?:\/\//i.test(primaryUrl) ? primaryUrl : null,
        source: selectedHeadlineSite?.sourceName || null,
        publishedAt: selectedHeadlineSite?.publishedAt || null,
        kind: 'latest'
      });
    }
    if (Array.isArray(selectedHeadlineSite?.signalLinks)) {
      selectedHeadlineSite.signalLinks.forEach((link) => {
        const title = String(link?.title || link?.domain || '').trim();
        const url = String(link?.url || '').trim();
        if (!title || !url) return;
        const key = url || `title:${title.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        stories.push({
          title,
          url: /^https?:\/\//i.test(url) ? url : null,
          source: link?.domain || null,
          publishedAt: link?.serper_date || null,
          kind: 'link'
        });
      });
    }
    return stories;
  }, [selectedHeadlineSite, selectedHeadlineTitle]);
  const selectedHeadlineDateLabel = useMemo(() => {
    const raw = String(selectedHeadlineSite?.publishedAt || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedHeadlineSite?.publishedAt]);
  const formatStoryDate = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);
  const nearestSubDistance = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.nearestSubDistanceMi))
    ? Number(queueMetrics.nearestSubDistanceMi)
    : Number(previewModel.nearestSubDistanceMi);
  const nearestSubVoltageKv = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.nearestSubVoltageKv))
    ? Number(queueMetrics.nearestSubVoltageKv)
    : null;
  const nearestSubOperator = hasRealQueueMetrics && queueMetrics?.nearestSubOperator && queueMetrics.nearestSubOperator !== 'Unknown'
    ? queueMetrics.nearestSubOperator
    : null;
  const nearestSubName = hasRealQueueMetrics && queueMetrics?.nearestSubName
    ? queueMetrics.nearestSubName
    : null;
  const waitLow = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.estWaitMonthsLow))
    ? Number(queueMetrics.estWaitMonthsLow)
    : null;
  const waitHigh = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.estWaitMonthsHigh))
    ? Number(queueMetrics.estWaitMonthsHigh)
    : null;
  const nearestSubPoiCount = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.nearestSubPoiCount))
    ? Number(queueMetrics.nearestSubPoiCount)
    : null;

  const verdict = useMemo(() => {
    if (queueMetricsStatus === 'pending') {
      return {
        label: 'Loading',
        reason: 'Loading county queue metrics for this location.',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.12)'
      };
    }
    if (!hasRealQueueMetrics) {
      return {
        label: 'Preliminary',
        reason: 'Showing deterministic preview while full metrics are unavailable.',
        color: '#cbd5e1',
        bg: 'rgba(148, 163, 184, 0.14)'
      };
    }

    const pressure = activeQueueVsErcot;
    const constrained = (pressure != null && pressure > 1.5) || (waitHigh != null && waitHigh >= 30) || (nearestSubPoiCount != null && nearestSubPoiCount >= 12);
    const strong = (pressure != null && pressure < 0.9) && (waitHigh != null && waitHigh <= 18) && (nearestSubPoiCount == null || nearestSubPoiCount < 5);

    if (strong) {
      return {
        label: 'High',
        reason: 'Lower queue pressure and shorter expected time-to-power.',
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.14)'
      };
    }
    if (constrained) {
      return {
        label: 'Low',
        reason: 'Queue pressure or expected delays are elevated for this site.',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.14)'
      };
    }
    return {
      label: 'Moderate',
      reason: 'Mixed signals across queue pressure, substation targeting, and wait time.',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.14)'
    };
  }, [queueMetricsStatus, hasRealQueueMetrics, activeQueueVsErcot, waitHigh, nearestSubPoiCount]);

  const effectiveVerdict = isTexasSupported
    ? verdict
    : {
        label: 'Texas Only',
        reason: texasSupportNote,
        color: '#f97316',
        bg: 'rgba(249,115,22,0.14)'
      };
  const effectiveQueueStatusLabel = isTexasSupported ? queueStatusLabel : 'Unsupported';

  const emitAnalyticsEvent = useCallback((eventName, payload = {}) => {
    if (typeof window === 'undefined') return;
    try {
      window.mapEventBus?.emit('analytics:event', {
        event: eventName,
        source: 'location_search_card',
        ...payload,
        timestamp: Date.now()
      });
    } catch {
      // Analytics should remain non-blocking.
    }
  }, []);

  // Deduped emitter: one log per (event, location) per 60s
  const emitOnce = useCallback(
    createOncePerKeyEmitter(seenRef, (eventName, payload) => logEvent(eventName, payload, 'location_search_card')),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // View tracking (mobile intent): fire only when section is actually seen (in viewport).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!coordStr) return undefined;

    const trackSectionView = (ref, eventName, extra = {}) => {
      const el = ref?.current;
      if (!el || typeof IntersectionObserver === 'undefined') return () => {};

      let viewTimer = null;
      let hasFired = false;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;

          if (isVisible && !hasFired) {
            clearTimeout(viewTimer);
            viewTimer = setTimeout(() => {
              if (hasFired) return;
              hasFired = true;
              const statusKey = String(effectiveQueueStatusLabel || '').toLowerCase();
              emitOnce(eventName, {
                coordStr,
                status: statusKey,
                verdict: effectiveVerdict?.label || null,
                isTexasSupported,
                ...extra,
              }, { key: `${coordStr}::${statusKey}`, ttlMs: 3600000 });
            }, 600);
          }

          if (!isVisible) {
            clearTimeout(viewTimer);
            viewTimer = null;
          }
        },
        { threshold: [0.55] }
      );

      observer.observe(el);
      return () => {
        clearTimeout(viewTimer);
        observer.disconnect();
      };
    };

    const cleanups = [
      trackSectionView(verdictSectionRef, 'verdict_section_viewed', { section: 'verdict' }),
      trackSectionView(oppositionSectionRef, 'opposition_section_viewed', { section: 'opposition' }),
    ];

    return () => {
      cleanups.forEach((fn) => {
        try { fn?.(); } catch { /* noop */ }
      });
    };
  }, [coordStr, effectiveQueueStatusLabel, effectiveVerdict?.label, isTexasSupported, emitOnce]);

  const copyText = useCallback(async (value) => {
    if (!value) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fall through to execCommand fallback
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }, []);

  const buildShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    if (lat != null) u.searchParams.set('lat', lat);
    if (lng != null) u.searchParams.set('lng', lng);
    return u.toString();
  }, [lat, lng]);

  const handleNearbyGo = useCallback((site, options = {}) => {
    const { syncCarouselSelection = true } = options;
    if (!site) return;
    const hasCoords = site?.lat != null
      && site?.lng != null
      && Number.isFinite(Number(site.lat))
      && Number.isFinite(Number(site.lng))
      && Number(site.lat) !== 0
      && Number(site.lng) !== 0;
    if (syncCarouselSelection) {
      setSelectedNearbyProjectId(site.projectId || `${site.lat},${site.lng}`);
    }
    setSelectedNearbySite(site);
    if (hasCoords) {
      onLocationFlyTo?.([site.lng, site.lat], site.displayName);
    }
    if (hasCoords && typeof window !== 'undefined' && window.mapEventBus) {
      window.mapEventBus.emit('location-search:ring:show', {
        center: [site.lng, site.lat],
        radiusMiles: DEFAULT_SEARCH_MARKET_RADIUS_MI,
        color: oppositionColorRef.current,
        source: 'location_search'
      });
      if (site.projectId) {
        window.mapEventBus.emit('data-center:show-popup', {
          project_id: site.projectId,
          source: 'nearby_data_center_carousel',
          suppressCardSync: true
        });
      }
    }
    emitAnalyticsEvent('nearby_site_clicked', {
      rank: site.rank,
      distanceMi: site.distanceMi,
      displayName: site.displayName,
      status: site.status,
      sizeMw: site.sizeMw,
      owner: site.owner,
      projectId: site.projectId,
      lat: site.lat,
      lng: site.lng,
    });
  }, [onLocationFlyTo, emitAnalyticsEvent]);

  const scrollSectionIntoView = useCallback((sectionNode) => {
    if (!sectionNode || typeof window === 'undefined') return;
    let current = sectionNode.parentElement;
    while (current) {
      const styles = window.getComputedStyle(current);
      const overflowY = styles.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
      if (canScroll) {
        const parentRect = current.getBoundingClientRect();
        const sectionRect = sectionNode.getBoundingClientRect();
        const delta = sectionRect.top - parentRect.top - 18;
        if (Math.abs(delta) > 3) {
          current.scrollBy({ top: delta, behavior: 'smooth' });
        }
        return;
      }
      current = current.parentElement;
    }
  }, []);

  const scrollSectionToRevealBottom = useCallback((sectionNode, extraPadding = 20) => {
    if (!sectionNode || typeof window === 'undefined') return;
    let current = sectionNode.parentElement;
    while (current) {
      const styles = window.getComputedStyle(current);
      const overflowY = styles.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
      if (canScroll) {
        const parentRect = current.getBoundingClientRect();
        const sectionRect = sectionNode.getBoundingClientRect();
        const overflowBottom = sectionRect.bottom - parentRect.bottom + extraPadding;
        if (overflowBottom > 0) {
          current.scrollBy({ top: overflowBottom, behavior: 'smooth' });
        }
        return;
      }
      current = current.parentElement;
    }
  }, []);

  useEffect(() => {
    if (!flippedCarouselSiteKey) return undefined;
    const t1 = setTimeout(() => {
      scrollSectionToRevealBottom(nearbySectionRef.current, 24);
    }, 90);
    const t2 = setTimeout(() => {
      scrollSectionToRevealBottom(nearbySectionRef.current, 28);
    }, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [flippedCarouselSiteKey, scrollSectionToRevealBottom]);

  const triggerPowerCircleAnalysis = useCallback((options = {}) => {
    const {
      displayMode = 'top',
      skipActivate = false,
      center: centerOverride,
      address: addressOverride,
      source: triggerSource,
      radiusMiles: radiusMilesOverride
    } = options;
    const center = Array.isArray(centerOverride) && centerOverride.length >= 2
      ? [Number(centerOverride[0]), Number(centerOverride[1])]
      : [lng, lat];
    if (!Number.isFinite(Number(center[0])) || !Number.isFinite(Number(center[1]))) return;
    powerAnalysisDisplayModeRef.current = displayMode;
    if (displayMode === 'inline') {
      setShowInlineSubAnalysis(true);
      setShowPowerAnalysis(false);
    } else {
      setShowPowerAnalysis(true);
      setShowInlineSubAnalysis(false);
    }
    if (!skipActivate && window.mapEventBus) {
      window.mapEventBus.emit('power-circle:activate', {
        center,
        address: addressOverride || displayName,
        coordinates: center,
        source: 'location_search',
        radiusMiles: Number.isFinite(Number(radiusMilesOverride)) && Number(radiusMilesOverride) > 0
          ? Number(radiusMilesOverride)
          : undefined
      });
    }
  }, [lat, lng, displayName]);

  const handleFeasibilityRiskReview = useCallback(() => {
    setExpandedTile(0);
    scrollSectionIntoView(insightSectionRef.current);
    emitAnalyticsEvent('feasibility_risk_review_clicked');
  }, [scrollSectionIntoView, emitAnalyticsEvent]);

  const handleFeasibilityUnderwrite = useCallback(() => {
    setShowPencilSite(true);
    requestAnimationFrame(() => {
      scrollSectionIntoView(pencilSectionRef.current);
    });
    emitAnalyticsEvent('feasibility_underwrite_clicked');
  }, [scrollSectionIntoView, emitAnalyticsEvent]);

  const handleFeasibilityPrimaryAction = useCallback(() => {
    const verdictLabel = String(verdict?.label || '').toLowerCase();
    if (verdictLabel === 'low' || verdictLabel === 'high') {
      scrollSectionIntoView(nearbySectionRef.current);
    } else {
      setExpandedTile(0);
      scrollSectionIntoView(insightSectionRef.current);
    }
    emitAnalyticsEvent('feasibility_primary_cta_clicked', { verdict: verdictLabel });
  }, [verdict, scrollSectionIntoView, emitAnalyticsEvent]);

  const handleOppositionNearbyAction = useCallback(() => {
    scrollSectionIntoView(nearbySectionRef.current);
    emitAnalyticsEvent('opposition_nearby_clicked');
  }, [scrollSectionIntoView, emitAnalyticsEvent]);

  const getPreferredPowerCircleTarget = useCallback((options = {}) => {
    const strictForCluster = options?.strictForCluster === true;
    const preferSearchCenter = options?.preferSearchCenter === true;
    const selectedSiteSnapshot = options?.selectedSiteSnapshot;
    if (preferSearchCenter) {
      if (baseLat == null || baseLng == null) return null;
      return {
        center: [Number(baseLng), Number(baseLat)],
        address: baseDisplayName || displayName,
        reason: 'baseSearchCoordinatesPreferred'
      };
    }
    if (
      selectedSiteSnapshot &&
      Number.isFinite(Number(selectedSiteSnapshot?.lat)) &&
      Number.isFinite(Number(selectedSiteSnapshot?.lng))
    ) {
      return {
        center: [Number(selectedSiteSnapshot.lng), Number(selectedSiteSnapshot.lat)],
        address: selectedSiteSnapshot.displayName || displayName,
        reason: 'selectedSiteSnapshot'
      };
    }
    if (selectedNearbySite && Number.isFinite(Number(selectedNearbySite?.lat)) && Number.isFinite(Number(selectedNearbySite?.lng))) {
      return {
        center: [Number(selectedNearbySite.lng), Number(selectedNearbySite.lat)],
        address: selectedNearbySite.displayName || displayName,
        reason: 'selectedNearbySite'
      };
    }
    if (
      Array.isArray(latestSelectedDataCenter?._coordinates) &&
      latestSelectedDataCenter._coordinates.length >= 2 &&
      Number.isFinite(Number(latestSelectedDataCenter._coordinates[0])) &&
      Number.isFinite(Number(latestSelectedDataCenter._coordinates[1]))
    ) {
      return {
        center: [Number(latestSelectedDataCenter._coordinates[0]), Number(latestSelectedDataCenter._coordinates[1])],
        address: latestSelectedDataCenter?.project_name || latestSelectedDataCenter?.company || displayName,
        reason: 'latestSelectedDataCenter._coordinates'
      };
    }
    if (
      Array.isArray(lastSelectedMarkerCenterRef.current?.center) &&
      lastSelectedMarkerCenterRef.current.center.length >= 2 &&
      Number.isFinite(Number(lastSelectedMarkerCenterRef.current.center[0])) &&
      Number.isFinite(Number(lastSelectedMarkerCenterRef.current.center[1]))
    ) {
      return {
        center: [
          Number(lastSelectedMarkerCenterRef.current.center[0]),
          Number(lastSelectedMarkerCenterRef.current.center[1])
        ],
        address: lastSelectedMarkerCenterRef.current.address || displayName,
        reason: 'lastSelectedMarkerCenterRef'
      };
    }
    const globalStore = typeof window !== 'undefined' ? window.__lastTexasDataCenterPowerCircle : null;
    if (
      globalStore &&
      Array.isArray(globalStore.center) &&
      globalStore.center.length >= 2 &&
      Number.isFinite(Number(globalStore.center[0])) &&
      Number.isFinite(Number(globalStore.center[1]))
    ) {
      return {
        center: [Number(globalStore.center[0]), Number(globalStore.center[1])],
        address: globalStore.address || displayName,
        reason: 'window.__lastTexasDataCenterPowerCircle'
      };
    }
    if (strictForCluster) {
      return null;
    }
    if (lat == null || lng == null) return null;
    return {
      center: [lng, lat],
      address: displayName,
      reason: 'cardLatLngFallback'
    };
  }, [selectedNearbySite, latestSelectedDataCenter, lat, lng, displayName, baseLat, baseLng, baseDisplayName]);

  const handleOppositionClusterAction = useCallback((options = {}) => {
    const { forceActivate = false } = options;
    const circleAlreadyActive = powerCircleRadiusMiles != null;
    const target = getPreferredPowerCircleTarget({
      ...options,
      strictForCluster: options?.source === 'opposition_cluster_map_card'
    });
    if (!target?.center) {
      if (options?.source === 'opposition_cluster_map_card') {
        console.warn('[LocationSearchCard] CLUSTER_MAP aborted: no selected marker context yet');
      }
      return;
    }
    triggerPowerCircleAnalysis({
      displayMode: 'inline',
      skipActivate: !forceActivate && circleAlreadyActive,
      center: target.center,
      address: target.address,
      source: options?.source || 'opposition_cluster_map_card'
    });
    emitAnalyticsEvent('opposition_cluster_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent, powerCircleRadiusMiles, getPreferredPowerCircleTarget, selectedNearbySite, latestSelectedDataCenter]);

  const handleOpenClusterFromCarousel = useCallback(() => {
    setForceOpenClusterToken((prev) => prev + 1);
    handleOppositionClusterAction();
  }, [handleOppositionClusterAction]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return undefined;

    const handler = (payload = {}) => {
      if (payload?.source !== 'largest_tx_data_center_cluster') return;
      const skipPowerCircle = !!payload?.skipPowerCircle;
      const forcedRadius = Number(payload?.radius);
      const target = Array.isArray(payload?.coordinates) ? payload.coordinates : null;
      const targetLng = Number(target?.[0]);
      const targetLat = Number(target?.[1]);
      const hasTargetCoords = Number.isFinite(targetLng) && Number.isFinite(targetLat);
      const targetDisplayName = String(payload?.displayName || '').trim() || 'Texas Cluster Focus';

      // Keep LocationSearchCard state aligned with the cluster target so Opposition/Cluster actions
      // and radius labels use the same center the map just flew to.
      if (hasTargetCoords) {
        const nextOverride = {
          lat: targetLat,
          lng: targetLng,
          displayName: targetDisplayName
        };
        setLocationOverride(nextOverride);
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(LOCATION_OVERRIDE_STORAGE_KEY, JSON.stringify(nextOverride));
          } catch {
            // no-op
          }
        }
      }

      if (Number.isFinite(forcedRadius) && forcedRadius > 0) {
        setPowerCircleRadiusMiles(forcedRadius);
      }

      setForceOpenClusterToken((prev) => prev + 1);
      if (!skipPowerCircle) {
        handleOppositionClusterAction({ forceActivate: true });
      }
      if (!skipPowerCircle && window.mapEventBus && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        const center = hasTargetCoords ? [targetLng, targetLat] : [Number(lng), Number(lat)];
        setTimeout(() => {
          window.mapEventBus?.emit('power-circle:activate', {
            center,
            address: hasTargetCoords ? targetDisplayName : displayName,
            coordinates: center,
            source: 'location_search'
          });
        }, 220);
      }
    };

    window.mapEventBus.on('opposition:cluster-map:auto-open', handler);
    return () => {
      window.mapEventBus?.off('opposition:cluster-map:auto-open', handler);
    };
  }, [lat, lng, displayName, handleOppositionClusterAction]);

  const handleRequestMobileFullscreen = useCallback((payload = {}) => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;
    window.mapEventBus.emit('location-search:mobile-fullscreen', {
      expanded: true,
      source: 'carousel_expand_button',
      ...payload
    });
  }, []);

  const handleHeadlineClick = useCallback((site) => {
    if (!site) return;
    console.log('[LocationSearchCard] handleHeadlineClick received', {
      articleTitle: site?.articleTitle || null,
      projectId: site?.projectId || null,
      sourceUrl: site?.sourceUrl || null,
      lat: site?.lat ?? null,
      lng: site?.lng ?? null
    });
    const clickedHeadline = String(site.articleTitle || '').trim();
    const storySitePayload = {
      articleTitle: site.articleTitle || null,
      projectId: site.projectId || null,
      sourceUrl: site.sourceUrl || null,
      sourceName: site.sourceName || null,
      publishedAt: site.publishedAt || null,
      signalLinks: Array.isArray(site.signalLinks) ? site.signalLinks : [],
      lat: site.lat ?? null,
      lng: site.lng ?? null,
      displayName: site.displayName || null
    };
    const siteKey = site.projectId || `${site.lat},${site.lng}`;
    const matchInCarousel = nearbySites.find(
      (s) => (s.projectId && s.projectId === site.projectId) ||
        (Math.abs(Number(s.lat) - Number(site.lat)) < 1e-5 && Math.abs(Number(s.lng) - Number(site.lng)) < 1e-5)
    );
    const closestInCarousel = matchInCarousel || (nearbySites.length > 0
      ? nearbySites.reduce((best, s) => {
          const d = haversineMiles(Number(site.lat), Number(site.lng), Number(s.lat), Number(s.lng));
          return !best || d < best.d ? { site: s, d } : best;
        }, null)?.site
      : null);
    const targetSite = matchInCarousel || closestInCarousel || site;
    const targetKey = targetSite ? (targetSite.projectId || `${targetSite.lat},${targetSite.lng}`) : siteKey;
    // Match carousel "Expand" behavior: select/flip the card, then open fullscreen.
    setFlippedCarouselSiteKey(targetKey);
    setSelectedNearbyProjectId(targetKey);
    setSelectedNearbySite(targetSite);
    setSelectedHeadlineTitle(clickedHeadline);
    setSelectedHeadlineSite(storySitePayload);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(SELECTED_STORY_STORAGE_KEY, clickedHeadline);
        sessionStorage.setItem(SELECTED_STORY_SITE_STORAGE_KEY, JSON.stringify(storySitePayload));
      } catch {
        // no-op
      }
    }
    setHighlightCarouselSiteKey(null);
    handleNearbyGo(targetSite, { syncCarouselSelection: false });
    if (typeof window !== 'undefined') {
      // Wait a frame so mobile fullscreen opens with the target card already selected/flipped.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleRequestMobileFullscreen({
            source: 'opposition_headline_click',
            siteKey: targetKey
          });
        });
      });
    }
  }, [nearbySites, handleNearbyGo, handleRequestMobileFullscreen]);

  useEffect(() => {
    const previousDisplayName = lastDisplayNameRef.current;
    lastDisplayNameRef.current = displayName || '';
    // Preserve selected headline across remount/fullscreen transitions.
    // Only clear when the user actually searched/switched to a different place.
    if (!previousDisplayName || !displayName || previousDisplayName === displayName) return;
    setSelectedHeadlineTitle('');
    setSelectedHeadlineSite(null);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SELECTED_STORY_STORAGE_KEY);
        sessionStorage.removeItem(SELECTED_STORY_SITE_STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }, [displayName]);

  useEffect(() => {
    if (selectedHeadlineTitle) return;
    if (typeof window === 'undefined') return;
    try {
      const cached = sessionStorage.getItem(SELECTED_STORY_STORAGE_KEY) || '';
      if (cached) setSelectedHeadlineTitle(cached);
    } catch {
      // no-op
    }
  }, [selectedHeadlineTitle]);

  useEffect(() => {
    if (selectedHeadlineSite) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(SELECTED_STORY_SITE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed) setSelectedHeadlineSite(parsed);
    } catch {
      // no-op
    }
  }, [selectedHeadlineSite]);

  useEffect(() => {
    if (!selectedHeadlineTitle) return;
    console.log('[LocationSearchCard] selectedHeadlineTitle ready for render', {
      selectedHeadlineTitle,
      displayName
    });
  }, [selectedHeadlineTitle, displayName]);

  const handleOppositionBlockedAction = useCallback(() => {
    triggerPowerCircleAnalysis({ displayMode: 'inline' });
    emitAnalyticsEvent('opposition_blocked_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent]);

  const handleOppositionSequenceAction = useCallback(() => {
    triggerPowerCircleAnalysis({ displayMode: 'inline' });
    emitAnalyticsEvent('opposition_sequence_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent]);

  const handleFeasibilityQueueAction = useCallback(() => {
    triggerPowerCircleAnalysis({ displayMode: 'inline' });
    emitAnalyticsEvent('feasibility_queue_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent]);

  const handleFeasibilitySubAction = useCallback(() => {
    triggerPowerCircleAnalysis({ displayMode: 'inline' });
    emitAnalyticsEvent('feasibility_sub_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent]);

  const handleFeasibilityWaitAction = useCallback(() => {
    triggerPowerCircleAnalysis({ displayMode: 'inline' });
    emitAnalyticsEvent('feasibility_wait_action_clicked');
  }, [triggerPowerCircleAnalysis, emitAnalyticsEvent]);

  const oppositionCircleStats = useMemo(() => {
    const rawRadius = Number(powerCircleRadiusMiles);
    const radius = Number.isFinite(rawRadius) && rawRadius > 0 ? rawRadius : DEFAULT_OPPOSITION_CLUSTER_RADIUS_MI;
    const hasRadius = Number.isFinite(radius) && radius > 0;
    const sourceSites = Array.isArray(allNearbySites) ? [...allNearbySites] : [];

    const circleCenter = (typeof window !== 'undefined' && window.__lastTexasDataCenterPowerCircle?.center)
      ? window.__lastTexasDataCenterPowerCircle.center
      : (lastSelectedMarkerCenterRef.current?.center ?? null);
    const useCircleCenter = Array.isArray(circleCenter) && circleCenter.length >= 2
      && Number.isFinite(Number(circleCenter[1])) && Number.isFinite(Number(circleCenter[0]));
    const circleLat = useCircleCenter ? Number(circleCenter[1]) : null;
    const circleLng = useCircleCenter ? Number(circleCenter[0]) : null;

    if (selectedNearbySite?.lat != null && selectedNearbySite?.lng != null) {
      const alreadyInPool = sourceSites.some(
        (s) => s?.projectId === selectedNearbySite?.projectId
          || (Number(s?.lat) === Number(selectedNearbySite.lat) && Number(s?.lng) === Number(selectedNearbySite.lng))
      );
      if (!alreadyInPool) sourceSites.unshift(selectedNearbySite);
    } else if (latestSelectedDataCenter?._coordinates?.length >= 2) {
      const [mlng, mlat] = latestSelectedDataCenter._coordinates;
      const alreadyInPool = sourceSites.some(
        (s) => s?.projectId === latestSelectedDataCenter?.project_id
          || (Number(s?.lat) === Number(mlat) && Number(s?.lng) === Number(mlng))
      );
      if (!alreadyInPool) {
        sourceSites.unshift({
          lat: Number(mlat),
          lng: Number(mlng),
          distanceMi: 0,
          projectId: latestSelectedDataCenter.project_id,
          displayName: latestSelectedDataCenter.project_name || latestSelectedDataCenter.company || 'Data center',
          status: latestSelectedDataCenter.status,
          owner: latestSelectedDataCenter.company,
          location: latestSelectedDataCenter.city || latestSelectedDataCenter.location,
          totalMw: latestSelectedDataCenter.total_mw ?? latestSelectedDataCenter.size_mw,
          installedMw: latestSelectedDataCenter.installed_mw,
          articleTitle: latestSelectedDataCenter.article_title ?? latestSelectedDataCenter.articleTitle,
          sourceUrl: latestSelectedDataCenter.source_url ?? latestSelectedDataCenter.sourceUrl,
          announcedDate: latestSelectedDataCenter.announced_date ?? latestSelectedDataCenter.announcedDate,
          sourceCount: latestSelectedDataCenter.source_count,
          dataSource: latestSelectedDataCenter.data_source
        });
      }
    }

    if (!hasRadius || !sourceSites.length) {
      return {
        radiusMiles: hasRadius ? radius : null,
        inCircleCount: null,
        inCircleSites: [],
        mostRecentSite: null,
        totalTracked: sourceSites.length
      };
    }

    const inCircleSites = sourceSites
      .map((site) => {
        const distMi = useCircleCenter && circleLat != null && circleLng != null && site?.lat != null && site?.lng != null
          ? haversineMiles(circleLat, circleLng, Number(site.lat), Number(site.lng))
          : Number(site?.distanceMi);
        return { ...site, _distFromCircle: distMi };
      })
      .filter((site) => Number.isFinite(Number(site._distFromCircle)) && Number(site._distFromCircle) <= radius)
      .sort((a, b) => Number(a._distFromCircle) - Number(b._distFromCircle))
      .map(({ _distFromCircle, ...s }) => s);

    const mostRecentByDate = inCircleSites
      .filter((site) => site?.announcedDate)
      .sort((a, b) => new Date(b.announcedDate).getTime() - new Date(a.announcedDate).getTime())[0] || null;

    return {
      radiusMiles: radius,
      inCircleCount: inCircleSites.length,
      inCircleSites,
      mostRecentSite: mostRecentByDate || inCircleSites[0] || null,
      totalTracked: sourceSites.length
    };
  }, [powerCircleRadiusMiles, allNearbySites, selectedNearbySite, latestSelectedDataCenter]);
  const nearestDataCenterSite = useMemo(() => {
    if (!Array.isArray(allNearbySites) || allNearbySites.length === 0) return null;
    return allNearbySites.find((site) =>
      site?.lat != null
      && site?.lng != null
      && Number.isFinite(Number(site.lat))
      && Number.isFinite(Number(site.lng))
      && Number(site.lat) !== 0
      && Number(site.lng) !== 0
      && Number.isFinite(Number(site.distanceMi))
    ) || null;
  }, [allNearbySites]);
  const noDataCentersInCurrentRadius = useMemo(() => {
    if (!isTexasSupported || nearbySitesLoading) return false;
    const inRadiusCount = Number(oppositionCircleStats?.inCircleCount);
    if (!Number.isFinite(inRadiusCount)) return false;
    return inRadiusCount === 0 && Boolean(nearestDataCenterSite);
  }, [isTexasSupported, nearbySitesLoading, oppositionCircleStats?.inCircleCount, nearestDataCenterSite]);

  const buildShareInsightText = useCallback(() => {
    const locationLine = displayName || coordStr || 'Selected location';
    const verdictLine = effectiveVerdict?.label || 'Preliminary';
    const inCircleCount = Number(oppositionCircleStats?.inCircleCount);
    const radiusMiles = Number(oppositionCircleStats?.radiusMiles);
    const eventDate = (() => {
      const raw = responseMetadata?.timestamp;
      if (!raw) return new Date().toLocaleDateString('en-US');
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-US') : d.toLocaleDateString('en-US');
    })();
    const shortHeadline = (() => {
      const raw = String(selectedHeadlineTitle || '').trim();
      if (!raw) return 'No specific headline selected';
      return raw.length > 72 ? `${raw.slice(0, 69).trim()}...` : raw;
    })();
    const deepLink = buildShareUrl();
    const nearbyPressureLine = Number.isFinite(inCircleCount) && Number.isFinite(radiusMiles)
      ? `${inCircleCount} site${inCircleCount === 1 ? '' : 's'} within ${radiusMiles.toFixed(1)} mi`
      : 'Not enough data yet';

    return [
      `Switchyard insight — ${locationLine}`,
      `• Opposition: ${verdictLine} (${eventDate})`,
      `• Nearby pressure: ${nearbyPressureLine}`,
      `• Trigger: ${shortHeadline}`,
      `Explore: ${deepLink}`
    ].join('\n');
  }, [
    buildShareUrl,
    coordStr,
    displayName,
    effectiveVerdict?.label,
    oppositionCircleStats?.inCircleCount,
    oppositionCircleStats?.radiusMiles,
    responseMetadata?.timestamp,
    selectedHeadlineTitle
  ]);

  const handleCopyShareInsight = useCallback(async () => {
    if (!shareInsightPreviewText) return;
    const success = await copyText(shareInsightPreviewText);
    if (!success) {
      console.warn('[ShareInsight] preview_copy_failed', { displayName, coordStr });
      return;
    }
    logEvent('share_finding_copied', {
      templateId: SHARE_INSIGHT_TEMPLATE_ID,
      displayName,
      coordStr,
      verdict: effectiveVerdict?.label || null,
      inCircleCount: Number.isFinite(Number(oppositionCircleStats?.inCircleCount))
        ? Number(oppositionCircleStats.inCircleCount)
        : null
    }, 'location_search_card');
    setShareInsightCopySuccess(true);
    setTimeout(() => {
      setShareInsightCopySuccess(false);
      setShowShareInsightPreview(false);
    }, 1500);
  }, [
    coordStr,
    copyText,
    displayName,
    effectiveVerdict?.label,
    oppositionCircleStats?.inCircleCount,
    shareInsightPreviewText
  ]);

  const handleExpandFromOpposition = useCallback(() => {
    const target = selectedNearbySite || nearestDataCenterSite || null;
    if (target?.lat != null && target?.lng != null) {
      const nextOverride = {
        lat: target.lat,
        lng: target.lng,
        displayName: target.displayName || displayName
      };
      setLocationOverride(nextOverride);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(LOCATION_OVERRIDE_STORAGE_KEY, JSON.stringify(nextOverride));
        } catch {
          // no-op
        }
      }
    }
    console.log('[LocationSearchCard] expand from opposition', {
      targetDisplayName: target?.displayName || null,
      targetProjectId: target?.projectId || null,
      baseDisplayName
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        handleRequestMobileFullscreen({
          source: 'opposition_cluster_expand_button',
          projectId: target?.projectId || null
        });
      });
    });
  }, [selectedNearbySite, nearestDataCenterSite, displayName, baseDisplayName, handleRequestMobileFullscreen]);

  const handleJumpToNearestDataCenterArea = useCallback(() => {
    if (!nearestDataCenterSite) return;
    const nextOverride = {
      lat: nearestDataCenterSite.lat,
      lng: nearestDataCenterSite.lng,
      displayName: nearestDataCenterSite.displayName || 'Nearest data center area'
    };
    skipNextLocationStateResetRef.current = true;
    setLocationOverride(nextOverride);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(LOCATION_OVERRIDE_STORAGE_KEY, JSON.stringify(nextOverride));
      } catch {
        // no-op
      }
    }
    const nearestKey = nearestDataCenterSite.projectId || `${nearestDataCenterSite.lat},${nearestDataCenterSite.lng}`;
    setSelectedNearbyProjectId(nearestKey);
    setSelectedNearbySite(nearestDataCenterSite);
    setPromotedFocusSite(nearestDataCenterSite);
    setFlippedCarouselSiteKey(nearestKey);
    setHighlightCarouselSiteKey(null);
    setLatestSelectedDataCenter(null);
    setSelectedHeadlineTitle('');
    handleNearbyGo(nearestDataCenterSite);
    if (typeof window !== 'undefined' && window.mapEventBus) {
      window.mapEventBus.emit('power-circle:activate', {
        center: [nearestDataCenterSite.lng, nearestDataCenterSite.lat],
        address: nearestDataCenterSite.displayName,
        coordinates: [nearestDataCenterSite.lng, nearestDataCenterSite.lat],
        source: 'nearest_data_center_jump'
      });
    }
    // Open cluster once refreshed nearest-area context has loaded.
    setPendingNearestClusterAutoOpen(true);
    emitAnalyticsEvent('nearest_data_center_jump_clicked', {
      projectId: nearestDataCenterSite.projectId,
      displayName: nearestDataCenterSite.displayName,
      distanceMi: nearestDataCenterSite.distanceMi
    });
  }, [nearestDataCenterSite, handleNearbyGo, emitAnalyticsEvent, displayName, coordStr, noDataCentersInCurrentRadius, powerCircleRadiusMiles]);

  useEffect(() => {
    const prevBase = lastBaseDisplayNameRef.current;
    const prevCoords = lastBaseCoordsRef.current;
    lastBaseDisplayNameRef.current = baseDisplayName;
    lastBaseCoordsRef.current = baseCoordStr;
    const overrideMismatchesBase =
      !!locationOverride &&
      (
        (baseCoordStr && (
          Number(locationOverride?.lat) !== Number(baseLat) ||
          Number(locationOverride?.lng) !== Number(baseLng)
        )) ||
        (baseDisplayName && locationOverride?.displayName && locationOverride.displayName !== baseDisplayName)
      );
    // Clear marker override when the user's search actually changes (new address or new coords).
    const nameChanged = prevBase && baseDisplayName && prevBase !== baseDisplayName;
    const coordsChanged = prevCoords && baseCoordStr && prevCoords !== baseCoordStr;
    if (!nameChanged && !coordsChanged && !overrideMismatchesBase) return;
    setLocationOverride(null);
    setPendingNearestClusterAutoOpen(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(LOCATION_OVERRIDE_STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }, [baseDisplayName, baseCoordStr, locationOverride, baseLat, baseLng]);

  useEffect(() => {
    if (!pendingNearestClusterAutoOpen) return;
    if (nearbySitesLoading) return;
    if (noDataCentersInCurrentRadius) return;
    // Trigger after a micro-delay so Opposition sees refreshed props first.
    const t = setTimeout(() => {
      setForceOpenClusterToken((prev) => prev + 1);
      setPendingNearestClusterAutoOpen(false);
      console.log('[LocationSearchCard] nearest auto-open token incremented after data refresh');
    }, 120);
    return () => clearTimeout(t);
  }, [pendingNearestClusterAutoOpen, nearbySitesLoading, noDataCentersInCurrentRadius]);

  const oppositionColor = useMemo(() => {
    const count = oppositionCircleStats?.inCircleCount ?? 0;
    return getOppositionColor(count);
  }, [oppositionCircleStats?.inCircleCount]);

  const oppositionColorRef = useRef(oppositionColor);
  oppositionColorRef.current = oppositionColor;
  const emitAnalyticsEventRef = useRef(emitAnalyticsEvent);
  emitAnalyticsEventRef.current = emitAnalyticsEvent;

  useEffect(() => {
    if (!isTexasSupported) {
      setNearbySites([]);
      setAllNearbySites([]);
      setNearbySitesLoading(false);
      return undefined;
    }
    if (lat == null || lng == null) {
      setNearbySites([]);
      setAllNearbySites([]);
      setNearbySitesLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadNearbySites = async () => {
      setNearbySites([]);
      setAllNearbySites([]);
      setNearbySitesLoading(true);
      console.log('[LocationSearchCard] loadNearbySites start', {
        baseDisplayName,
        lat,
        lng
      });
      try {
        const response = await fetchTexasDataCentersAddressSearchIndex();
        if (!response.ok) {
          if (!cancelled) setNearbySites([]);
          return;
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('json') && !contentType.includes('geo+json')) {
          if (!cancelled) setNearbySites([]);
          return;
        }

        const [dataset, latestSignalsDataset, signalLinksDataset] = await Promise.all([
          response.json(),
          fetchFacilityLatestSignals().catch(() => null),
          fetchFacilitySignalLinks().catch(() => null)
        ]);
        const facilities = Array.isArray(dataset?.facilities) ? dataset.facilities : [];
        const latestSignalsByProjectId = latestSignalsDataset?.by_project_id || {};
        const signalLinksByProjectId = signalLinksDataset?.by_project_id || {};
        const basePlaceKey = normalizePlaceKey((baseDisplayName || responseMetadata?.query || '').split(',')[0]);

        const resolved = facilities
          .map((facility) => {
            const siteLat = facility?.latitude;
            const siteLng = facility?.longitude;
            const hasCoords = siteLat != null
              && siteLng != null
              && Number.isFinite(Number(siteLat))
              && Number.isFinite(Number(siteLng))
              && Number(siteLat) !== 0
              && Number(siteLng) !== 0;
            const distanceMi = hasCoords ? haversineMiles(lat, lng, Number(siteLat), Number(siteLng)) : null;
            const display = String(facility?.display_name || '').trim() || 'Data center project';
            const status = String(facility?.status_label || '').trim()
              || formatTexasDataCenterStatusLabel(deriveTexasDataCenterStatus(facility));
            const totalMw = Number(facility?.total_mw);
            const installedMw = Number(facility?.installed_mw);
            const projectId = facility?.project_id || null;
            const latestSignal = projectId ? latestSignalsByProjectId?.[projectId] : null;
            const signalLinks = projectId ? signalLinksByProjectId?.[projectId]?.links : null;
            const facilityCityKey = normalizePlaceKey(facility?.city);
            const facilityMarketKey = normalizePlaceKey(facility?.market);
            const isPlaceFallback = !hasCoords
              && basePlaceKey
              && (facilityCityKey === basePlaceKey || facilityMarketKey === basePlaceKey);
            const matchSource = hasCoords ? 'radius' : (isPlaceFallback ? 'place_fallback' : 'unmapped');

            return {
              lat: hasCoords ? Number(siteLat) : null,
              lng: hasCoords ? Number(siteLng) : null,
              distanceMi,
              projectId,
              displayName: display,
              status,
              owner: null,
              location: [facility?.city, facility?.county].filter(Boolean).join(', ') || facility?.city || facility?.county || null,
              sizeMw: Number.isFinite(totalMw) ? totalMw : null,
              totalMw: Number.isFinite(totalMw) ? totalMw : null,
              installedMw: Number.isFinite(installedMw) ? installedMw : null,
              plannedMw: Number.isFinite(Number(facility?.planned_mw)) ? Number(facility.planned_mw) : null,
              announcedDate: null,
              articleTitle: latestSignal?.headline || null,
              sourceUrl: latestSignal?.url || null,
              sourceName: latestSignal?.source || null,
              publishedAt: latestSignal?.published_at || null,
              latestSignalKind: latestSignal?.kind || null,
              latestSignalReason: latestSignal?.reason || null,
              latestSignalSummary: latestSignal?.summary || null,
              latestSignalGemini: latestSignal?.gemini || null,
              signalLinks: Array.isArray(signalLinks)
                ? signalLinks.filter((link) => link && link.excluded !== true)
                : [],
              sourceCount: null,
              probabilityScore: null,
              dataSource: 'address_search_index',
              statusConfidence: null,
              geocodeConfidence: null,
              city: facility?.city || null,
              county: facility?.county || null,
              tenant: facility?.tenant || null,
              endUser: facility?.end_user || null,
              powerSource: facility?.power_source || null,
              type: facility?.type || null,
              typeLabel: facility?.type_label || null,
              matchSource
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            const aDistance = Number.isFinite(Number(a.distanceMi)) ? Number(a.distanceMi) : Number.POSITIVE_INFINITY;
            const bDistance = Number.isFinite(Number(b.distanceMi)) ? Number(b.distanceMi) : Number.POSITIVE_INFINITY;
            return aDistance - bDistance;
          });

        const nearbyResolved = resolved
          .filter((site) => site.matchSource === 'radius')
          .slice(0, 12)
          .map((site, index) => ({ ...site, rank: index + 1 }));

        if (!cancelled) {
          setAllNearbySites(resolved);
          setNearbySites(nearbyResolved);
          console.log('[LocationSearchCard] loadNearbySites resolved', {
            baseDisplayName,
            resolvedCount: resolved.length,
            nearbyResolvedCount: nearbyResolved.length,
            firstNearby: nearbyResolved.slice(0, 5).map((site) => ({
              displayName: site?.displayName || null,
              city: site?.city || null,
              distanceMi: site?.distanceMi ?? null,
              matchSource: site?.matchSource || null
            }))
          });
          emitAnalyticsEventRef.current?.('nearby_sites_shown', { count: nearbyResolved.length, source: 'texas_data_centers' });
        }
      } catch {
        if (!cancelled) {
          setNearbySites([]);
          setAllNearbySites([]);
        }
      } finally {
        if (!cancelled) setNearbySitesLoading(false);
      }
    };

    void loadNearbySites();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, isTexasSupported, baseDisplayName, responseQuery]);

  useEffect(() => {
    if (skipNextLocationStateResetRef.current) {
      skipNextLocationStateResetRef.current = false;
      return;
    }
    setExpandedTile(null);
    setSelectedNearbyProjectId(null);
    setSelectedNearbySite(null);
    setPromotedFocusSite(null);
    setPowerCircleRadiusMiles(null);
    setLatestSelectedDataCenter(null);
  }, [displayName, coordStr]);

  useEffect(() => {
    if (selectedNearbySite || latestSelectedDataCenter || !persistedSelectedDataCenter) return;
    const syntheticSite = buildSyntheticSiteFromDataCenter(persistedSelectedDataCenter);
    setLatestSelectedDataCenter(persistedSelectedDataCenter);
    if (syntheticSite) {
      setSelectedNearbySite(syntheticSite);
      if (syntheticSite.projectId) {
        setSelectedNearbyProjectId(syntheticSite.projectId);
      }
    }
  }, [persistedSelectedDataCenter, selectedNearbySite, latestSelectedDataCenter]);

  const resolvedSelectedNearbySite = useMemo(() => {
    if (selectedNearbySite) return selectedNearbySite;
    if (promotedFocusSite) return promotedFocusSite;
    const pool = [
      ...(Array.isArray(nearbySites) ? nearbySites : []),
      ...(Array.isArray(allNearbySites) ? allNearbySites : [])
    ];
    if (pool.length === 0) return null;

    if (selectedNearbyProjectId) {
      const byProjectId = pool.find((site) => site?.projectId && site.projectId === selectedNearbyProjectId);
      if (byProjectId) return byProjectId;
      const byCoordinateKey = pool.find((site) => `${site?.lat},${site?.lng}` === selectedNearbyProjectId);
      if (byCoordinateKey) return byCoordinateKey;
    }

    if (locationOverride && Number.isFinite(Number(locationOverride?.lat)) && Number.isFinite(Number(locationOverride?.lng))) {
      const overrideLat = Number(locationOverride.lat);
      const overrideLng = Number(locationOverride.lng);
      const byOverrideCoords = pool.find((site) =>
        Math.abs(Number(site?.lat) - overrideLat) < 1e-5
        && Math.abs(Number(site?.lng) - overrideLng) < 1e-5
      );
      if (byOverrideCoords) return byOverrideCoords;
    }

    return null;
  }, [selectedNearbySite, promotedFocusSite, nearbySites, allNearbySites, selectedNearbyProjectId, locationOverride]);

  // Only show a data-center focus when the user explicitly clicked a marker (not when they only searched an address).
  const topCardFocus = useMemo(() => {
    if (resolvedSelectedNearbySite) {
      return {
        projectId: resolvedSelectedNearbySite.projectId ?? null,
        name: resolvedSelectedNearbySite.displayName || 'Selected project',
        companyName: resolvedSelectedNearbySite.owner || resolvedSelectedNearbySite.displayName || null,
        status: resolvedSelectedNearbySite.status ?? null,
        statusLabel: resolvedSelectedNearbySite.statusLabel ?? resolvedSelectedNearbySite.status ?? null,
        location: resolvedSelectedNearbySite.location ?? resolvedSelectedNearbySite.city ?? null,
        city: resolvedSelectedNearbySite.city ?? null,
        county: resolvedSelectedNearbySite.county ?? null,
        plannedMw: resolvedSelectedNearbySite.plannedMw ?? null,
        totalMw: resolvedSelectedNearbySite.totalMw ?? resolvedSelectedNearbySite.sizeMw ?? null,
        installedMw: resolvedSelectedNearbySite.installedMw ?? null,
        sourceCount: resolvedSelectedNearbySite.sourceCount ?? null,
        owner: resolvedSelectedNearbySite.owner ?? null,
        dataSource: resolvedSelectedNearbySite.dataSource ?? null,
        type: resolvedSelectedNearbySite.type ?? null,
        typeLabel: resolvedSelectedNearbySite.typeLabel ?? null,
        tenant: resolvedSelectedNearbySite.tenant ?? null,
        powerSource: resolvedSelectedNearbySite.powerSource ?? null,
        articleTitle: resolvedSelectedNearbySite.articleTitle ?? resolvedSelectedNearbySite.article_title ?? null,
        sourceUrl: resolvedSelectedNearbySite.sourceUrl ?? resolvedSelectedNearbySite.source_url ?? null,
        sourceName: resolvedSelectedNearbySite.sourceName ?? null,
        publishedAt: resolvedSelectedNearbySite.publishedAt ?? null,
        latestSignalKind: resolvedSelectedNearbySite.latestSignalKind ?? null,
        latestSignalSummary: resolvedSelectedNearbySite.latestSignalSummary ?? null,
        signalLinks: Array.isArray(resolvedSelectedNearbySite.signalLinks) ? resolvedSelectedNearbySite.signalLinks : []
      };
    }
    if (latestSelectedDataCenter) {
      return {
        projectId: latestSelectedDataCenter.project_id ?? latestSelectedDataCenter.projectId ?? null,
        name: latestSelectedDataCenter.display_name || latestSelectedDataCenter.project_name || latestSelectedDataCenter.name || latestSelectedDataCenter.company || 'Selected project',
        companyName: latestSelectedDataCenter.company_name || latestSelectedDataCenter.company || null,
        status: latestSelectedDataCenter.status ?? null,
        statusLabel: latestSelectedDataCenter.status_label ?? latestSelectedDataCenter.status ?? null,
        location: (latestSelectedDataCenter.location_label || latestSelectedDataCenter.city || latestSelectedDataCenter.location) ?? null,
        city: latestSelectedDataCenter.city ?? null,
        county: latestSelectedDataCenter.county ?? null,
        plannedMw: latestSelectedDataCenter.planned_mw ?? null,
        totalMw: latestSelectedDataCenter.total_mw ?? latestSelectedDataCenter.size_mw ?? null,
        installedMw: latestSelectedDataCenter.installed_mw ?? null,
        sourceCount: latestSelectedDataCenter.source_count ?? null,
        owner: latestSelectedDataCenter.company_name ?? latestSelectedDataCenter.company ?? null,
        dataSource: latestSelectedDataCenter.data_source ?? null,
        type: latestSelectedDataCenter.type ?? null,
        typeLabel: latestSelectedDataCenter.type_label ?? null,
        tenant: latestSelectedDataCenter.tenant ?? null,
        powerSource: latestSelectedDataCenter.power_source ?? null,
        articleTitle: latestSelectedDataCenter.latest_signal_title ?? latestSelectedDataCenter.article_title ?? latestSelectedDataCenter.articleTitle ?? null,
        sourceUrl: latestSelectedDataCenter.latest_signal_url ?? latestSelectedDataCenter.source_url ?? latestSelectedDataCenter.sourceUrl ?? null,
        sourceName: latestSelectedDataCenter.latest_signal_source ?? latestSelectedDataCenter.source_name ?? null,
        publishedAt: latestSelectedDataCenter.latest_signal_published_at ?? latestSelectedDataCenter.published_at ?? null,
        latestSignalKind: latestSelectedDataCenter.latest_signal_kind ?? latestSelectedDataCenter.latestSignalKind ?? null,
        latestSignalSummary: latestSelectedDataCenter.latest_signal_summary ?? latestSelectedDataCenter.latestSignalSummary ?? null,
        signalLinks: Array.isArray(latestSelectedDataCenter.signal_links) ? latestSelectedDataCenter.signal_links : []
      };
    }
    return null;
  }, [resolvedSelectedNearbySite, latestSelectedDataCenter]);

  useEffect(() => {
    const focusedProjectId = topCardFocus?.projectId || null;
    const focusedHeadline = String(topCardFocus?.articleTitle || '').trim();
    const focusedUrl = String(topCardFocus?.sourceUrl || '').trim();
    const focusedSignalLinks = Array.isArray(topCardFocus?.signalLinks) ? topCardFocus.signalLinks : [];

    if (!focusedProjectId) return;

    const selectedProjectId = selectedHeadlineSite?.projectId || null;
    const selectedHeadline = String(selectedHeadlineSite?.articleTitle || '').trim();
    const selectedUrl = String(selectedHeadlineSite?.sourceUrl || '').trim();
    const selectedSignalLinks = Array.isArray(selectedHeadlineSite?.signalLinks) ? selectedHeadlineSite.signalLinks : [];
    const alreadySynced = selectedProjectId === focusedProjectId
      && selectedHeadline === focusedHeadline
      && selectedUrl === focusedUrl
      && (selectedSignalLinks.length > 0 || focusedSignalLinks.length === 0);
    if (alreadySynced) return;

    if (!focusedHeadline) {
      setSelectedHeadlineTitle('');
      setSelectedHeadlineSite(null);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(SELECTED_STORY_STORAGE_KEY);
          sessionStorage.removeItem(SELECTED_STORY_SITE_STORAGE_KEY);
        } catch {
          // no-op
        }
      }
      return;
    }

    const storySitePayload = {
      articleTitle: focusedHeadline,
      projectId: focusedProjectId,
      sourceUrl: focusedUrl || null,
      sourceName: topCardFocus?.sourceName || null,
      publishedAt: topCardFocus?.publishedAt || null,
      signalLinks: Array.isArray(topCardFocus?.signalLinks) ? topCardFocus.signalLinks : [],
      lat: resolvedSelectedNearbySite?.lat ?? null,
      lng: resolvedSelectedNearbySite?.lng ?? null,
      displayName: topCardFocus?.name || topCardFocus?.companyName || null
    };

    setSelectedHeadlineTitle(focusedHeadline);
    setSelectedHeadlineSite(storySitePayload);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(SELECTED_STORY_STORAGE_KEY, focusedHeadline);
        sessionStorage.setItem(SELECTED_STORY_SITE_STORAGE_KEY, JSON.stringify(storySitePayload));
      } catch {
        // no-op
      }
    }
  }, [
    topCardFocus?.projectId,
    topCardFocus?.articleTitle,
    topCardFocus?.sourceUrl,
    topCardFocus?.publishedAt,
    topCardFocus?.sourceName,
    topCardFocus?.signalLinks,
    topCardFocus?.name,
    topCardFocus?.companyName,
    resolvedSelectedNearbySite?.lat,
    resolvedSelectedNearbySite?.lng,
    selectedHeadlineSite?.projectId,
    selectedHeadlineSite?.articleTitle,
    selectedHeadlineSite?.sourceUrl,
    selectedHeadlineSite?.signalLinks
  ]);

  const marketRadiusMiles = useMemo(() => {
    const rawRadius = Number(powerCircleRadiusMiles);
    if (Number.isFinite(rawRadius) && rawRadius > 0) return rawRadius;
    return DEFAULT_SEARCH_MARKET_RADIUS_MI;
  }, [powerCircleRadiusMiles]);

  const marketSummary = useMemo(() => {
    if (nearbySitesLoading) {
      return {
        locationLabel: (baseDisplayName || displayName || 'Search results').toUpperCase(),
        radiusMiles: marketRadiusMiles,
        facilityCount: 0,
        plannedMwTotal: 0,
        onsiteGasCount: 0,
        facilities: [],
        displayFacilities: [],
        moreCount: 0,
        fallbackKind: null
      };
    }
    const pool = Array.isArray(allNearbySites) ? allNearbySites : [];
    const inRadius = pool.filter((site) =>
      Number.isFinite(Number(site?.distanceMi)) && Number(site.distanceMi) <= marketRadiusMiles
    );
    const exactPlaceFallback = pool.filter((site) => site?.matchSource === 'place_fallback');
    const fallbackKind = inRadius.length > 0 ? null : (exactPlaceFallback.length > 0 ? 'place_match' : null);
    const sourceFacilities = fallbackKind === 'place_match' ? exactPlaceFallback : inRadius;
    const facilityMap = new Map();
    sourceFacilities.forEach((site) => {
      const key = site?.projectId || `${site?.lat},${site?.lng}` || site?.displayName;
      if (!key || facilityMap.has(key)) return;
      facilityMap.set(key, site);
    });
    const facilities = Array.from(facilityMap.values()).sort((a, b) => {
      const aDistance = Number.isFinite(Number(a?.distanceMi)) ? Number(a.distanceMi) : Number.POSITIVE_INFINITY;
      const bDistance = Number.isFinite(Number(b?.distanceMi)) ? Number(b.distanceMi) : Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return String(a?.displayName || '').localeCompare(String(b?.displayName || ''));
    });
    const meaningfulFacilities = facilities.filter((site) => {
      const planned = Number(site?.plannedMw);
      const total = Number(site?.totalMw);
      const installed = Number(site?.installedMw);
      const status = String(site?.status || '').trim().toLowerCase();
      return (
        (Number.isFinite(planned) && planned > 0)
        || (Number.isFinite(total) && total > 0)
        || (Number.isFinite(installed) && installed > 0)
        || Boolean(site?.tenant)
        || Boolean(site?.endUser)
        || Boolean(site?.powerSource)
        || (status && status !== 'unknown')
      );
    });
    const marketFacilityMap = new Map();
    meaningfulFacilities.forEach((site) => {
      const dedupeKey = `${normalizeMarketFacilityKeyPart(site?.displayName)}|${normalizeMarketFacilityKeyPart(site?.city || site?.county || site?.location)}`;
      const existing = marketFacilityMap.get(dedupeKey);
      const siteWeight = Math.max(Number(site?.plannedMw) || 0, Number(site?.totalMw) || 0, Number(site?.installedMw) || 0);
      const existingWeight = existing
        ? Math.max(Number(existing?.plannedMw) || 0, Number(existing?.totalMw) || 0, Number(existing?.installedMw) || 0)
        : -1;
      if (!existing || siteWeight > existingWeight) {
        marketFacilityMap.set(dedupeKey, site);
      }
    });
    const marketFacilities = Array.from(marketFacilityMap.values()).sort((a, b) => {
      const aDistance = Number.isFinite(Number(a?.distanceMi)) ? Number(a.distanceMi) : Number.POSITIVE_INFINITY;
      const bDistance = Number.isFinite(Number(b?.distanceMi)) ? Number(b.distanceMi) : Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      const aWeight = Math.max(Number(a?.plannedMw) || 0, Number(a?.totalMw) || 0, Number(a?.installedMw) || 0);
      const bWeight = Math.max(Number(b?.plannedMw) || 0, Number(b?.totalMw) || 0, Number(b?.installedMw) || 0);
      if (aWeight !== bWeight) return bWeight - aWeight;
      return String(a?.displayName || '').localeCompare(String(b?.displayName || ''));
    });
    const displayableFacilities = marketFacilities.filter((site) =>
      site?.lat != null
      && site?.lng != null
      && Number.isFinite(Number(site.lat))
      && Number.isFinite(Number(site.lng))
      && Number(site.lat) !== 0
      && Number(site.lng) !== 0
    );
    const displaySites = displayableFacilities
      .sort((a, b) => {
        const aDistance = Number.isFinite(Number(a?.distanceMi)) ? Number(a.distanceMi) : Number.POSITIVE_INFINITY;
        const bDistance = Number.isFinite(Number(b?.distanceMi)) ? Number(b.distanceMi) : Number.POSITIVE_INFINITY;
        if (aDistance !== bDistance) return aDistance - bDistance;
        return String(a?.displayName || '').localeCompare(String(b?.displayName || ''));
      })
      .slice(0, 3);
    const metricsFacilityMap = new Map();
    [...marketFacilities, ...exactPlaceFallback].forEach((site) => {
      const key = site?.projectId || `${site?.lat},${site?.lng}` || site?.displayName;
      if (!key || metricsFacilityMap.has(key)) return;
      metricsFacilityMap.set(key, site);
    });
    const metricsFacilities = Array.from(metricsFacilityMap.values());
    const facilityCount = displayableFacilities.length;
    const plannedMwTotal = metricsFacilities.reduce((sum, site) => {
      const planned = Number(site?.plannedMw);
      const total = Number(site?.totalMw);
      if (Number.isFinite(planned) && planned > 0) return sum + planned;
      if (Number.isFinite(total) && total > 0) return sum + total;
      return sum;
    }, 0);
    const onsiteGasCount = marketFacilities.filter((site) => {
      const powerSource = String(site?.powerSource || '').trim();
      return Boolean(powerSource);
    }).length;
    // Top planned facility should be chosen from facilities that are actually within the
    // current radius (i.e. the same pool used for the Facilities card), not from the
    // broader metrics set that may include out‑of‑radius fallbacks.
    const topPlannedFacility = displayableFacilities.reduce((best, site) => {
      const planned = Number(site?.plannedMw);
      const total = Number(site?.totalMw);
      const installed = Number(site?.installedMw);
      const weight = Math.max(
        Number.isFinite(planned) && planned > 0 ? planned : 0,
        Number.isFinite(total) && total > 0 ? total : 0,
        Number.isFinite(installed) && installed > 0 ? installed : 0
      );
      if (!best || weight > best.weight) {
        return { weight, site };
      }
      return best;
    }, null)?.site || null;
    const moreCount = Math.max(0, displayableFacilities.length - displaySites.length);
    return {
      locationLabel: (baseDisplayName || displayName || 'Search results').toUpperCase(),
      radiusMiles: marketRadiusMiles,
      facilityCount,
      plannedMwTotal,
      onsiteGasCount,
      facilities: displayableFacilities,
      displayFacilities: displaySites,
      topPlannedFacility,
      moreCount,
      fallbackKind: fallbackKind && facilities.length > 0 ? fallbackKind : null
    };
  }, [allNearbySites, marketRadiusMiles, baseDisplayName, displayName, responseMetadata, nearbySitesLoading]);

  const multipleSummary = useMemo(() => {
    if (!topCardFocus) return null;
    const radiusMiles = Number(oppositionCircleStats?.radiusMiles);
    const circleSites = Array.isArray(oppositionCircleStats?.inCircleSites)
      ? oppositionCircleStats.inCircleSites.filter((site) =>
        site?.lat != null
        && site?.lng != null
        && Number.isFinite(Number(site.lat))
        && Number.isFinite(Number(site.lng))
        && Number(site.lat) !== 0
        && Number(site.lng) !== 0
      )
      : [];
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || circleSites.length <= 1) return null;

    const selectedProjectId = resolvedSelectedNearbySite?.projectId || latestSelectedDataCenter?.project_id || null;
    const selectedLat = Number(resolvedSelectedNearbySite?.lat);
    const selectedLng = Number(resolvedSelectedNearbySite?.lng);

    const siblingSites = circleSites.filter((site) => {
      if (!site) return false;
      if (selectedProjectId && site.projectId && site.projectId === selectedProjectId) return false;
      if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) {
        return !(Number(site.lat) === selectedLat && Number(site.lng) === selectedLng);
      }
      return true;
    });

    const facilities = siblingSites.slice(0, 3);
    const plannedMwTotal = circleSites.reduce((sum, site) => {
      const planned = Number(site?.plannedMw);
      const total = Number(site?.totalMw);
      if (Number.isFinite(planned) && planned > 0) return sum + planned;
      if (Number.isFinite(total) && total > 0) return sum + total;
      return sum;
    }, 0);
    const operationalCount = circleSites.filter((site) => {
      const status = String(site?.status || '').toLowerCase();
      return status.includes('operational');
    }).length;

    return {
      title: topCardFocus.companyName || topCardFocus.name || 'Selected facility',
      radiusMiles,
      facilityCount: circleSites.length,
      plannedMwTotal,
      operationalCount,
      facilities,
      moreCount: Math.max(0, siblingSites.length - facilities.length)
    };
  }, [topCardFocus, oppositionCircleStats, resolvedSelectedNearbySite, latestSelectedDataCenter]);

  // Stable payload refs so the status_seen effect only re-fires on (coordStr, status) changes,
  // not on every re-render that touches verdict/queueMetrics/etc.
  const statusSeenPayloadRef = useRef({});
  statusSeenPayloadRef.current = {
    hasRealQueueMetrics,
    verdict: verdict?.label,
    displayName,
    activeQueueVsErcot,
    countyType: queueMetrics?.countyType || previewModel.countyType,
    nearestSubName,
    dataCenterCount: queueMetrics?.dataCenterCount,
  };

  useEffect(() => {
    const status = (queueStatusLabel || '').toLowerCase();
    if (!status || status === 'pending' || !coordStr) return;
    emitOnce('location_search_card_status_seen', {
      status,
      ...statusSeenPayloadRef.current,
    }, { key: `${coordStr}::${status}`, ttlMs: 3600000 }); // once per (location, status)
  }, [emitOnce, queueStatusLabel, coordStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const getChartData = () => {
    if (!powerAnalysis) return { data: [], hasData: false };

    let viewData = null;
    switch (chartView) {
      case 'capacity':
        viewData = powerAnalysis.capacity;
        break;
      case 'distanceWeighted':
        viewData = powerAnalysis.distanceWeightedCapacity;
        break;
      case 'connectionAccessibility':
        viewData = powerAnalysis.connectionAccessibility;
        break;
      case 'connectionAvailability':
        viewData = powerAnalysis.connectionAvailability;
        break;
      case 'redundancy':
        viewData = powerAnalysis.redundancy;
        break;
      case 'powerAndGas':
        viewData = powerAnalysis.powerAndGas;
        break;
      default:
        viewData = powerAnalysis.capacity;
    }

    const data = (viewData?.voltageDistribution || []).filter(
      (entry) => entry.category && !entry.category.toLowerCase().includes('unknown')
    );
    return { data, hasData: data.length > 0 };
  };

  const getCurrentViewLabel = () => {
    const viewLabelMap = {
      capacity: 'Capacity',
      distanceWeighted: 'Distance',
      connectionAccessibility: 'Connections',
      connectionAvailability: 'Availability',
      redundancy: 'Redundancy',
      powerAndGas: 'Power + Gas'
    };
    return viewLabelMap[chartView] || 'Capacity';
  };

  const chartInfo = getChartData();

  const calculateDirectionalIrr = useCallback((delayMonths, rentPerKwMo) => {
    const pressurePenalty = activeQueueVsErcot != null ? Math.max(0, activeQueueVsErcot - 1) * 3.5 : 1.8;
    const delayPenalty = delayMonths * 0.32;
    const rentLift = (rentPerKwMo - 12) * 1.7;
    const base = 23.5 - delayPenalty - pressurePenalty + rentLift;
    return Math.max(3, Math.min(28, base));
  }, [activeQueueVsErcot]);

  const pencilScenarios = useMemo(() => {
    const baseDelay = waitHigh != null ? waitHigh : 24;
    const scenarios = [
      { id: 'fast', label: 'Fast', delayMonths: Math.max(6, baseDelay - 6) },
      { id: 'base', label: 'Base', delayMonths: Math.max(8, baseDelay) },
      { id: 'slow', label: 'Slow', delayMonths: Math.max(10, baseDelay + 8) }
    ];
    return scenarios.map((scenario) => ({
      ...scenario,
      irr: calculateDirectionalIrr(scenario.delayMonths, pencilRentPerKwMo)
    }));
  }, [waitHigh, calculateDirectionalIrr, pencilRentPerKwMo]);

  const pencilSensitivity = useMemo(() => {
    const steps = [-2, -1, 0, 1, 2];
    const baseDelay = waitHigh != null ? waitHigh : 24;
    return steps.map((delta) => {
      const rent = pencilRentPerKwMo + delta;
      return {
        rent,
        irr: calculateDirectionalIrr(baseDelay, rent)
      };
    });
  }, [waitHigh, calculateDirectionalIrr, pencilRentPerKwMo]);

  const handleTogglePencilSite = useCallback(() => {
    setShowPencilSite((prev) => {
      const next = !prev;
      if (next) emitAnalyticsEvent('pencil_site_opened', { fromStatus: queueStatusLabel.toLowerCase() });
      return next;
    });
  }, [emitAnalyticsEvent, queueStatusLabel]);

  const handlePencilRentChange = useCallback((value) => {
    setPencilRentPerKwMo(value);
    emitAnalyticsEvent('pencil_site_sensitivity_changed', {
      control: 'rent_per_kw_mo',
      value
    });
  }, [emitAnalyticsEvent]);

  const handleCopyPencilBrief = useCallback(async () => {
    const lines = [
      `Pencil brief (beta): ${displayName || 'Site'}`,
      `Rent assumption: $${pencilRentPerKwMo.toFixed(1)}/kW-mo`,
      ...pencilScenarios.map((s) => `${s.label}: ${s.delayMonths} mo time-to-power -> ${s.irr.toFixed(1)}% directional IRR`),
      'Note: Directional output only; not investment advice.'
    ];
    const success = await copyText(lines.join('\n'));
    emitAnalyticsEvent('pencil_site_copy_brief_clicked', { success });
  }, [displayName, pencilRentPerKwMo, pencilScenarios, copyText, emitAnalyticsEvent]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    };
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showShareMenu]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return undefined;
    window.mapEventBus.emit('location-search:carousel-flip-state', {
      flipped: Boolean(flippedCarouselSiteKey),
      source: 'nearby_data_center_carousel'
    });
    return () => {
      window.mapEventBus.emit('location-search:carousel-flip-state', {
        flipped: false,
        source: 'nearby_data_center_carousel_cleanup'
      });
    };
  }, [flippedCarouselSiteKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus || coords.length < 2) return undefined;

    const handleAnalysisReady = (data) => {
      const [dataLon, dataLat] = data.center || [];
      const tolerance = 0.001;
      if (Math.abs(lng - dataLon) < tolerance && Math.abs(lat - dataLat) < tolerance) {
        if (Number.isFinite(Number(data?.radius)) && Number(data.radius) > 0) {
          setPowerCircleRadiusMiles(Number(data.radius));
        }
        setPowerAnalysis(data.analysis);
        if (powerAnalysisDisplayModeRef.current === 'inline') {
          setShowInlineSubAnalysis(true);
          setShowPowerAnalysis(false);
        } else {
          setShowPowerAnalysis(true);
          setShowInlineSubAnalysis(false);
        }
      }
    };

    const handleRadiusChanged = (data) => {
      const [dataLon, dataLat] = data?.center || [];
      const tolerance = 0.001;
      const matchesCardCenter = Math.abs(lng - dataLon) < tolerance && Math.abs(lat - dataLat) < tolerance;
      const circleCenter = (typeof window !== 'undefined' && window.__lastTexasDataCenterPowerCircle?.center) || lastSelectedMarkerCenterRef.current?.center;
      const matchesCircleCenter = Array.isArray(circleCenter) && circleCenter.length >= 2
        && Number.isFinite(Number(circleCenter[0])) && Number.isFinite(Number(circleCenter[1]))
        && Math.abs(Number(circleCenter[0]) - dataLon) < tolerance && Math.abs(Number(circleCenter[1]) - dataLat) < tolerance;
      if ((matchesCardCenter || matchesCircleCenter) && Number.isFinite(Number(data?.radius)) && Number(data.radius) > 0) {
        setPowerCircleRadiusMiles(Number(data.radius));
      }
    };

    const handleDataCenterSelected = (data) => {
      if (data?.properties) {
        const merged = {
          ...data.properties,
          _coordinates: Array.isArray(data?.coordinates) ? data.coordinates : data?.properties?._coordinates || null
        };
        const coords = Array.isArray(merged._coordinates) && merged._coordinates.length >= 2
          ? [Number(merged._coordinates[0]), Number(merged._coordinates[1])]
          : null;
        if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
          const centerPayload = {
            center: coords,
            address: merged?.project_name || merged?.company || merged?.city || 'Selected data center'
          };
          lastSelectedMarkerCenterRef.current = centerPayload;
          if (typeof window !== 'undefined') {
            window.__lastTexasDataCenterPowerCircle = centerPayload;
          }
        }
        setLatestSelectedDataCenter(merged);
        const coord = Array.isArray(merged._coordinates) && merged._coordinates.length >= 2
          ? [Number(merged._coordinates[0]), Number(merged._coordinates[1])]
          : null;
        if (coord && Number.isFinite(coord[0]) && Number.isFinite(coord[1])) {
          const syntheticSite = buildSyntheticSiteFromDataCenter(merged);
          setSelectedNearbySite((prev) => {
            if (!syntheticSite) return prev;
            if (prev?.projectId && syntheticSite.projectId && prev.projectId === syntheticSite.projectId) return prev;
            return syntheticSite;
          });
          if (syntheticSite?.projectId) {
            setSelectedNearbyProjectId(syntheticSite.projectId);
          }
        }
        const selectedProjectId = merged?.project_id;
        if (selectedProjectId && Array.isArray(allNearbySites) && allNearbySites.length > 0) {
          const matched = allNearbySites.find((site) => site?.projectId === selectedProjectId);
          if (matched) {
            setLatestSelectedDataCenter((prev) => ({
              ...(prev || merged),
              latest_signal_title: matched.articleTitle ?? (prev?.latest_signal_title || merged.article_title || merged.articleTitle || null),
              latest_signal_url: matched.sourceUrl ?? (prev?.latest_signal_url || merged.source_url || merged.sourceUrl || null),
              latest_signal_source: matched.sourceName ?? (prev?.latest_signal_source || merged.source_name || null),
              latest_signal_published_at: matched.publishedAt ?? (prev?.latest_signal_published_at || merged.published_at || null),
              latest_signal_kind: matched.latestSignalKind ?? (prev?.latest_signal_kind || null),
              latest_signal_summary: matched.latestSignalSummary ?? (prev?.latest_signal_summary || null),
              signal_links: Array.isArray(matched.signalLinks) ? matched.signalLinks : (prev?.signal_links || [])
            }));
            setSelectedNearbyProjectId(matched.projectId || `${matched.lat},${matched.lng}`);
            setSelectedNearbySite(matched);
          }
        }
      }
    };

    window.mapEventBus.on('power-circle:analysis-ready', handleAnalysisReady);
    window.mapEventBus.on('power-circle:radius-changed', handleRadiusChanged);
    window.mapEventBus.on('data-center:selected', handleDataCenterSelected);
    return () => {
      window.mapEventBus?.off('power-circle:analysis-ready', handleAnalysisReady);
      window.mapEventBus?.off('power-circle:radius-changed', handleRadiusChanged);
      window.mapEventBus?.off('data-center:selected', handleDataCenterSelected);
    };
  }, [lng, lat, coords.length, allNearbySites]);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !window.mapEventBus
      || !Number.isFinite(Number(lat))
      || !Number.isFinite(Number(lng))
    ) return undefined;
    window.mapEventBus.emit('location-search:ring:show', {
      center: [lng, lat],
      radiusMiles: marketRadiusMiles,
      color: oppositionColor,
      source: 'location_search'
    });
    return () => {
      window.mapEventBus.emit('location-search:ring:clear', { source: 'location_search' });
    };
  }, [coordStr, displayName, lat, lng, marketRadiusMiles, oppositionColor]);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || !window.mapEventBus
      || !Number.isFinite(Number(lat))
      || !Number.isFinite(Number(lng))
    ) return undefined;
    const handlePowerCircleDeactivate = (data) => {
      if (!data?.center) return;
      const tolerance = 0.001;
      if (Math.abs(data.center[0] - lng) < tolerance && Math.abs(data.center[1] - lat) < tolerance) {
        window.mapEventBus.emit('location-search:ring:show', {
          center: [lng, lat],
          radiusMiles: marketRadiusMiles,
          color: oppositionColor,
          source: 'location_search'
        });
      }
    };
    window.mapEventBus.on('power-circle:deactivate', handlePowerCircleDeactivate);
    return () => {
      window.mapEventBus.off('power-circle:deactivate', handlePowerCircleDeactivate);
    };
  }, [lat, lng, marketRadiusMiles, oppositionColor]);

  useEffect(() => {
    if (showPowerAnalysis) return;
    const insightNode = insightSectionRef.current;
    if (!insightNode) return;

    const locationKey = `${displayName}|${coordStr}`;
    if (lastAutoScrollKeyRef.current === locationKey) return;

    const findScrollableParent = (node) => {
      let current = node?.parentElement;
      while (current) {
        const styles = window.getComputedStyle(current);
        const overflowY = styles.overflowY;
        const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
        if (canScroll) return current;
        current = current.parentElement;
      }
      return null;
    };

    const scrollParent = findScrollableParent(insightNode);
    if (!scrollParent) return;

    requestAnimationFrame(() => {
      const parentRect = scrollParent.getBoundingClientRect();
      const insightRect = insightNode.getBoundingClientRect();
      const delta = insightRect.top - parentRect.top - 20;
      if (delta > 4) {
        scrollParent.scrollBy({ top: Math.min(delta, 90), behavior: 'smooth' });
      }
      lastAutoScrollKeyRef.current = locationKey;
    });
  }, [showPowerAnalysis, displayName, coordStr]);

  const handlePowerCircleClick = (event) => {
    event.stopPropagation();
    event.preventDefault();
    triggerPowerCircleAnalysis();
  };

  const inlineSubAnalysisContent = showInlineSubAnalysis ? (
    <div style={{ border: '1px solid rgba(248,113,113,0.22)', borderRadius: '10px', padding: '8px 8px 6px', background: 'rgba(127,29,29,0.08)' }}>
      {!powerAnalysis ? (
        <div style={{ padding: '8px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
          Loading power line analysis...
        </div>
      ) : chartInfo.hasData ? (
        <div style={{ height: '100px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartInfo.data} layout="vertical" margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                type="number"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 8 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => (
                  chartView === 'powerAndGas'
                    ? value.toFixed(0)
                    : value >= 1000000
                      ? `${(value / 1e6).toFixed(1)}M`
                      : value >= 1000
                        ? `${(value / 1000).toFixed(0)}K`
                        : String(value)
                )}
              />
              <YAxis
                dataKey="category"
                type="category"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 8 }}
                axisLine={false}
                tickLine={false}
                width={62}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 24, 39, 0.95)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '4px',
                  color: '#f9fafb',
                  padding: '4px 6px',
                  fontSize: '8px'
                }}
                formatter={(value) => (
                  chartView === 'powerAndGas'
                    ? [`${value.toFixed(0)} score`, '']
                    : value >= 1000000
                      ? [`${(value / 1e6).toFixed(1)}M MW`, '']
                      : value >= 1000
                        ? [`${(value / 1000).toFixed(1)}K MW`, '']
                        : [`${value.toFixed(1)} MW`, '']
                )}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={(data) => {
                  if (data?.category && window.mapEventBus) {
                    if (chartView === 'powerAndGas' && data.type === 'power') {
                      setGasLinesVisible((prev) => !prev);
                      window.mapEventBus.emit('power-circle:toggle-gas-lines');
                    } else {
                      window.mapEventBus.emit('power-circle:highlight-voltage', { category: data.category });
                    }
                  }
                }}
              >
                {chartInfo.data.map((entry, index) => {
                  let color = '#3b82f6';
                  let opacity = 1;
                  if (chartView === 'powerAndGas') {
                    if (entry.type === 'gas') {
                      color = !gasLinesVisible ? 'rgba(34, 197, 94, 0.3)' : '#22c55e';
                      opacity = !gasLinesVisible ? 0.3 : 1;
                    } else if (entry.category?.includes('500+')) color = '#dc2626';
                    else if (entry.category?.includes('345')) color = '#ef4444';
                    else if (entry.category?.includes('230')) color = '#f97316';
                    else if (entry.category?.includes('138')) color = '#fbbf24';
                    else if (entry.category?.includes('69')) color = '#22d3ee';
                  } else {
                    if (entry.category?.includes('500+')) color = '#dc2626';
                    else if (entry.category?.includes('345')) color = '#ef4444';
                    else if (entry.category?.includes('230')) color = '#f97316';
                    else if (entry.category?.includes('138')) color = '#fbbf24';
                    else if (entry.category?.includes('69')) color = '#22d3ee';
                  }
                  return <Cell key={`inline-cell-${index + 1}`} fill={color} opacity={opacity} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ padding: '8px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
          No data available for {chartView} view
        </div>
      )}
    </div>
  ) : null;

  const queueInsightsContent = showInlineSubAnalysis ? (
    <div style={{ border: '1px solid rgba(248,113,113,0.22)', borderRadius: '10px', padding: '8px 8px 6px', background: 'rgba(127,29,29,0.08)' }}>
      <div style={{ color: 'rgba(248,250,252,0.86)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
        Queue pressure and timeline
      </div>

      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 48px', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px' }}>Pressure</span>
          <div style={{ position: 'relative', height: '7px', borderRadius: '999px', background: 'rgba(15,23,42,0.45)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: '1px', background: 'rgba(148,163,184,0.55)' }} />
            <div
              style={{
                height: '100%',
                width: `${Math.max(6, Math.min(100, ((Number(activeQueueVsErcot) || 0) / 2.5) * 100))}%`,
                background: 'linear-gradient(90deg, rgba(251,146,60,0.75), rgba(239,68,68,0.92))',
                borderRadius: '999px'
              }}
            />
          </div>
          <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px', textAlign: 'right' }}>
            {activeQueueVsErcot != null ? `${activeQueueVsErcot.toFixed(1)}x` : 'pending'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 48px', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px' }}>Wait</span>
          <div style={{ position: 'relative', height: '7px', borderRadius: '999px', background: 'rgba(15,23,42,0.45)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '37.5%', top: 0, bottom: 0, width: '1px', background: 'rgba(148,163,184,0.55)' }} />
            {waitHigh != null ? (
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(8, Math.min(100, (Number(waitHigh) / 48) * 100))}%`,
                  background: 'linear-gradient(90deg, rgba(248,113,113,0.62), rgba(220,38,38,0.9))',
                  borderRadius: '999px'
                }}
              />
            ) : null}
          </div>
          <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px', textAlign: 'right' }}>
            {waitLow != null && waitHigh != null ? `${waitLow}-${waitHigh}m` : 'pending'}
          </span>
        </div>

        <div style={{ color: 'rgba(148,163,184,0.92)', fontSize: '8px' }}>
          Status: {queueStatusLabel}. Baseline markers show ERCOT average pressure and a mid-range interconnection timeline.
        </div>
      </div>
    </div>
  ) : null;

  const waitTimelineContent = showInlineSubAnalysis ? (
    <div style={{ border: '1px solid rgba(248,113,113,0.22)', borderRadius: '10px', padding: '8px 8px 6px', background: 'rgba(127,29,29,0.08)' }}>
      <div style={{ color: 'rgba(248,250,252,0.86)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
        Timeline scenarios
      </div>
      {waitLow != null && waitHigh != null ? (
        <div style={{ color: 'rgba(203,213,225,0.82)', fontSize: '8.5px', marginBottom: '6px' }}>
          Current estimate: {waitLow}-{waitHigh} months
        </div>
      ) : (
        <div style={{ color: 'rgba(148,163,184,0.84)', fontSize: '8.5px', marginBottom: '6px' }}>
          Wait range pending. Showing directional scenarios.
        </div>
      )}
      <div style={{ display: 'grid', gap: '5px' }}>
        {(() => {
          const rows = (pencilScenarios || []).map((scenario) => ({
            label: scenario.label,
            months: scenario.delayMonths
          }));
          const maxMonths = Math.max(1, ...rows.map((r) => Number(r.months) || 0), Number(waitHigh) || 0);
          return rows.map((row) => (
            <div key={`timeline-${row.label}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 44px', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px' }}>{row.label}</span>
              <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(15,23,42,0.45)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(6, Math.min(100, (Number(row.months || 0) / maxMonths) * 100))}%`,
                    background: 'linear-gradient(90deg, rgba(248,113,113,0.62), rgba(239,68,68,0.9))',
                    borderRadius: '999px'
                  }}
                />
              </div>
              <span style={{ color: 'rgba(226,232,240,0.78)', fontSize: '8px', textAlign: 'right' }}>{row.months} mo</span>
            </div>
          ));
        })()}
      </div>
    </div>
  ) : null;

  const nearbyCarouselSection = (
    <div ref={nearbySectionRef} style={{ margin: '2px 0 8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
        Nearby data centers
      </div>
      {nearbySitesLoading ? (
        <div style={{ color: 'rgba(226,232,240,0.65)', fontSize: '9px', padding: '6px 2px' }}>
          Loading nearby data centers...
        </div>
      ) : nearbySites.length > 0 ? (
        <NearbyDataCenterCarousel
          sites={nearbySites}
          selectedSiteKey={selectedNearbyProjectId}
          flippedSiteKey={flippedCarouselSiteKey}
          highlightSiteKey={highlightCarouselSiteKey}
          onSelect={(site) => {
            const key = site.projectId || `${site.lat},${site.lng}`;
            setFlippedCarouselSiteKey(key);
            setSelectedNearbyProjectId(key);
            setSelectedNearbySite(site);
            setHighlightCarouselSiteKey(null);
            handleNearbyGo(site);
          }}
          onDeselect={() => {
            setFlippedCarouselSiteKey(null);
            setSelectedNearbyProjectId(null);
            setSelectedNearbySite(null);
          }}
          onSiteView={handleNearbyGo}
          onScrollToOpposition={() => {
            scrollSectionIntoView(oppositionSectionRef.current);
          }}
          oppositionProps={{
            metricsStatusLabel: effectiveQueueStatusLabel,
            activeQueueVsErcot,
            queueMetrics,
            hasRealQueueMetrics,
            onNearbyAction: handleOppositionNearbyAction,
            onClusterAction: handleOppositionClusterAction,
            onNearestDataCenterAction: handleJumpToNearestDataCenterArea,
            onExpandAction: handleExpandFromOpposition,
            onRequestOpenClusterMap: handleOpenClusterFromCarousel,
            onRequestMobileFullscreen: handleRequestMobileFullscreen,
            onBlockedAction: handleOppositionBlockedAction,
            onSequenceAction: handleOppositionSequenceAction,
            circleStats: oppositionCircleStats,
            latestSelectedDataCenter,
            modeledBlockedRate,
            modeledQueueWithdrawnCount,
            modeledQueueTotalCount,
            isTexasSupportedAddress: isTexasSupported,
            texasSupportNote,
            onHeadlineClick: isTexasSupported ? handleHeadlineClick : undefined
          }}
          emitAnalyticsEvent={emitAnalyticsEvent}
          isTexasSupported={isTexasSupported}
          searchedPlace={displayName}
        />
      ) : (
        <div style={{ color: 'rgba(148,163,184,0.72)', fontSize: '9px', padding: '6px 2px' }}>
          Nearby data centers are not available yet.
        </div>
      )}
    </div>
  );

  if (!responseMetadata?.displayName) return null;

  return (
    <>
      <div
        style={{
          color: oppositionColor,
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {showPowerAnalysis ? (
          <div ref={menuRef} style={{ position: 'relative', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Power Line Analysis</span>
            </div>
            {powerAnalysis && (
              <div
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  userSelect: 'none',
                  marginTop: '2px'
                }}
              >
                <span style={{ opacity: 0.6, fontSize: '8px' }}>{getCurrentViewLabel()}</span>
                <span style={{ fontSize: '8px', opacity: 0.6 }}>{isMenuOpen ? '▲' : '▼'}</span>
              </div>
            )}
            {isMenuOpen && powerAnalysis && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'rgba(17, 24, 39, 0.98)',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '6px',
                  padding: '2px',
                  minWidth: '120px',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                }}
              >
                {[
                  { key: 'capacity', label: 'Capacity' },
                  { key: 'distanceWeighted', label: 'Distance' },
                  { key: 'connectionAccessibility', label: 'Connections' },
                  { key: 'connectionAvailability', label: 'Availability' },
                  { key: 'redundancy', label: 'Redundancy' },
                  { key: 'powerAndGas', label: 'Power + Gas' }
                ].map((view) => {
                  const isActive = chartView === view.key;
                  let analysisKey = view.key;
                  if (view.key === 'distanceWeighted') analysisKey = 'distanceWeightedCapacity';
                  const viewData = powerAnalysis[analysisKey];
                  const hasData = viewData?.voltageDistribution?.length > 0;

                  return (
                    <div
                      key={view.key}
                      onClick={() => {
                        if (hasData) {
                          setChartView(view.key);
                          setIsMenuOpen(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '9px',
                        fontWeight: isActive ? 600 : 500,
                        color: hasData ? (isActive ? '#60a5fa' : '#d1d5db') : '#6b7280',
                        cursor: hasData ? 'pointer' : 'not-allowed',
                        borderRadius: '4px',
                        background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: hasData ? 1 : 0.5
                      }}
                    >
                      <span>{view.label}</span>
                      {isActive && <span style={{ color: '#60a5fa', fontSize: '12px' }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <span style={{ color: oppositionColor }}>{`${congestion.label.toUpperCase()} CONGESTION`}</span>
        )}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <button
            type="button"
            data-tour="circle-button"
            onClick={handlePowerCircleClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.14)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              color: '#3b82f6',
              cursor: 'pointer',
              padding: 0,
              margin: 0
            }}
            title="Analyze Power Capacity"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </button>
          {showPowerAnalysis && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setShowPowerAnalysis(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '20px',
                borderRadius: '6px',
                background: 'rgba(248, 113, 113, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.45)',
                color: '#fca5a5',
                cursor: 'pointer',
                padding: '0 6px',
                margin: 0,
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
              title="Back to address search details"
            >
              BACK
            </button>
          )}
          {onExitMobileFullscreen && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onExitMobileFullscreen();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '20px',
                borderRadius: '6px',
                background: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.45)',
                color: 'rgba(226,232,240,0.92)',
                cursor: 'pointer',
                padding: '0 7px',
                margin: 0,
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.03em'
              }}
              title="Exit fullscreen"
            >
              BACK
            </button>
          )}
          <div ref={shareMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const opening = !showShareMenu;
                setShowShareMenu((prev) => !prev);
                if (opening) logEvent('share_clicked', { displayName, coordStr }, 'location_search_card');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '20px',
                borderRadius: '6px',
                background: showShareMenu ? 'rgba(96, 165, 250, 0.18)' : 'rgba(96, 165, 250, 0.10)',
                border: `1px solid ${showShareMenu ? 'rgba(96, 165, 250, 0.7)' : 'rgba(96, 165, 250, 0.4)'}`,
                color: '#60a5fa',
                cursor: 'pointer',
                padding: '0 7px',
                margin: 0,
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                transition: 'all 0.15s ease'
              }}
              title="Share this location"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              SHARE
            </button>
            {showShareMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'rgba(15, 23, 42, 0.97)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '6px',
                  minWidth: '148px',
                  zIndex: 2000,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px 6px' }}>
                  Share
                </div>
                {[
                  {
                    label: 'X / Twitter',
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.265 5.638L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                      </svg>
                    ),
                    onClick: () => {
                      const appUrl = buildShareUrl();
                      const text = `${displayName} — location analysis`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(appUrl)}`, '_blank', 'noopener,noreferrer');
                      logEvent('share_used', { platform: 'twitter', displayName, coordStr }, 'location_search_card');
                      setShowShareMenu(false);
                    }
                  },
                  {
                    label: 'LinkedIn',
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                        <rect x="2" y="9" width="4" height="12" />
                        <circle cx="4" cy="4" r="2" />
                      </svg>
                    ),
                    onClick: () => {
                      const appUrl = buildShareUrl();
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(appUrl)}`, '_blank', 'noopener,noreferrer');
                      logEvent('share_used', { platform: 'linkedin', displayName, coordStr }, 'location_search_card');
                      setShowShareMenu(false);
                    }
                  },
                  {
                    label: 'Share insight',
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M4 12h16M4 18h10" />
                      </svg>
                    ),
                    onClick: () => {
                      const insightText = buildShareInsightText();
                      logEvent('share_finding_clicked', {
                        templateId: SHARE_INSIGHT_TEMPLATE_ID,
                        displayName,
                        coordStr,
                        length: insightText.length
                      }, 'location_search_card');
                      setShareInsightPreviewText(insightText);
                      setShareInsightCopySuccess(false);
                      setShowShareInsightPreview(true);
                      setShowShareMenu(false);
                    }
                  },
                  {
                    label: shareCopied ? 'Copied!' : 'Copy link',
                    success: shareCopied,
                    icon: shareCopied
                      ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      ),
                    onClick: () => {
                      const appUrl = buildShareUrl();
                      navigator.clipboard.writeText(appUrl).then(() => {
                        logEvent('share_copied', { displayName, coordStr }, 'location_search_card');
                        setShareCopied(true);
                        setTimeout(() => { setShareCopied(false); setShowShareMenu(false); }, 1500);
                      });
                    }
                  }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={(event) => { event.stopPropagation(); item.onClick(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '7px 8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '7px',
                      color: item.success ? '#22c55e' : 'rgba(226,232,240,0.9)',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: 'rgba(226,232,240,0.6)', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <LocationFocusBlock
        variant={topCardFocus ? 'facility' : 'market'}
        market={!topCardFocus ? marketSummary : null}
        dataCenterFocus={topCardFocus}
        multiple={topCardFocus ? multipleSummary : null}
        isTexasSupported={isTexasSupported}
        onClusterAction={isTexasSupported ? handleOppositionClusterAction : undefined}
        showNearestDataCenterFallback={Boolean(topCardFocus && noDataCentersInCurrentRadius && nearestDataCenterSite)}
        onNearestDataCenterAction={isTexasSupported ? handleJumpToNearestDataCenterArea : undefined}
        onMarketSiteSelect={(site) => {
          const hasCoords = site?.lat != null
            && site?.lng != null
            && Number.isFinite(Number(site.lat))
            && Number.isFinite(Number(site.lng))
            && Number(site.lat) !== 0
            && Number(site.lng) !== 0;
          const key = site.projectId || `${site.lat},${site.lng}`;
          console.log('[LocationSearchCard] onMarketSiteSelect', {
            key,
            displayName: site?.displayName || null,
            city: site?.city || null,
            lat: site?.lat ?? null,
            lng: site?.lng ?? null,
            matchSource: site?.matchSource || null,
            hasCoords
          });
          if (hasCoords) {
            setNearbySites((prev) => {
              const current = Array.isArray(prev) ? prev : [];
              const existingIndex = current.findIndex((entry) => (
                (site.projectId && entry?.projectId === site.projectId)
                || (Number(entry?.lat) === Number(site.lat) && Number(entry?.lng) === Number(site.lng))
              ));
              if (existingIndex === 0) return current;
              if (existingIndex > 0) {
                const next = [...current];
                const [matched] = next.splice(existingIndex, 1);
                next.unshift({
                  ...matched,
                  ...site,
                  rank: 1
                });
                return next.map((entry, index) => ({ ...entry, rank: index + 1 }));
              }
              const seeded = [{ ...site, rank: 1 }, ...current].slice(0, 12);
              return seeded.map((entry, index) => ({ ...entry, rank: index + 1 }));
            });
          }
          setSelectedNearbyProjectId(key);
          setSelectedNearbySite(site);
          setPromotedFocusSite(site);
          setHighlightCarouselSiteKey(null);
          if (hasCoords) {
            setFlippedCarouselSiteKey(key);
            handleNearbyGo(site);
            setTimeout(() => {
              console.log('[LocationSearchCard] onMarketSiteSelect -> scrollSectionIntoView', { key });
              scrollSectionIntoView(nearbySectionRef.current);
            }, 140);
            setTimeout(() => {
              console.log('[LocationSearchCard] onMarketSiteSelect -> scrollSectionToRevealBottom', { key });
              scrollSectionToRevealBottom(nearbySectionRef.current, 24);
            }, 380);
          } else {
            setFlippedCarouselSiteKey(null);
          }
        }}
        onHeadlineClick={isTexasSupported ? handleHeadlineClick : undefined}
      />
      {showShareInsightPreview && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowShareInsightPreview(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(circle at 20% 0%, rgba(59,130,246,0.16), rgba(2,6,23,0.78) 55%)',
            backdropFilter: 'blur(6px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 92vw)',
              maxHeight: '80vh',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.99), rgba(15, 23, 42, 0.96))',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              borderRadius: '14px',
              boxShadow: '0 20px 48px rgba(2, 6, 23, 0.62), 0 0 0 1px rgba(96,165,250,0.15) inset',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Share Insight Preview
              </div>
              <div style={{ color: 'rgba(191,219,254,0.9)', fontSize: '10px', fontWeight: 700, padding: '3px 7px', borderRadius: '999px', border: '1px solid rgba(96,165,250,0.45)', background: 'rgba(96,165,250,0.14)' }}>
                {SHARE_INSIGHT_TEMPLATE_ID}
              </div>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.02em' }}>
                This is the exact text users will copy.
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(226,232,240,0.96)', fontSize: '12px', lineHeight: 1.6, maxHeight: '45vh', overflowY: 'auto', background: 'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.58))', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '11px 12px' }}>
                {shareInsightPreviewText}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: '10px' }}>
                  {shareInsightPreviewText.length.toLocaleString()} chars
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowShareInsightPreview(false)}
                    style={{
                      border: '1px solid rgba(148,163,184,0.4)',
                      background: 'rgba(15,23,42,0.7)',
                      color: 'rgba(226,232,240,0.9)',
                      borderRadius: '8px',
                      padding: '8px 13px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShareInsight}
                    style={{
                      border: '1px solid rgba(96,165,250,0.5)',
                      background: shareInsightCopySuccess ? 'rgba(34,197,94,0.24)' : 'linear-gradient(180deg, rgba(96,165,250,0.34), rgba(59,130,246,0.26))',
                      color: shareInsightCopySuccess ? '#86efac' : '#dbeafe',
                      borderRadius: '8px',
                      padding: '8px 13px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {shareInsightCopySuccess ? 'Copied!' : 'Copy insight'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showPowerAnalysis ? (
        <>
          {showPowerAnalysis && !powerAnalysis && (
            <div style={{ padding: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
              Loading power line analysis...
            </div>
          )}
          {powerAnalysis && (
            <>
              {chartInfo.hasData ? (
                <div style={{ height: '110px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartInfo.data} layout="vertical" margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis
                        type="number"
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => (
                          chartView === 'powerAndGas'
                            ? value.toFixed(0)
                            : value >= 1000000
                              ? `${(value / 1e6).toFixed(1)}M`
                              : value >= 1000
                                ? `${(value / 1000).toFixed(0)}K`
                                : String(value)
                        )}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(17, 24, 39, 0.95)',
                          border: '1px solid rgba(75, 85, 99, 0.5)',
                          borderRadius: '4px',
                          color: '#f9fafb',
                          padding: '4px 6px',
                          fontSize: '8px'
                        }}
                        formatter={(value) => (
                          chartView === 'powerAndGas'
                            ? [`${value.toFixed(0)} score`, '']
                            : value >= 1000000
                              ? [`${(value / 1e6).toFixed(1)}M MW`, '']
                              : value >= 1000
                                ? [`${(value / 1000).toFixed(1)}K MW`, '']
                                : [`${value.toFixed(1)} MW`, '']
                        )}
                      />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        onClick={(data) => {
                          if (data?.category && window.mapEventBus) {
                            if (chartView === 'powerAndGas' && data.type === 'power') {
                              setGasLinesVisible((prev) => !prev);
                              window.mapEventBus.emit('power-circle:toggle-gas-lines');
                            } else {
                              window.mapEventBus.emit('power-circle:highlight-voltage', { category: data.category });
                            }
                          }
                        }}
                      >
                        {chartInfo.data.map((entry, index) => {
                          let color = '#3b82f6';
                          let opacity = 1;
                          if (chartView === 'powerAndGas') {
                            if (entry.type === 'gas') {
                              color = !gasLinesVisible ? 'rgba(34, 197, 94, 0.3)' : '#22c55e';
                              opacity = !gasLinesVisible ? 0.3 : 1;
                            } else if (entry.category?.includes('500+')) color = '#dc2626';
                            else if (entry.category?.includes('345')) color = '#ef4444';
                            else if (entry.category?.includes('230')) color = '#f97316';
                            else if (entry.category?.includes('138')) color = '#fbbf24';
                            else if (entry.category?.includes('69')) color = '#22d3ee';
                          } else {
                            if (entry.category?.includes('500+')) color = '#dc2626';
                            else if (entry.category?.includes('345')) color = '#ef4444';
                            else if (entry.category?.includes('230')) color = '#f97316';
                            else if (entry.category?.includes('138')) color = '#fbbf24';
                            else if (entry.category?.includes('69')) color = '#22d3ee';
                          }
                          return <Cell key={`cell-${index + 1}`} fill={color} opacity={opacity} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px' }}>
                  No data available for {chartView} view
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: '10px' }}>
            <div style={{ color: '#cbd5e1', textAlign: 'left', fontSize: '13px', lineHeight: 1.4, fontWeight: 600, marginBottom: '8px', padding: '0 2px' }}>
              {displayName}
            </div>
            {selectedHeadlineTitle && !noDataCentersInCurrentRadius && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecentStoryExpanded((prev) => !prev);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setRecentStoryExpanded((prev) => !prev);
                  }
                }}
                style={{
                  marginBottom: '12px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(96, 165, 250, 0.72)',
                  background: 'rgba(30, 64, 175, 0.28)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        color: '#93c5fd',
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 700
                      }}
                    >
                      News collected for this site
                    </div>
                    {selectedHeadlineDateLabel && (
                      <div style={{ color: 'rgba(191,219,254,0.82)', fontSize: '10px', fontWeight: 600 }}>
                        {selectedHeadlineDateLabel}
                      </div>
                    )}
                  </div>
                  <span style={{ color: 'rgba(147, 197, 253, 0.82)', fontSize: '11px' }}>
                    {recentStoryExpanded ? 'Hide ->' : 'Open ->'}
                  </span>
                </div>
                {!recentStoryExpanded && (
                  <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>
                    {selectedHeadlineStories.length.toLocaleString()} stor{selectedHeadlineStories.length === 1 ? 'y' : 'ies'}
                  </div>
                )}
                {recentStoryExpanded && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {selectedHeadlineStories.map((story, index) => {
                        const storyDate = formatStoryDate(story.publishedAt);
                        return (
                          <div
                            key={`${story.url || story.title}-${index}`}
                            style={{
                              paddingBottom: index === selectedHeadlineStories.length - 1 ? 0 : '8px',
                              borderBottom: index === selectedHeadlineStories.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)'
                            }}
                          >
                            <div
                              style={{
                                color: '#eff6ff',
                                fontSize: '12px',
                                lineHeight: 1.45,
                                fontWeight: 700,
                                wordBreak: 'break-word'
                              }}
                            >
                              {story.title}
                            </div>
                            {(story.source || storyDate) && (
                              <div style={{ color: 'rgba(191,219,254,0.82)', fontSize: '10px', marginTop: '4px' }}>
                                {[story.source, storyDate].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {story.url && (
                              <div style={{ marginTop: '6px' }}>
                                <a
                                  href={story.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onTouchStart={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 7px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(147, 197, 253, 0.45)',
                                    background: 'rgba(30, 58, 138, 0.28)',
                                    color: '#bfdbfe',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    textDecoration: 'none'
                                  }}
                                >
                                  Open link
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={oppositionSectionRef}>
            <Opposition
              metricsStatusLabel={effectiveQueueStatusLabel}
              activeQueueVsErcot={isTexasSupported ? activeQueueVsErcot : null}
              queueMetrics={isTexasSupported ? queueMetrics : null}
              hasRealQueueMetrics={isTexasSupported ? hasRealQueueMetrics : false}
              nearbySites={isTexasSupported ? nearbySites : []}
              selectedSite={isTexasSupported ? selectedNearbySite : null}
              onNearbyAction={isTexasSupported ? handleOppositionNearbyAction : undefined}
              onClusterAction={isTexasSupported ? handleOppositionClusterAction : undefined}
              onNearestDataCenterAction={isTexasSupported ? handleJumpToNearestDataCenterArea : undefined}
              onExpandAction={isTexasSupported ? handleExpandFromOpposition : undefined}
              onBlockedAction={isTexasSupported ? handleOppositionBlockedAction : undefined}
              onSequenceAction={isTexasSupported ? handleOppositionSequenceAction : undefined}
              onHeadlineClick={isTexasSupported ? handleHeadlineClick : undefined}
              circleStats={isTexasSupported ? oppositionCircleStats : null}
              latestSelectedDataCenter={isTexasSupported ? latestSelectedDataCenter : null}
              forceOpenClusterToken={forceOpenClusterToken}
              modeledBlockedRate={modeledBlockedRate}
              modeledQueueWithdrawnCount={modeledQueueWithdrawnCount}
              modeledQueueTotalCount={modeledQueueTotalCount}
              isTexasSupportedAddress={isTexasSupported}
              texasSupportNote={texasSupportNote}
              coordStr={coordStr}
            />
            </div>
            <div ref={verdictSectionRef}>
              <FeasibilityVerdictCard
              verdict={effectiveVerdict}
              queueStatusLabel={effectiveQueueStatusLabel}
              activeQueueVsErcot={isTexasSupported ? activeQueueVsErcot : null}
              nearestSubDistance={isTexasSupported ? nearestSubDistance : null}
              nearestSubVoltageKv={isTexasSupported ? nearestSubVoltageKv : null}
              nearestSubOperator={isTexasSupported ? nearestSubOperator : null}
              nearestSubName={isTexasSupported ? nearestSubName : null}
              waitLow={isTexasSupported ? waitLow : null}
              waitHigh={isTexasSupported ? waitHigh : null}
              onPrimaryAction={isTexasSupported ? handleFeasibilityPrimaryAction : undefined}
              onQueueAction={isTexasSupported ? handleFeasibilityQueueAction : undefined}
              onSubAction={isTexasSupported ? handleFeasibilitySubAction : undefined}
              onWaitAction={isTexasSupported ? handleFeasibilityWaitAction : undefined}
              onRiskReview={isTexasSupported ? handleFeasibilityRiskReview : undefined}
              onUnderwrite={isTexasSupported ? handleFeasibilityUnderwrite : undefined}
              queueExpandedContent={isTexasSupported ? queueInsightsContent : null}
              subExpandedContent={isTexasSupported ? inlineSubAnalysisContent : null}
              waitExpandedContent={isTexasSupported ? waitTimelineContent : null}
              noDataCentersInRadius={noDataCentersInCurrentRadius}
              noDataCentersRadiusMiles={oppositionCircleStats?.radiusMiles}
              nearestDataCenterDistanceMi={nearestDataCenterSite?.distanceMi}
              onNearestDataCenterAction={isTexasSupported ? handleJumpToNearestDataCenterArea : undefined}
              selectedSite={isTexasSupported ? selectedNearbySite : null}
              isTexasSupportedAddress={isTexasSupported}
              texasSupportNote={texasSupportNote}
            />
            </div>
          </div>
          {nearbyCarouselSection}
        </>
      ) : (
        <React.Fragment>
        <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>
          {selectedHeadlineTitle && !noDataCentersInCurrentRadius && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecentStoryExpanded((prev) => !prev);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setRecentStoryExpanded((prev) => !prev);
                  }
                }}
                style={{
                  marginBottom: '12px',
                  marginLeft: '10px',
                  marginRight: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(96, 165, 250, 0.72)',
                  background: 'rgba(30, 64, 175, 0.28)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        color: '#93c5fd',
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 700
                      }}
                    >
                      News collected for this site
                    </div>
                    {selectedHeadlineDateLabel && (
                      <div style={{ color: 'rgba(191,219,254,0.82)', fontSize: '10px', fontWeight: 600 }}>
                        {selectedHeadlineDateLabel}
                      </div>
                    )}
                  </div>
                  <span style={{ color: 'rgba(147, 197, 253, 0.82)', fontSize: '11px' }}>
                    {recentStoryExpanded ? 'Hide ->' : 'Open ->'}
                  </span>
                </div>
                {!recentStoryExpanded && (
                  <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>
                    {selectedHeadlineStories.length.toLocaleString()} stor{selectedHeadlineStories.length === 1 ? 'y' : 'ies'}
                  </div>
                )}
                {recentStoryExpanded && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {selectedHeadlineStories.map((story, index) => {
                        const storyDate = formatStoryDate(story.publishedAt);
                        return (
                          <div
                            key={`${story.url || story.title}-${index}`}
                            style={{
                              paddingBottom: index === selectedHeadlineStories.length - 1 ? 0 : '8px',
                              borderBottom: index === selectedHeadlineStories.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)'
                            }}
                          >
                            <div
                              style={{
                                color: '#eff6ff',
                                fontSize: '12px',
                                lineHeight: 1.45,
                                fontWeight: 700,
                                wordBreak: 'break-word'
                              }}
                            >
                              {story.title}
                            </div>
                            {(story.source || storyDate) && (
                              <div style={{ color: 'rgba(191,219,254,0.82)', fontSize: '10px', marginTop: '4px' }}>
                                {[story.source, storyDate].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {story.url && (
                              <div style={{ marginTop: '6px' }}>
                                <a
                                  href={story.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onTouchStart={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 7px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(147, 197, 253, 0.45)',
                                    background: 'rgba(30, 58, 138, 0.28)',
                                    color: '#bfdbfe',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    textDecoration: 'none'
                                  }}
                                >
                                  Open link
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={oppositionSectionRef}>
              <Opposition
                metricsStatusLabel={effectiveQueueStatusLabel}
                activeQueueVsErcot={isTexasSupported ? activeQueueVsErcot : null}
                queueMetrics={isTexasSupported ? queueMetrics : null}
                hasRealQueueMetrics={isTexasSupported ? hasRealQueueMetrics : false}
                nearbySites={isTexasSupported ? nearbySites : []}
                selectedSite={isTexasSupported ? selectedNearbySite : null}
                onNearbyAction={isTexasSupported ? handleOppositionNearbyAction : undefined}
                onClusterAction={isTexasSupported ? handleOppositionClusterAction : undefined}
                onNearestDataCenterAction={isTexasSupported ? handleJumpToNearestDataCenterArea : undefined}
                onExpandAction={isTexasSupported ? handleExpandFromOpposition : undefined}
                onBlockedAction={isTexasSupported ? handleOppositionBlockedAction : undefined}
                onSequenceAction={isTexasSupported ? handleOppositionSequenceAction : undefined}
                onHeadlineClick={isTexasSupported ? handleHeadlineClick : undefined}
                circleStats={isTexasSupported ? oppositionCircleStats : null}
                latestSelectedDataCenter={isTexasSupported ? latestSelectedDataCenter : null}
                forceOpenClusterToken={forceOpenClusterToken}
                modeledBlockedRate={modeledBlockedRate}
                modeledQueueWithdrawnCount={modeledQueueWithdrawnCount}
                modeledQueueTotalCount={modeledQueueTotalCount}
                isTexasSupportedAddress={isTexasSupported}
                texasSupportNote={texasSupportNote}
              />
            </div>
            <div ref={verdictSectionRef}>
              <FeasibilityVerdictCard
              verdict={effectiveVerdict}
              queueStatusLabel={effectiveQueueStatusLabel}
              activeQueueVsErcot={isTexasSupported ? activeQueueVsErcot : null}
              nearestSubDistance={isTexasSupported ? nearestSubDistance : null}
              nearestSubVoltageKv={isTexasSupported ? nearestSubVoltageKv : null}
              nearestSubOperator={isTexasSupported ? nearestSubOperator : null}
              nearestSubName={isTexasSupported ? nearestSubName : null}
              waitLow={isTexasSupported ? waitLow : null}
              waitHigh={isTexasSupported ? waitHigh : null}
              onPrimaryAction={isTexasSupported ? handleFeasibilityPrimaryAction : undefined}
              onQueueAction={isTexasSupported ? handleFeasibilityQueueAction : undefined}
              onSubAction={isTexasSupported ? handleFeasibilitySubAction : undefined}
              onWaitAction={isTexasSupported ? handleFeasibilityWaitAction : undefined}
              onRiskReview={isTexasSupported ? handleFeasibilityRiskReview : undefined}
              onUnderwrite={isTexasSupported ? handleFeasibilityUnderwrite : undefined}
              queueExpandedContent={isTexasSupported ? queueInsightsContent : null}
              subExpandedContent={isTexasSupported ? inlineSubAnalysisContent : null}
              waitExpandedContent={isTexasSupported ? waitTimelineContent : null}
              noDataCentersInRadius={noDataCentersInCurrentRadius}
              noDataCentersRadiusMiles={oppositionCircleStats?.radiusMiles}
              nearestDataCenterDistanceMi={nearestDataCenterSite?.distanceMi}
              onNearestDataCenterAction={isTexasSupported ? handleJumpToNearestDataCenterArea : undefined}
              selectedSite={isTexasSupported ? selectedNearbySite : null}
              isTexasSupportedAddress={isTexasSupported}
              texasSupportNote={texasSupportNote}
            />
            </div>
          </div>

          {nearbyCarouselSection}

          <div ref={pencilSectionRef} style={{ margin: '0 0 10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Pencil this site
              </div>
              <button
                type="button"
                onClick={handleTogglePencilSite}
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  borderRadius: '6px',
                  background: 'rgba(15, 23, 42, 0.35)',
                  color: '#e2e8f0',
                  padding: '3px 8px',
                  fontSize: '8.5px',
                  cursor: 'pointer'
                }}
              >
                {showPencilSite ? 'Hide beta' : 'Open beta'}
              </button>
            </div>

            {showPencilSite && (
              <div style={{ border: '1px solid rgba(148,163,184,0.26)', borderRadius: '10px', padding: '8px', background: 'rgba(15,23,42,0.18)' }}>
                <div style={{ color: 'rgba(226,232,240,0.82)', fontSize: '9px', marginBottom: '6px' }}>
                  Directional underwriting probe (beta)
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(226,232,240,0.75)', fontSize: '9px', marginBottom: '4px' }}>
                    <span>Rent assumption ($/kW-mo)</span>
                    <span>{pencilRentPerKwMo.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    step="0.5"
                    value={pencilRentPerKwMo}
                    onChange={(event) => handlePencilRentChange(Number(event.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {pencilScenarios.map((scenario) => (
                    <div key={scenario.id} style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: '8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                        {scenario.label}
                      </div>
                      <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 700, lineHeight: 1 }}>{scenario.irr.toFixed(1)}%</div>
                      <div style={{ color: 'rgba(148,163,184,0.78)', fontSize: '8px', marginTop: '2px' }}>{scenario.delayMonths} mo to power</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: 'rgba(226,232,240,0.72)', fontSize: '8px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Rent sensitivity
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '46px' }}>
                    {pencilSensitivity.map((point) => (
                      <div key={point.rent} style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(8, (point.irr / 28) * 42)}px`,
                            background: point.rent === pencilRentPerKwMo ? 'rgba(59,130,246,0.85)' : 'rgba(148,163,184,0.5)',
                            borderRadius: '4px 4px 0 0'
                          }}
                        />
                        <div style={{ color: 'rgba(148,163,184,0.75)', fontSize: '8px', marginTop: '2px' }}>${point.rent.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPencilBrief}
                  style={{
                    width: '100%',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.35)',
                    color: '#e2e8f0',
                    padding: '5px 8px',
                    fontSize: '9px',
                    cursor: 'pointer'
                  }}
                >
                  Copy pencil brief
                </button>
              </div>
            )}
          </div>

          <div
            ref={insightSectionRef}
            style={{
              margin: '12px 0 10px',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: 'transparent',
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '1px'
            }}
          >
            {previewMetrics.map((metric, idx) => {
              const isExpanded = expandedTile === idx;
              const expandable = idx <= 3;
              return (
              <div
                key={metric.label}
                onClick={() => {
                  if (expandable) setExpandedTile(isExpanded ? null : idx);
                }}
                style={{
                  padding: '14px',
                  background: 'transparent',
                  border: isExpanded ? `1px solid ${metric.color}44` : '1px solid transparent',
                  borderRadius: isExpanded ? '8px' : '0px',
                  cursor: expandable ? 'pointer' : 'default'
                }}
              >
                <div style={{
                  color: isExpanded ? (metric.color || '#fca5a5') : 'rgba(255,255,255,0.38)',
                  fontSize: '10px',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: isExpanded ? 700 : 600
                }}>
                  {metric.label}
                  {expandable && (
                    <span style={{ marginLeft: '6px', opacity: 0.6, fontSize: '8px' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: metric.color || '#f1f5f9',
                    fontSize: metric.textValue ? '28px' : '28px',
                    fontWeight: 700,
                    marginBottom: '5px',
                    letterSpacing: metric.textValue ? '-0.02em' : '-0.02em',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px'
                  }}
                >
                  {metric.textValue
                    ? <>
                        <span>{metric.textValue}</span>
                        {metric.textSuffix && <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.45 }}>{metric.textSuffix}</span>}
                      </>
                    : <><AnimatedNumber value={metric.value} />{metric.unit ? <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.8 }}>{metric.unit}</span> : null}</>
                  }
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', lineHeight: 1.35 }}>{metric.sublabel}</div>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '10px',
                      borderTop: `1px solid ${metric.color}33`,
                      paddingTop: '8px'
                    }}
                  >
                    {idx === 0 && (
                      <>
                        <div style={{ color: metric.color, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          Queue Snapshot
                        </div>
                        {hasRealQueueMetrics ? (
                          <div style={{ color: '#d5dbe5', fontSize: '9px', lineHeight: 1.55 }}>
                            <div>• County: {queueMetrics.countyName || 'Unknown'}</div>
                            <div>
                              • Active queue: {formatCompactNumber(queueMetrics.activeQueueCount)} projects
                              {activeQueueVsErcot != null ? ` — ${formatMultiplier(activeQueueVsErcot)} ERCOT avg` : ''}
                            </div>
                            <div>• Total queue: {formatCompactNumber(queueMetrics.totalQueueCount)}</div>
                            <div>• Capacity: {formatCompactNumber(Math.round(Number(queueMetrics.activeQueueMw || 0)))} MW</div>
                            <div>• Dominant fuel: {queueMetrics.dominantFuelType || 'Unknown'}</div>
                            <div>• Renewable: {formatPct(queueMetrics.renewablePct)}, Baseload: {formatPct(queueMetrics.baseloadPct)}, Storage: {formatPct(queueMetrics.storagePct)}</div>
                          </div>
                        ) : (
                          <div style={{ color: '#8b939f', fontSize: '9px', lineHeight: 1.5 }}>
                            Queue details will appear when county metrics are available.
                          </div>
                        )}
                      </>
                    )}

                    {idx === 1 && (
                      <>
                        <div style={{ color: metric.color, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          Substation Detail
                        </div>
                        {hasRealQueueMetrics && queueMetrics.nearestSubName ? (
                          <div style={{ color: '#d5dbe5', fontSize: '9px', lineHeight: 1.55 }}>
                            <div>• Name: {queueMetrics.nearestSubName}</div>
                            <div>• Distance: {queueMetrics.nearestSubDistanceMi} mi</div>
                            {queueMetrics.nearestSubVoltageKv && <div>• Voltage: {queueMetrics.nearestSubVoltageKv} kV</div>}
                            {queueMetrics.nearestSubOperator && queueMetrics.nearestSubOperator !== 'Unknown' && (
                              <div>• Operator: {queueMetrics.nearestSubOperator}</div>
                            )}
                            {Number(queueMetrics.nearestSubPoiCount) > 0 && (
                              <div>• Queue at this sub: {queueMetrics.nearestSubPoiCount} interconnection requests</div>
                            )}
                            {Number(queueMetrics.estWaitMonthsLow) > 0 && (
                              <div>• Est. wait: {queueMetrics.estWaitMonthsLow}–{queueMetrics.estWaitMonthsHigh} months</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#8b939f', fontSize: '9px', lineHeight: 1.5 }}>
                            Substation details will appear when metrics are available.
                          </div>
                        )}
                      </>
                    )}

                    {idx === 2 && (
                      <>
                        <div style={{ color: metric.color, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          Generation Profile
                        </div>
                        {hasRealQueueMetrics ? (
                          <div style={{ color: '#d5dbe5', fontSize: '9px', lineHeight: 1.55 }}>
                            <div>• County: {queueMetrics.countyName || 'Unknown'}</div>
                            <div>• Classification: {(queueMetrics.countyType || 'producer').charAt(0).toUpperCase() + (queueMetrics.countyType || 'producer').slice(1)}</div>
                            <div>• Net capacity: {formatCompactNumber(Math.round(Number(queueMetrics.netMw || 0)))} MW</div>
                            <div>• Dominant fuel: {queueMetrics.dominantFuelType || 'Unknown'}</div>
                            <div>• Renewable: {formatPct(queueMetrics.renewablePct)}</div>
                            <div>• Baseload (gas/nuclear): {formatPct(queueMetrics.baseloadPct)}</div>
                            <div>• Storage (battery): {formatPct(queueMetrics.storagePct)}</div>
                          </div>
                        ) : (
                          <div style={{ color: '#8b939f', fontSize: '9px', lineHeight: 1.5 }}>
                            County generation profile will appear when metrics are available.
                          </div>
                        )}
                      </>
                    )}

                    {idx === 3 && (
                      <>
                        <div style={{ color: metric.color, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          Data Center Breakdown
                        </div>
                        {hasRealQueueMetrics && Number.isFinite(Number(queueMetrics.dataCenterCount)) ? (
                          <div style={{ color: '#d5dbe5', fontSize: '9px', lineHeight: 1.55 }}>
                            <div>• Total nearby: {queueMetrics.dataCenterCount}</div>
                            <div>• Existing / active: {queueMetrics.dataCenterExistingCount || 0}</div>
                            <div>• Under construction: {queueMetrics.dataCenterUnderConstructionCount || 0}</div>
                            <div>• Announced / planned: {queueMetrics.dataCenterAnnouncedCount || 0}</div>
                            <div>• Search radius: ~50 mi</div>
                          </div>
                        ) : (
                          <div style={{ color: '#8b939f', fontSize: '9px', lineHeight: 1.5 }}>
                            Data center details will appear when metrics are available.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: 'rgba(255,255,255,0.34)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Queue Breakdown
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', gap: '2px' }}>
              <div style={{ flex: queueBreakdown.active, background: '#ef4444', borderRadius: '99px', transition: 'flex 0.6s ease' }} />
              <div style={{ flex: queueBreakdown.withdrawn, background: 'rgba(255,255,255,0.25)', borderRadius: '99px', transition: 'flex 0.6s ease' }} />
              <div style={{ flex: queueBreakdown.completed, background: '#22c55e', borderRadius: '99px', transition: 'flex 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: 'rgba(255,255,255,0.35)', fontSize: '9px' }}>
              <span>● {queueBreakdown.active} active</span>
              <span>● {queueBreakdown.withdrawn} withdrawn</span>
              <span>● {queueBreakdown.completed} completed</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'rgba(255,255,255,0.32)',
              fontSize: '9px',
              padding: '6px 0 0'
            }}
          >
            <span>Source: {sourceLabel}</span>
            {updatedAt && <span>Updated {updatedAt}</span>}
          </div>

          <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.32)', fontSize: '9px' }}>
            Metrics: {queueStatusLabel}
            {hasRealQueueMetrics ? ' · County aggregate (Supabase)' : ' · Deterministic preview'}
          </div>

          <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.26)', fontSize: '9px', lineHeight: 1.45, paddingBottom: '12px' }}>
            {hasRealQueueMetrics
              ? 'Active queue reflects nearest county aggregate metrics. Use the circle button for live power-capacity analysis.'
              : queueMetricsStatus === 'pending'
                ? 'Loading real metrics. Showing preliminary deterministic estimates while data resolves.'
                : 'Metrics are deterministic preview estimates. Use the circle button for current power-capacity analysis.'}
          </div>

          {coordStr && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)'
              }}
            >
              <span style={{ color: '#aaa', fontSize: '10px', fontWeight: 600 }}>Coordinates</span>
              <span style={{ color: '#fff', textAlign: 'right', fontSize: '10px', maxWidth: '65%', fontWeight: 600 }}>{coordStr}</span>
            </div>
          )}
        </React.Fragment>
      )}
      <style>{`
        @keyframes locationCardPing {
          0% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes locationCardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
};

export default LocationSearchCard;
