import { useEffect, useState, useCallback } from 'react';

const CasaGrandeBoundaryLayer = ({ map, visible }) => {
  const [boundaryData, setBoundaryData] = useState(null);
  // Loading state removed as it's not used

  // Function to load Casa Grande tax zones from static GeoJSON file
  const fetchCasaGrandeTaxZones = useCallback(async () => {
    try {
      console.log('🏙️ CasaGrandeBoundaryLayer: Loading Casa Grande tax zones from static GeoJSON...');
      
      const response = await fetch('/casa-grande-tax-zones.geojson');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ CasaGrandeBoundaryLayer: Tax zones data loaded from static file:', data);
      
      if (data && data.type === 'FeatureCollection' && data.features && data.features.length > 0) {
        console.log('✅ CasaGrandeBoundaryLayer: Valid GeoJSON tax zones loaded with', data.features.length, 'features');
        return data;
      } else {
        throw new Error('Invalid GeoJSON format');
      }
      
    } catch (error) {
      console.error('❌ CasaGrandeBoundaryLayer: Error loading tax zones file:', error);
      console.log('🏙️ CasaGrandeBoundaryLayer: Using fallback boundary due to file error');
      
      // Return fallback boundary when file fails
      const fallbackBoundary = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            Code_Compl: 'Fallback',
            Code_Com_1: 'Casa Grande (Fallback)',
            Shape_STAr: 0,
            Shape_STLe: 0
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-111.9, 32.8],   // Southwest
              [-111.6, 32.8],   // Southeast
              [-111.6, 33.0],   // Northeast
              [-111.9, 33.0],   // Northwest
              [-111.9, 32.8]    // Close the polygon
            ]]
          }
        }]
      };
      
      console.log('✅ CasaGrandeBoundaryLayer: Using fallback boundary due to file error');
      return fallbackBoundary;
    }
  }, []);

  // Effect to handle layer visibility
  useEffect(() => {
    if (!map?.current) {
      return;
    }

    // Only run this effect when the component should be visible
    // This prevents unnecessary processing when other components change state
    if (!visible) {
      // If not visible, clean up any existing layers
      const mapInstance = map.current;
      if (mapInstance.getLayer('casa-grande-boundary')) {
        mapInstance.removeLayer('casa-grande-boundary');
      }
      if (mapInstance.getSource('casa-grande-boundary')) {
        mapInstance.removeSource('casa-grande-boundary');
      }
      return;
    }

    const mapInstance = map.current;

    const updateLayer = async () => {
      try {
        if (visible) {
          console.log('🏙️ CasaGrandeBoundaryLayer: Adding Casa Grande boundary...');
          
          // Fetch data if not already available
          let dataToUse = boundaryData;
          if (!dataToUse) {
            console.log('🏙️ CasaGrandeBoundaryLayer: Fetching tax zones data...');
            dataToUse = await fetchCasaGrandeTaxZones();
            if (dataToUse) {
              setBoundaryData(dataToUse);
              console.log('✅ CasaGrandeBoundaryLayer: Tax zones data fetched and stored');
            } else {
              console.log('❌ CasaGrandeBoundaryLayer: Failed to fetch tax zones data');
              return;
            }
          }

          if (!dataToUse) {
            console.log('❌ CasaGrandeBoundaryLayer: No data available');
            return;
          }

          // Add source
          if (!mapInstance.getSource('casa-grande-boundary')) {
            mapInstance.addSource('casa-grande-boundary', {
              type: 'geojson',
              data: dataToUse
            });
            console.log('✅ CasaGrandeBoundaryLayer: Source added with data:', dataToUse);
          }

          // Add layer with different fill colors for different tax zones
          if (!mapInstance.getLayer('casa-grande-boundary')) {
            mapInstance.addLayer({
              id: 'casa-grande-boundary',
              type: 'fill',
              source: 'casa-grande-boundary',
              paint: {
                'fill-color': [
                  'case',
                  ['==', ['get', 'Code_Compl'], 'A'], '#ef4444', // Red for Zone A
                  ['==', ['get', 'Code_Compl'], 'B'], '#3b82f6', // Blue for Zone B  
                  ['==', ['get', 'Code_Compl'], 'C'], '#10b981', // Green for Zone C
                  '#f59e0b' // Default orange color
                ],
                'fill-opacity': 0.2 // 20% transparency
              }
            });
            console.log('✅ CasaGrandeBoundaryLayer: Tax zones layer added with fill colors and 20% transparency');
          }

          console.log('🏙️ CasaGrandeBoundaryLayer: Casa Grande tax zones displayed');
        } else {
          console.log('🏙️ CasaGrandeBoundaryLayer: Removing Casa Grande boundary...');
          
          // Remove layer
          if (mapInstance.getLayer('casa-grande-boundary')) {
            mapInstance.removeLayer('casa-grande-boundary');
            console.log('✅ CasaGrandeBoundaryLayer: Layer removed');
          }

          // Remove source
          if (mapInstance.getSource('casa-grande-boundary')) {
            mapInstance.removeSource('casa-grande-boundary');
            console.log('✅ CasaGrandeBoundaryLayer: Source removed');
          }

          console.log('🏙️ CasaGrandeBoundaryLayer: Casa Grande tax zones hidden');
        }
      } catch (error) {
        console.error('❌ CasaGrandeBoundaryLayer: Error updating layer:', error);
      }
    };

    // Check if map is ready
    if (mapInstance.isStyleLoaded()) {
      updateLayer();
    } else {
      mapInstance.once('styledata', updateLayer);
    }

    return () => {
      // Cleanup on unmount
      if (mapInstance.getLayer('casa-grande-boundary')) {
        mapInstance.removeLayer('casa-grande-boundary');
      }
      if (mapInstance.getSource('casa-grande-boundary')) {
        mapInstance.removeSource('casa-grande-boundary');
      }
    };
  }, [map, visible, boundaryData, fetchCasaGrandeTaxZones]);

  // Debug function to test tax zones data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.testCasaGrandeTaxZones = async () => {
        console.log('🧪 Testing Casa Grande tax zones data...');
        const data = await fetchCasaGrandeTaxZones();
        console.log('🧪 Tax zones data:', data);
        return data;
      };
    }
  }, [fetchCasaGrandeTaxZones]);

  // Don't render anything - this is a data layer
  return null;
};

export default CasaGrandeBoundaryLayer;
