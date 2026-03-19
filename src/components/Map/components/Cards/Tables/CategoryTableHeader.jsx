/**
 * CategoryTableHeader - Reusable header component with expand toggle
 * 
 * This component provides a consistent header for category tables with
 * a subtle expand toggle button that opens the table in a modal.
 */

import React from 'react';

const CategoryTableHeader = ({ 
  title, 
  onExpand, 
  category,
  nodeCount = 0,
  style = {}
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      ...style
    }}>
      <div style={{
        fontSize: '13.25px',
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'left',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>{title}</span>
      </div>
      
      {/* Subtle Expand Toggle */}
      <button
        onClick={onExpand}
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: 'rgba(255, 255, 255, 0.7)',
          padding: '3px 6px',
          fontSize: '7px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: 'Inter, monospace',
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
          minWidth: '40px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
          e.target.style.color = 'rgba(255, 255, 255, 0.9)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.color = 'rgba(255, 255, 255, 0.7)';
        }}
        title={`Expand ${title} in detailed view`}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          Expand
        </span>
      </button>
    </div>
  );
};

export default CategoryTableHeader;
