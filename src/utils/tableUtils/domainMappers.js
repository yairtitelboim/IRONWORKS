/**
 * Domain-level mappers for transforming various analysis data sources
 * (Perplexity, SERP, generic parsed data) into table-ready rows.
 *
 * This is extracted from AIResponseDisplayRefactored so the component can
 * focus on rendering rather than shaping data.
 */

export const mapPerplexityAnalysisToNodes = (analysisData) => {
  if (!analysisData?.geoJsonFeatures?.length) return [];

  return analysisData.geoJsonFeatures.map((feature, index) => ({
    id: feature.properties?.id || `perplexity-${index}`,
    name: feature.properties?.name || 'Innovation Node',
    category: feature.properties?.category || 'Startup Analysis',
    innovation_score: feature.properties?.innovation_score || null,
    funding_access: feature.properties?.funding_access || null,
    talent_access: feature.properties?.talent_access || null,
    network_effects: feature.properties?.network_effects || null,
    market_opportunity: feature.properties?.market_opportunity || null,
    startup_impact: feature.properties?.startup_impact || null,
    zone: feature.properties?.zone || 'unknown',
    zone_name: feature.properties?.zone_name || 'Unknown Zone',
    analysis_type: feature.properties?.analysis_type || 'startup_catalyst',
    confidence_score: feature.properties?.confidence_score || 0.8,
    color: '#3b82f6',
    description:
      `${feature.properties?.name || 'Innovation Node'} - ${
        feature.properties?.analysis_type || 'startup analysis'
      }`,
    geometry: feature.geometry,
    coordinates: feature.geometry?.coordinates
      ? {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1]
        }
      : { lng: -95.3698, lat: 29.7604 }
  }));
};

export const mapSerpFeaturesToProperties = (serpFeatures) => {
  if (!Array.isArray(serpFeatures) || serpFeatures.length === 0) return [];

  return serpFeatures.map((property, index) => ({
    id: property.properties?.id || `property-${index}`,
    name: property.properties?.name || 'Property',
    address: property.properties?.address || 'Property Address',
    category: property.properties?.category || 'Property',
    price:
      property.properties?.price || property.properties?.price_value || null,
    squareFootage:
      property.properties?.squareFootage ||
      property.properties?.square_footage ||
      null,
    bedrooms: property.properties?.bedrooms || null,
    zipCode:
      property.properties?.zipCode || property.properties?.zip_code || null,
    scrapedAt:
      property.properties?.scrapedAt || property.properties?.scraped_at || null,
    color:
      property.properties?.categoryColor ||
      property.properties?.color ||
      '#6b7280',
    description: property.properties?.description || '',
    geometry:
      property.geometry || {
        type: 'Point',
        coordinates: [-95.3698, 29.7604]
      },
    coordinates: property.geometry?.coordinates
      ? {
          lng: property.geometry.coordinates[0],
          lat: property.geometry.coordinates[1]
        }
      : { lng: -95.3698, lat: 29.7604 }
  }));
};

export const mapGenericPropertiesToRows = (properties) => {
  if (!Array.isArray(properties) || properties.length === 0) return [];

  return properties.map((property, index) => ({
    id: property.id || `property-${index}`,
    name: property.name || property.title || 'Property',
    address: property.address || 'Property Address',
    category: property.category || 'Property',
    price: property.price || null,
    squareFootage: property.squareFootage || null,
    bedrooms: property.bedrooms || null,
    zipCode: property.zipCode || null,
    scrapedAt: property.scrapedAt || null,
    color: property.color || '#6b7280',
    description: property.description || '',
    geometry:
      property.geometry || {
        type: 'Point',
        coordinates: property.coordinates
          ? [property.coordinates.lng, property.coordinates.lat]
          : [-95.3698, 29.7604]
      },
    coordinates:
      property.coordinates || {
        lng: -95.3698,
        lat: 29.7604
      }
  }));
};

/**
 * Build startup/property table data for the "all" category, using, in order:
 *  1. Perplexity analysis data (if present on window.lastPerplexityAnalysisData)
 *  2. SERP startup ecosystem data (if present on window.lastStartupEcosystemData)
 *  3. Generic parsed data (fallback)
 *
 * This still reads from window for now, but keeps that detail out of React.
 */
export const buildStartupTableData = (fallbackRows = []) => {
  if (typeof window === 'undefined') {
    return fallbackRows;
  }

  const perplexityAnalysisData = window.lastPerplexityAnalysisData;
  if (perplexityAnalysisData?.geoJsonFeatures?.length > 0) {
    return mapPerplexityAnalysisToNodes(perplexityAnalysisData);
  }

  const startupEcosystemData = window.lastStartupEcosystemData;
  const serpFeatures = startupEcosystemData?.serp?.features || [];
  if (serpFeatures.length > 0) {
    return mapSerpFeaturesToProperties(serpFeatures);
  }

  return mapGenericPropertiesToRows(fallbackRows);
};


