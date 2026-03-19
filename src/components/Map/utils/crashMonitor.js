// Comprehensive crash monitoring system for scene transitions
class CrashMonitor {
  constructor() {
    this.events = [];
    this.maxEvents = 1000; // Keep last 1000 events
    this.memorySnapshots = [];
    this.performanceMetrics = [];
    this.layerOperations = [];
    this.sceneTransitions = [];
    this.isMonitoring = false;
    
    // Performance thresholds
    this.thresholds = {
      memoryUsage: 100 * 1024 * 1024, // 100MB
      heapUsed: 80 * 1024 * 1024, // 80MB
      fps: 20, // Minimum FPS
      layerOperationsPerSecond: 50, // Max layer ops per second
      sceneTransitionTime: 5000 // Max 5 seconds per transition
    };
    
    this.init();
  }
  
  init() {
    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor performance
    this.startPerformanceMonitoring();
    
    // Monitor unhandled errors
    this.setupErrorHandling();
    
    // Monitor DOM mutations (can indicate excessive layer operations)
    this.setupDOMMutationObserver();
    
    
  }
  
  startMemoryMonitoring() {
    if (!performance.memory) {
      console.warn('Memory monitoring not available in this browser');
      return;
    }
    
    setInterval(() => {
      const memory = performance.memory;
      const snapshot = {
        timestamp: Date.now(),
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
      
      this.memorySnapshots.push(snapshot);
      
      // Keep only last 100 snapshots
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }
      
      // Check for memory leaks
      if (snapshot.usagePercentage > 80) {
        this.logEvent('HIGH_MEMORY_USAGE', {
          usagePercentage: snapshot.usagePercentage,
          usedMB: Math.round(snapshot.usedJSHeapSize / 1024 / 1024),
          limitMB: Math.round(snapshot.jsHeapSizeLimit / 1024 / 1024)
        }, 'warning');
      }
      
      if (snapshot.usagePercentage > 90) {
        this.logEvent('CRITICAL_MEMORY_USAGE', snapshot, 'error');
        this.generateCrashReport('High memory usage detected');
      }
    }, 2000); // Check every 2 seconds
  }
  
  startPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        this.performanceMetrics.push({
          timestamp: Date.now(),
          fps: fps,
          frameTime: (currentTime - lastTime) / frameCount
        });
        
        // Keep only last 60 measurements
        if (this.performanceMetrics.length > 60) {
          this.performanceMetrics.shift();
        }
        
        if (fps < this.thresholds.fps) {
          this.logEvent('LOW_FPS', { fps, threshold: this.thresholds.fps }, 'warning');
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }
  
  setupErrorHandling() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.logEvent('UNHANDLED_ERROR', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, 'error');
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logEvent('UNHANDLED_PROMISE_REJECTION', {
        reason: event.reason,
        stack: event.reason?.stack
      }, 'error');
    });
    
    // Capture console errors - but filter out common non-critical ones
    const originalError = console.error;
    console.error = (...args) => {
      const errorMessage = args.map(arg => String(arg)).join(' ');
      
      // Filter out common non-critical errors that don't cause crashes
      const ignoredPatterns = [
        'Warning:', // React warnings
        'no-unused-vars', // ESLint warnings
        'react-hooks/exhaustive-deps', // React hooks warnings
        'babel-preset-react-app', // Babel warnings
        'DevTools', // Browser DevTools messages
        'source map', // Source map warnings
        'chunk', // Webpack chunk warnings
      ];
      
      const shouldIgnore = ignoredPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase())
      );
      
      // Only log actual runtime errors that could cause crashes
      if (!shouldIgnore) {
        this.logEvent('CONSOLE_ERROR', { 
          args: args.map(arg => String(arg)),
          fullMessage: errorMessage
        }, 'error');
      }
      
      originalError.apply(console, args);
    };
  }
  
  setupDOMMutationObserver() {
    if (!window.MutationObserver) return;
    
    let mutationCount = 0;
    let lastReset = Date.now();
    
    const observer = new MutationObserver((mutations) => {
      mutationCount += mutations.length;
      
      const now = Date.now();
      if (now - lastReset >= 1000) {
        if (mutationCount > 100) {
          this.logEvent('EXCESSIVE_DOM_MUTATIONS', {
            mutationsPerSecond: mutationCount,
            threshold: 100
          }, 'warning');
        }
        
        mutationCount = 0;
        lastReset = now;
      }
    });
    
    // Observe the map container for excessive mutations
    const mapContainer = document.querySelector('.mapboxgl-map');
    if (mapContainer) {
      observer.observe(mapContainer, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }
  
  logEvent(type, data = {}, level = 'info') {
    const event = {
      timestamp: Date.now(),
      type,
      level,
      data,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
      } : null
    };
    
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // Log to console based on level (disabled for production)
    // const emoji = level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : '📊';
    // console.log(`${emoji} CrashMonitor [${type}]:`, data);
  }
  
  trackSceneTransition(sceneName, phase, data = {}) {
    const transitionId = `${sceneName}-${Date.now()}`;
    
    if (phase === 'start') {
      this.sceneTransitions.push({
        id: transitionId,
        sceneName,
        startTime: Date.now(),
        phases: [{ phase, timestamp: Date.now(), data }]
      });
      
      this.logEvent('SCENE_TRANSITION_START', {
        sceneName,
        transitionId,
        ...data
      });
    } else {
      const transition = this.sceneTransitions.find(t => 
        t.sceneName === sceneName && !t.endTime
      );
      
      if (transition) {
        transition.phases.push({ phase, timestamp: Date.now(), data });
        
        if (phase === 'complete' || phase === 'error') {
          transition.endTime = Date.now();
          transition.duration = transition.endTime - transition.startTime;
          
          if (transition.duration > this.thresholds.sceneTransitionTime) {
            this.logEvent('SLOW_SCENE_TRANSITION', {
              sceneName,
              duration: transition.duration,
              threshold: this.thresholds.sceneTransitionTime
            }, 'warning');
          }
        }
        
        this.logEvent(`SCENE_TRANSITION_${phase.toUpperCase()}`, {
          sceneName,
          transitionId: transition.id,
          duration: Date.now() - transition.startTime,
          ...data
        });
      }
    }
  }
  
  trackLayerOperation(operation, layerId, data = {}) {
    this.layerOperations.push({
      timestamp: Date.now(),
      operation,
      layerId,
      data
    });
    
    // Keep only last 200 operations
    if (this.layerOperations.length > 200) {
      this.layerOperations.shift();
    }
    
    // Check for excessive layer operations
    const recentOps = this.layerOperations.filter(
      op => Date.now() - op.timestamp < 1000
    );
    
    if (recentOps.length > this.thresholds.layerOperationsPerSecond) {
      this.logEvent('EXCESSIVE_LAYER_OPERATIONS', {
        operationsPerSecond: recentOps.length,
        threshold: this.thresholds.layerOperationsPerSecond,
        recentOperations: recentOps.slice(-10) // Last 10 operations
      }, 'warning');
    }
  }
  
  generateCrashReport(reason = 'Unknown') {
    const report = {
      timestamp: new Date().toISOString(),
      reason,
      
      // Recent events
      recentEvents: this.events.slice(-50),
      
      // Memory snapshots
      memorySnapshots: this.memorySnapshots.slice(-10),
      
      // Performance metrics
      performanceMetrics: this.performanceMetrics.slice(-10),
      
      // Recent layer operations
      recentLayerOperations: this.layerOperations.slice(-50),
      
      // Active scene transitions
      activeTransitions: this.sceneTransitions.filter(t => !t.endTime),
      
      // Recent completed transitions
      recentTransitions: this.sceneTransitions.slice(-10),
      
      // Browser info
      browserInfo: {
        userAgent: navigator.userAgent,
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null,
        timing: performance.timing ? {
          navigationStart: performance.timing.navigationStart,
          loadEventEnd: performance.timing.loadEventEnd
        } : null
      }
    };
    
    console.error('🚨 CRASH REPORT GENERATED:', report);
    
    // Store in localStorage for debugging
    try {
      localStorage.setItem('crashReport', JSON.stringify(report));
    } catch (e) {
      console.warn('Could not save crash report to localStorage:', e);
    }
    
    return report;
  }
  
  getAnalytics() {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    
    const recentEvents = this.events.filter(e => e.timestamp > last5Minutes);
    const recentTransitions = this.sceneTransitions.filter(t => t.startTime > last5Minutes);
    const recentLayerOps = this.layerOperations.filter(op => op.timestamp > last5Minutes);
    
    return {
      summary: {
        totalEvents: this.events.length,
        recentEvents: recentEvents.length,
        errorEvents: recentEvents.filter(e => e.level === 'error').length,
        warningEvents: recentEvents.filter(e => e.level === 'warning').length,
        sceneTransitions: recentTransitions.length,
        layerOperations: recentLayerOps.length
      },
      
      memoryTrend: this.memorySnapshots.slice(-10).map(s => ({
        timestamp: s.timestamp,
        usagePercentage: s.usagePercentage
      })),
      
      performanceTrend: this.performanceMetrics.slice(-10).map(p => ({
        timestamp: p.timestamp,
        fps: p.fps
      })),
      
      problematicPatterns: this.detectProblematicPatterns()
    };
  }
  
  detectProblematicPatterns() {
    const patterns = [];
    
    // Pattern 1: Rapid scene switching
    const recentTransitions = this.sceneTransitions.slice(-10);
    if (recentTransitions.length >= 5) {
      const timeSpan = recentTransitions[recentTransitions.length - 1].startTime - recentTransitions[0].startTime;
      if (timeSpan < 30000) { // 5 transitions in 30 seconds
        patterns.push({
          type: 'RAPID_SCENE_SWITCHING',
          description: 'Multiple scene transitions in short time',
          count: recentTransitions.length,
          timeSpan
        });
      }
    }
    
    // Pattern 2: Memory leak
    const recentMemory = this.memorySnapshots.slice(-10);
    if (recentMemory.length >= 5) {
      const trend = recentMemory.map(s => s.usagePercentage);
      const isIncreasing = trend.every((val, i) => i === 0 || val >= trend[i - 1]);
      if (isIncreasing && trend[trend.length - 1] - trend[0] > 20) {
        patterns.push({
          type: 'MEMORY_LEAK',
          description: 'Continuous memory usage increase',
          increase: trend[trend.length - 1] - trend[0]
        });
      }
    }
    
    // Pattern 3: Performance degradation
    const recentFPS = this.performanceMetrics.slice(-10);
    if (recentFPS.length >= 5) {
      const avgFPS = recentFPS.reduce((sum, p) => sum + p.fps, 0) / recentFPS.length;
      if (avgFPS < this.thresholds.fps) {
        patterns.push({
          type: 'PERFORMANCE_DEGRADATION',
          description: 'Sustained low FPS',
          averageFPS: avgFPS
        });
      }
    }
    
    return patterns;
  }
}

// Create global instance
const crashMonitor = new CrashMonitor();
window.crashMonitor = crashMonitor;

export default crashMonitor; 