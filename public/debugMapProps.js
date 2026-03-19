window._debugMapProps = (map) => { const features = map.queryRenderedFeatures({layers: ["road-simple"]}); console.log("road-simple features:", features.map(f => f.properties)); };
