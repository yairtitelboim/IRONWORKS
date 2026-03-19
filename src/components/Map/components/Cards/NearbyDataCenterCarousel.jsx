import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Opposition from './opposition';
import SharePreviewCard from './SharePreviewCard';
import { generateShareBullets, getRelevantLinks } from './carouselShareUtils';

const style = document.createElement('style');
style.textContent = `
  @keyframes flash-outline {
    0%, 100% {
      border-color: rgba(96, 165, 250, 0.3);
      box-shadow: 0 0 0 0 rgba(96, 165, 250, 0);
      background-color: transparent;
    }
    50% {
      border-color: rgba(96, 165, 250, 1);
      box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.3), 0 0 30px rgba(96, 165, 250, 0.6);
      background-color: rgba(96, 165, 250, 0.08);
    }
  }
  @keyframes carousel-expand-red-pulse {
    0% {
      border-color: rgba(248, 113, 113, 0.35);
      background-color: rgba(15, 23, 42, 0.4);
      color: rgba(254, 226, 226, 0.86);
      box-shadow: 0 0 0 0 rgba(248, 113, 113, 0);
    }
    35% {
      border-color: rgba(248, 113, 113, 0.95);
      background-color: rgba(127, 29, 29, 0.32);
      color: rgba(254, 242, 242, 0.98);
      box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.28), 0 0 18px rgba(248, 113, 113, 0.36);
    }
    100% {
      border-color: rgba(148, 163, 184, 0.3);
      background-color: rgba(15, 23, 42, 0.4);
      color: rgba(226,232,240,0.75);
      box-shadow: 0 0 0 0 rgba(248, 113, 113, 0);
    }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('carousel-highlight-animation')) {
  style.id = 'carousel-highlight-animation';
  document.head.appendChild(style);
}

function NearbyDataCenterCarousel({
  sites = [],
  selectedSiteKey,
  flippedSiteKey,
  highlightSiteKey,
  onSelect,
  onDeselect,
  onSiteView,
  onScrollToOpposition,
  oppositionProps = {},
  emitAnalyticsEvent = () => {},
  isTexasSupported = true,
  searchedPlace = ''
}) {
  const carouselRef = useRef(null);
  const [expandedOppositionSiteKey, setExpandedOppositionSiteKey] = useState(null);
  const [highlightedSiteKey, setHighlightedSiteKey] = useState(null);
  const formatDistanceMi = useCallback((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(1)} mi` : 'Place match';
  }, []);
  const formatMw = useCallback((site) => {
    const planned = Number(site?.plannedMw);
    const total = Number(site?.totalMw ?? site?.sizeMw);
    if (Number.isFinite(planned) && planned > 0) return `${Math.round(planned).toLocaleString()} MW`;
    if (Number.isFinite(total) && total > 0) return `${Math.round(total).toLocaleString()} MW`;
    return null;
  }, []);
  const getContextLine = useCallback((site) => {
    if (site?.tenant) return `Tenant: ${site.tenant}`;
    if (site?.endUser) return `End user: ${site.endUser}`;
    if (site?.powerSource) return `Power: ${site.powerSource}`;
    if (site?.typeLabel || site?.type) return `Type: ${site.typeLabel || site.type}`;
    return null;
  }, []);

  useEffect(() => {
    if (highlightSiteKey) {
      setHighlightedSiteKey(highlightSiteKey);
      const timer = setTimeout(() => {
        setHighlightedSiteKey(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightSiteKey]);

  const distanceScale = useMemo(() => {
    if (!sites.length) return { min: 0, span: 1 };
    const distances = sites
      .map((site) => Number(site.distanceMi))
      .filter((d) => Number.isFinite(d));
    if (!distances.length) return { min: 0, span: 1 };
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    return { min, span: Math.max(max - min, 0.001) };
  }, [sites]);

  const scrollToCenter = useCallback((id) => {
    if (!id || !carouselRef.current) return;
    const el = carouselRef.current;
    const escapedId = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(String(id))
      : String(id).replace(/"/g, '\\"');
    const card = el.querySelector(`[data-nearby-site-id="${escapedId}"]`);
    if (!card) return;
    const targetLeft = card.offsetLeft - (el.clientWidth / 2) + (card.clientWidth / 2);
    el.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth'
    });
  }, []);

  useEffect(() => {
    if (!selectedSiteKey || !flippedSiteKey) return;
    scrollToCenter(selectedSiteKey);
    const t = setTimeout(() => scrollToCenter(selectedSiteKey), 350);
    return () => clearTimeout(t);
  }, [selectedSiteKey, flippedSiteKey, sites, scrollToCenter]);

  useEffect(() => {
    if (highlightedSiteKey) {
      scrollToCenter(highlightedSiteKey);
    }
  }, [highlightedSiteKey, scrollToCenter]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !sites.length) return;
    let scrollTimer = null;
    let hasScrolled = false;
    const handleScroll = () => {
      if (!hasScrolled) {
        hasScrolled = true;
        emitAnalyticsEvent('nearby_carousel_scrolled', { totalSites: sites.length });
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const scrollPct = el.scrollWidth > el.clientWidth
          ? Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 100)
          : 0;
        emitAnalyticsEvent('nearby_carousel_scroll_depth', { scrollPct, totalSites: sites.length });
      }, 400);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimer);
    };
  }, [sites, emitAnalyticsEvent]);

  if (!sites.length) return null;

  return (
    <div
      ref={carouselRef}
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}
    >
      {sites.map((site) => {
        const siteKey = site.projectId || `${site.lat},${site.lng}`;
        const isSelected = selectedSiteKey != null && selectedSiteKey === siteKey;
        const isFlipped = flippedSiteKey === siteKey;
        const isHighlighted = highlightedSiteKey === siteKey;
        const distanceLabel = formatDistanceMi(site.distanceMi);
        const cityLabel = site.city || site.location || null;
        const mwLabel = formatMw(site);
        const statusLabel = site.status || null;
        const summaryLine = [mwLabel, statusLabel].filter(Boolean).join(' · ');
        const contextLine = getContextLine(site);
        const normalizedDistance = Math.min(
          1,
          Math.max(0, (Number(site.distanceMi) - distanceScale.min) / distanceScale.span)
        );
        const fillAlpha = (0.26 - normalizedDistance * 0.14).toFixed(3);
        const baseBackground = `linear-gradient(135deg, rgba(239, 68, 68, ${fillAlpha}) 0%, rgba(15, 23, 42, 0.2) 100%)`;
        const selectedBackground = `linear-gradient(135deg, rgba(239, 68, 68, ${Math.max(Number(fillAlpha) + 0.14, 0.22).toFixed(3)}) 0%, rgba(15, 23, 42, 0.3) 100%)`;

        const handleCardClick = () => {
          if (isFlipped) {
            onDeselect?.();
            setExpandedOppositionSiteKey(null);
          } else {
            onSelect?.(site);
            setExpandedOppositionSiteKey(null);
          }
        };

        return (
          <div
            key={`${site.lat}-${site.lng}-${site.rank}`}
            data-nearby-site-id={siteKey}
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }}
            style={{
              minWidth: (isSelected || isFlipped) ? '200px' : '100px',
              minHeight: isFlipped ? '202px' : '168px',
              perspective: '600px',
              cursor: 'pointer',
              transition: 'min-width 0.3s ease, min-height 0.3s ease',
              filter: isHighlighted ? 'brightness(1.1)' : 'none'
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: isFlipped ? '202px' : '168px',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s ease'
              }}
            >
              {/* Front face */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  border: isHighlighted
                    ? '2px solid rgba(96, 165, 250, 0.3)'
                    : isSelected 
                      ? '1px solid rgba(248,113,113,0.92)' 
                      : '1px solid rgba(248,113,113,0.34)',
                  borderRadius: '9px',
                  padding: '7px',
                  background: isSelected ? selectedBackground : baseBackground,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isHighlighted
                    ? '0 0 0 0 rgba(96, 165, 250, 0)'
                    : isSelected 
                      ? '0 0 0 1px rgba(248,113,113,0.34), 0 8px 24px rgba(127,29,29,0.3)' 
                      : 'none',
                  animation: isHighlighted ? 'flash-outline 1s ease-in-out 3' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '10.5px', fontWeight: 700 }}>{distanceLabel}</span>
                </div>
                <div style={{ color: 'rgba(226,232,240,0.82)', fontSize: '10px', lineHeight: 1.35, flex: 1 }}>
                  <div
                    style={{
                      color: '#f1f5f9',
                      fontWeight: 700,
                      marginBottom: '3px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.22
                    }}
                  >
                    {site.displayName}
                  </div>
                  {cityLabel && (
                    <div style={{ color: 'rgba(203,213,225,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cityLabel}
                    </div>
                  )}
                  {summaryLine && (
                    <div style={{ color: 'rgba(226,232,240,0.92)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {summaryLine}
                    </div>
                  )}
                  {contextLine && (
                    <div style={{ color: '#bfdbfe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contextLine}
                    </div>
                  )}
                  {!summaryLine && statusLabel && (
                    <div style={{ color: 'rgba(226,232,240,0.92)', textTransform: 'capitalize', fontWeight: 600 }}>
                      {statusLabel}
                    </div>
                  )}
                  {site.owner && site.owner !== site.displayName && site.owner !== site.location && !contextLine && (
                    <div style={{ color: 'rgba(203,213,225,0.82)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {site.owner}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSiteView?.(site);
                  }}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    border: '1px solid rgba(248,113,113,0.44)',
                    borderRadius: '6px',
                    background: 'rgba(31, 41, 55, 0.45)',
                    color: '#e2e8f0',
                    padding: '3px 0',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  View
                </button>
              </div>

              {/* Back face - Share Preview or Full Opposition */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  border: '1px solid rgba(248,113,113,0.34)',
                  borderRadius: '9px',
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.95)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {expandedOppositionSiteKey === siteKey ? (
                  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px', minHeight: 0 }}>
                    {isTexasSupported && (
                      <Opposition
                        {...oppositionProps}
                        nearbySites={sites}
                        selectedSite={site}
                        hideNearbyButton
                      />
                    )}
                  </div>
                ) : (
                  <SharePreviewCard
                    title={site.displayName || 'Data center project'}
                    subtitle={site.city || site.location || ''}
                    bullets={generateShareBullets(site, oppositionProps, searchedPlace)}
                    relevantLinks={getRelevantLinks(site, oppositionProps)}
                    highlightExpandPulse={isFlipped}
                    onExpandPreview={() => {
                      oppositionProps?.onRequestMobileFullscreen?.();
                      emitAnalyticsEvent('carousel_full_opposition_opened', {
                        siteKey,
                        displayName: site.displayName,
                        trigger: 'expand_button'
                      });
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default NearbyDataCenterCarousel;
