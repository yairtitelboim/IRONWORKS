// LayerManager utility extracted from index.jsx
const LayerManager = (() => {
  const loadedLayers = new Set();
  const layerLoadTimes = {};
  const pendingLayers = [];
  const layerTypes = {};
  let processingQueue = false;
  
  // Process the layer queue gradually to avoid overwhelming the GPU
  const processLayerQueue = () => {
    if (pendingLayers.length === 0 || processingQueue || !window.mapboxglMap) {
      return;
    }
    
    processingQueue = true;
    
    // Process just a few layers at a time
    const batchSize = 2;
    const layersToProcess = pendingLayers.splice(0, batchSize);
    
    layersToProcess.forEach(({ layerId, setupFunction, type }) => {
      const startTime = performance.now();
      
      try {
        setupFunction();
        loadedLayers.add(layerId);
        layerTypes[layerId] = type;
        const loadTime = performance.now() - startTime;
        layerLoadTimes[layerId] = loadTime;
      } catch (error) {
        // Optionally handle error
      }
    });
    
    processingQueue = false;
    
    if (pendingLayers.length > 0) {
      setTimeout(processLayerQueue, 100);
    }
  };
  
  return {
    queueLayer: (layerId, setupFunction, type = 'unknown') => {
      if (loadedLayers.has(layerId)) {
        return;
      }
      pendingLayers.push({ layerId, setupFunction, type });
      if (!processingQueue) {
        processLayerQueue();
      }
    },
    removeLayer: (layerId) => {
      if (!window.mapboxglMap || !loadedLayers.has(layerId)) {
        return;
      }
      try {
        if (window.mapboxglMap.getLayer(layerId)) {
          window.mapboxglMap.removeLayer(layerId);
        }
        if (window.mapboxglMap.getSource(layerId)) {
          window.mapboxglMap.removeSource(layerId);
        }
        loadedLayers.delete(layerId);
      } catch (error) {
        // Optionally handle error
      }
    },
    getLayerStats: () => {
      return {
        totalLayers: loadedLayers.size,
        loadedLayers: Array.from(loadedLayers),
        pendingLayers: pendingLayers.map(l => l.layerId),
        layerLoadTimes,
        layerTypeBreakdown: Object.entries(
          Array.from(loadedLayers).reduce((acc, layerId) => {
            const type = layerTypes[layerId] || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})
        )
      };
    }
  };
})();

export default LayerManager; 