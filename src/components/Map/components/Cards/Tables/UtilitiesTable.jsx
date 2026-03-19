/**
 * UtilitiesTable - Utilities and infrastructure table component
 * 
 * This component renders the "UTL" category table with animation support
 * and handles table row clicks for map integration.
 */

import React, { useState } from 'react';
import AnimatedTableRow from './AnimatedTableRow';
import CategoryTableHeader from './CategoryTableHeader';
import CategoryExpandedModal from './CategoryExpandedModal';
import { getTypeAbbreviation } from '../../../../../utils/tableUtils/tableDataParser';
import { extractCoordinatesFromNode } from '../../../../../utils/tableUtils/tableRowClickHandler';

const UtilitiesTable = ({ 
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
          category: 'utl'
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
      key: 'name',
      align: 'left',
      color: '#d1d5db',
      render: (node) => node.name.split(' ')[0] // Show first word of name
    },
    {
      key: 'type',
      align: 'left',
      color: '#d1d5db',
      render: (node) => {
        if (node.type.includes('Water')) return 'Water';
        if (node.type.includes('Electric')) return 'Electric';
        if (node.type.includes('Utility')) return 'Utility';
        return 'Other';
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
        title="Utilities & Infrastructure"
        category="utl"
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
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)'
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
                Utility
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
      
      {/* Utilities Insights */}
      <div className="insight-card" style={{
        marginTop: '16px',
        padding: '12px'
      }}>
        <div style={{
          fontSize: '7.68px',
          fontWeight: '600',
          color: '#22d3ee',
          marginBottom: '8px'
        }}>
          Utilities Insights
        </div>
        <div style={{
          fontSize: '7.04px',
          color: '#d1d5db',
          lineHeight: '1.4'
        }}>
          • <strong>Water Infrastructure:</strong> {nodes.filter(n => n.type.includes('Water')).length} facilities<br/>
          • <strong>Electric Utilities:</strong> {nodes.filter(n => n.type.includes('Electric')).length} providers<br/>
          • <strong>Service Coverage:</strong> {nodes.length} total utility nodes in analysis area
        </div>
      </div>
      
      {/* Expanded Modal */}
      <CategoryExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        category="utl"
        title="Utilities & Infrastructure"
        nodes={nodes}
        columns={columns}
        onTableRowClick={onTableRowClick}
        nodeAnimation={nodeAnimation}
      />
    </div>
  );
};

export default UtilitiesTable;
