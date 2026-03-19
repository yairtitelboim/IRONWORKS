import styled from 'styled-components';

export const LayerToggleContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(10px);
  padding: 12px; /* Reduced from 16px */
  border-radius: 9px; /* Reduced from 12px */
  z-index: 1;
  transition: transform 0.3s ease;
  transform: translateX(${props => props.$isCollapsed ? 'calc(100% + 10px)' : '0'});
  width: 240px; /* Reduced from 320px (25% smaller) */
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  will-change: transform;
  
  &::-webkit-scrollbar {
    width: 6px; /* Reduced from 8px */
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.3);
    border-radius: 3px; /* Reduced from 4px */
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.5);
    border-radius: 3px; /* Reduced from 4px */
    &:hover {
      background: rgba(148, 163, 184, 0.7);
    }
  }
`;

export const LayerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px; /* Reduced from 16px */
  padding-bottom: 9px; /* Reduced from 12px */
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
`;

export const Title = styled.h2`
  color: #fff;
  font-size: 14px; /* Reduced from 18px */
  font-weight: 600;
  margin: 0;
`;

export const CollapseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 3px; /* Reduced from 4px */
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }

  svg {
    width: 18px; /* Reduced from 24px */
    height: 18px; /* Reduced from 24px */
    transform: rotate(${props => props.$isCollapsed ? '180deg' : '0deg'});
    transition: transform 0.3s ease;
  }
`;

export const ExpandButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(15, 23, 42, 0.9);
  border: none;
  color: white;
  cursor: pointer;
  padding: 6px; /* Reduced from 8px */
  display: ${props => props.$isCollapsed ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  border-radius: 5px; /* Reduced from 6px */
  opacity: 0.7;
  transition: opacity 0.2s ease;
  z-index: 1;

  /* P0-3: Min 44px tap target on mobile for accessibility */
  @media (max-width: 768px) {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }

  &:hover {
    opacity: 1;
  }

  svg {
    width: 18px; /* Reduced from 24px */
    height: 18px; /* Reduced from 24px */
    transform: rotate(180deg);
  }
`;

export const SearchInput = styled.input`
  width: 100%;
  padding: 6px 9px; /* Reduced from 8px 12px */
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px; /* Reduced from 6px */
  color: #fff;
  margin-bottom: 12px; /* Reduced from 16px */
  font-size: 11px; /* Reduced from 14px */
  
  &::placeholder {
    color: rgba(148, 163, 184, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

export const CategorySection = styled.div`
  margin-bottom: 12px; /* Reduced from 16px */
`;

export const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 9px; /* Reduced from 8px 12px */
  background: rgba(30, 41, 59, 0.6);
  border-radius: 6px; /* Reduced from 8px */
  cursor: pointer;
  margin-bottom: ${props => props.$isExpanded ? '6px' : '0'}; /* Reduced from 8px */
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(30, 41, 59, 0.8);
  }
`;

export const CategoryIcon = styled.div`
  width: 18px; /* Reduced from 24px */
  height: 18px; /* Reduced from 24px */
  margin-right: 9px; /* Reduced from 12px */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0.9;
  
  svg {
    stroke: currentColor;
  }
`;

export const CategoryTitle = styled.h3`
  color: #fff;
  font-size: 12px; /* Reduced from 15px */
  font-weight: 500;
  margin: 0;
  flex-grow: 1;
`;

export const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 30px; /* Reduced from 40px */
  height: 15px; /* Reduced from 20px */
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
    
    &:checked + span {
      background-color: #3b82f6;
    }
    
    &:checked + span:before {
      transform: translateX(15px); /* Reduced from 20px */
    }
  }
  
  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(148, 163, 184, 0.2);
    transition: .3s;
    border-radius: 15px; /* Reduced from 20px */
    
    &:before {
      position: absolute;
      content: "";
      height: 12px; /* Reduced from 16px */
      width: 12px; /* Reduced from 16px */
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
  }
`;

export const SubLayerContainer = styled.div`
  padding-left: 33px; /* Reduced from 44px */
  display: ${props => props.$isVisible ? 'block' : 'none'};
`;

export const SubLayer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0; /* Reduced from 8px 0 */
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px; /* Reduced from 14px */
`;

export const LegendContainer = styled.div`
  margin-top: 6px; /* Reduced from 8px */
  padding: 6px; /* Reduced from 8px */
  background: rgba(30, 41, 59, 0.6);
  border-radius: 5px; /* Reduced from 6px */
  font-size: 10px; /* Reduced from 12px */
`;

export const LegendTitle = styled.div`
  color: #fff;
  margin-bottom: 6px; /* Reduced from 8px */
  font-weight: 500;
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 3px; /* Reduced from 4px */
  color: rgba(255, 255, 255, 0.8);
`;

export const LegendColor = styled.div`
  width: 12px; /* Reduced from 16px */
  height: 12px; /* Reduced from 16px */
  margin-right: 6px; /* Reduced from 8px */
  border-radius: 2px;
  background: ${props => props.color};
`; 