# Timeline Graph Toggle Implementation Plan

## Overview
Add a new toggle in LayerToggle.jsx that, when enabled:
- Reduces the height of the map container (to make room for the graph)
- Displays a dark-themed timeline graph at the bottom of the screen
- Shows a horizontal timeline chart with fake data

## Understanding Current Architecture

### LayerToggle.jsx Structure
1. **Component Pattern**: `LayerToggle` is a `forwardRef` component that manages layer visibility states
2. **State Management**: 
   - Receives state setters as props from parent `Map` component (`src/components/Map/index.jsx`)
   - Uses `useImperativeHandle` to expose `updateLayerStates` method for external updates
   - Manages layer visibility through individual layer components (e.g., `InfrastructureLayer`, `LandcoverLayer`)
3. **Toggle Implementation Pattern**:
   - Each toggle has a `CategorySection` with `CategoryHeader` and `ToggleSwitch`
   - State is passed to corresponding layer components
   - State is tracked in parent Map component and synced with SceneManager

### Map Container Structure
- **Location**: `src/components/Map/index.jsx`
- **Container**: `MapContainer` styled component (from `src/components/Map/styles/MapStyles.js`)
  - Current: `height: 100vh` (full viewport height)
  - Positioned absolutely: `position: relative`, `width: 100vw`, `height: 100vh`
- **Map Div**: `<div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />`
  - Currently fills entire container (top: 0, bottom: 0)

### Graph/Chart Examples Found
- `src/components/Map/components/Cards/AgriculturalTrendChart.jsx` - Uses Recharts (AreaChart, LineChart)
- `src/components/Map/AIChatPanel/components/VisualizationDisplay.jsx` - Uses Recharts (BarChart, ResponsiveContainer)
- Charts use dark theme with colors like `#374151`, `#9ca3af`, `#e5e7eb`

## Implementation Plan

### Phase 1: Add State Management

#### 1.1 In `src/components/Map/index.jsx`:
```javascript
// Add new state for timeline graph toggle
const [showTimelineGraph, setShowTimelineGraph] = useState(false);
```

#### 1.2 Pass to LayerToggle component:
```javascript
<LayerToggle
  // ... existing props
  showTimelineGraph={showTimelineGraph}
  setShowTimelineGraph={setShowTimelineGraph}
/>
```

#### 1.3 Update layerStates for SceneManager:
```javascript
const [layerStates, setLayerStates] = useState({
  // ... existing states
  showTimelineGraph: false,
});
```

### Phase 2: Create Timeline Graph Component

#### 2.1 Create new component: `src/components/Map/components/TimelineGraphPanel.jsx`
- **Purpose**: Renders the dark-themed horizontal timeline graph
- **Positioning**: Fixed at bottom of screen
- **Height**: ~200-250px (configurable)
- **Width**: 100vw
- **Styling**: Dark theme matching existing design system
  - Background: `rgba(0, 0, 0, 0.95)` or `#1f2937`
  - Border: `1px solid rgba(255, 255, 255, 0.1)`
  - Text color: `#e5e7eb`

#### 2.2 Graph Implementation:
- **Library**: Use Recharts (already in use: `recharts` package)
- **Chart Type**: Horizontal timeline with multiple metrics
- **Data Structure**: Generate fake time series data
  ```javascript
  const generateFakeTimelineData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, index) => ({
      month,
      value: Math.random() * 100,
      secondary: Math.random() * 80,
      // Add more metrics as needed
    }));
  };
  ```

#### 2.3 Component Structure:
```jsx
<TimelineGraphContainer $visible={showTimelineGraph}>
  <TimelineGraphHeader>
    <h3>Timeline Analysis</h3>
  </TimelineGraphHeader>
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={timelineData}>
      {/* Chart configuration */}
    </LineChart>
  </ResponsiveContainer>
</TimelineGraphContainer>
```

### Phase 3: Add Toggle to LayerToggle.jsx

#### 3.1 Add Category Section:
```jsx
{/* Timeline Graph Section */}
<CategorySection>
  <CategoryHeader onClick={() => setShowTimelineGraph(v => !v)} style={{ cursor: 'pointer' }}>
    <CategoryIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18M7 12l4-4 4 4 6-6" />
      </svg>
    </CategoryIcon>
    <CategoryTitle>Timeline Graph</CategoryTitle>
    <ToggleSwitch>
      <input
        type="checkbox"
        checked={showTimelineGraph}
        onClick={e => e.stopPropagation()}
        onChange={() => setShowTimelineGraph(v => !v)}
      />
      <span></span>
    </ToggleSwitch>
  </CategoryHeader>
</CategorySection>
```

#### 3.2 Add prop handling:
- Add to `forwardRef` props: `showTimelineGraph`, `setShowTimelineGraph`
- Add to `useImperativeHandle` dependencies
- Add to `onTransmissionLayerStateUpdate` state object
- Add to `updateLayerStates` method

### Phase 4: Adjust Map Container Height

#### 4.1 In `src/components/Map/index.jsx`:
Modify the map container div to conditionally adjust bottom:
```jsx
<div 
  ref={mapContainer} 
  style={{ 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: showTimelineGraph ? '250px' : '0' // Adjust based on graph height
  }} 
/>
```

#### 4.2 Alternative: Use styled-components wrapper:
```jsx
<MapWrapper $hasGraph={showTimelineGraph}>
  <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
</MapWrapper>
```

#### 4.3 Trigger map resize:
```javascript
useEffect(() => {
  if (map.current) {
    // Trigger map resize when graph visibility changes
    setTimeout(() => {
      map.current.resize();
    }, 100);
  }
}, [showTimelineGraph]);
```

### Phase 5: Create Styled Components

#### 5.1 In `src/components/Map/styles/MapStyles.js` or new file:
```javascript
export const TimelineGraphContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${props => props.$visible ? '250px' : '0'};
  background: rgba(31, 41, 55, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
  transition: height 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(8px);
`;

export const TimelineGraphHeader = styled.div`
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  h3 {
    margin: 0;
    color: #e5e7eb;
    font-size: 16px;
    font-weight: 500;
  }
`;

export const TimelineChartContainer = styled.div`
  padding: 20px;
  height: calc(100% - 60px);
`;
```

### Phase 6: Integration Points

#### 6.1 Import TimelineGraphPanel in Map component:
```javascript
import TimelineGraphPanel from './components/TimelineGraphPanel';
```

#### 6.2 Render conditionally:
```jsx
{showTimelineGraph && (
  <TimelineGraphPanel 
    data={timelineData}
    visible={showTimelineGraph}
  />
)}
```

#### 6.3 Update SceneManager integration:
- Add `showTimelineGraph` to `layerStates` object passed to SceneManager
- Handle in `onLoadScene` callback to restore state

## File Structure Summary

```
src/components/Map/
├── index.jsx                    # Add state, pass props, render TimelineGraphPanel
├── components/
│   ├── LayerToggle.jsx          # Add toggle UI section
│   └── TimelineGraphPanel.jsx   # NEW: Graph component
└── styles/
    └── MapStyles.js             # Add styled components for graph
```

## Data Structure for Fake Timeline Data

```javascript
// Example timeline data structure
const timelineData = [
  { month: 'Jan 2024', value: 45, secondary: 32 },
  { month: 'Feb 2024', value: 52, secondary: 38 },
  { month: 'Mar 2024', value: 48, secondary: 35 },
  // ... more months
];

// Multiple metrics could be:
- Development Activity (value)
- Infrastructure Projects (secondary)
- Population Growth (tertiary)
- Economic Indicators (quaternary)
```

## Design Considerations

1. **Graph Height**: 200-250px recommended (adjustable)
2. **Transition**: Smooth height animation (0.3s ease)
3. **Dark Theme Colors**:
   - Background: `#1f2937` or `rgba(0, 0, 0, 0.95)`
   - Text: `#e5e7eb`
   - Grid lines: `rgba(148, 163, 184, 0.3)`
   - Accent colors: Match existing layer colors
4. **Responsive**: Consider mobile viewport adjustments
5. **Z-index**: Ensure graph appears above map but below modals (z-index: 10)
6. **Map Resize**: Trigger `map.resize()` after animation completes

## Testing Checklist

- [ ] Toggle shows/hides graph correctly
- [ ] Map container height adjusts when toggle is on
- [ ] Map properly resizes and recenters
- [ ] Graph renders with fake data
- [ ] Dark theme styling matches design system
- [ ] Animation is smooth
- [ ] Works with SceneManager (saves/loads state)
- [ ] Mobile responsive
- [ ] No layout shifts or visual glitches

## Dependencies

- `recharts`: Already in use for charts
- No new dependencies required

## Notes

- Timeline graph should not interfere with existing map interactions
- Consider making graph height configurable via props
- Future enhancement: Make timeline data dynamic (connected to actual map data)

