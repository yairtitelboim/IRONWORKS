import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logEvent, createOncePerKeyEmitter } from '../../../../services/analyticsApi';

const descriptorColor = 'rgba(148,163,184,0.72)';
const labelColor = 'rgba(203,213,225,0.62)';
const valueColor = '#e2e8f0';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const isHyperscalerName = (value) => {
  const name = String(value || '').toLowerCase();
  if (!name) return false;
  return (
    name.includes('amazon') ||
    name.includes('aws') ||
    name.includes('microsoft') ||
    name.includes('meta') ||
    name.includes('google') ||
    name.includes('oracle')
  );
};

const deriveBlockedWeightFromStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (!s) return 25;
  if (s.includes('blocked') || s.includes('denied') || s.includes('withdrawn')) return 100;
  if (s.includes('oppose') || s.includes('rejected') || s.includes('moratorium') || s.includes('stalled')) return 82;
  if (s.includes('announced') || s.includes('proposed')) return 48;
  if (s.includes('permit') || s.includes('permitting')) return 35;
  if (s.includes('construction') || s.includes('under construction')) return 22;
  if (s.includes('operational') || s.includes('active')) return 12;
  if (s.includes('unknown') || s.includes('uncertain')) return 25;
  return 28;
};

const formatMwCompact = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1000) return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
  if (n >= 100) return `${n.toFixed(0)} MW`;
  return `${n.toFixed(1)} MW`;
};

const Opposition = ({
  metricsStatusLabel,
  activeQueueVsErcot,
  queueMetrics,
  hasRealQueueMetrics = false,
  nearbySites = [],
  selectedSite = null,
  onNearbyAction,
  onClusterAction,
  onNearestDataCenterAction,
  onExpandAction,
  onBlockedAction,
  onSequenceAction,
  circleStats = null,
  latestSelectedDataCenter = null,
  forceOpenClusterToken = 0,
  modeledBlockedRate = null,
  modeledQueueWithdrawnCount = null,
  modeledQueueTotalCount = null,
  isTexasSupportedAddress = true,
  texasSupportNote = 'Currently supporting Texas locations only. Try a TX address.',
  hideNearbyButton = false,
  onHeadlineClick = null,
  coordStr = null,
}) => {
  const [isClusterExpanded, setIsClusterExpanded] = useState(false);
  const [isClusterContentLoading, setIsClusterContentLoading] = useState(false);
  const [showClusterHalo, setShowClusterHalo] = useState(false);
  const [isClusterSelected, setIsClusterSelected] = useState(false);
  const [clusterCopyStatus, setClusterCopyStatus] = useState('idle');
  const [isBlockedExpanded, setIsBlockedExpanded] = useState(false);
  const [showBlockedHalo, setShowBlockedHalo] = useState(false);
  const [isBlockedSelected, setIsBlockedSelected] = useState(false);
  const [blockedCopyStatus, setBlockedCopyStatus] = useState('idle');
  const [isSequenceExpanded, setIsSequenceExpanded] = useState(false);
  const [showSequenceHalo, setShowSequenceHalo] = useState(false);
  const [isSequenceSelected, setIsSequenceSelected] = useState(false);
  const [storyOpeningKey, setStoryOpeningKey] = useState(null);
  const clusterHaloTimeoutRef = useRef(null);
  const clusterContentTimeoutRef = useRef(null);
  const clusterCopyTimeoutRef = useRef(null);
  const blockedHaloTimeoutRef = useRef(null);
  const sequenceHaloTimeoutRef = useRef(null);
  const blockedCopyTimeoutRef = useRef(null);
  const storyOpenTimeoutRef = useRef(null);
  const suppressNextStateResetRef = useRef(false);
  const clusterCardRef = useRef(null);
  const [showClusterMapPulse, setShowClusterMapPulse] = useState(true);
  const lastForceOpenClusterTokenRef = useRef(0);
  const isOutOfTexas = !isTexasSupportedAddress;
  const statusKey = String(metricsStatusLabel || '').toLowerCase();
  const isPending = statusKey === 'pending';

  const analysis = useMemo(() => {
    const hasSelectedSite = Boolean(selectedSite);
    const selectedStatus = String(selectedSite?.status || '').toLowerCase();
    const selectedDistance = Number.isFinite(Number(selectedSite?.distanceMi))
      ? Number(selectedSite.distanceMi)
      : null;
    const selectedOwner = selectedSite?.owner || selectedSite?.displayName || '';
    const selectedIsHyperscaler = isHyperscalerName(selectedOwner);
    const poiCount = Number(queueMetrics?.nearestSubPoiCount || 0);
    const pressure = Number.isFinite(Number(activeQueueVsErcot)) ? Number(activeQueueVsErcot) : null;
    const withdrawn = Number(queueMetrics?.queueWithdrawnCount || 0);
    const total = Number(queueMetrics?.totalQueueCount || 0);
    const blockedRate = total > 0 ? Math.min(100, Math.max(0, (withdrawn / total) * 100)) : null;
    const modeledRate = Number.isFinite(Number(modeledBlockedRate))
      ? Math.min(100, Math.max(0, Number(modeledBlockedRate)))
      : null;
    const circleSites = Array.isArray(circleStats?.inCircleSites) ? circleStats.inCircleSites : [];
    const hasCircleSites = circleSites.length > 0;
    const circleBlockedWeights = hasCircleSites
      ? circleSites.map((site) => deriveBlockedWeightFromStatus(site?.status))
      : [];
    const circleBlockedRate = circleBlockedWeights.length > 0
      ? circleBlockedWeights.reduce((sum, value) => sum + value, 0) / circleBlockedWeights.length
      : null;
    const circleBlockedLikeCount = hasCircleSites
      ? circleSites.filter((site) => {
          const s = String(site?.status || '').toLowerCase();
          return s.includes('blocked') || s.includes('denied') || s.includes('withdrawn') || s.includes('oppose') || s.includes('rejected') || s.includes('moratorium') || s.includes('stalled');
        }).length
      : 0;
    const circleUnknownCount = hasCircleSites
      ? circleSites.filter((site) => {
          const s = String(site?.status || '').toLowerCase().trim();
          return !s || s.includes('unknown') || s.includes('uncertain');
        }).length
      : 0;
    const effectiveBlockedRate = hasCircleSites ? circleBlockedRate : (blockedRate ?? modeledRate);
    const blockedSource = hasCircleSites ? 'circle' : (blockedRate != null ? 'county' : (modeledRate != null ? 'modeled' : 'none'));
    const waitHigh = Number(queueMetrics?.estWaitMonthsHigh || 0);
    const announcedCount = Number(queueMetrics?.dataCenterAnnouncedCount || 0);
    const existingCount = Number(queueMetrics?.dataCenterExistingCount || 0);

    const ownerCounts = nearbySites.reduce((acc, site) => {
      const owner = String(site?.owner || '').trim();
      if (!owner) return acc;
      const key = owner.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const dominantOwnerCount = Math.max(0, ...Object.values(ownerCounts));
    const dominantOwnerShare = nearbySites.length > 0 ? dominantOwnerCount / nearbySites.length : 0;
    const hyperscalerCount = nearbySites.filter((site) => isHyperscalerName(site?.owner || site?.displayName)).length;
    const hyperscalerShare = nearbySites.length > 0 ? hyperscalerCount / nearbySites.length : 0;
    const ownerMatchCount = hasSelectedSite && selectedOwner
      ? nearbySites.filter((site) => String(site?.owner || '').trim().toLowerCase() === String(selectedOwner).trim().toLowerCase()).length
      : 0;

    const countyClusterScoreRaw =
      (pressure != null ? Math.min(4, pressure * 1.1) : 1.2) +
      Math.min(3, poiCount / 4) +
      Math.min(3, dominantOwnerShare * 4);
    const selectedClusterAdjustment =
      hasSelectedSite
        ? Math.max(0, 2.8 - Math.min(selectedDistance ?? 6, 12) / 4) + Math.min(1.8, ownerMatchCount * 0.9)
        : 0;
    const clusterScore = Math.max(1, Math.min(10, countyClusterScoreRaw + selectedClusterAdjustment));

    const clusterLabel = hasSelectedSite
      ? (clusterScore >= 7 ? 'site hotspot' : clusterScore >= 4.5 ? 'site in mixed zone' : 'site on edge')
      : (clusterScore >= 7 ? 'high cluster' : clusterScore >= 4.5 ? 'mixed cluster' : 'distributed');
    const blockedLabel = effectiveBlockedRate == null
      ? 'insufficient signal'
      : blockedSource === 'circle'
        ? 'circle signal'
        : !hasRealQueueMetrics
        ? 'modeled signal'
        : effectiveBlockedRate >= 38
          ? 'high friction'
          : effectiveBlockedRate >= 22
            ? 'moderate friction'
            : 'lower friction';
    const sequenceLabel = waitHigh >= 30 || (announcedCount > existingCount && announcedCount > 0)
      ? 'opposition likely before permit'
      : 'permit likely before opposition';

    const operatorLabel = hyperscalerShare >= 0.45
      ? 'hyperscaler-heavy'
      : hyperscalerShare >= 0.2
        ? 'mixed operator base'
        : 'smaller-operator weighted';

    const blockedWhy = effectiveBlockedRate == null
      ? 'Waiting for county-level queue withdrawals.'
      : blockedSource === 'circle'
        ? 'Using project statuses inside the selected circle to estimate opposition friction.'
        : !hasRealQueueMetrics
          ? 'Using a modeled block signal until county withdrawals resolve.'
          : effectiveBlockedRate >= 38
        ? 'Most blocked projects likely face interconnection queue and siting pushback.'
        : effectiveBlockedRate >= 22
          ? 'Blocked projects likely split between permitting pace and queue delays.'
          : 'Lower block rates suggest better sequencing or less local opposition.';

    const selectedBlockedRate = hasSelectedSite
      ? selectedStatus.includes('blocked') || selectedStatus.includes('denied') || selectedStatus.includes('withdrawn')
        ? 100
        : selectedStatus.includes('oppose') || selectedStatus.includes('rejected')
          ? 82
          : selectedStatus.includes('announced') || selectedStatus.includes('proposed')
            ? effectiveBlockedRate != null ? Math.max(35, effectiveBlockedRate) : 48
            : selectedStatus.includes('construction') || selectedStatus.includes('under construction')
              ? effectiveBlockedRate != null ? Math.max(15, effectiveBlockedRate - 10) : 22
              : selectedStatus.includes('operational') || selectedStatus.includes('active')
                ? effectiveBlockedRate != null ? Math.max(8, effectiveBlockedRate - 18) : 12
                : effectiveBlockedRate
      : effectiveBlockedRate;
    const selectedBlockedLabel = hasSelectedSite
      ? selectedBlockedRate == null
        ? 'site pending'
        : selectedBlockedRate >= 70
          ? 'site high friction'
          : selectedBlockedRate >= 35
            ? 'site watchlist'
            : 'site lower friction'
      : blockedLabel;

    const selectedSequenceLabel = hasSelectedSite
      ? selectedStatus.includes('announced') || selectedStatus.includes('proposed')
        ? 'announced project with permit risk ahead'
        : selectedStatus.includes('permit') || selectedStatus.includes('permitting')
          ? 'in permitting with opposition watch'
          : selectedStatus.includes('construction') || selectedStatus.includes('under construction')
            ? 'in construction with lower opposition risk'
            : selectedStatus.includes('blocked') || selectedStatus.includes('denied') || selectedStatus.includes('withdrawn')
              ? 'stalled by opposition/permitting friction'
              : selectedStatus.includes('operational') || selectedStatus.includes('active')
                ? 'operating after permit path'
                : sequenceLabel
      : sequenceLabel;

    const pathRiskLabel = waitHigh >= 30 || (effectiveBlockedRate != null && effectiveBlockedRate >= 38)
      ? 'high path risk'
      : waitHigh >= 18 || (effectiveBlockedRate != null && effectiveBlockedRate >= 22)
        ? 'medium path risk'
        : 'lower path risk';
    const selectedPathRiskLabel = hasSelectedSite
      ? selectedStatus.includes('blocked') || selectedStatus.includes('denied') || selectedStatus.includes('withdrawn')
        ? 'high path risk'
        : selectedStatus.includes('announced') || selectedStatus.includes('proposed') || selectedStatus.includes('permit') || selectedStatus.includes('permitting')
          ? 'medium path risk'
          : selectedStatus.includes('operational') || selectedStatus.includes('active') || selectedStatus.includes('construction') || selectedStatus.includes('under construction')
            ? 'lower path risk'
            : pathRiskLabel
      : pathRiskLabel;
    const pathWhy = waitHigh >= 30
      ? 'Long queue timeline pushes higher delivery risk.'
      : announcedCount > existingCount && announcedCount > 0
        ? 'More announced than existing projects increases permit/opposition uncertainty.'
        : effectiveBlockedRate != null && effectiveBlockedRate >= 38
          ? 'High blocked-project signal raises permitting friction risk.'
          : effectiveBlockedRate != null && effectiveBlockedRate >= 22
            ? 'Moderate blocked-project signal indicates mixed permitting friction.'
            : 'Queue and permit signals are comparatively stable.';

    const selectedOperatorLabel = hasSelectedSite
      ? selectedIsHyperscaler
        ? 'hyperscaler operator'
        : 'smaller operator'
      : operatorLabel;

    const oppositionKeywords = /opposition|lawsuit|zoning|moratorium|noise|backlash|controversial|fight|against/i;
    const sitesWithHeadlines = nearbySites.filter((s) => Boolean(s?.articleTitle)).length;
    const headlineOppositionCount = nearbySites.filter((s) => oppositionKeywords.test(String(s?.articleTitle || ''))).length;

    const geocodeCounts = nearbySites.reduce((acc, s) => {
      const c = String(s?.geocodeConfidence || '').toLowerCase().trim();
      if (!c) return acc;
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
    const pinPrecisionParts = Object.entries(geocodeCounts)
      .map(([k, v]) => `${v} ${k}`)
      .filter(Boolean)
      .join(', ');

    const totalSourceCount = nearbySites.reduce((sum, s) => sum + (Number(s?.sourceCount) || 0), 0);
    const statusConfidenceCounts = nearbySites.reduce((acc, s) => {
      const c = String(s?.statusConfidence || '').toLowerCase().trim() || 'unknown';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});

    return {
      clusterScore,
      clusterLabel,
      headlineOppositionCount,
      sitesWithHeadlines,
      pinPrecisionParts: pinPrecisionParts || null,
      totalSourceCount,
      statusConfidenceCounts,
      blockedRate,
      effectiveBlockedRate,
      blockedSource,
      circleBlockedLikeCount,
      circleUnknownCount,
      circleSiteCount: circleSites.length,
      selectedBlockedRate,
      blockedLabel,
      selectedBlockedLabel,
      blockedWhy,
      sequenceLabel,
      selectedSequenceLabel,
      pathRiskLabel,
      selectedPathRiskLabel,
      pathWhy,
      operatorLabel,
      selectedOperatorLabel,
      hyperscalerCount,
      hasSelectedSite,
      ownerMatchCount,
      selectedStatus: selectedStatus || null
    };
  }, [queueMetrics, activeQueueVsErcot, nearbySites, selectedSite, modeledBlockedRate, hasRealQueueMetrics, circleStats?.inCircleSites]);

  // CLUSTER MAP count = markers in power circle; must update when user drags radius (see LocationSearchCard handleRadiusChanged + BUGS_TEXAS_DC.md)
  const liveCircleCount = Number.isFinite(Number(circleStats?.inCircleCount))
    ? Number(circleStats.inCircleCount)
    : null;
  const liveCircleRadius = Number.isFinite(Number(circleStats?.radiusMiles))
    ? Number(circleStats.radiusMiles)
    : null;
  const latestSelectedProjectName = latestSelectedDataCenter?.project_name || latestSelectedDataCenter?.name || null;
  const latestSelectedStatus = latestSelectedDataCenter?.status || null;
  const focusSiteDetails = useMemo(() => {
    if (selectedSite) {
      return {
        name: selectedSite.displayName || 'Selected project',
        status: selectedSite.status || null,
        owner: selectedSite.owner || null,
        location: selectedSite.location || null,
        totalMw: selectedSite.totalMw ?? selectedSite.sizeMw ?? null,
        installedMw: selectedSite.installedMw ?? null,
        sourceCount: selectedSite.sourceCount ?? null,
        probabilityScore: selectedSite.probabilityScore ?? null,
        dataSource: selectedSite.dataSource ?? null,
        articleTitle: selectedSite.articleTitle ?? selectedSite.article_title ?? null,
        sourceUrl: selectedSite.sourceUrl ?? selectedSite.source_url ?? null
      };
    }
    if (latestSelectedDataCenter) {
      return {
        name: latestSelectedDataCenter.project_name || latestSelectedDataCenter.name || latestSelectedDataCenter.company || 'Selected project',
        status: latestSelectedDataCenter.status || null,
        owner: latestSelectedDataCenter.company || null,
        location: latestSelectedDataCenter.city || latestSelectedDataCenter.location || null,
        totalMw: latestSelectedDataCenter.total_mw ?? latestSelectedDataCenter.size_mw ?? null,
        installedMw: latestSelectedDataCenter.installed_mw ?? null,
        sourceCount: latestSelectedDataCenter.source_count ?? null,
        probabilityScore: latestSelectedDataCenter.probability_score ?? null,
        dataSource: latestSelectedDataCenter.data_source ?? null,
        articleTitle: latestSelectedDataCenter.article_title ?? latestSelectedDataCenter.articleTitle ?? null,
        sourceUrl: latestSelectedDataCenter.source_url ?? latestSelectedDataCenter.sourceUrl ?? null
      };
    }
    return null;
  }, [selectedSite, latestSelectedDataCenter]);
  const hasLiveCircleStats = liveCircleCount != null && liveCircleRadius != null;
  const hasActiveSiteContext = Boolean(selectedSite) || Boolean(latestSelectedDataCenter);
  const shouldSuggestNearestFromCluster =
    hasLiveCircleStats &&
    liveCircleCount === 0 &&
    !hasActiveSiteContext &&
    typeof onNearestDataCenterAction === 'function';

  const dataCenterCount = hasLiveCircleStats ? liveCircleCount : (circleStats?.inCircleCount ?? 0);
  const oppositionLevel = isOutOfTexas
    ? 'Texas only'
    : isPending
      ? 'Loading'
      : dataCenterCount >= 3
        ? 'Elevated'
        : dataCenterCount >= 1
          ? 'Watch'
          : 'Low';
  const oppositionColor = oppositionLevel === 'Low'
    ? '#22c55e'
    : oppositionLevel === 'Watch'
      ? '#f59e0b'
      : oppositionLevel === 'Elevated'
        ? '#ef4444'
        : '#9ca3af';
  const nearbyActionHandler = (isOutOfTexas || isPending) ? undefined : () => {
    logEvent('opposition_nearby_clicked', { oppositionLevel }, 'opposition');
    onNearbyAction?.();
  };

  const track = useCallback((eventName, extra = {}) => {
    logEvent(eventName, {
      oppositionLevel,
      clusterScore: analysis.clusterScore,
      blockedRate: analysis.blockedRate,
      hasSelectedSite: analysis.hasSelectedSite,
      selectedSiteName: selectedSite?.displayName || null,
      ...extra,
    }, 'opposition');
  }, [oppositionLevel, analysis, selectedSite]);

  // Per-location deduplication for impression events
  const seenRef = useRef(new Map());
  const emitOnce = useCallback(
    createOncePerKeyEmitter(seenRef, (eventName, payload) => logEvent(eventName, payload, 'opposition')),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Stable payload refs — updated every render so the effect can read latest values
  // without those values being listed as effect deps (which would cause spurious re-fires).
  const analysisRef = useRef(analysis);
  const nearbySitesLenRef = useRef(nearbySites.length);
  const selectedSiteRef = useRef(selectedSite);
  analysisRef.current = analysis;
  nearbySitesLenRef.current = nearbySites.length;
  selectedSiteRef.current = selectedSite;

  // Track once per (coordStr, level) — key is compound so Low→Elevated each fire once,
  // but a re-render with the same (coordStr, level) pair is always suppressed.
  useEffect(() => {
    if (oppositionLevel === 'Loading' || !coordStr) return;
    const a = analysisRef.current;
    const site = selectedSiteRef.current;
    emitOnce('opposition_card_seen', {
      oppositionLevel,
      clusterScore: a.clusterScore,
      blockedRate: a.blockedRate,
      hasSelectedSite: a.hasSelectedSite,
      selectedSiteName: site?.displayName || null,
      sequenceLabel: a.hasSelectedSite ? a.selectedSequenceLabel : a.sequenceLabel,
      operatorLabel: a.hasSelectedSite ? a.selectedOperatorLabel : a.operatorLabel,
      hyperscalerCount: a.hyperscalerCount,
      nearbySitesCount: nearbySitesLenRef.current,
    }, { key: `${coordStr}::${oppositionLevel}`, ttlMs: 3600000 }); // 1h — effectively once per (location, level)
  }, [oppositionLevel, coordStr, emitOnce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track when a selected site changes inside the opposition card
  useEffect(() => {
    if (!selectedSite) return;
    track('opposition_site_focused', {
      distanceMi: selectedSite.distanceMi,
      status: selectedSite.status,
      owner: selectedSite.owner,
      selectedBlockedRate: analysis.selectedBlockedRate,
      selectedBlockedLabel: analysis.selectedBlockedLabel,
      selectedSequenceLabel: analysis.selectedSequenceLabel,
    });
  }, [selectedSite?.projectId, selectedSite?.displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suppressNextStateResetRef.current) {
      suppressNextStateResetRef.current = false;
      return;
    }
    setIsClusterExpanded(false);
    setIsClusterContentLoading(false);
    setShowClusterHalo(false);
    setIsClusterSelected(false);
    setIsBlockedExpanded(false);
    setShowBlockedHalo(false);
    setIsBlockedSelected(false);
    setIsSequenceExpanded(false);
    setShowSequenceHalo(false);
    setIsSequenceSelected(false);
  }, [selectedSite?.projectId, selectedSite?.displayName, metricsStatusLabel]);

  useEffect(() => {
    return () => {
      if (clusterHaloTimeoutRef.current) {
        clearTimeout(clusterHaloTimeoutRef.current);
      }
      if (clusterContentTimeoutRef.current) {
        clearTimeout(clusterContentTimeoutRef.current);
      }
      if (blockedHaloTimeoutRef.current) {
        clearTimeout(blockedHaloTimeoutRef.current);
      }
      if (sequenceHaloTimeoutRef.current) {
        clearTimeout(sequenceHaloTimeoutRef.current);
      }
      if (clusterCopyTimeoutRef.current) {
        clearTimeout(clusterCopyTimeoutRef.current);
      }
      if (blockedCopyTimeoutRef.current) {
        clearTimeout(blockedCopyTimeoutRef.current);
      }
      if (storyOpenTimeoutRef.current) {
        clearTimeout(storyOpenTimeoutRef.current);
      }
    };
  }, []);

  // Pulse outline on Cluster Map card when first mounted (indicates clickability)
  useEffect(() => {
    const t = setTimeout(() => setShowClusterMapPulse(false), 1000);
    return () => clearTimeout(t);
  }, []);

  const metricRowBaseStyle = {
    padding: '7px 8px',
    borderRadius: '7px',
    background: 'rgba(15,23,42,0.22)',
    border: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer'
  };

  const triggerClusterHalo = () => {
    if (clusterHaloTimeoutRef.current) {
      clearTimeout(clusterHaloTimeoutRef.current);
    }
    setShowClusterHalo(false);
    requestAnimationFrame(() => {
      setShowClusterHalo(true);
      clusterHaloTimeoutRef.current = setTimeout(() => {
        setShowClusterHalo(false);
      }, 760);
    });
  };

  const triggerClusterContentLoad = useCallback(() => {
    if (clusterContentTimeoutRef.current) {
      clearTimeout(clusterContentTimeoutRef.current);
    }
    setIsClusterContentLoading(true);
    clusterContentTimeoutRef.current = setTimeout(() => {
      setIsClusterContentLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!forceOpenClusterToken) return;
    if (forceOpenClusterToken === lastForceOpenClusterTokenRef.current) {
      console.log('[Opposition] forceOpenCluster ignored: token already handled', {
        forceOpenClusterToken,
        lastHandledToken: lastForceOpenClusterTokenRef.current
      });
      return;
    }
    if (isPending || isOutOfTexas) {
      console.log('[Opposition] forceOpenCluster deferred due guard', {
        forceOpenClusterToken,
        isPending,
        isOutOfTexas,
        liveCircleCount,
        liveCircleRadius
      });
      return;
    }
    console.log('[Opposition] forceOpenCluster executing', {
      forceOpenClusterToken,
      isPending,
      isOutOfTexas,
      liveCircleCount,
      liveCircleRadius
    });
    suppressNextStateResetRef.current = true;
    lastForceOpenClusterTokenRef.current = forceOpenClusterToken;
    setShowClusterMapPulse(false);
    setIsClusterSelected(true);
    setIsClusterExpanded(true);
    if (clusterContentTimeoutRef.current) {
      clearTimeout(clusterContentTimeoutRef.current);
      clusterContentTimeoutRef.current = null;
    }
    // Forced opens should show content immediately (no synthetic skeleton),
    // otherwise repeated remount cycles can keep resetting the loader timer.
    setIsClusterContentLoading(false);
    triggerClusterHalo();
  }, [forceOpenClusterToken, isPending, isOutOfTexas, liveCircleCount, liveCircleRadius]);

  useEffect(() => {
    if (!isClusterExpanded) return;
    const cardEl = clusterCardRef.current;
    if (!cardEl) return;

    const findScrollParent = (node) => {
      let parent = node?.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const scrollParent = findScrollParent(cardEl);
    if (!scrollParent) return;

    const scrollIntoViewIfNeeded = () => {
      const parentRect = scrollParent.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const bottomPadding = 12;
      const topPadding = 8;

      if (cardRect.bottom + bottomPadding > parentRect.bottom) {
        const delta = cardRect.bottom + bottomPadding - parentRect.bottom;
        scrollParent.scrollBy({ top: delta, behavior: 'smooth' });
      } else if (cardRect.top - topPadding < parentRect.top) {
        const delta = cardRect.top - topPadding - parentRect.top;
        scrollParent.scrollBy({ top: delta, behavior: 'smooth' });
      }
    };

    const timer = setTimeout(scrollIntoViewIfNeeded, isClusterContentLoading ? 140 : 60);
    return () => clearTimeout(timer);
  }, [isClusterExpanded, isClusterContentLoading]);

  const triggerBlockedHalo = () => {
    if (blockedHaloTimeoutRef.current) {
      clearTimeout(blockedHaloTimeoutRef.current);
    }
    setShowBlockedHalo(false);
    requestAnimationFrame(() => {
      setShowBlockedHalo(true);
      blockedHaloTimeoutRef.current = setTimeout(() => {
        setShowBlockedHalo(false);
      }, 760);
    });
  };

  const triggerSequenceHalo = () => {
    if (sequenceHaloTimeoutRef.current) {
      clearTimeout(sequenceHaloTimeoutRef.current);
    }
    setShowSequenceHalo(false);
    requestAnimationFrame(() => {
      setShowSequenceHalo(true);
      sequenceHaloTimeoutRef.current = setTimeout(() => {
        setShowSequenceHalo(false);
      }, 760);
    });
  };

  const handleStoryClickWithAnimation = useCallback((site, itemKey, event) => {
    if (!onHeadlineClick) return;
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
    }
    console.log('[Opposition] story clicked', {
      itemKey,
      articleTitle: site?.articleTitle || null,
      projectId: site?.projectId || null,
      sourceUrl: site?.sourceUrl || null,
      lat: site?.lat ?? null,
      lng: site?.lng ?? null
    });
    if (storyOpenTimeoutRef.current) {
      clearTimeout(storyOpenTimeoutRef.current);
    }
    setStoryOpeningKey(itemKey);
    if (typeof window !== 'undefined' && window.mapEventBus?.emit) {
      window.mapEventBus.emit('opposition:story-clicked', { source: 'cluster-map-story' });
    }
    storyOpenTimeoutRef.current = setTimeout(() => {
      onHeadlineClick(site);
      setStoryOpeningKey(null);
      storyOpenTimeoutRef.current = null;
    }, 900);
  }, [onHeadlineClick]);

  const accentRgba = (a) => hexToRgba(oppositionColor, a);
  const blockedCopyTone = analysis.effectiveBlockedRate == null
    ? '#94a3b8'
    : analysis.effectiveBlockedRate >= 38
      ? '#ef4444'
      : analysis.effectiveBlockedRate >= 22
        ? '#f59e0b'
        : '#22c55e';
  const valueHighlightColor = accentRgba(0.92);

  const buildBlockedCopyText = useCallback(() => {
    const rateText = analysis.effectiveBlockedRate == null
      ? 'N/A'
      : `${analysis.effectiveBlockedRate.toFixed(0)}%`;
    const sourceText = analysis.blockedSource === 'circle'
      ? 'Circle-derived status estimate'
      : hasRealQueueMetrics
        ? 'County implied block rate'
        : 'Modeled county block rate';
    const queueWithdrawn = Number(queueMetrics?.queueWithdrawnCount ?? modeledQueueWithdrawnCount ?? 0);
    const queueTotal = Number(queueMetrics?.totalQueueCount ?? modeledQueueTotalCount ?? 0);

    const lines = [
      `Blocked-project signal: ${rateText} (${sourceText})`,
      `Label: ${analysis.hasSelectedSite ? analysis.selectedBlockedLabel : analysis.blockedLabel}`,
      `Queue withdrawn baseline: ${queueWithdrawn} of ${queueTotal}`
    ];

    if (analysis.blockedSource === 'circle') {
      lines.push(`Circle status mix: ${analysis.circleBlockedLikeCount} blocked-like of ${analysis.circleSiteCount}`);
      if (analysis.circleUnknownCount > 0) {
        lines.push(`Unknown/uncertain: ${analysis.circleUnknownCount} of ${analysis.circleSiteCount} (low confidence)`);
      }
    }

    if (analysis.hasSelectedSite) {
      lines.push(`Selected site status: ${analysis.selectedStatus || 'unknown'}`);
    }

    return lines.join('\n');
  }, [
    analysis,
    hasRealQueueMetrics,
    queueMetrics,
    modeledQueueWithdrawnCount,
    modeledQueueTotalCount
  ]);

  const handleCopyBlockedSummary = useCallback(async () => {
    const text = buildBlockedCopyText();
    let copied = false;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setBlockedCopyStatus(copied ? 'copied' : 'error');
    if (blockedCopyTimeoutRef.current) clearTimeout(blockedCopyTimeoutRef.current);
    blockedCopyTimeoutRef.current = setTimeout(() => {
      setBlockedCopyStatus('idle');
    }, 1200);
  }, [buildBlockedCopyText]);

  const buildClusterCopyText = useCallback(() => {
    const areaSites = (hasLiveCircleStats && Array.isArray(circleStats?.inCircleSites))
      ? circleStats.inCircleSites
      : nearbySites;
    const oppositionKeywords = /opposition|lawsuit|zoning|moratorium|noise|backlash|controversial|fight|against/i;
    const withHeadlines = areaSites.filter((s) => Boolean(s?.articleTitle));
    const oppositionHeadlines = withHeadlines.filter((s) => oppositionKeywords.test(String(s?.articleTitle || '')));

    const lines = [
      `Cluster map signal: ${hasLiveCircleStats ? `${liveCircleCount} projects in ${liveCircleRadius?.toFixed(1)} mi` : `${analysis.clusterScore.toFixed(1)}/10 (${analysis.clusterLabel})`}`,
      `Headlines: ${withHeadlines.length} total, ${oppositionHeadlines.length} opposition-tagged`
    ];
    if (hasLiveCircleStats && areaSites.length === 0) {
      lines.push('No projects in selected radius; no in-radius headlines to show.');
    }

    const topHeadlines = (oppositionHeadlines.length > 0 ? oppositionHeadlines : withHeadlines)
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.articleTitle || 'Untitled'}`);
    if (topHeadlines.length > 0) lines.push(...topHeadlines);
    if (latestSelectedProjectName) {
      lines.push(`Selected: ${latestSelectedProjectName}${latestSelectedStatus ? ` (${String(latestSelectedStatus).replace(/_/g, ' ')})` : ''}`);
    }
    return lines.join('\n');
  }, [
    hasLiveCircleStats,
    circleStats,
    nearbySites,
    liveCircleCount,
    liveCircleRadius,
    analysis.clusterScore,
    analysis.clusterLabel,
    latestSelectedProjectName,
    latestSelectedStatus
  ]);

  const handleCopyClusterSummary = useCallback(async () => {
    const text = buildClusterCopyText();
    let copied = false;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setClusterCopyStatus(copied ? 'copied' : 'error');
    if (clusterCopyTimeoutRef.current) clearTimeout(clusterCopyTimeoutRef.current);
    clusterCopyTimeoutRef.current = setTimeout(() => setClusterCopyStatus('idle'), 1200);
  }, [buildClusterCopyText]);

  return (
    <div
      style={{
        marginTop: '10px',
        marginBottom: '10px',
        padding: '8px 9px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: oppositionColor, fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Opposition {oppositionLevel}
        </span>
        {!hideNearbyButton && (
          <button
            type="button"
            onClick={nearbyActionHandler}
            disabled={!nearbyActionHandler}
            style={{
              border: `1px solid ${accentRgba(0.45)}`,
              background: accentRgba(0.28),
              color: 'rgba(254,226,226,0.88)',
              borderRadius: '7px',
              padding: '3px 7px',
              fontSize: '9.5px',
              fontWeight: 600,
              cursor: nearbyActionHandler ? 'pointer' : 'default',
              opacity: nearbyActionHandler ? 1 : 0.65
            }}
            title={`Metrics: ${metricsStatusLabel || 'n/a'}`}
          >
            Nearby
          </button>
        )}
      </div>

      {isOutOfTexas && (
        <div
          style={{
            marginTop: '7px',
            border: '1px solid rgba(249,115,22,0.38)',
            borderRadius: '7px',
            padding: '6px 7px',
            background: 'rgba(124,45,18,0.2)',
            color: 'rgba(255,237,213,0.9)',
            fontSize: '10px',
            lineHeight: 1.35
          }}
        >
          {texasSupportNote}
        </div>
      )}

      {!isOutOfTexas && selectedSite && (
        <div
          style={{
            marginTop: '7px',
            border: `1px solid ${accentRgba(0.28)}`,
            borderRadius: '7px',
            padding: '5px 7px',
            background: 'rgba(30,41,59,0.25)',
            color: 'rgba(226,232,240,0.84)',
            fontSize: '9px'
          }}
        >
          Focus site: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedSite.displayName || 'Selected project'}</span>
        </div>
      )}

      <div style={{ marginTop: '11px', display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
        <div
          ref={clusterCardRef}
          data-tour="opposition-cluster-map"
          style={{
            ...metricRowBaseStyle,
            cursor: (isPending || isOutOfTexas) ? 'default' : 'pointer',
            position: 'relative',
            overflow: 'hidden',
            border: (showClusterHalo || isClusterSelected) ? `1px solid ${accentRgba(0.72)}` : metricRowBaseStyle.border,
            boxShadow: isClusterSelected ? `0 0 0 1px ${accentRgba(0.24)} inset` : 'none',
            animation: showClusterMapPulse ? `oppositionClusterMapPulse 0.5s ease-in-out infinite` : undefined
          }}
          onClick={(isPending || isOutOfTexas) ? undefined : () => {
            if (shouldSuggestNearestFromCluster) {
              console.log('[Opposition] cluster nearest click', {
                shouldSuggestNearestFromCluster,
                liveCircleCount,
                liveCircleRadius,
                isPending,
                isOutOfTexas
              });
              track('opposition_cluster_nearest_clicked', { liveCircleCount, liveCircleRadius });
              onNearestDataCenterAction?.();
              return;
            }
            setShowClusterMapPulse(false);
            setIsClusterSelected(true);
            setIsClusterExpanded((prev) => {
              const nextExpanded = !prev;
              track('opposition_cluster_toggled', { expanded: nextExpanded });
              if (nextExpanded) {
                triggerClusterContentLoad();
                if (typeof window !== 'undefined' && window.mapEventBus?.emit) {
                  window.mapEventBus.emit('opposition:cluster-map-opened', { expanded: true });
                }
              } else {
                if (clusterContentTimeoutRef.current) {
                  clearTimeout(clusterContentTimeoutRef.current);
                }
                setIsClusterContentLoading(false);
              }
              return nextExpanded;
            });
            triggerClusterHalo();
            onClusterAction?.({
              source: 'opposition_cluster_map_card',
              forceActivate: true,
              selectedSiteSnapshot: selectedSite || null,
              latestSelectedSnapshot: latestSelectedDataCenter || null
            });
          }}
        >
          {showClusterHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: `radial-gradient(circle at center, ${accentRgba(0.22)} 0%, ${accentRgba(0.08)} 48%, ${accentRgba(0)} 78%)`,
                animation: 'oppositionClusterHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          {shouldSuggestNearestFromCluster ? (
            <div style={{ padding: '2px 0 1px' }}>
              <div
                style={{
                  color: '#f8fafc',
                  fontSize: '20px',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em'
                }}
              >
                Tap to nearest data center
              </div>
              <div
                style={{
                  marginTop: '6px',
                  color: 'rgba(148,163,184,0.8)',
                  fontSize: '11px',
                  lineHeight: 1.3
                }}
              >
                0 found in this radius
              </div>
            </div>
          ) : (
            <>
              <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Cluster map</span>
                <span style={{ color: accentRgba(0.82), fontSize: '12px' }}>
                  {isPending || isOutOfTexas ? 'Locked' : (isClusterExpanded ? 'Hide ->' : 'Open ->')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px' }}>
                <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600 }}>
                  {isPending
                    ? 'Pending'
                    : hasLiveCircleStats
                      ? `${liveCircleCount} ${liveCircleCount === 1 ? 'Data Center' : 'Data Centers'}`
                      : `${analysis.clusterScore.toFixed(1)}/10`}
                </span>
                <span style={{ color: descriptorColor, fontSize: '12.5px' }}>
                  {isPending ? 'building signal' : hasLiveCircleStats ? `${liveCircleRadius.toFixed(1)} mi radius` : analysis.clusterLabel}
                </span>
              </div>
            </>
          )}
          {isClusterExpanded && (() => {
            if (isClusterContentLoading) {
              return (
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'grid', gap: '10px' }}>
                  <div style={{ height: '13px', borderRadius: '4px', background: 'rgba(148,163,184,0.18)' }} />
                  <div style={{ display: 'grid', gap: '7px' }}>
                    <div style={{ height: '11px', width: '62%', borderRadius: '4px', background: 'rgba(148,163,184,0.14)' }} />
                    <div style={{ height: '13px', width: '100%', borderRadius: '4px', background: 'rgba(148,163,184,0.18)' }} />
                    <div style={{ height: '13px', width: '92%', borderRadius: '4px', background: 'rgba(148,163,184,0.18)' }} />
                    <div style={{ height: '11px', width: '54%', borderRadius: '4px', background: 'rgba(148,163,184,0.14)' }} />
                  </div>
                  <div style={{ height: '11px', width: '78%', borderRadius: '4px', background: 'rgba(148,163,184,0.14)' }} />
                </div>
              );
            }
            const areaSites = (hasLiveCircleStats && Array.isArray(circleStats?.inCircleSites))
              ? circleStats.inCircleSites
              : nearbySites;
            const oppositionKeywords = /opposition|lawsuit|zoning|moratorium|noise|backlash|controversial|fight|against/i;
            const withHeadlines = areaSites.filter((s) => Boolean(s?.articleTitle));
            const oppositionHeadlines = withHeadlines.filter((s) => oppositionKeywords.test(String(s?.articleTitle || '')));
            const toDisplay = oppositionHeadlines.length > 0 ? oppositionHeadlines : withHeadlines;
            const sortedByDate = [...toDisplay].sort((a, b) => {
              const ta = a?.announcedDate ? new Date(a.announcedDate).getTime() : 0;
              const tb = b?.announcedDate ? new Date(b.announcedDate).getTime() : 0;
              return tb - ta;
            });
            const topStories = sortedByDate.slice(0, 5);
            const firstAreaSite = areaSites.length > 0 ? areaSites[0] : null;
            const displayFocus = focusSiteDetails || (firstAreaSite ? {
              name: firstAreaSite.displayName || firstAreaSite.project_name || 'Data center',
              status: firstAreaSite.status ?? null,
              owner: firstAreaSite.owner ?? firstAreaSite.company ?? null,
              location: firstAreaSite.location ?? firstAreaSite.city ?? null,
              totalMw: firstAreaSite.totalMw ?? firstAreaSite.sizeMw ?? null,
              installedMw: firstAreaSite.installedMw ?? null,
              sourceCount: firstAreaSite.sourceCount ?? null,
              probabilityScore: firstAreaSite.probabilityScore ?? null,
              dataSource: firstAreaSite.dataSource ?? null,
              articleTitle: firstAreaSite.articleTitle ?? firstAreaSite.article_title ?? null,
              sourceUrl: firstAreaSite.sourceUrl ?? firstAreaSite.source_url ?? null
            } : null);
            const focusHeadlineOnly = displayFocus?.articleTitle && withHeadlines.length === 0;
            return (
              <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45, display: 'grid', gap: '10px' }}>
                {hasLiveCircleStats ? (
                  <div>
                    In circle: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{liveCircleCount}</span> projects within <span style={{ fontWeight: 700, color: valueHighlightColor }}>{liveCircleRadius.toFixed(1)} mi</span>.
                  </div>
                ) : (
                  <div>
                    Cluster signal: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.clusterLabel}</span>.
                  </div>
                )}
                {displayFocus && (
                  <div
                    style={{
                      border: '1px solid rgba(148,163,184,0.22)',
                      borderRadius: '8px',
                      padding: '8px 9px',
                      background: 'rgba(15,23,42,0.35)',
                      display: 'grid',
                      gap: '3px'
                    }}
                  >
                    <div style={{ color: 'rgba(203,213,225,0.86)', fontSize: '12px' }}>
                      {String(displayFocus.status || 'unknown').replace(/_/g, ' ')}
                      {displayFocus.location ? ` • ${displayFocus.location}` : ''}
                    </div>
                    <div style={{ color: 'rgba(148,163,184,0.82)', fontSize: '11.5px' }}>
                      {[
                        formatMwCompact(displayFocus.totalMw) ? `Total ${formatMwCompact(displayFocus.totalMw)}` : null,
                        formatMwCompact(displayFocus.installedMw) ? `Installed ${formatMwCompact(displayFocus.installedMw)}` : null,
                        Number.isFinite(Number(displayFocus.sourceCount)) ? `${Number(displayFocus.sourceCount)} source${Number(displayFocus.sourceCount) === 1 ? '' : 's'}` : null,
                        displayFocus.probabilityScore && String(displayFocus.probabilityScore).toLowerCase() !== 'unknown'
                          ? `Prob ${String(displayFocus.probabilityScore)}`
                          : null
                      ].filter(Boolean).join(' • ') || 'No MW/source signal yet'}
                    </div>
                    {(displayFocus.owner || displayFocus.dataSource) && (
                      <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: '11px' }}>
                        {[displayFocus.owner, displayFocus.dataSource].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                )}
                {(withHeadlines.length > 0 || focusHeadlineOnly) && (
                  <div style={{ display: 'grid', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          marginTop: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          width: 'fit-content',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          border: `1px solid ${hexToRgba(oppositionColor, 0.5)}`,
                          background: hexToRgba(oppositionColor, 0.14),
                          color: 'rgba(241,245,249,0.9)',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          lineHeight: 1.1
                        }}
                      >
                        Recent news
                      </div>
                      {focusHeadlineOnly && displayFocus && (
                        <div
                          style={{
                            paddingLeft: '2px',
                            paddingTop: '2px',
                            paddingBottom: '3px',
                            minWidth: 0,
                            overflow: 'hidden',
                            borderRadius: '8px'
                          }}
                        >
                          {displayFocus.sourceUrl ? (
                            <a
                              href={displayFocus.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: 'rgba(148,163,184,0.95)',
                                fontSize: '13.5px',
                                textDecoration: 'none',
                                display: 'block',
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                cursor: onHeadlineClick ? 'pointer' : undefined
                              }}
                              title={displayFocus.articleTitle || ''}
                              onClick={(e) => {
                                if (onHeadlineClick) {
                                  handleStoryClickWithAnimation(
                                    { ...displayFocus, articleTitle: displayFocus.articleTitle, sourceUrl: displayFocus.sourceUrl, displayName: displayFocus.name },
                                    'focus-headline',
                                    e
                                  );
                                }
                              }}
                            >
                              {displayFocus.articleTitle || ''}
                            </a>
                          ) : (
                            <span
                              style={{
                                color: 'rgba(148,163,184,0.95)',
                                fontSize: '13.5px',
                                display: 'block',
                                lineHeight: 1.45,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                cursor: onHeadlineClick ? 'pointer' : undefined
                              }}
                              title={displayFocus.articleTitle || ''}
                              onClick={() => {
                                if (onHeadlineClick) {
                                  handleStoryClickWithAnimation(
                                    { ...displayFocus, articleTitle: displayFocus.articleTitle, sourceUrl: displayFocus.sourceUrl, displayName: displayFocus.name },
                                    'focus-headline'
                                  );
                                }
                              }}
                              role={onHeadlineClick ? 'button' : undefined}
                              tabIndex={onHeadlineClick ? 0 : undefined}
                            >
                              {displayFocus.articleTitle || ''}
                            </span>
                          )}
                        </div>
                      )}
                      {topStories
                        .map((site, idx) => {
                          const storyItemKey = site?.projectId || site?.sourceUrl || site?.articleTitle || `story-${idx}`;
                          const isStoryOpening = storyOpeningKey === storyItemKey;
                          const dateStr = site?.announcedDate
                            ? (() => {
                                try {
                                  const d = new Date(site.announcedDate);
                                  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                } catch {
                                  return null;
                                }
                              })()
                            : null;
                          return (
                          <div
                            key={idx}
                            data-tour={idx === topStories.length - 1 ? 'opposition-bottom-story' : undefined}
                            style={{
                              paddingLeft: '2px',
                              paddingTop: '2px',
                              paddingBottom: '3px',
                              minWidth: 0,
                              overflow: 'hidden',
                              borderRadius: '8px',
                              transition: 'color 160ms ease'
                            }}
                          >
                            {dateStr && (
                              <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '11.5px', marginBottom: '4px', lineHeight: 1.2 }}>
                                <span style={{ fontWeight: 700, color: valueHighlightColor }}>{dateStr}</span>
                              </div>
                            )}
                            {site.sourceUrl ? (
                              <a
                                href={site.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: isStoryOpening ? 'rgba(254,226,226,0.98)' : 'rgba(148,163,184,0.95)',
                                  fontSize: '13.5px',
                                  textDecoration: 'none',
                                  display: 'block',
                                  lineHeight: 1.45,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word',
                                  cursor: onHeadlineClick ? 'pointer' : undefined
                                }}
                                title={site.articleTitle || ''}
                                onClick={(e) => {
                                  if (onHeadlineClick) {
                                    handleStoryClickWithAnimation(site, storyItemKey, e);
                                  }
                                }}
                              >
                                {site.articleTitle || ''}
                              </a>
                            ) : (
                              <span
                                style={{
                                  color: isStoryOpening ? 'rgba(254,226,226,0.98)' : undefined,
                                  fontSize: '13.5px',
                                  display: 'block',
                                  lineHeight: 1.45,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word',
                                  cursor: onHeadlineClick ? 'pointer' : undefined
                                }}
                                title={site.articleTitle || ''}
                                onClick={() => {
                                  handleStoryClickWithAnimation(site, storyItemKey);
                                }}
                                role={onHeadlineClick ? 'button' : undefined}
                                tabIndex={onHeadlineClick ? 0 : undefined}
                                onKeyDown={(ev) => {
                                  if (onHeadlineClick && (ev.key === 'Enter' || ev.key === ' ')) {
                                    handleStoryClickWithAnimation(site, storyItemKey, ev);
                                  }
                                }}
                              >
                                {site.articleTitle || ''}
                              </span>
                            )}
                            {site.displayName && (
                              <div
                                style={{
                                  color: 'rgba(148,163,184,0.6)',
                                  fontSize: '12px',
                                  marginTop: '4px',
                                  lineHeight: 1.35,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word'
                                }}
                                title={site.displayName}
                              >
                                {site.displayName}
                              </div>
                            )}
                          </div>
                          );
                        })}
                  </div>
                )}
                {withHeadlines.length === 0 && !focusHeadlineOnly && areaSites.length > 0 && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: '12px' }}>
                      No linked news for this marker yet. Some markers have headlines; this one doesn’t in our dataset.
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {areaSites.slice(0, 5).map((site, idx) => {
                        const mwParts = [
                          formatMwCompact(site.totalMw || site.sizeMw),
                          formatMwCompact(site.installedMw) ? `Installed ${formatMwCompact(site.installedMw)}` : null,
                          Number.isFinite(Number(site.sourceCount)) ? `${site.sourceCount} source${Number(site.sourceCount) === 1 ? '' : 's'}` : null
                        ].filter(Boolean);
                        return (
                          <div
                            key={site?.projectId || site?.displayName || idx}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: 'rgba(148,163,184,0.08)',
                              border: '1px solid rgba(148,163,184,0.12)',
                              fontSize: '12px',
                              color: 'rgba(203,213,225,0.9)',
                              lineHeight: 1.35
                            }}
                          >
                            <span style={{ color: 'rgba(203,213,225,0.9)' }}>
                              {String(site.status || 'unknown').replace(/_/g, ' ')}
                              {site.location || site.city ? ` • ${site.location || site.city}` : ''}
                              {mwParts.length > 0 ? ` • ${mwParts.join(' • ')}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasLiveCircleStats && areaSites.length === 0 && (
                  <div style={{ color: 'rgba(148,163,184,0.7)' }}>
                    No data centers in the selected radius yet. Move the circle or jump to a nearby area.
                  </div>
                )}
                {latestSelectedProjectName && (
                  <div style={{ color: 'rgba(148,163,184,0.6)', fontSize: '12px' }}>
                    Selected: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{latestSelectedProjectName}</span>{latestSelectedStatus ? <><span> (</span><span style={{ fontWeight: 700, color: valueHighlightColor }}>{String(latestSelectedStatus).replace(/_/g, ' ')}</span><span>)</span></> : ''}.
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                  {onExpandAction && (
                    <button
                      type="button"
                      onClick={() => {
                        track('opposition_cluster_expand_clicked', { source: 'cluster_card_footer' });
                        onExpandAction();
                      }}
                      style={{
                        border: `1px solid ${hexToRgba(oppositionColor, 0.7)}`,
                        background: hexToRgba(oppositionColor, 0.18),
                        color: 'rgba(241,245,249,0.9)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '9px',
                        fontWeight: 600,
                        lineHeight: 1,
                        cursor: 'pointer'
                      }}
                    >
                      Expand
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyClusterSummary}
                    style={{
                      border: `1px solid ${hexToRgba(oppositionColor, 0.7)}`,
                      background: clusterCopyStatus === 'copied'
                        ? 'rgba(34,197,94,0.22)'
                        : clusterCopyStatus === 'error'
                          ? 'rgba(239,68,68,0.22)'
                          : hexToRgba(oppositionColor, 0.18),
                      color: clusterCopyStatus === 'copied'
                        ? 'rgba(220,252,231,0.95)'
                        : clusterCopyStatus === 'error'
                          ? 'rgba(254,226,226,0.95)'
                          : 'rgba(241,245,249,0.9)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '9px',
                      fontWeight: 600,
                      lineHeight: 1,
                      cursor: 'pointer'
                    }}
                  >
                    {clusterCopyStatus === 'copied' ? 'Copied' : clusterCopyStatus === 'error' ? 'Retry' : 'Copy'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        <div
          style={{
            ...metricRowBaseStyle,
            cursor: (isPending || isOutOfTexas) ? 'default' : 'pointer',
            position: 'relative',
            overflow: 'hidden',
            border: (showBlockedHalo || isBlockedSelected) ? `1px solid ${accentRgba(0.72)}` : metricRowBaseStyle.border,
            boxShadow: isBlockedSelected ? `0 0 0 1px ${accentRgba(0.24)} inset` : 'none'
          }}
          onClick={(isPending || isOutOfTexas) ? undefined : () => {
            setIsBlockedSelected(true);
            setIsBlockedExpanded((prev) => {
              track('opposition_blocked_toggled', { expanded: !prev, blockedRate: analysis.selectedBlockedRate ?? analysis.blockedRate });
              return !prev;
            });
            triggerBlockedHalo();
            onBlockedAction?.();
          }}
        >
          {showBlockedHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: `radial-gradient(circle at center, ${accentRgba(0.22)} 0%, ${accentRgba(0.08)} 48%, ${accentRgba(0)} 78%)`,
                animation: 'oppositionBlockedHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Blocked projects</span>
            <span style={{ color: accentRgba(0.82), fontSize: '12px' }}>
              {isPending || isOutOfTexas ? 'Locked' : (isBlockedExpanded ? 'Hide ->' : 'Open ->')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px' }}>
            <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600 }}>
              {analysis.effectiveBlockedRate == null
                ? 'N/A'
                : `${analysis.effectiveBlockedRate.toFixed(0)}%${analysis.blockedSource === 'circle' ? ' (circle)' : (hasRealQueueMetrics ? '' : ' (modeled)')}`}
            </span>
            <span style={{ color: descriptorColor, fontSize: '12.5px' }}>
              {analysis.hasSelectedSite ? analysis.selectedBlockedLabel : analysis.blockedLabel}
            </span>
          </div>
          {analysis.hasSelectedSite && (
            <div style={{ color: accentRgba(0.72), fontSize: '12px', marginTop: '2px' }}>
              Site lens: {analysis.selectedBlockedRate == null ? 'pending' : `${analysis.selectedBlockedRate.toFixed(0)}%`}
            </div>
          )}
          {isBlockedExpanded && (
            <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45 }}>
              <div>
                {analysis.effectiveBlockedRate == null
                  ? 'Blocked-project signal: insufficient data.'
                  : analysis.blockedSource === 'circle'
                    ? <>Blocked-project signal (circle): <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.effectiveBlockedRate.toFixed(0)}%</span> estimated from <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleSiteCount}</span> projects inside the selected circle.</>
                    : <>Blocked-project signal: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.effectiveBlockedRate.toFixed(0)}%</span> {hasRealQueueMetrics ? 'implied county block rate' : 'modeled county block rate'}.</>}
              </div>
              {analysis.blockedSource === 'circle' && (
                <div>
                  {analysis.circleBlockedLikeCount > 0
                    ? <>Blocked-like statuses in circle: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleBlockedLikeCount}</span> of <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleSiteCount}</span>.</>
                    : <>Blocked-like statuses in circle: <span style={{ fontWeight: 700, color: valueHighlightColor }}>none detected</span> (<span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleSiteCount}</span> projects reviewed).</>}
                </div>
              )}
              {analysis.blockedSource === 'circle' && analysis.circleUnknownCount > 0 && (
                <div>
                  Unknown/uncertain statuses: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleUnknownCount}</span> of <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.circleSiteCount}</span>; this estimate is low-confidence.
                </div>
              )}
              {analysis.hasSelectedSite && (
                <div>
                  Selected site status: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.selectedStatus || 'unknown'}</span> (<span style={{ fontWeight: 700, color: valueHighlightColor }}>{analysis.selectedBlockedRate == null ? 'pending' : `${analysis.selectedBlockedRate.toFixed(0)}% site lens`}</span>).
                </div>
              )}
              <div>{analysis.blockedWhy}</div>
              <div>
                {analysis.blockedSource === 'circle' ? 'County baseline: ' : ''}Queue withdrawn: <span style={{ fontWeight: 700, color: valueHighlightColor }}>{Number(queueMetrics?.queueWithdrawnCount ?? modeledQueueWithdrawnCount ?? 0)}</span> of <span style={{ fontWeight: 700, color: valueHighlightColor }}>{Number(queueMetrics?.totalQueueCount ?? modeledQueueTotalCount ?? 0)}</span> total requests.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleCopyBlockedSummary}
                  style={{
                    border: `1px solid ${hexToRgba(blockedCopyTone, 0.7)}`,
                    background: blockedCopyStatus === 'copied'
                      ? 'rgba(34,197,94,0.22)'
                      : blockedCopyStatus === 'error'
                        ? 'rgba(239,68,68,0.22)'
                        : hexToRgba(blockedCopyTone, 0.18),
                    color: blockedCopyStatus === 'copied'
                      ? 'rgba(220,252,231,0.95)'
                      : blockedCopyStatus === 'error'
                        ? 'rgba(254,226,226,0.95)'
                        : 'rgba(241,245,249,0.9)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontWeight: 600,
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                >
                  {blockedCopyStatus === 'copied' ? 'Copied' : blockedCopyStatus === 'error' ? 'Retry' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            ...metricRowBaseStyle,
            cursor: (isPending || isOutOfTexas) ? 'default' : 'pointer',
            position: 'relative',
            overflow: 'hidden',
            border: (showSequenceHalo || isSequenceSelected) ? `1px solid ${accentRgba(0.72)}` : metricRowBaseStyle.border,
            boxShadow: isSequenceSelected ? `0 0 0 1px ${accentRgba(0.24)} inset` : 'none'
          }}
          onClick={(isPending || isOutOfTexas) ? undefined : () => {
            setIsSequenceSelected(true);
            setIsSequenceExpanded((prev) => {
              track('opposition_sequence_toggled', { expanded: !prev });
              return !prev;
            });
            triggerSequenceHalo();
            onSequenceAction?.();
          }}
        >
          {showSequenceHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: `radial-gradient(circle at center, ${accentRgba(0.22)} 0%, ${accentRgba(0.08)} 48%, ${accentRgba(0)} 78%)`,
                animation: 'oppositionSequenceHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Delivery risk path</span>
            <span style={{ color: accentRgba(0.82), fontSize: '12px' }}>
              {isPending || isOutOfTexas ? 'Locked' : (isSequenceExpanded ? 'Hide ->' : 'Open ->')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px', gap: '8px' }}>
            <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600, textTransform: 'capitalize' }}>
              {isPending ? 'Pending' : (analysis.hasSelectedSite ? analysis.selectedPathRiskLabel : analysis.pathRiskLabel)}
            </span>
            <span style={{ color: descriptorColor, fontSize: '12.5px', textAlign: 'right' }}>
              {isPending ? 'waiting data' : (analysis.hasSelectedSite ? analysis.selectedSequenceLabel : analysis.sequenceLabel)}
            </span>
          </div>
          {isSequenceExpanded && (
            <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45 }}>
              <div>Likely path: {analysis.hasSelectedSite ? analysis.selectedSequenceLabel : analysis.sequenceLabel}.</div>
              <div>Path risk: {analysis.hasSelectedSite ? analysis.selectedPathRiskLabel : analysis.pathRiskLabel}.</div>
              <div>Why: {analysis.pathWhy}</div>
              <div>Operator context: {analysis.hasSelectedSite ? analysis.selectedOperatorLabel : analysis.operatorLabel}.</div>
              {analysis.hasSelectedSite && (
                <div>Selected site lens: {analysis.selectedSequenceLabel}.</div>
              )}
              <div>
                Hyperscaler vs smaller operators: {analysis.hyperscalerCount}/{nearbySites.length || 0} nearby projects map to hyperscaler owners.
              </div>
            </div>
          )}
        </div>
      </div>

      {!isOutOfTexas && !isPending && nearbySites.length > 0 && (analysis.sitesWithHeadlines > 0 || analysis.pinPrecisionParts || analysis.totalSourceCount > 0) && (
        <div
          style={{
            marginTop: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '7px',
            padding: '6px 8px',
            background: 'rgba(15,23,42,0.2)',
            color: 'rgba(203,213,225,0.88)',
            fontSize: '9.5px',
            lineHeight: 1.5,
            display: 'grid',
            gap: '3px'
          }}
        >
          {analysis.sitesWithHeadlines > 0 && (
            <div>
              Headlines w/ opposition keywords: {analysis.headlineOppositionCount} / {analysis.sitesWithHeadlines}
            </div>
          )}
          {analysis.pinPrecisionParts && (
            <div>
              Pin precision: {analysis.pinPrecisionParts}
            </div>
          )}
          {(analysis.totalSourceCount > 0 || Object.keys(analysis.statusConfidenceCounts || {}).length > 0) && (
            <div>
              Source strength: {analysis.totalSourceCount} sources
              {Object.keys(analysis.statusConfidenceCounts || {}).length > 0 && (
                <> · {Object.entries(analysis.statusConfidenceCounts)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(', ')} status confidence</>
              )}
            </div>
          )}
          <div>
            Hyperscaler projects nearby: {analysis.hyperscalerCount}/{nearbySites.length || 0}
          </div>
        </div>
      )}

      <div style={{ marginTop: '10px' }} />
      <style>{`
        @keyframes oppositionClusterMapPulse {
          0%, 100% {
            box-shadow: 0 0 0 2px ${hexToRgba(oppositionColor, 0.5)};
          }
          50% {
            box-shadow: 0 0 0 4px ${hexToRgba(oppositionColor, 0.85)}, 0 0 12px ${hexToRgba(oppositionColor, 0.35)};
          }
        }
        @keyframes oppositionClusterHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 ${accentRgba(0.42)}, 0 0 0 0 ${accentRgba(0.36)};
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px ${accentRgba(0.26)}, 0 0 0 8px ${accentRgba(0.08)};
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 ${accentRgba(0)}, 0 0 0 16px ${accentRgba(0)};
          }
        }
        @keyframes oppositionBlockedHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 ${accentRgba(0.42)}, 0 0 0 0 ${accentRgba(0.36)};
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px ${accentRgba(0.26)}, 0 0 0 8px ${accentRgba(0.08)};
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 ${accentRgba(0)}, 0 0 0 16px ${accentRgba(0)};
          }
        }
        @keyframes oppositionSequenceHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 ${accentRgba(0.42)}, 0 0 0 0 ${accentRgba(0.36)};
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px ${accentRgba(0.26)}, 0 0 0 8px ${accentRgba(0.08)};
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 ${accentRgba(0)}, 0 0 0 16px ${accentRgba(0)};
          }
        }
      `}</style>
    </div>
  );
};

export default Opposition;
