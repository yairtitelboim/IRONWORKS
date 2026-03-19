import React from 'react';
import { CollapseIconContainer, CollapseIcon } from '../StyledComponents';

const CollapseButton = ({ isCollapsed, handleCollapseToggle }) => {
  return (
    <CollapseIconContainer 
      $isCollapsed={isCollapsed}
      style={{ willChange: 'transform' }}
    >
      <CollapseIcon 
        onClick={handleCollapseToggle}
        title={isCollapsed ? "Expand panel" : "Collapse panel"}
        $isCollapsed={isCollapsed}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
        </svg>
      </CollapseIcon>
    </CollapseIconContainer>
  );
};

export default CollapseButton; 