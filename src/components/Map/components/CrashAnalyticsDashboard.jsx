import React, { useState, useEffect } from 'react';
import crashMonitor from '../utils/crashMonitor';

const CrashAnalyticsDashboard = ({ isOpen, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Initial load
      setAnalytics(crashMonitor.getAnalytics());
      
      // Set up refresh interval
      const interval = setInterval(() => {
        setAnalytics(crashMonitor.getAnalytics());
      }, 2000); // Update every 2 seconds
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isOpen, refreshInterval]);

  const downloadCrashReport = () => {
    const report = crashMonitor.generateCrashReport('Manual download');
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crash-report-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    if (window.confirm('Are you sure you want to clear all monitoring data?')) {
      crashMonitor.events = [];
      crashMonitor.memorySnapshots = [];
      crashMonitor.performanceMetrics = [];
      crashMonitor.layerOperations = [];
      crashMonitor.sceneTransitions = [];
      setAnalytics(crashMonitor.getAnalytics());
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      width: 400,
      maxHeight: 'calc(100vh - 40px)',
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: 8,
      color: 'white',
      zIndex: 2000,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#2a2a2a'
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          🔍 Crash Analytics
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: 18,
            padding: 4
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16
      }}>
        {analytics && (
          <>
            {/* Summary */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#4caf50' }}>
                📊 Summary (Last 5 mins)
              </h4>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <div>Total Events: <strong>{analytics.summary.totalEvents}</strong></div>
                <div>Recent Events: <strong>{analytics.summary.recentEvents}</strong></div>
                <div style={{ color: '#ff4444' }}>
                  Errors: <strong>{analytics.summary.errorEvents}</strong>
                </div>
                <div style={{ color: '#ffa500' }}>
                  Warnings: <strong>{analytics.summary.warningEvents}</strong>
                </div>
                <div>Scene Transitions: <strong>{analytics.summary.sceneTransitions}</strong></div>
                <div>Layer Operations: <strong>{analytics.summary.layerOperations}</strong></div>
              </div>
            </div>

            {/* Memory Trend */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#4caf50' }}>
                🧠 Memory Usage
              </h4>
              <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                {analytics.memoryTrend.slice(-5).map((point, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: point.usagePercentage > 80 ? '#ff4444' : 
                           point.usagePercentage > 60 ? '#ffa500' : '#4caf50'
                  }}>
                    <span>{new Date(point.timestamp).toLocaleTimeString()}</span>
                    <span>{point.usagePercentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Trend */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#4caf50' }}>
                ⚡ Performance (FPS)
              </h4>
              <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                {analytics.performanceTrend.slice(-5).map((point, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: point.fps < 20 ? '#ff4444' : 
                           point.fps < 30 ? '#ffa500' : '#4caf50'
                  }}>
                    <span>{new Date(point.timestamp).toLocaleTimeString()}</span>
                    <span>{point.fps} FPS</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Problematic Patterns */}
            {analytics.problematicPatterns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#ff4444' }}>
                  🚨 Problematic Patterns
                </h4>
                {analytics.problematicPatterns.map((pattern, i) => (
                  <div key={i} style={{
                    background: '#2a1a1a',
                    border: '1px solid #ff4444',
                    borderRadius: 4,
                    padding: 8,
                    marginBottom: 8,
                    fontSize: 11
                  }}>
                    <div style={{ fontWeight: 600, color: '#ff4444' }}>
                      {pattern.type}
                    </div>
                    <div style={{ color: '#ccc', marginTop: 4 }}>
                      {pattern.description}
                    </div>
                    {pattern.count && (
                      <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                        Count: {pattern.count}
                      </div>
                    )}
                    {pattern.increase && (
                      <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                        Increase: {pattern.increase.toFixed(1)}%
                      </div>
                    )}
                    {pattern.averageFPS && (
                      <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                        Avg FPS: {pattern.averageFPS.toFixed(1)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Recent Scene Transitions */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#4caf50' }}>
                🎬 Recent Scene Transitions
              </h4>
              <div style={{ fontSize: 11, maxHeight: 150, overflowY: 'auto' }}>
                {crashMonitor.sceneTransitions.slice(-5).map((transition, i) => (
                  <div key={i} style={{
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: 6,
                    marginBottom: 4
                  }}>
                    <div style={{ fontWeight: 600 }}>
                      {transition.sceneName}
                    </div>
                    <div style={{ fontSize: 10, color: '#999' }}>
                      Duration: {transition.duration || 'In progress'}ms
                    </div>
                    <div style={{ fontSize: 10, color: '#999' }}>
                      Phases: {transition.phases.length}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Errors - NEW SECTION */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#ff4444' }}>
                🚨 Recent Errors (Last 10)
              </h4>
              <div style={{ fontSize: 10, maxHeight: 200, overflowY: 'auto' }}>
                {crashMonitor.events
                  .filter(event => event.level === 'error')
                  .slice(-10)
                  .map((event, i) => (
                    <div key={i} style={{
                      background: '#2a1a1a',
                      border: '1px solid #ff4444',
                      borderRadius: 4,
                      padding: 6,
                      marginBottom: 4
                    }}>
                      <div style={{ fontWeight: 600, color: '#ff4444' }}>
                        {event.type}
                      </div>
                      <div style={{ fontSize: 9, color: '#ccc', marginTop: 2 }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      {event.data.message && (
                        <div style={{ fontSize: 9, color: '#999', marginTop: 2, wordBreak: 'break-word' }}>
                          {event.data.message}
                        </div>
                      )}
                      {event.data.fullMessage && (
                        <div style={{ fontSize: 9, color: '#999', marginTop: 2, wordBreak: 'break-word' }}>
                          {event.data.fullMessage.substring(0, 100)}...
                        </div>
                      )}
                      {event.data.filename && (
                        <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>
                          {event.data.filename}:{event.data.lineno}
                        </div>
                      )}
                    </div>
                  ))}
                {crashMonitor.events.filter(event => event.level === 'error').length === 0 && (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    No errors logged yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{
        padding: 16,
        borderTop: '1px solid #333',
        display: 'flex',
        gap: 8
      }}>
        <button
          onClick={downloadCrashReport}
          style={{
            flex: 1,
            background: '#4caf50',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          📥 Download Report
        </button>
        <button
          onClick={clearData}
          style={{
            flex: 1,
            background: '#ff4444',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          🗑️ Clear Data
        </button>
      </div>
    </div>
  );
};

export default CrashAnalyticsDashboard; 