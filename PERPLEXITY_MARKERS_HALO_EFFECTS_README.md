# Perplexity Button Markers & Halo Particle Effects Documentation

## Overview

This document details how clicking the blue Perplexity circle button in `NestedCircleButton.jsx` triggers markers and halo particle effects in the Houston area. This system creates an interactive gentrification risk visualization with animated particles, pulsing markers, and tear-drop location pins.

## Trigger Flow

### 1. User Interaction
- **Location**: `src/components/Map/components/Cards/NestedCircleButton.jsx` (lines 906-929)
- **Button**: Blue Perplexity circle (`rgba(59, 130, 246, 0.8)` when inactive, `rgba(59, 130, 246, 1)` when active)
- **Click Handler**: Calls `onPerplexityModeToggle()` prop function

### 2. Mode Toggle
- **Location**: `src/components/Map/components/Cards/BaseCard.jsx` (lines 407-429)
- **Function**: `handlePerplexityModeToggle()`
- **Action**: Toggles `isPerplexityMode` state and resets other UI states

### 3. PerplexityCall Component Activation
- **Location**: `src/components/Map/components/Cards/PerplexityCall.jsx` (lines 394-471)
- **Function**: `handleClick()` is triggered
- **Sequence**:
  1. Checks if map is available
  2. Sets loading state
  3. Calls `loadGentrificationAnalysis()` if not already loaded
  4. Calls `cleanupGentrification()` if already loaded (toggle behavior)

### 4. Data Loading
- **Location**: `src/components/Map/components/Cards/PerplexityCall.jsx` (lines 40-115)
- **Function**: `loadGentrificationAnalysis()`
- **Data Source**: `/gentrification-analysis-geojson.json`
- **Progress Feedback**:
  - 20%: "📊 Loading gentrification data..."
  - 40%: "⚡ Loading local gentrification data..."
  - Then calls `processGentrificationData()`

### 5. Map Layer Processing
- **Location**: `src/components/Map/components/Cards/PerplexityCall.jsx` (lines 231-361)
- **Function**: `processGentrificationData()`
- **Sequence** (with timing):
  1. **0ms**: Cleanup existing layers
  2. **~50ms**: Add CSS styles (`addGentrificationStyles()`)
  3. **~100ms**: Add data source (`addGentrificationDataSource()`)
  4. **~150ms**: Add pulse source (`addPulseSource()`)
  5. **~200ms**: Add pulse markers layer (`addPulseMarkersLayer()`)
  6. **~250ms**: Add static circle markers layer (`addStaticCircleMarkersLayer()`)
  7. **~300ms**: Add particles layer (`addParticlesLayer()`)
  8. **~350ms**: Start particle animation (`startParticleAnimation()`)
  9. **~400ms**: Start pulse animation (`startGentrificationPulseAnimation()`)
  10. **~450ms**: Add tear-drop markers (`addTearDropMarkers()`)
  11. **~500ms**: Add click and hover handlers

## Visual Elements

### 1. Tear-Drop Markers (Location Pins)

**Implementation**: `src/components/Map/components/Cards/PerplexityCall.jsx` (lines 118-228)

**Type**: Mapbox GL Markers (native Mapbox markers)

**Colors by Risk Level**:
- **Critical Risk (≥0.85)**: `#dc2626` (Red) - Size: 1.5x
- **High Risk (≥0.8)**: `#ea580c` (Orange) - Size: 1.2x
- **Medium Risk (≥0.6)**: `#f59e0b` (Yellow) - Size: 1.0x
- **Low Risk (<0.6)**: `#6b7280` (Gray) - Size: 0.8x

**Properties**:
- Uses `mapboxgl.Marker()` with color and scale
- Includes popup with risk level information
- Stored in `window.gentrificationTeardropMarkers` for cleanup

**Timing**: Appears at ~450ms after button click

### 2. Halo Particle Effects (Rotating Particles)

**Implementation**: `src/utils/gentrificationParticleUtils.js`

**Configuration**: `src/constants/gentrificationConfig.js` (lines 5-48)

#### Particle Creation
- **Function**: `createGentrificationRadiusParticles()`
- **Base Count**: 8 particles per risk center
- **Extra Particles**: 
  - +4 if momentum ≥ 9.0
  - +2 if momentum ≥ 8.0
- **Total Range**: 8-12 particles per center

#### Particle Properties

**Size** (based on zoom and momentum):
- **Zoom 8**: 
  - Low momentum (≤7.0): 1.0px
  - Medium momentum (≤8.5): 1.2px
  - High momentum (>8.5): 1.6px
- **Zoom 12**: 1.5x multiplier
- **Zoom 16**: 2.0x multiplier
- **Zoom 20**: 2.5x multiplier

**Colors** (by neighborhood and risk):
- **Downtown**:
  - Low/Medium risk: `#059669` (Green)
  - High risk (≥0.9): `#dc2626` (Red)
- **Midtown**:
  - Low risk: `#059669` (Green)
  - Medium risk (≥0.85): `#ea580c` (Orange)
  - High risk (≥0.9): `#dc2626` (Red)
- **EaDo**:
  - Low risk: `#0891b2` (Teal)
  - Medium risk (≥0.85): `#c2410c` (Dark Orange)
  - High risk (≥0.9): `#dc2626` (Red)
- **Default**:
  - Critical (≥0.85): `#dc2626` (Red)
  - High (≥0.8): `#ea580c` (Orange)
  - Low: `#6b7280` (Gray)

**Radius Distribution**:
- Particles positioned at 40-100% of impact radius
- Impact radius: 300m base, adjusted by risk level (0.2-0.8x multiplier)
- Final radius: ~60-240 meters from center

**Animation**:
- **Rotation Speed**: `0.3 + random(0.7) * 0.002` radians per millisecond
- **Speed Range**: 0.0003 - 0.002 radians/ms (slow, visible rotation)
- **Update Rate**: `requestAnimationFrame()` (60fps target)
- **Animation Frame**: Stored in `window.perplexityGentrificationRadiusAnimationFrame`

**Visual Style**:
- **Circle Radius**: Dynamic based on particle size property
- **Circle Color**: From particle color property
- **Circle Stroke**: White (`#ffffff`), 0.5px width
- **Circle Opacity**: 0.9 (90% opaque)

**Timing**: Animation starts at ~350ms after button click

### 3. Pulse Markers (Animated Pulsing Circles)

**Implementation**: `src/utils/gentrificationPulseUtils.js`
**Layer Configuration**: `src/utils/gentrificationMapUtils.js` (lines 112-309)

#### Pulse Animation Properties

**Period**: 3.0 seconds (continuous loop)

**Radius Animation** (varies by zoom and timeline urgency):
- **Zoom 8**:
  - Start (pulse_t=0): 4-8px (low-high urgency)
  - Peak (pulse_t=0.3): 16-32px
  - Overshoot (pulse_t=0.7): 20-40px
  - Return (pulse_t=1.0): 4-8px
- **Zoom 12**:
  - Start: 8-16px
  - Peak: 32-64px
  - Overshoot: 40-80px
  - Return: 8-16px
- **Zoom 16**:
  - Start: 12-24px
  - Peak: 48-96px
  - Overshoot: 60-120px
  - Return: 12-24px

**Color** (by neighborhood and risk):
- Same color scheme as particles (see Particle Colors above)

**Opacity Animation** (based on development momentum):
- **Low Momentum (7.0)**:
  - Start: 0.4
  - Peak: 0.7
  - Overshoot: 0.3
  - Fade: 0.0
- **Medium Momentum (8.5)**:
  - Start: 0.6
  - Peak: 0.9
  - Overshoot: 0.5
  - Fade: 0.0
- **High Momentum (10.0)**:
  - Start: 0.8
  - Peak: 1.0
  - Overshoot: 0.7
  - Fade: 0.0

**Blur** (based on momentum):
- Low momentum (7.0): 1.0px blur
- High momentum (10.0): 0.3px blur

**Timing**: Animation starts at ~400ms after button click

### 4. Static Circle Markers

**Implementation**: `src/utils/gentrificationMapUtils.js` (lines 312-403)

**Purpose**: Base layer showing impact radius circles

**Size** (zoom-responsive, based on impact radius and momentum):
- **Zoom 8**: 3-15px (min 3px, max 15px or 0.008 * impact_radius_meters)
- **Zoom 12**: 4-30px (min 4px, max 30px or 0.015 * impact_radius_meters)
- **Zoom 16**: 6-60px (min 6px, max 60px or 0.03 * impact_radius_meters)
- **Zoom 20**: 8-100px (min 8px, max 100px or 0.06 * impact_radius_meters)

**Color**: Same neighborhood-based color scheme as particles

**Opacity** (based on timeline urgency):
- High urgency (12 months): 0.15
- Medium urgency (18 months): 0.1
- Low urgency (24 months): 0.05

**Timing**: Added at ~250ms after button click

## Complete Timing Sequence

```
0ms     - User clicks blue Perplexity button
0ms     - handleClick() triggered
50ms    - loadGentrificationAnalysis() starts
100ms   - Data fetch begins
150ms   - processGentrificationData() called
200ms   - Cleanup existing layers
250ms   - Add CSS styles
300ms   - Add data source
350ms   - Add pulse source
400ms   - Add pulse markers layer
450ms   - Add static circle markers layer
500ms   - Add particles layer
550ms   - Start particle animation (halo effects begin)
600ms   - Start pulse animation (pulsing circles begin)
650ms   - Add tear-drop markers (location pins appear)
700ms   - Add click/hover handlers
750ms   - Complete: "✅ Gentrification analysis loaded!"
```

## Color Palette Reference

### Risk-Based Colors
- **Critical Risk (≥0.85)**: `#dc2626` (Red)
- **High Risk (≥0.8)**: `#ea580c` (Orange)
- **Medium Risk (≥0.6)**: `#f59e0b` (Yellow)
- **Low Risk (<0.6)**: `#6b7280` (Gray)

### Neighborhood-Specific Colors
- **Downtown**: Green (`#059669`) to Red (`#dc2626`)
- **Midtown**: Green (`#059669`) → Orange (`#ea580c`) → Red (`#dc2626`)
- **EaDo**: Teal (`#0891b2`) → Dark Orange (`#c2410c`) → Red (`#dc2626`)

## Configuration Constants

**Location**: `src/constants/gentrificationConfig.js`

### Key Values
- **Particle Base Sizes**: 1.0px (small), 1.2px (medium), 1.6px (large)
- **Particle Rotation Speed**: 0.0004 radians/ms (slowed by 20% from original)
- **Pulse Period**: 3.0 seconds (slowed by 20% from original)
- **Impact Radius Base**: 300 meters
- **Particle Count per Center**: 8-12 particles
- **Timeline Urgency Range**: 0.5-2.0 factor
- **Development Momentum Range**: 7.0-10.0 score

## Cleanup Process

When the Perplexity button is clicked again (toggle off):

1. **Layers Removed**:
   - `perplexity-gentrification-circles`
   - `perplexity-gentrification-pulse-markers`
   - `perplexity-gentrification-radius-particles-layer`

2. **Sources Removed**:
   - `perplexity-gentrification-data`
   - `perplexity-gentrification-pulse-source`
   - `perplexity-gentrification-radius-particles`

3. **Animations Cancelled**:
   - `window.perplexityGentrificationRadiusAnimationFrame` (particles)
   - `window.perplexityGentrificationPulseAnimation` (pulse)

4. **Markers Removed**:
   - All tear-drop markers in `window.gentrificationTeardropMarkers`

## Replication Guide

To replicate this exact style and sequence elsewhere:

### 1. Required Files
- `src/components/Map/components/Cards/PerplexityCall.jsx`
- `src/utils/gentrificationParticleUtils.js`
- `src/utils/gentrificationPulseUtils.js`
- `src/utils/gentrificationMapUtils.js`
- `src/constants/gentrificationConfig.js`

### 2. Required Data Format
GeoJSON with features containing:
- `geometry.type`: "Point"
- `geometry.coordinates`: `[lng, lat]`
- `properties.gentrification_risk`: 0.0-1.0
- `properties.neighborhood_name`: "Downtown" | "Midtown" | "EaDo"
- `properties.development_momentum_score`: 7.0-10.0
- `properties.timeline_to_unaffordable`: months (12-24)
- `properties.impact_radius_meters`: meters

### 3. Implementation Steps
1. Import utilities: `addParticlesLayer`, `startParticleAnimation`, `startGentrificationPulseAnimation`
2. Load GeoJSON data
3. Add data source to map
4. Add layers in sequence (circles → pulse → particles)
5. Start animations (particles first, then pulse)
6. Add markers last
7. Store cleanup references for toggle behavior

### 4. Customization Points
- **Colors**: Modify `GENTRIFICATION_CONFIG.COLORS.NEIGHBORHOODS`
- **Particle Count**: Adjust `baseCount` in `createGentrificationRadiusParticles()`
- **Animation Speed**: Modify `rotationSpeed` in config (currently 0.0004)
- **Pulse Period**: Modify `pulsePeriod` in config (currently 3.0s)
- **Particle Sizes**: Adjust `BASE_SIZES` in config
- **Radius Distribution**: Modify `IMPACT_RADIUS` multipliers

## Performance Considerations

- **Particle Count**: Limited to 8-12 per center to maintain 60fps
- **Animation Frame Management**: Uses `requestAnimationFrame()` with cleanup
- **Zoom Responsiveness**: Particle sizes scale with zoom to maintain visibility
- **Memory Management**: All animations stored in `window.*` for global cleanup access

## Event Bus Integration

The system emits events via `window.mapEventBus`:
- `perplexity:gentrificationLoaded` - When analysis completes
- Data includes: `{ data, timestamp }`

## Notes

- All timing is approximate and may vary based on system performance
- Colors use hex format for consistency
- Particle animation uses radians for rotation calculations
- Pulse animation uses normalized time (0-1) for smooth interpolation
- All layers use Mapbox GL JS paint properties for hardware acceleration

