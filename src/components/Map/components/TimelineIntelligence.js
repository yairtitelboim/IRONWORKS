import React from 'react';

const TimelineIntelligence = ({ nodeData, powerGridData, siteAssessmentData, environmentalData }) => {
  // Sample timeline data - this would come from your data sources
  const timelineData = [
    { date: '2024-01', value: 75, label: 'Power Reliability' },
    { date: '2024-02', value: 78, label: 'Power Reliability' },
    { date: '2024-03', value: 82, label: 'Power Reliability' },
    { date: '2024-04', value: 80, label: 'Power Reliability' },
    { date: '2024-05', value: 85, label: 'Power Reliability' },
    { date: '2024-06', value: 88, label: 'Power Reliability' },
    { date: '2024-07', value: 90, label: 'Power Reliability' },
    { date: '2024-08', value: 87, label: 'Power Reliability' },
    { date: '2024-09', value: 92, label: 'Power Reliability' },
    { date: '2024-10', value: 89, label: 'Power Reliability' },
    { date: '2024-11', value: 91, label: 'Power Reliability' },
    { date: '2024-12', value: 94, label: 'Power Reliability' }
  ];

  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 300;
  const padding = 40;
  const innerWidth = chartWidth - (padding * 2);
  const innerHeight = chartHeight - (padding * 2);

  // Find min/max values for scaling
  const minValue = Math.min(...timelineData.map(d => d.value));
  const maxValue = Math.max(...timelineData.map(d => d.value));
  const valueRange = maxValue - minValue;

  // Convert data to SVG coordinates
  const points = timelineData.map((d, index) => {
    const x = padding + (index / (timelineData.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((d.value - minValue) / valueRange) * innerHeight;
    return { x, y, value: d.value, date: d.date };
  });

  // Create SVG path
  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  return (
    <div style={{
      background: 'transparent',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#ffffff',
        margin: '0 0 20px 0',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        Node Performance Timeline
      </h3>
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Y-axis line */}
          <line 
            x1={padding} 
            y1={padding} 
            x2={padding} 
            y2={chartHeight - padding} 
            stroke="rgba(255, 255, 255, 0.3)" 
            strokeWidth="1"
          />
          
          {/* X-axis line */}
          <line 
            x1={padding} 
            y1={chartHeight - padding} 
            x2={chartWidth - padding} 
            y2={chartHeight - padding} 
            stroke="rgba(255, 255, 255, 0.3)" 
            strokeWidth="1"
          />
          
          {/* Data line */}
          <path
            d={pathData}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#ffffff"
                stroke="rgba(255, 255, 255, 0.8)"
                strokeWidth="1"
              />
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12"
                fontFamily="Inter, sans-serif"
              >
                {point.value}
              </text>
            </g>
          ))}
          
          {/* Y-axis labels */}
          {[minValue, minValue + valueRange * 0.25, minValue + valueRange * 0.5, minValue + valueRange * 0.75, maxValue].map((value, index) => {
            const y = padding + innerHeight - ((value - minValue) / valueRange) * innerHeight;
            return (
              <text
                key={value}
                x={padding - 10}
                y={y + 4}
                textAnchor="end"
                fill="rgba(255, 255, 255, 0.6)"
                fontSize="11"
                fontFamily="Inter, sans-serif"
              >
                {Math.round(value)}
              </text>
            );
          })}
          
          {/* X-axis labels */}
          {timelineData.filter((_, index) => index % 2 === 0).map((d, index) => {
            const x = padding + (index * 2 / (timelineData.length - 1)) * innerWidth;
            return (
              <text
                key={d.date}
                x={x}
                y={chartHeight - padding + 20}
                textAnchor="middle"
                fill="rgba(255, 255, 255, 0.6)"
                fontSize="11"
                fontFamily="Inter, sans-serif"
              >
                {d.date}
              </text>
            );
          })}
        </svg>
        
        {/* Chart legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '16px',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '2px',
              background: '#ffffff',
              borderRadius: '1px'
            }}></div>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
              Power Reliability Score
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineIntelligence;
