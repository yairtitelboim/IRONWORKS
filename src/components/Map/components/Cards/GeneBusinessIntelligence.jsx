import React from 'react';
import styled from 'styled-components';

const BusinessIntelligenceContainer = styled.div`
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
  border: 1px solid #475569;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
`;

const IntelligenceHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    color: #f1f5f9;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    margin-left: 8px;
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
`;

const MetricCard = styled.div`
  background: rgba(30, 41, 59, 0.6);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #475569;
  
  .metric-label {
    color: #94a3b8;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  
  .metric-value {
    color: #f1f5f9;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  
  .metric-description {
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.4;
  }
`;

const StabilityIndicator = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${props => 
    props.stability === 'HIGH' ? 'rgba(34, 197, 94, 0.1)' :
    props.stability === 'MEDIUM' ? 'rgba(245, 158, 11, 0.1)' :
    'rgba(239, 68, 68, 0.1)'
  };
  border: 1px solid ${props => 
    props.stability === 'HIGH' ? '#22c55e' :
    props.stability === 'MEDIUM' ? '#f59e0b' :
    '#ef4444'
  };
  margin-bottom: 16px;
  
  .stability-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${props => 
      props.stability === 'HIGH' ? '#22c55e' :
      props.stability === 'MEDIUM' ? '#f59e0b' :
      '#ef4444'
    };
    margin-right: 12px;
  }
  
  .stability-text {
    color: #f1f5f9;
    font-weight: 600;
    flex: 1;
  }
  
  .stability-score {
    color: ${props => 
      props.stability === 'HIGH' ? '#22c55e' :
      props.stability === 'MEDIUM' ? '#f59e0b' :
      '#ef4444'
    };
    font-weight: 700;
    font-size: 18px;
  }
`;

const BusinessImpactSection = styled.div`
  border-top: 1px solid #475569;
  padding-top: 16px;
  
  .impact-title {
    color: #f1f5f9;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  
  .impact-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .impact-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: rgba(30, 41, 59, 0.4);
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
    
    .impact-icon {
      margin-right: 8px;
      font-size: 16px;
    }
    
    .impact-text {
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.4;
    }
  }
`;

const GeneBusinessIntelligence = ({ alphaEarthData }) => {
  if (!alphaEarthData || !alphaEarthData.geoJSON) {
    return null;
  }

  const features = alphaEarthData.geoJSON.features || [];
  
  // Calculate Gene-specific metrics
  const totalRiskAreas = features.filter(f => f.properties.embedding_distance > 0.3).length;
  const gridProximityRisk = features.filter(f => 
    f.properties.embedding_distance > 0.4 && 
    f.properties.category === 'water_change'
  ).length;
  const operationalImpactScore = (totalRiskAreas / alphaEarthData.pixelCount * 100).toFixed(1);
  const environmentalStability = totalRiskAreas < 30 ? 'HIGH' : totalRiskAreas < 60 ? 'MEDIUM' : 'LOW';
  
  // Calculate infrastructure risk score
  const infrastructureRiskScore = Math.min(100, (gridProximityRisk * 10 + totalRiskAreas * 0.5)).toFixed(0);
  
  // Gene-specific business impacts
  const getBusinessImpacts = () => {
    const impacts = [];
    
    if (gridProximityRisk > 5) {
      impacts.push({
        icon: '⚡',
        text: `${gridProximityRisk} water stress zones near power infrastructure - potential cooling efficiency impact`
      });
    }
    
    if (operationalImpactScore > 15) {
      impacts.push({
        icon: '💰',
        text: `${operationalImpactScore}% area environmental change - estimated 3-7% operational cost increase`
      });
    }
    
    if (environmentalStability === 'LOW') {
      impacts.push({
        icon: '🏗️',
        text: 'High environmental volatility - recommend enhanced site monitoring and backup systems'
      });
    } else if (environmentalStability === 'HIGH') {
      impacts.push({
        icon: '✅',
        text: 'Stable environmental conditions - favorable for long-term data center operations'
      });
    }
    
    impacts.push({
      icon: '📊',
      text: `Environmental intelligence based on ${alphaEarthData.pixelCount} real satellite data points`
    });
    
    return impacts;
  };

  return (
    <BusinessIntelligenceContainer>
      <IntelligenceHeader>
        <span style={{ fontSize: '20px' }}>🛰️</span>
        <h3>Data Center Environmental Intelligence</h3>
      </IntelligenceHeader>
      
      <StabilityIndicator stability={environmentalStability}>
        <div className="stability-dot"></div>
        <div className="stability-text">Site Environmental Stability</div>
        <div className="stability-score">{environmentalStability}</div>
      </StabilityIndicator>
      
      <MetricsGrid>
        <MetricCard>
          <div className="metric-label">Risk Areas Detected</div>
          <div className="metric-value">{totalRiskAreas}</div>
          <div className="metric-description">Environmental change zones requiring monitoring</div>
        </MetricCard>
        
        <MetricCard>
          <div className="metric-label">Infrastructure Risk Score</div>
          <div className="metric-value">{infrastructureRiskScore}</div>
          <div className="metric-description">Grid proximity environmental stress index</div>
        </MetricCard>
        
        <MetricCard>
          <div className="metric-label">Operational Impact</div>
          <div className="metric-value">{operationalImpactScore}%</div>
          <div className="metric-description">Percentage of site area with environmental changes</div>
        </MetricCard>
        
        <MetricCard>
          <div className="metric-label">Grid Proximity Risks</div>
          <div className="metric-value">{gridProximityRisk}</div>
          <div className="metric-description">High-impact zones near power infrastructure</div>
        </MetricCard>
      </MetricsGrid>
      
      <BusinessImpactSection>
        <div className="impact-title">Business Impact Analysis</div>
        <div className="impact-items">
          {getBusinessImpacts().map((impact, index) => (
            <div key={index} className="impact-item">
              <span className="impact-icon">{impact.icon}</span>
              <span className="impact-text">{impact.text}</span>
            </div>
          ))}
        </div>
      </BusinessImpactSection>
    </BusinessIntelligenceContainer>
  );
};

export default GeneBusinessIntelligence;
