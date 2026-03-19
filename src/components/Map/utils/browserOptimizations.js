// Browser-specific optimizations to prevent crashes
class BrowserOptimizations {
  constructor() {
    this.isChrome = this.detectChrome();
    this.isSafari = this.detectSafari();
    this.isLowMemoryDevice = this.detectLowMemoryDevice();
    
    // Chrome-specific limits to prevent crashes
    this.chromeOptimizations = {
      maxConcurrentAnimations: 3,
      maxLayersPerBatch: 2,
      animationDelay: 100, // Increased delay between animations
      sceneTransitionDelay: 300, // Longer delays for scene transitions
      maxWebGLContexts: 8,
      forceGarbageCollection: true,
      reducedMotionThreshold: 0.5 // Reduce animations when performance drops
    };
    
    // Safari optimizations (less restrictive)
    this.safariOptimizations = {
      maxConcurrentAnimations: 5,
      maxLayersPerBatch: 5,
      animationDelay: 50,
      sceneTransitionDelay: 150,
      maxWebGLContexts: 16,
      forceGarbageCollection: false,
      reducedMotionThreshold: 0.3
    };
    
    this.currentOptimizations = this.isChrome ? this.chromeOptimizations : this.safariOptimizations;
    
    
    
  }
  
  detectChrome() {
    const isChromium = window.chrome;
    const winNav = window.navigator;
    const vendorName = winNav.vendor;
    const isOpera = typeof window.opr !== "undefined";
    const isIEedge = winNav.userAgent.indexOf("Edg") > -1;
    const isIOSChrome = winNav.userAgent.match("CriOS");

    if (isIOSChrome) return true;
    if (isChromium !== null && typeof isChromium !== "undefined" && vendorName === "Google Inc." && isOpera === false && isIEedge === false) {
      return true;
    }
    
    // Additional Chrome detection
    return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  }
  
  detectSafari() {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('chromium');
  }
  
  detectLowMemoryDevice() {
    // Estimate device memory constraints
    const memory = navigator.deviceMemory || 4; // Default to 4GB if unknown
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    
    // Consider low memory if < 4GB RAM or < 4 CPU cores
    return memory < 4 || hardwareConcurrency < 4;
  }
  
  getBrowserName() {
    if (this.isChrome) return 'Chrome';
    if (this.isSafari) return 'Safari';
    return 'Other';
  }
  
  // Get optimized settings based on browser
  getAnimationSettings() {
    const base = {
      batchSize: this.currentOptimizations.maxLayersPerBatch,
      batchDelay: this.currentOptimizations.animationDelay,
      maxConcurrent: this.currentOptimizations.maxConcurrentAnimations,
      staggerDelay: Math.floor(this.currentOptimizations.animationDelay / 2)
    };
    
    // Further reduce for low memory devices
    if (this.isLowMemoryDevice) {
      base.batchSize = Math.max(1, Math.floor(base.batchSize / 2));
      base.batchDelay *= 2;
      base.maxConcurrent = Math.max(1, Math.floor(base.maxConcurrent / 2));
    }
    
    return base;
  }
  
  getSceneTransitionSettings() {
    const base = {
      batchSize: this.currentOptimizations.maxLayersPerBatch,
      batchDelay: this.currentOptimizations.sceneTransitionDelay,
      initialDelay: this.currentOptimizations.sceneTransitionDelay / 2,
      finalDelay: this.currentOptimizations.sceneTransitionDelay * 2,
      cameraEaseDuration: this.isChrome ? 2500 : 2000 // Slower camera transitions in Chrome
    };
    
    if (this.isLowMemoryDevice) {
      base.batchSize = 1;
      base.batchDelay *= 1.5;
      base.initialDelay *= 2;
      base.finalDelay *= 2;
      base.cameraEaseDuration *= 1.5;
    }
    
    return base;
  }
  
  // Chrome-specific memory management
  forceGarbageCollection() {
    if (this.isChrome && this.currentOptimizations.forceGarbageCollection) {
      // Force garbage collection in Chrome
      if (window.gc) {
        window.gc();
      }
      
      // Clear any cached textures or buffers
      if (window.map?.current) {
        const map = window.map.current;
        if (map.style && map.style.sourceCaches) {
          Object.values(map.style.sourceCaches).forEach(sourceCache => {
            if (sourceCache._cache) {
              sourceCache._cache.reset();
            }
          });
        }
      }
    }
  }
  
  // Reduce layer complexity for Chrome (map layers only)
  shouldUseSimplifiedLayers() {
    return this.isChrome || this.isLowMemoryDevice;
  }
  
  // Check if UI animations should be disabled (more conservative)
  shouldDisableUIAnimations() {
    // Only disable UI animations for very low memory devices or explicit user preference
    return this.isLowMemoryDevice && navigator.deviceMemory < 2;
  }
  
  // Check if we should reduce animations based on performance
  shouldReduceAnimations(currentFPS = 60) {
    const threshold = this.currentOptimizations.reducedMotionThreshold;
    const targetFPS = 60;
    const performanceRatio = currentFPS / targetFPS;
    
    return performanceRatio < threshold;
  }
  
  // Get WebGL context limits
  getWebGLLimits() {
    return {
      maxContexts: this.currentOptimizations.maxWebGLContexts,
      maxTextureSize: this.isChrome ? 4096 : 8192,
      maxRenderbufferSize: this.isChrome ? 4096 : 8192,
      maxViewportDims: this.isChrome ? [4096, 4096] : [8192, 8192]
    };
  }
  
  // Apply CSS optimizations to reduce layer creation
  applyCSSOptimizations() {
    if (!this.isChrome) return;
    
    // Add Chrome-specific CSS optimizations
    const style = document.createElement('style');
    style.textContent = `
      /* Chrome-specific optimizations to reduce layer creation */
      .mapboxgl-map {
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        will-change: auto !important; /* Disable will-change to reduce layers */
      }
      
      /* Reduce layer creation for animations */
      .morphing-button {
        will-change: auto !important;
        transform: translate3d(0,0,0); /* Use translate3d sparingly */
      }
      
      /* Optimize popup and overlay elements */
      .mapboxgl-popup {
        will-change: auto !important;
      }
      
      /* Reduce compositing layers for UI elements */
      .floating-card, .layer-toggle, .crash-analytics-dashboard {
        will-change: auto !important;
        backface-visibility: hidden;
      }
    `;
    
    document.head.appendChild(style);
    
  }
  
  // Monitor memory usage and trigger cleanup
  startMemoryMonitoring() {
    if (!this.isChrome) return;
    
    setInterval(() => {
      if (performance.memory) {
        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
        const memoryUsage = usedJSHeapSize / jsHeapSizeLimit;
        
        // If memory usage is high, trigger cleanup
        if (memoryUsage > 0.8) {
          console.warn('🚨 High memory usage detected, triggering cleanup');
          this.forceGarbageCollection();
          
          // Emit event for other components to reduce complexity
          window.dispatchEvent(new CustomEvent('memoryPressure', {
            detail: { memoryUsage, severity: memoryUsage > 0.9 ? 'critical' : 'high' }
          }));
        }
      }
    }, 5000); // Check every 5 seconds
  }
}

// Create singleton instance
const browserOptimizations = new BrowserOptimizations();

// Apply optimizations immediately
browserOptimizations.applyCSSOptimizations();
browserOptimizations.startMemoryMonitoring();

export default browserOptimizations; 