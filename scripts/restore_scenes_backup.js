#!/usr/bin/env node

/**
 * Scene Restore Script
 * Restores saved scenes from JSON backup to localStorage
 * 
 * Usage: node scripts/restore_scenes_backup.js [backup_file]
 */

const fs = require('fs');
const path = require('path');

// Default backup file
const DEFAULT_BACKUP = path.join(__dirname, 'backups', 'scenes_backup_latest.json');

/**
 * Validate backup file structure
 */
function validateBackup(backup) {
  if (!backup.metadata || !backup.scenes) {
    throw new Error('Invalid backup format: missing metadata or scenes');
  }
  
  if (!Array.isArray(backup.scenes)) {
    throw new Error('Invalid backup format: scenes must be an array');
  }
  
  console.log('✅ Backup validation passed');
  console.log(`📊 Scenes to restore: ${backup.scenes.length}`);
  console.log(`📅 Backup created: ${backup.metadata.capturedAt}`);
  
  return true;
}

/**
 * Mock localStorage for Node.js environment
 */
const mockLocalStorage = {
  setItem: (key, value) => {
    console.log(`💾 Would set localStorage[${key}] = ${value.substring(0, 100)}...`);
  },
  getItem: (key) => {
    console.log(`🔍 Would get localStorage[${key}]`);
    return null;
  },
  removeItem: (key) => {
    console.log(`🗑️ Would remove localStorage[${key}]`);
  }
};

/**
 * Restore scenes to localStorage
 */
function restoreScenes(backup, localStorage = mockLocalStorage) {
  console.log('🔄 Starting scene restoration...');
  
  let restoredCount = 0;
  let failedCount = 0;
  
  backup.scenes.forEach((sceneData, index) => {
    try {
      const { key, scene } = sceneData;
      
      // Validate scene data
      if (!key || !scene) {
        console.warn(`⚠️ Invalid scene data at index ${index}`);
        failedCount++;
        return;
      }
      
      // Store scene in localStorage
      localStorage.setItem(key, JSON.stringify(scene));
      restoredCount++;
      
      console.log(`✅ Restored scene: ${key}`);
      
    } catch (error) {
      console.error(`❌ Failed to restore scene at index ${index}:`, error.message);
      failedCount++;
    }
  });
  
  console.log(`📊 Restoration complete: ${restoredCount} restored, ${failedCount} failed`);
  return { restoredCount, failedCount };
}

/**
 * Browser-specific restore function
 */
function restoreScenesInBrowser(backup) {
  console.log('🔄 Starting scene restoration in browser...');
  
  let restoredCount = 0;
  let failedCount = 0;
  
  backup.scenes.forEach((sceneData, index) => {
    try {
      const { key, scene } = sceneData;
      
      // Validate scene data
      if (!key || !scene) {
        console.warn(`⚠️ Invalid scene data at index ${index}`);
        failedCount++;
        return;
      }
      
      // Store scene in localStorage
      localStorage.setItem(key, JSON.stringify(scene));
      restoredCount++;
      
      console.log(`✅ Restored scene: ${key}`);
      
    } catch (error) {
      console.error(`❌ Failed to restore scene at index ${index}:`, error.message);
      failedCount++;
    }
  });
  
  console.log(`📊 Restoration complete: ${restoredCount} restored, ${failedCount} failed`);
  
  // Trigger app refresh or scene reload
  if (restoredCount > 0) {
    console.log('🔄 Scenes restored! Refresh the app to see changes.');
    // You could trigger a custom event here to notify the app
    window.dispatchEvent(new CustomEvent('scenesRestored', { 
      detail: { restoredCount, failedCount } 
    }));
  }
  
  return { restoredCount, failedCount };
}

/**
 * Load backup file
 */
function loadBackupFile(filePath) {
  try {
    console.log(`📁 Loading backup file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }
    
    const backupData = fs.readFileSync(filePath, 'utf8');
    const backup = JSON.parse(backupData);
    
    console.log('✅ Backup file loaded successfully');
    return backup;
    
  } catch (error) {
    console.error('❌ Failed to load backup file:', error.message);
    process.exit(1);
  }
}

/**
 * Main restore function
 */
function restoreFromFile(filePath = DEFAULT_BACKUP) {
  try {
    console.log('🎬 Scene Restore Script');
    console.log('========================');
    
    // Load backup file
    const backup = loadBackupFile(filePath);
    
    // Validate backup
    validateBackup(backup);
    
    // Restore scenes
    const result = restoreScenes(backup);
    
    console.log('✅ Restoration completed successfully!');
    console.log(`📊 Results: ${result.restoredCount} restored, ${result.failedCount} failed`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Restoration failed:', error.message);
    process.exit(1);
  }
}

/**
 * Browser function to restore from file input
 */
function restoreFromFileInput(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        validateBackup(backup);
        const result = restoreScenesInBrowser(backup);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read backup file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Create a file input for browser restoration
 */
function createFileInput() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  
  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      restoreFromFileInput(file)
        .then(result => {
          console.log('✅ Restoration completed:', result);
        })
        .catch(error => {
          console.error('❌ Restoration failed:', error.message);
        });
    }
  });
  
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// Run restore if called directly
if (require.main === module) {
  const backupFile = process.argv[2] || DEFAULT_BACKUP;
  restoreFromFile(backupFile);
}

// Export functions for browser use
if (typeof window !== 'undefined') {
  window.SceneRestore = {
    restoreScenesInBrowser,
    restoreFromFileInput,
    createFileInput
  };
}

module.exports = {
  restoreScenes,
  restoreFromFile,
  restoreScenesInBrowser,
  restoreFromFileInput,
  createFileInput,
  validateBackup
}; 