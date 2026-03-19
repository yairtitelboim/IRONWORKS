# Plan: Mobile-Anchored BaseCard Layout

## Goal
When the app is viewed on mobile, the BaseCard (with AskAnythingInput, NestedCircleButton, etc.) should **not float** and should **not show a drag toggle**. Instead, it should be **anchored** at the top of the screen—like the search bar example (fixed, top-anchored, full-width with padding).

---

## Current Architecture Summary

### BaseCard.jsx
- **Position**: `position: fixed` with `left: position.lng`, `top: position.lat` (pixel values from CardManager)
- **Drag**: `handleMouseDown` on the drag handle → `handleMouseMove` / `handleMouseUp` update `currentRef.style.left` and `currentRef.style.top`
- **Two render modes**: Perplexity mode (minimal container) and Normal mode (full card)
- **Props**: `draggable`, `position`, `map`, etc.

### NestedCircleButton.jsx
- **Drag handle**: Small white circle (lines 459–493) with `onMouseDown={handleMouseDown}`, `cursor: grab/grabbing`
- **Other controls**: Main + button, Location selector, Clear, MCP, GeoAI, OSM, Firecrawl, Perplexity
- **Receives**: `isDragging`, `handleMouseDown` from BaseCard

### AskAnythingInput.jsx
- Search input component; no direct connection to drag or positioning
- Fixed width 320px; will need responsive width on mobile

### Connected Components
- **LegendContainer**: Positioned `left: 340px` (to the right of 320px card)
- **SidePanel**: Inside card, left side
- **CardManager**: Provides `position` (lng/lat in pixels)

### Existing Mobile Patterns
- `MOBILE_CONFIG.breakpoint: 768` in `src/components/Map/constants.js`
- `@media (max-width: 768px)` used in TimelineGraphStyles, MapStyles, AIChatPanel, etc.

---

## Implementation Plan

### 1. Mobile Detection

**Approach**: Add a `useIsMobile` hook or inline `matchMedia` in BaseCard.

**Option A** – Reusable hook (recommended):
```js
// src/hooks/useIsMobile.js
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
```

**Option B** – Inline in BaseCard: call `window.matchMedia('(max-width: 768px)')` in `useEffect` and store in state.

**Breakpoint**: Use `MOBILE_CONFIG.breakpoint` (768) from `constants.js`.

---

### 2. BaseCard.jsx Changes

| Change | Desktop | Mobile |
|--------|---------|--------|
| **Position** | `left: position.lng`, `top: position.lat` | Anchored: `top: 16px` (or `max(16px, env(safe-area-inset-top))`), `left: 50%`, `transform: translateX(-50%)` |
| **Width** | `320px` (from children) | `width: calc(100% - 32px)`, `maxWidth: 400px` |
| **Drag** | Enabled | Disabled (`draggable={false}` when mobile) |
| **handleMouseDown** | Attached | No-op when mobile (or not called) |

**Container style logic**:
```js
const containerStyle = isMobile
  ? {
      position: 'fixed',
      top: 'max(16px, env(safe-area-inset-top, 16px))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '400px',
      zIndex: 1000,
      // ... rest
    }
  : {
      position: 'fixed',
      left: position.lng || 0,
      top: position.lat || 0,
      // ... rest
    };
```

**Effective draggable**: `draggable && !isMobile`

---

### 3. NestedCircleButton.jsx Changes

- Add prop: `hideDragHandle` (default `false`).
- Conditionally render the drag handle:
  ```jsx
  {!hideDragHandle && (
    <div ... onMouseDown={handleMouseDown} ... />
  )}
  ```
- BaseCard passes: `hideDragHandle={isMobile}`.

---

### 4. AIQuestionsSection / AskAnythingInput Width

- AskAnythingInput has `width: '320px'`.
- On mobile, the card is `calc(100% - 32px)`, so children should be `width: 100%` or `min(320px, 100%)` to fill the anchored card.
- Update the inner container in BaseCard (the `div` with `width: '320px'`) to use responsive width when `isMobile`.

---

### 5. LegendContainer Positioning (Mobile)

- Current: `left: 340px` (to the right of 320px card).
- On mobile: Card is full-width and anchored; 340px may overflow.
- **Options**:
  - **A**: Pass `isMobile` to LegendContainer; on mobile use `left: '100%'` + `marginLeft: '12px'` (to the right of the full-width card), or `position: fixed` with its own mobile layout.
  - **B**: On mobile, move legend below the card or into a collapsible section.
- **Recommendation**: Start with Option A—position legend to the right of the card with `left: '100%'` + small margin. If it overflows, add `right: 0` or similar in a follow-up.

---

### 6. Perplexity Mode

- Perplexity mode uses the same container (`perplexityContainerRef`) with `position: fixed` and `left`/`top`.
- Apply the same mobile-anchored layout when `isPerplexityMode && isMobile`.

---

### 7. Touch Events

- Drag uses `mousemove` / `mouseup`; on mobile we disable drag, so no touch handling needed for drag.
- No changes required for touch.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Map/components/Cards/BaseCard.jsx` | Add `useIsMobile`, conditional container styles, pass `hideDragHandle={isMobile}`, use `draggable && !isMobile` |
| `src/components/Map/components/Cards/NestedCircleButton.jsx` | Add `hideDragHandle` prop, conditionally render drag handle |
| `src/components/Map/components/Cards/BaseCard.jsx` | Update inner container `width` to be responsive (e.g. `width: isMobile ? '100%' : '320px'`) |
| `src/components/Map/components/Cards/LegendContainer.jsx` | (Optional) Accept `isMobile` and adjust `left` for mobile |
| `src/hooks/useIsMobile.js` | (New) Create hook if not exists |

---

## Testing Checklist

- [ ] Desktop: Card still floats and is draggable
- [ ] Desktop: Drag handle visible and functional
- [ ] Mobile (≤768px): Card anchored at top, centered, full-width with padding
- [ ] Mobile: No drag handle visible
- [ ] Mobile: Card cannot be dragged
- [ ] Mobile: Perplexity mode uses same anchored layout
- [ ] Mobile: AskAnythingInput and content fit within anchored card
- [ ] Mobile: LegendContainer (if updated) does not overflow

---

## Rollback

If issues arise, revert by:
1. Removing `useIsMobile` / mobile detection
2. Restoring original container styles
3. Removing `hideDragHandle` and always showing the drag handle
