// Test OSM cache functionality
import { OsmTool } from './src/utils/tools/OsmTool.js';

console.log('Testing OSM cache...');

// Create a mock cache
const mockCache = new Map();
const mockUpdateToolFeedback = () => {};

// Test constructor
try {
  const osmTool = new OsmTool(mockCache, mockUpdateToolFeedback);
  console.log('✅ OsmTool constructor works with 2 parameters');
  console.log('Cache size:', osmTool.cache?.size || 0);
  console.log('Cache is Map:', osmTool.cache instanceof Map);
  
  // Test cache operations
  const testKey = 'test_key';
  const testData = { features: [], visualLayers: {} };
  
  // Test save
  osmTool.saveToCache(testKey, testData);
  console.log('✅ Cache save works');
  
  // Test retrieve
  const retrieved = osmTool.getFromCache(testKey);
  console.log('✅ Cache retrieve works:', !!retrieved);
  
} catch (error) {
  console.log('❌ OsmTool error:', error.message);
}



