import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MOBILE_CONFIG } from '../../constants';

const TDC_COLOR = '#10b981';

const TexasDataCenterCard = ({ responseMetadata, children }) => {
  const [powerAnalysis, setPowerAnalysis] = useState(null);
  const [showPowerAnalysis, setShowPowerAnalysis] = useState(false);
  const [chartView, setChartView] = useState('capacity');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [gasLinesVisible, setGasLinesVisible] = useState(true);
  const menuRef = useRef(null);

  const coords = responseMetadata?.coordinates || [];
  const [lng, lat] = coords;
  const props = responseMetadata?.properties || {};
  const projectName = props.project_name ? props.project_name.replace(/\b\w/g, c => c.toUpperCase()) : 'Texas Data Center';
  const displayName = projectName;
  const sourceUrl = props.source_url;
  let dateStr = '';
  if (props.announced_date) {
    try {
      const d = new Date(props.announced_date);
      dateStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (_) {}
  }
  const title = dateStr ? `${projectName} • ${dateStr}` : projectName;

  const getChartData = () => {
    if (!powerAnalysis) return { data: [], label: '', hasData: false };
    let viewData = null;
    switch (chartView) {
      case 'capacity': viewData = powerAnalysis.capacity; break;
      case 'distanceWeighted': viewData = powerAnalysis.distanceWeightedCapacity; break;
      case 'connectionAccessibility': viewData = powerAnalysis.connectionAccessibility; break;
      case 'connectionAvailability': viewData = powerAnalysis.connectionAvailability; break;
      case 'redundancy': viewData = powerAnalysis.redundancy; break;
      case 'powerAndGas': viewData = powerAnalysis.powerAndGas; break;
      default: viewData = powerAnalysis.capacity;
    }
    const data = (viewData?.voltageDistribution || []).filter(e => e.category && !e.category.toLowerCase().includes('unknown'));
    return { data, hasData: data.length > 0 };
  };

  const getCurrentViewLabel = () => {
    const m = { capacity: 'Capacity', distanceWeighted: 'Distance', connectionAccessibility: 'Connections', connectionAvailability: 'Availability', redundancy: 'Redundancy', powerAndGas: 'Power + Gas' };
    return m[chartView] || 'Capacity';
  };

  const chartInfo = getChartData();
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= MOBILE_CONFIG.breakpoint;
  const mobileChartHeight = Math.max(70, (chartInfo.data?.length || 0) * 22 + 22);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus || coords.length < 2) return;
    const handleAnalysisReady = (data) => {
      const [dataLon, dataLat] = data.center || [];
      const tolerance = 0.001;
      if (Math.abs(lng - dataLon) < tolerance && Math.abs(lat - dataLat) < tolerance) {
        setPowerAnalysis(data.analysis);
        setShowPowerAnalysis(true);
      }
    };
    window.mapEventBus.on('power-circle:analysis-ready', handleAnalysisReady);
    return () => { window.mapEventBus?.off('power-circle:analysis-ready', handleAnalysisReady); };
  }, [lng, lat, coords.length]);

  const handlePowerCircleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const globalStore = typeof window !== 'undefined' ? window.__lastTexasDataCenterPowerCircle : null;
    const useCenter = (globalStore?.center && Array.isArray(globalStore.center) && globalStore.center.length >= 2)
      ? [Number(globalStore.center[0]), Number(globalStore.center[1])]
      : (coords.length >= 2 ? [Number(coords[0]), Number(coords[1])] : null);
    if (!useCenter || !Number.isFinite(useCenter[0]) || !Number.isFinite(useCenter[1])) return;
    setShowPowerAnalysis(true);
    if (window.mapEventBus) {
      window.mapEventBus.emit('power-circle:activate', {
        center: useCenter,
        address: globalStore?.address || displayName,
        coordinates: useCenter,
        source: 'texas_data_centers'
      });
    }
  };

  if (!responseMetadata?.properties) return null;

  return (
    <>
      {/* Header: Title + Power Line Analysis / circle button + expand/source */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: showPowerAnalysis ? 'flex-start' : 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <span style={{ width: '6px', height: '6px', background: TDC_COLOR, borderRadius: '2px', flexShrink: 0, marginTop: showPowerAnalysis ? '5px' : '0' }} />
          {showPowerAnalysis ? (
            <div ref={menuRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: TDC_COLOR, fontSize: '12px', fontWeight: 600 }}>Power Line Analysis</span>
              </div>
              {powerAnalysis && (
                <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none', marginTop: '2px' }}>
                  <span style={{ opacity: 0.6, fontSize: '8px' }}>{getCurrentViewLabel()}</span>
                  <span style={{ fontSize: '8px', opacity: 0.6 }}>{isMenuOpen ? '▲' : '▼'}</span>
                </div>
              )}
              {isMenuOpen && powerAnalysis && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                  background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '6px', padding: '2px', minWidth: '120px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                }}>
                  {[
                    { key: 'capacity', label: 'Capacity' },
                    { key: 'distanceWeighted', label: 'Distance' },
                    { key: 'connectionAccessibility', label: 'Connections' },
                    { key: 'connectionAvailability', label: 'Availability' },
                    { key: 'redundancy', label: 'Redundancy' },
                    { key: 'powerAndGas', label: 'Power + Gas' }
                  ].map(view => {
                    const isActive = chartView === view.key;
                    let analysisKey = view.key;
                    if (view.key === 'distanceWeighted') analysisKey = 'distanceWeightedCapacity';
                    const viewData = powerAnalysis[analysisKey];
                    const hasData = viewData?.voltageDistribution?.length > 0;
                    return (
                      <div
                        key={view.key}
                        onClick={() => { if (hasData) { setChartView(view.key); setIsMenuOpen(false); } }}
                        style={{
                          padding: '4px 8px', fontSize: '9px', fontWeight: isActive ? 600 : 500,
                          color: hasData ? (isActive ? '#60a5fa' : '#d1d5db') : '#6b7280',
                          cursor: hasData ? 'pointer' : 'not-allowed',
                          borderRadius: '4px',
                          background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
            <span style={{ color: TDC_COLOR, fontSize: '12px', fontWeight: 600 }}>{title}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <button
            type="button"
            data-tour="circle-button"
            onClick={handlePowerCircleClick}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6', cursor: 'pointer', padding: 0, margin: 0
            }}
            title="Analyze Power Capacity"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </button>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', borderRadius: '4px',
                background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)',
                color: '#60a5fa', textDecoration: 'none', cursor: 'pointer', fontSize: '12px'
              }}
              title={props.article_title || 'View source'}
            >
              ↗
            </a>
          )}
        </div>
      </div>

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
                <div style={{ height: isMobileViewport ? `${mobileChartHeight}px` : '110px', width: '100%', marginBottom: isMobileViewport ? '0px' : '12px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartInfo.data} layout="vertical" margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => chartView === 'powerAndGas' ? v.toFixed(0) : v >= 1000000 ? `${(v/1e6).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                      />
                      <YAxis dataKey="category" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '4px', color: '#f9fafb', padding: '4px 6px', fontSize: '8px' }}
                        formatter={(v) => chartView === 'powerAndGas' ? [`${v.toFixed(0)} score`, ''] : v >= 1000000 ? [`${(v/1e6).toFixed(1)}M MW`, ''] : v >= 1000 ? [`${(v/1000).toFixed(1)}K MW`, ''] : [`${v.toFixed(1)} MW`, '']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}
                        onClick={(data) => {
                          if (data?.category && window.mapEventBus) {
                            if (chartView === 'powerAndGas' && data.type === 'gas') {
                              setGasLinesVisible(prev => !prev);
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
                          return <Cell key={`cell-${index}`} fill={color} opacity={opacity} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: '#aaa', fontSize: '10px', marginBottom: '12px' }}>
                  No data available for {chartView} view
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {/* Project details – hide when Power Analysis is active (same as LocationSearchCard) */}
      {!showPowerAnalysis && children}
    </>
  );
};

export default TexasDataCenterCard;
