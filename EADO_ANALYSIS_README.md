# Gentrification Analysis Workflow

## Overview
This workflow analyzes FIFA investment impact on downtown Houston gentrification patterns using local data processing, Perplexity AI analysis, and interactive map visualization.

## Process Flow

### 1. Data Processing (`gentrification-spatial-analyzer.js`)
- **Input**: 4 data layers (FIFA, Listings, TDLR, Companies)
- **Analysis**: Investment clustering, affordability impact, construction impact, economic density, displacement risk
- **Output**: `public/gentrification-analysis-prompt.json`

**Key Functions:**
- `analyzeInvestmentClustering()` - Identifies high-priority FIFA feature clusters ($54M investment)
- `analyzeAffordabilityImpact()` - Analyzes 2,609 residential listings with price patterns and gentrification potential
- `analyzeConstructionImpact()` - Evaluates 120 active TDLR projects worth $277.7M for gentrification triggers
- `analyzeEconomicDensity()` - Maps 1,000 companies across 187 industries for economic activity patterns
- `analyzeDisplacementRisk()` - Finds areas with high investment but low residential density

### 2. AI Analysis (`query-perplexity-gentrification.sh`)
- **Input**: `gentrification-analysis-prompt.json`
- **Process**: Sends structured prompt to Perplexity API (sonar model)
- **Output**: `perplexity-gentrification-response.json` → `gentrification-analysis-geojson.json`

**Features:**
- Environment variable security (`PERPLEXITY_API_KEY`)
- Automatic dependency checking
- JSON escaping with `jq`
- GeoJSON extraction and cleaning
- Enhanced prompt with real estate market context, construction impact, and economic density

### 3. Map Visualization (`PerplexityCall.jsx` + Utilities)
- **Input**: `gentrification-analysis-geojson.json`
- **Display**: Interactive circles with impact radius, pulsing markers, animated particles
- **Interaction**: Click for detailed popup with risk metrics

**Visual Elements:**
- **Circles**: Zoom-responsive sizing based on `impact_radius_meters`
- **Pulsing Markers**: Animated internal markers (like TDLRLayer)
- **Radius Particles**: 240+ animated particles showing impact boundaries (larger and tighter)
- **Color Coding**: Red (high risk), Orange (medium-high), Yellow (medium), Gray (low)

**Refactored Architecture:**
- **`PerplexityCall.jsx`**: Main component (327 lines, 76% reduction from 1,389 lines)
- **`gentrificationConfig.js`**: Centralized configuration and constants
- **`gentrificationMapUtils.js`**: Map layer management utilities
- **`gentrificationParticleUtils.js`**: Particle animation utilities
- **`gentrificationPulseUtils.js`**: Pulse animation utilities
- **`gentrificationPopupUtils.js`**: Popup and interaction utilities

## Usage

```bash
# 1. Process data layers
node gentrification-spatial-analyzer.js

# 2. Query Perplexity AI
./query-perplexity-gentrification.sh

# 3. Visualize on map
# Click blue Perplexity button in UI
```

## Output Properties
- `gentrification_risk` (0-1) - Risk score based on investment clustering and market pressure
- `timeline_to_unaffordable` (months) - Projected timeline for displacement
- `development_momentum_score` (0-10) - Construction and economic activity intensity
- `impact_radius_meters` (meters) - Geographic extent of gentrification impact
- `displacement_risk_factors` (array) - Specific risk factors (price increases, development pressure, etc.)
- `investment_cluster_proximity` (string) - Proximity to major investment zones
- `neighborhood_name` (Downtown/Midtown/EaDo) - Geographic neighborhood identifier

## Data Sources
- **FIFA Data**: `public/fifa-houston-cache.json` - 129 high-priority features, $54M investment
- **Listings Data**: `public/Listings/houston_downtown_master_CLEANED.geojson` - 2,609 residential properties
- **TDLR Data**: `public/Listings/TLDR/tdlr_houston_all_precise.geojson` - 120 active construction projects, $277.7M value
- **Company Data**: `public/companies/companies-9-24-2025-geocoded.json` - 1,000 companies across 187 industries

## Files

### Core Analysis
- `gentrification-spatial-analyzer.js` - Enhanced local data processing with 5 analysis functions
- `query-perplexity-gentrification.sh` - Perplexity API integration with JSON cleaning
- `public/gentrification-analysis-geojson.json` - Final GeoJSON output with 3 high-risk zones

### Map Visualization (Refactored)
- `src/components/Map/components/Cards/PerplexityCall.jsx` - Main component (327 lines, 76% reduction)
- `src/constants/gentrificationConfig.js` - Centralized configuration and constants
- `src/utils/gentrificationMapUtils.js` - Map layer management utilities
- `src/utils/gentrificationParticleUtils.js` - Particle animation utilities  
- `src/utils/gentrificationPulseUtils.js` - Pulse animation utilities
- `src/utils/gentrificationPopupUtils.js` - Popup and interaction utilities

### Key Improvements
- **Modular Architecture**: Separated concerns into focused utility files
- **Maintainability**: 76% reduction in main component size (1,389 → 327 lines)
- **Enhanced Particles**: Larger, tighter particle animation with improved visibility
- **Better Organization**: Constants, map layers, animations, and popups in separate modules

## Refactoring Details

### Phase 1: Configuration Extraction
- Extracted all hardcoded values to `gentrificationConfig.js`
- Centralized layer IDs, source IDs, colors, thresholds, and animation parameters
- Created helper functions for color calculation and factor computation

### Phase 2: Utility Module Creation
- **Map Utils**: Layer cleanup, data source management, static/pulse layer creation
- **Particle Utils**: Complex particle animation logic with momentum-based patterns
- **Pulse Utils**: Temporal urgency-based pulse animation system
- **Popup Utils**: Interactive popup creation and hover effects

### Performance & Maintainability Benefits
- **Code Reusability**: Utility functions can be used by other components
- **Easier Testing**: Individual functions can be unit tested in isolation
- **Better Debugging**: Focused modules make issue identification faster
- **Enhanced Readability**: Main component focuses on orchestration, not implementation
- **Future-Proof**: New features can be added to specific utility modules
