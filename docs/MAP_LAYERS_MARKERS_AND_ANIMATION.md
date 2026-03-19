# Map Layers: Markers, Text, and Animation

This doc describes how we animate and visualize markers and layers in the MEM map, and how the layers in **LayerToggle** are wired and styled.

---

## 1. How layers are wired

### LayerToggle and visibility

- **`LayerToggle.jsx`** is the left sidebar that lists map layers. Each row is a **CategorySection**: icon, **CategoryTitle**, and a **ToggleSwitch** (checkbox).
- State lives in **`Map/index.jsx`**: one `useState` per layer (e.g. `showXAISitesPublic`, `showMLGW2026`). Toggle handlers flip that state.
- Each layer component is rendered unconditionally but receives **`map`** (ref to the Mapbox instance) and **`visible`** (boolean). Example:

```jsx
<XAISitesPublicLayer map={map} visible={!!showXAISitesPublic} />
```

- When **`visible`** is `false`, the layer’s `useEffect` cleans up: it removes its Mapbox layers and source, closes popups, and cancels any animations. When `visible` becomes `true`, it fetches data (if needed), adds the source and layers, and starts any animations.

### Layers currently in LayerToggle

| Toggle label | Component | Main geometry |
|--------------|-----------|----------------|
| Memphis Counties | MemphisCountiesLayer | fill + line (polygons) |
| US Power Grid (HIFLD) | HIFLDTransmissionLayer | line |
| AI Power Expansion | MemphisAIExpansionLayer | — |
| MLGW FY2026 Substation Work | MLGW2026SubstationLayer | fill (poly) + circle (points) |
| xAI Sites (Public) | XAISitesPublicLayer | circle + symbol (text) |
| xAI → Nearest MLGW Substation | XAIToMLGWLinesLayer | line + symbol (labels) |
| Memphis Colossus Change (2023→2024) | MemphisColossusChangeLayer | fill-extrusion + line (circle) |
| Memphis Colossus top parcels | MemphisColossusTopParcelsLayer | fill |
| Memphis/DPD permits (5km Colossus) | ColossusPermitsLayer | circle |
| DeSoto/Southaven permits | DesotoPermitsLayer | circle |
| DeSoto Stateline parcel | DesotoStatelineParcelLayer | fill + line |
| Texas Data Centers | TexasDataCentersLayer | circle/symbol |
| REIT Properties | REITLayer | circle |

---

## 2. Point markers: circles and symbols (text)

### Circle layer (points)

Point data is usually drawn with a **circle** layer:

- **Source**: GeoJSON with `Point` (or feature collection). Often loaded from a URL and set with `addSource(SOURCE_ID, { type: 'geojson', data, generateId: true })`.
- **Paint**:
  - **circle-radius**: often zoom-dependent via `['interpolate', ['linear'], ['zoom'], z1, r1, z2, r2, ...]` so markers scale with zoom.
  - **circle-color**: fixed (e.g. `#a78bfa`) or **data-driven** with `['match', ['get', 'property'], value1, color1, ..., fallback]` (e.g. by `Sub_Type` or `company`).
  - **circle-opacity**: e.g. `0.85` or `0.9`. Some layers use **circle-stroke-width** and **circle-stroke-color** (REIT uses a white stroke).

Examples:

- **XAISitesPublicLayer**: circles + a **symbol** layer for labels (`label_text` from `phase` or "xAI").
- **ColossusPermitsLayer**: circles colored by `Sub_Type` (COM vs RES) via `['match', ['get', 'Sub_Type'], ...]`.
- **MLGW2026SubstationLayer**: circles for substation points; radius by zoom.
- **REITLayer**: circles colored by `company`; no symbol layer (popup on click).

### Symbol layer (text labels)

Text on the map is done with a **symbol** layer:

- **Source**: Same GeoJSON as the circles, or a **derived** GeoJSON (e.g. line midpoints for distance labels).
- **Layout**:
  - **text-field**: `['get', 'label_text']` (or a string). The property is often set when processing features (e.g. `phase`, or `"X km"` for lines).
  - **text-font**: e.g. `['Open Sans Semibold', 'Arial Unicode MS Bold']`.
  - **text-size**: zoom-interpolated so labels scale: `['interpolate', ['linear'], ['zoom'], 6, 12, 10, 14, 14, 18]`.
  - **text-anchor**: e.g. `'bottom'` for points so the label sits above the dot.
  - **text-offset**: e.g. `[0, -1.8]` to nudge the label up.
  - **text-allow-overlap** / **text-ignore-placement**: typically `false` for cleaner collision handling.
- **Paint**:
  - **text-color**: e.g. `#ffffff`.
  - **text-halo-width**: `2` and **text-halo-color**: `rgba(0,0,0,0.6)` so text stays readable on any background.

**XAIToMLGWLinesLayer** builds a separate GeoJSON of **points** at line midpoints with `label_text: "X km"`, then adds a symbol layer from that source so each line shows its distance.

---

## 3. Lines and fills

### Line layers

- **line-color**, **line-width** (often zoom-interpolated), **line-dasharray** for dashed lines (e.g. xAI→MLGW links: `[2, 2]`).
- **XAIToMLGWLinesLayer**: LineString source; one line per feature; labels from a midpoint point source.
- **MemphisColossusChangeLayer**: Turf.js `turf.circle()` to draw a dashed orange circle (line layer) around the Colossus site.

### Fill layers

- **fill-color**, **fill-opacity**. Used for:
  - **MLGW2026SubstationLayer**: polygon “advantage zone” with a **pulsing** opacity (see Animation).
  - **MemphisCountiesLayer**: polygons with **feature-state** for hover/selected/adjacent (see Data-driven styling).
  - **DesotoStatelineParcelLayer**: single parcel polygon; semi-transparent purple fill and outline.

### Fill-extrusion (3D)

- **MemphisColossusChangeLayer** uses **fill-extrusion** for change polygons:
  - **fill-extrusion-height**: data-driven from `area_m2` via an `interpolate` expression so larger areas are taller.
  - **fill-extrusion-color**: `match` on `change_label` (vegetation_gain, industrial_expansion, etc.).
  - A second extrusion layer (“industrial halo”) filters to industrial only and uses **fill-extrusion-opacity** animation for a pulse (see Animation).

---

## 4. Animation

### requestAnimationFrame pulse (fill-opacity)

**MLGW2026SubstationLayer** animates the advantage-zone **fill-opacity** in a loop:

```js
const startPulse = () => {
  const duration = 2000;
  const animate = () => {
    const elapsed = (Date.now() - startTime) % duration;
    const progress = elapsed / duration;
    const opacity = 0.04 + 0.03 * Math.sin(progress * Math.PI * 2);
    mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', opacity);
    pulseAnimationRef.current = requestAnimationFrame(animate);
  };
  pulseAnimationRef.current = requestAnimationFrame(animate);
};
```

- Store the frame id in a **ref** (`pulseAnimationRef`) so the effect cleanup can call `cancelAnimationFrame` when the layer is turned off or unmounted.

### requestAnimationFrame pulse (fill-extrusion-opacity)

**MemphisColossusChangeLayer** pulses the industrial halo extrusion:

```js
const opacity = 0.25 + 0.25 * Math.sin(t * Math.PI * 2);
mapInstance.setPaintProperty(INDUSTRIAL_HALO_LAYER_ID, 'fill-extrusion-opacity', opacity);
```

- Same pattern: loop with `requestAnimationFrame`, cleanup on unmount or when `visible` becomes false.

### Feature-state (hover / selection)

**MemphisCountiesLayer** uses Mapbox **feature state** for hover and selection without re-fetching data:

- **setFeatureState({ source, id }, { hover: true })** on mouseenter; **hover: false** on mouseleave.
- **setFeatureState** for **selected** and **adjacent** on click (e.g. highlight clicked county and neighbors).
- Paint expressions read state: **['boolean', ['feature-state', 'hover'], false]** and **feature-state selected/adjacent** to drive **fill-color** and **fill-opacity** (e.g. hover/selected use a bright tint and higher opacity).

This gives instant visual feedback and is the main “animation” for county interaction.

---

## 5. Popups

### mapboxgl.Popup + HTML string

Most layers use **mapboxgl.Popup** with **setHTML()**:

- On **click** (or click on a specific layer), **queryRenderedFeatures(e.point, { layers: [LAYER_ID] })**.
- If a feature is found, build an HTML string from its **properties** (and optionally geometry) and show a popup at **e.lngLat** (or feature coordinates).
- Popup options: **closeButton**, **closeOnClick: false**, **anchor: 'bottom'**, **offset**, **className: 'memphis-layer-popup'** for styling.
- Keep a **popupRef**; on cleanup or when the layer is hidden, call **popupRef.current.remove()** and set ref to null.

### Shared popup styling (Memphis layers)

Several Memphis layers inject a global style block (once) so **.memphis-layer-popup** has:

- Transparent popup content wrapper (no default Mapbox background).
- No tip; no extra border.

Popup **content** is then raw HTML with inline styles: dark card (`rgba(17, 24, 39, 0.95)`), rounded corners, badges (e.g. status, phase, PIN), and links. This keeps a consistent “Memphis” card look (see **MLGW2026SubstationLayer**, **DesotoStatelineParcelLayer**, **XAISitesPublicLayer**, etc.).

### REITLayer: React state popup

**REITLayer** does not use Mapbox Popup. It keeps **popup** in React state (`{ lng, lat, properties }`) and renders a custom positioned div (e.g. `position: 'absolute'`, centered, fixed top). So “popup” here is a React component, not a Mapbox popup instance.

---

## 6. Data-driven styling

- **circle-color** / **fill-color** by property: **['match', ['get', 'property'], value1, color1, ..., fallback]** or **['case', condition1, color1, ..., fallback]**.
- **MemphisCountiesLayer** combines:
  - **feature-state** (hover, selected, adjacent) for interactivity.
  - **get('project_count')** with **interpolate** for a color ramp and for **fill-opacity** (more projects → more opaque).
- **MemphisColossusChangeLayer**: **match** on `change_label` for extrusion color; **interpolate** on `area_m2` for extrusion height.

---

## 7. Lifecycle and cleanup

Each layer’s `useEffect` depends on **map** and **visible**:

1. If **!visible**: remove popup, cancel animations (cancelAnimationFrame), remove layers in reverse order, remove source, return.
2. If **visible**: set a **cancelled** flag, fetch data if needed (async), then add source and layers, attach click/mouse listeners, start animations. **Cleanup** (return of useEffect): set cancelled, remove listeners, remove layers, remove source, clear popup and animation refs.

Order of removal: **labels → circles/lines/fill → source**, so nothing references a removed layer or source.

---

## 8. Quick reference: layer → techniques

| Layer | Markers / geometry | Text | Animation | Popup |
|-------|--------------------|------|-----------|--------|
| XAISitesPublicLayer | circle | symbol (`label_text`) | — | Mapbox Popup, HTML |
| MLGW2026SubstationLayer | circle + fill | symbol (substation #) | fill-opacity pulse | Mapbox Popup, HTML |
| XAIToMLGWLinesLayer | line | symbol at midpoints (km) | — | Mapbox Popup, HTML |
| ColossusPermitsLayer | circle (color by Sub_Type) | — | — | Mapbox Popup, HTML |
| DesotoStatelineParcelLayer | fill + line | — | — | Mapbox Popup, HTML |
| MemphisColossusChangeLayer | fill-extrusion + line | — | fill-extrusion-opacity pulse (halo) | Mapbox Popup, HTML |
| MemphisCountiesLayer | fill + line | — | feature-state (hover/selected) | React/NeighborhoodPopup or similar |
| REITLayer | circle (color by company) | — | — | React state popup (div) |

This should give a clear picture of how we animate and visualize markers and layers and how the LayerToggle layers use text, animation, and popups.
