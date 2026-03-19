import React from 'react';
import { SubLayer, ToggleSwitch } from './styles/LayerToggleStyles';

const FortStocktonRadiusToggle = ({ showFortStocktonRadius, setShowFortStocktonRadius }) => (
  <SubLayer style={{ marginBottom: 12 }}>
    <span>Fort Stockton 5mi Radius</span>
    <ToggleSwitch>
      <input
        type="checkbox"
        checked={showFortStocktonRadius}
        onChange={() => {
          const newState = !showFortStocktonRadius;
          console.log('Fort Stockton Radius Toggle:', { 
            previousState: showFortStocktonRadius, 
            newState: newState,
            timestamp: new Date().toISOString()
          });
          setShowFortStocktonRadius(newState);
        }}
      />
      <span></span>
    </ToggleSwitch>
  </SubLayer>
);

export default FortStocktonRadiusToggle; 