// Highway segment constants
export const ROUTE_SOURCE_ID = 'ozona-fortstockton-route';
export const ROUTE_LAYER_ID = 'ozona-fortstockton-route-layer';
export const I10_ROUTE_SOURCE_ID = 'i10-route-source';
export const I10_ROUTE_LAYER_ID = 'i10-route-layer';
export const I10_OSM_ROUTE_SOURCE_ID = 'i10-osm-route-source';
export const I10_OSM_ROUTE_LAYER_ID = 'i10-osm-route-layer';
export const I10_OSM_OZONA_SONORA_ROUTE_SOURCE_ID = 'i10-osm-ozona-sonora-route-source';
export const I10_OSM_OZONA_SONORA_ROUTE_LAYER_ID = 'i10-osm-ozona-sonora-route-layer';
export const US277_OSM_SONORA_ROCKSPRINGS_ROUTE_SOURCE_ID = 'us277-osm-sonora-rocksprings-route-source';
export const US277_OSM_SONORA_ROCKSPRINGS_ROUTE_LAYER_ID = 'us277-osm-sonora-rocksprings-route-layer';

// New highway segment constants
export const I10_FORT_STOCKTON_OZONA_SOURCE_ID = 'i10-fort-stockton-ozona-source';
export const I10_FORT_STOCKTON_OZONA_LAYER_ID = 'i10-fort-stockton-ozona-layer';
export const I10_OZONA_JUNCTION_SONORA_SOURCE_ID = 'i10-ozona-junction-sonora-source';
export const I10_OZONA_JUNCTION_SONORA_LAYER_ID = 'i10-ozona-junction-sonora-layer';
export const US83_ROCKSPRINGS_LEAKEY_SOURCE_ID = 'us83-rocksprings-leakey-source';
export const US83_ROCKSPRINGS_LEAKEY_LAYER_ID = 'us83-rocksprings-leakey-layer';
export const US377_LEAKEY_UTOPIA_SOURCE_ID = 'us377-leakey-utopia-source';
export const US377_LEAKEY_UTOPIA_LAYER_ID = 'us377-leakey-utopia-layer';
export const LEAKEY_HONDO_SOURCE_ID = 'leakey-hondo-source';
export const LEAKEY_HONDO_LAYER_ID = 'leakey-hondo-layer';
export const UTOPIA_HONDO_SOURCE_ID = 'utopia-hondo-source';
export const UTOPIA_HONDO_LAYER_ID = 'utopia-hondo-layer';
export const US90_HONDO_CASTROVILLE_SOURCE_ID = 'us90-hondo-castroville-source';
export const US90_HONDO_CASTROVILLE_LAYER_ID = 'us90-hondo-castroville-layer';
export const HONDO_CASTROVILLE_SOURCE_ID = 'hondo-castroville-source';
export const HONDO_CASTROVILLE_LAYER_ID = 'hondo-castroville-layer';
export const ROCKSPRINGS_SONORA_SOURCE_ID = 'rocksprings-sonora-source';
export const ROCKSPRINGS_SONORA_LAYER_ID = 'rocksprings-sonora-layer';
export const SONORA_JUNCTION_SOURCE_ID = 'sonora-junction-source';
export const SONORA_JUNCTION_LAYER_ID = 'sonora-junction-layer';
export const JUNCTION_UTOPIA_SOURCE_ID = 'junction-utopia-source';
export const JUNCTION_UTOPIA_LAYER_ID = 'junction-utopia-layer';
export const JUNCTION_CASTROVILLE_SOURCE_ID = 'junction-castroville-source';
export const JUNCTION_CASTROVILLE_LAYER_ID = 'junction-castroville-layer';

// Path A constants
export const PATH_A_SOURCE_ID = 'path-a-source';
export const PATH_A_LAYER_ID = 'path-a-layer';
export const PATH_A_CIRCLES_SOURCE_ID = 'path-a-circles-source';
export const PATH_A_CIRCLES_LAYER_ID = 'path-a-circles-layer';
export const PATH_A_CIRCLES_LABEL_LAYER_ID = 'path-a-circles-label-layer';

// Location circles
export const SAND_LAKE_CIRCLE_SOURCE_ID = 'sand-lake-circle-source';
export const SAND_LAKE_CIRCLE_LAYER_ID = 'sand-lake-circle-layer';
export const BAKER_CIRCLE_SOURCE_ID = 'baker-circle-source';
export const BAKER_CIRCLE_LAYER_ID = 'baker-circle-layer';
export const FORT_STOCKTON_SOUTH_CIRCLE_SOURCE_ID = 'fort-stockton-south-circle-source';
export const FORT_STOCKTON_SOUTH_CIRCLE_LAYER_ID = 'fort-stockton-south-circle-layer';
export const COYOTE_CIRCLE_SOURCE_ID = 'coyote-circle-source';
export const COYOTE_CIRCLE_LAYER_ID = 'coyote-circle-layer';

// Coordinate constants
export const OZONA_COORDS = [-101.205972, 30.707417];
export const FORT_STOCKTON_COORDS = [-102.879996, 30.894348];
export const SONORA_COORDS = [-100.645, 30.570];
export const ROCKSPRINGS_COORDS = [-100.210, 30.015];
export const LEAKEY_COORDS = [-99.757, 29.726];
export const HONDO_COORDS = [-99.282, 29.347];
export const CASTROVILLE_COORDS = [-98.878, 29.355];
export const JUNCTION_COORDS = [-99.776, 30.489];
export const UTOPIA_COORDS = [-99.533, 29.615];
export const TARPLEY_COORDS = [-99.244, 29.578];
export const BALMORHEA_COORDS = [-103.742, 30.984];
export const MONAHANS_COORDS = [-102.892, 31.594];
export const PECOS_COORDS = [-103.493, 31.422];
export const TOYAH_COORDS = [-103.793, 31.312];
export const AUSTIN_COORDS = [-97.7431, 30.2672];
export const SAN_ANTONIO_COORDS = [-98.4936, 29.4241];

// Location circle coordinates
export const SAND_LAKE_COORDS = [-102.892, 31.889];
export const BAKER_COORDS = [-104.234, 30.784];
export const FORT_STOCKTON_SOUTH_COORDS = [-102.879, 30.677];
export const COYOTE_COORDS = [-103.456, 31.156];

// Highway segment configurations
export const HIGHWAY_SEGMENTS = [
  {
    key: 'fortStocktonOzona',
    sourceId: I10_FORT_STOCKTON_OZONA_SOURCE_ID,
    layerId: I10_FORT_STOCKTON_OZONA_LAYER_ID,
    geoJsonPath: '/data/i10_fort_stockton_ozona_trimmed.geojson',
    color: '#4A90E2', // blue
    displayName: 'I-10 Fort Stockton-Ozona'
  },
  {
    key: 'ozonaJunctionSonora',
    sourceId: I10_OZONA_JUNCTION_SONORA_SOURCE_ID,
    layerId: I10_OZONA_JUNCTION_SONORA_LAYER_ID,
    geoJsonPath: '/data/continuous_i10_ozona_sonora_route.geojson',
    color: '#7B68EE', // medium slate blue
    displayName: 'I-10 Ozona → Sonora'
  },
  {
    key: 'rockspringsLeakey',
    sourceId: US83_ROCKSPRINGS_LEAKEY_SOURCE_ID,
    layerId: US83_ROCKSPRINGS_LEAKEY_LAYER_ID,
    geoJsonPath: '/data/continuous_rocksprings_leakey_route.geojson',
    color: '#DC143C', // crimson
    displayName: 'Rocksprings → Leakey'
  },
  {
    key: 'leakeyUtopia',
    sourceId: US377_LEAKEY_UTOPIA_SOURCE_ID,
    layerId: US377_LEAKEY_UTOPIA_LAYER_ID,
    geoJsonPath: '/data/continuous_leakey_utopia_route.geojson',
    color: '#FF6347', // tomato
    displayName: 'Leakey → Utopia'
  },
  {
    key: 'utopiaHondo',
    sourceId: UTOPIA_HONDO_SOURCE_ID,
    layerId: UTOPIA_HONDO_LAYER_ID,
    geoJsonPath: '/data/continuous_utopia_hondo_route.geojson',
    color: '#9932CC', // dark orchid
    displayName: 'Utopia → Hondo'
  },
  {
    key: 'hondoCastroville',
    sourceId: US90_HONDO_CASTROVILLE_SOURCE_ID,
    layerId: US90_HONDO_CASTROVILLE_LAYER_ID,
    geoJsonPath: '/data/us90_hondo_castroville.geojson',
    color: '#00CED1', // dark turquoise
    displayName: 'US-90 Hondo-Castroville'
  },
  {
    key: 'hondoCastroville',
    sourceId: HONDO_CASTROVILLE_SOURCE_ID,
    layerId: HONDO_CASTROVILLE_LAYER_ID,
    geoJsonPath: '/data/continuous_hondo_castroville_route.geojson',
    color: '#FF1493', // deep pink
    displayName: 'Hondo → Castroville'
  },
  {
    key: 'rockspringsSonora',
    sourceId: ROCKSPRINGS_SONORA_SOURCE_ID,
    layerId: ROCKSPRINGS_SONORA_LAYER_ID,
    geoJsonPath: '/data/continuous_rocksprings_sonora_route.geojson',
    color: '#8A2BE2', // blue violet
    displayName: 'Rocksprings → Sonora'
  },
  {
    key: 'sonoraJunction',
    sourceId: SONORA_JUNCTION_SOURCE_ID,
    layerId: SONORA_JUNCTION_LAYER_ID,
    geoJsonPath: '/data/continuous_sonora_junction_route.geojson',
    color: '#20B2AA', // light sea green
    displayName: 'Sonora → Junction'
  },
  {
    key: 'junctionUtopia',
    sourceId: JUNCTION_UTOPIA_SOURCE_ID,
    layerId: JUNCTION_UTOPIA_LAYER_ID,
    geoJsonPath: '/data/continuous_junction_utopia_route.geojson',
    color: '#FFA500', // orange
    displayName: 'Junction → Utopia'
  },
  {
    key: 'junctionCastroville',
    sourceId: JUNCTION_CASTROVILLE_SOURCE_ID,
    layerId: JUNCTION_CASTROVILLE_LAYER_ID,
    geoJsonPath: '/data/continuous_junction_castroville_route.geojson',
    color: '#DA70D6', // orchid
    displayName: 'Junction → Castroville'
  },
  {
    key: 'pathA',
    sourceId: PATH_A_SOURCE_ID,
    layerId: PATH_A_LAYER_ID,
    geoJsonPath: '/data/path_a.geojson',
    color: '#FFD700', // gold
    displayName: 'Path A'
  }
];

// Location circles configuration
export const LOCATION_CIRCLES = [
  {
    key: 'sandLakeCircle',
    sourceId: SAND_LAKE_CIRCLE_SOURCE_ID,
    layerId: SAND_LAKE_CIRCLE_LAYER_ID,
    geoJsonPath: '/data/sand_lake_2mile_circle.geojson',
    color: '#FF6B6B', // coral red
    displayName: 'Sand Lake (2mi radius)'
  },
  {
    key: 'bakerCircle',
    sourceId: BAKER_CIRCLE_SOURCE_ID,
    layerId: BAKER_CIRCLE_LAYER_ID,
    geoJsonPath: '/data/baker_2mile_circle.geojson',
    color: '#4ECDC4', // turquoise
    displayName: 'Baker (2mi radius)'
  },
  {
    key: 'fortStocktonSouthCircle',
    sourceId: FORT_STOCKTON_SOUTH_CIRCLE_SOURCE_ID,
    layerId: FORT_STOCKTON_SOUTH_CIRCLE_LAYER_ID,
    geoJsonPath: '/data/fort_stockton_south_2mile_circle.geojson',
    color: '#45B7D1', // sky blue
    displayName: 'Fort Stockton South (2mi radius)'
  },
  {
    key: 'coyoteCircle',
    sourceId: COYOTE_CIRCLE_SOURCE_ID,
    layerId: COYOTE_CIRCLE_LAYER_ID,
    geoJsonPath: '/data/coyote_2mile_circle.geojson',
    color: '#F7DC6F', // light yellow
    displayName: 'Coyote (2mi radius)'
  }
];