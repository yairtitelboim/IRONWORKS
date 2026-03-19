import { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const DEFAULT_SEGMENT_FILES = [
  '/data/greensboro_durham/greensboro_to_durham.geojson',
];

const LAYER_ID = 'greensboro-durham-layer';
const PARTICLE_SOURCE_ID = 'greensboro-durham-particles';
const PARTICLE_LAYER_ID = 'greensboro-durham-particles-layer';

export default function GreensboroDurhamRouteLayer({ map, visible }) {
  const rafRef = useRef(null);
  const particleDataRef = useRef([]);
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;

    const loadLayer = async () => {
      try {
        const res = await fetch(DEFAULT_SEGMENT_FILES[0]);
        const geojson = await res.json();

        if (!m.getSource(LAYER_ID)) {
          m.addSource(LAYER_ID, { type: 'geojson', data: geojson });
        }

        if (!m.getLayer(LAYER_ID)) {
          m.addLayer({
            id: LAYER_ID,
            type: 'line',
            source: LAYER_ID,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#FF8C00', // Orange
              'line-width': 1,        // Same width as Toyota route
              'line-opacity': 0.9,
            },
          });
        }

        // Move the layer to ensure visibility
        m.moveLayer(LAYER_ID);

        // Extract coordinates for particles
        const coords = [];
        geojson.features.forEach(feature => {
          if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
            coords.push(...feature.geometry.coordinates);
          } else if (feature.geometry?.type === 'MultiLineString') {
            feature.geometry.coordinates.forEach(line => {
              coords.push(...line);
            });
          }
        });
        particleDataRef.current = coords;

        // Setup particle source and layer
        if (!m.getSource(PARTICLE_SOURCE_ID)) {
          m.addSource(PARTICLE_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        if (!m.getLayer(PARTICLE_LAYER_ID)) {
          m.addLayer({
            id: PARTICLE_LAYER_ID,
            type: 'circle',
            source: PARTICLE_SOURCE_ID,
            paint: {
              'circle-radius': 4,
              'circle-color': '#FFFFFF',
              'circle-opacity': 0.85,
              'circle-blur': 0.2,
            },
          });
        }

        // Animate particles
        const count = 60;
        const speed = 0.000007; // Same slow speed as Toyota route

        const animate = () => {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
          }

          const now = Date.now() * speed;
          const features = [];
          const n = particleDataRef.current.length - 1;

          for (let i = 0; i < count; i += 1) {
            const particleProgress = ((now + i / count) % 1);
            const idx = Math.floor(particleProgress * n);
            const nextIdx = Math.min(idx + 1, n);
            const frac = (particleProgress * n) % 1;

            const a = particleDataRef.current[idx];
            const b = particleDataRef.current[nextIdx];
            const lng = a[0] + (b[0] - a[0]) * frac;
            const lat = a[1] + (b[1] - a[1]) * frac;

            features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {}
            });
          }

          try {
            const source = m.getSource(PARTICLE_SOURCE_ID);
            if (source) {
              source.setData({ type: 'FeatureCollection', features });
            }
          } catch (_) {}

          rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
      } catch (err) {
        console.error('Error loading Greensboro-Durham layer', err);
      }
    };

    if (visible) {
      loadLayer();
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (m.getLayer(PARTICLE_LAYER_ID)) m.removeLayer(PARTICLE_LAYER_ID);
      if (m.getSource(PARTICLE_SOURCE_ID)) m.removeSource(PARTICLE_SOURCE_ID);
      if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
      if (m.getSource(LAYER_ID)) m.removeSource(LAYER_ID);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (m.getLayer(PARTICLE_LAYER_ID)) m.removeLayer(PARTICLE_LAYER_ID);
      if (m.getSource(PARTICLE_SOURCE_ID)) m.removeSource(PARTICLE_SOURCE_ID);
      if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
      if (m.getSource(LAYER_ID)) m.removeSource(LAYER_ID);
    };
  }, [map, visible]);

  return null;
}
