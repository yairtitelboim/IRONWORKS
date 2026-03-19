import { useEffect, useRef } from 'react';

const DEFAULT_SEGMENT_FILES = [
  '/data/toyota_access/us64_multi_state.geojson',
  '/data/toyota_access/continuous_us421_to_toyota.geojson',
];

const SOURCE_ID = 'toyota-access-route-source';
const LAYER_ID = 'toyota-access-route-layer';
const PARTICLE_SOURCE_ID = 'toyota-access-route-particles';
const PARTICLE_LAYER_ID = 'toyota-access-route-particles-layer';

export default function ToyotaAccessRouteLayer({ map, visible }) {
  const rafRef = useRef(null);
  const particleDataRef = useRef([]);
  useEffect(() => {
    if (!map?.current) return;
    const m = map.current;

    const loadAll = async () => {
      try {
        const collections = await Promise.all(
          DEFAULT_SEGMENT_FILES.map(path => fetch(path).then(res => res.json()))
        );

        // Merge all features
        const allFeatures = collections.flatMap(c => c.features || []);
        const multi = {
          type: 'FeatureCollection',
          features: allFeatures
        };

        if (!m.getSource(SOURCE_ID)) {
          m.addSource(SOURCE_ID, { type: 'geojson', data: multi });
        } else {
          m.getSource(SOURCE_ID).setData(multi);
        }

        if (!m.getLayer(LAYER_ID)) {
          m.addLayer({
            id: LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-width': 1,
              'line-opacity': 0.9,
              'line-color': '#FFD700',
            },
          });
        }

        m.moveLayer(LAYER_ID);

        // Extract coordinates for particles
        const coords = [];
        allFeatures.forEach(feature => {
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
        const speed = 0.000007; // Reduced from 0.00008 to slow down particles

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
        console.error('[ToyotaAccessRouteLayer] Error:', err);
      }
    };

    if (visible) {
      loadAll();
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (m.getLayer(PARTICLE_LAYER_ID)) m.removeLayer(PARTICLE_LAYER_ID);
      if (m.getSource(PARTICLE_SOURCE_ID)) m.removeSource(PARTICLE_SOURCE_ID);
      if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
      if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (m.getLayer(PARTICLE_LAYER_ID)) m.removeLayer(PARTICLE_LAYER_ID);
      if (m.getSource(PARTICLE_SOURCE_ID)) m.removeSource(PARTICLE_SOURCE_ID);
      if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
      if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
}
