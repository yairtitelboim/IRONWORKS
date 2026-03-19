import React, { useMemo, useState } from 'react';

const styles = {
  container: {
    margin: '0 20px',
    padding: '12px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(96, 165, 250, 0.28)',
    background: 'transparent',
    boxShadow: 'none'
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8
  },
  statusWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  statusChip: {
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid transparent',
    letterSpacing: '0.03em',
    textTransform: 'uppercase'
  },
  statusMeta: {
    color: '#9aa0a6',
    fontSize: 10,
    fontWeight: 500
  },
  actionRow: {
    display: 'flex',
    gap: 8
  },
  refreshMarketButton: {
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'transparent',
    color: 'rgba(226,232,240,0.9)',
    borderRadius: 8,
    padding: '6px 9px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer'
  },
  refreshGridButton: {
    border: '1px solid rgba(96,165,250,0.45)',
    background: 'transparent',
    color: '#dbeafe',
    borderRadius: 8,
    padding: '6px 9px',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer'
  },
  loading: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11
  },
  error: {
    color: '#fca5a5',
    fontSize: 11
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 10
  },
  metricCard: {
    padding: '10px 10px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'transparent'
  },
  metricLabel: {
    color: 'rgba(191,219,254,0.95)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  metricValue: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: 900,
    marginTop: 2
  },
  metricHint: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 6
  },
  metricHintWide: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 10
  },
  metricSubtext: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 10,
    marginTop: 2
  },
  listCard: {
    padding: '10px 10px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'transparent'
  },
  listHeading: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6
  },
  listBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  listItemLink: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 11,
    lineHeight: 1.35,
    textDecoration: 'none'
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed'
  }
};

const MarketSignal = ({
  dailyMotion,
  dailyMotionLoading,
  dailyMotionError,
  onRefreshMarket,
  onRefreshGrid,
  locationContext = null,
  localMotion = null,
  containerMode = 'default'
}) => {
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [isRefreshingGrid, setIsRefreshingGrid] = useState(false);

  const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

  const status = useMemo(() => {
    if (dailyMotionError) {
      return {
        label: 'Error',
        meta: 'refresh failed',
        color: '#fecaca',
        bg: 'rgba(127, 29, 29, 0.28)',
        border: 'rgba(252, 165, 165, 0.45)'
      };
    }

    if (dailyMotionLoading || isRefreshingMarket || isRefreshingGrid) {
      return {
        label: 'Updating',
        meta: 'sync in progress',
        color: '#bfdbfe',
        bg: 'rgba(30, 58, 138, 0.25)',
        border: 'rgba(147, 197, 253, 0.45)'
      };
    }

    if (!dailyMotion?.updatedAt) {
      return {
        label: 'Unknown',
        meta: 'no run yet',
        color: '#d1d5db',
        bg: 'rgba(55, 65, 81, 0.35)',
        border: 'rgba(156, 163, 175, 0.35)'
      };
    }

    const ageMinutes = Math.floor((Date.now() - new Date(dailyMotion.updatedAt).getTime()) / 60000);
    if (ageMinutes <= 30) {
      return {
        label: 'Fresh',
        meta: `${ageMinutes}m ago`,
        color: '#86efac',
        bg: 'rgba(20, 83, 45, 0.28)',
        border: 'rgba(134, 239, 172, 0.42)'
      };
    }

    if (ageMinutes <= 180) {
      return {
        label: 'Recent',
        meta: `${Math.floor(ageMinutes / 60)}h ago`,
        color: '#fde68a',
        bg: 'rgba(120, 53, 15, 0.26)',
        border: 'rgba(253, 230, 138, 0.42)'
      };
    }

    return {
      label: 'Stale',
      meta: `${Math.floor(ageMinutes / 60)}h ago`,
      color: '#fca5a5',
      bg: 'rgba(127, 29, 29, 0.22)',
      border: 'rgba(252, 165, 165, 0.4)'
    };
  }, [dailyMotion?.updatedAt, dailyMotionError, dailyMotionLoading, isRefreshingGrid, isRefreshingMarket]);

  const handleRefreshMarket = async () => {
    if (isRefreshingMarket) return;
    setIsRefreshingMarket(true);
    try {
      await onRefreshMarket?.();
    } finally {
      setIsRefreshingMarket(false);
    }
  };

  const handleRefreshGrid = async () => {
    if (isRefreshingGrid) return;
    setIsRefreshingGrid(true);
    try {
      await onRefreshGrid?.();
    } finally {
      setIsRefreshingGrid(false);
    }
  };

  const isFlush = containerMode === 'flush';
  const containerStyle = isFlush
    ? { ...styles.container, margin: '14px 0 10px 0' }
    : styles.container;

  return (
    <div style={containerStyle}>
      <div style={styles.headerRow}>
        <div style={styles.statusWrap}>
          <span
            style={{
              ...styles.statusChip,
              color: status.color,
              background: status.bg,
              borderColor: status.border
            }}
          >
            {status.label}
          </span>
          <span style={styles.statusMeta}>{status.meta}</span>
        </div>
        <div style={styles.actionRow}>
          <button
            type="button"
            onClick={handleRefreshMarket}
            disabled={isRefreshingMarket}
            style={{
              ...styles.refreshMarketButton,
              ...(isRefreshingMarket ? styles.disabledButton : null)
            }}
            title="Refresh market news (last 7 days)"
          >
            {isRefreshingMarket ? 'Refreshing…' : 'Refresh Market'}
          </button>
          <button
            type="button"
            onClick={handleRefreshGrid}
            disabled={isRefreshingGrid}
            style={{
              ...styles.refreshGridButton,
              ...(isRefreshingGrid ? styles.disabledButton : null)
            }}
            title="Check for the latest ERCOT GIS report"
          >
            {isRefreshingGrid ? 'Checking…' : 'Check ERCOT'}
          </button>
        </div>
      </div>

      {dailyMotionLoading ? (
        <div style={styles.loading}>Loading motion…</div>
      ) : dailyMotionError ? (
        <div style={styles.error}>{dailyMotionError}</div>
      ) : (
        <>
          {locationContext && localMotion && (
            <div style={{ ...styles.metricCard, marginBottom: 10 }}>
              <div style={{ ...styles.metricLabel, marginBottom: 4 }}>
                Local Signal — {locationContext.label || 'Selected location'}
              </div>
              <div style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.4 }}>
                <strong>{localMotion.marketCount7d ?? 0}</strong> market items (7d),{' '}
                <strong>{localMotion.gridNewCount ?? 0}</strong> new queue changes,{' '}
                <strong>{localMotion.gridUpdatedCount ?? 0}</strong> updated queue changes
                {Number.isFinite(Number(locationContext.radiusMiles)) && (
                  <span style={{ color: 'rgba(148,163,184,0.85)' }}> within {Number(locationContext.radiusMiles).toFixed(0)} mi</span>
                )}
              </div>
              {Array.isArray(localMotion.topLocalMarketItems) && localMotion.topLocalMarketItems.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {localMotion.topLocalMarketItems.map((item) => (
                    <a
                      key={`local-${item.signal_id}`}
                      href={item.url || '#'}
                      target={item.url ? '_blank' : undefined}
                      rel={item.url ? 'noopener noreferrer' : undefined}
                      style={styles.listItemLink}
                      onClick={(e) => {
                        if (!item.url) e.preventDefault();
                      }}
                    >
                      • {item.headline}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Market (News)</div>
              <div style={styles.metricValue}>
                {dailyMotion.market.count7d}
                <span style={styles.metricHint}>last 7d</span>
              </div>
              <div style={styles.metricSubtext}>
                last ingest: {formatDate(dailyMotion.market.lastIngestedAt)}
              </div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Grid (ERCOT)</div>
              <div style={styles.metricValue}>
                {dailyMotion.grid.newCount}
                <span style={styles.metricHint}>new</span>
                <span style={styles.metricHintWide}>{dailyMotion.grid.updatedCount} updated</span>
              </div>
              <div style={styles.metricSubtext}>
                last ingest: {formatDate(dailyMotion.grid.lastIngestedAt)}
              </div>
            </div>
          </div>

          {dailyMotion.market.top?.length > 0 && (
            <div style={styles.listCard}>
              <div style={styles.listHeading}>Top Market Items</div>
              <div style={styles.listBody}>
                {dailyMotion.market.top.map((item) => (
                  <a
                    key={item.signal_id}
                    href={item.url || '#'}
                    target={item.url ? '_blank' : undefined}
                    rel={item.url ? 'noopener noreferrer' : undefined}
                    style={styles.listItemLink}
                    onClick={(e) => {
                      if (!item.url) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    • {item.headline}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MarketSignal;
