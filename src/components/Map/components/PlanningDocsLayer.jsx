import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const PlanningDocsLayer = ({ map, visible }) => {
  const sourceRef = useRef(false);
  const layersAddedRef = useRef(false);
  const [docsIndex, setDocsIndex] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set up the planning documents layer when the component mounts or visibility changes
  useEffect(() => {
    if (!map?.current) return;

    const setupLayers = async () => {
      if (layersAddedRef.current) {
        // Just update visibility if layers already exist
        updateLayerVisibility();
        return;
      }

      setLoading(true);
      try {
        // Load the document index and policy data
        await Promise.all([
          loadDocumentsIndex(),
          loadPolicyLayer()
        ]);

        // Add policy markers source if it doesn't exist
        if (!map.current.getSource('planning-policies')) {
          map.current.addSource('planning-policies', {
            type: 'geojson',
            data: '/processed_planning_docs/planning_policies.geojson'
          });
        }

        // Add policy markers layer
        map.current.addLayer({
          id: 'planning-policy-markers',
          type: 'circle',
          source: 'planning-policies',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 4,
              15, 8
            ],
            'circle-color': '#4264fb',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          },
          layout: {
            'visibility': visible ? 'visible' : 'none'
          }
        });

        // Add a layer for highlighting zones with associated planning documents
        if (!map.current.getSource('zoning-with-planning-docs')) {
          map.current.addSource('zoning-with-planning-docs', {
            type: 'geojson',
            data: '/processed_planning_docs/zoning_with_planning_docs.geojson'
          });
        }

        // Add highlight layer for zones with associated documents
        map.current.addLayer({
          id: 'zoning-planning-docs-highlight',
          type: 'fill',
          source: 'zoning-with-planning-docs',
          paint: {
            'fill-color': '#4264fb',
            'fill-opacity': [
              'case',
              ['has', 'planning_docs'],
              0.3,
              0
            ]
          },
          layout: {
            'visibility': visible ? 'visible' : 'none'
          },
          filter: ['has', 'planning_docs']
        });

        // Add events for policy markers
        map.current.on('click', 'planning-policy-markers', handlePolicyClick);
        map.current.on('mouseenter', 'planning-policy-markers', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'planning-policy-markers', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Add events for zoning areas with planning docs
        map.current.on('click', 'zoning-planning-docs-highlight', handleZoneClick);
        map.current.on('mouseenter', 'zoning-planning-docs-highlight', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'zoning-planning-docs-highlight', () => {
          map.current.getCanvas().style.cursor = '';
        });

        sourceRef.current = true;
        layersAddedRef.current = true;
      } catch (err) {
        console.error('Error setting up planning docs layer:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const updateLayerVisibility = () => {
      if (!map.current) return;
      
      const visibility = visible ? 'visible' : 'none';
      
      if (map.current.getLayer('planning-policy-markers')) {
        map.current.setLayoutProperty('planning-policy-markers', 'visibility', visibility);
      }
      
      if (map.current.getLayer('zoning-planning-docs-highlight')) {
        map.current.setLayoutProperty('zoning-planning-docs-highlight', 'visibility', visibility);
      }
    };

    const loadDocumentsIndex = async () => {
      try {
        const response = await fetch('/processed_planning_docs/planning_docs_index.json');
        if (!response.ok) throw new Error('Failed to load documents index');
        const data = await response.json();
        setDocsIndex(data);
        return data;
      } catch (err) {
        console.error('Error loading documents index:', err);
        setError('Failed to load planning documents index');
        return null;
      }
    };

    const loadPolicyLayer = async () => {
      try {
        const response = await fetch('/processed_planning_docs/planning_policies.geojson');
        if (!response.ok) throw new Error('Failed to load policy layer');
        const data = await response.json();
        setPolicies(data);
        return data;
      } catch (err) {
        console.error('Error loading policy layer:', err);
        setError('Failed to load planning policies layer');
        return null;
      }
    };

    const handlePolicyClick = (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const props = feature.properties;
      
      // Format the document list
      const documentsList = Array.isArray(props.documents) 
        ? props.documents.join('</li><li>') 
        : (typeof props.documents === 'string' ? props.documents : '');
      
      // Format the areas list
      const areasList = Array.isArray(props.areas) 
        ? props.areas.join('</li><li>') 
        : (typeof props.areas === 'string' ? props.areas : '');
      
      // Create popup
      new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '400px'
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="planning-popup">
            <h3>${props.policy}</h3>
            <p>${props.description}</p>
            <h4>Areas Affected:</h4>
            <ul><li>${areasList}</li></ul>
            <h4>Related Documents:</h4>
            <ul><li>${documentsList}</li></ul>
          </div>
        `)
        .addTo(map.current);
    };

    const handleZoneClick = (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const zoneCode = feature.properties.zone_cmplt;
      const planningDocs = feature.properties.planning_docs;
      
      if (!planningDocs) return;
      
      let docsHtml = '';
      if (typeof planningDocs === 'string') {
        // Try to parse if it's a string
        try {
          const docs = JSON.parse(planningDocs);
          if (Array.isArray(docs)) {
            docsHtml = docs.map(doc => `
              <div class="planning-doc-item">
                <h4>${doc.title || 'Untitled'}</h4>
                <p>${doc.summary || 'No summary available'}</p>
                <p><small>Policies: ${doc.policies.join(', ') || 'None'}</small></p>
              </div>
            `).join('');
          }
        } catch (err) {
          docsHtml = `<p>Error displaying document information: ${err.message}</p>`;
        }
      } else if (Array.isArray(planningDocs)) {
        docsHtml = planningDocs.map(doc => `
          <div class="planning-doc-item">
            <h4>${doc.title || 'Untitled'}</h4>
            <p>${doc.summary || 'No summary available'}</p>
            <p><small>Policies: ${doc.policies?.join(', ') || 'None'}</small></p>
          </div>
        `).join('');
      }
      
      // Create popup
      new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '400px'
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="planning-popup">
            <h3>Planning Documents for Zone ${zoneCode}</h3>
            <div class="planning-docs-list">
              ${docsHtml || 'No planning documents found for this zone.'}
            </div>
          </div>
        `)
        .addTo(map.current);
    };

    if (visible && !layersAddedRef.current) {
      setupLayers();
    } else {
      updateLayerVisibility();
    }

    return () => {
      if (map?.current) {
        map.current.off('click', 'planning-policy-markers', handlePolicyClick);
        map.current.off('click', 'zoning-planning-docs-highlight', handleZoneClick);
      }
    };
  }, [map, visible]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (map?.current && sourceRef.current) {
        if (map.current.getLayer('planning-policy-markers')) {
          map.current.removeLayer('planning-policy-markers');
        }
        if (map.current.getLayer('zoning-planning-docs-highlight')) {
          map.current.removeLayer('zoning-planning-docs-highlight');
        }
        if (map.current.getSource('planning-policies')) {
          map.current.removeSource('planning-policies');
        }
        if (map.current.getSource('zoning-with-planning-docs')) {
          map.current.removeSource('zoning-with-planning-docs');
        }
        sourceRef.current = false;
        layersAddedRef.current = false;
      }
    };
  }, [map]);

  // We don't render anything directly
  return null;
};

export default PlanningDocsLayer; 