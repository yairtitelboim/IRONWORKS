import React, { useEffect, useRef } from 'react';
import { NC_POWER_SITES } from '../../../config/ncPowerSites';

const SOURCE_ID = 'nc-power-infrastructure';
const POINT_LAYER_ID = `${SOURCE_ID}-points`;
const PULSE_LAYER_ID = `${SOURCE_ID}-pulse`;
const MAX_MARKERS_PER_SITE = 25;
const MIN_IMPORTANCE_SCORE = 4;
const PULSE_ANIMATION_DURATION = 3200;
const PULSE_RADIUS_STOPS = [
  6, 12,
  9, 22,
  14, 36
];

const VOLTAGE_TIER_LABELS = {
  '500kv': '500 kV backbone',
  '345kv': '345 kV regional spine',
  '230kv': '230 kV transmission loop',
  '161kv': '161 kV high-voltage feed',
  '115kv': '115 kV distribution step-down',
  distribution: 'distribution feeder'
};

const IMPORTANT_SUBCATEGORIES = new Set([
  'power:plant',
  'power:generator',
  'power:substation',
  'power:transformer'
]);

const parseVoltageValues = (tags = {}) => {
  const collected = [];
  ['voltage', 'voltage:primary', 'voltage:secondary', 'voltage:tertiary'].forEach((key) => {
    if (tags[key]) {
      String(tags[key])
        .split(/[,;\/\s]+/)
        .map((value) => parseInt(value, 10))
        .forEach((num) => {
          if (!Number.isNaN(num)) {
            collected.push(num);
          }
        });
    }
  });
  return collected;
};

const classifyVoltage = (values = []) => {
  if (!values.length) return { category: 'distribution', maxKv: null };
  const max = Math.max(...values);
  if (max >= 400000) return { category: '500kv', maxKv: Math.round(max / 1000) };
  if (max >= 300000) return { category: '345kv', maxKv: Math.round(max / 1000) };
  if (max >= 200000) return { category: '230kv', maxKv: Math.round(max / 1000) };
  if (max >= 150000) return { category: '161kv', maxKv: Math.round(max / 1000) };
  if (max >= 110000) return { category: '115kv', maxKv: Math.round(max / 1000) };
  return { category: 'distribution', maxKv: Math.round(max / 1000) };
};

const computeImportance = (voltageCategory, subcategory, name = '') => {
  let score = 0;

  switch (voltageCategory) {
    case '500kv':
      score += 8;
      break;
    case '345kv':
      score += 6;
      break;
    case '230kv':
      score += 5;
      break;
    case '161kv':
      score += 4;
      break;
    case '115kv':
      score += 2;
      break;
    default:
      break;
  }

  if (IMPORTANT_SUBCATEGORIES.has(subcategory)) {
    score += 3;
  }

  const lowered = name.toLowerCase();
  if (lowered.includes('nuclear')) score += 5;
  if (lowered.includes('switchyard')) score += 2;
  if (lowered.includes('substation')) score += 2;
  if (lowered.includes('transmission')) score += 1;

  return score;
};

const PowerInfrastructureLayer = ({ map, visible }) => {
  const combinedDataRef = useRef(null);
  const summariesRef = useRef(null);
  const isMountedRef = useRef(false);
  const mapListenerAttachedRef = useRef(false);
  const clickHandlerRef = useRef(null);
  const mouseEnterHandlerRef = useRef(null);
  const mouseLeaveHandlerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const pulseStartRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;
    let cancelled = false;
    console.log('⚡ PowerInfrastructureLayer effect triggered. Visible:', visible, 'Map ready:', !!mapInstance);

    const stopPulseAnimation = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pulseStartRef.current = null;
    };

    const cleanupInteractions = () => {
      if (!mapInstance) return;
      if (clickHandlerRef.current) {
        mapInstance.off('click', POINT_LAYER_ID, clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
      if (mouseEnterHandlerRef.current) {
        mapInstance.off('mouseenter', POINT_LAYER_ID, mouseEnterHandlerRef.current);
        mouseEnterHandlerRef.current = null;
      }
      if (mouseLeaveHandlerRef.current) {
        mapInstance.off('mouseleave', POINT_LAYER_ID, mouseLeaveHandlerRef.current);
        mouseLeaveHandlerRef.current = null;
      }
      if (mapInstance.getCanvas()) {
        mapInstance.getCanvas().style.cursor = '';
      }
    };

    const emitLegend = () => {
      if (!summariesRef.current || !window.mapEventBus) return;
      window.mapEventBus.emit('nc-power:loaded', {
        source: 'nc-power',
        generatedAt: new Date().toISOString(),
        activeSite: null,
        sites: summariesRef.current
      });
    };

    const removeLayers = () => {
      cleanupInteractions();
      stopPulseAnimation();
      if (mapInstance.getLayer(POINT_LAYER_ID)) {
        mapInstance.removeLayer(POINT_LAYER_ID);
      }
      if (mapInstance.getLayer(PULSE_LAYER_ID)) {
        mapInstance.removeLayer(PULSE_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };

    const startPulseAnimation = () => {
      if (animationFrameRef.current || !mapInstance) return;
      if (!mapInstance.getLayer(PULSE_LAYER_ID)) return;

      const animate = (timestamp) => {
        if (cancelled || !mapInstance?.getLayer(PULSE_LAYER_ID)) {
          stopPulseAnimation();
          return;
        }

        if (!pulseStartRef.current) {
          pulseStartRef.current = timestamp;
        }

        const elapsed = timestamp - pulseStartRef.current;
        const cycleProgress = (elapsed % PULSE_ANIMATION_DURATION) / PULSE_ANIMATION_DURATION;
        const pulseStrength = Math.sin(cycleProgress * Math.PI); // 0 -> 1 -> 0
        const scale = 1 + (pulseStrength * 1.05);
        const opacity = 0.1 + (pulseStrength * 0.55);
        const scaledRadiusStops = PULSE_RADIUS_STOPS.map((value, index) => {
          if (index % 2 === 0) {
            return value;
          }
          return value * scale;
        });

        try {
          const radiusExpression = [
            'interpolate',
            ['linear'],
            ['zoom'],
            ...scaledRadiusStops
          ];
          mapInstance.setPaintProperty(PULSE_LAYER_ID, 'circle-radius', radiusExpression);
          mapInstance.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', opacity);
        } catch (error) {
          console.warn('⚡ PowerInfrastructureLayer pulse animation error:', error);
          stopPulseAnimation();
          return;
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const buildCombinedData = async () => {
      const siteResponses = await Promise.all(
        NC_POWER_SITES.map(async (site) => {
          const response = await fetch(site.dataPath);
          if (!response.ok) {
            throw new Error(`Failed to load ${site.dataPath} (${response.status})`);
          }
          const json = await response.json();
          return { site, json };
        })
      );

      const collectedFeatures = [];
      const summaries = [];

      siteResponses.forEach(({ site, json }) => {
        const features = Array.isArray(json.features) ? json.features : [];
        const candidates = [];

        features.forEach((feature) => {
          if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return;
          const props = feature.properties || {};
          const tags = props.tags || {};
          const voltageValues = parseVoltageValues(tags);
          const { category: voltageCategory, maxKv } = classifyVoltage(voltageValues);
          const subcategory = props.subcategory || '';
          const displayCategory = props.category || 'power';
          const name = props.name || '';
          const importance = computeImportance(voltageCategory, subcategory, name);
          const siteLabel = site.shortName || site.name;
          const operator = props.operator || tags.operator || '';
          const tierLabel = VOLTAGE_TIER_LABELS[voltageCategory] || VOLTAGE_TIER_LABELS.distribution;
          const readableComponent = subcategory
            ? subcategory.split(':').pop().replace(/_/g, ' ')
            : displayCategory.replace(/_/g, ' ');

          const descriptionParts = [];
          descriptionParts.push(`**${name || readableComponent}** anchors the ${tierLabel}`);
          if (siteLabel) {
            descriptionParts.push(`serving **${siteLabel}**`);
          }
          if (operator) {
            descriptionParts.push(`(operated by ${operator})`);
          }
          if (maxKv) {
            descriptionParts.push(`with max **${maxKv} kV** capacity`);
          }
          const popupDescription = `${descriptionParts.join(' ')}.`;

          const popupData = {
            'Voltage Tier': tierLabel,
            'Peak kV': maxKv ? `${maxKv} kV` : 'n/a',
            'Component': readableComponent || 'grid asset',
            'Operator': operator || 'Not specified',
            'Site': siteLabel || site.name,
            'Importance Score': importance
          };

          candidates.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: {
              id: props.osm_id || `${site.key}-${candidates.length}`,
              name: props.name || props.shortName || props.siteName || 'Unnamed',
              siteKey: site.key,
              siteName: site.name,
              shortName: site.shortName || site.name,
              displayCategory,
              subcategory,
              voltageCategory,
              maxVoltageKv: maxKv,
              importance,
              operator,
              legendColor: site.highlightColor || site.color,
              description: props.description || site.description || '',
              popupDescription,
              popupData,
              popupTheme: 'blue',
              formatter: 'power'
            }
          });
        });

        candidates.sort((a, b) => (b.properties.importance || 0) - (a.properties.importance || 0));

        const filtered = candidates.filter((candidate) => candidate.properties.importance >= MIN_IMPORTANCE_SCORE);
        const preferred = filtered.length > 0 ? filtered : candidates;
        const selected = preferred.slice(0, MAX_MARKERS_PER_SITE);

        const categoryCounts = selected.reduce((acc, feature) => {
          const cat = feature.properties.displayCategory || 'power';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});

        const highVoltageCount = selected.filter(
          (feature) => feature.properties.voltageCategory === '500kv' || feature.properties.voltageCategory === '230kv'
        ).length;

        const maxObservedKv = selected.reduce((max, feature) => {
          return feature.properties.maxVoltageKv && feature.properties.maxVoltageKv > max
            ? feature.properties.maxVoltageKv
            : max;
        }, 0);

        collectedFeatures.push(...selected);

        summaries.push({
          key: site.key,
          name: site.name,
          shortName: site.shortName || site.name,
          color: site.color,
          highlightColor: site.highlightColor,
          coordinates: site.coordinates,
          description: site.description,
          featureCount: selected.length,
          categories: categoryCounts,
          voltageSummary: {
            highVoltageCount,
            maxObservedKv
          }
        });
      });

      combinedDataRef.current = {
        type: 'FeatureCollection',
        features: collectedFeatures
      };
      summariesRef.current = summaries;
    };

    const ensureLayer = async () => {
      if (cancelled) return;

      if (!combinedDataRef.current) {
        try {
          await buildCombinedData();
        } catch (error) {
          console.error('Failed to build NC power dataset', error);
          return;
        }
      }

      if (cancelled || !combinedDataRef.current) return;

      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.getSource(SOURCE_ID).setData(combinedDataRef.current);
      } else {
        mapInstance.addSource(SOURCE_ID, {
          type: 'geojson',
          data: combinedDataRef.current
        });
      }

      const circleColorExpression = [
        'case',
        ['==', ['get', 'voltageCategory'], '500kv'],
        '#ef4444',
        ['==', ['get', 'voltageCategory'], '230kv'],
        '#f97316',
        '#f87171'
      ];

      if (!mapInstance.getLayer(PULSE_LAYER_ID)) {
        mapInstance.addLayer({
          id: PULSE_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              ...PULSE_RADIUS_STOPS
            ],
            'circle-color': circleColorExpression,
            'circle-opacity': 0,
            'circle-blur': 1.1
          }
        });
      }

      if (!mapInstance.getLayer(POINT_LAYER_ID)) {
        mapInstance.addLayer({
          id: POINT_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6,
              [
                '+',
                1,
                [
                  '/',
                  ['min', ['get', 'importance'], 6],
                  2
                ]
              ],
              14,
              [
                '+',
                2.5,
                [
                  '/',
                  ['min', ['get', 'importance'], 6],
                  2
                ]
              ]
            ],
            'circle-color': circleColorExpression,
            'circle-opacity': 0.9
          }
        });
      }

      cleanupInteractions();
      startPulseAnimation();

      const handleClick = (event) => {
        const feature = event.features && event.features[0];
        if (!feature) return;
        const props = feature.properties || {};
        const coordinates = feature.geometry?.coordinates;
        console.log('⚡ PowerInfrastructureLayer marker clicked:', props);
        if (window.mapEventBus) {
          window.mapEventBus.emit('marker:clicked', {
            id: props.id || props.osm_id || `${props.siteKey || 'power'}-${props.name || 'node'}`,
            name: props.name,
            title: props.name,
            type: 'Power Infrastructure',
            category: 'Power Infrastructure',
            formatter: 'power',
            content: {
              description: props.popupDescription,
              data: props.popupData
            },
            theme: props.popupTheme || 'blue',
            siteName: props.siteName,
            shortName: props.shortName,
            voltageCategory: props.voltageCategory,
            maxVoltageKv: props.maxVoltageKv,
            component: props.subcategory,
            operator: props.operator,
            importance: props.importance,
            coordinates,
            isAutomatic: false
          });
        }
      };

      const handleMouseEnter = () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      };

      const handleMouseLeave = () => {
        mapInstance.getCanvas().style.cursor = '';
      };

      clickHandlerRef.current = handleClick;
      mouseEnterHandlerRef.current = handleMouseEnter;
      mouseLeaveHandlerRef.current = handleMouseLeave;

      mapInstance.on('click', POINT_LAYER_ID, handleClick);
      mapInstance.on('mouseenter', POINT_LAYER_ID, handleMouseEnter);
      mapInstance.on('mouseleave', POINT_LAYER_ID, handleMouseLeave);

      isMountedRef.current = true;
      emitLegend();
    };

    const handleStyleData = () => {
      if (!visible || cancelled || !isMountedRef.current) return;
      ensureLayer().catch((error) => {
        console.error('Failed to re-add NC power markers on style change', error);
      });
    };

    if (!visible) {
      if (isMountedRef.current && window.mapEventBus) {
        window.mapEventBus.emit('nc-power:unmounted');
      }
      removeLayers();
      isMountedRef.current = false;
      if (mapListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        mapListenerAttachedRef.current = false;
      }
      return;
    }

    const addWhenReady = () => {
      ensureLayer().catch((error) => {
        console.error('Failed to load NC power markers', error);
      });
    };

    if (!mapInstance.isStyleLoaded()) {
      const waitForStyle = () => {
        addWhenReady();
        mapInstance.off('styledata', waitForStyle);
      };
      mapInstance.on('styledata', waitForStyle);
      return () => {
        cancelled = true;
        mapInstance.off('styledata', waitForStyle);
      };
    }

    addWhenReady();

    if (!mapListenerAttachedRef.current) {
      mapInstance.on('styledata', handleStyleData);
      mapListenerAttachedRef.current = true;
    }

    return () => {
      cancelled = true;
      mapInstance.off('styledata', handleStyleData);
      mapListenerAttachedRef.current = false;
      cleanupInteractions();
      stopPulseAnimation();
      if (!visible) {
        removeLayers();
      }
    };
  }, [map, visible]);

  useEffect(() => {
    return () => {
      if (map?.current && isMountedRef.current) {
        const mapInstance = map.current;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        pulseStartRef.current = null;
        if (mapInstance.getLayer(POINT_LAYER_ID)) {
          mapInstance.removeLayer(POINT_LAYER_ID);
        }
        if (mapInstance.getLayer(PULSE_LAYER_ID)) {
          mapInstance.removeLayer(PULSE_LAYER_ID);
        }
        if (mapInstance.getSource(SOURCE_ID)) {
          mapInstance.removeSource(SOURCE_ID);
        }
        if (window.mapEventBus) {
          window.mapEventBus.emit('nc-power:unmounted');
        }
      }
    };
  }, [map]);

  return null;
};

export default PowerInfrastructureLayer;
