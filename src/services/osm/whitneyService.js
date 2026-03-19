/**
 * Whitney-specific OSM helpers
 *
 * This module is a small façade around existing Whitney OSM endpoints or
 * Overpass queries used in the OSMCall component. For now we only expose
 * a single function that wraps the primary Whitney infrastructure search,
 * and we keep the URL hard-coded to avoid behavioral changes.
 *
 * As we iterate, we can push more of OSMCall's fetch logic in here.
 */

const DEFAULT_BASE_URL = 'http://localhost:3001';

const getWhitneyBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__WHITNEY_OSM_BASE_URL__) {
    return window.__WHITNEY_OSM_BASE_URL__;
  }
  return DEFAULT_BASE_URL;
};

export const fetchWhitneyInfrastructure = async (params) => {
  const baseUrl = getWhitneyBaseUrl();
  const url = `${baseUrl}/api/osm/whitney/infrastructure`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params || {})
  });

  if (!response.ok) {
    throw new Error(`Whitney infrastructure fetch failed (${response.status})`);
  }

  return response.json();
};


