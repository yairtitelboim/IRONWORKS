import React, { useEffect, useRef, useMemo, useState } from 'react';
import { gsap } from 'gsap';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, Line, LineChart } from 'recharts';

// Register GSAP plugins
gsap.registerPlugin();

// Function to get descriptive titles for each metric
const getDescriptiveTitle = (metricKey) => {
  const titles = {
    'agriculture_loss': 'FARMLAND LOST TO DROUGHT',
    'agriculture_gain': 'TRIBAL CROPS EXPANSION',
    'industrial_expansion': 'FACTORY CONSTRUCTION BOOM',
    'water_change': 'WATER RIGHTS REALLOCATION'
  };
  return titles[metricKey] || metricKey.toUpperCase();
};

const AgriculturalTrendChart = ({ data, color, metricKey, metricLabel, animationProgress = 1, overlayMode = false, allMetricsData = null, onHeaderClick }) => {
  const chartRef = useRef(null);
  const areaRef = useRef(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showOverlaySkeleton, setShowOverlaySkeleton] = useState(false);
  
  // Create animated data based on progress - builds left to right
  const animatedData = useMemo(() => {
    console.log('📊 Generating animated data:', { 
      dataLength: data?.length, 
      animationProgress: animationProgress.toFixed(3),
      metricKey,
      overlayMode
    });
    
    if (overlayMode && allMetricsData) {
      // Create combined data for overlay mode
      const combinedData = [];
      const maxLength = Math.max(...allMetricsData.map(metric => metric.data.length));
      
      for (let i = 0; i < maxLength; i++) {
        const dataPoint = { month: data[i]?.month || `Point ${i + 1}` };
        
        allMetricsData.forEach(metric => {
          const point = metric.data[i];
          if (point) {
            const dataProgress = (i + 1) / maxLength;
            const shouldShow = dataProgress <= animationProgress;
            
            let displayValue = 0;
            if (shouldShow) {
              if (dataProgress <= animationProgress && (i === maxLength - 1 || (i + 1) / maxLength > animationProgress)) {
                const partialProgress = (animationProgress - (i / maxLength)) / (1 / maxLength);
                displayValue = point.hectares * Math.min(partialProgress, 1);
              } else {
                displayValue = point.hectares;
              }
            }
            
            dataPoint[`${metric.key}_value`] = displayValue;
          }
        });
        
        combinedData.push(dataPoint);
      }
      
      return combinedData;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No data provided for chart');
      return [];
    }
    
    const result = data.map((point, index) => {
      const dataProgress = (index + 1) / data.length;
      const shouldShow = dataProgress <= animationProgress;
      
      // Add smooth transition for the last visible point
      const isLastVisible = dataProgress <= animationProgress && 
                           (index === data.length - 1 || (index + 1) / data.length > animationProgress);
      
      let displayValue = 0;
      if (shouldShow) {
        if (isLastVisible && animationProgress < 1) {
          // Smooth transition for the last point
          const partialProgress = (animationProgress - (index / data.length)) / (1 / data.length);
          displayValue = point.hectares * Math.min(partialProgress, 1);
        } else {
          displayValue = point.hectares;
        }
      }
      
      const resultPoint = {
        ...point,
        hectares: displayValue,
        value: displayValue
      };
      
      if (index < 3) { // Log first few points for debugging
        console.log(`📈 Point ${index} (${point.month}):`, { 
          original: point.hectares, 
          display: displayValue, 
          shouldShow, 
          dataProgress: dataProgress.toFixed(3) 
        });
      }
      
      return resultPoint;
    });
    
    console.log('✅ Animated data generated:', { 
      visiblePoints: result.filter(p => p.hectares > 0).length,
      totalPoints: result.length 
    });
    
    return result;
  }, [data, animationProgress, metricKey, overlayMode, allMetricsData]);

  // Skeleton loading effect
  useEffect(() => {
    console.log('⏳ Starting skeleton loading for 0.75 seconds');
    const skeletonTimer = setTimeout(() => {
      console.log('✅ Skeleton loading complete, showing chart');
      setShowSkeleton(false);
    }, 750);

    return () => {
      clearTimeout(skeletonTimer);
    };
  }, []);

  // Overlay skeleton effect when switching to overlay mode
  useEffect(() => {
    if (overlayMode) {
      console.log('⏳ Starting overlay skeleton for 0.5 seconds');
      setShowOverlaySkeleton(true);
      const overlaySkeletonTimer = setTimeout(() => {
        console.log('✅ Overlay skeleton complete, showing overlay chart');
        setShowOverlaySkeleton(false);
      }, 500);

      return () => {
        console.log('🧹 Cleaning up overlay skeleton timer');
        clearTimeout(overlaySkeletonTimer);
      };
    } else {
      setShowOverlaySkeleton(false);
    }
  }, [overlayMode]);

  // Chart drawing animation
  useEffect(() => {
    console.log('🎯 Chart animation effect triggered:', { 
      hasChartRef: !!chartRef.current, 
      hasAreaRef: !!areaRef.current,
      animationProgress,
      dataLength: data?.length,
      showSkeleton
    });

    if (!chartRef.current || showSkeleton) {
      console.log('❌ No chart ref or skeleton still showing, skipping animation');
      return;
    }

    const tl = gsap.timeline({ delay: 0.2 });
    
    // Animate chart container entrance
    tl.fromTo(chartRef.current, 
      { opacity: 0, scale: 0.95, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "power2.out" }
    );

    console.log('✅ Chart container animation set up');

    return () => {
      console.log('🧹 Cleaning up chart animation timeline');
      tl.kill();
    };
  }, [data, color, animationProgress, showSkeleton]);

  // Cleanup GSAP timelines on unmount
  useEffect(() => {
    const chartElement = chartRef.current;
    const areaElement = areaRef.current;
    
    return () => {
      gsap.killTweensOf(chartElement);
      gsap.killTweensOf(areaElement);
    };
  }, []);
  
  if (!data || data.length === 0) {
    return <div>No data available</div>;
  }

  // Skeleton loading component
  if (showSkeleton || showOverlaySkeleton) {
    return (
      <div style={{ 
        padding: '0',
        borderTop: `1px solid ${color}20`,
        marginTop: '0',
        marginBottom: '0'
      }}>
        {/* Skeleton Chart Header */}
        <div style={{
          padding: '6px 8px 4px 8px',
          borderBottom: `1px solid ${color}20`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            color: color,
            fontSize: '7px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.25px'
          }}>
            {showOverlaySkeleton ? 'ALL METRICS OVERLAY' : getDescriptiveTitle(metricKey)}
          </div>
          <div style={{
            color: '#94a3b8',
            fontSize: '6px',
            fontWeight: '500'
          }}>
            2017-2025
          </div>
        </div>
        
        <div style={{ padding: '10px 10px 5px 10px', minHeight: '180px' }}>
          <div style={{ width: 'calc(100% + 40px)', height: 'calc(180px + 10px)', marginLeft: '-20px', marginBottom: '-10px' }}>
            {/* Skeleton Chart */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '6px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Skeleton Chart Lines */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '15px',
                right: '15px',
                bottom: '35px',
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'space-between'
              }}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      width: '6px',
                      height: `${30 + Math.random() * 100}px`,
                      backgroundColor: `${color}30`,
                      borderRadius: '3px',
                      animation: 'skeletonPulse 1.5s ease-in-out infinite',
                      animationDelay: `${index * 0.1}s`
                    }}
                  />
                ))}
              </div>
              {/* Skeleton X-axis labels */}
              <div style={{
                position: 'absolute',
                bottom: '5px',
                left: '15px',
                right: '15px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((month, index) => (
                  <div
                    key={month}
                    style={{
                      width: '15px',
                      height: '6px',
                      backgroundColor: `${color}20`,
                      borderRadius: '2px',
                      animation: 'skeletonPulse 1.5s ease-in-out infinite',
                      animationDelay: `${index * 0.2}s`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <style>
          {`
            @keyframes skeletonPulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.7; }
            }
          `}
        </style>
      </div>
    );
  }
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: `1px solid ${color}`,
          borderRadius: '4px',
          padding: '4px 6px',
          fontSize: '6px',
          color: '#e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ color: color, fontWeight: '600', marginBottom: '2px' }}>
            {label}
          </div>
          {overlayMode && allMetricsData ? (
            payload.map((entry, index) => {
              const metric = allMetricsData.find(m => entry.dataKey === `${m.key}_value`);
              return (
                <div key={index} style={{ color: '#d1d5db', marginBottom: '1px' }}>
                  <span style={{ color: entry.color, fontWeight: '600' }}>
                    {metric?.label || entry.dataKey}:
                  </span>{' '}
                  <span style={{ color: entry.color, fontWeight: '600' }}>
                    {entry.value.toFixed(1)} ha
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#d1d5db' }}>
              {metricLabel}: <span style={{ color: color, fontWeight: '600' }}>
                {payload[0].value.toFixed(1)} ha
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ 
      padding: '0',
      borderTop: `1px solid ${color}20`,
      marginTop: '0',
      marginBottom: '0'
    }}>
      {/* Chart Header */}
      <div 
        onClick={onHeaderClick}
        style={{
          padding: '6px 8px 4px 8px',
          borderBottom: `1px solid ${color}20`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderRadius: '4px 4px 0 0'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = `${color}10`;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{
          color: color,
          fontSize: '7px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.25px'
        }}>
          {overlayMode ? 'ALL METRICS OVERLAY' : getDescriptiveTitle(metricKey)}
        </div>
        <div style={{
          color: '#94a3b8',
          fontSize: '6px',
          fontWeight: '500'
        }}>
          2017-2025
        </div>
      </div>
      
      <div ref={chartRef} style={{ padding: '20px 20px 5px 10px', minHeight: '150px' }}>
        <div style={{ width: 'calc(100% + 60px)', height: 'calc(150px + 20px)', marginLeft: '-50px', marginBottom: '-20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {overlayMode && allMetricsData ? (
              <LineChart data={animatedData} margin={{ left: -5, bottom: -16 }}>
                <XAxis 
                  dataKey="month" 
                  tick={{ 
                    fontSize: 7, 
                    fill: '#ffffff'
                  }}
                  interval={1}
                />
                <YAxis 
                  tick={{ 
                    fontSize: 10, 
                    fill: '#ffffff',
                    textAnchor: 'end'
                  }}
                  style={{ zIndex: 1000 }}
                />
                <Tooltip content={<CustomTooltip />} />
                {allMetricsData.map((metric, index) => (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={`${metric.key}_value`}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: metric.color }}
                  />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={animatedData} margin={{ left: -5, bottom: -16 }}>
                <XAxis 
                  dataKey="month" 
                  tick={{ 
                    fontSize: 7, 
                    fill: '#ffffff'
                  }}
                  interval={1}
                />
                <YAxis 
                  tick={{ 
                    fontSize: 10, 
                    fill: '#ffffff',
                    textAnchor: 'end'
                  }}
                  style={{ zIndex: 1000 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  ref={areaRef}
                  type="monotone" 
                  dataKey="hectares" 
                  stroke={color} 
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.15}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AgriculturalTrendChart;
