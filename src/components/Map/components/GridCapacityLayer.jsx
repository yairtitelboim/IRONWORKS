import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const SOURCE_ID = 'grid-capacity-source';
const HEATMAP_LAYER_ID = 'grid-capacity-heatmap';
const CIRCLE_LAYER_ID = 'grid-capacity-circles';
const DATA_FILES = [
  '/data/harris_nc/harris_nc_2023_2024.geojson',
  '/data/harris_nc/harris_nc_2024_2025.geojson'
];

const formatIntensity = (feature) => {
  const distanceKm = feature.properties?.distance_km ?? 0;
  const areaHa = feature.properties?.area_ha ?? 0;
  const decay = Math.exp(-(distanceKm || 0) / 12); // 12 km decay constant
  const thermalBoost = Math.min(1, areaHa / 6); // bigger polygon -> hotter
  const base = feature.properties?.change_label === 'industrial_expansion' ? 0.65 : 0.35;
  const intensity = Math.max(0.05, Math.min(1, (base + thermalBoost) * decay));
  return {
    intensity,
    distanceKm,
    areaHa,
    tierLabel: feature.properties?.tierLabel || '',
    operator: feature.properties?.operator || ''
  };
};

const createPointFeature = (feature, index, siteLabel) => {
  const centroid = turf.centroid(feature);
  const { intensity, distanceKm, areaHa } = formatIntensity(feature);
  const tier = feature.properties?.change_label || 'industrial_expansion';

  return {
    type: 'Feature',
    geometry: centroid.geometry,
    properties: {
      id: `${feature.properties?.site_id || 'harris'}-${tier}-${index}`,
      name: feature.properties?.site_name || 'Harris Grid Node',
      siteName: feature.properties?.site_name || siteLabel,
      shortName: siteLabel,
      changeLabel: feature.properties?.change_label,
      distanceKm,
      areaHa,
      intensity,
      tier,
      voltageCategory: '230kv',
      maxVoltageKv: feature.properties?.maxVoltageKv ?? 230,
      operator: 'Duke Energy Progress',
      description: feature.properties?.description || '',
      popupDescription: `**Grid node** within the Harris transmission loop shows elevated Sentinel thermal signature and industrial load ${distanceKm.toFixed(
        1
      )} km from Harris Lake.`,
      popupData: {
        'Thermal Intensity': `${(intensity * 100).toFixed(0)} percentile`,
        'Distance to Harris Switchyard': `${distanceKm.toFixed(1)} km`,
        'Detected Change Class': tier.replace('_', ' '),
        'Industrial Footprint': `${areaHa.toFixed(2)} hectares`,
        Operator: 'Duke Energy Progress'
      },
      popupTheme: 'blue',
      formatter: 'power' // reuse power formatter/typewriter styling
    }
  };
};

const GridCapacityLayer = ({ map, visible }) => {
  const isMountedRef = useRef(false);
  const styleListenerAttachedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;
    let cancelled = false;

    const removeLayers = () => {
      if (mapInstance.getLayer(CIRCLE_LAYER_ID)) {
        mapInstance.removeLayer(CIRCLE_LAYER_ID);
      }
      if (mapInstance.getLayer(HEATMAP_LAYER_ID)) {
        mapInstance.removeLayer(HEATMAP_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };

    const emitLegend = (features) => {
      if (!window.mapEventBus) return;
      const topNodes = features
        .slice(0, 5)
        .map((f) => ({
          name: f.properties.name,
          siteName: f.properties.siteName,
          intensity: f.properties.intensity,
          distanceKm: f.properties.distanceKm
        }));

      window.mapEventBus.emit('grid:loaded', {
        timestamp: Date.now(),
        nodes: topNodes
      });
    };

    const addHeatmap = async () => {
      const responses = await Promise.all(
        DATA_FILES.map(async (path) => {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
          return res.json();
        })
      );

      const polygons = responses.flatMap((dataset) =>
        (dataset.features || []).filter(
          (feature) => feature?.properties?.change_label === 'industrial_expansion'
        )
      );

      const pointFeatures = polygons.map((feature, index) =>
        createPointFeature(feature, index, feature.properties?.site_name || 'Harris Grid')
      );

      pointFeatures.sort((a, b) => b.properties.intensity - a.properties.intensity);

      const collection = {
        type: 'FeatureCollection',
        features: pointFeatures
      };

      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.getSource(SOURCE_ID).setData(collection);
      } else {
        mapInstance.addSource(SOURCE_ID, {
          type: 'geojson',
          data: collection
        });
      }

      const beforeLayer =
        mapInstance.getLayer('waterway-label') ||
        mapInstance.getLayer('poi-label') ||
        mapInstance.getLayer('road-label');

      if (!mapInstance.getLayer(HEATMAP_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: HEATMAP_LAYER_ID,
            type: 'heatmap',
            source: SOURCE_ID,
            maxzoom: 16,
            paint: {
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0,
                0.05,
                1,
                1
              ],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.6],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 22, 16, 70],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 15, 0],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(17,24,39,0)',
                0.2,
                'rgba(30,64,175,0.4)',
                0.4,
                'rgba(37,99,235,0.6)',
                0.6,
                'rgba(22,163,74,0.7)',
                0.8,
                'rgba(234,179,8,0.85)',
                1,
                'rgba(220,38,38,0.95)'
              ]
            }
          },
          beforeLayer ? beforeLayer.id : undefined
        );
      }

      if (!mapInstance.getLayer(CIRCLE_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: CIRCLE_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            minzoom: 11,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0,
                4,
                0.5,
                8,
                1,
                14
              ],
              'circle-color': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0,
                '#0f172a',
                0.3,
                '#2563eb',
                0.6,
                '#eab308',
                1,
                '#ef4444'
              ],
              'circle-stroke-color': '#0f172a',
              'circle-stroke-width': 1.2,
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 0.95]
            }
          },
          beforeLayer ? beforeLayer.id : undefined
        );
      }

      emitLegend(pointFeatures);
      isMountedRef.current = true;
    };

    const ensureLayer = () => {
      addHeatmap().catch((error) => {
        console.error('GridCapacityLayer: failed to create heatmap', error);
      });
    };

    const handleStyleData = () => {
      if (!visible || cancelled) return;
      ensureLayer();
    };

    if (!visible) {
      if (isMountedRef.current && window.mapEventBus) {
        window.mapEventBus.emit('grid:unmounted');
      }
      removeLayers();
      isMountedRef.current = false;
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
      return;
    }

    if (!mapInstance.isStyleLoaded()) {
      const waitForStyle = () => {
        ensureLayer();
        mapInstance.off('styledata', waitForStyle);
      };
      mapInstance.on('styledata', waitForStyle);
      return () => {
        cancelled = true;
        mapInstance.off('styledata', waitForStyle);
      };
    }

    ensureLayer();

    if (!styleListenerAttachedRef.current) {
      mapInstance.on('styledata', handleStyleData);
      styleListenerAttachedRef.current = true;
    }

    return () => {
      cancelled = true;
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
      if (!visible) {
        removeLayers();
      }
    };
  }, [map, visible]);

  useEffect(() => {
    return () => {
      if (map?.current) {
        const mapInstance = map.current;
        if (mapInstance.getLayer(CIRCLE_LAYER_ID)) {
          mapInstance.removeLayer(CIRCLE_LAYER_ID);
        }
        if (mapInstance.getLayer(HEATMAP_LAYER_ID)) {
          mapInstance.removeLayer(HEATMAP_LAYER_ID);
        }
        if (mapInstance.getSource(SOURCE_ID)) {
          mapInstance.removeSource(SOURCE_ID);
        }
      }
    };
  }, [map]);

  return null;
};

export default GridCapacityLayer;
