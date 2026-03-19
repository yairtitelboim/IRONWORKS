import React, { useEffect, useRef, useState } from 'react';

const descriptorColor = 'rgba(148,163,184,0.72)';
const labelColor = 'rgba(203,213,225,0.62)';
const valueColor = '#e2e8f0';

const FeasibilityVerdictCard = ({
  verdict,
  queueStatusLabel,
  activeQueueVsErcot,
  nearestSubDistance,
  nearestSubVoltageKv,
  nearestSubOperator,
  nearestSubName,
  waitLow,
  waitHigh,
  onPrimaryAction,
  onQueueAction,
  onSubAction,
  onWaitAction,
  onRiskReview,
  onUnderwrite,
  queueExpandedContent = null,
  subExpandedContent = null,
  waitExpandedContent = null,
  noDataCentersInRadius = false,
  noDataCentersRadiusMiles = null,
  nearestDataCenterDistanceMi = null,
  onNearestDataCenterAction = null,
  isTexasSupportedAddress = true,
  texasSupportNote = 'Currently supporting Texas locations only. Try a TX address.'
}) => {
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [showQueueHalo, setShowQueueHalo] = useState(false);
  const [isQueueSelected, setIsQueueSelected] = useState(false);
  const [isSubExpanded, setIsSubExpanded] = useState(false);
  const [showSubHalo, setShowSubHalo] = useState(false);
  const [isSubSelected, setIsSubSelected] = useState(false);
  const [isWaitExpanded, setIsWaitExpanded] = useState(false);
  const [showWaitHalo, setShowWaitHalo] = useState(false);
  const [isWaitSelected, setIsWaitSelected] = useState(false);
  const queueHaloTimeoutRef = useRef(null);
  const subHaloTimeoutRef = useRef(null);
  const waitHaloTimeoutRef = useRef(null);
  const metricsState = String(queueStatusLabel || '').toLowerCase();
  const isOutOfTexas = !isTexasSupportedAddress;
  const isPendingMetrics = metricsState === 'pending';
  const isPreliminaryMetrics = metricsState === 'preliminary' || metricsState === 'fallback';

  const verdictKey = String(verdict?.label || '').toLowerCase();
  const primaryLabel = isOutOfTexas
    ? 'Texas only'
    : isPendingMetrics
    ? 'Loading...'
    : isPreliminaryMetrics
      ? 'Explain'
      : verdictKey === 'low'
        ? 'Nearby'
        : verdictKey === 'high'
          ? 'Open nearby DCs ->'
          : 'Run risk review ->';
  const primaryActionHandler = isOutOfTexas
    ? undefined
    : isPendingMetrics
      ? undefined
      : (isPreliminaryMetrics ? (onQueueAction || onPrimaryAction) : onPrimaryAction);
  const queueActionLabel = isOutOfTexas ? 'Texas only' : (isPendingMetrics ? 'Loading...' : (isPreliminaryMetrics ? 'Explain' : 'Risk ->'));

  const metricRowBaseStyle = {
    padding: '7px 8px',
    borderRadius: '7px',
    background: 'rgba(15,23,42,0.22)',
    border: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer'
  };
  const metricActionStyle = {
    border: 'none',
    background: 'transparent',
    color: 'rgba(248,113,113,0.82)',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    padding: 0
  };

  useEffect(() => {
    return () => {
      if (queueHaloTimeoutRef.current) {
        clearTimeout(queueHaloTimeoutRef.current);
      }
      if (subHaloTimeoutRef.current) {
        clearTimeout(subHaloTimeoutRef.current);
      }
      if (waitHaloTimeoutRef.current) {
        clearTimeout(waitHaloTimeoutRef.current);
      }
    };
  }, []);

  const triggerQueueHalo = () => {
    if (queueHaloTimeoutRef.current) {
      clearTimeout(queueHaloTimeoutRef.current);
    }
    setShowQueueHalo(false);
    requestAnimationFrame(() => {
      setShowQueueHalo(true);
      queueHaloTimeoutRef.current = setTimeout(() => {
        setShowQueueHalo(false);
      }, 760);
    });
  };

  const triggerQueueAction = ({ toggleExpand = false } = {}) => {
    setIsQueueSelected(true);
    if (toggleExpand) {
      setIsQueueExpanded((prev) => !prev);
    }
    onQueueAction?.();
    triggerQueueHalo();
  };

  const triggerSubHalo = () => {
    if (subHaloTimeoutRef.current) {
      clearTimeout(subHaloTimeoutRef.current);
    }
    setShowSubHalo(false);
    requestAnimationFrame(() => {
      setShowSubHalo(true);
      subHaloTimeoutRef.current = setTimeout(() => {
        setShowSubHalo(false);
      }, 760);
    });
  };

  const triggerWaitHalo = () => {
    if (waitHaloTimeoutRef.current) {
      clearTimeout(waitHaloTimeoutRef.current);
    }
    setShowWaitHalo(false);
    requestAnimationFrame(() => {
      setShowWaitHalo(true);
      waitHaloTimeoutRef.current = setTimeout(() => {
        setShowWaitHalo(false);
      }, 760);
    });
  };

  const triggerSubAction = ({ toggleExpand = false } = {}) => {
    setIsSubSelected(true);
    if (toggleExpand) {
      setIsSubExpanded((prev) => !prev);
    }
    onSubAction?.();
    triggerSubHalo();
  };

  const triggerWaitAction = ({ toggleExpand = false } = {}) => {
    setIsWaitSelected(true);
    if (toggleExpand) {
      setIsWaitExpanded((prev) => !prev);
    }
    onWaitAction?.();
    triggerWaitHalo();
  };

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '8px 9px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ color: verdict.color, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Feasibility {verdict.label}
        </span>
        <button
          type="button"
          onClick={primaryActionHandler}
          disabled={!primaryActionHandler}
          style={{
            border: '1px solid rgba(248,113,113,0.45)',
            background: 'rgba(127,29,29,0.28)',
            color: 'rgba(254,226,226,0.88)',
            borderRadius: '7px',
            padding: '3px 7px',
            fontSize: '10px',
            fontWeight: 600,
            cursor: primaryActionHandler ? 'pointer' : 'default',
            opacity: primaryActionHandler ? 1 : 0.65
          }}
          title={`Metrics: ${queueStatusLabel}`}
        >
          {primaryLabel}
        </button>
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
            fontSize: '8.5px',
            lineHeight: 1.35
          }}
        >
          {texasSupportNote}
        </div>
      )}
      {!isOutOfTexas && noDataCentersInRadius && onNearestDataCenterAction && (
        <div
          style={{
            marginTop: '7px',
            border: '1px solid rgba(96,165,250,0.45)',
            borderRadius: '8px',
            padding: '7px',
            background: 'rgba(30,64,175,0.16)',
            color: 'rgba(219,234,254,0.95)',
            fontSize: '10.5px',
            lineHeight: 1.4
          }}
        >
          <div style={{ marginBottom: '6px' }}>
            No data centers found in the current {Number.isFinite(Number(noDataCentersRadiusMiles)) ? Number(noDataCentersRadiusMiles).toFixed(1) : '0.4'} mi radius.
          </div>
          <button
            type="button"
            onClick={onNearestDataCenterAction}
            style={{
              border: '1px solid rgba(96,165,250,0.65)',
              background: 'rgba(59,130,246,0.24)',
              color: '#dbeafe',
              borderRadius: '7px',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Jump to nearest area{Number.isFinite(Number(nearestDataCenterDistanceMi)) ? ` (${Number(nearestDataCenterDistanceMi).toFixed(1)} mi)` : ''}
          </button>
        </div>
      )}
      <div style={{ marginTop: '7px', display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
        <div
          style={{
            ...metricRowBaseStyle,
            cursor: (isPendingMetrics || isOutOfTexas) ? 'default' : metricRowBaseStyle.cursor,
            position: 'relative',
            overflow: 'hidden',
            border: (showQueueHalo || isQueueSelected) ? '1px solid rgba(248,113,113,0.72)' : metricRowBaseStyle.border,
            boxShadow: isQueueSelected ? '0 0 0 1px rgba(248,113,113,0.24) inset' : 'none'
          }}
          onClick={(isPendingMetrics || isOutOfTexas) ? undefined : () => triggerQueueAction({ toggleExpand: true })}
        >
          {showQueueHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle at center, rgba(248,113,113,0.22) 0%, rgba(248,113,113,0.08) 48%, rgba(248,113,113,0) 78%)',
                animation: 'queueHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Queue</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isPendingMetrics && !isOutOfTexas) triggerQueueAction();
              }}
              disabled={isPendingMetrics || isOutOfTexas}
              style={{ ...metricActionStyle, cursor: (isPendingMetrics || isOutOfTexas) ? 'default' : 'pointer', opacity: (isPendingMetrics || isOutOfTexas) ? 0.65 : 1 }}
            >
              {queueActionLabel}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px' }}>
            <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600 }}>
              {isOutOfTexas ? 'Texas only' : (activeQueueVsErcot != null ? `${activeQueueVsErcot.toFixed(1)}x` : 'Pending')}
            </span>
            <span style={{ color: descriptorColor, fontSize: '12.5px' }}>
              {isOutOfTexas ? 'try a TX address' : (activeQueueVsErcot == null ? 'waiting data' : activeQueueVsErcot > 1.3 ? 'above avg' : activeQueueVsErcot < 0.9 ? 'below avg' : 'near avg')}
            </span>
          </div>
          {isQueueExpanded && (
            <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45 }}>
              <div>Status: {queueStatusLabel}</div>
              <div>
                Queue pressure: {activeQueueVsErcot != null ? `${activeQueueVsErcot.toFixed(1)}x ERCOT avg` : 'pending'}
              </div>
              <div>
                Signal: {activeQueueVsErcot == null ? 'waiting data' : activeQueueVsErcot > 1.3 ? 'above average congestion' : activeQueueVsErcot < 0.9 ? 'below average congestion' : 'near average congestion'}
              </div>
              {queueExpandedContent && (
                <div style={{ marginTop: '6px' }}>
                  {queueExpandedContent}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            ...metricRowBaseStyle,
            position: 'relative',
            overflow: 'hidden',
            border: (showSubHalo || isSubSelected) ? '1px solid rgba(248,113,113,0.72)' : metricRowBaseStyle.border,
            boxShadow: isSubSelected ? '0 0 0 1px rgba(248,113,113,0.24) inset' : 'none'
          }}
          onClick={() => {
            if (isOutOfTexas) return;
            triggerSubAction({ toggleExpand: true });
          }}
        >
          {showSubHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle at center, rgba(248,113,113,0.22) 0%, rgba(248,113,113,0.08) 48%, rgba(248,113,113,0) 78%)',
                animation: 'nearestSubHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Nearest sub</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isOutOfTexas) return;
                triggerSubAction();
              }}
              style={{ ...metricActionStyle, cursor: isOutOfTexas ? 'default' : 'pointer', opacity: isOutOfTexas ? 0.65 : 1 }}
              disabled={isOutOfTexas}
            >
              View sub {'->'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px' }}>
            <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600 }}>
              {isOutOfTexas ? 'Texas only' : (Number.isFinite(nearestSubDistance) ? `${nearestSubDistance.toFixed(1)} mi` : 'Pending')}
            </span>
            <span style={{ color: descriptorColor, fontSize: '12.5px' }}>
              {isOutOfTexas ? 'try a TX address' : (!Number.isFinite(nearestSubDistance) ? 'waiting data' : nearestSubDistance <= 2 ? 'very close' : nearestSubDistance <= 5 ? 'nearby' : 'farther out')}
            </span>
          </div>
          {isSubExpanded && (
            <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45 }}>
              {nearestSubName && <div>Sub: {nearestSubName}</div>}
              <div>
                kV: {nearestSubVoltageKv != null ? `${nearestSubVoltageKv} kV` : 'pending'}
              </div>
              <div>
                Operator: {nearestSubOperator || 'pending'}
              </div>
              {subExpandedContent && (
                <div style={{ marginTop: '6px' }}>
                  {subExpandedContent}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            ...metricRowBaseStyle,
            position: 'relative',
            overflow: 'hidden',
            border: (showWaitHalo || isWaitSelected) ? '1px solid rgba(248,113,113,0.72)' : metricRowBaseStyle.border,
            boxShadow: isWaitSelected ? '0 0 0 1px rgba(248,113,113,0.24) inset' : 'none'
          }}
          onClick={() => {
            if (isOutOfTexas) return;
            triggerWaitAction({ toggleExpand: true });
          }}
        >
          {showWaitHalo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '7px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle at center, rgba(248,113,113,0.22) 0%, rgba(248,113,113,0.08) 48%, rgba(248,113,113,0) 78%)',
                animation: 'waitHaloPulse 760ms ease-out forwards'
              }}
            />
          )}
          <div style={{ color: labelColor, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Wait</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isOutOfTexas) return;
                triggerWaitAction();
              }}
              style={{ ...metricActionStyle, cursor: isOutOfTexas ? 'default' : 'pointer', opacity: isOutOfTexas ? 0.65 : 1 }}
              disabled={isOutOfTexas}
            >
              Scenario {'->'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '1px' }}>
            <span style={{ color: valueColor, fontSize: '15px', fontWeight: 600 }}>
              {isOutOfTexas ? 'Texas only' : (waitLow != null && waitHigh != null ? `${waitLow}-${waitHigh} mo` : 'Pending')}
            </span>
            <span style={{ color: descriptorColor, fontSize: '12.5px' }}>
              {isOutOfTexas ? 'try a TX address' : (waitHigh == null ? 'waiting data' : waitHigh <= 18 ? 'faster' : waitHigh <= 30 ? 'moderate' : 'long queue')}
            </span>
          </div>
          {isWaitExpanded && (
            <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px', color: 'rgba(203,213,225,0.82)', fontSize: '13.5px', lineHeight: 1.45 }}>
              <div>Estimated queue wait: {waitLow != null && waitHigh != null ? `${waitLow}-${waitHigh} months` : 'pending'}</div>
              <div>Timeline signal: {waitHigh == null ? 'waiting data' : waitHigh <= 18 ? 'faster energization window' : waitHigh <= 30 ? 'moderate timeline risk' : 'elevated delay risk'}</div>
              {waitExpandedContent && (
                <div style={{ marginTop: '6px' }}>
                  {waitExpandedContent}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes queueHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0.42), 0 0 0 0 rgba(248,113,113,0.36);
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px rgba(248,113,113,0.26), 0 0 0 8px rgba(248,113,113,0.08);
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0), 0 0 0 16px rgba(248,113,113,0);
          }
        }
        @keyframes nearestSubHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0.42), 0 0 0 0 rgba(248,113,113,0.36);
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px rgba(248,113,113,0.26), 0 0 0 8px rgba(248,113,113,0.08);
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0), 0 0 0 16px rgba(248,113,113,0);
          }
        }
        @keyframes waitHaloPulse {
          0% {
            opacity: 0.95;
            transform: scale(0.98);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0.42), 0 0 0 0 rgba(248,113,113,0.36);
          }
          70% {
            opacity: 0.55;
            transform: scale(1);
            box-shadow: inset 0 0 0 1px rgba(248,113,113,0.26), 0 0 0 8px rgba(248,113,113,0.08);
          }
          100% {
            opacity: 0;
            transform: scale(1.01);
            box-shadow: inset 0 0 0 0 rgba(248,113,113,0), 0 0 0 16px rgba(248,113,113,0);
          }
        }
      `}</style>
      <div style={{ marginTop: '6px', color: 'rgba(203,213,225,0.58)', fontSize: '10px', lineHeight: 1.35 }}>
        {verdict.reason}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={onRiskReview}
          disabled={!onRiskReview || isOutOfTexas}
          style={{
            flex: 1,
            border: '1px solid rgba(248,113,113,0.34)',
            borderRadius: '6px',
            background: 'rgba(31,41,55,0.4)',
            color: 'rgba(248,250,252,0.82)',
            padding: '6px 0',
            fontSize: '10px',
            fontWeight: 600,
            cursor: (!onRiskReview || isOutOfTexas) ? 'default' : 'pointer',
            opacity: (!onRiskReview || isOutOfTexas) ? 0.65 : 1
          }}
        >
          Risk review
        </button>
        <button
          type="button"
          onClick={onUnderwrite}
          disabled={!onUnderwrite || isOutOfTexas}
          style={{
            flex: 1,
            border: '1px solid rgba(248,113,113,0.34)',
            borderRadius: '6px',
            background: 'rgba(31,41,55,0.4)',
            color: 'rgba(248,250,252,0.82)',
            padding: '6px 0',
            fontSize: '10px',
            fontWeight: 600,
            cursor: (!onUnderwrite || isOutOfTexas) ? 'default' : 'pointer',
            opacity: (!onUnderwrite || isOutOfTexas) ? 0.65 : 1
          }}
        >
          Underwrite
        </button>
      </div>
    </div>
  );
};

export default FeasibilityVerdictCard;
