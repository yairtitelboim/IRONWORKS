/**
 * RiskTable - Risk and resilience analysis table component
 * 
 * This component renders the "RISK" category table with animation support
 * and handles table row clicks for map integration.
 */

import React, { useState } from 'react';
import AnimatedTableRow from './AnimatedTableRow';
import CategoryTableHeader from './CategoryTableHeader';
import CategoryExpandedModal from './CategoryExpandedModal';
import { getTypeAbbreviation } from '../../../../../utils/tableUtils/tableDataParser';
import { extractCoordinatesFromNode } from '../../../../../utils/tableUtils/tableRowClickHandler';

const RiskTable = ({ 
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
          category: 'risk'
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
      key: 'risk',
      align: 'left',
      fontWeight: '500',
      render: (node) => (
        <span style={{
          color: node.risk === 'Low' ? '#10b981' : 
                 node.risk === 'Medium' ? '#f59e0b' : '#ef4444'
        }}>
          {node.risk}
        </span>
      )
    },
    {
      key: 'resilience',
      align: 'left',
      color: '#d1d5db'
    },
    {
      key: 'redundancy',
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
        title="Risk & Resilience Analysis"
        category="risk"
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
          fontSize: '7.92px'
        }}>
          <thead style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)'
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
                Risk Level
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Resilience
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Redundancy
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
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
      
      {/* Risk Insights */}
      <div className="insight-card" style={{
        marginTop: '16px',
        padding: '12px'
      }}>
        <div style={{
          fontSize: '6.91px',
          fontWeight: '600',
          color: '#fbbf24',
          marginBottom: '8px'
        }}>
          Risk Analysis Insights
        </div>
        <div style={{
          fontSize: '6.34px',
          color: '#d1d5db',
          lineHeight: '1.4'
        }}>
          • <strong>High Risk Nodes:</strong> {nodes.filter(n => n.risk === 'High').length} facilities require immediate attention<br/>
          • <strong>Weather Resilience:</strong> {nodes.filter(n => n.resilience && n.resilience !== 'N/A').length} nodes have resilience data<br/>
          • <strong>Redundancy Coverage:</strong> {nodes.filter(n => n.redundancy && n.redundancy !== 'N/A').length} nodes have backup systems
        </div>
      </div>
      
      {/* Expanded Modal */}
      <CategoryExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        category="risk"
        title="Risk & Resilience Analysis"
        nodes={nodes}
        columns={columns}
        onTableRowClick={onTableRowClick}
        nodeAnimation={nodeAnimation}
      />
    </div>
  );
};

export default RiskTable;
