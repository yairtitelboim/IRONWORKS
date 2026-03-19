import React, { useState, useEffect } from 'react';
import sceneBackupManager from '../../utils/sceneBackupManager';

const SceneBackupPanel = ({ isVisible = false, onClose }) => {
  const [sceneCount, setSceneCount] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(null);

  useEffect(() => {
    if (isVisible) {
      updateSceneCount();
    }
  }, [isVisible]);

  const updateSceneCount = () => {
    const count = sceneBackupManager.getSceneCount();
    setSceneCount(count);
  };

  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      await sceneBackupManager.createBackup();
      setLastBackupTime(new Date().toISOString());
      sceneBackupManager.showNotification('✅ Backup created and downloaded!', 'success');
    } catch (error) {
      console.error('Backup failed:', error);
      sceneBackupManager.showNotification('❌ Backup failed: ' + error.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = () => {
    try {
      setIsRestoring(true);
      sceneBackupManager.createFileInput();
    } catch (error) {
      console.error('Restore failed:', error);
      sceneBackupManager.showNotification('❌ Restore failed: ' + error.message, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleListScenes = () => {
    sceneBackupManager.listScenes();
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#1f1f1f',
      border: '1px solid #333333',
      borderRadius: '12px',
      padding: '24px',
      minWidth: '400px',
      maxWidth: '500px',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      fontFamily: 'Roboto, Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid #333333'
      }}>
        <h3 style={{
          margin: 0,
          color: '#ffffff',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          🎬 Scene Backup Manager
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666666',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.target.style.color = '#999999'}
          onMouseLeave={(e) => e.target.style.color = '#666666'}
        >
          ×
        </button>
      </div>

      {/* Scene Count */}
      <div style={{
        background: '#2a2a2a',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #333333'
      }}>
        <div style={{
          color: '#ffffff',
          fontSize: '14px',
          marginBottom: '4px'
        }}>
          Saved Scenes
        </div>
        <div style={{
          color: '#4caf50',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          {sceneCount} scenes
        </div>
        {lastBackupTime && (
          <div style={{
            color: '#999999',
            fontSize: '12px',
            marginTop: '4px'
          }}>
            Last backup: {new Date(lastBackupTime).toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Create Backup */}
        <button
          onClick={handleCreateBackup}
          disabled={isBackingUp || sceneCount === 0}
          style={{
            background: isBackingUp ? '#666666' : '#10b981',
            color: '#ffffff',
            border: 'none',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isBackingUp || sceneCount === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (!isBackingUp && sceneCount > 0) {
              e.target.style.background = '#059669';
            }
          }}
          onMouseLeave={(e) => {
            if (!isBackingUp && sceneCount > 0) {
              e.target.style.background = '#10b981';
            }
          }}
        >
          {isBackingUp ? '⏳ Creating...' : '💾 Create Backup'}
        </button>

        {/* Restore Backup */}
        <button
          onClick={handleRestoreBackup}
          disabled={isRestoring}
          style={{
            background: isRestoring ? '#666666' : '#3b82f6',
            color: '#ffffff',
            border: 'none',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isRestoring ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (!isRestoring) {
              e.target.style.background = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRestoring) {
              e.target.style.background = '#3b82f6';
            }
          }}
        >
          {isRestoring ? '⏳ Restoring...' : '📁 Restore Backup'}
        </button>

        {/* List Scenes */}
        <button
          onClick={handleListScenes}
          style={{
            background: '#6b7280',
            color: '#ffffff',
            border: 'none',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.target.style.background = '#4b5563'}
          onMouseLeave={(e) => e.target.style.background = '#6b7280'}
        >
          📋 List Scenes
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: '#2a2a2a',
        borderRadius: '8px',
        border: '1px solid #333333'
      }}>
        <div style={{
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px'
        }}>
          Instructions
        </div>
        <div style={{
          color: '#999999',
          fontSize: '12px',
          lineHeight: '1.4'
        }}>
          <div>• <strong>Create Backup:</strong> Downloads a JSON file with all saved scenes</div>
          <div>• <strong>Restore Backup:</strong> Upload a backup file to restore scenes</div>
          <div>• <strong>List Scenes:</strong> Shows all saved scenes in the console</div>
          <div style={{ marginTop: '8px', color: '#f59e0b' }}>
            💡 Tip: Back up your scenes before making major changes!
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneBackupPanel; 