import React from 'react';
import styled from 'styled-components';

const PanelContainer = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 1000;
  display: ${props => props.$visible ? 'block' : 'none'};
`;

const Title = styled.h2`
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

const Section = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
`;

const List = styled.ul`
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #444;
`;

const ListItem = styled.li`
  margin-bottom: 4px;
`;

const RelevanceScore = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

const ScoreBar = styled.div`
  flex-grow: 1;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
`;

const ScoreFill = styled.div`
  height: 100%;
  width: ${props => (props.$score / 5) * 100}%;
  background: #2196F3;
  border-radius: 4px;
`;

const ScoreText = styled.span`
  font-size: 13px;
  color: #666;
  min-width: 24px;
`;

const DocumentInsightPanel = ({
  visible,
  documentData,
  onClose
}) => {
  if (!documentData) return null;

  const {
    title,
    analysis,
    docId
  } = documentData;

  return (
    <PanelContainer $visible={visible}>
      <Title>{title}</Title>
      
      <Section>
        <SectionTitle>Document Type</SectionTitle>
        <div style={{ fontSize: '13px', color: '#444' }}>{analysis.docType}</div>
      </Section>

      <Section>
        <SectionTitle>15-Minute City Relevance</SectionTitle>
        <RelevanceScore>
          <ScoreBar>
            <ScoreFill $score={analysis.fifteenMinCityRelevance} />
          </ScoreBar>
          <ScoreText>{analysis.fifteenMinCityRelevance}/5</ScoreText>
        </RelevanceScore>
      </Section>

      <Section>
        <SectionTitle>Focus Areas</SectionTitle>
        <List>
          {analysis.focusAreas.map((area, index) => (
            <ListItem key={index}>{area}</ListItem>
          ))}
        </List>
      </Section>

      <Section>
        <SectionTitle>Key Areas</SectionTitle>
        <List>
          {analysis.keyAreas.map((area, index) => (
            <ListItem key={index}>{area}</ListItem>
          ))}
        </List>
      </Section>

      <Section>
        <SectionTitle>Mappable Data Available</SectionTitle>
        <List>
          {analysis.mappableData.hasGeographicBoundaries && (
            <ListItem>Geographic boundaries</ListItem>
          )}
          {analysis.mappableData.hasInfrastructureMetrics && (
            <ListItem>Infrastructure capacity metrics</ListItem>
          )}
          {analysis.mappableData.hasTransitData && (
            <ListItem>Transit/accessibility data</ListItem>
          )}
          {analysis.mappableData.hasDevelopmentPotential && (
            <ListItem>Development potential indicators</ListItem>
          )}
          {analysis.mappableData.hasAmenityLocations && (
            <ListItem>Amenity locations</ListItem>
          )}
        </List>
      </Section>
    </PanelContainer>
  );
};

export default DocumentInsightPanel; 