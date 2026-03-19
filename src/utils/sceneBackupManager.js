/**
 * Scene Backup Manager
 * Browser-based backup and restore functionality for saved scenes
 */

class SceneBackupManager {
  constructor() {
    this.backupVersion = '1.0.0';
    this.sceneKeys = [
      'transmissionScenes_v1',  // Main scenes storage key
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

  /**
   * Capture all saved scenes from localStorage
   */
  captureScenes() {
    console.log('🎬 Capturing scenes from localStorage...');
    
    const scenes = [];
    const allKeys = Object.keys(localStorage);
    
    // Filter for scene-related keys
    const sceneKeys = allKeys.filter(key => 
      this.sceneKeys.includes(key) ||
      key.startsWith('scene_') ||
      key.includes('scene')
    );
    
    sceneKeys.forEach(key => {
      try {
        const sceneData = localStorage.getItem(key);
        if (sceneData) {
          const scene = JSON.parse(sceneData);
          
          // Handle different storage formats
          if (key === 'transmissionScenes_v1' && Array.isArray(scene)) {
            // Scenes are stored as an array under a single key
            scene.forEach((individualScene, index) => {
              scenes.push({
                key: `scene_${index}`,
                scene: individualScene,
                capturedAt: new Date().toISOString()
              });
              console.log(`✅ Captured scene: scene_${index} - ${individualScene.name || 'Unnamed'}`);
            });
          } else {
            // Individual scene or other format
            scenes.push({
              key: key,
              scene: scene,
              capturedAt: new Date().toISOString()
            });
            console.log(`✅ Captured scene: ${key}`);
          }
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
  generateMetadata() {
    return {
      version: this.backupVersion,
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
   * Create and download backup file
   */
  createBackup() {
    try {
      console.log('🔄 Creating backup...');
      
      const scenes = this.captureScenes();
      const metadata = this.generateMetadata();
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
      
      console.log('✅ Backup created and downloaded!');
      console.log(`📊 Scenes captured: ${scenes.length}`);
      console.log(`📅 Timestamp: ${metadata.capturedAt}`);
      
      return backup;
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate backup file structure
   */
  validateBackup(backup) {
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
   * Restore scenes from backup to localStorage
   */
  restoreScenes(backup) {
    console.log('🔄 Starting scene restoration...');
    
    let restoredCount = 0;
    let failedCount = 0;
    
    // Group scenes by their original storage format
    const transmissionScenes = [];
    const individualScenes = [];
    
    backup.scenes.forEach((sceneData, index) => {
      try {
        const { key, scene } = sceneData;
        
        // Validate scene data
        if (!key || !scene) {
          console.warn(`⚠️ Invalid scene data at index ${index}`);
          failedCount++;
          return;
        }
        
        // Group scenes for different storage formats
        if (key.startsWith('scene_')) {
          transmissionScenes.push(scene);
        } else {
          individualScenes.push({ key, scene });
        }
        
      } catch (error) {
        console.error(`❌ Failed to process scene at index ${index}:`, error.message);
        failedCount++;
      }
    });
    
    // Restore transmission scenes as an array
    if (transmissionScenes.length > 0) {
      try {
        localStorage.setItem('transmissionScenes_v1', JSON.stringify(transmissionScenes));
        restoredCount += transmissionScenes.length;
        console.log(`✅ Restored ${transmissionScenes.length} transmission scenes`);
      } catch (error) {
        console.error('❌ Failed to restore transmission scenes:', error.message);
        failedCount += transmissionScenes.length;
      }
    }
    
    // Restore individual scenes
    individualScenes.forEach(({ key, scene }) => {
      try {
        localStorage.setItem(key, JSON.stringify(scene));
        restoredCount++;
        console.log(`✅ Restored individual scene: ${key}`);
      } catch (error) {
        console.error(`❌ Failed to restore scene ${key}:`, error.message);
        failedCount++;
      }
    });
    
    console.log(`📊 Restoration complete: ${restoredCount} restored, ${failedCount} failed`);
    
    // Trigger app refresh or scene reload
    if (restoredCount > 0) {
      console.log('🔄 Scenes restored! Refresh the app to see changes.');
      // Dispatch custom event to notify the app
      window.dispatchEvent(new CustomEvent('scenesRestored', { 
        detail: { restoredCount, failedCount } 
      }));
    }
    
    return { restoredCount, failedCount };
  }

  /**
   * Restore from file input
   */
  restoreFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const backup = JSON.parse(event.target.result);
          this.validateBackup(backup);
          const result = this.restoreScenes(backup);
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
   * Create a file input for restoration
   */
  createFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this.restoreFromFile(file)
          .then(result => {
            console.log('✅ Restoration completed:', result);
            // Show success message
            this.showNotification('✅ Scenes restored successfully!', 'success');
          })
          .catch(error => {
            console.error('❌ Restoration failed:', error.message);
            // Show error message
            this.showNotification('❌ Restoration failed: ' + error.message, 'error');
          });
      }
    });
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      ${type === 'success' ? 'background: #10b981;' : ''}
      ${type === 'error' ? 'background: #ef4444;' : ''}
      ${type === 'info' ? 'background: #3b82f6;' : ''}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Get current scene count
   */
  getSceneCount() {
    const scenes = this.captureScenes();
    return scenes.length;
  }

  /**
   * List all saved scenes
   */
  listScenes() {
    const scenes = this.captureScenes();
    console.log('📋 Saved scenes:');
    scenes.forEach((sceneData, index) => {
      console.log(`${index + 1}. ${sceneData.key} - ${sceneData.scene.name || 'Unnamed'}`);
    });
    return scenes;
  }
}

// Create singleton instance
const sceneBackupManager = new SceneBackupManager();

// Export for use in React components
export default sceneBackupManager;

// Also attach to window for console access
if (typeof window !== 'undefined') {
  window.SceneBackupManager = sceneBackupManager;
} 