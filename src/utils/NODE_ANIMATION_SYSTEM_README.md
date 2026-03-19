# 🎬 Node Animation System

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

A sophisticated visual effects system that creates rich, data-driven animations for infrastructure markers, transforming simple size-based relationships into complex visual narratives.

## 🎯 Overview

The Node Animation System enhances the current marker system by creating visual relationships between infrastructure data and their visual representation using:

- **Data-Driven Animations**: Visual effects based on criticality, relevance, and infrastructure type
- **Multiple Animation Types**: Pulse, heartbeat, ripple, glow, and more
- **Performance Optimized**: GPU-accelerated Mapbox expressions
- **Interactive Highlighting**: Dynamic visual feedback for user interactions
- **Category-Aware Effects**: Different animations for different infrastructure categories

## 🚀 Key Improvements Over Current System

### Current System (Simple)
```javascript
// Only size-based differentiation
'circle-radius': [
  'case',
  ['==', ['get', 'category'], 'power plants'], 10,
  ['==', ['get', 'category'], 'electric utilities'], 9,
  // ... more categories
]
```

### New System (Rich & Data-Driven)
```javascript
// Multi-factor visual differentiation
'circle-radius': [
  'interpolate',
  ['exponential', 2.0],
  ['get', 'animation_progress'],
  0, ['get', 'base_radius'],           // Based on criticality
  0.3, ['get', 'pulse_radius'],       // Animated expansion
  0.7, ['*', ['get', 'pulse_radius'], 1.1], // Overshoot effect
  1, ['get', 'base_radius']           // Return to base
]
```

## 🎨 Visual Effects by Infrastructure Type

### 1. **Power Generation** (`power_generation`)
- **Animation**: Energy Pulse
- **Visual**: Expanding red circles with energy-like glow
- **Data Factors**: Criticality level, generation capacity, grid importance
- **Color**: `#ef4444` (Red) with `#ff6b6b` glow

### 2. **Electrical Transmission** (`electrical_transmission`)
- **Animation**: Transmission Flow
- **Visual**: Rotating dashed borders showing power flow
- **Data Factors**: Transmission capacity, voltage level, grid connectivity
- **Color**: `#f59e0b` (Orange) with `#fbbf24` glow

### 3. **Water Facilities** (`water_cooling`)
- **Animation**: Water Ripple
- **Visual**: Gentle expanding ripples like water waves
- **Data Factors**: Cooling capacity, water availability, criticality
- **Color**: `#06b6d4` (Cyan) with `#22d3ee` glow

### 4. **Grid Operators** (`grid_operator`)
- **Animation**: Heartbeat Pulse
- **Visual**: Double-beat pulse pattern indicating grid status
- **Data Factors**: Grid stability, operator importance, system health
- **Color**: `#dc2626` (Dark Red) with `#f87171` glow

### 5. **Data Centers** (`data_center`)
- **Animation**: Data Flow Glow
- **Visual**: Steady pulsing glow with data stream effects
- **Data Factors**: Computing capacity, connectivity, uptime
- **Color**: `#8b5cf6` (Purple) with `#a78bfa` glow

### 6. **Natural Gas** (`natural_gas`)
- **Animation**: Gas Flow Flicker
- **Visual**: Flickering effect like gas flame
- **Data Factors**: Supply capacity, pipeline connectivity, pressure
- **Color**: `#f97316` (Orange) with `#fb923c` glow

### 7. **Renewable Energy** (`renewable_energy`)
- **Animation**: Gentle Pulse
- **Visual**: Soft, organic pulsing like natural energy
- **Data Factors**: Generation capacity, environmental impact, sustainability
- **Color**: `#10b981` (Green) with `#34d399` glow

### 8. **Emergency Services** (`emergency_services`)
- **Animation**: Urgent Pulse
- **Visual**: Rapid, attention-grabbing pulsing
- **Data Factors**: Emergency response capability, backup power, criticality
- **Color**: `#ef4444` (Red) with `#fca5a5` glow

### 9. **Industrial Facilities** (`industrial`)
- **Animation**: Steady Glow
- **Visual**: Consistent, stable glow indicating operational status
- **Data Factors**: Industrial capacity, operational status, environmental impact
- **Color**: `#6b7280` (Gray) with `#9ca3af` glow

## 📊 Data-Driven Visual Properties

### Criticality-Based Scaling
```javascript
const criticalityConfig = {
  critical: { baseRadius: 12, pulseRadius: 48, glowIntensity: 1.0 },
  high: { baseRadius: 10, pulseRadius: 40, glowIntensity: 0.8 },
  medium: { baseRadius: 8, pulseRadius: 32, glowIntensity: 0.6 },
  low: { baseRadius: 6, pulseRadius: 24, glowIntensity: 0.4 }
};
```

### Relevance Score Color Intensity
```javascript
const relevanceIntensity = {
  high: 1.0,    // 90-100 relevance score - Full color intensity
  medium: 0.7,  // 50-89 relevance score - 70% color intensity
  low: 0.4      // 0-49 relevance score - 40% color intensity
};
```

### Visual Priority Calculation
```javascript
// Multi-factor priority calculation
const visualPriority = 
  criticalityWeight * 0.4 +      // 40% weight
  relevanceScore * 0.3 +         // 30% weight
  infrastructureTypeWeight * 0.2 + // 20% weight
  distanceWeight * 0.1;          // 10% weight
```

## 🔧 Integration with Existing Components

### SerpTool Integration
```javascript
// Enhance SerpTool markers with animations
const serpIntegration = new SerpToolAnimationIntegration(map, updateToolFeedback);
const enhancedSerpTool = serpIntegration.enhanceSerpToolMarkers(serpTool);
```

### CategoryToggle Integration
```javascript
// Connect category selections with animations
const categoryIntegration = new CategoryToggleAnimationIntegration(nodeAnimation);
categoryIntegration.handleCategoryChange(categoryId, features);
```

### LegendContainer Integration
```javascript
// Connect legend interactions with animations
const legendIntegration = new LegendContainerAnimationIntegration(nodeAnimation);
legendIntegration.handleLegendItemClick(displayLabel, features);
```

## 🎭 Animation Types & Effects

### 1. **Pulse Animation** (Standard)
- **Pattern**: Expanding circles with opacity fade
- **Use Cases**: Power plants, general infrastructure
- **Timing**: 1.6-second cycles
- **Effect**: Quick expansion, slow fade

### 2. **Heartbeat Animation** (Grid Status)
- **Pattern**: Double-beat pulse pattern
- **Use Cases**: Grid operators, critical infrastructure
- **Timing**: 2.0-second cycles with dual beats
- **Effect**: Rest → Beat → Dip → Strong Beat → Rest

### 3. **Ripple Animation** (Water Flow)
- **Pattern**: Gentle expanding ripples
- **Use Cases**: Water facilities, cooling systems
- **Timing**: 3.0-second cycles
- **Effect**: Smooth, organic wave-like expansion

### 4. **Glow Pulse** (Data Centers)
- **Pattern**: Steady pulsing glow
- **Use Cases**: Data centers, computing facilities
- **Timing**: 2.5-second cycles
- **Effect**: Consistent, technological pulsing

### 5. **Urgent Pulse** (Emergency)
- **Pattern**: Rapid, attention-grabbing pulsing
- **Use Cases**: Emergency services, critical alerts
- **Timing**: 0.8-second cycles
- **Effect**: Fast, urgent pulsing for immediate attention

### 6. **Dash Rotate** (Transmission)
- **Pattern**: Rotating dashed borders
- **Use Cases**: Transmission lines, electrical infrastructure
- **Timing**: 4.0-second rotation cycles
- **Effect**: Marching ants showing flow direction

## ⚡ Performance Optimizations

### GPU-Accelerated Expressions
```javascript
// Uses Mapbox expressions for GPU acceleration
'circle-radius': [
  'interpolate',
  ['exponential', 2.0],  // GPU-accelerated easing
  ['get', 'animation_progress'],
  0, 20,
  1, 80
]
```

### Efficient Animation Loop
```javascript
// Single animation loop for all features
const animate = () => {
  this.updateAnimationLayers(Date.now());
  this.animationFrame = requestAnimationFrame(animate);
};
```

### Layer Grouping
```javascript
// Group features by animation type for efficient rendering
const animationGroups = {
  pulse: [powerPlants, dataCenters],
  heartbeat: [gridOperators],
  ripple: [waterFacilities]
};
```

## 🎯 Usage Examples

### Basic Usage
```javascript
import NodeAnimation from './nodeAnimation.js';

// Initialize animation system
const nodeAnimation = new NodeAnimation(map, updateToolFeedback);

// Add animations to infrastructure features
nodeAnimation.initializeNodeAnimations(infrastructureFeatures);

// Highlight specific feature
nodeAnimation.highlightFeature('facility-123', 3000);

// Update animations when data changes
nodeAnimation.updateFeatureAnimations(newFeatures);

// Stop all animations
nodeAnimation.stopAnimations();
```

### Complete Integration
```javascript
import CompleteAnimationIntegration from './nodeAnimationIntegration.js';

// Initialize complete system
const animationSystem = new CompleteAnimationIntegration(map, updateToolFeedback);

// Set up all integrations
animationSystem.initialize(serpTool, categoryToggle, legendContainer);

// Get debug information
const stats = animationSystem.getDebugInfo();
console.log('Animation Stats:', stats);
```

## 🔍 Debugging & Monitoring

### Animation Statistics
```javascript
const stats = nodeAnimation.getAnimationStats();
// Returns:
// {
//   isRunning: true,
//   activeSources: 3,
//   totalFeatures: 45,
//   animationFrame: true
// }
```

### Visual Priority Debugging
```javascript
// Features are enriched with debug properties
const enrichedFeature = {
  properties: {
    visual_priority: 85,        // 0-100 priority score
    status_indicator: 'excellent', // excellent/good/fair/poor
    animation_type: 'pulse',    // Animation type being used
    effect_type: 'energy_pulse' // Specific effect name
  }
};
```

## 🚀 Future Enhancements

### Planned Features
1. **Weather-Based Effects**: Animations that respond to weather conditions
2. **Real-Time Data Integration**: Live updates from monitoring systems
3. **User Interaction Effects**: Hover states and click animations
4. **Sound Integration**: Audio feedback for critical alerts
5. **Accessibility Features**: High contrast modes and reduced motion options

### Custom Animation Types
```javascript
// Easy to add new animation types
const customAnimation = {
  radiusExpression: [/* custom radius logic */],
  colorExpression: [/* custom color logic */],
  opacityExpression: [/* custom opacity logic */],
  blurExpression: 1.0
};
```

This animation system transforms the simple size-based marker system into a rich, data-driven visual experience that communicates infrastructure status, criticality, and relationships through sophisticated animations and effects.
