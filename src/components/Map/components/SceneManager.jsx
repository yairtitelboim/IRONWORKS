import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { osmLayerIds } from '../utils/osmLayers';

// New left sidebar styles
const SceneSidebar = styled.div`
  position: fixed;
  top: 0;
  left: ${props => props.$isOpen ? '0' : '-380px'};
  width: 360px;
  height: 100vh;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 999;
  overflow-y: auto;
  padding: 24px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.3);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.5);
    border-radius: 4px;
    &:hover {
      background: rgba(148, 163, 184, 0.7);
    }
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
`;

const SidebarTitle = styled.h2`
  color: white;
  margin: 0;
  font-size: 20px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  opacity: 0.8;
  transition: opacity 0.2s ease;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }
`;

const SceneList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SceneItem = styled.div`
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(148, 163, 184, 0.4);
  }
`;

const SceneName = styled.span`
  color: white;
  font-size: 14px;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SceneNameInput = styled.input`
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  padding: 4px 8px;
  color: white;
  font-size: 14px;
  width: 100%;
  margin-bottom: 4px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const SceneTimestamp = styled.div`
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
`;

const SceneActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.$delete ? '#ff4444' : props.$update ? '#4ade80' : 'white'};
  cursor: pointer;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

const SaveSceneForm = styled.form`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const SaveSceneInput = styled.input`
  flex: 1;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const SaveSceneButton = styled.button`
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;

  &:hover {
    background: #2563eb;
  }
`;

const SceneManager = ({ 
  map,
  layerStates,
  onLoadScene,
  onSaveScene,
  isOpen,
  onClose
}) => {
  const [scenes, setScenes] = useState(() => {
    const savedScenes = localStorage.getItem('mapScenes');
    return savedScenes ? JSON.parse(savedScenes) : [];
  });
  const [sceneName, setSceneName] = useState('');
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Expose SceneManager methods globally via window.mapComponent
  useEffect(() => {
    
    if (!window.mapComponent) {
      window.mapComponent = {};
    }
    
    // Expose a method to load a scene by directly providing the scene object
    window.mapComponent.loadScene = (scene) => {
      
      try {
        // Call the restoreLayerStates function
        restoreLayerStates(scene);
        
        // Update camera position if available
        if (map && scene.camera) {
          map.easeTo({
            center: [scene.camera.center.lng, scene.camera.center.lat],
            zoom: scene.camera.zoom,
            pitch: scene.camera.pitch,
            bearing: scene.camera.bearing,
            duration: 1500
          });
        }
        
        return true;
      } catch (error) {
        console.error('Error loading scene via global method:', error);
        return false;
      }
    };
    
    // Expose a method to find and load a scene by name
    window.mapComponent.loadSceneByName = (sceneName) => {
      
      try {
        // First try exact match (case-sensitive)
        let targetScene = scenes.find(s => s.name === sceneName);
        
        if (targetScene) {
          return window.mapComponent.loadScene(targetScene);
        }
        
        // Then try case-insensitive exact match
        targetScene = scenes.find(s => 
          s.name.toLowerCase() === sceneName.toLowerCase()
        );
        
        if (targetScene) {
          return window.mapComponent.loadScene(targetScene);
        }
        
        // Check if we're looking for a relative scene (next, previous)
        if (sceneName.toLowerCase() === 'next' || sceneName.toLowerCase() === 'prev' || sceneName.toLowerCase() === 'previous') {
          // We need to know what scene is currently loaded to find next/previous
          // For this example, we'll assume 'v1' is loaded if we can't determine current scene
          let currentSceneName = 'v1'; // Default assumption
          
          // Get scene names and find current index
          const sceneNames = scenes.map(s => s.name);
          
          const currentIndex = sceneNames.findIndex(name => 
            name.toLowerCase() === currentSceneName.toLowerCase()
          );
          
          if (currentIndex !== -1) {
            // Calculate target index
            let targetIndex;
            if (sceneName.toLowerCase() === 'next') {
              targetIndex = (currentIndex + 1) % scenes.length; // Wrap around to first scene if at the end
            } else {
              // Previous scene, handle wrapping to the end
              targetIndex = currentIndex > 0 ? currentIndex - 1 : scenes.length - 1;
            }
            
            targetScene = scenes[targetIndex];
            if (targetScene) {
              return window.mapComponent.loadScene(targetScene);
            }
          }
        }
        
        // If no exact match, try substring match
        targetScene = scenes.find(s => 
          s.name.toLowerCase().includes(sceneName.toLowerCase())
        );
        
        if (targetScene) {
          return window.mapComponent.loadScene(targetScene);
        }
        
        // If sceneName is a number, try to load scene by index
        const sceneIndex = parseInt(sceneName);
        if (!isNaN(sceneIndex) && sceneIndex >= 0 && sceneIndex < scenes.length) {
          targetScene = scenes[sceneIndex];
          return window.mapComponent.loadScene(targetScene);
        }
        
        // Special case for specific transitions we know about
        if (sceneName.toLowerCase() === 'solarpotential' || 
            sceneName.toLowerCase() === 'solar' || 
            sceneName.toLowerCase() === 'v2') {
          // Try looking for any scene with solar/energy in the name as fallback
          targetScene = scenes.find(s => 
            s.name.toLowerCase().includes('solar') || 
            s.name.toLowerCase().includes('energy') ||
            s.name.toLowerCase().includes('v2')
          );
          
          if (targetScene) {
            return window.mapComponent.loadScene(targetScene);
          }
          
          // If we're currently on v1, try to find v2 or v3
          const v1Index = scenes.findIndex(s => s.name.toLowerCase() === 'v1');
          if (v1Index !== -1 && v1Index + 1 < scenes.length) {
            targetScene = scenes[v1Index + 1];
            return window.mapComponent.loadScene(targetScene);
          }
        }
        
        // We couldn't find any matching scene
        console.warn('No scene found matching criteria:', sceneName);
        return false;
      } catch (error) {
        console.error('Error loading scene by name:', error);
        return false;
      }
    };
    
    return () => {
      // Keep the methods when unmounting to allow other components to use them
    };
  }, [map, scenes]); // Re-attach when map or scenes change

  const captureLayerStates = () => {
    
    // Capture actual map layer visibility states first
    const mapLayerStates = {};
    if (map) {
      // Get all OSM layer IDs
      const osmLayers = [
        'osm-transit-stops', 'osm-transit-routes',
        'osm-bike-lanes', 'osm-bike-paths', 'osm-bike-parking',
        'osm-pedestrian-paths', 'osm-pedestrian-crossings'
      ];

      // Get all map layers
      osmLayers.forEach(layerId => {
        try {
          if (map.getLayer(layerId)) {
            const visibility = map.getLayoutProperty(layerId, 'visibility');
            mapLayerStates[layerId] = visibility === 'visible';
          }
        } catch (error) {
          console.warn(`Could not get visibility for layer ${layerId}:`, error);
        }
      });
    }

    // Determine OSM states based on actual layer visibility
    const hasVisibleBikeLanes = mapLayerStates['osm-bike-lanes'] || false;
    const hasVisibleBikePaths = mapLayerStates['osm-bike-paths'] || false;
    const hasVisibleBikeParking = mapLayerStates['osm-bike-parking'] || false;
    const hasVisibleTransitStops = mapLayerStates['osm-transit-stops'] || false;
    const hasVisibleTransitRoutes = mapLayerStates['osm-transit-routes'] || false;
    const hasVisiblePedestrianPaths = mapLayerStates['osm-pedestrian-paths'] || false;
    const hasVisiblePedestrianCrossings = mapLayerStates['osm-pedestrian-crossings'] || false;

    // Infer parent toggle states from layer visibility
    const hasAnyVisibleBikeLayer = hasVisibleBikeLanes || hasVisibleBikePaths || hasVisibleBikeParking;
    const hasAnyVisibleTransitLayer = hasVisibleTransitStops || hasVisibleTransitRoutes;
    const hasAnyVisiblePedestrianLayer = hasVisiblePedestrianPaths || hasVisiblePedestrianCrossings;

    // Create toggle states based on actual layer visibility
    const toggleStates = {
      // Transportation Network
      showTransportation: layerStates.showTransportation || false,
      showRoads: layerStates.showRoads || false,
      
      // Public Transit
      showPublicTransit: layerStates.showPublicTransit || false,
      showOSMTransit: hasAnyVisibleTransitLayer,
      showTransitStops: hasVisibleTransitStops,
      showTransitRoutes: hasVisibleTransitRoutes,
      
      // Bike Network
      showBikeInfra: layerStates.showBikeInfra || hasAnyVisibleBikeLayer,
      showOSMBike: hasAnyVisibleBikeLayer,
      showBikeLanes: hasVisibleBikeLanes,
      showBikePaths: hasVisibleBikePaths,
      showBikeParking: hasVisibleBikeParking,
      
      // Pedestrian Network
      showPedestrian: layerStates.showPedestrian || hasAnyVisiblePedestrianLayer,
      showOSMPedestrian: hasAnyVisiblePedestrianLayer,
      showPedestrianPaths: hasVisiblePedestrianPaths,
      showPedestrianCrossings: hasVisiblePedestrianCrossings,
      
      // Other Layers
      showPlanningAnalysis: layerStates.showPlanningAnalysis || false,
      showAdaptiveReuse: layerStates.showAdaptiveReuse || false,
      showDevelopmentPotential: layerStates.showDevelopmentPotential || false,
      showNeighborhoodBoundaries: layerStates.showNeighborhoodBoundaries || false,
      showNeighborhoodLabels: layerStates.showNeighborhoodLabels || false,
      showPropertyPrices: layerStates.showPropertyPrices || false,
      
      // Parks Layer - Now independent of other layers
      showParks: layerStates.showParks || false,
      
      // Employment Layers
      showEmployment: layerStates.showEmployment || false,
      showEmploymentLabels: layerStates.showEmploymentLabels || false
    };

    // Create a cleaned up version of toggle states that respects parent-child relationships
    const cleanedToggleStates = {
      // Transportation Network
      showTransportation: toggleStates.showTransportation,
      showRoads: toggleStates.showTransportation && toggleStates.showRoads,
      
      // Public Transit
      showPublicTransit: toggleStates.showPublicTransit,
      showOSMTransit: toggleStates.showPublicTransit && toggleStates.showOSMTransit,
      showTransitStops: toggleStates.showPublicTransit && toggleStates.showOSMTransit && toggleStates.showTransitStops,
      showTransitRoutes: toggleStates.showPublicTransit && toggleStates.showOSMTransit && toggleStates.showTransitRoutes,
      
      // Bike Network
      showBikeInfra: toggleStates.showBikeInfra,
      showOSMBike: toggleStates.showBikeInfra && toggleStates.showOSMBike,
      showBikeLanes: toggleStates.showBikeInfra && toggleStates.showOSMBike && toggleStates.showBikeLanes,
      showBikePaths: toggleStates.showBikeInfra && toggleStates.showOSMBike && toggleStates.showBikePaths,
      showBikeParking: toggleStates.showBikeInfra && toggleStates.showOSMBike && toggleStates.showBikeParking,
      
      // Pedestrian Network
      showPedestrian: toggleStates.showPedestrian,
      showOSMPedestrian: toggleStates.showPedestrian && toggleStates.showOSMPedestrian,
      showPedestrianPaths: toggleStates.showPedestrian && toggleStates.showOSMPedestrian && toggleStates.showPedestrianPaths,
      showPedestrianCrossings: toggleStates.showPedestrian && toggleStates.showOSMPedestrian && toggleStates.showPedestrianCrossings,
      
      // Other Layers
      showPlanningAnalysis: toggleStates.showPlanningAnalysis,
      showAdaptiveReuse: toggleStates.showPlanningAnalysis && toggleStates.showAdaptiveReuse,
      showDevelopmentPotential: toggleStates.showPlanningAnalysis && toggleStates.showDevelopmentPotential,
      showNeighborhoodBoundaries: toggleStates.showNeighborhoodBoundaries,
      showNeighborhoodLabels: toggleStates.showNeighborhoodBoundaries && toggleStates.showNeighborhoodLabels,
      showPropertyPrices: toggleStates.showPropertyPrices,
      
      // Parks Layer - Now independent of other layers
      showParks: toggleStates.showParks,
      
      // Employment Layers
      showEmployment: toggleStates.showEmployment,
      showEmploymentLabels: toggleStates.showEmployment && toggleStates.showEmploymentLabels
    };

    return {
      toggleStates: cleanedToggleStates,
      mapLayerStates
    };
  };

  const handleSaveScene = (e) => {
    e.preventDefault();
    
    if (!sceneName.trim()) {
      console.warn('Scene name is required');
      return;
    }

    try {
      
      // Capture current layer states
      const { toggleStates, mapLayerStates } = captureLayerStates();

      // Capture camera state
      let cameraState = null;
      if (map) {
        try {
          cameraState = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing()
          };
        } catch (error) {
          console.warn('Could not get camera state:', error);
        }
      }

      const newScene = {
        id: Date.now(),
        name: sceneName,
        timestamp: new Date().toISOString(),
        toggleStates,
        mapLayerStates,
        camera: cameraState
      };

      const updatedScenes = [...scenes, newScene];
      setScenes(updatedScenes);
      localStorage.setItem('mapScenes', JSON.stringify(updatedScenes));
      setSceneName('');
    } catch (error) {
      console.error('Error saving scene:', error);
    }
  };

  const restoreLayerStates = (scene) => {
    
    if (!scene.toggleStates) {
      console.warn('Scene missing toggle states');
      return;
    }

    // First hide all OSM layers
    const hideAllOSMLayers = () => {
      if (!map) return;
      const osmLayers = [
        'osm-transit-stops', 'osm-transit-routes',
        'osm-bike-lanes', 'osm-bike-paths', 'osm-bike-parking',
        'osm-pedestrian-paths', 'osm-pedestrian-crossings'
      ];
      osmLayers.forEach(layerId => {
        try {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
          }
        } catch (error) {
          console.warn(`Could not hide layer ${layerId}:`, error);
        }
      });
    };

    hideAllOSMLayers();

    // Create a cleaned up version of toggle states that respects parent-child relationships
    const cleanedToggleStates = {
      // Transportation Network
      showTransportation: scene.toggleStates.showTransportation,
      showRoads: scene.toggleStates.showTransportation && scene.toggleStates.showRoads,
      
      // Public Transit
      showPublicTransit: scene.toggleStates.showPublicTransit,
      showOSMTransit: scene.toggleStates.showPublicTransit && scene.toggleStates.showOSMTransit,
      showTransitStops: scene.toggleStates.showPublicTransit && scene.toggleStates.showOSMTransit && scene.toggleStates.showTransitStops,
      showTransitRoutes: scene.toggleStates.showPublicTransit && scene.toggleStates.showOSMTransit && scene.toggleStates.showTransitRoutes,
      
      // Bike Network
      showBikeInfra: scene.toggleStates.showBikeInfra,
      showOSMBike: scene.toggleStates.showBikeInfra && scene.toggleStates.showOSMBike,
      showBikeLanes: scene.toggleStates.showBikeInfra && scene.toggleStates.showOSMBike && scene.toggleStates.showBikeLanes,
      showBikePaths: scene.toggleStates.showBikeInfra && scene.toggleStates.showOSMBike && scene.toggleStates.showBikePaths,
      showBikeParking: scene.toggleStates.showBikeInfra && scene.toggleStates.showOSMBike && scene.toggleStates.showBikeParking,
      
      // Pedestrian Network
      showPedestrian: scene.toggleStates.showPedestrian,
      showOSMPedestrian: scene.toggleStates.showPedestrian && scene.toggleStates.showOSMPedestrian,
      showPedestrianPaths: scene.toggleStates.showPedestrian && scene.toggleStates.showOSMPedestrian && scene.toggleStates.showPedestrianPaths,
      showPedestrianCrossings: scene.toggleStates.showPedestrian && scene.toggleStates.showOSMPedestrian && scene.toggleStates.showPedestrianCrossings,
      
      // Other Layers
      showPlanningAnalysis: scene.toggleStates.showPlanningAnalysis,
      showAdaptiveReuse: scene.toggleStates.showPlanningAnalysis && scene.toggleStates.showAdaptiveReuse,
      showDevelopmentPotential: scene.toggleStates.showPlanningAnalysis && scene.toggleStates.showDevelopmentPotential,
      showNeighborhoodBoundaries: scene.toggleStates.showNeighborhoodBoundaries,
      showNeighborhoodLabels: scene.toggleStates.showNeighborhoodBoundaries && scene.toggleStates.showNeighborhoodLabels,
      showPropertyPrices: scene.toggleStates.showPropertyPrices,
      
      // Parks Layer - Now independent of other layers
      showParks: scene.toggleStates.showParks,
      
      // Employment Layers
      showEmployment: scene.toggleStates.showEmployment,
      showEmploymentLabels: scene.toggleStates.showEmployment && scene.toggleStates.showEmploymentLabels
    };

    // Handle road network visibility
    if (map) {
      
      try {
        // Get road layer IDs from Mapbox style
        const roadLayers = ['road-simple', 'bridge-simple', 'tunnel-simple', 'road-label-simple'];
        const ROAD_COLOR = '#4A90E2'; // Light blue for roads
        
        // Get all map layers
        if (!map.getStyle) return;
        const style = map.getStyle();
        if (!style || !style.layers) return;
        const allLayers = style.layers;
        
        // Find and style any layer that matches our road layer patterns
        for (const layer of allLayers) {
          const layerId = layer.id;
          if (roadLayers.some(pattern => layerId.toLowerCase().includes(pattern.toLowerCase()))) {
            
            try {
              // Set visibility based on showRoads state
              map.setLayoutProperty(layerId, 'visibility', cleanedToggleStates.showRoads ? 'visible' : 'none');
              
              // Only style the layer if it's visible
              if (cleanedToggleStates.showRoads) {
                // Style line layers
                if (layer.type === 'line') {
                  map.setPaintProperty(layerId, 'line-width', 1);
                  map.setPaintProperty(layerId, 'line-color', ROAD_COLOR);
                } 
                // Style label layers
                else if (layer.type === 'symbol' && layerId.includes('label')) {
                  map.setPaintProperty(layerId, 'text-color', ROAD_COLOR);
                  map.setPaintProperty(layerId, 'text-halo-width', 2);
                }
              }
            } catch (error) {
              console.warn(`Could not handle road layer ${layerId}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error handling road network visibility:', error);
      }
    }

    // Special handling for park layers
    
    // Handle park layers visibility through a dedicated function call
    // This assumes there's a toggleParkLayers function accessible
    try {
      if (cleanedToggleStates.showParks) {
        
        // Handle park layer visibility
        const parkLayers = [
          'park', 'park-label', 'national-park', 'golf-course', 'pitch', 'grass'
        ];
        
        parkLayers.forEach(layerId => {
          if (map && map.getLayer(layerId)) {
            try {
              map.setLayoutProperty(layerId, 'visibility', 'visible');
              if (map.getPaintProperty(layerId, 'fill-color') !== undefined) {
                map.setPaintProperty(layerId, 'fill-color', '#2a9d2a');
                map.setPaintProperty(layerId, 'fill-opacity', 0.45);
              }
            } catch (error) {
              console.warn(`Could not style park layer ${layerId}:`, error);
            }
          }
        });
        
        // Handle natural layer if it exists
        if (map && map.getLayer('natural')) {
          try {
            if (!map._originalNaturalFilter) {
              map._originalNaturalFilter = map.getFilter('natural') || ['all'];
            }
            
            map.setFilter('natural', ['all', 
              map._originalNaturalFilter,
              ['any',
                ['==', ['get', 'class'], 'park'],
                ['==', ['get', 'class'], 'garden'],
                ['==', ['get', 'class'], 'forest'],
                ['==', ['get', 'class'], 'wood']
              ]
            ]);
            
            map.setLayoutProperty('natural', 'visibility', 'visible');
            map.setPaintProperty('natural', 'fill-color', '#2a9d2a');
            map.setPaintProperty('natural', 'fill-opacity', 0.45);
          } catch (error) {
            console.warn('Could not filter natural layer:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Error handling park layers:', error);
    }

    // Restore layer visibility based on the scene state
    if (map && scene.mapLayerStates) {
      Object.entries(scene.mapLayerStates).forEach(([layerId, isVisible]) => {
        try {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
          }
        } catch (error) {
          console.warn(`Could not set visibility for layer ${layerId}:`, error);
        }
      });
    }

    // Restore toggle states in the UI
    
    onLoadScene(cleanedToggleStates);
  };

  const handleSceneClick = (scene) => {
    
    // Emit an event that we're loading a scene to throttle animations
    if (window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
      window.mapEventBus.emit('scene:loading', { sceneName: scene.name });
    }
    
    try {
      // Restore layer states from scene
      restoreLayerStates(scene);
      
      // After restoration is complete, emit the loaded event
      setTimeout(() => {
        if (window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
          window.mapEventBus.emit('scene:loaded', { sceneName: scene.name });
        }
      }, 1000);
      
      // Close the panel
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error applying scene:', error);
      // Ensure we still emit the loaded event even if there's an error
      if (window.mapEventBus && typeof window.mapEventBus.emit === 'function') {
        window.mapEventBus.emit('scene:loaded', { error: true });
      }
    }
  };

  const handleUpdateScene = (e, sceneId) => {
    e.stopPropagation();
    try {
      
      // Find the scene to update
      const sceneToUpdate = scenes.find(scene => scene.id === sceneId);
      if (!sceneToUpdate) {
        console.error('Scene not found');
        return;
      }

      // Capture current layer states
      const { toggleStates, mapLayerStates } = captureLayerStates();

      // Capture camera state
      let cameraState = null;
      if (map) {
        try {
          cameraState = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing()
          };
        } catch (error) {
          console.warn('Could not get camera state:', error);
        }
      }

      // Create updated scene with same ID and name but new state
      const updatedScene = {
        ...sceneToUpdate,
        timestamp: new Date().toISOString(),
        toggleStates,
        mapLayerStates,
        camera: cameraState
      };

      // Update the scenes array
      const updatedScenes = scenes.map(scene => 
        scene.id === sceneId ? updatedScene : scene
      );
      
      setScenes(updatedScenes);
      localStorage.setItem('mapScenes', JSON.stringify(updatedScenes));
    } catch (error) {
      console.error('Error updating scene:', error);
    }
  };

  const handleDeleteScene = (e, sceneId) => {
    e.stopPropagation();
    try {
      
      const updatedScenes = scenes.filter(scene => scene.id !== sceneId);
      setScenes(updatedScenes);
      localStorage.setItem('mapScenes', JSON.stringify(updatedScenes));
    } catch (error) {
      console.error('Error deleting scene:', error);
    }
  };

  const handleEditName = (e, sceneId, currentName) => {
    e.stopPropagation();
    setEditingSceneId(sceneId);
    setEditingName(currentName);
  };

  const handleSaveName = (e, sceneId) => {
    e.stopPropagation();
    if (!editingName.trim()) return;

    try {
      
      const updatedScenes = scenes.map(scene => 
        scene.id === sceneId 
          ? { ...scene, name: editingName.trim() }
          : scene
      );
      
      setScenes(updatedScenes);
      localStorage.setItem('mapScenes', JSON.stringify(updatedScenes));
      setEditingSceneId(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating scene name:', error);
    }
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingSceneId(null);
    setEditingName('');
  };

  return (
    <SceneSidebar $isOpen={isOpen}>
      <SidebarHeader>
        <SidebarTitle>Saved Scenes</SidebarTitle>
        <CloseButton onClick={onClose} title="Close scenes panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
          </svg>
        </CloseButton>
      </SidebarHeader>

      <SaveSceneForm onSubmit={handleSaveScene}>
        <SaveSceneInput
          type="text"
          placeholder="Enter scene name..."
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
        />
        <SaveSceneButton type="submit">Save</SaveSceneButton>
      </SaveSceneForm>

      <SceneList>
        {scenes.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '20px 0' }}>
            No saved scenes yet. Save your current view to create a scene.
          </div>
        ) : (
          scenes.map(scene => (
            <SceneItem 
              key={scene.id}
              onClick={() => handleSceneClick(scene)}
            >
              <SceneName>
                {editingSceneId === scene.id ? (
                  <>
                    <SceneNameInput
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveName(e, scene.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit(e);
                        }
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={(e) => handleSaveName(e, scene.id)}
                        style={{
                          background: '#3b82f6',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          color: 'white',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          color: 'white',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {scene.name}
                      <button
                        onClick={(e) => handleEditName(e, scene.id, scene.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: '12px',
                          opacity: 0.7
                        }}
                        title="Edit scene name"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                    <SceneTimestamp>
                      {new Date(scene.timestamp).toLocaleString()}
                    </SceneTimestamp>
                  </>
                )}
              </SceneName>
              <SceneActions onClick={(e) => e.stopPropagation()}>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSceneClick(scene);
                  }}
                  title="Load scene"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </ActionButton>
                <ActionButton
                  $update
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateScene(e, scene.id);
                  }}
                  title="Update scene with current map state"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </ActionButton>
                <ActionButton
                  $delete
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteScene(e, scene.id);
                  }}
                  title="Delete scene"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </ActionButton>
              </SceneActions>
            </SceneItem>
          ))
        )}
      </SceneList>
    </SceneSidebar>
  );
};

export default SceneManager; 