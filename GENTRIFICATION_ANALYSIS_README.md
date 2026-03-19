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
- **Refresh Analysis Button**: 🔄 button in popup to get updated Perplexity analysis for specific areas

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
- `src/api/perplexity-refresh.js` - API endpoint for refreshing Perplexity analysis

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

## Interactive Features

### Refresh Analysis Button
- **Location**: Top-left corner of popup cards (🔄 icon)
- **Functionality**: Transforms the PERPLEXITY REASONING section into prompt preview
- **Target**: Shows the exact prompt text that will be sent to Perplexity API
- **Integrated Design**: Uses existing popup space for minimal interface
- **API Endpoint**: `/api/perplexity-refresh` - Handles focused queries for specific neighborhoods

### Usage
1. Click on any gentrification risk circle to open popup
2. Click the 🔄 button to transform the reasoning section into prompt preview
3. Review the generated prompt text in the same space
4. Click "SEND" to execute the analysis or "Cancel" to restore original view
5. Watch the skeleton loading animation while the API processes the request
6. View updated analysis with fresh insights and sources

### Integrated Prompt Preview Features
- **Space Efficient**: Uses existing reasoning section space
- **Prompt Text**: Displays the exact query in monospace font with dark background
- **Scrollable Content**: Handles long prompts with scrollable text area
- **Minimal Buttons**: Small Cancel and Send buttons at the bottom
- **Seamless Transition**: Smooth transformation between reasoning and preview modes

### Dynamic Reasoning Section
- **Clickable Header**: Click "PERPLEXITY REASONING" to open full-screen modal
- **Modal Display**: Large, dedicated card for detailed analysis viewing
- **Fixed Height**: 300px scrollable area in popup for quick preview
- **Scrollable Content**: Vertical scrolling for long analysis responses
- **Custom Scrollbars**: Styled scrollbars matching the blue theme
- **Auto-scroll**: New content automatically scrolls to top
- **Responsive Layout**: Flexbox layout adapts to content length

### Perplexity Reasoning Modal
- **Full-Screen Modal**: Large, dedicated card for detailed analysis viewing
- **Clickable Header**: Opens when clicking "PERPLEXITY REASONING" in popup
- **Enhanced Display**: Larger text and better formatting for readability
- **Source Links**: Clickable source links with hover effects
- **Keyboard Support**: ESC key to close modal
- **Backdrop Click**: Click outside modal to close
- **Responsive Design**: Adapts to different screen sizes

### Dynamic Prompt Preview Section
- **Always Visible**: Content is always expanded and visible
- **Monospace Display**: Code-style font for easy prompt reading
- **Scrollable Content**: Vertical scrolling for long prompts
- **Dark Background**: Code-like appearance with dark background
- **Action Buttons**: Cancel and Send buttons within the content area
