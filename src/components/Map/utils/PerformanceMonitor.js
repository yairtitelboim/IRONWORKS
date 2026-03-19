// Performance monitoring system
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fpsThreshold = 12; // Minimum acceptable FPS before we nudge
    this.isLowPerformance = false;
    this.currentFPS = 60;
    this.isRunning = false;
    this.animationId = null;
  }

  start() {
    if (this.isRunning) return;
    
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.isRunning = true;
    this.monitor();
    
    
  }
  
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    
  }
  
  getCurrentFPS() {
    return this.currentFPS;
  }
  getLowPerformanceStatus() {
    return this.isLowPerformance;
  }
  
  monitor() {
    if (!this.isRunning) return;
    
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastFrameTime >= 1000) { // Check every second
      const fps = this.frameCount;
      this.currentFPS = fps;
      this.frameCount = 0;
      this.lastFrameTime = now;
      
      if (fps < this.fpsThreshold && !this.isLowPerformance) {
        console.debug('PerformanceMonitor: low FPS detected', { fps, threshold: this.fpsThreshold });
        this.isLowPerformance = true;
      } else if (fps >= this.fpsThreshold && this.isLowPerformance) {
        console.debug('PerformanceMonitor: FPS recovered', { fps });
        this.isLowPerformance = false;
      }
    }
    
    this.animationId = requestAnimationFrame(() => this.monitor());
  }
}

// Create and export singleton instance
const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor; 
