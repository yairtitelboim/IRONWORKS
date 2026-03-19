// Mapbox layer helpers for Pinal County

export function removePinalLayers(map) {
  const layersToRemove = ['osm-features-fill','osm-features-lines','osm-pois'];
  layersToRemove.forEach(id => map.getLayer(id) && map.removeLayer(id));
  map.getSource('osm-features') && map.removeSource('osm-features');
}

export function addPinalCountyBoundaryToMap(map, boundaryData) {
  if (!boundaryData) return;
  ['pinal-county-boundary-fill', 'pinal-county-boundary-line'].forEach(id => map.getLayer(id) && map.removeLayer(id));
  map.getSource('pinal-county-boundary') && map.removeSource('pinal-county-boundary');
  map.addSource('pinal-county-boundary', { type: 'geojson', data: boundaryData });
  map.addLayer({ id: 'pinal-county-boundary-fill', type: 'fill', source: 'pinal-county-boundary', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 } });
  map.addLayer({ id: 'pinal-county-boundary-line', type: 'line', source: 'pinal-county-boundary', paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.8 } });
}

export function addPinalInfrastructureToMap(map, features) {
  if (!features?.length) return;
  const animateOpacity = (layerId, prop, target, duration = 800) => {
    if (!map.getLayer(layerId)) return;
    const steps = Math.max(1, Math.floor(duration / 16));
    const from = 0; let s = 0;
    const tick = () => {
      if (!map.getLayer(layerId)) return;
      s += 1; const t = Math.min(1, s / steps);
      const value = from + (target - from) * t;
      map.setPaintProperty(layerId, prop, value);
      if (t < 1) requestAnimationFrame(tick);
    };
    map.setPaintProperty(layerId, prop, 0); requestAnimationFrame(tick);
  };

  removePinalLayers(map);
  const geo = { type: 'FeatureCollection', features };
  map.addSource('osm-features', { type: 'geojson', data: geo });

  if (!map.getLayer('osm-features-lines')) {
    map.addLayer({ id: 'osm-features-lines', type: 'line', source: 'osm-features', paint: {
      'line-color': ['case',
        ['==', ['get', 'category'], 'office_building'], '#059669',
        ['==', ['get', 'category'], 'commercial_building'], '#0ea5e9',
        ['==', ['get', 'category'], 'retail_building'], '#3b82f6',
        ['==', ['get', 'category'], 'government_facility'], '#dc2626',
        ['==', ['get', 'category'], 'education'], '#7c3aed',
        ['==', ['get', 'category'], 'healthcare'], '#ef4444',
        ['==', ['get', 'category'], 'service_amenity'], '#f59e0b',
        ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
        ['==', ['get', 'category'], 'transit_hub'], '#10b981',
        ['==', ['get', 'category'], 'highway_access'], '#6b7280',
        ['==', ['get', 'category'], 'recreation_area'], '#22c55e',
        ['==', ['get', 'category'], 'industrial'], '#8b5cf6',
        '#6b7280'
      ],
      'line-width': ['case', ['==', ['get', 'priority'], 3], 3, ['==', ['get', 'priority'], 2], 2, 1],
      'line-opacity': 0 } });
  }

  if (!map.getLayer('osm-features-fill')) {
    map.addLayer({ id: 'osm-features-fill', type: 'fill', source: 'osm-features', filter: ['==', ['geometry-type'], 'Polygon'], paint: {
      'fill-color': ['case',
        ['==', ['get', 'category'], 'office_building'], 'rgba(5, 150, 105, 0.2)',
        ['==', ['get', 'category'], 'commercial_building'], 'rgba(14, 165, 233, 0.2)',
        ['==', ['get', 'category'], 'retail_building'], 'rgba(59, 130, 246, 0.2)',
        ['==', ['get', 'category'], 'government_facility'], 'rgba(220, 38, 38, 0.2)',
        ['==', ['get', 'category'], 'education'], 'rgba(124, 58, 237, 0.2)',
        ['==', ['get', 'category'], 'healthcare'], 'rgba(239, 68, 68, 0.2)',
        ['==', ['get', 'category'], 'service_amenity'], 'rgba(245, 158, 11, 0.2)',
        ['==', ['get', 'category'], 'emergency_services'], 'rgba(220, 38, 38, 0.2)',
        ['==', ['get', 'category'], 'recreation_area'], 'rgba(34, 197, 94, 0.2)',
        ['==', ['get', 'category'], 'industrial'], 'rgba(139, 92, 246, 0.2)',
        'rgba(107, 114, 128, 0.05)'
      ],
      'fill-opacity': 0 } });
  }

  if (!map.getLayer('osm-pois')) {
    map.addLayer({ id: 'osm-pois', type: 'circle', source: 'osm-features', filter: ['==', ['geometry-type'], 'Point'], paint: {
      'circle-radius': ['case', ['==', ['get', 'priority'], 3], 8, ['==', ['get', 'priority'], 2], 6, 4],
      'circle-color': ['case',
        ['==', ['get', 'category'], 'government_facility'], '#dc2626',
        ['==', ['get', 'category'], 'education'], '#7c3aed',
        ['==', ['get', 'category'], 'healthcare'], '#ef4444',
        ['==', ['get', 'category'], 'service_amenity'], '#f59e0b',
        ['==', ['get', 'category'], 'emergency_services'], '#dc2626',
        ['==', ['get', 'category'], 'transit_hub'], '#10b981',
        '#059669'
      ],
      'circle-opacity': 0 } });
  }

  setTimeout(() => animateOpacity('osm-features-fill', 'fill-opacity', 0.3, 700), 100);
  setTimeout(() => animateOpacity('osm-features-lines', 'line-opacity', 0.8, 700), 500);
  setTimeout(() => animateOpacity('osm-pois', 'circle-opacity', 1, 600), 900);
}


