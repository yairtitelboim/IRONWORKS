import React, { useState } from 'react';
import { SidePopup } from './SidePopup';

// Mock data function to generate consistent scores and sources
const getMockData = (index, type) => {
  // Generate predictable scores based on index
  const mockScores = {
    'Adaptive Reuse': [75, 82, 68, 91, 64, 79],
    'Development': [58, 71, 84, 62, 88, 73]
  };
  
  // Generate predictable sources
  const mockSources = {
    'Adaptive Reuse': [
      'LA City Planning Dept',
      'Community Redevelopment Agency',
      'Housing Innovation Challenge',
      'Mayor\'s Office',
      'LA County Housing Authority',
      'Urban Land Institute'
    ],
    'Development': [
      'City Planning Commission',
      'Dept of Building & Safety',
      'LA City Council District Office',
      'Metro Transit Authority',
      'Private Developer Submission',
      'Economic Development Dept'
    ]
  };
  
  const scoreIndex = index % mockScores[type].length;
  const sourceIndex = index % mockSources[type].length;
  
  return {
    score: mockScores[type][scoreIndex],
    source: mockSources[type][sourceIndex]
  };
};

const MarkerCard = ({ marker, index, type }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get mock data if needed, or use actual data if available
  const mockData = getMockData(index, type);
  
  // Access score from properties or use mock data
  const score = marker.properties?.quality_score || marker.properties?.score || mockData.score;
  // Determine color based on score
  let scoreColor = '#8c52ff'; // Default purple for most scores
  if (score < 40) scoreColor = '#e74c3c'; // Red for low scores
  if (score > 85) scoreColor = '#2ecc71'; // Green for high scores
  
  // Get description and truncate it
  const fullDescription = marker.properties?.description || 'No description available';
  
  // Function to truncate text to first two sentences
  const truncateText = (text) => {
    // Match first two sentences ending with period, question mark, or exclamation point
    const sentenceRegex = /^(.*?[.!?])\s+(.*?[.!?])/;
    const match = text.match(sentenceRegex);
    
    if (match) {
      return match[1] + ' ' + match[2];
    }
    
    // If regex fails, just return first 150 characters
    return text.length > 150 ? text.substring(0, 150) : text;
  };
  
  const truncatedDescription = truncateText(fullDescription);
  const shouldTruncate = fullDescription.length > truncatedDescription.length;
  
  // Get source information, show mock data if missing
  const source = marker.properties?.source || mockData.source;
  
  return (
    <div 
      style={{ 
        marginBottom: '20px',
        padding: '15px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
          {type} Site {index + 1}
        </div>
        <div style={{ 
          background: scoreColor,
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'white'
        }}>
          Score: {score}
        </div>
      </div>
      <div style={{ 
        fontSize: '14px',
        lineHeight: '1.4',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: '8px'
      }}>
        {isExpanded ? fullDescription : truncatedDescription}
        {shouldTruncate && (
          <span 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ 
              color: '#64B5F6',
              cursor: 'pointer',
              marginLeft: '4px',
              userSelect: 'none'
            }}
          >
            {isExpanded ? ' Less' : ' ... Read more'}
          </span>
        )}
      </div>
      <div style={{ 
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.6)',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: '500' }}>Source:</span>
        <span style={{ marginLeft: '4px' }}>{source}</span>
      </div>
    </div>
  );
};

export const NeighborhoodPopup = ({ 
  selectedNeighborhood, 
  neighborhoodMarkers, 
  onClose 
}) => {
  if (!selectedNeighborhood || !neighborhoodMarkers) return null;

  return (
    <SidePopup
      title={selectedNeighborhood.name}
      subtitle={`${selectedNeighborhood.markerCount} Total Development Sites`}
      onClose={onClose}
    >
      {/* Show adaptive reuse sites first if any exist */}
      {neighborhoodMarkers.adaptiveReuse.length > 0 && (
        <div>
          <h3>Adaptive Reuse Sites ({neighborhoodMarkers.adaptiveReuse.length})</h3>
          {neighborhoodMarkers.adaptiveReuse.map((marker, index) => (
            <MarkerCard 
              key={`ar-${index}`}
              marker={marker}
              index={index}
              type="Adaptive Reuse"
            />
          ))}
        </div>
      )}
      
      {/* Show development potential sites */}
      {neighborhoodMarkers.development.length > 0 && (
        <div>
          <h3>Development Potential Sites ({neighborhoodMarkers.development.length})</h3>
          {neighborhoodMarkers.development.map((marker, index) => (
            <MarkerCard 
              key={`dev-${index}`}
              marker={marker}
              index={index}
              type="Development"
            />
          ))}
        </div>
      )}
    </SidePopup>
  );
}; 