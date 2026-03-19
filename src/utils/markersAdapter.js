import mapboxgl from 'mapbox-gl';

/**
 * Centralized helpers for creating/removing special Mapbox markers so React
 * components don't construct DOM + Mapbox markers directly.
 */

export const createCyrusOneMarker = (mapInstance) => {
  if (!mapInstance) return null;

  // Coordinates for CyrusOne DFW7 in Whitney, Bosque County, TX
  const cyrusOneCoords = [-97.32, 31.95];

  const el = document.createElement('div');
  el.className = 'cyrusone-marker';
  el.style.width = '30px';
  el.style.height = '30px';
  el.style.backgroundColor = '#FF6B6B';
  el.style.borderRadius = '50%';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';

  const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
    '<h3>CyrusOne DFW7 Data Center</h3><p>📍 Whitney, Bosque County, TX</p><p>🏗️ 557 County Rd 3610</p><p>🏗️ Under Construction</p><p>📊 Data Center Facility</p>'
  );

  return new mapboxgl.Marker(el).setLngLat(cyrusOneCoords).setPopup(popup).addTo(mapInstance);
};

export const createTsmcMarker = (mapInstance) => {
  if (!mapInstance) return null;

  // Approximate coordinates for TSMC Arizona fab in Phoenix, AZ
  const tsmcCoords = [-112.2, 33.6];

  const el = document.createElement('div');
  el.className = 'tsmc-marker';
  el.style.width = '30px';
  el.style.height = '30px';
  el.style.backgroundColor = '#3b82f6';
  el.style.borderRadius = '50%';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.5)';
  el.style.cursor = 'pointer';

  const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
    '<h3>TSMC Arizona Semiconductor Fab</h3><p>📍 Phoenix, Maricopa County, AZ</p><p>🏗️ 5088 W. Innovation Circle</p><p>💻 Semiconductor Manufacturing</p><p>💰 $40B+ Investment (Phase 1 & 2)</p>'
  );

  return new mapboxgl.Marker(el).setLngLat(tsmcCoords).setPopup(popup).addTo(mapInstance);
};


