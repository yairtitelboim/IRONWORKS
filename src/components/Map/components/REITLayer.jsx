import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import REITPopupCard from './REITPopupCard';

// Remove default Mapbox popup background so only our REITPopupCard shows
if (typeof document !== 'undefined') {
  const id = 'reit-popup-styles';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .reit-popup.mapboxgl-popup .mapboxgl-popup-content {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .reit-popup.mapboxgl-popup .mapboxgl-popup-tip { display: none !important; }
      .reit-popup.mapboxgl-popup { border: none !important; outline: none !important; }
      .marker-label-popup.mapboxgl-popup .mapboxgl-popup-content {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .marker-label-popup.mapboxgl-popup .mapboxgl-popup-tip { display: none !important; }
    `;
    document.head.appendChild(style);
  }
}

const REIT_SOURCE_ID = 'reit-properties-source';
const REIT_LAYER_ID = 'reit-properties-layer';
const REIT_HALO_LAYER_ID = 'reit-properties-halo-layer';
const REIT_PULSE_LAYER_ID = 'reit-properties-pulse-layer';
const REIT_CLICK_PULSE_SOURCE_ID = 'reit-click-pulse-source';
const REIT_CLICK_PULSE_LAYER_ID = 'reit-click-pulse-layer';
const REIT_CLICK_HIGHLIGHT_SOURCE_ID = 'reit-click-highlight-source';
const REIT_CLICK_HIGHLIGHT_LAYER_ID = 'reit-click-highlight-layer';
const REIT_GEOJSON_URL = '/reit_properties.geojson';

export const COMPANY_COLORS = {
  'Equinix': '#00FF00',
  'Digital Realty': '#00BFFF',
  'Prologis': '#FFA500',
  'Public Storage': '#FF00FF',
  'Simon Property Group': '#FFD700'
};

const REITLayer = ({ map, visible }) => {
  const [companyFilters, setCompanyFilters] = useState({});
  const popupRef = useRef(null);
  const replacingPopupRef = useRef(false);
  const dataRef = useRef(null);
  const pulseAnimationRef = useRef(null);
  const clickPulseAnimationRef = useRef(null);
  const clickLabelPopupRef = useRef(null);
  const layersAddedRef = useRef(false);
  const sourceLoadedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const loadInProgressRef = useRef(false);

  const removePopup = () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  useEffect(() => {
    if (!window.mapEventBus || !map?.current || !visible) return;
    const mapInstance = map.current;

    const animateClickPulse = (coordinates, companyColor = '#4dd4ac', name = '') => {
      if (!mapInstance || !mapInstance.getLayer(REIT_LAYER_ID)) return;
      if (clickPulseAnimationRef.current) {
        cancelAnimationFrame(clickPulseAnimationRef.current);
        clickPulseAnimationRef.current = null;
      }
      if (clickLabelPopupRef.current) {
        clickLabelPopupRef.current.remove();
        clickLabelPopupRef.current = null;
      }
      if (mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_PULSE_LAYER_ID);
      if (mapInstance.getSource(REIT_CLICK_PULSE_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_PULSE_SOURCE_ID);
      if (mapInstance.getLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID);
      if (mapInstance.getSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID);

      const highlightFeature = { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} };
      mapInstance.addSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [highlightFeature] }
      });
      const currentZoom = mapInstance.getZoom();
      const highlightRadius = currentZoom < 7.5 ? 15 : currentZoom < 12.5 ? 25 : 40;
      mapInstance.addLayer({
        id: REIT_CLICK_HIGHLIGHT_LAYER_ID,
        type: 'circle',
        source: REIT_CLICK_HIGHLIGHT_SOURCE_ID,
        paint: {
          'circle-radius': highlightRadius,
          'circle-color': companyColor,
          'circle-opacity': 0.9,
          'circle-stroke-width': 0
        }
      }, REIT_LAYER_ID);

      const pulseFeature = { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} };
      mapInstance.addSource(REIT_CLICK_PULSE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [pulseFeature] }
      });
      const baseRadius = currentZoom < 7.5 ? 20 : currentZoom < 12.5 ? 35 : 50;
      mapInstance.addLayer({
        id: REIT_CLICK_PULSE_LAYER_ID,
        type: 'circle',
        source: REIT_CLICK_PULSE_SOURCE_ID,
        paint: {
          'circle-radius': baseRadius,
          'circle-color': '#ffffff',
          'circle-opacity': 0.8,
          'circle-blur': 0.2
        }
      }, REIT_LAYER_ID);

      // Dim other markers while pulse is active
      if (mapInstance.getLayer(REIT_LAYER_ID)) mapInstance.setPaintProperty(REIT_LAYER_ID, 'circle-opacity', 0.2);
      if (mapInstance.getLayer(REIT_HALO_LAYER_ID)) mapInstance.setPaintProperty(REIT_HALO_LAYER_ID, 'circle-opacity', 0.05);

      // Show name label above marker (dark theme, small, 2-3 words, 10 seconds)
      if (name) {
        const shortName = name.split(/\s+/).slice(0, 3).join(' ').replace(/</g, '&lt;') || name.replace(/</g, '&lt;');
        const labelHtml = `<div style="background:#1a1a1a;color:#e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${shortName}</div>`;
        clickLabelPopupRef.current = new mapboxgl.Popup({
          closeButton: false,
          anchor: 'bottom',
          offset: [0, -18],
          className: 'marker-label-popup'
        }).setLngLat(coordinates).setHTML(labelHtml).addTo(mapInstance);
        setTimeout(() => {
          if (clickLabelPopupRef.current) {
            clickLabelPopupRef.current.remove();
            clickLabelPopupRef.current = null;
          }
        }, 10000);
      }

      const startTime = Date.now();
      const durationMs = 2000;
      const animate = () => {
        if (!mapInstance || !mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) {
          clickPulseAnimationRef.current = null;
          return;
        }
        const elapsed = Date.now() - startTime;
        if (elapsed >= durationMs) {
          if (mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_PULSE_LAYER_ID);
          if (mapInstance.getSource(REIT_CLICK_PULSE_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_PULSE_SOURCE_ID);
          if (mapInstance.getLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID);
          if (mapInstance.getSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID);
          // Restore other markers
          if (mapInstance.getLayer(REIT_LAYER_ID)) mapInstance.setPaintProperty(REIT_LAYER_ID, 'circle-opacity', 0.9);
          if (mapInstance.getLayer(REIT_HALO_LAYER_ID)) mapInstance.setPaintProperty(REIT_HALO_LAYER_ID, 'circle-opacity', 0.15);
          clickPulseAnimationRef.current = null;
          return;
        }
        const progress = elapsed / durationMs;
        const pulsePhase = Math.sin(progress * Math.PI);
        const opacity = 0.4 + pulsePhase * 0.6;
        const radius = baseRadius + pulsePhase * 12;
        mapInstance.setPaintProperty(REIT_CLICK_PULSE_LAYER_ID, 'circle-opacity', opacity);
        mapInstance.setPaintProperty(REIT_CLICK_PULSE_LAYER_ID, 'circle-radius', radius);
        clickPulseAnimationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    const handleCarouselFocus = (payload) => {
      if (payload?.source !== 'reit-properties' || !payload?.coordinates) return;
      const coords = payload.coordinates;
      const companyColor = COMPANY_COLORS[payload.company] || '#4dd4ac';
      const name = payload.address || '';
      animateClickPulse(coords, companyColor, name);
      mapInstance.flyTo({ center: coords, zoom: 14, speed: 1.2, curve: 1.42, essential: true });
      const feature = dataRef.current?.features?.find((f) => {
        const p = f.properties || {};
        const fc = f.geometry?.coordinates;
        return (p.address === payload.address || (fc && fc[0] === coords[0] && fc[1] === coords[1]));
      });
      if (feature) {
        const props = feature.properties || {};
        const propsWithCoords = { ...props, coordinates: coords, longitude: coords[0], latitude: coords[1] };
        replacingPopupRef.current = true;
        removePopup();
        setTimeout(() => {
          if (!mapInstance || !visible) return;
          const popupContainer = document.createElement('div');
          popupContainer.className = 'reit-popup-container';
          const root = ReactDOM.createRoot(popupContainer);
          root.render(<REITPopupCard property={propsWithCoords} companyColors={COMPANY_COLORS} />);
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: true,
            className: 'reit-popup',
            maxWidth: '300px',
            anchor: 'bottom',
            offset: [0, -20]
          })
            .setLngLat(coords)
            .setDOMContent(popupContainer)
            .addTo(mapInstance);
          popupRef.current = popup;
          popup.on('close', () => {
            root.unmount();
            if (!replacingPopupRef.current && window.mapEventBus) {
              window.mapEventBus.emit('timeline:carouselClear', {});
            }
            replacingPopupRef.current = false;
          });
        }, 800);
      }
    };
    const unsub = window.mapEventBus.on('timeline:carouselFocus', handleCarouselFocus);
    return () => unsub?.();
  }, [map, visible]);

  useEffect(() => {
    if (!window.mapEventBus) return;
    const handleFilterChanged = ({ company, isVisible }) => {
      setCompanyFilters(prev => ({ ...prev, [company]: isVisible }));
      removePopup();
    };
    const handleFilterAllChanged = (visible) => {
      const newFilters = {};
      Object.keys(COMPANY_COLORS).forEach(company => { newFilters[company] = visible; });
      setCompanyFilters(newFilters);
      if (!visible) removePopup();
    };
    window.mapEventBus.on('reit:filterChanged', handleFilterChanged);
    window.mapEventBus.on('reit:filterAllChanged', handleFilterAllChanged);
    return () => {
      window.mapEventBus.off('reit:filterChanged', handleFilterChanged);
      window.mapEventBus.off('reit:filterAllChanged', handleFilterAllChanged);
      removePopup();
      if (pulseAnimationRef.current) cancelAnimationFrame(pulseAnimationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!map?.current) return;
    const layers = [REIT_LAYER_ID, REIT_HALO_LAYER_ID, REIT_PULSE_LAYER_ID];
    layers.forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        const visibleCompanies = Object.entries(companyFilters)
          .filter(([_, isVisible]) => isVisible)
          .map(([company]) => company);
        if (visibleCompanies.length === 0 && Object.keys(companyFilters).length > 0) {
          map.current.setFilter(layerId, ['==', ['get', 'company'], 'NONE']);
        } else if (visibleCompanies.length > 0) {
          map.current.setFilter(layerId, ['in', ['get', 'company'], ['literal', visibleCompanies]]);
        }
      }
    });
  }, [map, companyFilters]);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    const loadLayer = async () => {
      if (!visible) {
        cleanup();
        return;
      }
      if (isCleaningUpRef.current) isCleaningUpRef.current = false;
      if (loadInProgressRef.current) return;
      if (!visible) return;

      loadInProgressRef.current = true;
      try {
        const sourceExists = mapInstance.getSource(REIT_SOURCE_ID);
        const layersExist = mapInstance.getLayer(REIT_LAYER_ID);

        if (sourceExists) {
          sourceLoadedRef.current = true;
          if (!layersExist) {
            layersAddedRef.current = false;
            addLayers();
          } else {
            updateVisibility(true);
          }
          if (!dataRef.current) {
            try {
              const src = mapInstance.getSource(REIT_SOURCE_ID);
              dataRef.current = src?._data ?? null;
            } catch (_) {}
          }
          loadInProgressRef.current = false;
          return;
        }

        const resp = await fetch(REIT_GEOJSON_URL);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const data = await resp.json();

        if (!visible) {
          loadInProgressRef.current = false;
          return;
        }

        dataRef.current = data;
        if (window.mapEventBus) window.mapEventBus.emit('reit:dataLoaded', data);

        const waitForStyle = () => new Promise((resolve) => {
          if (mapInstance.isStyleLoaded()) { resolve(); return; }
          const timeout = setTimeout(() => resolve(), 3000);
          mapInstance.once('styledata', () => { clearTimeout(timeout); resolve(); });
        });
        await waitForStyle();

        if (!visible) {
          loadInProgressRef.current = false;
          return;
        }

        // Re-check: source may exist if style reloaded or effect ran twice
        if (mapInstance.getSource(REIT_SOURCE_ID)) {
          sourceLoadedRef.current = true;
          if (!mapInstance.getLayer(REIT_LAYER_ID)) {
            layersAddedRef.current = false;
            addLayers();
          } else {
            updateVisibility(true);
          }
          loadInProgressRef.current = false;
          return;
        }

        try {
          mapInstance.addSource(REIT_SOURCE_ID, { type: 'geojson', data });
        } catch (addErr) {
          if (addErr?.message?.includes('already a source')) {
            // Source exists from prior run or race - ensure layers are present
            sourceLoadedRef.current = true;
            if (!mapInstance.getLayer(REIT_LAYER_ID)) {
              layersAddedRef.current = false;
              addLayers();
            } else {
              updateVisibility(true);
            }
            loadInProgressRef.current = false;
            return;
          }
          throw addErr;
        }
        sourceLoadedRef.current = true;
        addLayers();
        loadInProgressRef.current = false;
      } catch (err) {
        console.error('[REITLayer] Error loading:', err);
        loadInProgressRef.current = false;
      }
    };

    const animateClickPulse = (coordinates, companyColor = '#4dd4ac', name = '') => {
      if (!mapInstance || !mapInstance.getLayer(REIT_LAYER_ID)) return;
      if (clickPulseAnimationRef.current) {
        cancelAnimationFrame(clickPulseAnimationRef.current);
        clickPulseAnimationRef.current = null;
      }
      if (clickLabelPopupRef.current) {
        clickLabelPopupRef.current.remove();
        clickLabelPopupRef.current = null;
      }
      if (mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_PULSE_LAYER_ID);
      if (mapInstance.getSource(REIT_CLICK_PULSE_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_PULSE_SOURCE_ID);
      if (mapInstance.getLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID);
      if (mapInstance.getSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID);

      const highlightFeature = { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} };
      mapInstance.addSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [highlightFeature] }
      });
      const currentZoom = mapInstance.getZoom();
      const highlightRadius = currentZoom < 7.5 ? 15 : currentZoom < 12.5 ? 25 : 40;
      mapInstance.addLayer({
        id: REIT_CLICK_HIGHLIGHT_LAYER_ID,
        type: 'circle',
        source: REIT_CLICK_HIGHLIGHT_SOURCE_ID,
        paint: {
          'circle-radius': highlightRadius,
          'circle-color': companyColor,
          'circle-opacity': 0.9,
          'circle-stroke-width': 0
        }
      }, REIT_LAYER_ID);

      const pulseFeature = { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} };
      mapInstance.addSource(REIT_CLICK_PULSE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [pulseFeature] }
      });
      const baseRadius = currentZoom < 7.5 ? 20 : currentZoom < 12.5 ? 35 : 50;
      mapInstance.addLayer({
        id: REIT_CLICK_PULSE_LAYER_ID,
        type: 'circle',
        source: REIT_CLICK_PULSE_SOURCE_ID,
        paint: {
          'circle-radius': baseRadius,
          'circle-color': '#ffffff',
          'circle-opacity': 0.8,
          'circle-blur': 0.2
        }
      }, REIT_LAYER_ID);

      // Dim other markers while pulse is active
      if (mapInstance.getLayer(REIT_LAYER_ID)) mapInstance.setPaintProperty(REIT_LAYER_ID, 'circle-opacity', 0.2);
      if (mapInstance.getLayer(REIT_HALO_LAYER_ID)) mapInstance.setPaintProperty(REIT_HALO_LAYER_ID, 'circle-opacity', 0.05);

      // Show name label above marker (dark theme, small, 2-3 words, 10 seconds)
      if (name) {
        const shortName = name.split(/\s+/).slice(0, 3).join(' ').replace(/</g, '&lt;') || name.replace(/</g, '&lt;');
        const labelHtml = `<div style="background:#1a1a1a;color:#e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${shortName}</div>`;
        clickLabelPopupRef.current = new mapboxgl.Popup({
          closeButton: false,
          anchor: 'bottom',
          offset: [0, -18],
          className: 'marker-label-popup'
        }).setLngLat(coordinates).setHTML(labelHtml).addTo(mapInstance);
        setTimeout(() => {
          if (clickLabelPopupRef.current) {
            clickLabelPopupRef.current.remove();
            clickLabelPopupRef.current = null;
          }
        }, 10000);
      }

      const startTime = Date.now();
      const durationMs = 2000;
      const animate = () => {
        if (!mapInstance || !mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) {
          clickPulseAnimationRef.current = null;
          return;
        }
        const elapsed = Date.now() - startTime;
        if (elapsed >= durationMs) {
          if (mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_PULSE_LAYER_ID);
          if (mapInstance.getSource(REIT_CLICK_PULSE_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_PULSE_SOURCE_ID);
          if (mapInstance.getLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_HIGHLIGHT_LAYER_ID);
          if (mapInstance.getSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_HIGHLIGHT_SOURCE_ID);
          // Restore other markers
          if (mapInstance.getLayer(REIT_LAYER_ID)) mapInstance.setPaintProperty(REIT_LAYER_ID, 'circle-opacity', 0.9);
          if (mapInstance.getLayer(REIT_HALO_LAYER_ID)) mapInstance.setPaintProperty(REIT_HALO_LAYER_ID, 'circle-opacity', 0.15);
          clickPulseAnimationRef.current = null;
          return;
        }
        const progress = elapsed / durationMs;
        const pulsePhase = Math.sin(progress * Math.PI);
        const opacity = 0.4 + pulsePhase * 0.6;
        const radius = baseRadius + pulsePhase * 12;
        mapInstance.setPaintProperty(REIT_CLICK_PULSE_LAYER_ID, 'circle-opacity', opacity);
        mapInstance.setPaintProperty(REIT_CLICK_PULSE_LAYER_ID, 'circle-radius', radius);
        clickPulseAnimationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    const handleClick = (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: [REIT_LAYER_ID] });
      if (features.length === 0) return;
      if (e.originalEvent) e.originalEvent.stopPropagation();

      const feature = features[0];
      const props = feature.properties;
      const coordinates = feature.geometry.coordinates;
      const companyColor = COMPANY_COLORS[props.company] || '#4dd4ac';
      animateClickPulse(coordinates, companyColor, props.address || '');
      console.log('[REITLayer] Marker clicked → Timeline carousel', {
        address: props.address,
        company: props.company,
        willEmit: 'memphis:permitSelected',
        source: 'reit-properties',
        groupSize: dataRef.current?.features?.length ?? 0
      });

      if (window.mapEventBus) {
        window.mapEventBus.emit('reit:selected', {
          address: props.address,
          company: props.company,
          properties: props,
          coordinates: coordinates
        });

        const allFeatures = dataRef.current?.features || [];
        const MAX_ITEMS = 9;
        const clickedIdx = allFeatures.findIndex((f) => {
          const p = f.properties || {};
          return p.address === props.address && p.company === props.company;
        });
        let groupFeatures = allFeatures;
        if (allFeatures.length > MAX_ITEMS) {
          const half = Math.floor(MAX_ITEMS / 2);
          let start = clickedIdx >= 0 ? Math.max(0, clickedIdx - half) : 0;
          let end = Math.min(start + MAX_ITEMS, allFeatures.length);
          if (end - start < MAX_ITEMS) start = Math.max(0, end - MAX_ITEMS);
          groupFeatures = allFeatures.slice(start, end);
        }
        const group = groupFeatures.map((f) => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates;
          return { ...p, coordinates: coords, _coordinates: coords };
        });
        window.mapEventBus.emit('memphis:permitSelected', {
          source: 'reit-properties',
          layerLabel: 'REIT Properties',
          properties: { ...props, coordinates, _coordinates: coordinates },
          group
        });
        console.log('[REITLayer] Emitted memphis:permitSelected → Timeline bar carousel', { groupLength: group.length });
      }

      replacingPopupRef.current = true;
      removePopup();
      mapInstance.flyTo({ center: coordinates, zoom: 14, speed: 1.2, curve: 1.42, essential: true });

      setTimeout(() => {
        if (!mapInstance || !visible) return;
        const propsWithCoords = { ...props, coordinates, longitude: coordinates[0], latitude: coordinates[1] };
        const popupContainer = document.createElement('div');
        popupContainer.className = 'reit-popup-container';
        const root = ReactDOM.createRoot(popupContainer);
        root.render(<REITPopupCard property={propsWithCoords} companyColors={COMPANY_COLORS} />);

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: true,
          className: 'reit-popup',
          maxWidth: '300px',
          anchor: 'bottom',
          offset: [0, -20]
        })
          .setLngLat(coordinates)
          .setDOMContent(popupContainer)
          .addTo(mapInstance);

        popupRef.current = popup;
        popup.on('close', () => {
          root.unmount();
          if (!replacingPopupRef.current && window.mapEventBus) {
            window.mapEventBus.emit('timeline:carouselClear', {});
          }
          replacingPopupRef.current = false;
        });
      }, 1000);
    };

    const colorMatch = [
      'match', ['get', 'company'],
      'Equinix', COMPANY_COLORS['Equinix'],
      'Digital Realty', COMPANY_COLORS['Digital Realty'],
      'Prologis', COMPANY_COLORS['Prologis'],
      'Public Storage', COMPANY_COLORS['Public Storage'],
      'Simon Property Group', COMPANY_COLORS['Simon Property Group'],
      '#FFFFFF'
    ];

    const addLayers = () => {
      if (!mapInstance || !mapInstance.getSource(REIT_SOURCE_ID) || isCleaningUpRef.current) return;
      if (mapInstance.getLayer(REIT_LAYER_ID)) {
        layersAddedRef.current = true;
        return;
      }
      if (layersAddedRef.current) layersAddedRef.current = false;

      mapInstance.addLayer({
        id: REIT_HALO_LAYER_ID,
        type: 'circle',
        source: REIT_SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 10, 10000, 15, 50000, 20, 100000, 30],
            10, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 20, 10000, 30, 50000, 40, 100000, 60],
            15, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 30, 10000, 45, 50000, 60, 100000, 90]
          ],
          'circle-color': colorMatch,
          'circle-opacity': 0.15,
          'circle-blur': 0.8
        }
      });

      mapInstance.addLayer({
        id: REIT_PULSE_LAYER_ID,
        type: 'circle',
        source: REIT_SOURCE_ID,
        paint: {
          'circle-radius': 0,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': colorMatch,
          'circle-stroke-opacity': 0
        }
      });

      mapInstance.addLayer({
        id: REIT_LAYER_ID,
        type: 'circle',
        source: REIT_SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 4, 10000, 6, 50000, 8, 100000, 12],
            10, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 8, 10000, 12, 50000, 16, 100000, 24],
            15, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 12, 10000, 18, 50000, 24, 100000, 36]
          ],
          'circle-color': colorMatch,
          'circle-stroke-width': 0,
          'circle-opacity': 0.9
        }
      });

      const duration = 2000;
      const animatePulse = (timestamp) => {
        if (!mapInstance || !mapInstance.getLayer(REIT_PULSE_LAYER_ID)) return;
        const progress = (timestamp % duration) / duration;
        const radiusMultiplier = progress * 3;
        mapInstance.setPaintProperty(REIT_PULSE_LAYER_ID, 'circle-radius', [
          'interpolate', ['linear'], ['zoom'],
          5, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 4 * radiusMultiplier, 10000, 6 * radiusMultiplier, 50000, 8 * radiusMultiplier, 100000, 12 * radiusMultiplier],
          10, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 8 * radiusMultiplier, 10000, 12 * radiusMultiplier, 50000, 16 * radiusMultiplier, 100000, 24 * radiusMultiplier],
          15, ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'square_footage'], 0]], 0, 12 * radiusMultiplier, 10000, 18 * radiusMultiplier, 50000, 24 * radiusMultiplier, 100000, 36 * radiusMultiplier]
        ]);
        mapInstance.setPaintProperty(REIT_PULSE_LAYER_ID, 'circle-stroke-opacity', (1 - progress) * 0.5);
        pulseAnimationRef.current = requestAnimationFrame(animatePulse);
      };
      pulseAnimationRef.current = requestAnimationFrame(animatePulse);

      mapInstance.on('mouseenter', REIT_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
      mapInstance.on('mouseleave', REIT_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = ''; });
      mapInstance.on('click', REIT_LAYER_ID, handleClick);

      layersAddedRef.current = true;
      updateVisibility(true);
    };

    const updateVisibility = (isVisible) => {
      if (isCleaningUpRef.current) return;
      const layers = [REIT_LAYER_ID, REIT_HALO_LAYER_ID, REIT_PULSE_LAYER_ID];
      const val = isVisible ? 'visible' : 'none';
      layers.forEach(l => {
        try {
          if (mapInstance.getLayer(l)) mapInstance.setLayoutProperty(l, 'visibility', val);
        } catch (err) { /* ignore */ }
      });
      if (!isVisible) removePopup();
    };

    const cleanup = () => {
      const hasLayers = [REIT_LAYER_ID, REIT_HALO_LAYER_ID, REIT_PULSE_LAYER_ID].some(l => mapInstance.getLayer(l));
      const hasSource = !!mapInstance.getSource(REIT_SOURCE_ID);
      if (!hasLayers && !hasSource && !pulseAnimationRef.current) {
        layersAddedRef.current = false;
        sourceLoadedRef.current = false;
        return;
      }
      isCleaningUpRef.current = true;

      [REIT_LAYER_ID, REIT_HALO_LAYER_ID, REIT_PULSE_LAYER_ID].forEach(l => {
        try {
          if (mapInstance.getLayer(l)) mapInstance.removeLayer(l);
        } catch (err) { /* ignore */ }
      });
      try {
        if (mapInstance.getSource(REIT_SOURCE_ID)) mapInstance.removeSource(REIT_SOURCE_ID);
      } catch (err) { /* ignore */ }

      layersAddedRef.current = false;
      sourceLoadedRef.current = false;
      removePopup();
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      requestAnimationFrame(() => { isCleaningUpRef.current = false; });
    };

    loadLayer();

    return () => {
      isCleaningUpRef.current = true;
      loadInProgressRef.current = false;
      try {
        mapInstance.off('click', REIT_LAYER_ID, handleClick);
        mapInstance.off('mouseenter', REIT_LAYER_ID);
        mapInstance.off('mouseleave', REIT_LAYER_ID);
      } catch (err) { /* ignore */ }
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      if (clickPulseAnimationRef.current) {
        cancelAnimationFrame(clickPulseAnimationRef.current);
        clickPulseAnimationRef.current = null;
      }
      try {
        if (mapInstance.getLayer(REIT_CLICK_PULSE_LAYER_ID)) mapInstance.removeLayer(REIT_CLICK_PULSE_LAYER_ID);
        if (mapInstance.getSource(REIT_CLICK_PULSE_SOURCE_ID)) mapInstance.removeSource(REIT_CLICK_PULSE_SOURCE_ID);
      } catch (err) { /* ignore */ }
      removePopup();
    };
  }, [map, visible]);

  return null;
};

export default REITLayer;
