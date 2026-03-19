import React from 'react';

const legendItems = [
  { label: 'Electric Easements', color: '#ef4444' },
  { label: 'Gas Easements', color: '#CD853F' },
];

// Legend styling for bottom left positioning
const legendStyle = {
  position: 'fixed',
  bottom: 32,
  left: 32,
  right: 'auto',
  top: 'auto',
  zIndex: 1002,
  background: '#181A1B',
  color: '#fff',
  borderRadius: 8,
  padding: '12px 18px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  fontSize: 14,
  minWidth: 180,
  maxWidth: 260,
  opacity: 0.97
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6
};

const colorDotStyle = (color) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  background: color,
  marginRight: 10,
  border: '2px solid #222'
});

const DukeTransmissionEasementsLegend = ({ visible }) => {
  if (!visible) return null;

  return (
    <div style={legendStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#E5E7EB' }}>
        Duke Transmission Easements:
      </div>
      {legendItems.map((item, index) => (
        <div key={index} style={legendItemStyle}>
          <div style={colorDotStyle(item.color)}></div>
          <span style={{ color: '#D1D5DB' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default DukeTransmissionEasementsLegend;
