/**
 * CategoryExpandedModal - Expanded view for category tables
 * 
 * This component displays a full-screen modal with the complete table
 * data for a specific category, similar to DetailExpandedModal but for tables.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Download, Share2 } from 'lucide-react';

const CategoryExpandedModal = ({ 
  isOpen, 
  onClose, 
  category, 
  title, 
  nodes = [], 
  columns = [],
  onTableRowClick = null,
  nodeAnimation = null
}) => {
  // State for selected row
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);

  if (!isOpen || !nodes || nodes.length === 0) return null;

  // Handle table row click in modal
  const handleTableRowClick = (node) => {
    // Toggle row selection
    const newSelectedId = selectedRowId === node.id ? null : node.id;
    setSelectedRowId(newSelectedId);
    
    // Automatically expand/collapse the detail row when row is clicked
    setExpandedRowId(newSelectedId);
    
    // Call the original table row click handler if provided
    if (onTableRowClick) {
      onTableRowClick(node);
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px 20px 20px',
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '12px',
        padding: '20px',
        width: '95vw',
        maxWidth: '1400px',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
        border: '2px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
        animation: 'modalSlideIn 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '2px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 4px 0',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
            }}>
              {title}
            </h2>
            <div style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: '500'
            }}>
              {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'} • Category: {category.toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => {
                // TODO: Implement export functionality
                console.log('Export clicked');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <Download size={16} color="#ffffff" />
              Export
            </button>
            <button
              onClick={() => {
                // TODO: Implement share functionality
                console.log('Share clicked');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <Share2 size={16} color="#ffffff" />
              Share
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <X size={16} color="#ffffff" />
              Close
            </button>
          </div>
        </div>

        {/* Expanded Table */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <tr>
                {columns.map((column, index) => (
                  <th 
                    key={index}
                    style={{ 
                      padding: '16px 12px', 
                      textAlign: column.align || 'left', 
                      color: '#ffffff', 
                      fontWeight: '600', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '16px',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}
                  >
                    {column.key.charAt(0).toUpperCase() + column.key.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => (
                <React.Fragment key={node.id}>
                  <tr
                    onClick={() => handleTableRowClick(node)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      animation: 'fadeInUp 0.3s ease-out',
                      animationDelay: `${index * 0.05}s`,
                      animationFillMode: 'both',
                      backgroundColor: selectedRowId === node.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderLeft: selectedRowId === node.id ? '3px solid #3b82f6' : '3px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRowId !== node.id) {
                        e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        e.target.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedRowId !== node.id) {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    {columns.map((column, colIndex) => (
                      <td 
                        key={colIndex}
                        style={{
                          padding: '12px',
                          color: column.color || '#ffffff',
                          fontWeight: column.fontWeight || '500',
                          textAlign: column.align || 'left',
                          fontSize: '14px',
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                        }}
                      >
                        {column.render ? column.render(node, index) : node[column.key]}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Expanded Detail Row - Only show when expanded */}
                  {selectedRowId === node.id && expandedRowId === node.id && (
                    <>
                      <tr style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderLeft: '3px solid #3b82f6',
                        animation: 'slideInFromLeft 0.3s ease-out'
                      }}>
                        <td 
                          colSpan={columns.length} 
                          style={{
                            padding: '20px 24px',
                            color: '#d1d5db',
                            fontSize: '12px',
                            lineHeight: '1.6',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            borderTop: '1px solid rgba(59, 130, 246, 0.3)'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '24px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontWeight: '600',
                                color: '#ffffff',
                                marginBottom: '16px',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  backgroundColor: '#3b82f6',
                                  borderRadius: '50%'
                                }} />
                                {node.name} - Detailed Information
                              </div>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '16px 24px'
                              }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Type:</strong>
                                  <div style={{ marginTop: '4px', color: '#e5e7eb' }}>{node.type}</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Power Score:</strong>
                                  <div style={{ marginTop: '4px', color: '#e5e7eb' }}>{node.powerScore}/10</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Risk Level:</strong>
                                  <div style={{ 
                                    marginTop: '4px', 
                                    color: node.risk === 'Low' ? '#10b981' : 
                                           node.risk === 'Medium' ? '#f59e0b' : '#ef4444'
                                  }}>{node.risk}</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Capacity:</strong>
                                  <div style={{ marginTop: '4px', color: '#e5e7eb' }}>{node.capacity || 'N/A'}</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Resilience:</strong>
                                  <div style={{ marginTop: '4px', color: '#e5e7eb' }}>{node.resilience || 'N/A'}</div>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong style={{ color: '#60a5fa' }}>Redundancy:</strong>
                                  <div style={{ marginTop: '4px', color: '#e5e7eb' }}>{node.redundancy || 'N/A'}</div>
                                </div>
                              </div>
                            </div>
                            <div style={{
                              width: '3px',
                              height: '120px',
                              background: 'linear-gradient(to bottom, #3b82f6, transparent)',
                              borderRadius: '2px',
                              flexShrink: 0
                            }} />
                          </div>
                        </td>
                      </tr>
                      
                      {/* Hide Button Row */}
                      <tr style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderLeft: '3px solid #3b82f6',
                        animation: 'slideInFromLeft 0.2s ease-out'
                      }}>
                        <td
                          colSpan={columns.length}
                          style={{
                            padding: '12px 20px',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowId(null);
                              setExpandedRowId(null);
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#60a5fa',
                              padding: '8px 16px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontFamily: 'Inter, monospace',
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase',
                              minWidth: '80px',
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
                              gap: '8px'
                            }}>
                              Hide
                              <span style={{
                                fontSize: '8px',
                                transition: 'transform 0.2s ease',
                                transform: 'rotate(180deg)'
                              }}>
                                ▼
                              </span>
                            </span>
                          </button>
                        </td>
                      </tr>
                    </>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>
                Total Nodes
              </div>
              <div style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700' }}>
                {nodes.length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>
                Avg Score
              </div>
              <div style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700' }}>
                {nodes.length > 0 ? (nodes.reduce((sum, node) => sum + (node.powerScore || 0), 0) / nodes.length).toFixed(1) : '0.0'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>
                High Risk
              </div>
              <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: '700' }}>
                {nodes.filter(node => node.risk === 'High').length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '4px' }}>
                Low Risk
              </div>
              <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
                {nodes.filter(node => node.risk === 'Low').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes modalSlideIn { 
            from { opacity: 0; transform: scale(0.9) translateY(-20px); } 
            to { opacity: 1; transform: scale(1) translateY(0); } 
          }
          @keyframes fadeInUp { 
            from { opacity: 0; transform: translateY(20px); } 
            to { opacity: 1; transform: translateY(0); } 
          }
        `}
      </style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CategoryExpandedModal;
