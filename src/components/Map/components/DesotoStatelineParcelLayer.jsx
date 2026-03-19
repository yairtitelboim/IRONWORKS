import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

// Reuse Memphis layer popup styles
if (typeof document !== 'undefined') {
  const id = 'memphis-layer-popup-styles';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .memphis-layer-popup.mapboxgl-popup .mapboxgl-popup-content {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .memphis-layer-popup.mapboxgl-popup .mapboxgl-popup-tip { display: none !important; }
      .memphis-layer-popup.mapboxgl-popup { border: none !important; outline: none !important; }
    `;
    document.head.appendChild(style);
  }
}

const SOURCE_ID = 'desoto-stateline-parcel-source';
const FILL_LAYER_ID = 'desoto-stateline-parcel-fill';
const LINE_LAYER_ID = 'desoto-stateline-parcel-line';
const GEOJSON_URL = '/data/memphis_change/desoto_parcel_2400_stateline_2025.geojson';

const createParcelPopupHTML = (props) => {
  const pin = props.PIN || props.pin || '—';
  const addr = props.FULL_ADDR || props.full_addr || '—';
  const owner = props.OWNER_NAME || props.owner_name || '—';
  const taxInfo = props.Tax_Info || props.tax_info || '';
  const taxMap = props.Tax_Map || props.tax_map || '';
  const district = props.Tax_District || props.tax_district || '';
  return `
    <div style="
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      max-width: 320px;
      min-width: 220px;
    ">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #fff;">xAI Stateline parcel (DeSoto)</div>
      <div style="display: inline-block; background: #8b5cf6; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 8px;">
        PIN ${(pin || '').trim()}
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db;">${addr}</div>
      <div style="margin-bottom: 4px; color: #9ca3af; font-size: 11px;">${owner}</div>
      ${district ? `<div style="margin-bottom: 4px; color: #9ca3af; font-size: 11px;">Tax district ${district}</div>` : ''}
      ${taxInfo ? `<a href="${taxInfo}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; font-size: 11px; display: inline-block; margin-right: 12px;">Tax info →</a>` : ''}
      ${taxMap ? `<a href="${taxMap}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; font-size: 11px;">Tax map →</a>` : ''}
    </div>
  `;
};

/**
 * DeSoto County parcel for 2400 Stateline Rd W (xAI Stateline site).
 * Single polygon from desoto_parcel_2400_stateline_2025.geojson.
 */
const DesotoStatelineParcelLayer = ({ map, visible }) => {
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    if (!visible) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.features?.length) return;

        if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

        mapInstance.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': '#8b5cf6',
            'fill-opacity': 0.2
          },
          minzoom: 6
        });

        mapInstance.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#8b5cf6',
            'line-width': 2
          },
          minzoom: 6
        });

        mapInstance.on('mouseenter', FILL_LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });
        mapInstance.on('mouseleave', FILL_LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = '';
        });
      } catch (e) {
        console.error('Error loading DeSoto Stateline parcel layer', e);
      }
    };

    const handleClick = (e) => {
      if (!map?.current) return;
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID]
      });
      if (features?.length > 0) {
        const f = features[0];
        const props = f.properties || {};
        const coords = f.geometry.type === 'Polygon'
          ? f.geometry.coordinates[0][0]
          : [e.lngLat.lng, e.lngLat.lat];

        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: [0, -10],
          maxWidth: '400px',
          className: 'memphis-layer-popup'
        })
          .setLngLat(coords)
          .setHTML(createParcelPopupHTML(props))
          .addTo(map.current);
        popupRef.current.on('close', () => {
          popupRef.current = null;
        });
      } else {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      }
    };

    addLayer();
    mapInstance.on('click', handleClick);

    return () => {
      cancelled = true;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      mapInstance.off('click', handleClick);
      mapInstance.off('mouseenter', FILL_LAYER_ID);
      mapInstance.off('mouseleave', FILL_LAYER_ID);
      if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default DesotoStatelineParcelLayer;
