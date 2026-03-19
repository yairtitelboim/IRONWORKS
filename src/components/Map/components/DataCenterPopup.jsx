import React from 'react';

const DataCenterPopup = ({ 
  dataCenter, 
  position, 
  coordinates,
  onClose 
}) => {
  console.log(`🎨 DataCenterPopup render:`, { dataCenter, position, coordinates });
  console.log(`📍 Calculated popup position:`, { left: `${position.x - 100}px`, top: `${position.y - 140}px` });
  
  if (!dataCenter) return null;

  const popupStyle = {
    position: 'fixed',
    left: `${position.x - 100}px`, // Center horizontally on click
    top: `${position.y - 140}px`, // Position above the marker
    width: '200px',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    border: '1px solid #00FF00', // Green border to match data center color
    borderRadius: '8px',
    padding: '12px',
    color: '#ffffff',
    fontFamily: 'Roboto, Arial, sans-serif',
    fontSize: '11px',
    lineHeight: '1.3',
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 255, 0, 0.2)',
    backdropFilter: 'blur(10px)',
    pointerEvents: 'auto'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    borderBottom: '1px solid #333333',
    paddingBottom: '6px'
  };

  const titleStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#00FF00',
    margin: 0
  };

  const closeButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: '#666666',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px',
    borderRadius: '2px',
    transition: 'color 0.2s ease',
    lineHeight: '1'
  };

  const contentStyle = {
    fontSize: '10px',
    color: '#cccccc'
  };

  const propertyStyle = {
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between'
  };

  const labelStyle = {
    color: '#999999',
    fontWeight: '400'
  };

  const valueStyle = {
    color: '#ffffff',
    fontWeight: '500'
  };

  return (
    <div style={popupStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Data Center</h3>
        <button
          onClick={onClose}
          style={closeButtonStyle}
          onMouseEnter={(e) => e.target.style.color = '#999999'}
          onMouseLeave={(e) => e.target.style.color = '#666666'}
          title="Close popup"
        >
          ×
        </button>
      </div>
      
      <div style={contentStyle}>
        {dataCenter.name && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Name:</span>
            <span style={valueStyle}>{dataCenter.name}</span>
          </div>
        )}
        
        {dataCenter.operator && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Operator:</span>
            <span style={valueStyle}>{dataCenter.operator}</span>
          </div>
        )}
        
        {dataCenter.address && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Address:</span>
            <span style={valueStyle}>{dataCenter.address}</span>
          </div>
        )}
        
        {dataCenter.capacity && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Capacity:</span>
            <span style={valueStyle}>{dataCenter.capacity}</span>
          </div>
        )}
        
        {dataCenter.status && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Status:</span>
            <span style={valueStyle}>{dataCenter.status}</span>
          </div>
        )}
        
        {coordinates && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Coordinates:</span>
            <span style={valueStyle}>
              {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </span>
          </div>
        )}
        
        {!dataCenter.name && !dataCenter.operator && !dataCenter.address && 
         !dataCenter.capacity && !dataCenter.status && (
          <div style={propertyStyle}>
            <span style={labelStyle}>Type:</span>
            <span style={valueStyle}>Data Center</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCenterPopup; 