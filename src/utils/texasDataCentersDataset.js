export const TEXAS_DATA_CENTERS_DATASET_VERSION = '2026-03-10-173';
export const TEXAS_DATA_CENTERS_GEOJSON_BASE_URL = '/data/facility-markers.geojson';
export const TEXAS_DATA_CENTERS_GEOJSON_URL = `${TEXAS_DATA_CENTERS_GEOJSON_BASE_URL}?v=${encodeURIComponent(TEXAS_DATA_CENTERS_DATASET_VERSION)}`;
export const TEXAS_DATA_CENTERS_ADDRESS_SEARCH_INDEX_BASE_URL = '/data/address-search-index.json';
export const TEXAS_DATA_CENTERS_ADDRESS_SEARCH_INDEX_URL = `${TEXAS_DATA_CENTERS_ADDRESS_SEARCH_INDEX_BASE_URL}?v=${encodeURIComponent(TEXAS_DATA_CENTERS_DATASET_VERSION)}`;
export const FACILITY_SIGNAL_LINKS_BASE_URL = '/data/facility-signal-links.json';
export const FACILITY_SIGNAL_LINKS_URL = `${FACILITY_SIGNAL_LINKS_BASE_URL}?v=${encodeURIComponent(TEXAS_DATA_CENTERS_DATASET_VERSION)}`;
export const FACILITY_LATEST_SIGNALS_BASE_URL = '/data/facility-latest-signals.json';
export const FACILITY_LATEST_SIGNALS_URL = `${FACILITY_LATEST_SIGNALS_BASE_URL}?v=${encodeURIComponent(TEXAS_DATA_CENTERS_DATASET_VERSION)}`;

let facilitySignalLinksPromise = null;
let facilityLatestSignalsPromise = null;

export const fetchTexasDataCentersGeoJson = (options = {}) => {
  const { cache = 'no-cache', ...rest } = options;
  return fetch(TEXAS_DATA_CENTERS_GEOJSON_URL, { cache, ...rest });
};

export const fetchTexasDataCentersAddressSearchIndex = (options = {}) => {
  const { cache = 'no-cache', ...rest } = options;
  return fetch(TEXAS_DATA_CENTERS_ADDRESS_SEARCH_INDEX_URL, { cache, ...rest });
};

const fetchJsonWithCache = async (url, cacheMode = 'default') => {
  const response = await fetch(url, { cache: cacheMode });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
};

export const fetchFacilitySignalLinks = ({ forceRefresh = false } = {}) => {
  if (!facilitySignalLinksPromise || forceRefresh) {
    facilitySignalLinksPromise = fetchJsonWithCache(FACILITY_SIGNAL_LINKS_URL, forceRefresh ? 'no-cache' : 'default')
      .catch((error) => {
        facilitySignalLinksPromise = null;
        throw error;
      });
  }
  return facilitySignalLinksPromise;
};

export const fetchFacilityLatestSignals = ({ forceRefresh = false } = {}) => {
  if (!facilityLatestSignalsPromise || forceRefresh) {
    facilityLatestSignalsPromise = fetchJsonWithCache(FACILITY_LATEST_SIGNALS_URL, forceRefresh ? 'no-cache' : 'default')
      .catch((error) => {
        facilityLatestSignalsPromise = null;
        throw error;
      });
  }
  return facilityLatestSignalsPromise;
};
