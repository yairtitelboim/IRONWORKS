// Animation batching system to prevent browser crashes
class AnimationBatcher {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.batchSize = 3; // Process only 3 animations at a time
    this.batchDelay = 50; // 50ms between batches
    this.staggerDelay = 10; // 10ms stagger between animations in batch
  }
  
  configure(settings = {}) {
    if (settings.batchSize !== undefined) this.batchSize = settings.batchSize;
    if (settings.batchDelay !== undefined) this.batchDelay = settings.batchDelay;
    if (settings.staggerDelay !== undefined) this.staggerDelay = settings.staggerDelay;
    
    
  }
  
  add(animationFn, priority = 0) {
    this.queue.push({ fn: animationFn, priority, timestamp: Date.now() });
    this.process();
  }
  
  process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    // Execute batch with slight delays between each
    batch.forEach((item, index) => {
      setTimeout(() => {
        try {
          item.fn();
        } catch (error) {
          console.warn('Animation error:', error);
        }
      }, index * this.staggerDelay);
    });
    
    // Process next batch after delay
    setTimeout(() => {
      this.isProcessing = false;
      this.process();
    }, this.batchDelay);
  }
  
  clear() {
    this.queue = [];
    this.isProcessing = false;
  }
}

// Create and export singleton instance
const animationBatcher = new AnimationBatcher();
export default animationBatcher; 