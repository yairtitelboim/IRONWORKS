/**
 * Supabase-backed SignalsDB adapter.
 *
 * This implements the subset of the SQLite SignalsDB interface used by
 * scanner ingesters + API routes, but persists to Supabase PostgREST.
 */

const DEFAULT_TIMEOUT_MS = 12_000;

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const withTimeout = async (promise, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await promise(controller.signal);
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse Supabase JSON: ${error.message}`);
  }
};

const supabaseFetch = async (path, { method = 'GET', headers = {}, body, timeoutMs } = {}) => {
  const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
  if (!hasCredentials) {
    throw new Error('Supabase credentials are not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  const url = `${supabaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  return await withTimeout(async (signal) => {
    const res = await fetch(url, {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        ...headers
      },
      body,
      signal
    });

    const data = await parseJson(res);
    if (!res.ok) {
      const msg = (data && typeof data === 'object' && (data.message || data.error)) || `Supabase request failed (${res.status})`;
      const detail = data && typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : String(data);
      throw new Error(`${msg}: ${detail}`);
    }

    return data;
  }, timeoutMs);
};

const buildSelectUrl = (table, { select = '*', filters = [], order, limit } = {}) => {
  const params = new URLSearchParams();
  params.set('select', select);
  for (const [key, value] of filters) params.append(key, value);
  if (order) params.append('order', order);
  if (Number.isFinite(limit)) params.append('limit', String(limit));
  return `/rest/v1/${table}?${params.toString()}`;
};

class SupabaseSignalsDB {
  constructor(options = {}) {
    this.tableSignals = options.tableSignals || process.env.SUPABASE_SCANNER_SIGNALS_TABLE || 'scanner_signals';
    this.tableSnapshots = options.tableSnapshots || process.env.SUPABASE_SCANNER_SNAPSHOTS_TABLE || 'scanner_source_snapshots';
  }

  async connect() {
    // no-op (kept for interface compatibility)
  }

  async init() {
    // no-op: tables are created via migrations / SQL editor.
  }

  async insertSignal(signal) {
    if (!signal || !signal.signal_id) {
      throw new Error('insertSignal requires signal.signal_id');
    }

    await supabaseFetch(`/rest/v1/${this.tableSignals}?on_conflict=signal_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(signal)
    });
  }

  async insertSnapshot(snapshot) {
    if (!snapshot || !snapshot.snapshot_id) {
      throw new Error('insertSnapshot requires snapshot.snapshot_id');
    }

    await supabaseFetch(`/rest/v1/${this.tableSnapshots}?on_conflict=snapshot_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(snapshot)
    });
  }

  async getSignals(filters = {}) {
    const q = {
      select: '*',
      filters: [],
      order: 'ingested_at.desc',
      limit: filters.limit ? Number(filters.limit) : 100
    };

    if (filters.lane) q.filters.push(['lane', `eq.${filters.lane}`]);
    if (filters.status) q.filters.push(['status', `eq.${filters.status}`]);
    if (filters.source_type) q.filters.push(['source_type', `eq.${filters.source_type}`]);

    const url = buildSelectUrl(this.tableSignals, q);
    const rows = await supabaseFetch(url, { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  }

  async getSignalByDedupeKey(dedupeKey) {
    if (!dedupeKey) return null;
    const url = buildSelectUrl(this.tableSignals, {
      select: '*',
      filters: [['dedupe_key', `eq.${dedupeKey}`]],
      limit: 1
    });
    const rows = await supabaseFetch(url, { method: 'GET' });
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }

  async getLatestSnapshot(sourceType, query) {
    const url = buildSelectUrl(this.tableSnapshots, {
      select: '*',
      filters: [
        ['source_type', `eq.${sourceType}`],
        ['query', `eq.${query}`]
      ],
      order: 'captured_at.desc',
      limit: 1
    });
    const rows = await supabaseFetch(url, { method: 'GET' });
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }

  async getSignalByUrl(urlValue) {
    if (!urlValue) return null;
    const url = buildSelectUrl(this.tableSignals, {
      select: '*',
      filters: [['url', `eq.${urlValue}`]],
      limit: 1
    });
    const rows = await supabaseFetch(url, { method: 'GET' });
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }

  async getSignalBySourceId(sourceType, sourceId) {
    if (!sourceType || !sourceId) return null;
    const url = buildSelectUrl(this.tableSignals, {
      select: '*',
      filters: [
        ['source_type', `eq.${sourceType}`],
        ['source_id', `eq.${sourceId}`]
      ],
      limit: 1
    });
    const rows = await supabaseFetch(url, { method: 'GET' });
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }

  async updateSignalStatus(signalId, status) {
    if (!signalId) throw new Error('signalId required');
    if (!status) throw new Error('status required');

    await supabaseFetch(`/rest/v1/${this.tableSignals}?signal_id=eq.${signalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ status })
    });
  }

  async close() {
    // no-op
  }
}

export default SupabaseSignalsDB;
export { getSupabaseConfig };
