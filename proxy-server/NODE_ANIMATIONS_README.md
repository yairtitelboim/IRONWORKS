# 🎯 Node Animation System

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

A comprehensive animation system for map nodes (markers/circles) with multiple animation types, zoom-level visibility controls, and performance-optimized rendering.

## 📋 Overview

The node animation system provides several types of dynamic visual effects:
- **Pulse Animations**: Expanding/contracting circles with opacity changes
- **Property Animations**: Dynamic line width and opacity changes via `setPaintProperty`
- **Zoom-Level Visibility**: Different animations appear/disappear at specific zoom levels
- **Particle Systems**: Moving elements along paths
- **Data-Driven Animations**: Animations controlled by feature properties

## 🎬 Animation Types

### 1. **Pulse Animations** (Expanding Circles)

**Pattern**: Uses Mapbox expressions with `interpolate` and feature properties to create expanding circles.

```javascript
// Castroville Pulse Animation (Lines 1318-1347)
useEffect(() => {
  if (showMainPathB) {
    // Create pulse layer with interpolated radius and opacity
    map.current.addLayer({
      id: 'castroville-pulse-layer',
      type: 'circle',
      source: 'castroville-pulse-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'], // Data property: 0-1 progress
          0, 30,              // At t=0: radius = 30px
          1, 90               // At t=1: radius = 90px
        ],
        'circle-color': '#FFD700',
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 0.45,    // At t=0: 45% opacity
          0.7, 0.22,  // At t=0.7: 22% opacity
          1, 0        // At t=1: 0% opacity (fade out)
        ],
        'circle-blur': 0.5
      }
    });
    
    // Animation loop updates the pulse_t property
    const animatePulse = () => {
      const period = 1.6; // 1.6 second cycle
      const t = ((Date.now() / 1000) % period) / period; // 0-1 progress
      const pulseFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: COORDS },
        properties: { pulse_t: t } // Update the interpolation value
      };
      
      map.current.getSource('pulse-source').setData({
        type: 'FeatureCollection',
        features: [pulseFeature]
      });
      
      requestAnimationFrame(animatePulse);
    };
  }
}, [showMainPathB, map]);
```

**Key Features**:
- **Data-Driven**: Uses `['get', 'pulse_t']` to read animation progress from feature properties
- **Smooth Interpolation**: `interpolate` expressions create smooth transitions
- **Multi-Property**: Animates both radius (30→90px) and opacity (0.45→0)
- **Cyclical**: 1.6-second repeating cycle

### 2. **Property Animations** (Dynamic Paint Properties)

**Pattern**: Uses `setPaintProperty` to dynamically change line width and opacity with sine wave calculations.

```javascript
// Path A Circle Pulse Animation (Lines 1036-1086)
useEffect(() => {
  if (!map?.current || !showMainPathA) return;
  
  let animationFrame;
  
  const animateCircles = () => {
    const t = Date.now() * 0.002; // Time multiplier controls speed
    
    // Sine wave calculations for smooth pulsing
    const opacity = 0.5 + 0.5 * Math.abs(Math.sin(t));    // 0.5 ↔ 1.0
    const width = 2.5 + 2 * Math.abs(Math.sin(t));        // 2.5 ↔ 4.5
    
    // Direct property updates
    if (map.current.getLayer('path-a-circles-layer')) {
      map.current.setPaintProperty('path-a-circles-layer', 'line-opacity', opacity);
      map.current.setPaintProperty('path-a-circles-layer', 'line-width', width);
    }
    
    animationFrame = requestAnimationFrame(animateCircles);
  };
  
  animateCircles();
  
  return () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    // Restore default values
    if (map.current?.getLayer('path-a-circles-layer')) {
      map.current.setPaintProperty('path-a-circles-layer', 'line-opacity', 1);
      map.current.setPaintProperty('path-a-circles-layer', 'line-width', 4);
    }
  };
}, [showMainPathA, map]);
```

**Key Features**:
- **Sine Wave Math**: `Math.abs(Math.sin(t))` creates smooth 0→1→0 oscillation
- **Multiple Properties**: Simultaneously animates opacity and line width
- **Speed Control**: Time multiplier (`0.002`) controls animation speed
- **Cleanup**: Restores original values when animation stops

### 3. **Zoom-Level Visibility** (Conditional Rendering)

**Pattern**: Uses `minzoom` and `maxzoom` properties to show/hide animations at different zoom levels.

```javascript
// Path A Fill Layers with Zoom Controls (Lines 915-972)
const layerConfigs = [
  {
    id: 'path-a-circles-fill-layer',
    filter: ['==', ['get', 'type'], 'normal'],
    paint: {
      'fill-color': '#ff69b4',
      'fill-opacity': 0.15
    },
    minzoom: 8  // Only visible when zoomed in past level 8
  },
  {
    id: 'san-antonio-circles-fill-5-layer',
    filter: ['==', ['get', 'type'], 'san_antonio_5'],
    paint: {
      'fill-color': '#ff69b4',
      'fill-opacity': 0.25
    },
    minzoom: 4  // Visible from zoom level 4+
  },
  {
    id: 'path-b-large-circles-layer',
    paint: {
      'line-color': '#FFA500',
      'line-width': 1,
      'line-opacity': 0.7
    },
    minzoom: 0,   // Always visible
    maxzoom: 8    // Hidden when zoomed in past level 8
  }
];

layerConfigs.forEach(config => {
  map.current.addLayer({
    id: config.id,
    type: config.type || 'fill',
    source: 'circles-source',
    paint: config.paint,
    filter: config.filter,
    layout: { visibility: 'visible' },
    ...(config.minzoom !== undefined && { minzoom: config.minzoom }),
    ...(config.maxzoom !== undefined && { maxzoom: config.maxzoom })
  });
});
```

**Zoom Level Strategy**:
- **Overview (0-4)**: Large regional circles, basic markers
- **Medium (4-8)**: Detailed circles with fills, multiple ring sizes
- **Detailed (8+)**: Fine-grained fills, detailed annotations
- **Inverse Visibility**: Some layers hide when zooming in (`maxzoom: 8`)

### 4. **Particle System Animation** (Moving Elements)

**Pattern**: Creates moving particles along a path using coordinate interpolation.

```javascript
// Path AA Particle Animation (Lines 1574-1600)
const animatePathAAParticles = (map) => {
  const coords = pathACoordsRef; // Pre-loaded path coordinates
  if (!coords.length) return;
  
  const particleCount = 60;
  const now = Date.now();
  const features = [];
  
  // Generate particles at different positions along path
  for (let i = 0; i < particleCount; i++) {
    // Calculate particle position based on time + offset
    const progress = ((now * 0.00008) + i / particleCount) % 1; // 0-1 progress
    const idx = Math.floor(progress * (coords.length - 1));
    const nextIdx = (idx + 1) % coords.length;
    const frac = (progress * (coords.length - 1)) % 1;
    
    // Linear interpolation between coordinates
    const pos = [
      coords[idx][0] + (coords[nextIdx][0] - coords[idx][0]) * frac,
      coords[idx][1] + (coords[nextIdx][1] - coords[idx][1]) * frac
    ];
    
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: pos }
    });
  }
  
  // Update all particle positions
  map.getSource('particles-source').setData({
    type: 'FeatureCollection', 
    features 
  });
  
  requestAnimationFrame(() => animatePathAAParticles(map));
};
```

**Particle Features**:
- **Path Following**: Particles move along pre-defined coordinate paths
- **Staggered Distribution**: Each particle has offset (`i / particleCount`)
- **Smooth Movement**: Linear interpolation between coordinate points
- **Continuous Flow**: Modulo operation creates endless loop

## ⚙️ useEffect Patterns

### **Animation Activation Pattern**
```javascript
useEffect(() => {
  // Guard clause - exit if conditions not met
  if (!map?.current || !showAnimation) return;
  
  // Animation state variables
  let animationFrame = null;
  let cancelled = false;
  
  // Setup function (async if needed)
  const setup = async () => {
    // Load resources, add layers, configure sources
    await loadAnimationData();
    if (cancelled) return; // Respect cleanup
    
    // Add map layers and sources
    addAnimationLayers();
    
    // Start animation loop
    if (!animationFrame) {
      startAnimation();
    }
  };
  
  setup();
  
  // Cleanup function
  return () => {
    cancelled = true;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    // Remove map layers and sources
    cleanupMapLayers();
    // Restore default property values
    restoreDefaults();
  };
}, [showAnimation, map]); // Dependencies
```

### **Multi-Animation Management**
```javascript
useEffect(() => {
  if (!map?.current || !showPathB) return;
  
  // Multiple animation frame references
  let junctionCirclesFrame;
  let christovalBigSpringFrame;
  let castrovillePulseFrame;
  let fortStocktonPulseFrame;
  
  // Individual animation functions
  const animateJunctionCircles = () => {
    // Animation logic...
    junctionCirclesFrame = requestAnimationFrame(animateJunctionCircles);
  };
  
  const animateCastrovillePulse = () => {
    // Animation logic...
    castrovillePulseFrame = requestAnimationFrame(animateCastrovillePulse);
  };
  
  // Start all animations
  animateJunctionCircles();
  animateCastrovillePulse();
  // ... start others
  
  return () => {
    // Cancel all animation frames
    if (junctionCirclesFrame) cancelAnimationFrame(junctionCirclesFrame);
    if (christovalBigSpringFrame) cancelAnimationFrame(christovalBigSpringFrame);
    if (castrovillePulseFrame) cancelAnimationFrame(castrovillePulseFrame);
    if (fortStocktonPulseFrame) cancelAnimationFrame(fortStocktonPulseFrame);
    
    // Restore all defaults
    restoreAllDefaults();
  };
}, [showPathB, map]);
```

## 🎨 Visual Effects Breakdown

### **Circle Pulse Effects**
- **Radius Growth**: 30px → 90px over 1.6 seconds
- **Opacity Fade**: 0.45 → 0.22 → 0 (fade out at end)
- **Color Variations**: `#FFD700` (yellow-orange), `#00FF99` (green)
- **Blur Effect**: `circle-blur: 0.5` for soft glow

### **Line Pulse Effects**
- **Width Oscillation**: 2.5px ↔ 4.5px sine wave
- **Opacity Oscillation**: 0.5 ↔ 1.0 sine wave
- **Dash Patterns**: `[2, 2]` for dashed circles
- **Speed Variations**: Different time multipliers (0.001, 0.002)

### **Fill Layer Effects**
- **Progressive Opacity**: Different opacity levels (0.06, 0.12, 0.25)
- **Zoom-Based Visibility**: `minzoom: 4`, `minzoom: 8`
- **Color Coding**: Pink (`#ff69b4`) for Path A areas
- **Hover States**: Separate hover layers with enhanced visibility

### **Particle Effects**
- **Small Glowing Dots**: 1px radius with stroke outline
- **High Count**: 60 particles for smooth flow effect
- **Speed Control**: `0.00008` time multiplier for moderate speed
- **Glow Effect**: `circle-blur: 0.2` + stroke for outline glow

## 🔧 Performance Optimizations

### **Animation Frame Management**
- **Single Frame per Animation**: Each animation uses one `requestAnimationFrame`
- **Proper Cleanup**: All frames cancelled in cleanup functions
- **Conditional Execution**: Animations only run when layers are visible

### **Resource Management**
- **Coordinate Caching**: Path coordinates loaded once and cached
- **Layer Reuse**: Existing layers updated rather than recreated
- **Source Updates**: `setData()` used to update existing sources

### **Browser Optimization**
- **RequestAnimationFrame**: Synced with browser refresh rate (60fps)
- **Math.abs(Math.sin())**: Efficient sine wave calculations
- **Modulo Operations**: `% 1` for cyclical animations without overflow

## 🚀 Trigger Mechanisms

### **Toggle-Based Activation**
```javascript
// Triggered by UI toggle states
const [showMainPathA, setShowMainPathA] = useState(false);
const [showMainPathB, setShowMainPathB] = useState(false);

// useEffect responds to state changes
useEffect(() => {
  // Animation starts when showMainPathA becomes true
  // Animation stops and cleans up when showMainPathA becomes false
}, [showMainPathA, map]);
```

### **Zoom-Level Triggers**
```javascript
// Automatic visibility based on zoom level
map.current.addLayer({
  id: 'detailed-circles',
  minzoom: 8,  // Automatically appears when zooming past level 8
  maxzoom: 15  // Automatically hides when zooming past level 15
});
```

### **Map Event Triggers**
```javascript
// Triggered by map interactions
map.current.on('mouseenter', 'circles-layer', (e) => {
  // Start hover animation
  startHoverPulse(e.features[0].properties.id);
});

map.current.on('mouseleave', 'circles-layer', () => {
  // Stop hover animation
  stopHoverPulse();
});
```

## 📊 Animation Performance Metrics

- **Frame Rate**: 60fps via `requestAnimationFrame`
- **Particle Count**: 60 particles maximum per path
- **Animation Cycles**: 1.6-second pulse cycles
- **Layer Count**: 3-8 animated layers per feature group
- **Memory Usage**: Coordinate arrays cached, minimal GC pressure
- **CPU Usage**: Sine calculations + property updates only

This animation system provides rich, performant visual feedback while maintaining smooth map interactions and proper resource cleanup.

---

## 🗺️ Mapbox Environment Best Practices

### **What Works Best in Mapbox GL JS**

#### **✅ Recommended Approaches**

**1. Data-Driven Animations (Preferred)**
```javascript
// ✅ BEST: Use Mapbox expressions for GPU-accelerated animations
paint: {
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['get', 'animation_progress'], // 0-1 value in feature properties
    0, 10,   // Start radius
    1, 50    // End radius
  ],
  'circle-opacity': [
    'interpolate',
    ['exponential', 1.5], // Exponential easing for natural feel
    ['get', 'animation_progress'],
    0, 0.8,
    0.7, 0.3,
    1, 0
  ]
}

// Update only the data, not the paint properties
source.setData({
  type: 'FeatureCollection',
  features: features.map(f => ({
    ...f,
    properties: { 
      ...f.properties, 
      animation_progress: getCurrentAnimationProgress() 
    }
  }))
});
```

**Why This Works**:
- **GPU Acceleration**: Mapbox expressions run on GPU
- **Batch Updates**: Single `setData()` call updates all features
- **Smooth Interpolation**: Built-in easing functions
- **Performance**: No individual `setPaintProperty` calls

**2. Layer-Based Animation Architecture**
```javascript
// ✅ GOOD: Separate layers for different animation states
const ANIMATION_LAYERS = {
  base: 'markers-base',           // Static markers
  pulse: 'markers-pulse',         // Expanding pulse effect
  glow: 'markers-glow',          // Soft glow background
  stroke: 'markers-stroke'        // Animated stroke/border
};

// Each layer handles one visual aspect
map.addLayer({
  id: ANIMATION_LAYERS.pulse,
  type: 'circle',
  source: 'markers-source',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'pulse_t'], 0, 20, 1, 80],
    'circle-opacity': ['interpolate', ['linear'], ['get', 'pulse_t'], 0, 0.6, 1, 0],
    'circle-color': '#FFD700',
    'circle-blur': 1.0  // Soft pulse edge
  }
});

map.addLayer({
  id: ANIMATION_LAYERS.stroke,
  type: 'line',
  source: 'markers-circles-source', // Separate circle geometries
  paint: {
    'line-width': ['interpolate', ['linear'], ['get', 'stroke_t'], 0, 2, 1, 6],
    'line-opacity': ['interpolate', ['linear'], ['get', 'stroke_t'], 0, 1, 1, 0.3],
    'line-color': '#FFFFFF',
    'line-dasharray': [3, 2] // Animated dashed border
  }
});
```

#### **⚠️ Use with Caution**

**1. setPaintProperty Animations**
```javascript
// ⚠️ CAUTION: Works but can be performance-heavy
const animateProperty = () => {
  const t = Date.now() * 0.002;
  const opacity = 0.5 + 0.5 * Math.abs(Math.sin(t));
  
  // Each call triggers style recalculation
  map.setPaintProperty('layer-id', 'circle-opacity', opacity);
  map.setPaintProperty('layer-id', 'circle-radius', 10 + 20 * opacity);
  
  requestAnimationFrame(animateProperty);
};
```

**Performance Impact**:
- **Style Recalculation**: Each `setPaintProperty` triggers re-render
- **CPU Intensive**: Not GPU-accelerated
- **Batching Issues**: Multiple property updates in same frame
- **Memory Pressure**: Continuous style object mutations

**When to Use**: Simple animations on few features (<10 markers)

#### **❌ Avoid These Patterns**

**1. Frequent Layer Add/Remove**
```javascript
// ❌ AVOID: Recreating layers every frame
const badAnimation = () => {
  map.removeLayer('pulse-layer');
  map.addLayer({
    id: 'pulse-layer',
    paint: { 'circle-radius': getCurrentRadius() }
  });
  requestAnimationFrame(badAnimation);
};
```

**Problems**:
- **Expensive Operations**: Layer creation involves style parsing
- **Memory Leaks**: Improper cleanup of WebGL resources
- **Flicker**: Visual gaps during layer recreation

**2. High-Frequency Source Updates**
```javascript
// ❌ AVOID: Updating entire datasets frequently
const badParticles = () => {
  const newFeatures = generateAllParticles(); // 1000+ features
  map.getSource('particles').setData({
    type: 'FeatureCollection',
    features: newFeatures // Entire dataset replaced 60fps
  });
  requestAnimationFrame(badParticles);
};
```

**Problems**:
- **JSON Parsing**: Large GeoJSON parsed every frame
- **Memory Allocation**: New feature arrays created continuously
- **Network Impact**: If using remote sources

## 🎭 Visual Effect Specifications & Nuances

### **Pulse Effects - Timing & Curves**

#### **Standard Pulse (Radar-Style)**
```javascript
// Period: 1.6 seconds (optimal for attention without annoyance)
const PULSE_PERIOD = 1.6;
const PULSE_PHASES = {
  expand: 0.0,    // Start expansion
  peak: 0.3,      // Maximum size
  fade: 0.7,      // Begin fade out
  reset: 1.0      // Complete fade, restart
};

// Radius curve: Quick expansion, slow fade
'circle-radius': [
  'interpolate',
  ['exponential', 2.0], // Fast initial growth
  ['get', 'pulse_t'],
  0, 20,      // Start: 20px
  0.3, 80,    // Peak: 80px (4x growth in 30% of cycle)
  0.7, 85,    // Slight overshoot
  1.0, 20     // Reset to start
]

// Opacity curve: Linear fade for clean disappearance
'circle-opacity': [
  'interpolate',
  ['linear'],
  ['get', 'pulse_t'],
  0, 0.7,     // Start: 70% opacity
  0.3, 0.8,   // Peak: 80% opacity
  0.7, 0.4,   // Mid-fade: 40%
  1.0, 0      // Complete fade
]
```

**Visual Characteristics**:
- **Attention Grabbing**: 1.6s period hits sweet spot for noticeability
- **Natural Feel**: Exponential growth mimics physical wave propagation
- **Clean Reset**: Full fade to 0 prevents visual artifacts
- **Size Range**: 4:1 ratio (20px→80px) provides clear expansion

#### **Heartbeat Pulse (Dual-Beat)**
```javascript
// Period: 2.0 seconds with double-beat pattern
const HEARTBEAT_PERIOD = 2.0;

'circle-radius': [
  'interpolate',
  ['linear'],
  ['get', 'heartbeat_t'],
  0.0, 15,    // Rest
  0.1, 35,    // First beat
  0.2, 20,    // Dip
  0.3, 40,    // Second beat (stronger)
  0.4, 15,    // Return to rest
  1.0, 15     // Long rest period
]
```

**Use Cases**: 
- **Status Indicators**: Server heartbeat, connection status
- **Urgent Alerts**: Medical/emergency markers
- **Biological Data**: Heart rate, breathing patterns

### **Dashed Border/Stroke Effects - Animation Techniques**

#### **Rotating Dash Pattern**
```javascript
// Creates illusion of rotating dashed border
const DASH_ROTATION_SPEED = 0.001; // Slow rotation for visibility

// Animate dash offset to create rotation effect
'line-dasharray': [2, 3], // Fixed pattern: 2px dash, 3px gap

// Use animation progress to offset the dash pattern
const updateDashOffset = () => {
  const offset = (Date.now() * DASH_ROTATION_SPEED) % 5; // 5 = dash + gap
  map.setPaintProperty('stroke-layer', 'line-dash-offset', offset);
};
```

**Visual Effect**: 
- **Marching Ants**: Classic selection indicator
- **Direction Indication**: Shows flow or movement
- **Activity Status**: Indicates active/processing state

#### **Pulsing Dash Thickness**
```javascript
// Combine dash pattern with thickness animation
'line-width': [
  'interpolate',
  ['linear'],
  ['get', 'dash_pulse_t'],
  0, 2,    // Thin border
  1, 8     // Thick border
],
'line-dasharray': [
  // Dynamic dash pattern based on thickness
  'interpolate',
  ['linear'],
  ['get', 'dash_pulse_t'],
  0, ['literal', [2, 2]], // Tight dashes when thin
  1, ['literal', [6, 4]]  // Longer dashes when thick
]
```

**Timing Considerations**:
- **Slow Pulse**: 2-3 second cycles for subtle effect
- **Fast Pulse**: 0.8-1.2 second cycles for urgent attention
- **Synchronized**: Match dash and thickness timing

#### **Multi-Ring Stroke Effects**
```javascript
// Create multiple concentric animated rings
const RING_CONFIGS = [
  {
    id: 'ring-inner',
    radius_base: 15,
    radius_pulse: 25,
    opacity: 0.8,
    dash: [2, 1],
    speed: 0.002
  },
  {
    id: 'ring-middle', 
    radius_base: 25,
    radius_pulse: 40,
    opacity: 0.5,
    dash: [3, 2],
    speed: 0.0015  // Slightly slower
  },
  {
    id: 'ring-outer',
    radius_base: 40,
    radius_pulse: 60,
    opacity: 0.3,
    dash: [4, 3],
    speed: 0.001   // Slowest
  }
];
```

**Effect**: Creates complex, layered pulsing with depth

### **Speed & Timing Guidelines**

#### **Animation Speed Categories**

**1. Subtle/Background (Slow)**
- **Time Multiplier**: 0.0005 - 0.001
- **Period**: 4-8 seconds
- **Use Cases**: Ambient status, background activity
- **Example**: Data center utilization, network health

**2. Standard/Attention (Medium)**
- **Time Multiplier**: 0.001 - 0.002  
- **Period**: 1.5-3 seconds
- **Use Cases**: Normal alerts, selection indicators
- **Example**: Selected markers, active processes

**3. Urgent/Alert (Fast)**
- **Time Multiplier**: 0.003 - 0.005
- **Period**: 0.5-1 second
- **Use Cases**: Errors, warnings, critical status
- **Example**: System failures, security alerts

**4. Particle Flow (Variable)**
- **Time Multiplier**: 0.00005 - 0.0002
- **Use Cases**: Data flow, traffic, connections
- **Particle Count vs Speed**: Inverse relationship
  - 60 particles: 0.00008 multiplier
  - 30 particles: 0.00015 multiplier
  - 10 particles: 0.0003 multiplier

#### **Easing Functions for Natural Feel**

```javascript
// Built-in Mapbox easing options
const EASING_TYPES = {
  linear: ['linear'],                    // Constant speed
  easeOut: ['exponential', 0.5],        // Fast start, slow end
  easeIn: ['exponential', 2.0],         // Slow start, fast end
  bounce: ['cubic-bezier', 0.68, -0.55, 0.265, 1.55] // Overshoot effect
};

// Custom easing for pulse effects
'circle-radius': [
  'interpolate',
  ['cubic-bezier', 0.25, 0.46, 0.45, 0.94], // Ease-out-quad
  ['get', 'pulse_t'],
  0, 20,
  1, 80
]
```

### **Performance Optimization Strategies**

#### **Layer Management Best Practices**

**1. Layer Grouping by Update Frequency**
```javascript
// Group layers by how often they need updates
const LAYER_GROUPS = {
  static: ['base-markers', 'labels'],           // Never animated
  slow: ['background-glow', 'status-rings'],    // 2-4 second cycles  
  medium: ['selection-pulse', 'hover-effects'], // 1-2 second cycles
  fast: ['alerts', 'real-time-data'],          // <1 second cycles
  particles: ['flow-particles', 'connections']  // 60fps updates
};

// Update only what's necessary
const updateAnimations = () => {
  updateParticles();     // Every frame
  if (frameCount % 30 === 0) updateFastLayers();   // Every 0.5s
  if (frameCount % 60 === 0) updateMediumLayers(); // Every 1s  
  if (frameCount % 120 === 0) updateSlowLayers();  // Every 2s
};
```

**2. Feature Culling by Zoom Level**
```javascript
// Reduce feature count at lower zoom levels
const getVisibleFeatures = (allFeatures, zoom) => {
  if (zoom < 6) {
    // Show only major markers
    return allFeatures.filter(f => f.properties.importance > 8);
  } else if (zoom < 10) {
    // Show medium + major markers  
    return allFeatures.filter(f => f.properties.importance > 5);
  } else {
    // Show all markers
    return allFeatures;
  }
};
```

**3. Animation State Management**
```javascript
// Centralized animation state prevents conflicts
class AnimationManager {
  constructor() {
    this.activeAnimations = new Map();
    this.frameCallbacks = new Set();
    this.isRunning = false;
  }
  
  startAnimation(id, callback) {
    this.activeAnimations.set(id, callback);
    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  }
  
  stopAnimation(id) {
    this.activeAnimations.delete(id);
    if (this.activeAnimations.size === 0) {
      this.isRunning = false;
    }
  }
  
  animate() {
    if (!this.isRunning) return;
    
    // Execute all active animations in single frame
    this.activeAnimations.forEach(callback => callback());
    requestAnimationFrame(() => this.animate());
  }
}
```

This comprehensive system provides the foundation for implementing sophisticated marker animations in any Mapbox-based application while maintaining optimal performance and visual appeal.
