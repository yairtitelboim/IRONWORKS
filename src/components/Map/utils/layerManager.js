// Robust layer management utility to prevent crashes
export class LayerManager {
  constructor(map) {
    this.map = map;
    this.pendingOperations = new Set();
  }

  // Safely check if a layer exists
  layerExists(layerId) {
    try {
      return this.map && this.map.getLayer && this.map.getLayer(layerId) !== undefined;
    } catch (error) {
      console.warn(`Error checking layer existence for ${layerId}:`, error);
      return false;
    }
  }

  // Safely check if a source exists
  sourceExists(sourceId) {
    try {
      return this.map && this.map.getSource && this.map.getSource(sourceId) !== undefined;
    } catch (error) {
      console.warn(`Error checking source existence for ${sourceId}:`, error);
      return false;
    }
  }

  // Safely remove a layer
  removeLayer(layerId) {
    if (!layerId) return false;
    
    try {
      if (this.layerExists(layerId)) {
        this.map.removeLayer(layerId);
        console.log(`✅ Removed layer: ${layerId}`);
        return true;
      }
    } catch (error) {
      console.warn(`❌ Error removing layer ${layerId}:`, error);
      return false;
    }
    return false;
  }

  // Safely remove a source
  removeSource(sourceId) {
    if (!sourceId) return false;
    
    try {
      if (this.sourceExists(sourceId)) {
        this.map.removeSource(sourceId);
        console.log(`✅ Removed source: ${sourceId}`);
        return true;
      }
    } catch (error) {
      console.warn(`❌ Error removing source ${sourceId}:`, error);
      return false;
    }
    return false;
  }

  // Safely remove layers and sources in correct order
  removeLayersAndSources(layerIds = [], sourceIds = []) {
    const operationId = `remove-${Date.now()}`;
    
    if (this.pendingOperations.has(operationId)) {
      console.warn('Duplicate removal operation detected, skipping');
      return;
    }
    
    this.pendingOperations.add(operationId);
    
    try {
      // First remove all layers
      layerIds.forEach(layerId => {
        if (layerId) {
          this.removeLayer(layerId);
        }
      });

      // Then remove sources (after a small delay to ensure layers are gone)
      setTimeout(() => {
        sourceIds.forEach(sourceId => {
          if (sourceId) {
            this.removeSource(sourceId);
          }
        });
        this.pendingOperations.delete(operationId);
      }, 50); // 50ms delay to ensure layers are removed first

    } catch (error) {
      console.error('Error in removeLayersAndSources:', error);
      this.pendingOperations.delete(operationId);
    }
  }

  // Safely move a layer
  moveLayer(layerId, beforeId = null) {
    if (!layerId) return false;
    
    try {
      if (this.layerExists(layerId)) {
        if (beforeId && this.layerExists(beforeId)) {
          this.map.moveLayer(layerId, beforeId);
        } else {
          this.map.moveLayer(layerId);
        }
        return true;
      } else {
        console.warn(`Cannot move layer ${layerId}: layer does not exist`);
        return false;
      }
    } catch (error) {
      console.warn(`❌ Error moving layer ${layerId}:`, error);
      return false;
    }
  }

  // Safely add a layer with error handling
  addLayer(layerConfig) {
    if (!layerConfig || !layerConfig.id) {
      console.warn('Invalid layer config provided');
      return false;
    }

    try {
      // Check if layer already exists
      if (this.layerExists(layerConfig.id)) {
        console.warn(`Layer ${layerConfig.id} already exists, removing first`);
        this.removeLayer(layerConfig.id);
      }

      this.map.addLayer(layerConfig);
      console.log(`✅ Added layer: ${layerConfig.id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error adding layer ${layerConfig.id}:`, error);
      return false;
    }
  }

  // Safely add a source with error handling
  addSource(sourceId, sourceConfig) {
    if (!sourceId || !sourceConfig) {
      console.warn('Invalid source config provided');
      return false;
    }

    try {
      // Check if source already exists
      if (this.sourceExists(sourceId)) {
        console.warn(`Source ${sourceId} already exists, removing first`);
        this.removeSource(sourceId);
      }

      this.map.addSource(sourceId, sourceConfig);
      console.log(`✅ Added source: ${sourceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error adding source ${sourceId}:`, error);
      return false;
    }
  }

  // Get all layers that use a specific source
  getLayersUsingSource(sourceId) {
    if (!this.map || !this.map.getStyle) return [];
    
    try {
      const style = this.map.getStyle();
      if (!style || !style.layers) return [];
      
      return style.layers
        .filter(layer => layer.source === sourceId)
        .map(layer => layer.id);
    } catch (error) {
      console.warn(`Error getting layers for source ${sourceId}:`, error);
      return [];
    }
  }

  // Safely remove a source and all its dependent layers
  removeSourceAndDependentLayers(sourceId) {
    if (!sourceId) return false;

    try {
      // First get all layers using this source
      const dependentLayers = this.getLayersUsingSource(sourceId);
      
      // Remove all dependent layers first
      dependentLayers.forEach(layerId => {
        this.removeLayer(layerId);
      });

      // Then remove the source
      setTimeout(() => {
        this.removeSource(sourceId);
      }, 50);

      return true;
    } catch (error) {
      console.error(`Error removing source and dependent layers for ${sourceId}:`, error);
      return false;
    }
  }

  // Clean up all pending operations
  cleanup() {
    this.pendingOperations.clear();
  }
}

// Create a singleton instance
let layerManagerInstance = null;

export const getLayerManager = (map) => {
  if (!layerManagerInstance || layerManagerInstance.map !== map) {
    layerManagerInstance = new LayerManager(map);
  }
  return layerManagerInstance;
};

export default LayerManager; 