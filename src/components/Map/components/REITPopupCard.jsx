import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { COMPANY_COLORS } from './REITLayer';

const REITPopupCard = ({ property, companyColors = COMPANY_COLORS }) => {
  const companyColor = companyColors[property.company] || '#4dd4ac';
  const [powerAnalysis, setPowerAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [chartView, setChartView] = useState('capacity'); // 'capacity', 'distanceWeighted', 'connectionAccessibility', 'connectionAvailability', 'redundancy', 'powerAndGas'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [gasLinesVisible, setGasLinesVisible] = useState(true);

  const coordinates = property.coordinates || [property.longitude, property.latitude];

  // Get chart data and label based on selected view
  const getChartData = () => {
    if (!powerAnalysis) return { data: [], label: '', hasData: false };

    let viewData = null;
    let label = '';

    switch (chartView) {
      case 'capacity':
        viewData = powerAnalysis.capacity || { voltageDistribution: [] };
        label = 'Capacity (MW)';
        break;
      case 'distanceWeighted':
        viewData = powerAnalysis.distanceWeightedCapacity || { voltageDistribution: [] };
        label = 'Weighted Capacity (MW)';
        break;
      case 'connectionAccessibility':
        viewData = powerAnalysis.connectionAccessibility || { voltageDistribution: [] };
        label = 'Connection Points';
        break;
      case 'connectionAvailability':
        viewData = powerAnalysis.connectionAvailability || { voltageDistribution: [] };
        label = 'Connection Points';
        break;
      case 'redundancy':
        viewData = powerAnalysis.redundancy || { voltageDistribution: [] };
        label = 'Redundancy Score';
        break;
      case 'powerAndGas':
        viewData = powerAnalysis.powerAndGas || { voltageDistribution: [] };
        label = 'Infrastructure Mix';
        break;
      default:
        viewData = powerAnalysis.capacity || { voltageDistribution: [] };
        label = 'Capacity (MW)';
    }

    const data = (viewData.voltageDistribution || []).filter(entry =>
      entry.category && !entry.category.toLowerCase().includes('unknown')
    );

    return { data, label, hasData: data.length > 0 };
  };

  const chartInfo = getChartData();

  const getCurrentViewLabel = () => {
    const viewMap = {
      'capacity': 'Capacity',
      'distanceWeighted': 'Distance',
      'connectionAccessibility': 'Connections',
      'connectionAvailability': 'Availability',
      'redundancy': 'Redundancy',
      'powerAndGas': 'Power + Gas'
    };
    return viewMap[chartView] || 'Capacity';
  };

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
  }, [isMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus) return;
    const handleAnalysisReady = (data) => {
      const [lon, lat] = coordinates;
      const [dataLon, dataLat] = data.center || [];
      const tolerance = 0.001;
      if (Math.abs(lon - dataLon) < tolerance && Math.abs(lat - dataLat) < tolerance) {
        setPowerAnalysis(data.analysis);
        setShowAnalysis(true);
      }
    };
    window.mapEventBus.on('power-circle:analysis-ready', handleAnalysisReady);
    return () => {
      if (window.mapEventBus) window.mapEventBus.off('power-circle:analysis-ready', handleAnalysisReady);
    };
  }, [coordinates]);

  const handlePowerCircleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔌 [REITPopupCard] Power analysis button clicked', {
      property: property.company || property.address,
      coordinates,
      timestamp: new Date().toISOString()
    });
    setShowAnalysis(true);
    const eventData = {
      center: coordinates,
      address: property.address || '',
      company: property.company || '',
      coordinates: coordinates
    };
    if (window.mapEventBus) {
      window.mapEventBus.emit('power-circle:activate', eventData);
    } else {
      console.warn('🔌 [REITPopupCard] mapEventBus not available');
    }
  };

  const groups = {
    main: {
      title: 'REIT Property Details',
      fields: [
        { key: 'company', label: 'Owner', value: property.company, color: companyColor },
        { key: 'property_type', label: 'Property Type', value: property.property_type || 'N/A' },
        { key: 'market', label: 'Market', value: property.market || 'N/A' },
      ]
    }
  };

  return (
    <div
      className="reit-popup-content"
      style={{
        minWidth: '250px',
        padding: '12px',
        background: 'rgba(24, 26, 27, 0.85)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `0 0 20px ${companyColor}44, 0 8px 32px rgba(0, 0, 0, 0.4)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      {showAnalysis ? (
        <>
          <div style={{ color: companyColor, fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: companyColor, borderRadius: '2px' }} />
            <div ref={menuRef} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                <span>Power Line Analysis</span>
                {powerAnalysis && <span style={{ opacity: 0.6, fontSize: '11px' }}>- {getCurrentViewLabel()}</span>}
                <span style={{ fontSize: '10px', opacity: 0.6 }}>{isMenuOpen ? '▲' : '▼'}</span>
              </div>
              {isMenuOpen && powerAnalysis && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                  background: 'rgba(17, 24, 39, 0.98)', border: '1px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '6px', padding: '4px', minWidth: '140px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
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
                    const hasData = viewData && viewData.voltageDistribution && viewData.voltageDistribution.length > 0;
                    return (
                      <div
                        key={view.key}
                        onClick={() => { if (hasData) { setChartView(view.key); setIsMenuOpen(false); } }}
                        style={{
                          padding: '6px 10px', fontSize: '10px', fontWeight: isActive ? 600 : 500,
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
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={handlePowerCircleClick}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#3b82f6', cursor: 'pointer', padding: 0, margin: 0
                }}
                title="Analyze Power Capacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </button>
              {property.source_url && (
                <a href={property.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px', borderRadius: '4px',
                    background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)',
                    color: '#60a5fa', textDecoration: 'none', cursor: 'pointer', fontSize: '10px'
                  }}
                  title="View Official Source"
                >
                  ↗
                </a>
              )}
            </div>
          </div>
          {powerAnalysis ? (
            <>
              {chartInfo.hasData ? (
                <div style={{ height: '180px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartInfo.data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(value) => {
                          if (chartView === 'powerAndGas') return `${value.toFixed(0)}`;
                          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                          return value.toString();
                        }}
                      />
                      <YAxis dataKey="category" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '4px', color: '#f9fafb', padding: '5px 7px', fontSize: '9px' }}
                        formatter={(value) => {
                          if (chartView === 'powerAndGas') return [`${value.toFixed(0)} score`, ''];
                          if (value >= 1000000) return [`${(value / 1000000).toFixed(1)}M MW`, ''];
                          if (value >= 1000) return [`${(value / 1000).toFixed(1)}K MW`, ''];
                          return [`${value.toFixed(1)} MW`, ''];
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}
                        onClick={(data) => {
                          if (data?.category && window.mapEventBus) {
                            if (chartView === 'powerAndGas' && data.type === 'power') {
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
                          let opacity = 1.0;
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
                <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '11px' }}>
                  No data available for {chartView} view
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '11px' }}>
              Loading power line analysis...
            </div>
          )}
        </>
      ) : (
        Object.entries(groups).map(([key, group]) => {
          const hasData = group.fields.some(field => field.value && field.value !== 'N/A');
          if (!hasData) return null;
          return (
            <React.Fragment key={key}>
              <div style={{ color: key === 'main' ? companyColor : '#ffffff', fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', background: key === 'main' ? companyColor : '#6b7280', borderRadius: '2px' }} />
                {group.title}
                {key === 'main' && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={handlePowerCircleClick}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6', cursor: 'pointer', padding: 0, margin: 0
                      }}
                      title="Analyze Power Capacity"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                    </button>
                    {property.source_url && (
                      <a href={property.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', borderRadius: '4px',
                          background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)',
                          color: '#60a5fa', textDecoration: 'none', cursor: 'pointer', fontSize: '10px'
                        }}
                        title="View Official Source"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '12px' }}>
                {group.fields.map(field => {
                  if (!field.value || field.value === 'N/A') return null;
                  return (
                    <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <span style={{ color: '#aaa', fontSize: '11px' }}>{field.label}:</span>
                      <span style={{ color: field.color || '#fff', textAlign: 'right', fontSize: '11px', maxWidth: '60%' }}>{field.value}</span>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );
};

export default REITPopupCard;
