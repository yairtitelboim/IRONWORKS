/**
 * TransmissionTable - Transmission and grid analysis table component
 * 
 * This component renders the "TRN" category table with animation support
 * and handles table row clicks for map integration.
 */

import React, { useState } from 'react';
import AnimatedTableRow from './AnimatedTableRow';
import CategoryTableHeader from './CategoryTableHeader';
import CategoryExpandedModal from './CategoryExpandedModal';
import { getTypeAbbreviation } from '../../../../../utils/tableUtils/tableDataParser';
import { extractCoordinatesFromNode } from '../../../../../utils/tableUtils/tableRowClickHandler';

const TransmissionTable = ({ 
  nodes, 
  onTableRowClick, 
  nodeAnimation, 
  animationConfig = {} 
}) => {
  // State for expanded modal
  const [isExpanded, setIsExpanded] = useState(false);
  // Get animation type based on node data
  const getAnimationTypeForNode = (node) => {
    const type = node.type.toLowerCase();
    
    if (type.includes('power') || type.includes('plant')) {
      return 'pulse'; // Power plants get pulse animation
    }
    if (type.includes('substation') || type.includes('transmission')) {
      return 'ripple'; // Transmission gets ripple effect
    }
    if (type.includes('water') || type.includes('utility')) {
      return 'glow'; // Utilities get glow effect
    }
    if (type.includes('data') || type.includes('center')) {
      return 'heartbeat'; // Data centers get heartbeat
    }
    
    return 'pulse'; // Default animation
  };

  // Get animation intensity based on node score
  const getAnimationIntensity = (node) => {
    const score = node.powerScore || 0;
    
    if (score >= 8) return 0.8; // High intensity for high scores
    if (score >= 6) return 0.6; // Medium intensity for medium scores
    if (score >= 4) return 0.4; // Low intensity for low scores
    return 0.2; // Very low intensity for very low scores
  };

  // Get animation duration based on node risk level
  const getAnimationDuration = (node) => {
    const risk = node.risk?.toLowerCase();
    
    if (risk === 'high') return 3.0; // Longer duration for high risk
    if (risk === 'medium') return 2.0; // Medium duration for medium risk
    if (risk === 'low') return 1.5; // Shorter duration for low risk
    return 2.0; // Default duration
  };

  // Handle table row click with animation
  const handleRowClick = (node) => {
    // Call the original table row click handler
    if (onTableRowClick) {
      onTableRowClick(node);
    }

    // Emit event to highlight corresponding map marker
    if (window.mapEventBus) {
      window.mapEventBus.emit('table:rowClicked', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        nodeData: node
      });
    }

    // Trigger animation if animation system is available
    if (nodeAnimation) {
      // Extract coordinates from node content
      const coordinates = extractCoordinatesFromNode(node);
      
      if (coordinates) {
        // Determine animation type based on node category
        const animationType = getAnimationTypeForNode(node);
        
        // Trigger the animation
        nodeAnimation.triggerNodeAnimation(coordinates, {
          type: animationType,
          intensity: getAnimationIntensity(node),
          duration: getAnimationDuration(node),
          nodeData: node,
          category: 'trn'
        });
      }
    }
  };

  // Define table columns
  const columns = [
    {
      key: 'id',
      align: 'left',
      color: '#ffffff',
      fontWeight: '500'
    },
    {
      key: 'type',
      align: 'left',
      color: '#d1d5db',
      render: (node) => getTypeAbbreviation(node.type)
    },
    {
      key: 'voltage',
      align: 'center',
      color: '#d1d5db',
      render: (node) => {
        if (node.content.includes('345 kV')) return '345 kV';
        if (node.content.includes('138 kV')) return '138 kV';
        if (node.content.includes('69 kV')) return '69 kV';
        return 'N/A';
      }
    },
    {
      key: 'capacity',
      align: 'left',
      color: '#d1d5db'
    },
    {
      key: 'powerScore',
      align: 'center',
      fontWeight: '600',
      render: (node) => (
        <span style={{
          color: node.powerScore >= 8 ? '#10b981' : 
                 node.powerScore >= 6 ? '#f59e0b' : '#ef4444'
        }}>
          {node.powerScore}/10
        </span>
      )
    }
  ];

  return (
    <div>
      <CategoryTableHeader
        title="Transmission & Grid Analysis"
        category="trn"
        nodeCount={nodes.length}
        onExpand={() => setIsExpanded(true)}
      />
      
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '8.8px'
        }}>
          <thead style={{
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
          }}>
            <tr>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Node
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Type
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'center', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Voltage
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Capacity
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'center', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, index) => (
              <AnimatedTableRow
                key={node.id}
                node={node}
                index={index}
                columns={columns}
                onTableRowClick={handleRowClick}
                nodeAnimation={nodeAnimation}
                animationConfig={animationConfig}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Transmission Insights */}
      <div className="insight-card" style={{
        marginTop: '16px',
        padding: '12px'
      }}>
        <div style={{
          fontSize: '7.68px',
          fontWeight: '600',
          color: '#60a5fa',
          marginBottom: '8px'
        }}>
          Transmission Insights
        </div>
        <div style={{
          fontSize: '7.04px',
          color: '#d1d5db',
          lineHeight: '1.4'
        }}>
          • <strong>Grid Integration:</strong> {nodes.filter(n => n.type.includes('Substation')).length} substations, {nodes.filter(n => n.type.includes('Transmission')).length} transmission lines<br/>
          • <strong>Voltage Levels:</strong> {[...new Set(nodes.map(n => 
            n.content.includes('345 kV') ? '345 kV' : 
            n.content.includes('138 kV') ? '138 kV' : 
            n.content.includes('69 kV') ? '69 kV' : null
          ).filter(Boolean))].join(', ')}<br/>
          • <strong>Reliability Score:</strong> {Math.round(nodes.reduce((sum, n) => sum + n.powerScore, 0) / nodes.length)}/10 average
        </div>
      </div>
      
      {/* Expanded Modal */}
      <CategoryExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        category="trn"
        title="Transmission & Grid Analysis"
        nodes={nodes}
        columns={columns}
        onTableRowClick={onTableRowClick}
        nodeAnimation={nodeAnimation}
      />
    </div>
  );
};

export default TransmissionTable;
