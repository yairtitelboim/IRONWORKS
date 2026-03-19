/**
 * Geocode a free-text address or location query.
 * Tries OSM Nominatim first, falls back to Mapbox Geocoding API.
 *
 * @param {string} query - Address or place name (e.g. "Austin, TX", "123 Main St, Dallas")
 * @returns {Promise<{ lat: number, lng: number, displayName: string } | null>}
 */
export async function geocodeQuery(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const result = await geocodeNominatim(trimmed);
  if (result) return result;

  return geocodeMapbox(trimmed);
}

async function geocodeNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  try {
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    const top = json[0];
    const lat = parseFloat(top.lat);
    const lng = parseFloat(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, displayName: top.display_name || query };
  } catch (e) {
    console.warn('[geocodeQuery] Nominatim failed, trying Mapbox fallback:', e.message);
    return null;
  }
}

async function geocodeMapbox(query) {
  const token = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.features || json.features.length === 0) return null;

    const top = json.features[0];
    const [lng, lat] = top.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, displayName: top.place_name || query };
  } catch (e) {
    console.warn('[geocodeQuery] Mapbox fallback also failed:', e.message);
    return null;
  }
}
