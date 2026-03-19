import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../../constants';
import { logUiEvent } from '../../../../services/uiEvents';

if (typeof document !== 'undefined' && !document.getElementById('location-focus-block-animations')) {
  const style = document.createElement('style');
  style.id = 'location-focus-block-animations';
  style.textContent = `
    @keyframes locationFocusRollIn {
      0% {
        opacity: 0;
        transform: translateY(14px) scale(0.985);
      }
      60% {
        opacity: 1;
        transform: translateY(-2px) scale(1.004);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes locationFocusPlannedPulse {
      0% {
        transform: scale(1);
        text-shadow: none;
        color: inherit;
      }
      40% {
        transform: scale(1.03);
        text-shadow: 0 0 12px rgba(250, 204, 21, 0.65);
        color: #fed7aa;
      }
      100% {
        transform: scale(1);
        text-shadow: none;
        color: inherit;
      }
    }
  `;
  document.head.appendChild(style);
}

const formatMw = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n).toLocaleString()} MW`;
};

const formatDistance = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toFixed(1)} mi`;
};

const buildSignalMeta = (sourceName, publishedAt) => {
  const parts = [];
  if (sourceName) parts.push(sourceName);
  if (publishedAt) {
    const parsed = new Date(publishedAt);
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
  }
  return parts.join(' · ');
};

const latestSignalBadgeStyle = (kind) => {
  const normalized = String(kind || '').trim().toLowerCase();
  if (normalized === 'enriched') {
    return {
      label: 'Enriched',
      border: '1px solid rgba(74, 222, 128, 0.38)',
      background: 'rgba(20, 83, 45, 0.2)',
      color: 'rgba(187, 247, 208, 0.94)'
    };
  }
  if (normalized === 'review_required') {
    return {
      label: 'Review',
      border: '1px solid rgba(250, 204, 21, 0.34)',
      background: 'rgba(113, 63, 18, 0.2)',
      color: 'rgba(254, 240, 138, 0.94)'
    };
  }
  if (normalized === 'needs_manual_review') {
    return {
      label: 'Manual review',
      border: '1px solid rgba(251, 146, 60, 0.34)',
      background: 'rgba(124, 45, 18, 0.2)',
      color: 'rgba(254, 215, 170, 0.94)'
    };
  }
  return null;
};

const statusBadgeStyle = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('operational')) {
    return {
      border: '1px solid rgba(74, 222, 128, 0.45)',
      background: 'rgba(20, 83, 45, 0.24)',
      color: 'rgba(187, 247, 208, 0.95)'
    };
  }
  if (normalized.includes('construction')) {
    return {
      border: '1px solid rgba(250, 204, 21, 0.4)',
      background: 'rgba(113, 63, 18, 0.24)',
      color: 'rgba(254, 240, 138, 0.95)'
    };
  }
  return {
    border: '1px solid rgba(251, 146, 60, 0.4)',
    background: 'rgba(124, 45, 18, 0.24)',
    color: 'rgba(254, 215, 170, 0.95)'
  };
};

const dividerStyle = {
  margin: '10px 0',
  borderTop: '1px solid rgba(148,163,184,0.18)'
};

const labelStyle = {
  color: 'rgba(148,163,184,0.72)',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
};

const valueStyle = {
  color: 'rgba(241,245,249,0.96)',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: 1.2
};

const summaryTileStyle = {
  display: 'grid',
  gap: '3px',
  padding: '10px 0'
};

const marketValueStyle = (tone) => {
  if (tone === 'planned') {
    return {
      color: '#fca5a5'
    };
  }
  if (tone === 'operational') {
    return {
      color: '#93c5fd'
    };
  }
  return {
    color: 'rgba(226,232,240,0.94)'
  };
};

const LocationFocusBlock = ({
  variant,
  market = null,
  dataCenterFocus = null,
  multiple = null,
  isTexasSupported = true,
  onHeadlineClick = null,
  onMarketSiteSelect = null,
  onClusterAction = null,
  onNearestDataCenterAction = null,
  showNearestDataCenterFallback = false,
  className = ''
}) => {
  const isMobile = useIsMobile(MOBILE_CONFIG?.breakpoint ?? 768);
  const multipleSectionRef = useRef(null);
  const [activeSiteKey, setActiveSiteKey] = useState(null);
  const [isBadgePulsing, setIsBadgePulsing] = useState(false);
  const [isMultipleExpanded, setIsMultipleExpanded] = useState(false);
  const [isMarketFacilitiesExpanded, setIsMarketFacilitiesExpanded] = useState(false);
  const [isMarketPlannedExpanded, setIsMarketPlannedExpanded] = useState(false);
  const [isMarketOnsiteGasExpanded, setIsMarketOnsiteGasExpanded] = useState(false);
  const [isPlannedPulsing, setIsPlannedPulsing] = useState(false);
  const [showAllMultipleFacilities, setShowAllMultipleFacilities] = useState(false);
  const [showAllMarketFacilities, setShowAllMarketFacilities] = useState(false);
  const [showAllMarketPlannedFacilities, setShowAllMarketPlannedFacilities] = useState(false);
  const [showAllMarketOnsiteGasFacilities, setShowAllMarketOnsiteGasFacilities] = useState(false);
  const previousNearbySiteCountRef = useRef(0);
  const nearbySiteCount = Math.max(0, Number(multiple?.facilityCount || 0) - 1);

  const handleSiteSelect = (site) => {
    const key = site?.projectId || `${site?.lat},${site?.lng}`;

    // Tracking: market list selection
    try {
      logUiEvent({
        event_type: 'focusblock.v1.site_select',
        asset_type: site?.projectId ? 'data_center' : 'market',
        project_id: site?.projectId || null,
        county: site?.county || null,
        state: site?.state || (site?.county ? 'TX' : null),
        query_text: site?.displayName || null,
      });
    } catch {}

    setActiveSiteKey(key);
    window.setTimeout(() => {
      onMarketSiteSelect?.(site);
      setActiveSiteKey((current) => (current === key ? null : current));
    }, 120);
  };

  const handleMultipleExpandedToggle = () => {
    setIsMultipleExpanded((current) => {
      const next = !current;

      // Tracking
      try {
        logUiEvent({
          event_type: 'focusblock.v1.expand_toggle',
          asset_type: 'cluster',
          county: dataCenterFocus?.county || null,
          state: dataCenterFocus?.county ? 'TX' : null,
          project_id: dataCenterFocus?.projectId || null,
          query_text: `multiple_sites:${next ? 'open' : 'close'}`,
        });
      } catch {}

      if (next) {
        setShowAllMultipleFacilities(false);
        onClusterAction?.({
          forceActivate: true,
          source: 'location_focus_multiple_sites_toggle'
        });
      } else {
        setShowAllMultipleFacilities(false);
      }
      return next;
    });
  };

  const handleMarketFacilitiesToggle = () => {
    setIsMarketFacilitiesExpanded((current) => {
      const next = !current;

      // Tracking
      try {
        logUiEvent({
          event_type: 'focusblock.v1.expand_toggle',
          asset_type: 'market',
          county: null,
          state: 'TX',
          project_id: null,
          query_text: `market_facilities:${next ? 'open' : 'close'}`
        });
      } catch {}

      console.log('[LocationFocusBlock] market facilities toggle', {
        current,
        next,
        facilityCount: Number(market?.facilityCount || 0),
        plannedMwTotal: Number(market?.plannedMwTotal || 0),
        onsiteGasCount: Number(market?.onsiteGasCount || 0),
        visibleFacilities: Array.isArray(market?.facilities)
          ? market.facilities.map((site) => ({
              displayName: site?.displayName || null,
              city: site?.city || null,
              lat: site?.lat ?? null,
              lng: site?.lng ?? null,
              matchSource: site?.matchSource || null,
              powerSource: site?.powerSource || null,
              tenant: site?.tenant || null
            }))
          : []
      });
      if (next) {
        setShowAllMarketFacilities(false);
        onClusterAction?.({
          forceActivate: true,
          source: 'location_focus_market_sites_toggle',
          preferSearchCenter: true,
          radiusMiles: 25
        });
      } else {
        setShowAllMarketFacilities(false);
      }
      return next;
    });
  };

  const handleMarketPlannedToggle = () => {
    setIsMarketPlannedExpanded((current) => {
      const next = !current;

      // Tracking
      try {
        logUiEvent({
          event_type: 'focusblock.v1.expand_toggle',
          asset_type: 'market',
          county: null,
          state: 'TX',
          project_id: null,
          query_text: `market_planned:${next ? 'open' : 'close'}`
        });
      } catch {}

      if (next) {
        setShowAllMarketPlannedFacilities(false);
        setIsPlannedPulsing(true);
        window.setTimeout(() => {
          setIsPlannedPulsing(false);
        }, 1000);
        onClusterAction?.({
          forceActivate: true,
          source: 'location_focus_market_planned_toggle',
          preferSearchCenter: true,
          radiusMiles: 25
        });
      } else {
        setShowAllMarketPlannedFacilities(false);
      }
      return next;
    });
  };

  const handleMarketOnsiteGasToggle = () => {
    if (!Array.isArray(onsiteGasFacilities) || onsiteGasDisplayCount === 0) {
      console.log('[LocationFocusBlock] onsite gas toggle aborted: no onsiteGasFacilities', {
        onsiteGasDisplayCount,
        marketFacilitiesCount: marketFacilities.length
      });
      return;
    }

    // Tracking
    try {
      logUiEvent({
        event_type: 'focusblock.v1.expand_toggle',
        asset_type: 'market',
        county: null,
        state: 'TX',
        project_id: null,
        query_text: `market_onsite_gas:${!isMarketOnsiteGasExpanded ? 'open' : 'close'}`
      });
    } catch {}

    console.log('[LocationFocusBlock] onsite gas toggle', {
      nextExpanded: !isMarketOnsiteGasExpanded,
      onsiteGasDisplayCount,
      onsiteGasFacilities: onsiteGasFacilities.map((site) => ({
        displayName: site?.displayName || null,
        city: site?.city || null,
        lat: site?.lat ?? null,
        lng: site?.lng ?? null,
        powerSource: site?.powerSource || null,
        plannedMw: site?.plannedMw ?? site?.totalMw ?? null,
        status: site?.status || null
      }))
    });
    setIsMarketOnsiteGasExpanded((current) => {
      const next = !current;
      setShowAllMarketOnsiteGasFacilities(false);
      return next;
    });
  };

  const blockStyle = useMemo(() => ({
    marginTop: '28px',
    marginBottom: '10px',
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    display: 'grid',
    gap: 0,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    padding: 0,
    maxWidth: isMobile ? 'none' : '420px',
    minWidth: 0
  }), [isMobile]);

  useEffect(() => {
    const previous = previousNearbySiteCountRef.current;
    if (previous === nearbySiteCount) return undefined;

    previousNearbySiteCountRef.current = nearbySiteCount;
    if (nearbySiteCount <= 0) {
      setIsBadgePulsing(false);
      return undefined;
    }

    setIsBadgePulsing(true);
    const timeoutId = window.setTimeout(() => {
      setIsBadgePulsing(false);
    }, 320);
    return () => window.clearTimeout(timeoutId);
  }, [nearbySiteCount]);

  const impressionDedupeRef = useRef(new Map());

  const emitOnce = (key, payload, ttlMs = 60 * 60 * 1000) => {
    try {
      const now = Date.now();
      const cache = impressionDedupeRef.current;
      const prev = cache.get(key);
      if (prev && now - prev < ttlMs) return;
      cache.set(key, now);
      logUiEvent(payload);
    } catch {}
  };

  useEffect(() => {
    if (!multiple || Number(multiple?.facilityCount || 0) <= 1) {
      setIsMultipleExpanded(false);
    }
  }, [multiple]);

  useEffect(() => {
    if (!market || Number(market?.facilityCount || 0) <= 0) {
      setIsMarketFacilitiesExpanded(false);
      setIsMarketPlannedExpanded(false);
      setIsMarketOnsiteGasExpanded(false);
    }
  }, [market]);

  // Impression tracking (deduped): facility vs market focus shown.
  useEffect(() => {
    if (!isTexasSupported) return;

    if (variant === 'facility' && dataCenterFocus) {
      const key = `facility::${dataCenterFocus.projectId || dataCenterFocus.name || 'unknown'}`;
      emitOnce(key, {
        event_type: 'focusblock.v1.impression',
        asset_type: 'data_center',
        project_id: dataCenterFocus.projectId || null,
        county: dataCenterFocus.county || null,
        state: dataCenterFocus.county ? 'TX' : null,
        query_text: dataCenterFocus.name || dataCenterFocus.companyName || null
      });
      return;
    }

    if (variant === 'market' && market) {
      const label = String(market.locationLabel || '').slice(0, 80);
      const key = `market::${label}::${Number(market.radiusMiles || 0)}`;
      emitOnce(key, {
        event_type: 'focusblock.v1.impression',
        asset_type: 'market',
        project_id: null,
        county: null,
        state: 'TX',
        query_text: label || null
      });
    }
  }, [variant, dataCenterFocus?.projectId, dataCenterFocus?.name, dataCenterFocus?.county, market?.locationLabel, market?.radiusMiles, isTexasSupported]);

  if (!isTexasSupported) return null;

  if (variant === 'facility' && dataCenterFocus) {
    const plannedMw = formatMw(dataCenterFocus.plannedMw ?? dataCenterFocus.totalMw);
    const installedMw = formatMw(dataCenterFocus.installedMw);
    const typeLabel = dataCenterFocus.typeLabel || null;
    const signalMeta = buildSignalMeta(dataCenterFocus.sourceName, dataCenterFocus.publishedAt);
    const signalBadge = latestSignalBadgeStyle(dataCenterFocus.latestSignalKind);
    const locationLine = [dataCenterFocus.city, dataCenterFocus.county].filter(Boolean).join(', ')
      || dataCenterFocus.location
      || null;
    const badge = statusBadgeStyle(dataCenterFocus.statusLabel || dataCenterFocus.status);
    const metricItems = [
      plannedMw ? { label: 'Planned', value: plannedMw } : null,
      installedMw ? { label: 'Installed', value: installedMw } : null,
      typeLabel ? { label: 'Type', value: typeLabel } : null
    ].filter(Boolean);
    const detailItems = [
      dataCenterFocus.tenant ? { label: 'Tenant', value: dataCenterFocus.tenant } : null,
      dataCenterFocus.powerSource ? { label: 'Power Source', value: dataCenterFocus.powerSource } : null
    ].filter(Boolean);
    const multipleFacilities = Array.isArray(multiple?.facilities) ? multiple.facilities : [];
    const visibleMultipleFacilities = showAllMultipleFacilities
      ? multipleFacilities
      : multipleFacilities.slice(0, 5);
    const hiddenMultipleFacilityCount = Math.max(0, multipleFacilities.length - visibleMultipleFacilities.length);
    const handleScrollToMultiple = () => {
      multipleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
      <div className={className} style={blockStyle}>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}>
            <div style={{ ...badge, flexShrink: 0, borderRadius: '999px', padding: '4px 8px', fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {dataCenterFocus.statusLabel || dataCenterFocus.status || 'Unknown'}
            </div>
            {nearbySiteCount > 0 && (
              <button
                type="button"
                onClick={handleScrollToMultiple}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  border: isBadgePulsing
                    ? '1px solid rgba(250,204,21,0.7)'
                    : '1px solid rgba(96,165,250,0.45)',
                  background: isBadgePulsing
                    ? 'rgba(234,179,8,0.2)'
                    : 'rgba(59,130,246,0.16)',
                  color: isBadgePulsing ? '#fde68a' : '#bfdbfe',
                  fontSize: '10px',
                  fontWeight: 800,
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transform: isBadgePulsing ? 'scale(1.16)' : 'scale(1)',
                  boxShadow: isBadgePulsing
                    ? '0 0 0 3px rgba(250,204,21,0.18)'
                    : 'none',
                  transition: 'transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease'
                }}
                title={`${nearbySiteCount} other site${nearbySiteCount === 1 ? '' : 's'} in current radius`}
              >
                {nearbySiteCount}+
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', minWidth: 0 }}>
              <div
                style={{
                  color: 'rgba(241,245,249,0.98)',
                  fontWeight: 800,
                  fontSize: isMobile ? '18px' : '19px',
                  lineHeight: 1.15,
                  minWidth: 0,
                  flex: '1 1 auto',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={dataCenterFocus.companyName || dataCenterFocus.name}
              >
                {dataCenterFocus.companyName || dataCenterFocus.name}
              </div>
            </div>
            {locationLine && (
              <div style={{ color: 'rgba(191,219,254,0.82)', fontSize: '12px', marginTop: '6px' }}>
                {locationLine}
              </div>
            )}
          </div>
          </div>
        </div>

        <div style={dividerStyle} />

        {metricItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricItems.length}, minmax(0, 1fr))`, gap: '10px' }}>
            {metricItems.map((item) => (
              <div key={item.label}>
                <div style={labelStyle}>{item.label}</div>
                <div style={valueStyle}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {detailItems.length > 0 && (
          <>
            <div style={dividerStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${detailItems.length}, minmax(0, 1fr))`, gap: '10px' }}>
              {detailItems.map((item) => (
                <div key={item.label}>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={valueStyle}>{item.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {multiple && Number(multiple?.facilityCount || 0) > 1 && (
          <>
            <div style={dividerStyle} />
            <div ref={multipleSectionRef}>
              <div style={{ ...labelStyle, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span>Multiple facilities in radius</span>
                <span style={{ color: 'rgba(191,219,254,0.84)', fontSize: '11px' }}>
                  {isMultipleExpanded ? 'Hide list' : 'Show list'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0 }}>
                <div>
                  <button
                    type="button"
                    onClick={handleMultipleExpandedToggle}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={summaryTileStyle}>
                      <div
                        style={{
                          ...valueStyle,
                          ...(isMultipleExpanded ? { color: '#fde68a', fontWeight: 900 } : marketValueStyle('facilities')),
                          fontSize: isMobile ? '24px' : '26px',
                          lineHeight: 1.02,
                          letterSpacing: '-0.02em'
                        }}
                      >
                        {Number(multiple?.facilityCount || 0).toLocaleString()}
                      </div>
                      <div style={{ ...labelStyle, fontSize: '11px', letterSpacing: '0.1em' }}>
                        Facilities within {Math.round(Number(multiple?.radiusMiles || 0)).toLocaleString()} mi
                      </div>
                    </div>
                  </button>
                </div>

                {isMultipleExpanded && visibleMultipleFacilities.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    <div style={{ display: 'grid', gap: '8px', padding: '10px 0' }}>
                  {visibleMultipleFacilities.map((site, index) => {
                    const key = site.projectId || `${site.lat},${site.lng}`;
                    const metaParts = [
                      formatMw(site.plannedMw ?? site.totalMw),
                      site.status || null,
                      site.tenant ? `tenant: ${site.tenant}` : null
                    ].filter(Boolean);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSiteSelect(site)}
                        style={{
                          textAlign: 'left',
                          border: activeSiteKey === key
                            ? '1px solid rgba(96,165,250,0.55)'
                            : '1px solid rgba(148,163,184,0.16)',
                          background: activeSiteKey === key
                            ? 'rgba(30,64,175,0.22)'
                            : 'rgba(15,23,42,0.22)',
                          borderRadius: '8px',
                          padding: '8px 9px',
                          cursor: 'pointer',
                          transform: activeSiteKey === key ? 'scale(0.985)' : 'scale(1)',
                          boxShadow: activeSiteKey === key
                            ? '0 0 0 1px rgba(147,197,253,0.18) inset'
                            : 'none',
                          transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
                          animation: `locationFocusRollIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ color: 'rgba(241,245,249,0.96)', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>
                            {site.displayName || 'Data center project'}
                          </div>
                          <div style={{ color: 'rgba(191,219,254,0.88)', fontSize: '12px', flexShrink: 0 }}>
                            {formatDistance(site.distanceMi) || ''}
                          </div>
                        </div>
                        {(site.city || site.county) && (
                          <div style={{ color: 'rgba(148,163,184,0.82)', fontSize: '11px', marginTop: '3px' }}>
                            {[site.city, site.county].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {metaParts.length > 0 && (
                          <div style={{ color: 'rgba(203,213,225,0.88)', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
                            {metaParts.join(' · ')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {hiddenMultipleFacilityCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMultipleFacilities(true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        textAlign: 'left',
                        color: 'rgba(147,197,253,0.92)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      + {hiddenMultipleFacilityCount.toLocaleString()} more
                    </button>
                  )}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={summaryTileStyle}>
                    <div style={{ ...valueStyle, ...marketValueStyle('planned'), fontSize: isMobile ? '24px' : '26px', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
                      {formatMw(multiple?.plannedMwTotal) || '0 MW'}
                    </div>
                    <div style={{ ...labelStyle, fontSize: '11px', letterSpacing: '0.1em' }}>Planned</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={summaryTileStyle}>
                    <div style={{ ...valueStyle, ...marketValueStyle('operational'), fontSize: isMobile ? '24px' : '26px', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
                      {Number(multiple?.operationalCount || 0).toLocaleString()}
                    </div>
                    <div style={{ ...labelStyle, fontSize: '11px', letterSpacing: '0.1em' }}>Operational</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!multiple && showNearestDataCenterFallback && onNearestDataCenterAction && (
          <>
            <div style={dividerStyle} />
            <button
              type="button"
              onClick={() => {
                try {
                  logUiEvent({
                    event_type: 'focusblock.v1.nearest_dc_click',
                    asset_type: 'data_center',
                    project_id: dataCenterFocus?.projectId || null,
                    county: dataCenterFocus?.county || null,
                    state: dataCenterFocus?.county ? 'TX' : null,
                    query_text: dataCenterFocus?.name || dataCenterFocus?.companyName || null
                  });
                } catch {}
                onNearestDataCenterAction?.();
              }}
              style={{
                width: '100%',
                border: '1px solid rgba(96,165,250,0.24)',
                background: 'rgba(15,23,42,0.2)',
                borderRadius: '10px',
                padding: '11px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.12s ease'
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(30,64,175,0.16)';
                event.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'rgba(15,23,42,0.2)';
                event.currentTarget.style.borderColor = 'rgba(96,165,250,0.24)';
              }}
              onMouseDown={(event) => {
                event.currentTarget.style.transform = 'scale(0.992)';
              }}
              onMouseUp={(event) => {
                event.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ ...valueStyle, color: '#bfdbfe', fontSize: '13px' }}>
                Tap to nearest data center
              </div>
            </button>
          </>
        )}

        <div style={{ ...dividerStyle, marginTop: '24px', marginBottom: '18px' }} />

        <div style={{ paddingTop: '4px', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={labelStyle}>Latest signal</div>
            {signalBadge && (
              <div
                style={{
                  borderRadius: '999px',
                  padding: '2px 7px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  ...signalBadge
                }}
              >
                {signalBadge.label}
              </div>
            )}
          </div>
          {dataCenterFocus.articleTitle ? (
            <>
              {dataCenterFocus.sourceUrl ? (
                <a
                  href={dataCenterFocus.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    try {
                      logUiEvent({
                        event_type: 'focusblock.v1.latest_signal_click',
                        asset_type: 'data_center',
                        project_id: dataCenterFocus?.projectId || null,
                        county: dataCenterFocus?.county || null,
                        state: dataCenterFocus?.county ? 'TX' : null,
                        query_text: dataCenterFocus?.articleTitle || null
                      });
                    } catch {}
                    onHeadlineClick?.(dataCenterFocus, event);
                  }}
                  style={{ color: 'rgba(226,232,240,0.98)', fontSize: '13px', lineHeight: 1.5, textDecoration: 'none', display: 'block', marginTop: '6px' }}
                >
                  {dataCenterFocus.articleTitle}
                </a>
              ) : (
                <div style={{ color: 'rgba(226,232,240,0.98)', fontSize: '13px', lineHeight: 1.5, marginTop: '6px' }}>
                  {dataCenterFocus.articleTitle}
                </div>
              )}
              {signalMeta && (
                <div style={{ color: 'rgba(148,163,184,0.78)', fontSize: '11px', marginTop: '5px' }}>
                  {signalMeta}
                </div>
              )}
              {dataCenterFocus.latestSignalSummary && (
                <div style={{ color: 'rgba(203,213,225,0.88)', fontSize: '12px', lineHeight: 1.55, marginTop: '7px' }}>
                  {dataCenterFocus.latestSignalSummary}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'rgba(148,163,184,0.78)', fontSize: '12px', lineHeight: 1.5, marginTop: '6px' }}>
              Latest signal placeholder. News enrichment will populate this section when article workflows are connected.
            </div>
          )}
        </div>
      </div>
    );
  }

  const marketFacilities = Array.isArray(market?.displayFacilities) ? market.displayFacilities : [];
  const visibleMarketFacilities = showAllMarketFacilities ? marketFacilities : marketFacilities.slice(0, 5);
  const hiddenMarketFacilityCount = Math.max(0, Number(market?.facilityCount || 0) - visibleMarketFacilities.length);
  const plannedFacilities = [...marketFacilities].sort((a, b) => {
    const aMw = Number(a?.plannedMw ?? a?.totalMw ?? 0);
    const bMw = Number(b?.plannedMw ?? b?.totalMw ?? 0);
    if (aMw !== bMw) return bMw - aMw;
    const aDistance = Number.isFinite(Number(a?.distanceMi)) ? Number(a.distanceMi) : Number.POSITIVE_INFINITY;
    const bDistance = Number.isFinite(Number(b?.distanceMi)) ? Number(b.distanceMi) : Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
  const visiblePlannedFacilities = showAllMarketPlannedFacilities ? plannedFacilities : plannedFacilities.slice(0, 5);
  const hiddenPlannedFacilityCount = Math.max(0, plannedFacilities.length - visiblePlannedFacilities.length);
  const onsiteGasFacilities = marketFacilities.filter((site) => String(site?.powerSource || '').trim());
  const onsiteGasDisplayCount = onsiteGasFacilities.length;
  const visibleOnsiteGasFacilities = showAllMarketOnsiteGasFacilities ? onsiteGasFacilities : onsiteGasFacilities.slice(0, 5);
  const hiddenOnsiteGasFacilityCount = Math.max(0, onsiteGasFacilities.length - visibleOnsiteGasFacilities.length);

  const renderMarketMetricRow = (site, index, detailOverride = null) => {
    const key = site.projectId || `${site.lat},${site.lng}`;
    const summaryParts = [
      formatMw(site.plannedMw ?? site.totalMw),
      site.status || null,
      site.tenant || site.endUser || null
    ].filter(Boolean);
    const detailLine = detailOverride || site.powerSource || site.city || site.location || null;
    return (
      <button
        key={key}
        type="button"
        onClick={() => handleSiteSelect(site)}
        style={{
          textAlign: 'left',
          border: 'none',
          background: activeSiteKey === key
            ? 'rgba(15,23,42,0.9)'
            : 'rgba(15,23,42,0.86)',
          borderRadius: '8px',
          padding: '8px 9px',
          cursor: 'pointer',
          transform: activeSiteKey === key ? 'scale(0.985)' : 'scale(1)',
          boxShadow: activeSiteKey === key
            ? '0 0 0 1px rgba(147,197,253,0.3) inset'
            : 'none',
          transition: 'background 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
          animation: `locationFocusRollIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ color: 'rgba(241,245,249,0.96)', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>
            {site.displayName || 'Data center project'}
          </div>
          <div style={{ color: 'rgba(191,219,254,0.88)', fontSize: '12px', flexShrink: 0 }}>
            {site?.matchSource === 'place_fallback' ? '' : (formatDistance(site.distanceMi) || '')}
          </div>
        </div>
        {(site.city || site.county) && (
          <div style={{ color: 'rgba(148,163,184,0.82)', fontSize: '11px', marginTop: '3px' }}>
            {site.city || [site.city, site.county].filter(Boolean).join(', ')}
          </div>
        )}
        {summaryParts.length > 0 && (
          <div style={{ color: 'rgba(203,213,225,0.88)', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
            {summaryParts.join(' · ')}
          </div>
        )}
        {detailLine && (
          <div style={{ color: '#bfdbfe', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
            {detailLine}
          </div>
        )}
      </button>
    );
  };

  const renderMarketInsightRow = (site, index, options = {}) => {
    const mwLabel = formatMw(site.plannedMw ?? site.totalMw);
    const topRight = options.topRight || null;
    const primary = options.primary
      || [mwLabel, site.status || null, site.tenant || site.endUser || null].filter(Boolean).join(' · ');
    const secondary = options.secondary
      || site.powerSource
      || site.city
      || site.location
      || null;

    return (
      <button
        key={site.projectId || `${site.lat},${site.lng}`}
        type="button"
        onClick={() => handleSiteSelect(site)}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '8px 0',
          textAlign: 'left',
          cursor: 'pointer',
          borderBottom: index === (options.lastIndex ?? -1) ? 'none' : '1px solid rgba(148,163,184,0.12)',
          animation: `locationFocusRollIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.04}s both`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ color: 'rgba(241,245,249,0.96)', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>
            {site.displayName || 'Data center project'}
          </div>
          {topRight && (
            <div style={{ color: 'rgba(191,219,254,0.88)', fontSize: '11px', flexShrink: 0 }}>
              {topRight}
            </div>
          )}
        </div>
        {primary && (
          <div style={{ color: 'rgba(203,213,225,0.88)', fontSize: '11px', marginTop: '4px', lineHeight: 1.45 }}>
            {primary}
          </div>
        )}
        {secondary && (
          <div style={{ color: '#bfdbfe', fontSize: '11px', marginTop: '3px', lineHeight: 1.45 }}>
            {secondary}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className={className} style={blockStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ color: 'rgba(241,245,249,0.98)', fontWeight: 800, fontSize: isMobile ? '17px' : '18px', lineHeight: 1.1 }}>
          {String(market?.locationLabel || 'SEARCH RESULTS').split(',')[0].trim()} · {Math.round(Number(market?.radiusMiles || 0)).toLocaleString()} mi radius
        </div>
      </div>

      <div style={dividerStyle} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0 }}>
        {Number(market?.facilityCount || 0) > 0 && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                type="button"
                onClick={handleMarketPlannedToggle}
                style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: plannedFacilities.length > 0 ? 'pointer' : 'default' }}
              >
                <div style={summaryTileStyle}>
                  <div style={{
                    ...valueStyle,
                    ...(isMarketPlannedExpanded ? { color: '#fde68a', fontWeight: 900 } : marketValueStyle('planned')),
                    fontSize: isMobile ? '28px' : '30px',
                    lineHeight: 1.02,
                    letterSpacing: '-0.03em',
                    animation: isPlannedPulsing ? 'locationFocusPlannedPulse 1s ease-out' : 'none'
                  }}>
                    {formatMw(market?.plannedMwTotal) || '0 MW'}
                  </div>
                  <div style={{ ...labelStyle, fontSize: '11px', letterSpacing: '0.1em' }}>
                    <span>Planned</span>
                  </div>
                  {(() => {
                    const candidate = market?.topPlannedFacility || plannedFacilities[0] || null;
                    if (!candidate) return null;
                    const topPlannedName = candidate.displayName || 'Top project';
                    const topPlannedMw = formatMw(candidate.plannedMw ?? candidate.totalMw);
                    const topTenant = candidate.tenant || candidate.endUser || null;
                  const parts = [
                      topPlannedName,
                      topPlannedMw,
                      topTenant ? `tenant: ${topTenant}` : null
                    ].filter(Boolean);
                    if (parts.length === 0) return null;
                    return (
                      <div
                        style={{
                          color: 'rgba(203,213,225,0.92)',
                          fontSize: '11px',
                          marginTop: '4px',
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          animation: isPlannedPulsing ? 'locationFocusPlannedPulse 1s ease-out' : 'none'
                        }}
                      >
                        {parts.join(' · ')}
                      </div>
                    );
                  })()}
                </div>
              </button>
            </div>
            {isMarketPlannedExpanded && visiblePlannedFacilities.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ display: 'grid', gap: '8px', padding: '10px 0' }}>
                  {visiblePlannedFacilities.map((site, index) => renderMarketInsightRow(site, index, {
                    topRight: formatMw(site.plannedMw ?? site.totalMw),
                    primary: [site.status || null, site.tenant || site.endUser || null].filter(Boolean).join(' · '),
                    secondary: site.powerSource || site.city || site.location || null,
                    lastIndex: visiblePlannedFacilities.length - 1
                  }))}
                  {hiddenPlannedFacilityCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMarketPlannedFacilities(true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        marginTop: '2px',
                        textAlign: 'left',
                        color: 'rgba(147,197,253,0.92)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      + {hiddenPlannedFacilityCount.toLocaleString()} more
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div
          style={Number(market?.facilityCount || 0) > 0
            ? { borderTop: '1px solid rgba(255,255,255,0.12)' }
            : undefined}
        >
          {Number(market?.facilityCount || 0) === 0 && onNearestDataCenterAction ? (
            <button
              type="button"
              onClick={() => {
                try {
                  logUiEvent({
                    event_type: 'focusblock.v1.nearest_dc_click',
                    asset_type: 'market',
                    county: null,
                    state: 'TX',
                    project_id: null,
                    query_text: 'market_no_facilities'
                  });
                } catch {}
                onNearestDataCenterAction?.();
              }}
              style={{
                width: '100%',
                border: '1px solid rgba(96,165,250,0.24)',
                background: 'rgba(15,23,42,0.2)',
                borderRadius: '10px',
                padding: '11px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.12s ease'
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(30,64,175,0.16)';
                event.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'rgba(15,23,42,0.2)';
                event.currentTarget.style.borderColor = 'rgba(96,165,250,0.24)';
              }}
              onMouseDown={(event) => {
                event.currentTarget.style.transform = 'scale(0.992)';
              }}
              onMouseUp={(event) => {
                event.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ ...valueStyle, color: '#bfdbfe', fontSize: '13px' }}>
                Tap to nearest data center
              </div>
            </button>
          ) : (
            <button
              data-tour="focus-facilities"
              type="button"
              onClick={handleMarketFacilitiesToggle}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: Number(market?.facilityCount || 0) > 0 ? 'pointer' : 'default'
              }}
            >
              <div style={summaryTileStyle}>
                <div
                  style={{
                    ...valueStyle,
                    ...(isMarketFacilitiesExpanded ? { color: '#fde68a', fontWeight: 900 } : marketValueStyle('facilities')),
                    fontSize: isMobile ? '28px' : '30px',
                    lineHeight: 1.02,
                    letterSpacing: '-0.03em'
                  }}
                >
                  {Number(market?.facilityCount || 0).toLocaleString()}
                </div>
                <div style={{ ...labelStyle, fontSize: '11px', letterSpacing: '0.1em' }}>
                  <span>Facilities</span>
                </div>
                {(() => {
                  const candidate = market?.topPlannedFacility || marketFacilities[0] || null;
                  if (!candidate) return null;
                  const name = candidate.displayName || 'Top facility';
                  const mwLabel = formatMw(candidate.plannedMw ?? candidate.totalMw);
                  const tenant = candidate.tenant || candidate.endUser || null;
                  const parts = [
                    name,
                    mwLabel,
                    tenant ? `tenant: ${tenant}` : null
                  ].filter(Boolean);
                  if (parts.length === 0) return null;
                  return (
                    <div
                      style={{
                        color: 'rgba(203,213,225,0.92)',
                        fontSize: '11px',
                        marginTop: '4px',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {parts.join(' · ')}
                    </div>
                  );
                })()}
              </div>
            </button>
          )}
        </div>
        {isMarketFacilitiesExpanded && visibleMarketFacilities.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'grid', gap: '8px', padding: '10px 0' }}>
              {visibleMarketFacilities.map((site, index) => renderMarketMetricRow(site, index))}
              {hiddenMarketFacilityCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMarketFacilities(true)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    marginTop: '2px',
                    textAlign: 'left',
                    color: 'rgba(147,197,253,0.92)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  + {hiddenMarketFacilityCount.toLocaleString()} more
                </button>
              )}
            </div>
          </div>
        )}
        {onsiteGasDisplayCount > 0 && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                type="button"
                onClick={handleMarketOnsiteGasToggle}
                style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: onsiteGasFacilities.length > 0 ? 'pointer' : 'default' }}
              >
                  <div style={summaryTileStyle}>
                  <div style={{ ...valueStyle, ...(isMarketOnsiteGasExpanded ? { color: '#fde68a', fontWeight: 900 } : marketValueStyle('operational')), fontSize: isMobile ? '28px' : '30px', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
                    {onsiteGasDisplayCount.toLocaleString()}
                  </div>
                  <div style={{
                    ...labelStyle,
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <span>Onsite gas</span>
                    {onsiteGasDisplayCount > 0 && (
                      <span style={{ color: 'rgba(191,219,254,0.84)', fontSize: '11px' }}>
                        {isMarketOnsiteGasExpanded ? 'Hide' : 'Show'}
                      </span>
                    )}
                  </div>
                  {onsiteGasFacilities.length > 0 && (
                    <div
                      style={{
                        color: 'rgba(203,213,225,0.92)',
                        fontSize: '11px',
                        marginTop: '4px',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {(onsiteGasFacilities[0].displayName || 'Top site')}
                      {formatMw(onsiteGasFacilities[0].plannedMw ?? onsiteGasFacilities[0].totalMw)
                        ? ` · ${formatMw(onsiteGasFacilities[0].plannedMw ?? onsiteGasFacilities[0].totalMw)}`
                        : ''}
                    </div>
                  )}
                </div>
              </button>
            </div>
            {isMarketOnsiteGasExpanded && visibleOnsiteGasFacilities.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ display: 'grid', gap: '8px', padding: '10px 0' }}>
                  {visibleOnsiteGasFacilities.map((site, index) => renderMarketInsightRow(site, index, {
                    topRight: formatMw(site.plannedMw ?? site.totalMw),
                    primary: site.powerSource || null,
                    secondary: [site.status || null, site.tenant || site.endUser || site.city || site.location || null].filter(Boolean).join(' · '),
                    lastIndex: visibleOnsiteGasFacilities.length - 1
                  }))}
                  {hiddenOnsiteGasFacilityCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMarketOnsiteGasFacilities(true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        marginTop: '2px',
                        textAlign: 'left',
                        color: 'rgba(147,197,253,0.92)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      + {hiddenOnsiteGasFacilityCount.toLocaleString()} more
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div style={{ ...dividerStyle, marginTop: '14px' }} />
      </div>
    </div>
  );
};

export default LocationFocusBlock;
