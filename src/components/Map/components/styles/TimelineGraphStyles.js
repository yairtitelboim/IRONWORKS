import styled from 'styled-components';

export const TimelineGraphContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => {
    if (!props.$visible) return '0';
    return props.$expanded ? '360px' : '180px';
  }};
  background: rgba(0, 0, 0, 0.98);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2000;
  transition: height 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
`;

export const TimelineGraphHeader = styled.div`
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  h3 {
    margin: 0;
    color: #e5e7eb;
    font-size: 16px;
    font-weight: 500;
  }
  
  p {
    margin: 0;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 400;
  }
`;

export const TimelineChartContainer = styled.div`
  flex: 1;
  width: 100%;
  padding: 4px 18px 12px;
  position: relative;
`;

export const ToggleContainer = styled.div`
  position: fixed;
  bottom: ${props => {
    if (!props.$visible) return '40px';
    return props.$expanded ? '400px' : '220px';
  }};
  right: 4px;
  z-index: 2001;
  transition: bottom 0.3s ease;
  
  @media (max-width: 768px) {
    bottom: ${props => {
      if (!props.$visible) return '40px';
      return props.$expanded ? '350px' : '220px';
    }};
    right: -6px;
  }
`;

/** Narrative (Story) panel toggle - sits above the timeline toggle. */
export const NarrativeToggleContainer = styled.div`
  position: fixed;
  bottom: ${props => {
    if (!props.$timelineVisible) return '92px';
    return props.$timelineExpanded ? '452px' : '272px';
  }};
  right: 4px;
  z-index: 2001;
  transition: bottom 0.3s ease;
  @media (max-width: 768px) {
    bottom: ${props => {
      if (!props.$timelineVisible) return '92px';
      return props.$timelineExpanded ? '462px' : '272px';
    }};
    right: -6px;
  }
`;

export const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e5e7eb;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  
  &:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export const ToggleIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$active ? '#ffffff' : '#9ca3af'};
  transition: color 0.2s ease;
  
  svg {
    stroke: currentColor;
  }
`;

export const ToggleLabel = styled.span`
  user-select: none;
`;
