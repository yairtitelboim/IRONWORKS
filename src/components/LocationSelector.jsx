import React, { useState } from 'react';
import { getAvailableLocations, getLocationDisplayName, getGeographicConfig } from '../config/geographicConfig.js';

/**
 * LocationSelector - Component for switching between different geographic locations
 * Enables production flexibility by allowing users to analyze different data center sites
 * Default: Austin, TX for Tx transmission analysis
 */
const LocationSelector = ({ currentLocation, onLocationChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const locations = getAvailableLocations();
  const effectiveLocation = currentLocation || 'texas';
  const currentConfig = getGeographicConfig(effectiveLocation);

  const handleLocationSelect = (locationKey) => {
    onLocationChange(locationKey);
    setIsOpen(false);
  };

  return (
    <div className={`location-selector ${className}`} style={{ position: 'relative' }}>
      {/* Current Location Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minWidth: '140px'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#10b981' // Green dot for active location
        }} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          {getLocationDisplayName(effectiveLocation)}
        </span>
        <span style={{
          fontSize: '10px',
          opacity: 0.7,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>
          ▼
        </span>
      </button>

      {/* Location Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '6px',
          marginTop: '4px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)'
        }}>
          {locations.map((location) => {
            const isSelected = location.key === effectiveLocation;
            const config = getGeographicConfig(location.key);
            
            return (
              <button
                key={location.key}
                onClick={() => handleLocationSelect(location.key)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  border: 'none',
                  color: isSelected ? '#10b981' : '#ffffff',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.3)'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: isSelected ? '600' : '400' }}>
                    {location.state ? `${location.city}, ${location.state}` : location.city}
                  </div>
                  <div style={{ 
                    fontSize: '10px', 
                    opacity: 0.7,
                    marginTop: '2px'
                  }}>
                    {location.region} • {location.gridOperator}
                  </div>
                </div>
                {isSelected && (
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default LocationSelector;
