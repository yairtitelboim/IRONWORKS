// Whitney, TX Marker Utilities
import mapboxgl from 'mapbox-gl';

/**
 * Create a Whitney-themed marker for the map
 * @param {Object} map - Mapbox map instance
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {Object} cachedData - Cached Whitney data
 * @returns {Object} Mapbox marker
 */
export function createWhitneyMarker(map, lng, lat, cachedData) {
  // Create teardrop marker (same style as downtown core but in red)
  const marker = new mapboxgl.Marker({ 
    color: '#dc2626', 
    scale: 1.2,
    anchor: 'center' // Ensure marker is centered on coordinates
  })
    .setLngLat([lng, lat])
    .addTo(map);

  // Ensure marker element has proper positioning
  const markerEl = marker.getElement();
  markerEl.style.position = 'absolute'; // Ensure absolute positioning
  markerEl.style.pointerEvents = 'auto'; // Ensure clickable

  // Add click handler
  marker.getElement().addEventListener('click', () => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', {
        id: 'whitney-marker',
        name: 'Whitney Data Center Campus',
        type: 'Whitney Infrastructure',
        category: 'Texas Data Center Development',
        coordinates: [lng, lat],
        formatter: 'whitney',
        zonesAnalyzed: 3,
        cachedDataAvailable: !!cachedData,
        analysisStatus: 'Texas infrastructure analysis complete',
        isAutomatic: false
      });
    }
  });

  return marker;
}
