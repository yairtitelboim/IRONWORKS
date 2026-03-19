import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import AgriculturalTrendChart from './AgriculturalTrendChart';

const METRIC_CONFIG = {
  agriculture_loss: { label: 'Agriculture loss', color: '#f97316' },
  agriculture_gain: { label: 'Protected Agriculture', color: '#22c55e' },
  industrial_expansion: { label: 'Industrial expansion', color: '#f43f5e' },
  water_change: { label: 'Water reallocated', color: '#38bdf8' }
};

const formatHa = (value) => {
  if (typeof value !== 'number') return '0.0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const toNumber = (value, fallback = 0) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const percentOf = (value, target) => {
  if (!target || target <= 0) return 0;
  return (value / target) * 100;
};

const SCENARIO_STAGE_COLORS = {
  baseline: '#38bdf8',
  drawdown: '#0ea5e9',
  event: '#f97316',
  stress: '#ef4444',
  recovery: '#facc15'
};

const deriveScenarioStage = (entry) => {
  switch (entry.date) {
    case '2025-10':
      return 'baseline';
    case '2026-03':
      return 'drawdown';
    case '2026-07':
      return 'event';
    case '2026-08':
      return 'stress';
    default:
      return 'recovery';
  }
};

const MetricRow = ({ label, value, description, percent, accentColor }) => {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent || 0)));
  const accent = accentColor || '#38bdf8';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${accent}40`,
        background: `${accent}15`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#e5e7eb' }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        borderRadius: '999px',
        background: 'rgba(148, 163, 184, 0.25)',
        overflow: 'hidden'
      }}>
        <div
          style={{
            width: `${safePercent}%`,
            height: '100%',
            background: accent,
            boxShadow: `0 0 8px ${accent}`
          }}
        />
      </div>
      {description && (
        <div style={{ fontSize: '10px', color: 'rgba(226, 232, 240, 0.68)' }}>
          {description}
        </div>
      )}
    </div>
  );
};

const WhitneySummaryPanel = ({ totals, animatedValues, isAnimating }) => {
  const metricConfigs = [
    {
      key: 'industrial_expansion',
      label: 'Industrial pads delivered',
      description: 'Pad 3 & 4 energized with 120 MW ready capacity.',
      accent: '#38bdf8',
      fallback: 68
    },
    {
      key: 'agriculture_loss',
      label: 'Agriculture repurposed',
      description: 'Row-crop acreage re-zoned for data center expansion.',
      accent: '#f97316',
      fallback: 54
    },
    {
      key: 'agriculture_gain',
      label: 'Green buffers preserved',
      description: 'Riparian shielding and pollinator corridors retained.',
      accent: '#22c55e',
      fallback: 22
    },
    {
      key: 'water_change',
      label: 'Water reallocated',
      description: 'On-site retention ponds + Brazos River offsets.',
      accent: '#38bdf8',
      fallback: 9
    }
  ];

  const getMetricState = (key, fallback) => {
    const target = toNumber(totals[key], fallback);
    const animated = toNumber(animatedValues?.[key], isAnimating ? 0 : target);
    const current = isAnimating ? Math.min(target, animated) : target;
    return { current, target };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#bae6fd', textTransform: 'uppercase' }}>
        DC build pulse
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {metricConfigs.map(metric => {
          const { current, target } = getMetricState(metric.key, metric.fallback);
          return (
            <MetricRow
              key={metric.label}
              label={metric.label}
              value={`${formatHa(current)} ha`}
              description={metric.description}
              percent={percentOf(current, target || metric.fallback || current || 1)}
              accentColor={metric.accent}
            />
          );
        })}
      </div>
    </div>
  );
};

const LakesideSummaryPanel = ({ totals, animatedValues, isAnimating }) => {
  const metricConfigs = [
    {
      key: 'agriculture_gain',
      label: 'Shoreline recovery',
      description: 'Revegetated coves + marina buffers.',
      accent: '#38bdf8',
      fallback: 14
    },
    {
      key: 'agriculture_loss',
      label: 'Ag land converted',
      description: 'Lake-front parcels shifting to mixed-use.',
      accent: '#f97316',
      fallback: 18
    },
    {
      key: 'water_change',
      label: 'Water surface shift',
      description: 'Lake level changes + tailrace mixing.',
      accent: '#0ea5e9',
      fallback: 6
    },
    {
      key: 'industrial_expansion',
      label: 'Recreation pads',
      description: 'RV + marina staging expansions since 2021.',
      accent: '#facc15',
      fallback: 9
    }
  ];

  const getMetricState = (key, fallback) => {
    const target = toNumber(totals[key], fallback);
    const animated = toNumber(animatedValues?.[key], isAnimating ? 0 : target);
    const current = isAnimating ? Math.min(target, animated) : target;
    return { current, target };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#bae6fd', textTransform: 'uppercase' }}>
        Shoreline signals
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {metricConfigs.map(metric => {
          const { current, target } = getMetricState(metric.key, metric.fallback);
          return (
            <MetricRow
              key={metric.label}
              label={metric.label}
              value={`${formatHa(current)} ha`}
              description={metric.description}
              percent={percentOf(current, target || metric.fallback || current || 1)}
              accentColor={metric.accent}
            />
          );
        })}
      </div>
    </div>
  );
};

const DamSummaryPanel = ({ totals, animatedValues, isAnimating, hasAnimationRun }) => {
  const metricConfigs = [
    {
      key: 'water_change',
      label: 'Tailrace water shift',
      description: 'Surface area variability downstream of dam spillway.',
      accent: '#0ea5e9',
      fallback: 14
    },
    {
      key: 'agriculture_gain',
      label: 'Hydro buffer secured',
      description: 'Riparian mitigation stands above highway 22 cut.',
      accent: '#34d399',
      fallback: 11
    },
    {
      key: 'industrial_expansion',
      label: 'Industrial encroachment',
      description: 'Utility staging yards + transmission upgrades.',
      accent: '#facc15',
      fallback: 7
    },
    {
      key: 'agriculture_loss',
      label: 'Agriculture displacement',
      description: 'Dryland pasture reallocated to flood-control berms.',
      accent: '#f97316',
      fallback: 9
    }
  ];

  const scenarioTimeline = useMemo(() => ([
    {
      date: '2025-11',
      lakeElevationFt: 533,
      hydroMw: 30,
      ercotPrice: 40,
      note: 'Reservoir full. Three turbines carry 30 MW baseload.'
    },
    {
      date: '2026-05',
      lakeElevationFt: 524,
      hydroMw: 18,
      ercotPrice: 65,
      note: 'Army Corps reallocation. Tailrace throttled to preserve head pressure.'
    },
    {
      date: '2026-07',
      lakeElevationFt: 512,
      hydroMw: 0,
      ercotPrice: 480,
      note: '105°F event. Lake drops 20 ft. Hydropower offline while DC cooling peaks.'
    },
    {
      date: '2026-08',
      lakeElevationFt: 508,
      hydroMw: 0,
      ercotPrice: 2000,
      note: 'Scarcity pricing hits $2,000/MWh. 30 MW gap persists for 12 days.'
    }
  ]), []);

  const chartWidth = 230;
  const chartHeight = 180;
  const marginX = 7;
  const marginY = 22;

  const elevations = scenarioTimeline.map(entry => entry.lakeElevationFt);
  const prices = scenarioTimeline.map(entry => entry.ercotPrice);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const buildPoints = useCallback((getter, minVal, maxVal) => {
    const span = Math.max(1, maxVal - minVal);
    return scenarioTimeline.map((entry, idx) => {
      const x = marginX + (idx / Math.max(1, scenarioTimeline.length - 1)) * (chartWidth - marginX * 2);
      const y = chartHeight - marginY - ((getter(entry) - minVal) / span) * (chartHeight - marginY * 2);
      return { x, y };
    });
  }, [scenarioTimeline]);

  const waterPoints = useMemo(() => buildPoints(entry => entry.lakeElevationFt, minElevation, maxElevation), [buildPoints, minElevation, maxElevation]);
  const pricePoints = useMemo(() => buildPoints(entry => entry.ercotPrice, minPrice, maxPrice), [buildPoints, minPrice, maxPrice]);

  const waterPathD = useMemo(() => waterPoints
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(' '), [waterPoints]);

  const pricePathD = useMemo(() => pricePoints
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(' '), [pricePoints]);

  const waterPathRef = useRef(null);
  const pricePathRef = useRef(null);
  const [waterLength, setWaterLength] = useState(0);
  const [priceLength, setPriceLength] = useState(0);
  const [drawReady, setDrawReady] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const showTimeline = hasAnimationRun && !isAnimating;

  useEffect(() => {
    if (waterPathRef.current) {
      setWaterLength(waterPathRef.current.getTotalLength());
    }
    if (pricePathRef.current) {
      setPriceLength(pricePathRef.current.getTotalLength());
    }
  }, [waterPathD, pricePathD]);

  useEffect(() => {
    if (!isAnimating) {
      setDrawReady(true);
      return;
    }
    setDrawReady(false);
    const id = requestAnimationFrame(() => setDrawReady(true));
    return () => cancelAnimationFrame(id);
  }, [isAnimating]);

  useEffect(() => {
    if (showTimeline) {
      setDetailsExpanded(false);
    }
  }, [showTimeline]);

  const getMetricState = (key, fallback) => {
    const target = toNumber(totals[key], fallback);
    const animated = toNumber(animatedValues?.[key], isAnimating ? 0 : target);
    const current = isAnimating ? Math.min(target, animated) : target;
    return { current, target };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#bae6fd', textTransform: 'uppercase' }}>
        Dam operations pulse
      </div>
      {showTimeline && (
        <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${chartHeight + 24}px`,
          background: 'transparent',
          borderRadius: '10px',
          padding: '12px'
        }}
        >
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block', width: '100%', height: '100%' }}>
          <line
            x1={marginX}
            y1={chartHeight - marginY}
            x2={chartWidth - marginX}
            y2={chartHeight - marginY}
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth={1}
          />
          <line
            x1={marginX}
            y1={marginY}
            x2={marginX}
            y2={chartHeight - marginY}
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth={1}
          />
          <path
            ref={waterPathRef}
            d={waterPathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.2}
            strokeDasharray={waterLength || 1}
            strokeDashoffset={drawReady ? 0 : waterLength || 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: drawReady ? 'stroke-dashoffset 1.1s ease 0.1s' : 'none' }}
          />
          <path
            ref={pricePathRef}
            d={pricePathD}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.8}
            strokeDasharray={priceLength || 1}
            strokeDashoffset={drawReady ? 0 : priceLength || 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: drawReady ? 'stroke-dashoffset 1.1s ease 0.25s' : 'none' }}
          />
          {waterPoints.map((pt, idx) => {
            const stage = deriveScenarioStage(scenarioTimeline[idx]);
            const accent = SCENARIO_STAGE_COLORS[stage];
            return (
              <g key={`dam-${scenarioTimeline[idx].date}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={3.2}
                  fill={accent}
                  stroke="rgba(15, 23, 42, 0.9)"
                  strokeWidth={1}
                  opacity={drawReady ? 1 : 0}
                  style={{ transition: 'opacity 0.35s ease', transitionDelay: `${0.15 + idx * 0.1}s` }}
                />
                <text
                  x={pt.x}
                  y={chartHeight - marginY + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(226, 232, 240, 0.7)"
                >
                    {scenarioTimeline[idx].date.split('-')[0].slice(-2) + "'"}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', top: '8px', left: '12px', fontSize: '9px', color: 'rgba(148, 163, 184, 0.8)' }}>
          Lake elevation (ft)
        </div>
        <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '9px', color: 'rgba(245, 158, 11, 0.8)' }}>
          ERCOT price ($/MWh)
        </div>
      </div>
      )}
      {(!showTimeline || detailsExpanded) && (
        <div style={{ display: 'grid', gap: '10px', animation: showTimeline ? 'slideDown 0.3s ease' : 'none' }}>
          {metricConfigs.map(metric => {
            const { current, target } = getMetricState(metric.key, metric.fallback);
            return (
              <MetricRow
                key={metric.label}
                label={metric.label}
                value={`${formatHa(current)} ha`}
                description={metric.description}
                percent={percentOf(current, target || metric.fallback || current || 1)}
                accentColor={metric.accent}
              />
            );
          })}
          <div style={{
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: '10px',
            padding: '12px',
            fontSize: '10px',
            color: 'rgba(226, 232, 240, 0.68)',
            lineHeight: '1.5'
          }}>
            When elevation falls below 520 ft the hydropower corridor becomes unstable. Link water release policy to ERCOT reserve margin or provision on-site backup to cover the 30 MW gap before scarcity pricing hits.
          </div>
        </div>
      )}
      {showTimeline && (
        <button
          type="button"
          onClick={() => setDetailsExpanded(prev => !prev)}
          style={{
            width: '100%',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.35)',
            color: '#e2e8f0',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '10px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>Operational detail</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>{detailsExpanded ? 'Hide' : 'Show'}</span>
        </button>
      )}
    </div>
  );
};

const CombinedSummaryPanel = ({ stats, isAnimating = false }) => {
  const [showTimelineDetails, setShowTimelineDetails] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showTimelineControls, setShowTimelineControls] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [graphType, setGraphType] = useState('bar'); // 'bar', 'timeline', or 'scatter'
  const [isGraphSwitching, setIsGraphSwitching] = useState(false);
  const [pulsingBars, setPulsingBars] = useState([]);
  const timeline = [
    {
      date: '2025-10',
      lakeElevationFt: 533,
      storageAf: 324000,
      hydroMw: 30,
      dcLoadMw: 18,
      ercotPrice: 42,
      note: 'Baseline: reservoir full, turbines steady, DC running nominal cooling.'
    },
    {
      date: '2026-03',
      lakeElevationFt: 528,
      storageAf: 280000,
      hydroMw: 28,
      dcLoadMw: 20,
      ercotPrice: 55,
      note: 'Seasonal drawdown begins. Army Corps release schedule revised for industrial allocation.'
    },
    {
      date: '2026-07',
      lakeElevationFt: 512,
      storageAf: 182000,
      hydroMw: 0,
      dcLoadMw: 24,
      ercotPrice: 480,
      note: 'Heat wave: lake down 20 ft. Turbines offline during peak cooling demand.'
    },
    {
      date: '2026-08',
      lakeElevationFt: 508,
      storageAf: 160000,
      hydroMw: 0,
      dcLoadMw: 24,
      ercotPrice: 2000,
      note: 'ERCOT spot price spikes 40 → 2,000 $/MWh. 30 MW baseload gap persists.'
    },
    {
      date: '2027-02',
      lakeElevationFt: 520,
      storageAf: 210000,
      hydroMw: 12,
      dcLoadMw: 22,
      ercotPrice: 120,
      note: 'Partial refill. Hydropower only returns at 40% capacity while cooling demand remains elevated.'
    }
  ];

  const chartWidth = 260;
  const chartHeight = 280;
  const marginX = 7;
  const marginY = 24;

  const elevations = timeline.map(entry => entry.lakeElevationFt);
  const prices = timeline.map(entry => entry.ercotPrice);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const buildPoints = (getter, minVal, maxVal) => {
    const span = Math.max(1, maxVal - minVal);
    return timeline.map((entry, idx) => {
      const x = marginX + (idx / Math.max(1, timeline.length - 1)) * (chartWidth - marginX * 2);
      const y = chartHeight - marginY - 40 - ((getter(entry) - minVal) / span) * (chartHeight - marginY * 2 - 40);
      return { x, y };
    });
  };

  const waterPoints = buildPoints(entry => entry.lakeElevationFt, minElevation, maxElevation);
  const pricePoints = buildPoints(entry => entry.ercotPrice, minPrice, maxPrice);

  const pointsToPath = (pts) => pts
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(' ');

  // Split paths at 2025/2026 boundary (index 1, since 2025-10 is index 0, 2026-03 is index 1)
  const splitIndex = 1; // 2025-10 (index 0) is solid, 2026+ (index 1+) is dashed
  
  const waterPathSolid = pointsToPath(waterPoints.slice(0, splitIndex + 1));
  const waterPathDashed = pointsToPath(waterPoints.slice(splitIndex));
  const pricePathSolid = pointsToPath(pricePoints.slice(0, splitIndex + 1));
  const pricePathDashed = pointsToPath(pricePoints.slice(splitIndex));

  const waterPathRef = useRef(null);
  const waterPathDashedRef = useRef(null);
  const pricePathRef = useRef(null);
  const pricePathDashedRef = useRef(null);
  const [waterLength, setWaterLength] = useState(0);
  const [waterDashedLength, setWaterDashedLength] = useState(0);
  const [priceLength, setPriceLength] = useState(0);
  const [priceDashedLength, setPriceDashedLength] = useState(0);
  const [drawReady, setDrawReady] = useState(false);

  // Loading animation effect - runs for 7 seconds
  useEffect(() => {
    const duration = 7000; // 7 seconds
    const startTime = Date.now();
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setLoadingProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      } else {
        setShowTimeline(true);
      }
    };
    
    requestAnimationFrame(updateProgress);
  }, []);

  useEffect(() => {
    if (waterPathRef.current) {
      setWaterLength(waterPathRef.current.getTotalLength());
    }
    if (waterPathDashedRef.current) {
      setWaterDashedLength(waterPathDashedRef.current.getTotalLength());
    }
    if (pricePathRef.current) {
      setPriceLength(pricePathRef.current.getTotalLength());
    }
    if (pricePathDashedRef.current) {
      setPriceDashedLength(pricePathDashedRef.current.getTotalLength());
    }
  }, [waterPathSolid, waterPathDashed, pricePathSolid, pricePathDashed]);

  useEffect(() => {
    if (!isAnimating) {
      setDrawReady(true);
      return;
    }
    setDrawReady(false);
    const id = requestAnimationFrame(() => setDrawReady(true));
    return () => cancelAnimationFrame(id);
  }, [isAnimating]);


  // Show timeline controls after graph animation completes
  useEffect(() => {
    if (drawReady && showTimeline) {
      const timer = setTimeout(() => {
        setShowTimelineControls(true);
      }, 2000); // Show controls 2 seconds after graph appears
      return () => clearTimeout(timer);
    }
  }, [drawReady, showTimeline]);

  // Tooltip handlers
  const handleMouseEnter = (event, data) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      data: data
    });
  };

  const handleMouseMove = (event) => {
    if (tooltip.visible) {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip(prev => ({
        ...prev,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }));
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  const stageColors = SCENARIO_STAGE_COLORS;
  const deriveStage = deriveScenarioStage;

  const scatterData = useMemo(() => {
    const data = [];
    const colors = [
      '#22c55e', '#16a34a', '#15803d', // Greens
      '#eab308', '#ca8a04', '#a16207', // Yellows
      '#f97316', '#ea580c', '#c2410c', // Oranges
      '#ef4444', '#dc2626', '#b91c1c', // Reds
      '#8b5cf6', '#7c3aed', '#6d28d9', // Purples
      '#06b6d4', '#0891b2', '#0e7490', // Cyans
      '#ec4899', '#db2777', '#be185d', // Pinks
      '#84cc16', '#65a30d', '#4d7c0f', // Lime greens
      '#f59e0b', '#d97706', '#b45309', // Ambers
      '#6b7280', '#4b5563', '#374151'  // Grays
    ];
    
    // Generate dense cluster in normal operations area (533-530ft, $40-80/MWh)
    for (let i = 0; i < 120; i++) {
      const elevation = 530 + Math.random() * 3; // 530-533ft
      const powerCost = 40 + Math.random() * 40; // $40-80/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Normal operations',
        color: color
      });
    }
    
    // Generate moderate cluster (530-525ft, $60-150/MWh)
    for (let i = 0; i < 80; i++) {
      const elevation = 525 + Math.random() * 5; // 525-530ft
      const powerCost = 60 + Math.random() * 90; // $60-150/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Minor drawdown',
        color: color
      });
    }
    
    // Generate drought cluster (525-520ft, $100-400/MWh)
    for (let i = 0; i < 60; i++) {
      const elevation = 520 + Math.random() * 5; // 520-525ft
      const powerCost = 100 + Math.random() * 300; // $100-400/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Moderate drought',
        color: color
      });
    }
    
    // Generate severe drought cluster (520-515ft, $300-800/MWh)
    for (let i = 0; i < 40; i++) {
      const elevation = 515 + Math.random() * 5; // 515-520ft
      const powerCost = 300 + Math.random() * 500; // $300-800/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Severe drought',
        color: color
      });
    }
    
    // Generate critical cluster (515-512ft, $600-2000/MWh)
    for (let i = 0; i < 30; i++) {
      const elevation = 512 + Math.random() * 3; // 512-515ft
      const powerCost = 600 + Math.random() * 1400; // $600-2000/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Critical drought',
        color: color
      });
    }
    
    // Add some scattered outliers
    for (let i = 0; i < 20; i++) {
      const elevation = 512 + Math.random() * 21; // 512-533ft
      const powerCost = 40 + Math.random() * 1960; // $40-2000/MWh
      const color = colors[Math.floor(Math.random() * colors.length)];
      data.push({
        elevation: Math.round(elevation * 10) / 10,
        powerCost: Math.round(powerCost),
        scenario: 'Outlier',
        color: color
      });
    }
    
    return data.sort(() => Math.random() - 0.5); // Shuffle the data
  }, []); // Empty dependency array means this only runs once

  const handleHeaderClick = () => {
    setGraphType(prev => {
      if (prev === 'bar') return 'timeline';
      if (prev === 'timeline') return 'scatter';
      return 'bar';
    });
  };

  // Show a 1s skeleton overlay when switching between graph types
  useEffect(() => {
    if (!showTimeline) return;
    setIsGraphSwitching(true);
    const timer = setTimeout(() => setIsGraphSwitching(false), 1000);
    return () => clearTimeout(timer);
  }, [graphType, showTimeline]);

  // Track when each bar completes and should pulse
  useEffect(() => {
    const newPulsingBars = [];
    const barProgresses = [
      Math.min(loadingProgress * 3, 1),
      Math.min(Math.max(loadingProgress * 3 - 1, 0), 1),
      Math.min(Math.max(loadingProgress * 3 - 2, 0), 1)
    ];
    
    barProgresses.forEach((progress, index) => {
      if (progress >= 1) {
        newPulsingBars.push(index);
      }
    });
    
    setPulsingBars(newPulsingBars);
  }, [loadingProgress]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        display: 'grid',
        gap: '12px',
        background: 'transparent',
        borderRadius: '12px',
        padding: '12px',
        border: '1px solid rgba(148, 163, 184, 0.24)'
      }}>
        <div 
          style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            letterSpacing: '0.08em', 
            textTransform: 'uppercase', 
            color: '#e2e8f0',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'background-color 0.2s ease'
          }}
          onClick={handleHeaderClick}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(148, 163, 184, 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          {graphType === 'bar' 
            ? 'Lake Whitney water-power cascade (2025–2027)'
            : graphType === 'timeline' 
            ? 'Reservoir-driven risk timeline (2025–2027)' 
            : 'Lake elevation vs power cost relationship'
          }
        </div>
        
        {/* Loading animation */}
        {!showTimeline && (
        <div
          style={{
            position: 'relative',
            width: '100%',
              height: 'auto',
              minHeight: '200px',
              background: 'transparent',
            borderRadius: '10px',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px'
            }}
          >
            {/* Multiple progress bars */}
            {[
              { label: 'Tailrace water shift', value: '2,665.6 ha', color: '#3b82f6', progress: Math.min(loadingProgress * 3, 1) },
              { label: 'Hydro buffer secured', value: '4,019.4 ha', color: '#10b981', progress: Math.min(Math.max(loadingProgress * 3 - 1, 0), 1) },
              { label: 'Industrial encroachment', value: '76 ha', color: '#f59e0b', progress: Math.min(Math.max(loadingProgress * 3 - 2, 0), 1) }
            ].map((item, index) => (
              <div key={index} style={{ width: '100%' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#e2e8f0'
                  }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#e2e8f0'
                  }}>
                    {item.value}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'rgba(148, 163, 184, 0.2)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      width: `${item.progress * 100}%`,
                      height: '100%',
                      backgroundColor: item.color,
                      borderRadius: '3px',
                      transition: 'width 0.3s ease-out',
                      boxShadow: `0 0 8px ${item.color}50`,
                      animation: pulsingBars.includes(index) ? `progressBarPulse 1s ease-in-out infinite` : 'none'
                    }}
                  />
                </div>
                <div style={{
                  fontSize: '9px',
                  color: 'rgba(148, 163, 184, 0.7)',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  {index === 0 && 'Surface area variability downstream of dam spillway.'}
                  {index === 1 && 'Riparian mitigation stands above highway 22 cut.'}
                  {index === 2 && 'Utility staging yards + transmission upgrades.'}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Bar chart */}
        {showTimeline && graphType === 'bar' && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: `${chartHeight + 40}px`,
              background: 'transparent',
              borderRadius: '10px',
              padding: '8px 12px',
              marginTop: '-20px'
            }}
          >
            <svg 
              width={chartWidth} 
              height={chartHeight} 
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              {/* Water-Power Cascade data */}
              {[
                { 
                  label: 'Lake Level Drop', 
                  from: '533 ft', 
                  to: '492 ft', 
                  change: '-8%', 
                  gradient: 'linear-gradient(90deg, #06b6d4, #ef4444)',
                  y: 40,
                  barWidth: 0.5
                },
                { 
                  label: 'Hydropower Output', 
                  from: '30 MW', 
                  to: '0 MW', 
                  change: '-100%', 
                  gradient: 'linear-gradient(90deg, #d946ef, #1e40af)',
                  y: 110,
                  barWidth: 0.15
                },
                { 
                  label: 'Grid Spot Price (Peak)', 
                  from: '$40/MWh', 
                  to: '$2,000/MWh', 
                  change: '+4,900%', 
                  gradient: 'linear-gradient(90deg, #f59e0b, #dc2626)',
                  y: 180,
                  barWidth: 0.6
                },
                { 
                  label: 'Water Availability', 
                  from: '100%', 
                  to: '45%', 
                  change: '-55%', 
                  gradient: 'linear-gradient(90deg, #22c55e, #0891b2)',
                  y: 250,
                  barWidth: 0.45
                }
              ].map((item, index) => {
                const barWidth = item.barWidth * (chartWidth - marginX * 2);
                const barHeight = 20;
                const barX = marginX;
                const barY = item.y;
                
                return (
                  <g 
                    key={index}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      const group = e.currentTarget;
                      const rect = group.querySelector('rect');
                      const texts = group.querySelectorAll('text');
                      
                      // Scale the entire group - subtle effect
                      group.style.transform = 'scaleY(1.03) scaleX(1.02)';
                      group.style.transformOrigin = 'left center';
                      
                      // Enhance the bar
                      if (rect) {
                        rect.style.filter = `drop-shadow(0 0 16px ${index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e'}80)`;
                        rect.style.opacity = '0.95';
                      }
                      
                      // Highlight all text elements
                      texts.forEach((text, textIdx) => {
                        if (textIdx === 0) { // Label
                          text.style.fill = index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e';
                          text.style.fontSize = '10px';
                          text.style.fontWeight = '600';
                        } else if (textIdx >= 1 && textIdx <= 3) { // From, Arrow, To values
                          text.style.fill = index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e';
                          text.style.fontSize = textIdx === 2 ? '10px' : '9px'; // Arrow bigger
                          text.style.fontWeight = textIdx === 2 ? '600' : '500';
                        } else if (textIdx === 4) { // Change percentage
                          text.style.fontSize = '9px';
                          text.style.fontWeight = '700';
                          text.style.filter = 'drop-shadow(0 0 4px currentColor)';
                        }
                      });
                      
                      // Make other sections slightly smaller
                      const allGroups = e.currentTarget.parentNode.querySelectorAll('g');
                      allGroups.forEach((otherGroup, otherIndex) => {
                        if (otherIndex !== index) {
                          otherGroup.style.transform = 'scaleY(0.98) scaleX(0.99)';
                          otherGroup.style.opacity = '0.8';
                        }
                      });
                    }}
                    onMouseLeave={(e) => {
                      const group = e.currentTarget;
                      const rect = group.querySelector('rect');
                      const texts = group.querySelectorAll('text');
                      
                      // Reset group scaling
                      group.style.transform = 'scaleY(1) scaleX(1)';
                      
                      // Reset the bar
                      if (rect) {
                        rect.style.filter = `drop-shadow(0 0 8px ${index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e'}50)`;
                        rect.style.opacity = '1';
                      }
                      
                      // Reset all text elements
                      texts.forEach((text, textIdx) => {
                        if (textIdx === 0) { // Label
                          text.style.fill = 'rgba(148, 163, 184, 0.8)';
                          text.style.fontSize = '9px';
                          text.style.fontWeight = '500';
                        } else if (textIdx >= 1 && textIdx <= 3) { // From, Arrow, To values
                          text.style.fill = 'rgba(148, 163, 184, 0.7)';
                          text.style.fontSize = '8px';
                          text.style.fontWeight = '400';
                        } else if (textIdx === 4) { // Change percentage
                          text.style.fontSize = '8px';
                          text.style.fontWeight = '600';
                          text.style.filter = 'none';
                        }
                      });
                      
                      // Reset all other sections back to normal
                      const allGroups = e.currentTarget.parentNode.querySelectorAll('g');
                      allGroups.forEach((otherGroup) => {
                        otherGroup.style.transform = 'scaleY(1) scaleX(1)';
                        otherGroup.style.opacity = '1';
                      });
                    }}
                  >
                    {/* Bar with gradient effect */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill={index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e'}
                      rx="3"
                      ry="3"
                      style={{
                        filter: `drop-shadow(0 0 8px ${index === 0 ? '#06b6d4' : index === 1 ? '#d946ef' : index === 2 ? '#f59e0b' : '#22c55e'}50)`,
                        transformOrigin: 'left center',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    
                    {/* Label */}
                    <text
                      x={barX}
                      y={barY - 8}
                      fontSize="9px"
                      fill="rgba(148, 163, 184, 0.8)"
                      fontWeight="500"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {item.label}
                    </text>
                    
                    {/* From value */}
                    <text
                      x={barX}
                      y={barY + barHeight + 15}
                      fontSize="8px"
                      fill="rgba(148, 163, 184, 0.7)"
                      fontWeight="400"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {item.from}
                    </text>
                    
                    {/* Arrow */}
                    <text
                      x={barX + Math.max(barWidth, 20) / 2}
                      y={barY + barHeight + 15}
                      fontSize="8px"
                      fill="rgba(148, 163, 184, 0.7)"
                      textAnchor="middle"
                      fontWeight="400"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    >
                      →
                    </text>
                    
                    {/* To value */}
                    <text
                      x={barX + barWidth}
                      y={barY + barHeight + 15}
                      fontSize="8px"
                      fill="rgba(148, 163, 184, 0.7)"
                      fontWeight="400"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {item.to}
                    </text>
                    
                    {/* Change percentage */}
                    <text
                      x={barX + (barWidth > -10 ? barWidth : 20) + 8}
                      y={barY + barHeight / 2 + 3}
                      fontSize="8px"
                      fill={index === 2 ? '#f59e0b' : index === 3 ? '#06b6d4' : '#ef4444'}
                      fontWeight="600"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {item.change}
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {/* Timeline indicators for bar chart */}
            {showTimeline && (
              <div style={{
                width: '100%',
                height: '2px',
                background: 'rgba(148, 163, 184, 0.35)',
                position: 'relative',
                marginTop: '18px'
              }}>
                {timeline.map((entry, idx) => {
                  const stage = deriveStage(entry);
                  const accent = stageColors[stage];
                  const leftPercent = (idx / (timeline.length - 1)) * 100;
                  return (
                    <div
                      key={entry.date}
                      style={{
                        position: 'absolute',
                        left: `calc(${leftPercent}% - 6px)`,
                        top: '-4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: accent,
                        boxShadow: `0 0 12px ${accent}80`,
                        opacity: showTimeline ? 1 : 0,
                        transition: `opacity 0.3s ease ${idx * 0.1}s`
                      }}
                    />
                  );
                })}
              </div>
            )}
            
            {/* Skeleton overlay during graph switching */}
            {isGraphSwitching && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: 'transparent',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.35), transparent)',
                    animation: 'shimmerOverlay 0.8s ease-out'
                  }}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Timeline graph */}
        {showTimeline && graphType === 'timeline' && (
          <div
            style={{
              position: 'relative',
              width: 'calc(100% + 10px)',
              height: `${chartHeight - 20}px`,
              background: 'transparent',
              borderRadius: '10px',
              padding: '8px 12px',
              marginLeft: '-10px'
            }}
          >
              <svg 
            width="100%" 
            height={chartHeight - 20} 
            style={{ display: 'block', width: '100%', height: '100%' }}
            viewBox={`0 0 ${chartWidth} ${chartHeight - 20}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Filter definitions for glow effects */}
            <defs>
              <filter id="waterGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="priceGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Axes */}
            <line
              x1={marginX}
              y1={chartHeight - marginY - 40}
              x2={chartWidth - marginX}
              y2={chartHeight - marginY - 40}
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth={1}
            />
            <line
              x1={marginX}
              y1={marginY}
              x2={marginX}
              y2={chartHeight - marginY - 40}
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth={1}
            />
            {/* Water elevation path - solid (2025) */}
            <path
              ref={waterPathRef}
              d={waterPathSolid}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={waterLength || 1}
              strokeDashoffset={drawReady ? 0 : waterLength || 1}
              filter="url(#waterGlow)"
              style={{
                transition: drawReady ? 'stroke-dashoffset 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s' : 'none',
                animation: drawReady ? 'lineDraw 2.5s ease-out 0.2s both' : 'none'
              }}
            />
            {/* Water elevation path - dashed (2026+) */}
            <path
              ref={waterPathDashedRef}
              d={waterPathDashed}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8,4"
              strokeDashoffset={drawReady ? 0 : waterDashedLength || 1}
              filter="url(#waterGlow)"
              style={{
                transition: drawReady ? 'stroke-dashoffset 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s' : 'none',
                animation: drawReady ? 'lineDraw 2.5s ease-out 0.2s both' : 'none'
              }}
            />
            {/* ERCOT price path - solid (2025) */}
            <path
              ref={pricePathRef}
              d={pricePathSolid}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.8}
              strokeDasharray={priceLength || 1}
              strokeDashoffset={drawReady ? 0 : priceLength || 1}
              filter="url(#priceGlow)"
              style={{
                transition: drawReady ? 'stroke-dashoffset 2.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s' : 'none',
                animation: drawReady ? 'lineDraw 2.8s ease-out 0.6s both' : 'none'
              }}
            />
            {/* ERCOT price path - dashed (2026+) */}
            <path
              ref={pricePathDashedRef}
              d={pricePathDashed}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.8}
              strokeDasharray="6,3"
              strokeDashoffset={drawReady ? 0 : priceDashedLength || 1}
              filter="url(#priceGlow)"
              style={{
                transition: drawReady ? 'stroke-dashoffset 2.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s' : 'none',
                animation: drawReady ? 'lineDraw 2.8s ease-out 0.6s both' : 'none'
              }}
            />
            {waterPoints.map((pt, idx) => {
              const stage = deriveStage(timeline[idx]);
              const accent = stageColors[stage];
              const data = timeline[idx];
              return (
                <g key={`water-${timeline[idx].date}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill={accent}
                    stroke="rgba(15, 23, 42, 0.9)"
                    strokeWidth={1}
                    opacity={drawReady ? 1 : 0}
                    style={{ 
                      transition: 'opacity 0.6s ease', 
                      transitionDelay: `${0.8 + idx * 0.3}s`,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, {
                      ...data,
                      type: 'water',
                      value: data.lakeElevationFt,
                      unit: 'ft',
                      label: 'Lake Elevation'
                    })}
                  />
                  <text
                    x={pt.x}
                    y={chartHeight - marginY - 28}
                    textAnchor="middle"
                    fontSize="9"
                    fill="rgba(226, 232, 240, 0.7)"
                  >
                    {timeline[idx].date.split('-')[0].slice(-2) + "'"}
                  </text>
                </g>
              );
            })}
            
            {/* Invisible hover areas for price line */}
            {pricePoints.map((pt, idx) => {
              const data = timeline[idx];
              return (
                <circle
                  key={`price-hover-${timeline[idx].date}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={8}
                  fill="transparent"
                  style={{ 
                    cursor: 'pointer',
                    opacity: drawReady ? 1 : 0
                  }}
                  onMouseEnter={(e) => handleMouseEnter(e, {
                    ...data,
                    type: 'price',
                    value: data.ercotPrice,
                    unit: '$/MWh',
                    label: 'ERCOT Price'
                  })}
                />
              );
            })}
          </svg>
          {/* Skeleton overlay during graph switching */}
          {isGraphSwitching && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'transparent',
                zIndex: 10,
                pointerEvents: 'none'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.35), transparent)',
                  animation: 'shimmerOverlay 0.8s ease-out'
                }}
              />
            </div>
          )}
          
          {/* Tooltip */}
          {tooltip.visible && tooltip.data && (
            <div
              style={{
                position: 'absolute',
                left: `${tooltip.x + 10}px`,
                top: `${tooltip.y - 10}px`,
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '9px',
                color: '#f8fafc',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                pointerEvents: 'none',
                minWidth: '128px'
              }}
            >
              <div style={{ 
                fontWeight: 600, 
                marginBottom: '4px',
                color: tooltip.data.type === 'water' ? '#38bdf8' : '#f59e0b'
              }}>
                {tooltip.data.value.toLocaleString()} {tooltip.data.unit}
              </div>
              <div style={{ 
                fontSize: '8px',
                opacity: 0.7,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {tooltip.data.date} • {deriveStage(tooltip.data)}
              </div>
            </div>
          )}
          
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '12px',
            fontSize: '9px',
            color: 'rgba(148, 163, 184, 0.8)'
          }}>
            Lake elevation (ft)
          </div>
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            fontSize: '9px',
            color: 'rgba(245, 158, 11, 0.8)'
          }}>
            ERCOT price ($/MWh)
          </div>
          {showTimeline && (
            <div style={{
              width: '100%',
              height: '2px',
              background: 'rgba(148, 163, 184, 0.35)',
              position: 'relative',
              marginTop: '12px'
            }}>
              {timeline.map((entry, idx) => {
                const stage = deriveStage(entry);
                const accent = stageColors[stage];
                const leftPercent = (idx / (timeline.length - 1)) * 100;
                return (
                  <div
                    key={entry.date}
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPercent}% - 6px)`,
                      top: '-4px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: accent,
                      boxShadow: `0 0 12px ${accent}80`,
                      opacity: showTimeline ? 1 : 0,
                      transition: `opacity 0.3s ease ${idx * 0.1}s`
                    }}
                  />
                );
              })}
        </div>
          )}
        </div>
        )}
        
        {/* Scatter plot */}
        {showTimeline && graphType === 'scatter' && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: `${chartHeight + 40}px`,
              background: 'transparent',
              borderRadius: '10px',
              padding: '8px 12px'
            }}
          >
            <svg 
              width={chartWidth} 
              height={chartHeight} 
              style={{ display: 'block', width: '100%', height: '100%' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Axes */}
              <line
                x1={marginX}
                y1={chartHeight - marginY}
                x2={chartWidth - marginX}
                y2={chartHeight - marginY}
                stroke="rgba(148, 163, 184, 0.3)"
                strokeWidth={1}
              />
              <line
                x1={marginX}
                y1={marginY}
                x2={marginX}
                y2={chartHeight - marginY}
                stroke="rgba(148, 163, 184, 0.3)"
                strokeWidth={1}
              />
              
              {/* X-axis ticks and labels (Power Cost) */}
              {[40, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000].map((value) => {
                const x = marginX + ((value - 40) / (2000 - 40)) * (chartWidth - marginX * 2);
                return (
                  <g key={value}>
                    <line
                      x1={x}
                      y1={chartHeight - marginY}
                      x2={x}
                      y2={chartHeight - marginY + 4}
                      stroke="rgba(148, 163, 184, 0.4)"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={chartHeight - marginY + 16}
                      textAnchor="middle"
                      fontSize="8px"
                      fill="rgba(148, 163, 184, 0.7)"
                    >
                      {value === 2000 ? '2K' : value >= 1000 ? `${value/1000}K` : value}
                    </text>
                  </g>
                );
              })}
              
              {/* Y-axis ticks and labels (Lake Elevation) */}
              {[512, 515, 518, 521, 524, 527, 530, 533].map((value) => {
                const y = chartHeight - marginY - ((value - 512) / (533 - 512)) * (chartHeight - marginY * 2);
                return (
                  <g key={value}>
                    <line
                      x1={marginX - 4}
                      y1={y}
                      x2={marginX}
                      y2={y}
                      stroke="rgba(148, 163, 184, 0.4)"
                      strokeWidth={1}
                    />
                    <text
                      x={marginX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="8px"
                      fill="rgba(148, 163, 184, 0.7)"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
              
              {/* Scatter points */}
              {scatterData.map((point, idx) => {
                const x = marginX + ((point.elevation - 512) / (533 - 512)) * (chartWidth - marginX * 2);
                const y = chartHeight - marginY - ((point.powerCost - 40) / (2000 - 40)) * (chartHeight - marginY * 2);
                
                // Add loading animation with staggered delay
                const animationDelay = idx * 0.008; // 8ms delay between each circle
                
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={2}
                    fill={point.color}
                    stroke="rgba(15, 23, 42, 0.2)"
                    strokeWidth={0.3}
                    style={{ 
                      cursor: 'pointer',
                      animation: `scatterLoad 0.4s ease-out ${animationDelay}s both`
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, {
                      elevation: point.elevation,
                      powerCost: point.powerCost,
                      scenario: point.scenario,
                      type: 'scatter'
                    })}
                  />
                );
              })}
            </svg>

            {/* Skeleton overlay during graph switching */}
            {isGraphSwitching && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: 'transparent',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.35), transparent)',
                    animation: 'shimmerOverlay 0.8s ease-out'
                  }}
                />
              </div>
            )}
            
            {/* Tooltip for scatter plot */}
            {tooltip.visible && tooltip.data && tooltip.data.type === 'scatter' && (
              <div
                style={{
                  position: 'absolute',
                  left: `${tooltip.x + 10}px`,
                  top: `${tooltip.y - 10}px`,
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '9px',
                  color: '#f8fafc',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  minWidth: '128px'
                }}
              >
                <div style={{ 
                  fontWeight: 600, 
                  marginBottom: '4px',
                  color: '#f59e0b'
                }}>
                  ${tooltip.data.powerCost.toLocaleString()}/MWh
                </div>
                <div style={{ 
                  fontSize: '8px',
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {tooltip.data.elevation}ft • {tooltip.data.scenario}
                </div>
              </div>
            )}
            
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '12px',
              fontSize: '9px',
              color: 'rgba(148, 163, 184, 0.8)'
            }}>
              Lake elevation (ft)
            </div>
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              fontSize: '9px',
              color: 'rgba(245, 158, 11, 0.8)'
            }}>
              Power cost ($/MWh)
            </div>
            
            {/* Timeline indicators for scatter plot */}
        <div style={{
          width: '100%',
          height: '2px',
          background: 'rgba(148, 163, 184, 0.35)',
          position: 'relative',
              marginTop: '18px'
        }}>
          {timeline.map((entry, idx) => {
            const stage = deriveStage(entry);
            const accent = stageColors[stage];
            const leftPercent = (idx / (timeline.length - 1)) * 100;
            return (
              <div
                key={entry.date}
                style={{
                  position: 'absolute',
                  left: `calc(${leftPercent}% - 6px)`,
                  top: '-4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: accent,
                      boxShadow: `0 0 12px ${accent}80`,
                      opacity: showTimeline ? 1 : 0,
                      transition: `opacity 0.3s ease ${idx * 0.1}s`
                }}
              />
            );
          })}
        </div>
          </div>
        )}
        
        {/* Toggle button for timeline details */}
        {showTimeline && (
          <button
            type="button"
            onClick={() => setShowTimelineDetails(prev => !prev)}
            style={{
              width: '100%',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.35)',
              color: '#e2e8f0',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '10px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px'
            }}
          >
            <span>Timeline Details</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              {showTimelineDetails ? 'Hide' : 'Show'}
            </span>
          </button>
        )}
        
        {/* Collapsible timeline details section */}
        {showTimelineDetails && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px',
            animation: 'slideDown 0.3s ease'
          }}>
          {/* Scenario highlights component */}
          <div style={{
            fontSize: '10px',
            color: 'rgba(226, 232, 240, 0.68)',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: '10px',
            padding: '12px',
            lineHeight: '1.5',
            background: 'rgba(15, 23, 42, 0.35)'
          }}>
            Scenario highlights the dependency chain: Lake Whitney volume → hydropower availability → ERCOT price exposure. Use the CTA stack to replay individual AOIs and align lake operations with data center cooling, procurement, and reserve margin planning.
          </div>
          
          {timeline.map((entry, idx) => {
            const stage = deriveStage(entry);
            const accent = stageColors[stage];
            return (
              <div
                key={entry.date}
                style={{
                  borderRadius: '10px',
                  border: `1px solid ${accent}40`,
                  background: `${accent}15`,
                  padding: '12px',
                  display: 'grid',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                    {entry.date}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: accent, letterSpacing: '0.05em' }}>
                    {stage.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', fontSize: '10px', color: '#e2e8f0' }}>
                  <div>
                    <div style={{ opacity: 0.6 }}>Lake elev.</div>
                    <div style={{ fontWeight: 600 }}>{entry.lakeElevationFt} ft</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.6 }}>Storage</div>
                    <div style={{ fontWeight: 600 }}>{entry.storageAf.toLocaleString()} AF</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.6 }}>Hydro output</div>
                    <div style={{ fontWeight: 600 }}>{entry.hydroMw} MW</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.6 }}>ERCOT price</div>
                    <div style={{ fontWeight: 600 }}>${entry.ercotPrice.toLocaleString()}/MWh</div>
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(226, 232, 240, 0.72)' }}>
                  {entry.note}
                </div>
                {idx < timeline.length - 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '9px',
                    color: 'rgba(226, 232, 240, 0.55)',
                    borderTop: '1px solid rgba(148, 163, 184, 0.16)',
                    paddingTop: '6px'
                  }}>
                    <span>Preparation window:</span>
                    <span>
                      {timeline[idx + 1].date}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};

// Generate realistic agricultural data based on metric type
const generateAgriculturalData = (metricKey) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Special pattern for agriculture_loss with declining trend
  if (metricKey === 'agriculture_loss') {
    // Historical decline in thousand acres irrigated (2017-2025)
    // Steady decline, accelerating post-2021 (CAP water cuts)
    
    // Map years to months for display (using 12 data points for smooth curve)
    const yearLabels = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
    const yearValues = [256, 252, 242, 235, 228, 218, 203, 192, 182, 175, 168, 162]; // Extended decline
    
    return yearLabels.map((year, index) => {
      const value = yearValues[index];
      
      return {
        month: year, // Use year as "month" for display
        value: Math.round(value * 10) / 10,
        hectares: Math.round(value * 10) / 10
      };
    });
  }
  
  // Special pattern for agriculture_gain with tribal/tech expansion
  if (metricKey === 'agriculture_gain') {
    // Tribal/tech crops (guayule) expansion with steady modest growth
    // Net negative vs agriculture_loss (182k loss vs 29k gain)
    const yearLabels = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
    const yearValues = [12, 13, 15, 17, 18, 20, 23, 25, 29, 32, 36, 40]; // Steady growth curve
    
    return yearLabels.map((year, index) => {
      const value = yearValues[index];
      
      return {
        month: year, // Use year as "month" for display
        value: Math.round(value * 10) / 10,
        hectares: Math.round(value * 10) / 10
      };
    });
  }
  
  // Special pattern for industrial_expansion with exponential growth
  if (metricKey === 'industrial_expansion') {
    // Industrial expansion with hockey stick growth post-2019
    // Major developments: megasite expansions in 2019 and 2023, continued buildout
    const yearLabels = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
    const yearValues = [0.8, 1.2, 2.1, 2.8, 3.9, 5.2, 8.4, 10.8, 14.7, 18.9, 24.1, 30.5]; // Exponential growth
    
    return yearLabels.map((year, index) => {
      const value = yearValues[index];
      
      return {
        month: year, // Use year as "month" for display
        value: Math.round(value * 10) / 10,
        hectares: Math.round(value * 10) / 10
      };
    });
  }
  
  // Special pattern for water_change with reallocation trend
  if (metricKey === 'water_change') {
    // Water reallocation from agriculture to industrial use
    // Exponential curve matching industrial expansion
    const yearLabels = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
    const yearValues = [2, 4, 8, 12, 22, 28, 41, 52, 68, 85, 105, 128]; // Exponential water reallocation
    
    return yearLabels.map((year, index) => {
      const value = yearValues[index];
      
      return {
        month: year, // Use year as "month" for display
        value: Math.round(value * 10) / 10,
        hectares: Math.round(value * 10) / 10
      };
    });
  }
  
  // Fallback for any other metrics not specifically handled
  return months.map((month, index) => {
    return {
      month,
      value: 0,
      hectares: 0
    };
  });
};

const GeoAIChangeSummaryCard = ({
  metadata = {},
  fallbackStats = null,
  isDimmed = false
}) => {
  const [isAnimationActive, setIsAnimationActive] = useState(false);
  const [hasAnimationRun, setHasAnimationRun] = useState(false);
  const [animatedValues, setAnimatedValues] = useState({});
  const [animationProgress, setAnimationProgress] = useState(0);
  const [expandedMetrics, setExpandedMetrics] = useState({});
  const [showMetricsBreakdown, setShowMetricsBreakdown] = useState(() => (metadata?.sites?.length || 0) > 1);
  const [overlayMode, setOverlayMode] = useState(null); // Track which chart is in overlay mode
  const [showSkeleton, setShowSkeleton] = useState(true); // New state for skeleton animation
  const responseType = metadata?.responseType;
  const isShorelineSummary = responseType === 'geoai_shoreline_summary';

  // GSAP refs
  const cardRef = useRef(null);
  const metricsRef = useRef(null);
  const progressBarRef = useRef(null);
  const stats = useMemo(() => metadata.stats || fallbackStats || {}, [metadata.stats, fallbackStats]);
  const totals = useMemo(() => (isShorelineSummary ? {} : (stats?.totals || {})), [isShorelineSummary, stats]);

  const primarySiteId = metadata?.sites?.[0]?.id;
  const siteCount = metadata?.sites?.length || 0;
  const getAnimationController = useCallback(() => {
    if (primarySiteId === 'lake_whitney_shoreline') {
      return window.lakeWhitneyShoreAnimationRef;
    }
    if (primarySiteId === 'whitney_dfw7') {
      return window.whitneyAnimationRef;
    }
    if (primarySiteId === 'lakeside_village') {
      return window.lakesideVillageAnimationRef;
    }
    if (primarySiteId === 'lake_whitney_dam') {
      return window.lakeWhitneyDamAnimationRef;
    }
    return window.lucidAnimationRef;
  }, [primarySiteId]);

  const animationController = getAnimationController();
  const hasAnimationController = Boolean(animationController);

  const metricEntries = useMemo(() => {
    if (isShorelineSummary) {
      const shoreline = stats?.shoreline || stats || {};
      const lengthMiles = shoreline.length_miles || 0;
      const lengthFt = shoreline.length_ft || lengthMiles * 5280;
      const areaAcres = shoreline.buffer_area_acres || 0;
      const areaSqft = shoreline.buffer_area_sqft || areaAcres * 43560;
      const bufferWidth = shoreline.buffer_width_ft || 150;
      const polygonCount = shoreline.polygon_count || 0;
return [
        {
          key: 'shoreline_length',
          label: 'Shoreline length',
          color: '#14b8a6',
          displayValue: lengthMiles ? `${lengthMiles.toFixed(2)} miles (${Math.round(lengthFt).toLocaleString()} ft)` : 'N/A',
          isAnimating: false,
          isExpanded: expandedMetrics['shoreline_length'] || false,
          agriculturalData: []
        },
        {
          key: 'buffer_area',
          label: 'Buffer area',
          color: '#2563eb',
          displayValue: areaAcres ? `${areaAcres.toFixed(1)} acres (${Math.round(areaSqft).toLocaleString()} sq ft)` : 'N/A',
          isAnimating: false,
          isExpanded: expandedMetrics['buffer_area'] || false,
          agriculturalData: []
        },
        {
          key: 'buffer_width',
          label: 'Buffer width',
          color: '#0ea5e9',
          displayValue: `${bufferWidth.toLocaleString()} ft`,
          isAnimating: false,
          isExpanded: expandedMetrics['buffer_width'] || false,
          agriculturalData: []
        },
        {
          key: 'shore_segments',
          label: 'Shoreline segments',
          color: '#9333ea',
          displayValue: polygonCount ? `${polygonCount} polygons` : 'N/A',
          isAnimating: false,
          isExpanded: expandedMetrics['shore_segments'] || false,
          agriculturalData: []
        }
      ];
    }

    return Object.entries(METRIC_CONFIG)
      .map(([key, config]) => {
        const targetValue = totals[key] || 0;
        const currentValue = isAnimationActive ? (animatedValues[key] || targetValue) : targetValue;
        const agriculturalData = generateAgriculturalData(key);
  return {
          key,
          label: config.label,
          color: config.color,
          displayValue: key === 'water_change' ? '68,000 AF/yr' : `${formatHa(currentValue)} ha`,
          isAnimating: isAnimationActive && animatedValues[key] !== undefined,
          isExpanded: expandedMetrics[key] || false,
          agriculturalData
        };
      });
  }, [isShorelineSummary, stats, totals, animatedValues, isAnimationActive, expandedMetrics]);

  const customSitePanel = useMemo(() => {
    if (showSkeleton) return null;
    if (siteCount > 1) {
      return <CombinedSummaryPanel stats={stats} isAnimating />;
    }
    switch (primarySiteId) {
      case 'whitney_dfw7':
        return (
          <WhitneySummaryPanel
            totals={totals}
            animatedValues={animatedValues}
            isAnimating={isAnimationActive}
          />
        );
      case 'lakeside_village':
        return (
          <LakesideSummaryPanel
            totals={totals}
            animatedValues={animatedValues}
            isAnimating={isAnimationActive}
          />
        );
      case 'lake_whitney_dam':
        return (
          <DamSummaryPanel
            totals={totals}
            animatedValues={animatedValues}
            isAnimating={isAnimationActive}
            hasAnimationRun={hasAnimationRun}
          />
        );
      default:
        return null;
    }
  }, [primarySiteId, siteCount, stats, totals, showSkeleton, animatedValues, isAnimationActive, hasAnimationRun]);

  const headerLabel = useMemo(() => {
    if (isShorelineSummary) {
      return 'SHORELINE change summary';
    }
    switch (primarySiteId) {
      case 'whitney_dfw7':
        return 'WHITNEY build summary';
      case 'lakeside_village':
        return 'LAKESIDE shoreline summary';
      case 'lake_whitney_dam':
        return 'DAM operations summary';
      case undefined:
      case null:
        return 'LOCATION change summary';
      default:
        if (siteCount > 1) {
          return 'COMBINED site summary';
        }
        const siteName = metadata?.sites?.[0]?.name || 'Location';
        return `${siteName} summary`;
    }
  }, [isShorelineSummary, primarySiteId, metadata?.sites, siteCount]);

  useEffect(() => {
    if ((metadata?.sites?.length || 0) > 1) {
      setShowMetricsBreakdown(true);
    }
  }, [metadata?.sites]);

  // Toggle metric expansion - close others when opening one
  const toggleMetricExpansion = (metricKey) => {
    setExpandedMetrics(prev => {
      const isCurrentlyExpanded = prev[metricKey];
      
      if (isCurrentlyExpanded) {
        // If currently expanded, close it
        return {
          ...prev,
          [metricKey]: false
        };
      } else {
        // If not expanded, close all others and open this one
        return {
          [metricKey]: true
        };
      }
    });
  };

  // Toggle overlay mode - show all lines on one chart
  const toggleOverlayMode = (metricKey) => {
    if (overlayMode === metricKey) {
      // If already in overlay mode for this metric, close it
      setOverlayMode(null);
    } else {
      // Enter overlay mode for this metric
      setOverlayMode(metricKey);
    }
  };


  // Initialize animated values when totals change
  useEffect(() => {
    if (isShorelineSummary) {
      setAnimatedValues({});
      return;
    }
    const initialValues = {};
    Object.entries(METRIC_CONFIG).forEach(([key]) => {
      const value = totals[key];
      if (typeof value === 'number' && value > 0) {
        initialValues[key] = 0; // Start from 0 for animation
      }
    });
    setAnimatedValues(initialValues);
  }, [totals, isShorelineSummary]);

  // Hide skeleton after 1.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(false);
      if (isShorelineSummary) {
        setShowMetricsBreakdown(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [showSkeleton, metadata, fallbackStats, isShorelineSummary]);

  useEffect(() => {
    if (!hasAnimationController && hasAnimationRun) {
      setHasAnimationRun(false);
      setIsAnimationActive(false);
    }
  }, [hasAnimationController, hasAnimationRun]);

  // GSAP counter animation with progress tracking
  useEffect(() => {
    if (!isAnimationActive) {
      return;
    }

    setAnimationProgress(0);

    // Create GSAP timeline for counter animations
    const tl = gsap.timeline();
    
    Object.entries(METRIC_CONFIG).forEach(([key, config], index) => {
      const targetValue = totals[key] || 0; // Use 0 as fallback if no data
      
      // Animate all metrics with proper stagger timing
      tl.to({}, {
        duration: 4,
        ease: "power2.out",
        onUpdate: function() {
          const progress = this.progress();
          const currentValue = targetValue * progress;
          setAnimatedValues(prev => ({
            ...prev,
            [key]: currentValue
          }));
          // Update overall animation progress for charts
          setAnimationProgress(progress);
        }
      }, index * 0.1); // Small stagger delay (0.1s between each metric)
    });

    return () => {
      tl.kill();
    };
  }, [isAnimationActive, totals]);

  // GSAP progress bar animation
  useEffect(() => {
    if (!isAnimationActive || !progressBarRef.current) return;

    const progressTl = gsap.timeline();
    
    progressTl.to(progressBarRef.current, {
      width: "100%",
      duration: 4,
      ease: "power2.inOut",
      onComplete: () => {
        setIsAnimationActive(false);
      }
    });

    return () => {
      progressTl.kill();
    };
  }, [isAnimationActive]);

  // Staggered metrics reveal animation
  useEffect(() => {
    if (!showMetricsBreakdown || !metricsRef.current) return;

    const metricsTl = gsap.timeline();
    
    // Animate card entrance
    metricsTl.fromTo(cardRef.current, 
      { scale: 0.95, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
    );

    // Stagger metric rows
    const metricRows = metricsRef.current?.querySelectorAll('.metric-row');
    if (metricRows) {
      metricsTl.fromTo(metricRows,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out" },
        "-=0.3"
      );
    }

    return () => {
      metricsTl.kill();
    };
  }, [showMetricsBreakdown]);

  // Handle header click to trigger animation and show metrics
  const startAnimation = useCallback(() => {
    if (primarySiteId === 'lake_whitney_shoreline') {
      console.log('🌊 Shoreline animation: start');
    }
    if (primarySiteId === 'lakeside_village') {
      console.log('🏡 Lakeside animation: start request', {
        hasAnimationController,
        hasAnimationRun,
        isAnimationActive
      });
    }
    if (!animationController) return;
    if (animationController.handleRestart) {
      animationController.handleRestart();
    } else if (animationController.handlePlayPause) {
      animationController.handlePlayPause();
    }
    setIsAnimationActive(true);
    setHasAnimationRun(true);
  }, [animationController, hasAnimationController, hasAnimationRun, isAnimationActive, primarySiteId]);

  const cleanupAnimation = useCallback(() => {
    if (!animationController) return;
    if (primarySiteId === 'lake_whitney_shoreline') {
      console.log('🌊 Shoreline animation: cleanup request');
    }
    if (primarySiteId === 'lakeside_village') {
      console.log('🏡 Lakeside animation: cleanup request');
    }
    if (animationController.handleCleanup) {
      animationController.handleCleanup();
    } else if (animationController.handlePlayPause) {
      animationController.handlePlayPause();
    }
    setIsAnimationActive(false);
    setHasAnimationRun(false);
  }, [animationController]);

  const handleHeaderClick = () => {
    if (isShorelineSummary && !hasAnimationController) {
      console.warn('🌊 Shoreline animation controller not ready');
    }
    if (primarySiteId === 'lakeside_village') {
      console.log('🏡 Lakeside header click', {
        hasAnimationController,
        hasAnimationRun,
        isAnimationActive,
        showMetricsBreakdown
      });
    }
    if (!showMetricsBreakdown) {
      setShowMetricsBreakdown(true);
      if (hasAnimationController && !hasAnimationRun) {
        startAnimation();
      }
      return;
    }

    if (!hasAnimationController) {
      return;
    }

    if (isAnimationActive || hasAnimationRun) {
      cleanupAnimation();
    } else {
      startAnimation();
    }
  };

  // Cleanup GSAP timelines on unmount
  useEffect(() => {
    const cardElement = cardRef.current;
    const metricsElement = metricsRef.current;
    const progressElement = progressBarRef.current;
    
    return () => {
      // Kill all GSAP timelines to prevent memory leaks
      gsap.killTweensOf(cardElement);
      gsap.killTweensOf(metricsElement);
      gsap.killTweensOf(progressElement);
    };
  }, []);

  // Header is clickable if metrics aren't shown yet OR animation can be controlled
  const isHeaderClickable = !showMetricsBreakdown || hasAnimationController;
  const headerIcon = (isAnimationActive || hasAnimationRun) ? '✕' : '▶';

  return (
    <div style={{ opacity: isDimmed ? 0.25 : 1, transition: 'opacity 0.2s ease', pointerEvents: isDimmed ? 'none' : 'auto' }}>
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
              max-height: 0;
            }
            to {
              opacity: 1;
              transform: translateY(0);
              max-height: 400px;
            }
          }
          
          @keyframes shimmerOverlay {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(400%);
            }
          }
          
          @keyframes progressBarPulse {
            0%, 100% {
              opacity: 1;
              transform: scaleY(1);
              box-shadow: 0 0 8px currentColor;
            }
            50% {
              opacity: 0.8;
              transform: scaleY(1.1);
              box-shadow: 0 0 16px currentColor;
            }
          }
          
          @keyframes barGrow {
            0% {
              transform: scaleX(0);
              opacity: 0;
            }
            100% {
              transform: scaleX(1);
              opacity: 1;
            }
          }
          
          @keyframes lineDraw {
            0% {
              stroke-dashoffset: 100%;
              opacity: 0.3;
            }
            50% {
              opacity: 0.8;
            }
            100% {
              stroke-dashoffset: 0%;
              opacity: 1;
            }
          }
          
          @keyframes skeletonPulse {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
          }
          
          @keyframes skeletonShimmer {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
          
          @keyframes scatterLoad {
            0% {
              opacity: 0;
              transform: scale(0.8);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <div
        ref={cardRef}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'transparent',
          backdropFilter: 'none',
          border: isAnimationActive ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(148, 163, 184, 0.25)',
          color: '#e2e8f0',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          boxShadow: isAnimationActive ? '0 8px 32px rgba(0, 0, 0, 0.1)' : 'none'
        }}
      >
      <div style={{ marginBottom: '10px' }}>
        {showSkeleton ? (
          /* Skeleton Header */
          <div style={{
            height: '16px',
            background: 'rgba(236, 72, 153, 0.3)',
            borderRadius: '4px',
            marginBottom: '16px',
            width: '70%',
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'skeletonShimmer 2s infinite'
            }} />
          </div>
        ) : (
          <div 
            onClick={handleHeaderClick}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px', 
              fontWeight: 600, 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              cursor: isHeaderClickable ? 'pointer' : 'default',
              color: isAnimationActive ? '#ec4899' : isHeaderClickable ? '#e2e8f0' : '#9ca3af',
              transition: 'color 0.3s ease',
              padding: '4px 0',
              borderRadius: '4px',
              position: 'relative',
              opacity: isHeaderClickable ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (isHeaderClickable) {
                e.currentTarget.style.color = isAnimationActive ? '#f472b6' : '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (isHeaderClickable) {
                e.currentTarget.style.color = isAnimationActive ? '#ec4899' : '#e2e8f0';
              }
            }}
            title={!showMetricsBreakdown
              ? 'Click to show detailed metrics'
              : (isAnimationActive || hasAnimationRun)
                ? 'Click to stop and clear animation'
                : hasAnimationController
                  ? 'Click to play animation'
                  : 'Animation unavailable'}
          >
            <span style={{ fontSize: '13px', transition: 'transform 0.2s ease' }}>
              {headerIcon}
            </span>
            <span>{headerLabel}</span>
          </div>
        )}
        
        {/* Progress Bar */}
        {isAnimationActive && (
          <div style={{
            width: '100%',
            height: '3px',
            backgroundColor: 'rgba(236, 72, 153, 0.2)',
            borderRadius: '2px',
            marginTop: '6px',
            overflow: 'hidden'
          }}>
            <div 
              ref={progressBarRef}
              style={{
                width: '0%',
                height: '100%',
                backgroundColor: '#ec4899',
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(236, 72, 153, 0.5)'
              }} 
            />
          </div>
        )}
        
      </div>
{/* Show explanatory text initially, hide when metrics are shown */}
      {!showMetricsBreakdown && (
        showSkeleton ? (
          /* Skeleton Text Lines */
          <div style={{
            padding: '8px 0',
            marginBottom: '8px',
            marginTop: '-20px'
          }}>
            {[1, 2, 3, 4].map((line) => (
              <div
                key={line}
                style={{
                  height: '12px',
                  background: 'rgba(51, 65, 85, 0.6)',
                  borderRadius: '4px',
                  marginBottom: line === 4 ? '0' : '8px',
                  width: line === 1 ? '95%' : line === 2 ? '88%' : line === 3 ? '75%' : '65%',
                  animation: 'skeletonPulse 1.5s ease-in-out infinite',
                  animationDelay: `${line * 0.2}s`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'skeletonShimmer 2s infinite',
                  animationDelay: `${line * 0.3}s`
                }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '8px 0',
            fontSize: '11px',
            color: '#9ca3af',
            lineHeight: '1.4',
            fontStyle: 'italic',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            marginBottom: '8px',
            marginTop: '-20px'
          }}>
            {isShorelineSummary
              ? 'Click the header above to animate the Lake Whitney shoreline buffer and view 150 ft band metrics. The animation pulses the shoreline ring to highlight survey coverage for erosion, recreation, and flood readiness.'
              : 'Click the header above to start the agricultural change animation and see detailed metrics for this site. The animation will show how land use has changed over time with real-time data visualization and animated counters for agriculture loss, agriculture gain, industrial expansion, and water changes.'}
          </div>
        )
      )}
{/* Show metric details - only after header click */}
      {showMetricsBreakdown && (
        <div
          ref={metricsRef}
          style={{
            animation: 'slideDown 0.5s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {customSitePanel ? (
            customSitePanel
          ) : !showSkeleton ? (
            metricEntries.map(entry => (
              <div key={entry.key}>
                <div
                  className="metric-row"
                  onClick={() => toggleMetricExpansion(entry.key)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    padding: '6px 0',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    margin: '2px 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = `${entry.color}10`;
                    e.target.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      color: entry.color, 
                      fontSize: '12px', 
                      fontWeight: 600,
                      transition: 'color 0.3s ease',
                      marginRight: '8px'
                    }}>
                      {entry.label}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: entry.color,
                      transition: 'transform 0.3s ease',
                      transform: entry.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                  </div>
                  <span 
                    style={{ 
                      fontSize: '13px', 
                      fontWeight: 600,
                      color: entry.isAnimating ? entry.color : '#e2e8f0',
                      transition: 'color 0.3s ease',
                      textShadow: entry.isAnimating ? `0 0 8px ${entry.color}40` : 'none',
                      animation: entry.isAnimating ? 'pulse 0.5s ease-in-out infinite' : 'none'
                    }}
                  >
                    {entry.displayValue}
                    {entry.isAnimating && (
                      <span style={{
                        marginLeft: '4px',
                        fontSize: '10px',
                        color: entry.color,
                        animation: 'blink 1s ease-in-out infinite'
                      }}>
                        ↗
                      </span>
                    )}
                  </span>
                </div>
                
                {/* Expanded chart section */}
                {entry.isExpanded && (
                  <div style={{
                    overflow: 'visible',
                    minHeight: '250px',
                    padding: '-3px',
                    marginTop: '3px'
                  }}>
                    <AgriculturalTrendChart 
                      data={entry.agriculturalData} 
                      color={entry.color} 
                      metricKey={entry.key}
                      metricLabel={entry.label}
                      animationProgress={isAnimationActive ? animationProgress : 1}
                      overlayMode={overlayMode === entry.key}
                      allMetricsData={overlayMode === entry.key ? metricEntries.map(e => ({
                        key: e.key,
                        label: e.label,
                        color: e.color,
                        data: e.agriculturalData
                      })) : null}
                      onHeaderClick={() => toggleOverlayMode(entry.key)}
                    />
                  </div>
                )}
              </div>
            ))
          ) : null}
        </div>
      )}
{/* Shimmer overlay during animation - same effect as LoadingCard */}
      {isAnimationActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)',
          animation: 'shimmerOverlay 3s infinite',
          pointerEvents: 'none',
          zIndex: 1
        }} />
      )}
</div>
    </>
    </div>
  );
};

export default GeoAIChangeSummaryCard;
