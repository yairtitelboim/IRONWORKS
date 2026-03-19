# LayerToggle Architecture Review

## How LayerToggle Works in Context

### Component Hierarchy

```
Map Component (index.jsx)
├── MapContainer (styled div, 100vh height)
│   └── mapContainer div (absolute positioned, fills container)
├── LayerToggle (forwardRef component)
│   ├── LayerToggleContainer (sidebar UI)
│   ├── CategorySection components (each toggle)
│   └── Layer Components (e.g., InfrastructureLayer, LandcoverLayer)
└── Other overlays (popups, modals, etc.)
```

### State Flow

1. **State Definition** (Map component):
   ```javascript
   const [showLandcover, setShowLandcover] = useState(false);
   const [showKeyInfrastructure, setShowKeyInfrastructure] = useState(false);
   // ... many more layer states
   ```

2. **State Passing** (Map → LayerToggle):
   ```javascript
   <LayerToggle
     showLandcover={showLandcover}
     setShowLandcover={setShowLandcover}
     showKeyInfrastructure={showKeyInfrastructure}
     setShowKeyInfrastructure={setShowKeyInfrastructure}
     // ... props for all layers
   />
   ```

3. **Toggle UI** (LayerToggle component):
   ```jsx
   <CategorySection>
     <CategoryHeader onClick={() => setShowLandcover(v => !v)}>
       <CategoryTitle>Land Cover 2020</CategoryTitle>
       <ToggleSwitch>
         <input
           type="checkbox"
           checked={showLandcover}
           onChange={() => setShowLandcover(v => !v)}
         />
       </ToggleSwitch>
     </CategoryHeader>
   </CategorySection>
   ```

4. **Layer Rendering** (LayerToggle component):
   ```jsx
   <LandcoverLayer
     map={map}
     visible={showLandcover}
   />
   ```

5. **Layer Component** (e.g., LandcoverLayer.jsx):
   - Receives `map` ref and `visible` prop
   - Uses `useEffect` to add/remove layers from mapbox
   - Updates map layers based on `visible` state

### Key Patterns

#### 1. **forwardRef Pattern**
```javascript
const LayerToggle = forwardRef(({ ...props }, ref) => {
  useImperativeHandle(ref, () => ({
    updateLayerStates: (newStates) => {
      // Update all layer states programmatically
      if (newStates.showLandcover !== undefined) 
        setShowLandcover(newStates.showLandcover);
      // ... more updates
    }
  }), [dependencies]);
});
```

**Purpose**: Allows parent Map component to update layer states programmatically (useful for SceneManager loading saved scenes)

#### 2. **State Synchronization**
```javascript
// LayerToggle notifies parent of state changes
useEffect(() => {
  if (onTransmissionLayerStateUpdate) {
    const timeoutId = setTimeout(() => {
      onTransmissionLayerStateUpdate({
        showLandcover,
        showKeyInfrastructure,
        // ... all states
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }
}, [showLandcover, showKeyInfrastructure, ...]);
```

**Purpose**: Keeps parent Map component informed of all layer state changes for SceneManager tracking

#### 3. **Layer Component Pattern**
```javascript
// Example: LandcoverLayer.jsx
const LandcoverLayer = ({ map, visible }) => {
  useEffect(() => {
    if (!map.current || !visible) return;
    
    // Add layer to mapbox
    map.current.addSource('landcover', { ... });
    map.current.addLayer({ ... });
    
    return () => {
      // Cleanup on unmount or when visible becomes false
      if (map.current.getLayer('landcover')) {
        map.current.removeLayer('landcover');
      }
    };
  }, [map, visible]);
  
  return null; // No UI, just manages map layers
};
```

### SceneManager Integration

1. **Saving Scenes**: SceneManager reads `layerStates` from Map component
2. **Loading Scenes**: SceneManager calls `layerToggleRef.current.updateLayerStates(newStates)`
3. **State Persistence**: All layer states are saved/restored together

### Map Container Structure

Current implementation:
```jsx
<MapContainer>  {/* height: 100vh, position: relative */}
  <div 
    ref={mapContainer} 
    style={{ 
      position: 'absolute', 
      top: 0, left: 0, right: 0, bottom: 0 
    }} 
  />
</MapContainer>
```

**For Timeline Graph**: Need to adjust `bottom` value of mapContainer div when graph is visible

### Styling System

- **Location**: `src/components/Map/styles/LayerToggleStyles.jsx`
- **Components**: 
  - `LayerToggleContainer` - Main sidebar container
  - `CategorySection` - Individual toggle section
  - `CategoryHeader` - Toggle header (clickable)
  - `ToggleSwitch` - Checkbox styling
  - `CategoryIcon` - Icon container
  - `CategoryTitle` - Text label

### Adding a New Toggle (Pattern)

1. **Add state in Map component**:
   ```javascript
   const [showMyNewLayer, setShowMyNewLayer] = useState(false);
   ```

2. **Pass to LayerToggle**:
   ```javascript
   <LayerToggle
     showMyNewLayer={showMyNewLayer}
     setShowMyNewLayer={setShowMyNewLayer}
   />
   ```

3. **Add UI in LayerToggle**:
   ```jsx
   <CategorySection>
     <CategoryHeader onClick={() => setShowMyNewLayer(v => !v)}>
       <CategoryIcon>...</CategoryIcon>
       <CategoryTitle>My New Layer</CategoryTitle>
       <ToggleSwitch>
         <input type="checkbox" checked={showMyNewLayer} />
       </ToggleSwitch>
     </CategoryHeader>
   </CategorySection>
   ```

4. **Create Layer Component** (if needed):
   ```jsx
   <MyNewLayer
     map={map}
     visible={showMyNewLayer}
   />
   ```

5. **Update state synchronization**:
   - Add to `onTransmissionLayerStateUpdate` object
   - Add to `updateLayerStates` method
   - Add to `useImperativeHandle` dependencies
   - Add to SceneManager `layerStates`

### Special Cases

#### Conditional Layer Effects
Some layers have complex initialization:
- **Road layers**: Modify existing mapbox layers
- **Park layers**: Filter and style mapbox base layers
- **TDLR layer**: Auto-enables after FIFA analysis completes (event-driven)

#### Event Bus Integration
```javascript
// Example: Casa Grande boundary toggle
window.mapEventBus.on('casa-grande-boundary:toggle', (enabled) => {
  setShowCasaGrandeBoundary(enabled);
});
```

Allows other components to control layer visibility programmatically.

## Summary

LayerToggle is a **state management UI component** that:
- Provides toggle switches for each map layer
- Renders corresponding layer components based on visibility
- Synchronizes state with parent Map component
- Integrates with SceneManager for saved scenes
- Uses forwardRef pattern for programmatic control

The actual map rendering happens in individual **Layer Components** that:
- Receive `map` ref and `visible` prop
- Manage mapbox layers via useEffect
- Clean up on unmount or when hidden

