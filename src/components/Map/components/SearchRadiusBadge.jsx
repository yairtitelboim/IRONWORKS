import React, { useState, useRef, useEffect, useCallback } from 'react';

const SELECTABLE_RADII = [15, 25, 50];

const formatRadiusLabel = (miles) => {
  if (miles === 1) return '1 mile';
  if (miles < 1) return `${miles.toFixed(1)} mile`;
  return `${miles} mi`;
};

const SearchRadiusBadge = ({ currentRadius, onRadiusSelect }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  const handleOutsideClick = useCallback((evt) => {
    if (containerRef.current && !containerRef.current.contains(evt.target)) {
      setMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [menuOpen, handleOutsideClick]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', pointerEvents: 'auto' }}>
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(100% + 6px)',
            background: 'rgba(10, 14, 24, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 8px 18px rgba(0, 0, 0, 0.4)',
            minWidth: '84px',
            zIndex: 5
          }}
        >
          {SELECTABLE_RADII.map((r) => (
            <button
              key={r}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRadiusSelect(r);
                setMenuOpen(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: '#f3f4f6',
                fontSize: '10px',
                padding: '5px 7px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {formatRadiusLabel(r)}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        style={{
          background: '#ef4444',
          color: '#000000',
          fontSize: '10px',
          fontWeight: 600,
          lineHeight: 1,
          padding: '5px 8px',
          borderRadius: '999px',
          border: '1px solid rgba(0, 0, 0, 0.35)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
          letterSpacing: '0.02em',
          cursor: 'pointer',
          pointerEvents: 'auto',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          outline: 'none'
        }}
      >
        {formatRadiusLabel(currentRadius)}
      </button>
    </div>
  );
};

SearchRadiusBadge.formatRadiusLabel = formatRadiusLabel;

export default SearchRadiusBadge;
