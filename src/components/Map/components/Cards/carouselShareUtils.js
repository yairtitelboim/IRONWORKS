const getOppositionColor = (dataCenterCount) => {
  if (dataCenterCount == null) return '#9ca3af';
  if (dataCenterCount === 0) return '#22c55e';
  if (dataCenterCount <= 2) return '#f59e0b';
  return '#ef4444';
};

const getOppositionLabel = (dataCenterCount) => {
  if (dataCenterCount == null) return 'Unknown';
  if (dataCenterCount === 0) return 'Low';
  if (dataCenterCount <= 2) return 'Watch';
  return 'Elevated';
};

export const getConfidenceLabel = (queueMetricsStatus, hasRealQueueMetrics) => {
  if (!queueMetricsStatus || queueMetricsStatus === 'pending') {
    return { label: 'Loading data', color: '#fbbf24' };
  }
  if (queueMetricsStatus === 'ready' && hasRealQueueMetrics) {
    return { label: 'High confidence', color: '#22c55e' };
  }
  if (queueMetricsStatus === 'fallback') {
    return { label: 'Preliminary', color: '#f59e0b' };
  }
  return { label: 'Estimated', color: '#94a3b8' };
};

export const getDecisiveSignal = (site, oppositionProps) => {
  const {
    circleStats,
    activeQueueVsErcot,
    queueMetrics,
    hasRealQueueMetrics
  } = oppositionProps;

  const inCircleCount = circleStats?.inCircleCount ?? null;
  const radiusMiles = circleStats?.radiusMiles ?? null;
  const pressure = Number.isFinite(Number(activeQueueVsErcot)) ? Number(activeQueueVsErcot) : null;
  const withdrawn = Number(queueMetrics?.queueWithdrawnCount || 0);
  const total = Number(queueMetrics?.totalQueueCount || 0);
  const blockedRate = total > 0 ? Math.min(100, Math.max(0, (withdrawn / total) * 100)) : null;

  if (Number.isFinite(inCircleCount) && inCircleCount >= 3 && Number.isFinite(radiusMiles)) {
    const level = getOppositionLabel(inCircleCount);
    return {
      type: 'cluster',
      label: `${level} cluster activity`,
      detail: `${inCircleCount} sites within ${radiusMiles.toFixed(1)} mi`,
      color: getOppositionColor(inCircleCount),
      severity: inCircleCount >= 3 ? 'high' : 'medium'
    };
  }

  if (pressure != null && pressure >= 1.5) {
    return {
      type: 'queue',
      label: `Queue pressure ${pressure.toFixed(1)}× ERCOT avg`,
      detail: hasRealQueueMetrics
        ? `${Math.round(Number(queueMetrics.activeQueueCount || 0))} active projects in county queue`
        : 'Based on regional data',
      color: pressure >= 2.5 ? '#ef4444' : '#f59e0b',
      severity: pressure >= 2.5 ? 'high' : 'medium'
    };
  }

  if (blockedRate != null && blockedRate >= 38) {
    return {
      type: 'friction',
      label: `High project friction (${blockedRate.toFixed(0)}% withdrawals)`,
      detail: `${withdrawn} of ${total} queue projects withdrawn`,
      color: '#ef4444',
      severity: 'high'
    };
  }

  if (blockedRate != null && blockedRate >= 22) {
    return {
      type: 'friction',
      label: `Moderate friction (${blockedRate.toFixed(0)}% withdrawals)`,
      detail: `${withdrawn} of ${total} queue projects withdrawn`,
      color: '#f59e0b',
      severity: 'medium'
    };
  }

  const nearestSubDistance = hasRealQueueMetrics && Number.isFinite(Number(queueMetrics?.nearestSubDistanceMi))
    ? Number(queueMetrics.nearestSubDistanceMi)
    : null;
  const nearestSubName = queueMetrics?.nearestSubName || null;

  if (nearestSubDistance != null && nearestSubName) {
    return {
      type: 'proximity',
      label: `${nearestSubDistance.toFixed(1)} mi to ${nearestSubName}`,
      detail: 'Nearest transmission substation',
      color: nearestSubDistance <= 3 ? '#22c55e' : nearestSubDistance <= 8 ? '#f59e0b' : '#94a3b8',
      severity: nearestSubDistance <= 3 ? 'low' : nearestSubDistance <= 8 ? 'medium' : 'high'
    };
  }

  return {
    type: 'unknown',
    label: 'Insufficient signal data',
    detail: 'Additional metrics pending',
    color: '#94a3b8',
    severity: 'unknown'
  };
};

export const getRelevantLinks = (site, oppositionProps) => {
  const links = [];
  const seen = new Set();

  const pushLink = (link) => {
    const url = String(link?.url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push(link);
  };

  if (site?.sourceUrl) {
    pushLink({
      label: site.articleTitle || 'Source article',
      url: site.sourceUrl,
      type: 'latest_signal'
    });
  }

  if (Array.isArray(site?.signalLinks)) {
    site.signalLinks
      .filter((link) => link && link.excluded !== true)
      .forEach((link) => {
        pushLink({
          label: link.title || link.domain || 'Related link',
          url: link.url,
          type: 'signal_link',
          meta: link.domain || null
        });
      });
  }

  const mostRecentSite = oppositionProps?.circleStats?.mostRecentSite;
  if (mostRecentSite?.sourceUrl && mostRecentSite.projectId !== site?.projectId) {
    pushLink({
      label: mostRecentSite.articleTitle || `${mostRecentSite.displayName} article`,
      url: mostRecentSite.sourceUrl,
      type: 'reference'
    });
  }

  if (site?.lat != null && site?.lng != null) {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const url = new URL(window.location.href);
        url.searchParams.set('lat', site.lat);
        url.searchParams.set('lng', site.lng);
        if (site.projectId) {
          url.searchParams.set('site', site.projectId);
        }
        pushLink({
          label: 'View on map',
          url: url.toString(),
          type: 'map'
        });
      }
    } catch (err) {
      console.warn('Failed to generate map URL:', err);
    }
  }

  return links;
};

export const generateShareBullets = (site, oppositionProps, searchedPlace) => {
  const signal = getDecisiveSignal(site, oppositionProps);
  const { queueMetrics, hasRealQueueMetrics, circleStats } = oppositionProps;

  const bullets = [];

  const plannedMw = Number(site?.plannedMw);
  const totalMw = Number(site?.totalMw ?? site?.sizeMw);
  const mwLabel = Number.isFinite(plannedMw) && plannedMw > 0
    ? `${Math.round(plannedMw).toLocaleString()} MW planned`
    : Number.isFinite(totalMw) && totalMw > 0
      ? `${Math.round(totalMw).toLocaleString()} MW`
      : null;
  const locationLabel = site?.city || site?.location || null;
  if (mwLabel || site?.status) {
    bullets.push({
      label: 'Scale',
      value: mwLabel || String(site.status || 'Unknown status'),
      detail: mwLabel && site?.status
        ? `${site.status}${locationLabel ? ` · ${locationLabel}` : ''}`
        : locationLabel,
      color: '#fca5a5'
    });
  }

  const operatorLabel = site?.owner && site.owner !== site.displayName ? site.owner : null;
  if (operatorLabel) {
    bullets.push({
      label: 'Operator',
      value: operatorLabel,
      detail: site?.displayName && site.displayName !== operatorLabel ? site.displayName : null,
      color: '#cbd5e1'
    });
  }

  const counterpartyValue = site?.tenant || site?.endUser || null;
  if (counterpartyValue) {
    bullets.push({
      label: site?.tenant ? 'Tenant' : 'End user',
      value: counterpartyValue,
      detail: site?.tenant && site?.endUser ? `End user: ${site.endUser}` : null,
      color: '#93c5fd'
    });
  }

  const infraValue = site?.powerSource || site?.typeLabel || site?.type || null;
  if (infraValue) {
    bullets.push({
      label: site?.powerSource ? 'Power' : 'Type',
      value: infraValue,
      detail: null,
      color: site?.powerSource ? '#bfdbfe' : '#94a3b8'
    });
  }

  bullets.push({
    label: 'Signal',
    value: signal.label,
    detail: signal.detail,
    color: signal.color
  });

  const siteRefName = site?.articleTitle || site?.displayName || null;
  const siteRefDate = site?.announcedDate
    ? new Date(site.announcedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;
  const mostRecentSite = circleStats?.mostRecentSite;
  if (siteRefName) {
    bullets.push({
      label: site?.latestSignalKind ? 'Latest signal' : 'Reference',
      value: siteRefName,
      detail: siteRefDate
        ? `Announced ${siteRefDate}`
        : (site?.latestSignalKind
            ? `${String(site.latestSignalKind).replaceAll('_', ' ')}`
            : (site?.sourceUrl ? 'Linked source available' : null)),
      color: '#94a3b8'
    });
  } else if (mostRecentSite) {
    const refName = mostRecentSite.displayName || 'Unknown site';
    const refDate = mostRecentSite.announcedDate
      ? new Date(mostRecentSite.announcedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      : null;
    bullets.push({
      label: 'Reference',
      value: refName,
      detail: refDate ? `Announced ${refDate}` : 'Recent nearby project',
      color: '#94a3b8'
    });
  } else if (site.owner) {
    bullets.push({
      label: 'Operator',
      value: site.owner,
      detail: site.status ? `Status: ${site.status}` : null,
      color: '#94a3b8'
    });
  }

  const confidence = getConfidenceLabel(
    oppositionProps.metricsStatusLabel?.toLowerCase(),
    hasRealQueueMetrics
  );
  bullets.push({
    label: 'Confidence',
    value: confidence.label,
    detail: hasRealQueueMetrics
      ? 'County-level queue data'
      : 'Regional estimates',
    color: confidence.color
  });

  return bullets.slice(0, 5);
};

export const generateShareText = (site, oppositionProps, searchedPlace) => {
  const bullets = generateShareBullets(site, oppositionProps, searchedPlace);
  const signal = getDecisiveSignal(site, oppositionProps);
  const { circleStats, activeQueueVsErcot, queueMetrics } = oppositionProps;

  const lines = [];
  lines.push(`${site.displayName} — ${site.distanceMi.toFixed(1)} mi from ${searchedPlace}`);
  lines.push('');
  lines.push(`Signal: ${signal.label}`);
  
  if (circleStats?.inCircleCount != null && circleStats?.radiusMiles != null) {
    lines.push(`  Cluster: ${circleStats.inCircleCount} sites within ${circleStats.radiusMiles.toFixed(1)} mi`);
  }
  
  if (activeQueueVsErcot != null) {
    lines.push(`  Queue: ${activeQueueVsErcot.toFixed(1)}x ERCOT avg`);
  }
  
  const withdrawn = Number(queueMetrics?.queueWithdrawnCount || 0);
  const total = Number(queueMetrics?.totalQueueCount || 0);
  if (total > 0) {
    const blockedRate = Math.min(100, Math.max(0, (withdrawn / total) * 100));
    lines.push(`  Friction: ${blockedRate.toFixed(0)}% project withdrawals`);
  }

  const mostRecentSite = circleStats?.mostRecentSite;
  if (mostRecentSite) {
    const refDate = mostRecentSite.announcedDate
      ? new Date(mostRecentSite.announcedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      : null;
    lines.push('');
    lines.push(`Reference: ${mostRecentSite.displayName}${refDate ? ` (${refDate})` : ''}`);
  }

  lines.push('');
  const confidence = bullets.find((b) => b.label === 'Confidence');
  if (confidence) {
    lines.push(`Confidence: ${confidence.value}`);
  }

  if (typeof window !== 'undefined' && window.location) {
    const url = new URL(window.location.href);
    url.searchParams.set('lat', site.lat);
    url.searchParams.set('lng', site.lng);
    if (site.projectId) {
      url.searchParams.set('site', site.projectId);
    }
    lines.push('');
    lines.push(`View on map: ${url.toString()}`);
  }

  return lines.join('\n');
};

export const generateShareURL = (site, searchedPlace) => {
  if (typeof window === 'undefined' || !window.location) return null;
  const url = new URL(window.location.href);
  url.searchParams.set('lat', site.lat);
  url.searchParams.set('lng', site.lng);
  if (site.projectId) {
    url.searchParams.set('site', site.projectId);
  }
  return url.toString();
};
