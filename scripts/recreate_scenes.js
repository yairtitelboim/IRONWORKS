#!/usr/bin/env node

/**
 * Scene Restoration Script for AI Transmission Navigator
 * 
 * This script provides utilities and examples for restoring scene data.
 * Use the browser console code below to restore scenes.
 */

// Configuration - Update these to match your application
const STORAGE_KEY = 'transmissionScenes';

/**
 * Example scenes data - Replace with your actual backup data
 */
const EXAMPLE_SCENES = [
  {
    "id": "1234567890123",
    "name": "Texas Overview",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "camera": {
      "center": { "lng": -99.0, "lat": 31.0 },
      "zoom": 6.5,
      "pitch": 0,
      "bearing": 0
    },
    "layerState": {
      "transmission": true,
      "generation": true,
      "demand": false,
      "water": false,
      "environmental": false
    },
    "mapLayerStates": {
      "transmission-lines": true,
      "generation-points": true,
      "demand-centers": false
    },
    "customState": {}
  },
  {
    "id": "1234567890124",
    "name": "West Texas Generation",
    "timestamp": "2024-01-01T12:05:00.000Z",
    "camera": {
      "center": { "lng": -102.0, "lat": 32.0 },
      "zoom": 8.0,
      "pitch": 30,
      "bearing": 45
    },
    "layerState": {
      "transmission": true,
      "generation": true,
      "demand": true,
      "water": true,
      "environmental": false
    },
    "mapLayerStates": {
      "transmission-lines": true,
      "generation-points": true,
      "wind-farms": true,
      "solar-farms": true
    },
    "customState": {}
  }
];

/**
 * Browser Console Restoration Code
 * 
 * Copy and paste this code into your browser's developer console
 * to restore scenes from backup data.
 */
function generateBrowserRestoreCode(scenes, storageKey = STORAGE_KEY) {
  return `
// AI Transmission Navigator - Scene Restoration
// ============================================
// Copy and paste this entire block into your browser console

console.log('🎬 Starting scene restoration...');

// Your backup scene data
const BACKUP_SCENES = ${JSON.stringify(scenes, null, 2)};

// Validation function
function validateScenes(scenes) {
  if (!Array.isArray(scenes)) {
    throw new Error('Scenes data must be an array');
  }
  
  scenes.forEach((scene, index) => {
    if (!scene.id || !scene.name) {
      throw new Error(\`Scene \${index} missing required fields (id, name)\`);
    }
    if (!scene.camera || !scene.layerState) {
      console.warn(\`Scene "\${scene.name}" missing camera or layerState data\`);
    }
  });
  
  return true;
}

// Restore function
function restoreScenes() {
  try {
    // Validate backup data
    validateScenes(BACKUP_SCENES);
    
    // Clear existing scenes
    localStorage.removeItem('${storageKey}');
    
    // Restore backup scenes
    localStorage.setItem('${storageKey}', JSON.stringify(BACKUP_SCENES));
    
    console.log(\`✅ Successfully restored \${BACKUP_SCENES.length} scenes\`);
    console.log('📋 Restored scenes:');
    BACKUP_SCENES.forEach((scene, index) => {
      console.log(\`  \${index + 1}. "\${scene.name}" (ID: \${scene.id})\`);
    });
    
    // Refresh page to load restored scenes
    console.log('🔄 Refreshing page to load restored scenes...');
    setTimeout(() => {
      location.reload();
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('❌ Error restoring scenes:', error);
    return false;
  }
}

// Execute restoration
restoreScenes();
`;
}

/**
 * Generate programmatic restoration code for integration
 */
function generateProgrammaticRestoreCode(scenes) {
  return `
// Programmatic Scene Restoration
// =============================
// Use this code in your application to restore scenes programmatically

const restoreScenes = async (scenes, mapInstance, setLayerVisibility) => {
  for (const scene of scenes) {
    console.log(\`Restoring scene: \${scene.name}\`);
    
    // Apply camera position
    if (scene.camera && mapInstance) {
      await new Promise((resolve) => {
        mapInstance.easeTo({
          center: [scene.camera.center.lng, scene.camera.center.lat],
          zoom: scene.camera.zoom,
          pitch: scene.camera.pitch,
          bearing: scene.camera.bearing,
          duration: 2000
        });
        
        mapInstance.once('moveend', resolve);
      });
    }
    
    // Apply layer visibility
    if (scene.layerState && setLayerVisibility) {
      setLayerVisibility(scene.layerState);
    }
    
    // Apply map layer states
    if (scene.mapLayerStates && mapInstance) {
      Object.entries(scene.mapLayerStates).forEach(([layerId, isVisible]) => {
        try {
          if (mapInstance.getLayer(layerId)) {
            mapInstance.setLayoutProperty(
              layerId, 
              'visibility', 
              isVisible ? 'visible' : 'none'
            );
          }
        } catch (error) {
          console.warn(\`Could not set visibility for layer \${layerId}:\`, error);
        }
      });
    }
    
    // Wait between scene applications
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};

// Usage example:
// restoreScenes(BACKUP_SCENES, mapInstance, setLayerVisibility);
`;
}

/**
 * Main function to generate restoration files
 */
function generateRestorationFiles() {
  const fs = require('fs');
  const path = require('path');
  
  const backupDir = './backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // Generate browser console restoration code
  const browserCode = generateBrowserRestoreCode(EXAMPLE_SCENES);
  fs.writeFileSync(
    path.join(backupDir, 'browser_restore.js'), 
    browserCode
  );
  
  // Generate programmatic restoration code
  const programmaticCode = generateProgrammaticRestoreCode(EXAMPLE_SCENES);
  fs.writeFileSync(
    path.join(backupDir, 'programmatic_restore.js'), 
    programmaticCode
  );
  
  // Generate restoration instructions
  const instructions = \`# Scene Restoration Instructions

## Method 1: Browser Console (Recommended)

1. Open your application in the browser
2. Open Developer Tools (F12) → Console tab
3. Copy and paste the code from \`browser_restore.js\`
4. Press Enter to execute
5. Page will automatically refresh with restored scenes

## Method 2: Programmatic Integration

1. Use the code from \`programmatic_restore.js\`
2. Integrate into your application's scene management system
3. Call with your map instance and layer state setter

## Method 3: Manual Recreation

1. Use the scene data below to manually recreate each scene
2. Navigate to each camera position
3. Toggle layers according to the layer states

## Scene Data
\${JSON.stringify(EXAMPLE_SCENES, null, 2)}

## Notes
- Update STORAGE_KEY in scripts to match your application
- Replace EXAMPLE_SCENES with your actual backup data
- Test restoration in development environment first
\`;
  
  fs.writeFileSync(
    path.join(backupDir, 'RESTORATION_INSTRUCTIONS.md'), 
    instructions
  );
  
  console.log('📁 Generated restoration files:');
  console.log('  - backups/browser_restore.js');
  console.log('  - backups/programmatic_restore.js');
  console.log('  - backups/RESTORATION_INSTRUCTIONS.md');
}

// Run if called directly
if (require.main === module) {
  try {
    generateRestorationFiles();
    console.log('✅ Scene restoration files generated successfully');
    console.log('');
    console.log('🔄 To restore scenes:');
    console.log('1. Update EXAMPLE_SCENES with your actual backup data');
    console.log('2. Use browser_restore.js in browser console');
    console.log('3. Or integrate programmatic_restore.js into your app');
  } catch (error) {
    console.error('❌ Error generating restoration files:', error);
    process.exit(1);
  }
}

module.exports = {
  generateBrowserRestoreCode,
  generateProgrammaticRestoreCode,
  generateRestorationFiles,
  EXAMPLE_SCENES
};