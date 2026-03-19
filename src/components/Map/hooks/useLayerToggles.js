import { useState, useEffect } from 'react';
import { COLORS, TRANSPORTATION_CATEGORIES, DEFAULT_EXPANDED_CATEGORIES } from '../constants/layerConstants';
// Remove OSM imports since LA data is no longer needed
import * as turf from '@turf/turf';

export const useLayerToggles = (map) => {
  // Remove OSM layer states since LA data is no longer needed
  // const [showOSMTransit, setShowOSMTransit] = useState(false);
  // const [showOSMBike, setShowOSMBike] = useState(false);
  // const [showOSMPedestrian, setShowOSMPedestrian] = useState(false);

  // Remove OSM-specific layer visibility states
  // const [showTransitStops, setShowTransitStops] = useState(false);
  // const [showTransitRoutes, setShowTransitRoutes] = useState(false);
  // const [showBikeLanes, setShowBikeLanes] = useState(false);
  // const [showBikePaths, setShowBikePaths] = useState(false);
  // const [showBikeParking, setShowBikeParking] = useState(false);
  // const [showPedestrianPaths, setShowPedestrianPaths] = useState(false);
  // const [showPedestrianCrossings, setShowPedestrianCrossings] = useState(false);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(DEFAULT_EXPANDED_CATEGORIES);
  const [is3DLoading, setIs3DLoading] = useState(false);

  // Keep track of modified layers
  const modifiedLayers = new Set();

  // Remove OSM data loading since LA data is no longer needed
  // useEffect(() => {
  //   if (map.current) {
  //     loadOSMData(map.current);
  //   }
  // }, [map]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleLayerCategory = (category, layerIds, color, newState) => {
    console.log(`\nToggling ${category} layers:`, layerIds);
    
    const layers = map.current.getStyle().layers;
    let foundAnyLayer = false;

    layerIds.forEach(baseId => {
      const matchingLayers = layers.filter(l => 
        l.id.toLowerCase().includes(baseId.toLowerCase())
      );
      
      matchingLayers.forEach(layer => {
        if (modifiedLayers.has(layer.id)) {
          return;
        }

        try {
          foundAnyLayer = true;
          
          if (layer.type === 'line') {
            const currentColor = map.current.getPaintProperty(layer.id, 'line-color');
            map.current.setPaintProperty(layer.id, 'line-width', newState ? 1 : 0.5);
            map.current.setPaintProperty(layer.id, 'line-color', newState ? color : COLORS.default);
          } else if (layer.type === 'symbol' && layer.id.includes('label')) {
            map.current.setPaintProperty(layer.id, 'text-color', newState ? color : '#666666');
            map.current.setPaintProperty(layer.id, 'text-halo-width', newState ? 2 : 1);
          }
          
          modifiedLayers.add(layer.id);
        } catch (error) {
          console.warn(`Failed to toggle layer ${layer.id}:`, error);
        }
      });
    });

    if (!foundAnyLayer) {
      console.log(`No layers found for ${category}`);
    }
  };

  const handleToggle = (category, layerIds, color, newState) => {
    modifiedLayers.clear();
    toggleLayerCategory(category, layerIds, color, newState);
  };

  // Remove OSM-specific toggle handlers since LA data is no longer needed
  // const handleOSMTransitToggle = (newState) => { ... };
  // const handleOSMBikeToggle = (newState) => { ... };
  // const handleOSMPedestrianToggle = (newState) => { ... };

  return {
    // Remove OSM-related return values
    // showOSMTransit,
    // showOSMBike,
    // showOSMPedestrian,
    // showTransitStops,
    // showTransitRoutes,
    // showBikeLanes,
    // showBikePaths,
    // showBikeParking,
    // showPedestrianPaths,
    // showPedestrianCrossings,
    searchTerm,
    expandedCategories,
    is3DLoading,
    setSearchTerm,
    // Remove OSM-related setters
    // setShowTransitStops,
    // setShowTransitRoutes,
    // setShowBikeLanes,
    // setShowBikePaths,
    // setShowBikeParking,
    // setShowPedestrianPaths,
    // setShowPedestrianCrossings,
    toggleCategory,
    handleToggle,
    // Remove OSM-related handlers
    // handleOSMTransitToggle,
    // handleOSMBikeToggle,
    // handleOSMPedestrianToggle,
    setIs3DLoading
  };
}; 