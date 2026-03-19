/**
 * Power Connections Visualization Utility
 * Analyzes and visualizes power infrastructure connections for regulatory distinction:
 * - Microsoft/Three Mile Island: Grid-connected (connects to transmission lines)
 * - Amazon/Susquehanna: Behind-the-meter (does NOT connect to transmission lines)
 */

import * as turf from '@turf/turf';

/**
 * Load OSM GeoJSON data for a site
 * @param {string} siteKey - Site key (e.g., 'three_mile_island_pa', 'susquehanna_nuclear_pa')
 * @returns {Promise<Object|null>} - GeoJSON data or null if error
 */
export async function loadPowerConnectionData(siteKey) {
  try {
    // Map site keys to data paths
    const siteDataPaths = {
      'three_mile_island_pa': '/osm/pa_nuclear_tmi.json',
      'susquehanna_nuclear_pa': '/osm/pa_nuclear_susquehanna.json'
    };

    const dataPath = siteDataPaths[siteKey];
    if (!dataPath) {
      console.warn(`⚠️ No data path found for site: ${siteKey}`);
      return null;
    }

    console.log(`📁 Loading power connection data from ${dataPath}...`);
    const response = await fetch(dataPath);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Loaded power connection data: ${data.features?.length || 0} features`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to load power connection data for ${siteKey}:`, error);
    return null;
  }
}

/**
 * Analyze site connections to transmission infrastructure
 * @param {Object} geoJSON - GeoJSON data for the site
 * @param {Object} siteConfig - Site configuration from ncPowerSites.js
 * @returns {Object} - Connection analysis results
 */
export function analyzeSiteConnections(geoJSON, siteConfig) {
  if (!geoJSON || !geoJSON.features || !siteConfig) {
    return {
      isConnected: false,
      nearestTransmissionLine: null,
      distanceToNearest: null,
      connectionPoint: null,
      transmissionLines: []
    };
  }

  const sitePoint = turf.point([siteConfig.coordinates.lng, siteConfig.coordinates.lat]);
  const siteRadius = siteConfig.radiusMeters || 25000; // Use site radius for search area
  
  // Filter for transmission lines (power lines with voltage >= 230KV)
  const transmissionLines = geoJSON.features.filter(feature => {
    if (feature.geometry?.type !== 'LineString' && feature.geometry?.type !== 'MultiLineString') {
      return false;
    }

    const props = feature.properties || {};
    const tags = props.tags || {};
    const voltage = props.voltage || tags.voltage;

    if (!voltage) return false;

    // Parse voltage (handle string like "500000" or "500")
    const voltageNum = parseFloat(String(voltage).replace(/[^\d.]/g, ''));
    const voltageKV = voltageNum > 1000 ? voltageNum / 1000 : voltageNum;

    // Consider 230KV+ as transmission lines
    return voltageKV >= 230;
  });

  console.log(`🔍 Found ${transmissionLines.length} transmission lines near ${siteConfig.shortName}`);

  // Find nearest transmission line and check for connection
  let nearestLine = null;
  let minDistance = Infinity;
  let connectionPoint = null;
  let isConnected = false;

  transmissionLines.forEach(line => {
    try {
      let lineGeometry;
      
      if (line.geometry.type === 'LineString') {
        lineGeometry = turf.lineString(line.geometry.coordinates);
      } else if (line.geometry.type === 'MultiLineString') {
        // For MultiLineString, check each segment
        line.geometry.coordinates.forEach(segment => {
          const segmentLine = turf.lineString(segment);
          const nearest = turf.nearestPointOnLine(segmentLine, sitePoint, { units: 'meters' });
          const distance = nearest.properties.dist;

          if (distance < minDistance) {
            minDistance = distance;
            nearestLine = line;
            connectionPoint = nearest.geometry.coordinates;
          }
        });
        return; // Skip the single line check below
      } else {
        return; // Skip non-line geometries
      }

      // Find nearest point on line
      const nearest = turf.nearestPointOnLine(lineGeometry, sitePoint, { units: 'meters' });
      const distance = nearest.properties.dist;

      if (distance < minDistance) {
        minDistance = distance;
        nearestLine = line;
        connectionPoint = nearest.geometry.coordinates;
      }
    } catch (error) {
      console.warn('⚠️ Error analyzing transmission line:', error);
    }
  });

  // Hardcode connection status based on regulatory model (override distance-based logic)
  if (siteConfig.key === 'three_mile_island_pa') {
    // Microsoft/Three Mile Island is grid-connected
    isConnected = true;
  } else if (siteConfig.key === 'susquehanna_nuclear_pa') {
    // Amazon/Susquehanna is behind-the-meter (not grid-connected in this context)
    isConnected = false;
  } else {
    // Fallback to distance-based analysis for other sites
    const CONNECTION_THRESHOLD = 500; // meters
    isConnected = minDistance <= CONNECTION_THRESHOLD;
  }

  console.log(`🔌 ${siteConfig.shortName} connection analysis:`, {
    isConnected,
    distanceToNearest: minDistance,
    nearestLineName: nearestLine?.properties?.name || 'Unnamed',
    connectionPoint,
    regulatoryOverride: siteConfig.key === 'three_mile_island_pa' || siteConfig.key === 'susquehanna_nuclear_pa'
  });

  return {
    isConnected,
    nearestTransmissionLine: nearestLine,
    distanceToNearest: minDistance,
    connectionPoint: connectionPoint ? { lng: connectionPoint[0], lat: connectionPoint[1] } : null,
    transmissionLines: transmissionLines,
    sitePoint: { lng: siteConfig.coordinates.lng, lat: siteConfig.coordinates.lat }
  };
}

/**
 * Create connection line GeoJSON between site and transmission line
 * @param {Object} sitePoint - Site coordinates {lng, lat}
 * @param {Object} connectionPoint - Connection point coordinates {lng, lat}
 * @param {boolean} isConnected - Whether site is connected
 * @param {number} distance - Distance in meters
 * @returns {Object} - GeoJSON Feature for connection line
 */
export function createConnectionLine(sitePoint, connectionPoint, isConnected, distance = null) {
  if (!connectionPoint) {
    return null;
  }

  // Calculate midpoint for label placement
  const midLng = (sitePoint.lng + connectionPoint.lng) / 2;
  const midLat = (sitePoint.lat + connectionPoint.lat) / 2;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [sitePoint.lng, sitePoint.lat],
        [connectionPoint.lng, connectionPoint.lat]
      ]
    },
    properties: {
      isConnected,
      connectionType: isConnected ? 'grid-connected' : 'behind-the-meter',
      distance: distance,
      distanceKm: distance ? (distance / 1000).toFixed(2) : null,
      midPoint: { lng: midLng, lat: midLat }
    }
  };
}

/**
 * Create site marker GeoJSON
 * @param {Object} siteConfig - Site configuration
 * @param {Object} connectionAnalysis - Connection analysis results
 * @returns {Object} - GeoJSON Feature for site marker
 */
export function createSiteMarker(siteConfig, connectionAnalysis) {
  // Determine company and label based on site
  let companyLabel = '';
  let companyColor = '#3b82f6'; // Default blue
  
  if (siteConfig.key === 'three_mile_island_pa') {
    companyLabel = 'MSFT';
    companyColor = '#3b82f6'; // Blue for Microsoft
  } else if (siteConfig.key === 'susquehanna_nuclear_pa') {
    companyLabel = 'AMZN';
    companyColor = '#22c55e'; // Green for Amazon
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [siteConfig.coordinates.lng, siteConfig.coordinates.lat]
    },
    properties: {
      siteKey: siteConfig.key,
      siteName: siteConfig.shortName,
      companyLabel,
      companyColor,
      isConnected: connectionAnalysis.isConnected,
      connectionStatus: connectionAnalysis.isConnected ? 'Grid-Connected' : 'Behind-the-Meter',
      distanceToNearest: connectionAnalysis.distanceToNearest
    }
  };
}

/**
 * Create connection status icon GeoJSON
 * @param {Object} connectionPoint - Connection point coordinates {lng, lat}
 * @param {boolean} isConnected - Whether site is connected
 * @returns {Object} - GeoJSON Feature for status icon
 */
export function createStatusIcon(connectionPoint, isConnected) {
  if (!connectionPoint) {
    return null;
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [connectionPoint.lng, connectionPoint.lat]
    },
    properties: {
      isConnected,
      iconType: isConnected ? 'checkmark' : 'x',
      iconColor: isConnected ? '#22c55e' : '#ef4444' // Green for connected, red for not connected
    }
  };
}

