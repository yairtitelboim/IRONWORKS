// UI event logging (privacy-preserving)
// Sends raw query text to server, which hashes it with a server-side secret.

const safeGetMapContext = () => {
  try {
    const map = window?.mapComponent?.map || window?.map?.current || null;
    if (!map) return {};

    const zoom_level = typeof map.getZoom === 'function' ? Math.round(map.getZoom()) : null;
    const center = typeof map.getCenter === 'function' ? map.getCenter() : null;

    // Coarse center (rounded) — avoids capturing precise locations.
    const center_lat = center?.lat !== undefined ? Number(center.lat.toFixed(2)) : null;
    const center_lon = center?.lng !== undefined ? Number(center.lng.toFixed(2)) : null;

    return { zoom_level, center_lat, center_lon };
  } catch {
    return {};
  }
};

const ACCESS_SESSION_STORAGE_KEY = 'switchyard_access_session_id';

const resolveAccessSessionId = (explicitSessionId = null) => {
  const normalizedExplicit =
    typeof explicitSessionId === 'string' ? explicitSessionId.trim() || null : explicitSessionId;
  if (normalizedExplicit) return normalizedExplicit;
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search || '');
    const fromUrl = String(params.get('access_session_id') || '').trim();
    if (fromUrl) {
      window.sessionStorage.setItem(ACCESS_SESSION_STORAGE_KEY, fromUrl);
      return fromUrl;
    }

    const fromStorage = String(window.sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY) || '').trim();
    return fromStorage || null;
  } catch {
    return null;
  }
};

export async function logUiEvent({
  event_type,
  asset_type = null,
  county = null,
  state = null,
  query_text = null,
  project_id = null,
  access_session_id = null,
  zoom_level = null,
  center_lat = null,
  center_lon = null
} = {}) {
  if (!event_type) return;

  const ctx = typeof window !== 'undefined' ? safeGetMapContext() : {};
  const normalizedQueryText =
    typeof query_text === 'string' ? query_text.trim() || null : query_text;
  const resolvedAccessSessionId = resolveAccessSessionId(access_session_id);

  const payload = {
    event_type,
    asset_type,
    county,
    state,
    query_text: normalizedQueryText,
    project_id,
    access_session_id: resolvedAccessSessionId,
    zoom_level: zoom_level ?? ctx.zoom_level ?? null,
    center_lat: center_lat ?? ctx.center_lat ?? null,
    center_lon: center_lon ?? ctx.center_lon ?? null
  };

  try {
    await fetch('/api/ui/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // silent
  }
}
