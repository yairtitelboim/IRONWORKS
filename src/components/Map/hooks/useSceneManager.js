import { useState, useEffect, useCallback, useRef } from 'react';
import crashMonitor from '../utils/crashMonitor';
import browserOptimizations from '../utils/browserOptimizations';

// Scene transition batching system to prevent browser crashes
const SceneTransitionBatcher = {
  queue: [],
  isProcessing: false,
  batchSize: 5, // Process 5 layer changes at a time
  batchDelay: 100, // 100ms between batches
  staggerDelay: 20, // 20ms stagger between layer changes
  
  configure(settings = {}) {
    if (settings.batchSize !== undefined) this.batchSize = settings.batchSize;
    if (settings.batchDelay !== undefined) this.batchDelay = settings.batchDelay;
    if (settings.staggerDelay !== undefined) this.staggerDelay = settings.staggerDelay;
    
    
  },
  
  add(transitionFn, priority = 0) {
    this.queue.push({ fn: transitionFn, priority, timestamp: Date.now() });
    this.process();
  },
  
  process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    // Execute batch with delays between each
    batch.forEach((item, index) => {
      setTimeout(() => {
        try {
          item.fn();
        } catch (error) {
          console.warn('Scene transition error:', error);
          crashMonitor.logEvent('SCENE_BATCH_ERROR', { error: error.message, stack: error.stack }, 'error');
        }
      }, index * this.staggerDelay);
    });
    
    // Process next batch after delay
    setTimeout(() => {
      this.isProcessing = false;
      this.process();
    }, this.batchDelay);
  },
  
  clear() {
    this.queue = [];
    this.isProcessing = false;
    crashMonitor.logEvent('SCENE_BATCH_CLEARED', { queueLength: this.queue.length });
  }
};

/**
 * Generic scene management hook that can be used by any map component
 * @param {Object} mapInstance - Mapbox map instance
 * @param {Object} layerState - Current layer visibility state
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - localStorage key for scenes
 * @param {Function} options.onLoadScene - Callback when scene is loaded
 * @param {Function} options.captureAdditionalState - Function to capture custom state
 * @param {Function} options.restoreAdditionalState - Function to restore custom state
 */
export const useSceneManager = (mapInstance, layerState, options = {}) => {
  const {
    storageKey = 'mapScenes',
    onLoadScene,
    captureAdditionalState,
    restoreAdditionalState
  } = options;

  const [scenes, setScenes] = useState(() => {
    const savedScenes = localStorage.getItem(storageKey);
    return savedScenes ? JSON.parse(savedScenes) : [];
  });

  const [status, setStatus] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Save scenes to localStorage whenever scenes change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(scenes));
  }, [scenes, storageKey]);

  useEffect(() => {
    // Configure SceneTransitionBatcher with browser-specific settings
    const settings = browserOptimizations.getSceneTransitionSettings();
    
    SceneTransitionBatcher.configure({
      batchSize: settings.batchSize,
      batchDelay: settings.batchDelay,
      staggerDelay: 20 // Keep stagger delay consistent
    });

    
    

    // Listen for memory pressure events
    const handleMemoryPressure = (event) => {
      const { severity } = event.detail;
      console.warn(`🎬 Scene manager detected memory pressure: ${severity}`);
      
      if (severity === 'critical') {
        // Clear all pending scene transitions
        SceneTransitionBatcher.clear();
        setIsPlaying(false);
        setStatus('');
        
        // Force cleanup
        browserOptimizations.forceGarbageCollection();
      }
    };
    
    window.addEventListener('memoryPressure', handleMemoryPressure);

    return () => {
      window.removeEventListener('memoryPressure', handleMemoryPressure);
    };
  }, []);

  // Capture current map camera state
  const captureCameraState = useCallback(() => {
    if (!mapInstance) return null;
    
    try {
      return {
        center: mapInstance.getCenter(),
        zoom: mapInstance.getZoom(),
        pitch: mapInstance.getPitch(),
        bearing: mapInstance.getBearing()
      };
    } catch (error) {
      console.warn('Could not capture camera state:', error);
      return null;
    }
  }, [mapInstance]);

  // Capture current layer states for Mapbox layers
  const captureMapLayerStates = useCallback(() => {
    if (!mapInstance) return {};
    
    const mapLayerStates = {};
    try {
      const style = mapInstance.getStyle();
      if (style && style.layers) {
        style.layers.forEach(layer => {
          try {
            const visibility = mapInstance.getLayoutProperty(layer.id, 'visibility');
            mapLayerStates[layer.id] = visibility !== 'none';
          } catch (error) {
            // Layer might not support visibility property
          }
        });
      }
    } catch (error) {
      console.warn('Could not capture map layer states:', error);
    }
    
    return mapLayerStates;
  }, [mapInstance]);

  // Capture a new scene
  const captureScene = useCallback((name) => {
    if (!name?.trim()) {
      setStatus('Scene name is required');
      return false;
    }

    try {
      setStatus('Capturing scene...');
      
      const sceneData = {
        id: Date.now().toString(),
        name: name.trim(),
        timestamp: new Date().toISOString(),
        layerState: { ...layerState },
        camera: captureCameraState(),
        mapLayerStates: captureMapLayerStates(),
        // Allow custom state capture
        customState: captureAdditionalState ? captureAdditionalState() : {}
      };

      // Debug: Log main-level Path states being captured in scene
      

      setScenes(prev => [...prev, sceneData]);
      setStatus(`Scene "${name}" captured successfully`);
      
      // Clear status after delay
      setTimeout(() => setStatus(''), 2000);
      return true;
    } catch (error) {
      console.error('Error capturing scene:', error);
      setStatus('Error capturing scene');
      setTimeout(() => setStatus(''), 2000);
      return false;
    }
  }, [layerState, captureCameraState, captureMapLayerStates, captureAdditionalState]);

  // Restore layer states to mapbox layers with batching
  const restoreMapLayerStates = useCallback((mapLayerStates) => {
    if (!mapInstance || !mapLayerStates) return;

    const layerCount = Object.keys(mapLayerStates).length;
    crashMonitor.logEvent('RESTORE_LAYER_STATES_START', { layerCount });

    // Clear any existing transitions
    SceneTransitionBatcher.clear();

    // Convert to array for batching
    const layerEntries = Object.entries(mapLayerStates);
    
    crashMonitor.logEvent('LAYER_BATCH_PROCESSING', {
      totalLayers: layerEntries.length,
      batchSize: SceneTransitionBatcher.batchSize,
      estimatedBatches: Math.ceil(layerEntries.length / SceneTransitionBatcher.batchSize)
    });
    
    // Process layers in batches
    for (let i = 0; i < layerEntries.length; i += SceneTransitionBatcher.batchSize) {
      const batch = layerEntries.slice(i, i + SceneTransitionBatcher.batchSize);
      
      SceneTransitionBatcher.add(() => {
        batch.forEach(([layerId, isVisible]) => {
          try {
            if (mapInstance.getLayer(layerId)) {
              crashMonitor.trackLayerOperation('setVisibility', layerId, { 
                isVisible,
                batchIndex: Math.floor(i / SceneTransitionBatcher.batchSize)
              });
              mapInstance.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
            } else {
              crashMonitor.trackLayerOperation('layerNotFound', layerId, { isVisible });
            }
          } catch (error) {
            console.warn(`Could not set visibility for layer ${layerId}:`, error);
            crashMonitor.logEvent('LAYER_VISIBILITY_ERROR', {
              layerId,
              isVisible,
              error: error.message,
              stack: error.stack
            }, 'error');
          }
        });
      }, i / SceneTransitionBatcher.batchSize); // Priority based on batch order
    }

    crashMonitor.logEvent('RESTORE_LAYER_STATES_COMPLETE', { layerCount });
  }, [mapInstance]);

  // Play/load a scene with improved error handling and batching
  const playScene = useCallback(async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {
      setStatus('Scene not found');
      crashMonitor.logEvent('SCENE_NOT_FOUND', { sceneId }, 'error');
      return false;
    }

    try {
      // Track scene transition start
      crashMonitor.trackSceneTransition(scene.name, 'start', {
        sceneId,
        layerCount: scene.layerState ? Object.keys(scene.layerState).length : 0,
        mapLayerCount: scene.mapLayerStates ? Object.keys(scene.mapLayerStates).length : 0,
        hasCamera: !!scene.camera
      });

      setIsPlaying(true);
      setStatus(`Loading scene "${scene.name}"...`);

      // Emit loading event for performance optimization
      if (window.mapEventBus?.emit) {
        window.mapEventBus.emit('scene:loading', { sceneName: scene.name });
      }

      // Add delay before starting transitions to let UI settle
      const settings = browserOptimizations.getSceneTransitionSettings();
      await new Promise(resolve => setTimeout(resolve, settings.initialDelay));

      crashMonitor.trackSceneTransition(scene.name, 'camera_start');
      
      // Restore camera position with browser-optimized duration
      if (mapInstance && scene.camera) {
        setStatus('Moving camera...');
        crashMonitor.trackSceneTransition(scene.name, 'camera');
        
        try {
          await new Promise((resolve, reject) => {
            mapInstance.easeTo({
              ...scene.camera,
              duration: settings.cameraEaseDuration
            });
            
            mapInstance.once('moveend', resolve);
            setTimeout(() => reject(new Error('Camera move timeout')), settings.cameraEaseDuration + 1000);
          });
        } catch (error) {
          console.warn('Camera restoration failed:', error);
          crashMonitor.trackSceneTransition(scene.name, 'camera_error', { error: error.message });
        }
      }

      // Restore map layer states with browser-optimized batching
      if (scene.mapLayerStates && Object.keys(scene.mapLayerStates).length > 0) {
        setStatus('Restoring layers...');
        crashMonitor.trackSceneTransition(scene.name, 'layers');
        
        try {
          await restoreMapLayerStates(scene.mapLayerStates, settings);
        } catch (error) {
          console.warn('Layer restoration failed:', error);
          crashMonitor.trackSceneTransition(scene.name, 'layers_error', { error: error.message });
        }
      }

      // Restore custom state
      if (restoreAdditionalState && scene.customState) {
        try {
          crashMonitor.trackSceneTransition(scene.name, 'custom_state_start');
          restoreAdditionalState(scene.customState);
          crashMonitor.trackSceneTransition(scene.name, 'custom_state_complete');
        } catch (error) {
          console.warn('Error restoring custom state:', error);
          crashMonitor.trackSceneTransition(scene.name, 'custom_state_error', {
            error: error.message,
            stack: error.stack
          });
        }
      }

      // Debug: Log main-level Path states being restored from scene
      

      // Notify parent component to restore UI layer states with delay
      if (onLoadScene && scene.layerState) {
        setTimeout(() => {
          try {
            crashMonitor.trackSceneTransition(scene.name, 'ui_layers_start', {
              uiLayerCount: Object.keys(scene.layerState).length
            });
            onLoadScene(scene.layerState);
            crashMonitor.trackSceneTransition(scene.name, 'ui_layers_complete');
          } catch (error) {
            console.error('🎬 Error calling onLoadScene:', error);
            crashMonitor.trackSceneTransition(scene.name, 'ui_layers_error', {
              error: error.message,
              stack: error.stack
            });
            // Continue execution to not break the scene loading entirely
          }
        }, 500); // Add 500ms delay before UI layer changes
      }

      setStatus(`Scene "${scene.name}" loaded`);
      
      // Emit loaded event with longer delay
      setTimeout(() => {
        if (window.mapEventBus?.emit) {
          window.mapEventBus.emit('scene:loaded', { sceneName: scene.name });
        }
        setIsPlaying(false);
        setStatus('');
        
        crashMonitor.trackSceneTransition(scene.name, 'complete', {
          totalDuration: Date.now() - crashMonitor.sceneTransitions.find(t => 
            t.sceneName === scene.name && !t.endTime
          )?.startTime
        });
      }, settings.finalDelay); // Increased from 1000ms

      return true;
    } catch (error) {
      console.error('Error loading scene:', error);
      crashMonitor.trackSceneTransition(scene.name, 'error', {
        error: error.message,
        stack: error.stack
      });
      setStatus('Error loading scene');
      setIsPlaying(false);
      setTimeout(() => setStatus(''), 2000);
      return false;
    }
  }, [scenes, mapInstance, restoreMapLayerStates, restoreAdditionalState, onLoadScene]);

  // Update an existing scene
  const updateScene = useCallback((sceneId, newData = {}) => {
    try {
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      if (sceneIndex === -1) {
        setStatus('Scene not found');
        return false;
      }

      const updatedScene = {
        ...scenes[sceneIndex],
        ...newData,
        timestamp: new Date().toISOString(),
        // Always update current states if not provided
        layerState: newData.layerState || { ...layerState },
        camera: newData.camera || captureCameraState(),
        mapLayerStates: newData.mapLayerStates || captureMapLayerStates(),
        customState: newData.customState || (captureAdditionalState ? captureAdditionalState() : {})
      };

      const updatedScenes = [...scenes];
      updatedScenes[sceneIndex] = updatedScene;
      setScenes(updatedScenes);
      
      setStatus(`Scene updated successfully`);
      setTimeout(() => setStatus(''), 2000);
      return true;
    } catch (error) {
      console.error('Error updating scene:', error);
      setStatus('Error updating scene');
      setTimeout(() => setStatus(''), 2000);
      return false;
    }
  }, [scenes, layerState, captureCameraState, captureMapLayerStates, captureAdditionalState]);

  // Delete a scene
  const deleteScene = useCallback((sceneId) => {
    try {
      const updatedScenes = scenes.filter(scene => scene.id !== sceneId);
      setScenes(updatedScenes);
      setStatus('Scene deleted');
      setTimeout(() => setStatus(''), 2000);
      return true;
    } catch (error) {
      console.error('Error deleting scene:', error);
      setStatus('Error deleting scene');
      setTimeout(() => setStatus(''), 2000);
      return false;
    }
  }, [scenes]);

  // Load scene by name (for AI/external control)
  const loadSceneByName = useCallback((sceneName) => {
    // Try exact match first
    let targetScene = scenes.find(s => s.name === sceneName);
    
    if (!targetScene) {
      // Try case-insensitive match
      targetScene = scenes.find(s => 
        s.name.toLowerCase() === sceneName.toLowerCase()
      );
    }
    
    if (!targetScene) {
      // Try substring match
      targetScene = scenes.find(s => 
        s.name.toLowerCase().includes(sceneName.toLowerCase())
      );
    }
    
    if (!targetScene) {
      // Try index-based loading
      const sceneIndex = parseInt(sceneName);
      if (!isNaN(sceneIndex) && sceneIndex >= 0 && sceneIndex < scenes.length) {
        targetScene = scenes[sceneIndex];
      }
    }
    
    return targetScene ? playScene(targetScene.id) : false;
  }, [scenes, playScene]);

  // Export scenes for sharing/backup
  const exportScenes = useCallback(() => {
    return JSON.stringify(scenes, null, 2);
  }, [scenes]);

  // Import scenes from JSON
  const importScenes = useCallback((scenesJson) => {
    try {
      const importedScenes = JSON.parse(scenesJson);
      if (Array.isArray(importedScenes)) {
        setScenes(importedScenes);
        setStatus('Scenes imported successfully');
        setTimeout(() => setStatus(''), 2000);
        return true;
      }
    } catch (error) {
      console.error('Error importing scenes:', error);
      setStatus('Error importing scenes');
      setTimeout(() => setStatus(''), 2000);
    }
    return false;
  }, []);

  // Cleanup function to clear pending transitions
  const cleanup = useCallback(() => {
    SceneTransitionBatcher.clear();
    setIsPlaying(false);
    setStatus('');
  }, []);

  return {
    // State
    scenes,
    status,
    isPlaying,
    
    // Actions
    captureScene,
    playScene,
    updateScene,
    deleteScene,
    loadSceneByName,
    
    // Utilities
    exportScenes,
    importScenes,
    cleanup,
    
    // Advanced
    captureCameraState,
    captureMapLayerStates,
    restoreMapLayerStates
  };
}; 