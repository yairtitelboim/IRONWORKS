/**
 * AnimatedTableRow - Enhanced table row with animation support
 * 
 * This component provides a table row with built-in animation capabilities
 * and click handling for map integration.
 */

import React from 'react';
import { handleTableRowClick } from '../../../../../utils/tableUtils/tableRowClickHandler';

const AnimatedTableRow = ({ 
  node, 
  index, 
  columns, 
  onTableRowClick, 
  nodeAnimation, 
  animationConfig = {},
  className = '',
  style = {},
  isSelected = false,
  isExpanded = false,
  isHighlighted = false,
  onDetailToggle = null
}) => {
  // Default animation configuration
  const defaultAnimationConfig = {
    hoverEffect: true,
    clickAnimation: true,
    pulseOnHover: false,
    ...animationConfig
  };

  // Handle row click with animation
  const handleClick = (e) => {
    e.preventDefault();
    
    // Call the table row click handler
    handleTableRowClick(node, onTableRowClick, nodeAnimation);
    
    // Add visual feedback based on node type (without overriding background color)
    if (defaultAnimationConfig.clickAnimation) {
      const row = e.currentTarget;
      const nodeType = node.type?.toLowerCase() || '';
      
      // Store original background color to restore it
      const originalBgColor = isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent';
      
      // Different visual feedback based on node type
      if (nodeType.includes('power') || nodeType.includes('plant')) {
        // Power plant: red pulse effect
        row.style.transform = 'scale(0.95)';
        row.style.transition = 'all 0.2s ease';
        
        setTimeout(() => {
          row.style.transform = 'scale(1)';
          setTimeout(() => {
            row.style.transition = '';
          }, 200);
        }, 200);
      } else if (nodeType.includes('substation') || nodeType.includes('transmission')) {
        // Transmission: blue ripple effect
        row.style.transform = 'scale(0.97)';
        row.style.transition = 'all 0.15s ease';
        
        setTimeout(() => {
          row.style.transform = 'scale(1)';
          setTimeout(() => {
            row.style.transition = '';
          }, 150);
        }, 150);
      } else if (nodeType.includes('water') || nodeType.includes('utility')) {
        // Utility: cyan glow effect
        row.style.transform = 'scale(0.96)';
        row.style.transition = 'all 0.18s ease';
        
        setTimeout(() => {
          row.style.transform = 'scale(1)';
          setTimeout(() => {
            row.style.transition = '';
          }, 180);
        }, 180);
      } else if (nodeType.includes('data') || nodeType.includes('center')) {
        // Data center: purple heartbeat effect
        row.style.transform = 'scale(0.94)';
        row.style.transition = 'all 0.25s ease';
        
        setTimeout(() => {
          row.style.transform = 'scale(1)';
          setTimeout(() => {
            row.style.transition = '';
          }, 250);
        }, 250);
      } else {
        // Default: simple scale effect
        row.style.transform = 'scale(0.98)';
        row.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
          row.style.transform = 'scale(1)';
          setTimeout(() => {
            row.style.transition = '';
          }, 100);
        }, 100);
      }
    }
  };

  // Handle hover effects
  const handleMouseEnter = (e) => {
    if (defaultAnimationConfig.hoverEffect) {
      const row = e.currentTarget;
      const nodeType = node.type?.toLowerCase() || '';
      
      // Different hover effects based on node type
      if (nodeType.includes('power') || nodeType.includes('plant')) {
        // Power plant: red glow hover
        row.style.transform = 'translateX(4px)';
        row.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
        row.style.borderLeft = '3px solid rgba(239, 68, 68, 0.6)';
        row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      } else if (nodeType.includes('substation') || nodeType.includes('transmission')) {
        // Transmission: blue glow hover
        row.style.transform = 'translateX(4px)';
        row.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        row.style.borderLeft = '3px solid rgba(59, 130, 246, 0.6)';
        row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      } else if (nodeType.includes('water') || nodeType.includes('utility')) {
        // Utility: cyan glow hover
        row.style.transform = 'translateX(4px)';
        row.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
        row.style.borderLeft = '3px solid rgba(6, 182, 212, 0.6)';
        row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      } else if (nodeType.includes('data') || nodeType.includes('center')) {
        // Data center: purple glow hover
        row.style.transform = 'translateX(4px)';
        row.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
        row.style.borderLeft = '3px solid rgba(139, 92, 246, 0.6)';
        row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      } else {
        // Default hover effect
        row.style.transform = 'translateX(4px)';
        row.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }
  };

  const handleMouseLeave = (e) => {
    if (defaultAnimationConfig.hoverEffect) {
      const row = e.currentTarget;
      row.style.transform = 'translateX(0)';
      row.style.boxShadow = '';
      row.style.borderLeft = '';
      row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  };

  // Handle detail toggle button click
  const handleDetailToggleClick = (e) => {
    e.stopPropagation(); // Prevent row click
    if (onDetailToggle) {
      onDetailToggle(node.id, !isExpanded, node);
    }
  };

  return (
    <>
      <tr 
        key={node.id} 
        data-node-id={node.id}
        className={`table-row-hover ${className}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          animationDelay: `${index * 0.1}s`,
          animation: 'slideInFromLeft 0.5s ease-out',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: isHighlighted 
            ? 'rgba(16, 185, 129, 0.2)' 
            : isSelected 
              ? 'rgba(59, 130, 246, 0.15)' 
              : 'transparent',
          borderLeft: isHighlighted 
            ? '3px solid #10b981' 
            : isSelected 
              ? '3px solid #3b82f6' 
              : '3px solid transparent',
          boxShadow: isHighlighted 
            ? '0 0 12px rgba(16, 185, 129, 0.3)' 
            : 'none',
          ...style
        }}
      >
        {columns.map((column, colIndex) => (
          <td 
            key={colIndex}
            style={{
              padding: '8px 6px',
              color: column.color || '#ffffff',
              fontWeight: column.fontWeight || '500',
              textAlign: column.align || 'left',
              ...column.style
            }}
          >
            {column.render ? column.render(node, index) : node[column.key]}
          </td>
        ))}
      </tr>
      
      
      {/* Expanded Detail Row - Only show when expanded */}
      {isSelected && isExpanded && (
        <>
          <tr style={{
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderLeft: '3px solid #3b82f6',
            animation: 'slideInFromLeft 0.3s ease-out'
          }}>
            <td 
              colSpan={columns.length} 
              style={{
                padding: '16px 20px',
                color: '#d1d5db',
                fontSize: '10px',
                lineHeight: '1.5',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                borderTop: '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '20px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    color: '#ffffff',
                    marginBottom: '12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      width: '4px',
                      height: '4px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '50%'
                    }} />
                    {node.name} - Startup Overview
                  </div>
                  <div style={{
                    color: '#e5e7eb',
                    fontSize: '10px',
                    lineHeight: '1.5',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    padding: '2px 2px',
                    margin: '0 -2px',
                    paddingRight: '-2px',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '180%',
                    boxSizing: 'border-box'
                  }}>
                    {node.spatialInsights?.clustering_pattern || 
                     node.geographicIntelligence?.academic_proximity?.most_relevant_university?.split(' — ')[1] ||
                     `${node.name} is a ${node.category || 'technology'} startup founded in ${node.foundedDate || 'recent years'}. The company operates in the ${typeof node.industries === 'string' ? node.industries.split(',')[0] : node.industries || 'technology'} sector and is currently at the ${node.fundingStage || 'early'} funding stage.`}
                  </div>
                </div>
                <div style={{
                  width: '2px',
                  height: '80px',
                  background: 'linear-gradient(to bottom, #3b82f6, transparent)',
                  borderRadius: '1px',
                  flexShrink: 0
                }} />
              </div>
            </td>
          </tr>
          
           {/* Hide and Expand Button Row */}
           <tr style={{
             backgroundColor: 'rgba(59, 130, 246, 0.05)',
             borderLeft: '3px solid #3b82f6',
             animation: 'slideInFromLeft 0.2s ease-out'
           }}>
             <td
               colSpan={columns.length}
               style={{
                 padding: '8px 16px',
                 textAlign: 'left',
                 borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
               }}
             >
               <div style={{
                 display: 'flex',
                 gap: '8px',
                 alignItems: 'center'
               }}>
                 <button
                   onClick={handleDetailToggleClick}
                   style={{
                     background: 'transparent',
                     border: '1px solid rgba(59, 130, 246, 0.3)',
                     borderRadius: '6px',
                     color: '#60a5fa',
                     padding: '6px 12px',
                     fontSize: '9px',
                     fontWeight: '600',
                     cursor: 'pointer',
                     transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                     fontFamily: 'Inter, monospace',
                     letterSpacing: '0.5px',
                     textTransform: 'uppercase',
                     minWidth: '60px',
                     position: 'relative',
                     overflow: 'hidden'
                   }}
                   onMouseEnter={(e) => {
                     e.target.style.transform = 'scale(1.05)';
                     e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                     e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                     e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                   }}
                   onMouseLeave={(e) => {
                     e.target.style.transform = 'scale(1)';
                     e.target.style.boxShadow = 'none';
                     e.target.style.background = 'transparent';
                     e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                   }}
                   title="Hide details"
                 >
                   <span style={{
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '6px'
                   }}>
                     Hide
                     <span style={{
                       fontSize: '7px',
                       transition: 'transform 0.2s ease',
                       transform: 'rotate(180deg)'
                     }}>
                       ▼
                     </span>
                   </span>
                 </button>

                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     if (onDetailToggle) {
                       onDetailToggle(node.id, 'expand', node);
                     }
                   }}
                   style={{
                     background: 'transparent',
                     border: '1px solid rgba(59, 130, 246, 0.3)',
                     borderRadius: '6px',
                     color: '#60a5fa',
                     padding: '6px 12px',
                     fontSize: '9px',
                     fontWeight: '600',
                     cursor: 'pointer',
                     transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                     fontFamily: 'Inter, monospace',
                     letterSpacing: '0.5px',
                     textTransform: 'uppercase',
                     minWidth: '60px',
                     position: 'relative',
                     overflow: 'hidden'
                   }}
                   onMouseEnter={(e) => {
                     e.target.style.transform = 'scale(1.05)';
                     e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                     e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                     e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                   }}
                   onMouseLeave={(e) => {
                     e.target.style.transform = 'scale(1)';
                     e.target.style.boxShadow = 'none';
                     e.target.style.background = 'transparent';
                     e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                   }}
                   title="Expand details in separate window"
                 >
                   <span style={{
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '6px'
                   }}>
                     Expand
                     <span style={{
                       fontSize: '7px',
                       transition: 'transform 0.2s ease'
                     }}>
                       ↗
                     </span>
                   </span>
                 </button>
               </div>
             </td>
           </tr>
        </>
      )}
    </>
  );
};

export default AnimatedTableRow;
