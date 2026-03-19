# Casa Grande Custom Popup Implementation

## Summary
Successfully replaced Casa Grande Mapbox popup with custom draggable MarkerPopupCard. Refactored OSMCall.jsx by extracting marker creation logic.

## Changes Made

### 1. PopupCards.jsx
- Added `formatPinalData()` function with styled popup for Pinal County infrastructure analysis
- Matches existing popup styling with PC icon and proper formatting

### 2. MarkerPopupCard.jsx
- Added import for `formatPinalData`
- Added `isPinalMarker` check (highest priority)
- Updated render logic to use Pinal formatter when detected

### 3. MarkerPopupManager.jsx
- Added Pinal marker detection logic
- Added Pinal popup data creation with proper coordinates and formatter
- Positioned before TDLR check for proper priority

### 4. utils/pinalMarkers.js (NEW FILE)
- Extracted Casa Grande marker creation logic
- Added click handler that emits `marker:clicked` event
- Removed Mapbox popup entirely

### 5. OSMCall.jsx
- Added import for `createCasaGrandeMarker`
- Replaced 18 lines of marker creation code with single function call
- Removed `.setPopup()` call completely

## Key Features
- **Draggable popup**: Uses MarkerPopupCard's drag functionality
- **Custom styling**: Matches existing popup design system
- **Event-driven**: Uses mapEventBus for marker clicks
- **Refactored**: Extracted marker logic to utility file
- **No Mapbox popup**: Completely removed Mapbox popup

## Testing
1. Click Casa Grande marker → custom popup appears
2. Drag popup → moves smoothly
3. Close button → popup disappears
4. No Mapbox popup appears

## Files Modified
- `src/components/Map/components/PopupCards.jsx`
- `src/components/Map/components/Cards/MarkerPopupCard.jsx`
- `src/components/Map/components/Cards/MarkerPopupManager.jsx`
- `src/components/Map/components/Cards/OSMCall.jsx`
- `src/components/Map/components/Cards/utils/pinalMarkers.js` (new)

## Files Created
- `test-casa-grande-popup.html` (test file)
- `CASA_GRANDE_POPUP_IMPLEMENTATION.md` (this file)
