// Minimal Overpass client with basic retry and multi-endpoint support

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

function ts(label) {
  const t = new Date().toISOString();
  return `[${t}] ${label}`;
}

export async function fetchOverpassJSON(query, { retriesPerEndpoint = 1, totalEndpoints = ENDPOINTS.length } = {}) {
  const endpoints = ENDPOINTS.slice(0, totalEndpoints);
  let lastError;

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= retriesPerEndpoint; attempt++) {
      try {
        console.log(ts(`Overpass POST start (${endpoint}) attempt ${attempt}`));
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log(ts(`Overpass POST success (${endpoint})`));
        return data;
      } catch (e) {
        lastError = e;
        console.warn(ts(`Overpass POST failed (${endpoint}) - ${e.message}`));
        if (attempt === retriesPerEndpoint) break;
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  throw lastError || new Error('Overpass: all endpoints failed');
}
