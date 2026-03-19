/**
 * InnovationTable - Innovation potential table component
 * 
 * This component renders the "INN" category table with animation support
 * and handles table row clicks for map integration.
 */

import React, { useState } from 'react';
import AnimatedTableRow from './AnimatedTableRow';
import CategoryTableHeader from './CategoryTableHeader';
import CategoryExpandedModal from './CategoryExpandedModal';
import { getTypeAbbreviation } from '../../../../../utils/tableUtils/tableDataParser';
import { extractCoordinatesFromNode } from '../../../../../utils/tableUtils/tableRowClickHandler';

const InnovationTable = ({ 
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
    
    if (type.includes('startup') || type.includes('company')) {
      return 'pulse'; // Startups get pulse animation
    }
    if (type.includes('investor') || type.includes('venture')) {
      return 'ripple'; // Investors get ripple effect
    }
    if (type.includes('university') || type.includes('research')) {
      return 'glow'; // Universities get glow effect
    }
    if (type.includes('co-working') || type.includes('incubator')) {
      return 'heartbeat'; // Co-working spaces get heartbeat
    }
    
    return 'pulse'; // Default animation
  };

  // Get animation intensity based on node score
  const getAnimationIntensity = (node) => {
    const score = node.innovationScore || 0;
    
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
          category: 'pwr'
        });
      }
    }
  };

  // Define table columns
  const columns = [
    {
      key: 'plant',
      align: 'left',
      color: '#ffffff',
      fontWeight: '500',
      render: (node) => `${node.id} ${node.name.split(' ')[0]}` // Plant: id + first word of name
    },
    {
      key: 'growthOpportunity',
      align: 'left',
      color: '#d1d5db'
    },
    {
      key: 'innovationScore',
      align: 'center',
      fontWeight: '600',
      render: (node) => (
        <span style={{
          color: node.innovationScore >= 8 ? '#10b981' : 
                 node.innovationScore >= 6 ? '#f59e0b' : '#ef4444'
        }}>
          {node.innovationScore}/10
        </span>
      )
    },
    {
      key: 'fundingStage',
      align: 'center',
      color: '#d1d5db'
    }
  ];

  return (
    <div>
      <CategoryTableHeader
        title="Power Generation Analysis"
        category="pwr"
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
            background: 'linear-gradient(135deg, #ef4444, #f59e0b)'
          }}>
            <tr>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'left', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Plant
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
                Efficiency
              </th>
              <th style={{ 
                padding: '8px 6px', 
                textAlign: 'center', 
                color: '#ffffff', 
                fontWeight: '600', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
              }}>
                Queue
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
      
      {/* Power Insights */}
      <div className="insight-card" style={{
        marginTop: '16px',
        padding: '12px'
      }}>
        <div style={{
          fontSize: '7.68px',
          fontWeight: '600',
          color: '#fca5a5',
          marginBottom: '8px'
        }}>
          Power Generation Insights
        </div>
        <div style={{
          fontSize: '7.04px',
          color: '#d1d5db',
          lineHeight: '1.4'
        }}>
          • <strong>Total Innovation:</strong> {nodes.reduce((sum, node) => {
            return sum + (node.innovationScore || 0);
          }, 0)} innovation points across {nodes.length} startups<br/>
          • <strong>Innovation Range:</strong> {Math.min(...nodes.map(n => n.innovationScore || 0))}-{Math.max(...nodes.map(n => n.innovationScore || 0))}/10<br/>
          • <strong>Growth Opportunities:</strong> {nodes.map(node => node.growthOpportunity).filter(Boolean).join(', ')} key growth areas
        </div>
      </div>
      
      {/* Expanded Modal */}
      <CategoryExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        category="pwr"
        title="Power Generation Analysis"
        nodes={nodes}
        columns={columns}
        onTableRowClick={onTableRowClick}
        nodeAnimation={nodeAnimation}
      />
    </div>
  );
};

export default InnovationTable;
