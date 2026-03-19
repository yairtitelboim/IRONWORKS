// Layer IDs for OSM data
export const osmLayerIds = {
    publicTransit: {
        stops: 'osm-transit-stops',
        routes: 'osm-transit-routes'
    },
    bikeInfra: {
        lanes: 'osm-bike-lanes',
        paths: 'osm-bike-paths',
        parking: 'osm-bike-parking'
    },
    pedestrian: {
        paths: 'osm-pedestrian-paths',
        crossings: 'osm-pedestrian-crossings'
    }
};

// LA bounds for data validation
const LA_BOUNDS = {
    north: 34.3373,
    south: 33.7037,
    east: -118.1553,
    west: -118.6682
};

// Layer styles
const styles = {
    publicTransit: {
        stops: {
            type: 'circle',
            paint: {
                'circle-radius': 2,
                'circle-color': '#9B59B6'
            }
        },
        routes: {
            type: 'line',
            paint: {
                'line-color': '#9B59B6',
                'line-width': 1,
                'line-opacity': 0.8
            }
        }
    },
    bikeInfra: {
        lanes: {
            type: 'line',
            paint: {
                'line-color': '#2ECC71',
                'line-width': 2,
                'line-dasharray': [2, 1]
            }
        },
        paths: {
            type: 'line',
            paint: {
                'line-color': '#27AE60',
                'line-width': 1.6
            }
        },
        parking: {
            type: 'symbol',
            layout: {
                'icon-image': 'bicycle-15',
                'icon-size': 1,
                'icon-allow-overlap': true
            },
            paint: {
                'icon-opacity': 0.8,
                'icon-color': '#2ECC71'
            }
        }
    },
    pedestrian: {
        paths: {
            type: 'line',
            paint: {
                'line-color': '#E67E22',
                'line-width': 0.7,
                'line-opacity': 0.7
            }
        },
        crossings: {
            type: 'circle',
            paint: {
                'circle-radius': 1.5,
                'circle-color': '#D35400',
                'circle-stroke-width': 0.5,
                'circle-stroke-color': '#ffffff'
            }
        }
    }
};

export async function loadOSMData(map) {
    // Remove existing layers if they exist
    Object.values(osmLayerIds).forEach(category => {
        Object.values(category).forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
            if (map.getSource(layerId)) {
                map.removeSource(layerId);
            }
        });
    });

    try {
        // Load each GeoJSON file and add as a layer
        for (const [category, subcategories] of Object.entries(styles)) {
            for (const [subcategory, style] of Object.entries(subcategories)) {
                const categoryMap = {
                    'publicTransit': 'public_transit',
                    'bikeInfra': 'bike_infrastructure',
                    'pedestrian': 'pedestrian'
                };
                
                const mappedCategory = categoryMap[category] || category.toLowerCase();
                // Update filename to use LA data
                const filename = `/data/osm/la_${mappedCategory}_${subcategory}.geojson`;
                const layerId = osmLayerIds[category][subcategory];
                
                try {
                    const response = await fetch(filename);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const geojson = await response.json();
                    
                    if (!geojson || !geojson.features) {
                        console.warn(`Invalid GeoJSON data in ${filename}`);
                        continue;
                    }

                    // Validate features are within LA bounds
                    const validFeatures = geojson.features.filter(feature => {
                        if (!feature.geometry || !feature.geometry.coordinates) return false;
                        
                        const coords = feature.geometry.coordinates;
                        let lon, lat;
                        
                        if (feature.geometry.type === 'Point') {
                            [lon, lat] = coords;
                        } else if (feature.geometry.type === 'LineString') {
                            // Use first point of line for bounds check
                            [lon, lat] = coords[0];
                        } else {
                            return true; // Accept other geometry types for now
                        }
                        
                        return (
                            lat >= LA_BOUNDS.south && 
                            lat <= LA_BOUNDS.north && 
                            lon >= LA_BOUNDS.west && 
                            lon <= LA_BOUNDS.east
                        );
                    });

                    if (validFeatures.length === 0) {
                        console.warn(`No features within LA bounds in ${filename}`);
                        continue;
                    }

                    // Update geojson with filtered features
                    geojson.features = validFeatures;
                    
                    // Add source
                    map.addSource(layerId, {
                        type: 'geojson',
                        data: geojson
                    });
                    
                    // Add layer with styling
                    map.addLayer({
                        id: layerId,
                        source: layerId,
                        type: style.type,
                        layout: {
                            visibility: 'none',
                            ...(style.layout || {})
                        },
                        paint: style.paint
                    });
                    
                    // Log the bounds of the added features
                    const featureBounds = getBoundingBox(validFeatures);
                    
                } catch (error) {
                    console.warn(`Failed to load ${filename}:`, error);
                }
            }
        }
        
    } catch (error) {
        console.error('Error loading OSM data:', error);
    }
}

// Helper function to calculate bounding box of features
function getBoundingBox(features) {
    let bounds = {
        north: -90,
        south: 90,
        east: -180,
        west: 180
    };
    
    features.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        
        const coords = feature.geometry.coordinates;
        let points = [];
        
        if (feature.geometry.type === 'Point') {
            points = [coords];
        } else if (feature.geometry.type === 'LineString') {
            points = coords;
        }
        
        points.forEach(([lon, lat]) => {
            bounds.north = Math.max(bounds.north, lat);
            bounds.south = Math.min(bounds.south, lat);
            bounds.east = Math.max(bounds.east, lon);
            bounds.west = Math.min(bounds.west, lon);
        });
    });
    
    return bounds;
}

export function toggleOSMLayer(map, category, subcategory, visible, color = null) {
    const layerId = osmLayerIds[category][subcategory];
    
    try {
        if (!map.getLayer(layerId)) {
            console.warn(`Layer ${layerId} not found, attempting to reload OSM data...`);
            loadOSMData(map).then(() => {
                if (map.getLayer(layerId)) {
                    updateLayerVisibility(map, layerId, visible, color);
                    
                    // If this is a bike layer and it's being made visible, move it to the top
                    if (visible && category === 'bikeInfra') {
                        moveBikeLayerToTop(map, layerId);
                    }
                } else {
                    console.error(`Failed to load layer ${layerId}`);
                }
            });
            return;
        }
        
        updateLayerVisibility(map, layerId, visible, color);
        
        // If this is a bike layer and it's being made visible, move it to the top
        if (visible && category === 'bikeInfra') {
            moveBikeLayerToTop(map, layerId);
        }
    } catch (error) {
        console.error(`Error toggling layer ${layerId}:`, error);
    }
}

function moveBikeLayerToTop(map, layerId) {
    try {
        
        // Get all layers
        const style = map.getStyle();
        const layers = style.layers;
        
        // Find the topmost non-bike OSM layer to place bike layers above
        // We need to identify what should be the reference layer
        
        // First, try to find a good reference layer
        const symbolLayers = layers.filter(layer => layer.type === 'symbol');
        if (symbolLayers.length > 0) {
            // Use a symbol layer as reference, as they're typically rendered on top
            const referenceLayer = symbolLayers[symbolLayers.length - 1].id;
            map.moveLayer(layerId, referenceLayer);
            // moved above referenceLayer
        } else {
            // If no symbol layer is found, just move to the top
            map.moveLayer(layerId);
            // moved to the top
        }
    } catch (error) {
        console.warn(`Failed to move bike layer ${layerId} to top:`, error);
    }
}

function updateLayerVisibility(map, layerId, visible, color = null) {
    // Update visibility
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    
    // Update color if provided
    if (color) {
        const layer = map.getLayer(layerId);
        if (layer.type === 'line') {
            map.setPaintProperty(layerId, 'line-color', color);
        } else if (layer.type === 'circle') {
            map.setPaintProperty(layerId, 'circle-color', color);
        } else if (layer.type === 'symbol') {
            map.setPaintProperty(layerId, 'icon-color', color);
        }
    }
    
    // visibility set
} 