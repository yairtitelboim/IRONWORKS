import React, { useRef, useState, useEffect } from 'react';
import { ToggleSwitch, SubLayerContainer, SubLayer } from './styles/LayerToggleStyles';
import { TRANSPORTATION_CATEGORIES } from '../constants/layerConstants';
import { COLORS } from '../constants/layerConstants';
import {
  ROUTE_SOURCE_ID,
  ROUTE_LAYER_ID,
  I10_ROUTE_SOURCE_ID,
  I10_ROUTE_LAYER_ID,
  I10_OSM_ROUTE_SOURCE_ID,
  I10_OSM_ROUTE_LAYER_ID,
  I10_OSM_OZONA_SONORA_ROUTE_SOURCE_ID,
  I10_OSM_OZONA_SONORA_ROUTE_LAYER_ID,
  US277_OSM_SONORA_ROCKSPRINGS_ROUTE_SOURCE_ID,
  US277_OSM_SONORA_ROCKSPRINGS_ROUTE_LAYER_ID,
  I10_FORT_STOCKTON_OZONA_SOURCE_ID,
  I10_FORT_STOCKTON_OZONA_LAYER_ID,
  I10_OZONA_JUNCTION_SONORA_SOURCE_ID,
  I10_OZONA_JUNCTION_SONORA_LAYER_ID,
  US83_ROCKSPRINGS_LEAKEY_SOURCE_ID,
  US83_ROCKSPRINGS_LEAKEY_LAYER_ID,
  US377_LEAKEY_UTOPIA_SOURCE_ID,
  US377_LEAKEY_UTOPIA_LAYER_ID,
  LEAKEY_HONDO_SOURCE_ID,
  LEAKEY_HONDO_LAYER_ID,
  UTOPIA_HONDO_SOURCE_ID,
  UTOPIA_HONDO_LAYER_ID,
  US90_HONDO_CASTROVILLE_SOURCE_ID,
  US90_HONDO_CASTROVILLE_LAYER_ID,
  HONDO_CASTROVILLE_SOURCE_ID,
  HONDO_CASTROVILLE_LAYER_ID,
  ROCKSPRINGS_SONORA_SOURCE_ID,
  ROCKSPRINGS_SONORA_LAYER_ID,
  SONORA_JUNCTION_SOURCE_ID,
  SONORA_JUNCTION_LAYER_ID,
  JUNCTION_UTOPIA_SOURCE_ID,
  JUNCTION_UTOPIA_LAYER_ID,
  JUNCTION_CASTROVILLE_SOURCE_ID,
  JUNCTION_CASTROVILLE_LAYER_ID,
  PATH_A_SOURCE_ID,
  PATH_A_LAYER_ID,
  SAND_LAKE_CIRCLE_SOURCE_ID,
  SAND_LAKE_CIRCLE_LAYER_ID,
  BAKER_CIRCLE_SOURCE_ID,
  BAKER_CIRCLE_LAYER_ID,
  FORT_STOCKTON_SOUTH_CIRCLE_SOURCE_ID,
  FORT_STOCKTON_SOUTH_CIRCLE_LAYER_ID,
  COYOTE_CIRCLE_SOURCE_ID,
  COYOTE_CIRCLE_LAYER_ID,
  OZONA_COORDS,
  FORT_STOCKTON_COORDS,
  HIGHWAY_SEGMENTS,
  PATH_A_CIRCLES_SOURCE_ID,
  PATH_A_CIRCLES_LAYER_ID,
  PATH_A_CIRCLES_LABEL_LAYER_ID
} from '../constants/highwayConstants';
import {
  useHighwaySegmentEffect,
  useRouteHighlightEffect,
  useI10ToggleEffect,
  useOSMRouteEffect,
  useLocationCircleEffect
} from '../utils/highwaySegments';
import * as turf from '@turf/turf';

// Define the main route sublayers for drag-and-drop
const TRANSPORTATION_SUBLAYERS = [
  { key: 'i10FortStocktonOzona', label: 'I-10 Fort Stockton → Ozona' },
  { key: 'i10OzonaJunctionSonora', label: 'I-10 Ozona → Sonora' },
  { key: 'us83RockspringsLeakey', label: 'Rocksprings → Leakey' },
  { key: 'us377LeakeyUtopia', label: 'Leakey → Utopia' },
  { key: 'utopiaHondo', label: 'Utopia → Hondo' },
  { key: 'hondoCastroville', label: 'Hondo → Castroville' },
  { key: 'rockspringsSonora', label: 'Rocksprings → Sonora' },
  { key: 'sonoraJunction', label: 'Sonora → Junction' },
  { key: 'junctionUtopia', label: 'Junction → Utopia' },
  { key: 'junctionCastroville', label: 'Junction → Castroville' },
  { key: 'pathA', label: 'Path A' },
  { key: 'pathB', label: 'Path B' },
  { key: 'pathAA', label: 'Path AA' } // <-- New Path AA toggle
];

const PATH_B_SOURCE_ID = 'path-b-source';
const PATH_B_LAYER_ID = 'path-b-layer';
const PATH_B_FILES = [
  '/data/i10_fort_stockton_ozona_trimmed.geojson',
  '/data/continuous_i10_ozona_sonora_route.geojson',
  '/data/continuous_utopia_hondo_route.geojson',
  '/data/continuous_hondo_castroville_route.geojson',
  '/data/continuous_sonora_junction_route.geojson',
  '/data/continuous_junction_utopia_route.geojson',
];

const PATH_B_CIRCLES_SOURCE_ID = 'path-b-circles-source';
const PATH_B_CIRCLES_LAYER_ID = 'path-b-circles-layer';
const PATH_B_CIRCLES_LABEL_LAYER_ID = 'path-b-circles-label-layer';
const PATH_B_CIRCLES_LARGE_LAYER_ID = 'path-b-circles-large-layer';
const PATH_B_CITIES = [
  { name: 'Fort Stockton', coords: [-102.879996, 30.894348], color: '#FFD600' },
  { name: 'Ozona', coords: [-101.205972, 30.707417], color: '#FFD600' },
  { name: 'Sonora', coords: [-100.645, 30.570], color: '#FFD600' },
  { name: 'Junction', coords: [-99.776, 30.489], color: '#2196F3' },
  { name: 'Utopia', coords: [-99.527, 29.615], color: '#FFD600' },
  { name: 'Hondo', coords: [-99.282, 29.347], color: '#FFD600' },
  { name: 'Castroville', coords: [-98.878, 29.355], color: '#FFA500' }
];

const PATH_AA_PARTICLES_SOURCE_ID = 'path-aa-particles';
const PATH_AA_PARTICLES_LAYER_ID = 'path-aa-particles-layer';
let pathAAAnimationFrame = null;

// Christoval circle constants
const CHRISTOVAL_CIRCLE_SOURCE_ID = 'christoval-circle-source';
const CHRISTOVAL_CIRCLE_LAYER_ID = 'christoval-circle-layer';
const CHRISTOVAL_COORDS = [-100.4957, 31.1977];
// Big Spring circle constants
const BIGSPRING_CIRCLE_SOURCE_ID = 'bigspring-circle-source';
const BIGSPRING_CIRCLE_LAYER_ID = 'bigspring-circle-layer';
const BIGSPRING_COORDS = [-101.4644, 32.2504];

// Christoval and Big Spring marker constants
const CIRCLE_MARKERS_SOURCE_ID = 'circle-markers-source';
const CIRCLE_MARKERS_LAYER_ID = 'circle-markers-layer';

// Castroville pulse animation constants
const CASTROVILLE_PULSE_SOURCE_ID = 'castroville-pulse-source';
const CASTROVILLE_PULSE_LAYER_ID = 'castroville-pulse-layer';
const CASTROVILLE_COORDS = [-98.878, 29.355];

// Fort Stockton pulse animation constants
const FORT_STOCKTON_PULSE_SOURCE_ID = 'fort-stockton-pulse-source';
const FORT_STOCKTON_PULSE_LAYER_ID = 'fort-stockton-pulse-layer';
// Use the already declared FORT_STOCKTON_COORDS

const TransportationNetworkLayer = ({
  map,
  expandedCategories,
  showTransportation,
  showRoads,
  setShowRoads,
  showOzonaFortStocktonParticles,
  setShowOzonaFortStocktonParticles,
  showSectionA,
  setShowSectionA,
  handleToggle
}) => {
  // Local state for transportation toggles
  // REMOVE: highlightOzonaFortStockton, showI10, showOzonaFortStocktonParticles, showSectionA
  // const [highlightOzonaFortStockton, setHighlightOzonaFortStockton] = useState(false);
  // const [showI10, setShowI10] = useState(false);
  // const [showOzonaFortStocktonParticles, setShowOzonaFortStocktonParticles] = useState(false);
  // const [showSectionA, setShowSectionA] = useState(false);
  // const [showI10OSM, setShowI10OSM] = useState(false);
  // const [showI10OSMOzonaSonora, setShowI10OSMOzonaSonora] = useState(false);
  // const [showUS277OSMSonoraRocksprings, setShowUS277OSMSonoraRocksprings] = useState(false);
  
  // New highway segment states
  const [showI10FortStocktonOzona, setShowI10FortStocktonOzona] = useState(false);
  const [showI10OzonaJunctionSonora, setShowI10OzonaJunctionSonora] = useState(false);
  const [showUS83RockspringsLeakey, setShowUS83RockspringsLeakey] = useState(false);
  const [showUS377LeakeyUtopia, setShowUS377LeakeyUtopia] = useState(false);
  const [showLeakeyHondo, setShowLeakeyHondo] = useState(false);
  const [showUtopiaHondo, setShowUtopiaHondo] = useState(false);
  // Removed showUS90HondoCastroville - replaced with more specific Hondo-Castroville segment
  const [showHondoCastroville, setShowHondoCastroville] = useState(false);
  const [showRockspringsSonora, setShowRockspringsSonora] = useState(false);
  const [showSonoraJunction, setShowSonoraJunction] = useState(false);
  const [showJunctionUtopia, setShowJunctionUtopia] = useState(false);
  const [showJunctionCastroville, setShowJunctionCastroville] = useState(false);
  const [showPathA, setShowPathA] = useState(false);
  const [showPathB, setShowPathB] = useState(false);
  const [showPathAA, setShowPathAA] = useState(false);
  
  // Location circle states
  // REMOVE: showSandLakeCircle, showBakerCircle, showFortStocktonSouthCircle, showCoyoteCircle
  // const [showSandLakeCircle, setShowSandLakeCircle] = useState(false);
  // const [showBakerCircle, setShowBakerCircle] = useState(false);
  // const [showFortStocktonSouthCircle, setShowFortStocktonSouthCircle] = useState(false);
  // const [showCoyoteCircle, setShowCoyoteCircle] = useState(false);

  // State for transportation sublayer order
  const [transportationOrder, setTransportationOrder] = useState(TRANSPORTATION_SUBLAYERS.map(s => s.key));
  const dragItem = useRef();
  const dragOverItem = useRef();

  const handleDragStart = (index) => {
    dragItem.current = index;
  };
  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };
  const handleDragEnd = () => {
    const newOrder = [...transportationOrder];
    const dragged = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOverItem.current, 0, dragged);
    setTransportationOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };



  // Create effects for all highway segments
  useHighwaySegmentEffect(
    map?.current,
    showI10FortStocktonOzona,
    I10_FORT_STOCKTON_OZONA_SOURCE_ID,
    I10_FORT_STOCKTON_OZONA_LAYER_ID,
    '/data/i10_fort_stockton_ozona_trimmed.geojson',
    '#4A90E2', // blue
    'I-10 Fort Stockton-Ozona'
  );

  useHighwaySegmentEffect(
    map?.current,
    showI10OzonaJunctionSonora,
    I10_OZONA_JUNCTION_SONORA_SOURCE_ID,
    I10_OZONA_JUNCTION_SONORA_LAYER_ID,
    '/data/continuous_i10_ozona_sonora_route.geojson',
    '#7B68EE', // medium slate blue
    'I-10 Ozona → Sonora'
  );

  useHighwaySegmentEffect(
    map?.current,
    showUS83RockspringsLeakey,
    US83_ROCKSPRINGS_LEAKEY_SOURCE_ID,
    US83_ROCKSPRINGS_LEAKEY_LAYER_ID,
    '/data/continuous_rocksprings_leakey_route.geojson',
    '#DC143C', // crimson
    'Rocksprings → Leakey'
  );

  useHighwaySegmentEffect(
    map?.current,
    showUS377LeakeyUtopia,
    US377_LEAKEY_UTOPIA_SOURCE_ID,
    US377_LEAKEY_UTOPIA_LAYER_ID,
    '/data/continuous_leakey_utopia_route.geojson',
    '#FF6347', // tomato
    'Leakey → Utopia'
  );

  useHighwaySegmentEffect(
    map?.current,
    showUtopiaHondo,
    UTOPIA_HONDO_SOURCE_ID,
    UTOPIA_HONDO_LAYER_ID,
    '/data/continuous_utopia_hondo_route.geojson',
    '#9932CC', // dark orchid
    'Utopia → Hondo'
  );

  // Removed US-90 Hondo-Castroville - replaced with more specific segment

  useHighwaySegmentEffect(
    map?.current,
    showHondoCastroville,
    HONDO_CASTROVILLE_SOURCE_ID,
    HONDO_CASTROVILLE_LAYER_ID,
    '/data/continuous_hondo_castroville_route.geojson',
    '#FF1493', // deep pink
    'Hondo → Castroville'
  );

  useHighwaySegmentEffect(
    map?.current,
    showRockspringsSonora,
    ROCKSPRINGS_SONORA_SOURCE_ID,
    ROCKSPRINGS_SONORA_LAYER_ID,
    '/data/continuous_rocksprings_sonora_route.geojson',
    '#8A2BE2', // blue violet
    'Rocksprings → Sonora'
  );

  useHighwaySegmentEffect(
    map?.current,
    showSonoraJunction,
    SONORA_JUNCTION_SOURCE_ID,
    SONORA_JUNCTION_LAYER_ID,
    '/data/continuous_sonora_junction_route.geojson',
    '#20B2AA', // light sea green
    'Sonora → Junction'
  );

  useHighwaySegmentEffect(
    map?.current,
    showJunctionUtopia,
    JUNCTION_UTOPIA_SOURCE_ID,
    JUNCTION_UTOPIA_LAYER_ID,
    '/data/continuous_junction_utopia_route.geojson',
    '#FFA500', // orange
    'Junction → Utopia'
  );

  useHighwaySegmentEffect(
    map?.current,
    showJunctionCastroville,
    JUNCTION_CASTROVILLE_SOURCE_ID,
    JUNCTION_CASTROVILLE_LAYER_ID,
    '/data/continuous_junction_castroville_route.geojson',
    '#DA70D6', // orchid
    'Junction → Castroville'
  );

  useHighwaySegmentEffect(
    map?.current,
    showPathA,
    PATH_A_SOURCE_ID,
    PATH_A_LAYER_ID,
    '/data/path_a.geojson',
    '#FFD700', // gold
    'Path A',
    { 'line-width': 1.4 }
  );

  const pathACoordsRef = useRef([]);
  const [pathADataLoaded, setPathADataLoaded] = useState(false);
  let pathAAAnimationFrame = null;

  async function fetchPathACoords() {
    if (pathACoordsRef.current.length > 0) return pathACoordsRef.current;
    const resp = await fetch('/data/path_a.geojson');
    const data = await resp.json();
    let coords = [];
    (data.features || []).forEach(f => {
      if (f.geometry.type === 'LineString') {
        coords = coords.concat(f.geometry.coordinates);
      } else if (f.geometry.type === 'MultiLineString') {
        f.geometry.coordinates.forEach(line => {
          coords = coords.concat(line);
        });
      }
    });
    pathACoordsRef.current = coords;
    setPathADataLoaded(true);
    return coords;
  }

  function animatePathAAParticles(map) {
    const coords = pathACoordsRef.current;
    if (!coords.length) return;
    const particleCount = 60;
    const now = Date.now();
    const features = [];
    for (let i = 0; i < particleCount; i++) {
      const progress = ((now * 0.00008) + i / particleCount) % 1;
      const idx = Math.floor(progress * (coords.length - 1));
      const nextIdx = (idx + 1) % coords.length;
      const frac = (progress * (coords.length - 1)) % 1;
      const pos = [
        coords[idx][0] + (coords[nextIdx][0] - coords[idx][0]) * frac,
        coords[idx][1] + (coords[nextIdx][1] - coords[idx][1]) * frac
      ];
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: pos }
      });
    }
    const source = map.getSource(PATH_AA_PARTICLES_SOURCE_ID);
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
    pathAAAnimationFrame = requestAnimationFrame(() => animatePathAAParticles(map));
  }

  useEffect(() => {
    if (!map?.current) return;
    if (!showPathB) {
      if (map.current.getLayer(PATH_B_LAYER_ID)) map.current.removeLayer(PATH_B_LAYER_ID);
      if (map.current.getSource(PATH_B_SOURCE_ID)) map.current.removeSource(PATH_B_SOURCE_ID);
      return;
    }
    let cancelled = false;
    const fetchAndJoin = async () => {
      try {
        const all = await Promise.all(PATH_B_FILES.map(f => fetch(f).then(r => r.json())));
        // Collect all LineString/MultiLineString coordinates
        const lines = [];
        all.forEach(fc => {
          fc.features.forEach(feat => {
            if (feat.geometry.type === 'LineString') {
              lines.push(feat.geometry.coordinates);
            } else if (feat.geometry.type === 'MultiLineString') {
              lines.push(...feat.geometry.coordinates);
            }
          });
        });
        const multi = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines }, properties: {} };
        const geojson = { type: 'FeatureCollection', features: [multi] };
        if (cancelled) return;
        if (map.current.getLayer(PATH_B_LAYER_ID)) map.current.removeLayer(PATH_B_LAYER_ID);
        if (map.current.getSource(PATH_B_SOURCE_ID)) map.current.removeSource(PATH_B_SOURCE_ID);
        map.current.addSource(PATH_B_SOURCE_ID, { type: 'geojson', data: geojson });
        map.current.addLayer({
          id: PATH_B_LAYER_ID,
          type: 'line',
          source: PATH_B_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FF9900', // bright orange
            'line-width': 1.5,
            'line-opacity': 0.9
          }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load Path B segments', e);
      }
    };
    fetchAndJoin();
    return () => {
      cancelled = true;
      if (map.current.getLayer(PATH_B_LAYER_ID)) map.current.removeLayer(PATH_B_LAYER_ID);
      if (map.current.getSource(PATH_B_SOURCE_ID)) map.current.removeSource(PATH_B_SOURCE_ID);
    };
  }, [showPathB, map]);

  useEffect(() => {
    if (!map?.current) return;
    if (!showPathB) {
      if (map.current.getLayer(PATH_B_CIRCLES_LABEL_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LABEL_LAYER_ID);
      if (map.current.getLayer(PATH_B_CIRCLES_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LAYER_ID);
      if (map.current.getLayer(PATH_B_CIRCLES_LARGE_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LARGE_LAYER_ID);
      if (map.current.getSource(PATH_B_CIRCLES_SOURCE_ID)) map.current.removeSource(PATH_B_CIRCLES_SOURCE_ID);
      return;
    }
    // Build FeatureCollection for circles
    const features = PATH_B_CITIES.filter(city => city.name === 'Junction').map(city => {
      const circle = turf.circle(city.coords, 5 * 1.60934, { steps: 128, units: 'kilometers' });
      circle.properties = { name: city.name, color: city.color, type: 'normal' };
      return circle;
    });
    // Add large circle for Junction only
    const largeFeatures = PATH_B_CITIES.filter(city => city.name === 'Junction').map(city => {
      const circle = turf.circle(city.coords, 8 * 1.60934, { steps: 128, units: 'kilometers' });
      circle.properties = { name: city.name, color: '#FFA500', type: 'large' };
      return circle;
    });
    const geojson = { type: 'FeatureCollection', features: [...features, ...largeFeatures] };
    if (map.current.getLayer(PATH_B_CIRCLES_LABEL_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LABEL_LAYER_ID);
    if (map.current.getLayer(PATH_B_CIRCLES_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LAYER_ID);
    if (map.current.getLayer(PATH_B_CIRCLES_LARGE_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LARGE_LAYER_ID);
    if (map.current.getSource(PATH_B_CIRCLES_SOURCE_ID)) map.current.removeSource(PATH_B_CIRCLES_SOURCE_ID);
    map.current.addSource(PATH_B_CIRCLES_SOURCE_ID, { type: 'geojson', data: geojson });
    map.current.addLayer({
      id: PATH_B_CIRCLES_LAYER_ID,
      type: 'line',
      source: PATH_B_CIRCLES_SOURCE_ID,
      filter: ['==', ['get', 'type'], 'normal'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9
      }
    });
    map.current.addLayer({
      id: PATH_B_CIRCLES_LARGE_LAYER_ID,
      type: 'line',
      source: PATH_B_CIRCLES_SOURCE_ID,
      filter: ['==', ['get', 'type'], 'large'],
      paint: {
        'line-color': '#FFA500',
        'line-width': 1,
        'line-dasharray': [2, 2],
        'line-opacity': 0.7
      },
      minzoom: 0,
      maxzoom: 8
    });
    // Add label for Junction only
    map.current.addLayer({
      id: PATH_B_CIRCLES_LABEL_LAYER_ID,
      type: 'symbol',
      source: PATH_B_CIRCLES_SOURCE_ID,
      filter: ['all', ['==', ['get', 'name'], 'Junction'], ['==', ['get', 'type'], 'normal']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 16,
        'text-font': ['Arial Unicode MS Regular'],
        'text-anchor': 'top',
        'text-offset': [0, 2],
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#fff'
      }
    });
    return () => {
      if (map.current.getLayer(PATH_B_CIRCLES_LABEL_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LABEL_LAYER_ID);
      if (map.current.getLayer(PATH_B_CIRCLES_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LAYER_ID);
      if (map.current.getLayer(PATH_B_CIRCLES_LARGE_LAYER_ID)) map.current.removeLayer(PATH_B_CIRCLES_LARGE_LAYER_ID);
      if (map.current.getSource(PATH_B_CIRCLES_SOURCE_ID)) map.current.removeSource(PATH_B_CIRCLES_SOURCE_ID);
    };
  }, [showPathB, map]);

  // Pulse animation for Path B Junction circle
  useEffect(() => {
    if (!map?.current || !showPathB) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.002;
      // Pulse between 0.5 and 1 opacity, and width 2.5 to 4.5 (like Path A)
      const opacity = 0.5 + 0.5 * Math.abs(Math.sin(t));
      const width = 2.5 + 2 * Math.abs(Math.sin(t));
      if (map.current.getLayer(PATH_B_CIRCLES_LAYER_ID)) {
        map.current.setPaintProperty(PATH_B_CIRCLES_LAYER_ID, 'line-opacity', opacity);
        map.current.setPaintProperty(PATH_B_CIRCLES_LAYER_ID, 'line-width', width);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer(PATH_B_CIRCLES_LAYER_ID)) {
        map.current.setPaintProperty(PATH_B_CIRCLES_LAYER_ID, 'line-opacity', 0.9);
        map.current.setPaintProperty(PATH_B_CIRCLES_LAYER_ID, 'line-width', 3);
      }
    };
  }, [showPathB, map]);

  // Pulse animation for Christoval and Big Spring 10-mile circles
  useEffect(() => {
    if (!map?.current || !showPathB) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.002;
      // Pulse between 0.5 and 1 opacity, and width 1.5 to 3.5
      const opacity = 0.5 + 0.5 * Math.abs(Math.sin(t));
      const width = 1.5 + 2 * Math.abs(Math.sin(t));
      if (map.current.getLayer(CHRISTOVAL_CIRCLE_LAYER_ID)) {
        map.current.setPaintProperty(CHRISTOVAL_CIRCLE_LAYER_ID, 'line-opacity', opacity);
        map.current.setPaintProperty(CHRISTOVAL_CIRCLE_LAYER_ID, 'line-width', width);
      }
      if (map.current.getLayer(BIGSPRING_CIRCLE_LAYER_ID)) {
        map.current.setPaintProperty(BIGSPRING_CIRCLE_LAYER_ID, 'line-opacity', opacity);
        map.current.setPaintProperty(BIGSPRING_CIRCLE_LAYER_ID, 'line-width', width);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer(CHRISTOVAL_CIRCLE_LAYER_ID)) {
        map.current.setPaintProperty(CHRISTOVAL_CIRCLE_LAYER_ID, 'line-opacity', 0.9);
        map.current.setPaintProperty(CHRISTOVAL_CIRCLE_LAYER_ID, 'line-width', 2);
      }
      if (map.current.getLayer(BIGSPRING_CIRCLE_LAYER_ID)) {
        map.current.setPaintProperty(BIGSPRING_CIRCLE_LAYER_ID, 'line-opacity', 0.9);
        map.current.setPaintProperty(BIGSPRING_CIRCLE_LAYER_ID, 'line-width', 2);
      }
    };
  }, [showPathB, map]);

  // Location circle effects
  // REMOVE: useLocationCircleEffect(
  //   map?.current,
  //   showSandLakeCircle,
  //   SAND_LAKE_CIRCLE_SOURCE_ID,
  //   SAND_LAKE_CIRCLE_LAYER_ID,
  //   '/data/sand_lake_2mile_circle.geojson',
  //   '#FF6B6B', // coral red
  //   'Sand Lake Circle'
  // );
  // REMOVE: useLocationCircleEffect(
  //   map?.current,
  //   showBakerCircle,
  //   BAKER_CIRCLE_SOURCE_ID,
  //   BAKER_CIRCLE_LAYER_ID,
  //   '/data/baker_2mile_circle.geojson',
  //   '#4ECDC4', // turquoise
  //   'Baker Circle'
  // );
  // REMOVE: useLocationCircleEffect(
  //   map?.current,
  //   showFortStocktonSouthCircle,
  //   FORT_STOCKTON_SOUTH_CIRCLE_SOURCE_ID,
  //   FORT_STOCKTON_SOUTH_CIRCLE_LAYER_ID,
  //   '/data/fort_stockton_south_2mile_circle.geojson',
  //   '#45B7D1', // sky blue
  //   'Fort Stockton South Circle'
  // );
  // REMOVE: useLocationCircleEffect(
  //   map?.current,
  //   showCoyoteCircle,
  //   COYOTE_CIRCLE_SOURCE_ID,
  //   COYOTE_CIRCLE_LAYER_ID,
  //   '/data/coyote_2mile_circle.geojson',
  //   '#F7DC6F', // light yellow
  //   'Coyote Circle'
  // );

  useEffect(() => {
    if (!map?.current) return;

    if (showPathA) {
      // Add source for circles
      if (!map.current.getSource(PATH_A_CIRCLES_SOURCE_ID)) {
        map.current.addSource(PATH_A_CIRCLES_SOURCE_ID, {
          type: 'geojson',
          data: '/data/path_a_circles.geojson',
        });
      }
      // Add dashed line layer for normal circles
      if (!map.current.getLayer(PATH_A_CIRCLES_LAYER_ID)) {
        map.current.addLayer({
          id: PATH_A_CIRCLES_LAYER_ID,
          type: 'line',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'normal'],
          paint: {
            'line-color': '#FFD700', // yellow
            'line-width': 4, // doubled from 2
            'line-dasharray': [2, 2],
          },
          layout: {
            visibility: 'visible',
          },
        });
      }
      // Add dashed line layer for large orange circles (zoomed out)
      // COMMENTED OUT - Large circles from original data source
      /*
      if (!map.current.getLayer('path-a-circles-large-layer')) {
        map.current.addLayer({
          id: 'path-a-circles-large-layer',
          type: 'line',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'large'],
          paint: {
            'line-color': '#FFA500', // orange
            'line-width': 1, // much thinner
            'line-dasharray': [2, 2],
          },
          layout: {
            visibility: 'visible',
          },
          minzoom: 0,
          maxzoom: 8
        });
      }
      */
      // Add dashed line layer for San Antonio circles (purple)
      if (!map.current.getLayer('path-a-san-antonio-circles-layer')) {
        map.current.addLayer({
          id: 'path-a-san-antonio-circles-layer',
          type: 'line',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['in', ['get', 'type'], ['literal', ['san_antonio_5', 'san_antonio_15', 'san_antonio_30']]],
          paint: {
            'line-color': '#FF8C00', // dark orange (same as Austin)
            'line-width': 0.1,
            'line-dasharray': [1, 1],
            'line-opacity': 0.8
          },
          layout: {
            visibility: 'visible',
          },
        });
      }
      // Add dashed line layer for Austin circles (orange)
      // if (!map.current.getLayer('path-a-austin-circles-layer')) {
      //   map.current.addLayer({
      //     id: 'path-a-austin-circles-layer',
      //     type: 'line',
      //     source: PATH_A_CIRCLES_SOURCE_ID,
      //     filter: ['in', ['get', 'type'], ['literal', ['austin_5', 'austin_15', 'austin_30']]],
      //     paint: {
      //       'line-color': '#FF8C00', // dark orange
      //       'line-width': 0.05,
      //       'line-dasharray': [1, 1],
      //       'line-opacity': 0.2
      //     },
      //     layout: {
      //       visibility: 'visible',
      //     },
      //   });
      // }
      // Add fill layer for normal circles (light translucent pink, only when zoomed in)
      if (!map.current.getLayer('path-a-circles-fill-layer')) {
        map.current.addLayer({
          id: 'path-a-circles-fill-layer',
          type: 'fill',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'normal'],
          paint: {
            'fill-color': '#ff69b4', // light pink
            'fill-opacity': 0.15
          },
          layout: {
            visibility: 'visible',
          },
          minzoom: 12
        });
      }
      // Add fill and line layers for larger circles (5 miles larger radius, only when zoomed in)
      // COMMENTED OUT - Second circles around Path A towns
      /*
      if (!map.current.getSource('path-a-circles-large-fill-source')) {
        // Load the original circles and create larger ones using turf
        fetch('/data/path_a_circles.geojson')
          .then(res => res.json())
          .then(data => {
            const largeCircles = data.features
              .map(f => {
                let center;
                if (f.geometry.type === 'Point' &&
                    Array.isArray(f.geometry.coordinates) &&
                    f.geometry.coordinates.length === 2 &&
                    typeof f.geometry.coordinates[0] === 'number' &&
                    typeof f.geometry.coordinates[1] === 'number') {
                  center = f.geometry.coordinates;
                } else if (f.geometry.type === 'Polygon') {
                  try {
                    center = turf.centroid(f).geometry.coordinates;
                  } catch {
                    return null;
                  }
                } else {
                  return null;
                }
                const origRadius = f.properties && f.properties.radius ? f.properties.radius : 0;
                const newRadius = origRadius + 8;
                const circ = turf.circle(center, newRadius, { steps: 80, units: 'miles' });
                circ.properties = { ...f.properties };
                return circ;
              })
              .filter(Boolean);
            const largeGeojson = { type: 'FeatureCollection', features: largeCircles };
            map.current.addSource('path-a-circles-large-fill-source', { type: 'geojson', data: largeGeojson });
            // Fill layer
            map.current.addLayer({
              id: 'path-a-circles-large-fill-layer',
              type: 'fill',
              source: 'path-a-circles-large-fill-source',
              paint: {
                'fill-color': '#ff69b4', // light pink
                'fill-opacity': 0.05
              },
              layout: { visibility: 'visible' },
              minzoom: 10
            });
            // Line layer
            map.current.addLayer({
              id: 'path-a-circles-large-line-layer',
              type: 'line',
              source: 'path-a-circles-large-fill-source',
              paint: {
                'line-color': '#FFD700', // yellow
                'line-width': 1.5,
                'line-dasharray': [2, 2],
                'line-opacity': 1
              },
              layout: { visibility: 'visible' },
              minzoom: 10
            });
          });
      }
      */
      // Add symbol layer for city names
      if (!map.current.getLayer(PATH_A_CIRCLES_LABEL_LAYER_ID)) {
        map.current.addLayer({
          id: PATH_A_CIRCLES_LABEL_LAYER_ID,
          type: 'symbol',
          source: PATH_A_CIRCLES_SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 14,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 2],
            'text-anchor': 'top',
            visibility: 'visible',
          },
          paint: {
            'text-color': '#fff',
          },
        });
      }
      // Add fill layers for San Antonio circles with different opacities
      if (!map.current.getLayer('path-a-san-antonio-circles-fill-5-layer')) {
        map.current.addLayer({
          id: 'path-a-san-antonio-circles-fill-5-layer',
          type: 'fill',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'san_antonio_5'],
          paint: {
            'fill-color': '#ff69b4',
            'fill-opacity': 0.25
          },
          layout: { visibility: 'visible' },
          minzoom: 8
        });
      }
      if (!map.current.getLayer('path-a-san-antonio-circles-fill-15-layer')) {
        map.current.addLayer({
          id: 'path-a-san-antonio-circles-fill-15-layer',
          type: 'fill',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'san_antonio_15'],
          paint: {
            'fill-color': '#ff69b4',
            'fill-opacity': 0.12
          },
          layout: { visibility: 'visible' },
          minzoom: 8
        });
      }
      if (!map.current.getLayer('path-a-san-antonio-circles-fill-30-layer')) {
        map.current.addLayer({
          id: 'path-a-san-antonio-circles-fill-30-layer',
          type: 'fill',
          source: PATH_A_CIRCLES_SOURCE_ID,
          filter: ['==', ['get', 'type'], 'san_antonio_30'],
          paint: {
            'fill-color': '#ff69b4',
            'fill-opacity': 0.06
          },
          layout: { visibility: 'visible' },
          minzoom: 8
        });
      }
    } else {
      // Remove the layers and source if Path A is not shown
      if (map.current.getLayer(PATH_A_CIRCLES_LABEL_LAYER_ID)) {
        map.current.removeLayer(PATH_A_CIRCLES_LABEL_LAYER_ID);
      }
      if (map.current.getLayer(PATH_A_CIRCLES_LAYER_ID)) {
        map.current.removeLayer(PATH_A_CIRCLES_LAYER_ID);
      }
      // COMMENTED OUT - Cleanup for large circles from original data source
      /*
      if (map.current.getLayer('path-a-circles-large-layer')) {
        map.current.removeLayer('path-a-circles-large-layer');
      }
      */
      // COMMENTED OUT - Cleanup for larger circles
      if (map.current.getLayer('path-a-san-antonio-circles-layer')) {
        map.current.removeLayer('path-a-san-antonio-circles-layer');
      }
      if (map.current.getLayer('path-a-austin-circles-layer')) {
        map.current.removeLayer('path-a-austin-circles-layer');
      }
      if (map.current.getLayer('path-a-circles-fill-layer')) {
        map.current.removeLayer('path-a-circles-fill-layer');
      }
      if (map.current.getLayer('path-a-circles-large-fill-layer')) {
        map.current.removeLayer('path-a-circles-large-fill-layer');
      }
      if (map.current.getLayer('path-a-circles-large-line-layer')) {
        map.current.removeLayer('path-a-circles-large-line-layer');
      }
      if (map.current.getSource(PATH_A_CIRCLES_SOURCE_ID)) {
        map.current.removeSource(PATH_A_CIRCLES_SOURCE_ID);
      }
      if (map.current.getSource('path-a-circles-large-fill-source')) {
        map.current.removeSource('path-a-circles-large-fill-source');
      }
      if (map.current.getLayer('path-a-san-antonio-circles-fill-5-layer')) {
        map.current.removeLayer('path-a-san-antonio-circles-fill-5-layer');
      }
      if (map.current.getLayer('path-a-san-antonio-circles-fill-15-layer')) {
        map.current.removeLayer('path-a-san-antonio-circles-fill-15-layer');
      }
      if (map.current.getLayer('path-a-san-antonio-circles-fill-30-layer')) {
        map.current.removeLayer('path-a-san-antonio-circles-fill-30-layer');
      }
    }
  }, [showPathA, map]);

  // Pulse animation for Path A normal circles
  useEffect(() => {
    if (!map?.current || !showPathA) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.002;
      // Pulse between 0.5 and 1 opacity, and width 2.5 to 4.5
      const opacity = 0.5 + 0.5 * Math.abs(Math.sin(t));
      const width = 2.5 + 2 * Math.abs(Math.sin(t));
      if (map.current.getLayer(PATH_A_CIRCLES_LAYER_ID)) {
        map.current.setPaintProperty(PATH_A_CIRCLES_LAYER_ID, 'line-opacity', opacity);
        map.current.setPaintProperty(PATH_A_CIRCLES_LAYER_ID, 'line-width', width);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer(PATH_A_CIRCLES_LAYER_ID)) {
        map.current.setPaintProperty(PATH_A_CIRCLES_LAYER_ID, 'line-opacity', 1);
        map.current.setPaintProperty(PATH_A_CIRCLES_LAYER_ID, 'line-width', 4);
      }
    };
  }, [showPathA, map]);

  // Pulse animation for San Antonio circles
  useEffect(() => {
    if (!map?.current || !showPathA) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.001; // Slower pulse than normal circles
      // Pulse between 0.4 and 0.9 opacity, and width 1.5 to 3
      const opacity = 0.4 + 0.5 * Math.abs(Math.sin(t));
      const width = 0.1 + 0.9 * Math.abs(Math.sin(t));
      if (map.current.getLayer('path-a-san-antonio-circles-layer')) {
        map.current.setPaintProperty('path-a-san-antonio-circles-layer', 'line-opacity', opacity);
        map.current.setPaintProperty('path-a-san-antonio-circles-layer', 'line-width', width);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer('path-a-san-antonio-circles-layer')) {
        map.current.setPaintProperty('path-a-san-antonio-circles-layer', 'line-opacity', 0.8);
        map.current.setPaintProperty('path-a-san-antonio-circles-layer', 'line-width', 2);
      }
    };
  }, [showPathA, map]);

  // Pulse animation for Austin circles
  useEffect(() => {
    if (!map?.current || !showPathA) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.001; // Slower pulse than normal circles
      // Pulse between 0.4 and 0.9 opacity, and width 1.5 to 3
      const opacity = 0.4 + 0.5 * Math.abs(Math.sin(t));
      const width = 1.5 + 1.5 * Math.abs(Math.sin(t));
      if (map.current.getLayer('path-a-austin-circles-layer')) {
        map.current.setPaintProperty('path-a-austin-circles-layer', 'line-opacity', opacity);
        map.current.setPaintProperty('path-a-austin-circles-layer', 'line-width', width);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer('path-a-austin-circles-layer')) {
        map.current.setPaintProperty('path-a-austin-circles-layer', 'line-opacity', 0.8);
        map.current.setPaintProperty('path-a-austin-circles-layer', 'line-width', 2);
      }
    };
  }, [showPathA, map]);

  // Rotation animation for Path A larger circles
  // COMMENTED OUT - Animation for larger circles (circles are commented out)
  /*
  useEffect(() => {
    if (!map?.current || !showPathA) return;
    let frame;
    const animate = () => {
      const t = Date.now() * 0.0005; // Very slow rotation
      // Create a rotating dash pattern by changing the dash array
      const phase = Math.sin(t) * 0.5 + 0.5; // Oscillate between 0 and 1
      const dashLength = 1 + phase * 3; // Vary dash length between 1 and 4
      const gapLength = 4 - phase * 2; // Vary gap length between 2 and 4
      const dashArray = [dashLength, gapLength];
      
      if (map.current.getLayer('path-a-circles-large-line-layer')) {
        map.current.setPaintProperty('path-a-circles-large-line-layer', 'line-dasharray', dashArray);
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      // Restore to default when turning off
      if (map.current.getLayer('path-a-circles-large-line-layer')) {
        map.current.setPaintProperty('path-a-circles-large-line-layer', 'line-dasharray', [2, 2]);
      }
    };
  }, [showPathA, map]);
  */

  useEffect(() => {
    if (!map?.current) return;
    let cancelled = false;
    async function setup() {
      if (showPathAA) {
        if (pathACoordsRef.current.length === 0) {
          await fetchPathACoords();
          if (cancelled) return;
        }
        // Add source/layer if not present
        if (!map.current.getSource(PATH_AA_PARTICLES_SOURCE_ID)) {
          map.current.addSource(PATH_AA_PARTICLES_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }
        if (!map.current.getLayer(PATH_AA_PARTICLES_LAYER_ID)) {
          map.current.addLayer({
            id: PATH_AA_PARTICLES_LAYER_ID,
            type: 'circle',
            source: PATH_AA_PARTICLES_SOURCE_ID,
            paint: {
              'circle-radius': 1,
              'circle-color': '#FFD600',
              'circle-opacity': 0.95,
              'circle-blur': 0.2,
              'circle-stroke-width': 1.75,
              'circle-stroke-color': '#fffde7',
              'circle-stroke-opacity': 0.7
            }
          });
        }
        // Start animation
        if (!pathAAAnimationFrame) {
          animatePathAAParticles(map.current);
        }
      } else {
        // Cleanup
        if (pathAAAnimationFrame) {
          cancelAnimationFrame(pathAAAnimationFrame);
          pathAAAnimationFrame = null;
        }
        if (map.current.getLayer(PATH_AA_PARTICLES_LAYER_ID)) {
          map.current.removeLayer(PATH_AA_PARTICLES_LAYER_ID);
        }
        if (map.current.getSource(PATH_AA_PARTICLES_SOURCE_ID)) {
          map.current.removeSource(PATH_AA_PARTICLES_SOURCE_ID);
        }
      }
    }
    setup();
    return () => {
      cancelled = true;
      if (pathAAAnimationFrame) {
        cancelAnimationFrame(pathAAAnimationFrame);
        pathAAAnimationFrame = null;
      }
      if (map.current.getLayer(PATH_AA_PARTICLES_LAYER_ID)) {
        map.current.removeLayer(PATH_AA_PARTICLES_LAYER_ID);
      }
      if (map.current.getSource(PATH_AA_PARTICLES_SOURCE_ID)) {
        map.current.removeSource(PATH_AA_PARTICLES_SOURCE_ID);
      }
    };
  }, [showPathAA, map]);

  useEffect(() => {
    if (!map?.current || !showPathB) {
      if (map?.current?.getLayer(CHRISTOVAL_CIRCLE_LAYER_ID)) map.current.removeLayer(CHRISTOVAL_CIRCLE_LAYER_ID);
      if (map?.current?.getSource(CHRISTOVAL_CIRCLE_SOURCE_ID)) map.current.removeSource(CHRISTOVAL_CIRCLE_SOURCE_ID);
      if (map?.current?.getLayer(BIGSPRING_CIRCLE_LAYER_ID)) map.current.removeLayer(BIGSPRING_CIRCLE_LAYER_ID);
      if (map?.current?.getSource(BIGSPRING_CIRCLE_SOURCE_ID)) map.current.removeSource(BIGSPRING_CIRCLE_SOURCE_ID);
      return;
    }
    // Christoval
    if (map.current.getLayer(CHRISTOVAL_CIRCLE_LAYER_ID)) map.current.removeLayer(CHRISTOVAL_CIRCLE_LAYER_ID);
    if (map.current.getSource(CHRISTOVAL_CIRCLE_SOURCE_ID)) map.current.removeSource(CHRISTOVAL_CIRCLE_SOURCE_ID);
    const christovalCircle = turf.circle(CHRISTOVAL_COORDS, 5, { steps: 128, units: 'miles' });
    const christovalGeojson = { type: 'FeatureCollection', features: [christovalCircle] };
    map.current.addSource(CHRISTOVAL_CIRCLE_SOURCE_ID, { type: 'geojson', data: christovalGeojson });
    map.current.addLayer({
      id: CHRISTOVAL_CIRCLE_LAYER_ID,
      type: 'line',
      source: CHRISTOVAL_CIRCLE_SOURCE_ID,
      paint: {
        'line-color': '#FFD700', // yellow
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9
      }
    });
    // Big Spring
    if (map.current.getLayer(BIGSPRING_CIRCLE_LAYER_ID)) map.current.removeLayer(BIGSPRING_CIRCLE_LAYER_ID);
    if (map.current.getSource(BIGSPRING_CIRCLE_SOURCE_ID)) map.current.removeSource(BIGSPRING_CIRCLE_SOURCE_ID);
    const bigspringCircle = turf.circle(BIGSPRING_COORDS, 5, { steps: 128, units: 'miles' });
    const bigspringGeojson = { type: 'FeatureCollection', features: [bigspringCircle] };
    map.current.addSource(BIGSPRING_CIRCLE_SOURCE_ID, { type: 'geojson', data: bigspringGeojson });
    map.current.addLayer({
      id: BIGSPRING_CIRCLE_LAYER_ID,
      type: 'line',
      source: BIGSPRING_CIRCLE_SOURCE_ID,
      paint: {
        'line-color': '#FFD700', // yellow
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9
      }
    });
    return () => {
      if (map.current?.getLayer(CHRISTOVAL_CIRCLE_LAYER_ID)) map.current.removeLayer(CHRISTOVAL_CIRCLE_LAYER_ID);
      if (map.current?.getSource(CHRISTOVAL_CIRCLE_SOURCE_ID)) map.current.removeSource(CHRISTOVAL_CIRCLE_SOURCE_ID);
      if (map.current?.getLayer(BIGSPRING_CIRCLE_LAYER_ID)) map.current.removeLayer(BIGSPRING_CIRCLE_LAYER_ID);
      if (map.current?.getSource(BIGSPRING_CIRCLE_SOURCE_ID)) map.current.removeSource(BIGSPRING_CIRCLE_SOURCE_ID);
    };
  }, [showPathB, map]);

  useEffect(() => {
    if (!map?.current || !showPathB) {
      if (map?.current?.getLayer(CIRCLE_MARKERS_LAYER_ID)) map.current.removeLayer(CIRCLE_MARKERS_LAYER_ID);
      if (map?.current?.getSource(CIRCLE_MARKERS_SOURCE_ID)) map.current.removeSource(CIRCLE_MARKERS_SOURCE_ID);
      return;
    }
    // Remove existing if present
    if (map.current.getLayer(CIRCLE_MARKERS_LAYER_ID)) map.current.removeLayer(CIRCLE_MARKERS_LAYER_ID);
    if (map.current.getSource(CIRCLE_MARKERS_SOURCE_ID)) map.current.removeSource(CIRCLE_MARKERS_SOURCE_ID);
    // Add point features for both cities
    const markerFeatures = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: CHRISTOVAL_COORDS }, properties: {} },
      { type: 'Feature', geometry: { type: 'Point', coordinates: BIGSPRING_COORDS }, properties: {} }
    ];
    const markerGeojson = { type: 'FeatureCollection', features: markerFeatures };
    map.current.addSource(CIRCLE_MARKERS_SOURCE_ID, { type: 'geojson', data: markerGeojson });
    map.current.addLayer({
      id: CIRCLE_MARKERS_LAYER_ID,
      type: 'circle',
      source: CIRCLE_MARKERS_SOURCE_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': '#FFD700', // yellow
        'circle-opacity': 0.95
      }
    });
    return () => {
      if (map.current?.getLayer(CIRCLE_MARKERS_LAYER_ID)) map.current.removeLayer(CIRCLE_MARKERS_LAYER_ID);
      if (map.current?.getSource(CIRCLE_MARKERS_SOURCE_ID)) map.current.removeSource(CIRCLE_MARKERS_SOURCE_ID);
    };
  }, [showPathB, map]);

  useEffect(() => {
    if (!map?.current || !showPathB) {
      if (map?.current?.getLayer(CASTROVILLE_PULSE_LAYER_ID)) map.current.removeLayer(CASTROVILLE_PULSE_LAYER_ID);
      if (map?.current?.getSource(CASTROVILLE_PULSE_SOURCE_ID)) map.current.removeSource(CASTROVILLE_PULSE_SOURCE_ID);
      return;
    }
    // Remove existing if present
    if (map.current.getLayer(CASTROVILLE_PULSE_LAYER_ID)) map.current.removeLayer(CASTROVILLE_PULSE_LAYER_ID);
    if (map.current.getSource(CASTROVILLE_PULSE_SOURCE_ID)) map.current.removeSource(CASTROVILLE_PULSE_SOURCE_ID);
    // Add a point feature for Castroville
    const pulseFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: CASTROVILLE_COORDS }, properties: {} };
    const pulseGeojson = { type: 'FeatureCollection', features: [pulseFeature] };
    map.current.addSource(CASTROVILLE_PULSE_SOURCE_ID, { type: 'geojson', data: pulseGeojson });
    map.current.addLayer({
      id: CASTROVILLE_PULSE_LAYER_ID,
      type: 'circle',
      source: CASTROVILLE_PULSE_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 30,
          1, 90
        ],
        'circle-color': '#FFD700', // bright yellow-orange
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 0.45,
          0.7, 0.22,
          1, 0
        ],
        'circle-blur': 0.5
      }
    });
    // Animation loop to update the pulse
    let frame;
    function animatePulse() {
      const period = 1.6;
      const t = ((Date.now() / 1000) % period) / period;
      const features = [
        { ...pulseFeature, properties: { pulse_t: t } }
      ];
      map.current.getSource(CASTROVILLE_PULSE_SOURCE_ID).setData({
        ...pulseGeojson,
        features
      });
      frame = requestAnimationFrame(animatePulse);
    }
    animatePulse();
    return () => {
      if (map.current?.getLayer(CASTROVILLE_PULSE_LAYER_ID)) map.current.removeLayer(CASTROVILLE_PULSE_LAYER_ID);
      if (map.current?.getSource(CASTROVILLE_PULSE_SOURCE_ID)) map.current.removeSource(CASTROVILLE_PULSE_SOURCE_ID);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [showPathB, map]);

  useEffect(() => {
    if (!map?.current || !showPathB) {
      if (map?.current?.getLayer(FORT_STOCKTON_PULSE_LAYER_ID)) map.current.removeLayer(FORT_STOCKTON_PULSE_LAYER_ID);
      if (map?.current?.getSource(FORT_STOCKTON_PULSE_SOURCE_ID)) map.current.removeSource(FORT_STOCKTON_PULSE_SOURCE_ID);
      return;
    }
    // Remove existing if present
    if (map.current.getLayer(FORT_STOCKTON_PULSE_LAYER_ID)) map.current.removeLayer(FORT_STOCKTON_PULSE_LAYER_ID);
    if (map.current.getSource(FORT_STOCKTON_PULSE_SOURCE_ID)) map.current.removeSource(FORT_STOCKTON_PULSE_SOURCE_ID);
    // Add a point feature for Fort Stockton
    const pulseFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: FORT_STOCKTON_COORDS }, properties: {} };
    const pulseGeojson = { type: 'FeatureCollection', features: [pulseFeature] };
    map.current.addSource(FORT_STOCKTON_PULSE_SOURCE_ID, { type: 'geojson', data: pulseGeojson });
    map.current.addLayer({
      id: FORT_STOCKTON_PULSE_LAYER_ID,
      type: 'circle',
      source: FORT_STOCKTON_PULSE_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 30,
          1, 70
        ],
        'circle-color': '#00FF99', // green
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 0.35,
          0.7, 0.18,
          1, 0
        ],
        'circle-blur': 0.5
      }
    });
    // Animation loop to update the pulse
    let frame;
    function animatePulse() {
      const period = 1.6;
      const t = ((Date.now() / 1000) % period) / period;
      const features = [
        { ...pulseFeature, properties: { pulse_t: t } }
      ];
      map.current.getSource(FORT_STOCKTON_PULSE_SOURCE_ID).setData({
        ...pulseGeojson,
        features
      });
      frame = requestAnimationFrame(animatePulse);
    }
    animatePulse();
    return () => {
      if (map.current?.getLayer(FORT_STOCKTON_PULSE_LAYER_ID)) map.current.removeLayer(FORT_STOCKTON_PULSE_LAYER_ID);
      if (map.current?.getSource(FORT_STOCKTON_PULSE_SOURCE_ID)) map.current.removeSource(FORT_STOCKTON_PULSE_SOURCE_ID);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [showPathB, map]);

  return (
    <SubLayerContainer $isVisible={expandedCategories.transportation && showTransportation}>
      <SubLayer>
        <span>Roads</span>
        <ToggleSwitch>
          <input
            type="checkbox"
            checked={showRoads}
            onChange={() => {
              const newState = !showRoads;
              setShowRoads(newState);
              handleToggle('roads', TRANSPORTATION_CATEGORIES.roads, COLORS.roads, newState);
            }}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
      
      {/* REMOVE: Highlight Ozona–Fort Stockton Route Sub-Toggle */}
      {/* REMOVE: Ozona–Fort Stockton Route Particles Sub-Toggle */}
      {/* REMOVE: Section_A Sub-Toggle */}
      {/* REMOVE: I-10 Sub-Toggle */}
      {/* REMOVE: I-10 OSM Sub-Toggle */}
      {/* REMOVE: I-10 OSM Ozona-Sonora Sub-Toggle */}
      {/* Highway Route Segments */}
      {transportationOrder.map((key, idx) => {
        if (key === 'i10FortStocktonOzona') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
        <span>I-10 Fort Stockton → Ozona</span>
        <ToggleSwitch>
          <input
            type="checkbox"
            checked={showI10FortStocktonOzona}
            onChange={() => setShowI10FortStocktonOzona(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'i10OzonaJunctionSonora') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>I-10 Ozona → Sonora</span>
        <ToggleSwitch>
          <input
            type="checkbox"
            checked={showI10OzonaJunctionSonora}
            onChange={() => setShowI10OzonaJunctionSonora(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'us83RockspringsLeakey') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Rocksprings → Leakey</span>
        <ToggleSwitch>
          <input
            type="checkbox"
            checked={showUS83RockspringsLeakey}
            onChange={() => setShowUS83RockspringsLeakey(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'us377LeakeyUtopia') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Leakey → Utopia</span>
        <ToggleSwitch>
          <input
            type="checkbox"
            checked={showUS377LeakeyUtopia}
            onChange={() => setShowUS377LeakeyUtopia(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'utopiaHondo') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Utopia → Hondo</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showUtopiaHondo}
                  onChange={() => setShowUtopiaHondo(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'hondoCastroville') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Hondo → Castroville</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showHondoCastroville}
                  onChange={() => setShowHondoCastroville(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'rockspringsSonora') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Rocksprings → Sonora</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showRockspringsSonora}
                  onChange={() => setShowRockspringsSonora(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'sonoraJunction') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Sonora → Junction</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showSonoraJunction}
                  onChange={() => setShowSonoraJunction(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'junctionUtopia') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Junction → Utopia</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showJunctionUtopia}
                  onChange={() => setShowJunctionUtopia(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'junctionCastroville') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Junction → Castroville</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showJunctionCastroville}
                  onChange={() => setShowJunctionCastroville(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'pathA') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Path A</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showPathA}
                  onChange={() => setShowPathA(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'pathB') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Path B</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showPathB}
                  onChange={() => setShowPathB(v => !v)}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        } else if (key === 'pathAA') {
          return (
            <SubLayer
              key={key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', cursor: 'grab' }}
            >
              <span style={{ marginLeft: -24, marginRight: 8, cursor: 'grab', userSelect: 'none', minWidth: 16, display: 'inline-block' }}>☰</span>
              <span>Path AA</span>
        <ToggleSwitch>
          <input
            type="checkbox"
                  checked={showPathAA}
                  onChange={() => {
                    const newState = !showPathAA;
                    console.log('Path AA Toggle:', {
                      previousState: showPathAA,
                      newState,
                      timestamp: new Date().toISOString()
                    });
                    setShowPathAA(newState);
                  }}
          />
          <span></span>
        </ToggleSwitch>
      </SubLayer>
          );
        }
        return null;
      })}
      
      {/* Location Circles */}
      {/* REMOVE: Sand Lake (2mi radius) Sub-Toggle */}
      {/* REMOVE: Baker (2mi radius) Sub-Toggle */}
      {/* REMOVE: Fort Stockton South (2mi radius) Sub-Toggle */}
      {/* REMOVE: Coyote (2mi radius) Sub-Toggle */}
    </SubLayerContainer>
  );
};

export default TransportationNetworkLayer;