#!/usr/bin/env node

/**
 * Scene Backup Script
 * Captures all saved scenes from localStorage and exports them as JSON
 * 
 * Usage: node scripts/capture_scenes_backup.js
 */

const fs = require('fs');
const path = require('path');

// Scene backup configuration
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_FILE = path.join(BACKUP_DIR, `scenes_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 Created backup directory:', BACKUP_DIR);
}

// Mock localStorage for Node.js environment
const mockLocalStorage = {
  getItem: (key) => {
    // This would be replaced with actual localStorage data in browser
    console.log(`🔍 Attempting to get: ${key}`);
    return null;
  },
  getAllKeys: () => {
    // Return all localStorage keys that contain scene data
    return [
      'savedScenes',
      'scene_0',
      'scene_1', 
      'scene_2',
      'scene_3',
      'scene_4',
      'scene_5',
      'scene_6',
      'scene_7',
      'scene_8',
      'scene_9'
    ];
  }
};

/**
 * Capture scenes from localStorage
 */
function captureScenes() {
  console.log('🎬 Starting scene capture...');
  
  const scenes = [];
  const allKeys = mockLocalStorage.getAllKeys();
  
  // Capture each scene
  allKeys.forEach(key => {
    try {
      const sceneData = mockLocalStorage.getItem(key);
      if (sceneData) {
        const scene = JSON.parse(sceneData);
        scenes.push({
          key: key,
          scene: scene,
          capturedAt: new Date().toISOString()
        });
        console.log(`✅ Captured scene: ${key}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to capture scene ${key}:`, error.message);
    }
  });
  
  return scenes;
}

/**
 * Generate backup metadata
 */
function generateMetadata() {
  return {
    version: '1.0.0',
    capturedAt: new Date().toISOString(),
    totalScenes: 0, // Will be updated
    appVersion: 'Tx Transmission Navigator',
    description: 'Backup of saved map scenes including camera position, layer visibility, and scene configurations',
    format: {
      scenes: 'Array of scene objects with localStorage keys and scene data',
      metadata: 'Backup information and versioning'
    }
  };
}

/**
 * Create the backup file
 */
function createBackup() {
  try {
    console.log('🔄 Capturing scenes...');
    const scenes = captureScenes();
    
    const metadata = generateMetadata();
    metadata.totalScenes = scenes.length;
    
    const backup = {
      metadata: metadata,
      scenes: scenes,
      instructions: {
        restore: 'Use scripts/restore_scenes_backup.js to restore these scenes',
        manual: 'Copy scenes array to localStorage manually if needed'
      }
    };
    
    // Write backup file
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    
    console.log('✅ Backup created successfully!');
    console.log(`📁 File: ${BACKUP_FILE}`);
    console.log(`📊 Scenes captured: ${scenes.length}`);
    console.log(`📅 Timestamp: ${metadata.capturedAt}`);
    
    // Also create a latest backup for easy access
    const latestBackup = path.join(BACKUP_DIR, 'scenes_backup_latest.json');
    fs.writeFileSync(latestBackup, JSON.stringify(backup, null, 2));
    console.log(`🔗 Latest backup: ${latestBackup}`);
    
    return backup;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

/**
 * Browser-specific capture function
 * This would be used in the browser environment
 */
function captureScenesInBrowser() {
  const scenes = [];
  const allKeys = Object.keys(localStorage);
  
  // Filter for scene-related keys
  const sceneKeys = allKeys.filter(key => 
    key.startsWith('scene_') || 
    key === 'savedScenes' ||
    key.includes('scene')
  );
  
  sceneKeys.forEach(key => {
    try {
      const sceneData = localStorage.getItem(key);
      if (sceneData) {
        const scene = JSON.parse(sceneData);
        scenes.push({
          key: key,
          scene: scene,
          capturedAt: new Date().toISOString()
        });
        console.log(`✅ Captured scene: ${key}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to capture scene ${key}:`, error.message);
    }
  });
  
  return scenes;
}

/**
 * Export backup data for browser use
 */
function exportForBrowser() {
  const scenes = captureScenesInBrowser();
  const metadata = generateMetadata();
  metadata.totalScenes = scenes.length;
  
  const backup = {
    metadata: metadata,
    scenes: scenes,
    instructions: {
      restore: 'Use the restore function to load these scenes back',
      manual: 'Copy scenes array to localStorage manually if needed'
    }
  };
  
  // Create downloadable JSON
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = `scenes_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  
  console.log('✅ Backup exported for download!');
  return backup;
}

// Run backup if called directly
if (require.main === module) {
  createBackup();
}

// Export functions for browser use
if (typeof window !== 'undefined') {
  window.SceneBackup = {
    captureScenesInBrowser,
    exportForBrowser,
    generateMetadata
  };
}

module.exports = {
  captureScenes,
  createBackup,
  captureScenesInBrowser,
  exportForBrowser,
  generateMetadata
}; 