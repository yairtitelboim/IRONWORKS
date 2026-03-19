import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import { NC_POWER_SITES } from '../../../config/ncPowerSites';

const SOURCE_ID = 'commute-isochrones-source';
const ISOCHRONE_LAYER_ID = 'commute-isochrones-fill';
const ISOCHRONE_OUTLINE_LAYER_ID = 'commute-isochrones-outline';
const OVERLAP_LAYER_ID = 'commute-overlap-fill';
const ASHEBORO_LAYER_ID = 'commute-asheboro-marker';

const TARGET_SITES = ['toyota_battery_nc', 'wolfspeed_nc', 'vinfast_nc'];

const SITE_COLORS = {
  toyota_battery_nc: '#60a5fa',
  wolfspeed_nc: '#f97316',
  vinfast_nc: '#34d399'
};

const OVERLAP_COLOR = 'rgba(99,102,241,0.6)';
const OVERLAP_OUTLINE = '#312e81';

const ASHEBORO_COORDS = [-79.8136, 35.7079];

const buildIsochronoFeature = (site) => {
  // ~30 minute drive approximation ~ 28km radius (conservative)
  const circle = turf.circle([site.coordinates.lng, site.coordinates.lat], 28, {
    steps: 128,
    units: 'kilometers'
  });

  return {
    type: 'Feature',
    geometry: circle.geometry,
    properties: {
      siteKey: site.key,
      name: site.name,
      shortName: site.shortName,
      color: SITE_COLORS[site.key] || '#38bdf8'
    }
  };
};

const CommuteIsochronesLayer = ({ map, visible }) => {
  const isMountedRef = useRef(false);
  const styleListenerAttachedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;
    let cancelled = false;

    const removeLayers = () => {
      if (mapInstance.getLayer(ISOCHRONE_LAYER_ID)) {
        mapInstance.removeLayer(ISOCHRONE_LAYER_ID);
      }
      if (mapInstance.getLayer(ISOCHRONE_OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(ISOCHRONE_OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(OVERLAP_LAYER_ID)) {
        mapInstance.removeLayer(OVERLAP_LAYER_ID);
      }
      if (mapInstance.getLayer(ASHEBORO_LAYER_ID)) {
        mapInstance.removeLayer(ASHEBORO_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };

    const emitLegend = (overlapAreaKm2) => {
      if (!window.mapEventBus) return;
      window.mapEventBus.emit('commute:loaded', {
        overlapAreaKm2,
        timestamp: Date.now()
      });
    };

    const ensureLayer = () => {
      const targetSites = NC_POWER_SITES.filter((site) => TARGET_SITES.includes(site.key));
      const isochroneFeatures = targetSites.map(buildIsochronoFeature);

      if (isochroneFeatures.length === 0) {
        if (window.mapEventBus) {
          window.mapEventBus.emit('commute:unmounted');
        }
        return;
      }

      let overlap = null;
      if (isochroneFeatures.length >= 2) {
        for (let i = 0; i < isochroneFeatures.length; i += 1) {
          for (let j = i + 1; j < isochroneFeatures.length; j += 1) {
            const first = turf.feature(isochroneFeatures[i].geometry);
            const second = turf.feature(isochroneFeatures[j].geometry);
            const inter = turf.intersect(first, second);
            if (inter) {
              overlap = overlap ? turf.union(overlap, inter) : inter;
            }
          }
        }
      }

      const asheboroBuffer = turf.circle(ASHEBORO_COORDS, 2.5, {
        steps: 64,
        units: 'kilometers'
      });

      const collection = {
        type: 'FeatureCollection',
        features: [
          ...isochroneFeatures,
          ...(overlap
            ? [
                {
                  type: 'Feature',
                  geometry: overlap.geometry,
                  properties: {
                    type: 'overlap',
                    areaKm2: turf.area(overlap) / 1_000_000
                  }
                }
              ]
            : []),
          {
            type: 'Feature',
            geometry: asheboroBuffer.geometry,
            properties: {
              type: 'asheboro',
              name: 'Asheboro (Klaussner legacy workforce hub)'
            }
          }
        ]
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
        mapInstance.getLayer('admin-1-boundary') ||
        mapInstance.getLayer('road-label') ||
        mapInstance.getLayer('waterway-label');

      if (!mapInstance.getLayer(ISOCHRONE_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: ISOCHRONE_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            filter: ['!in', ['get', 'type'], 'overlap', 'asheboro'],
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#38bdf8'],
              'fill-opacity': 0.22
            }
          },
          beforeLayer ? beforeLayer.id : undefined
        );
      }

      if (!mapInstance.getLayer(ISOCHRONE_OUTLINE_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: ISOCHRONE_OUTLINE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            filter: ['!in', ['get', 'type'], 'overlap', 'asheboro'],
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#1e3a8a'],
              'line-width': 1.5,
              'line-opacity': 0.8,
              'line-dasharray': [2, 2]
            }
          },
          ISOCHRONE_LAYER_ID
        );
      }

      if (!mapInstance.getLayer(OVERLAP_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: OVERLAP_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            filter: ['==', ['get', 'type'], 'overlap'],
            paint: {
              'fill-color': OVERLAP_COLOR,
              'fill-opacity': 0.65
            }
          },
          ISOCHRONE_LAYER_ID
        );
      }

      if (!mapInstance.getLayer(ASHEBORO_LAYER_ID)) {
        mapInstance.addLayer(
          {
            id: ASHEBORO_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            filter: ['==', ['get', 'type'], 'asheboro'],
            paint: {
              'line-color': '#f59e0b',
              'line-width': 2.5,
              'line-dasharray': [0.5, 1.25],
              'line-opacity': 0.9
            }
          },
          ISOCHRONE_LAYER_ID
        );
      }

      const overlapArea = overlap ? turf.area(overlap) / 1_000_000 : 0;
      if (overlap) {
        emitLegend(overlapArea);
      } else if (window.mapEventBus) {
        window.mapEventBus.emit('commute:unmounted');
      }
      isMountedRef.current = true;
    };

    const handleStyleData = () => {
      if (!visible || cancelled) return;
      ensureLayer();
    };

    if (!visible) {
      if (isMountedRef.current && window.mapEventBus) {
        window.mapEventBus.emit('commute:unmounted');
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
        if (mapInstance.getLayer(ASHEBORO_LAYER_ID)) {
          mapInstance.removeLayer(ASHEBORO_LAYER_ID);
        }
        if (mapInstance.getLayer(OVERLAP_LAYER_ID)) {
          mapInstance.removeLayer(OVERLAP_LAYER_ID);
        }
        if (mapInstance.getLayer(ISOCHRONE_OUTLINE_LAYER_ID)) {
          mapInstance.removeLayer(ISOCHRONE_OUTLINE_LAYER_ID);
        }
        if (mapInstance.getLayer(ISOCHRONE_LAYER_ID)) {
          mapInstance.removeLayer(ISOCHRONE_LAYER_ID);
        }
        if (mapInstance.getSource(SOURCE_ID)) {
          mapInstance.removeSource(SOURCE_ID);
        }
      }
    };
  }, [map]);

  return null;
};

export default CommuteIsochronesLayer;
