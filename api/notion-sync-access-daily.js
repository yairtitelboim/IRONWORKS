const NOTION_VERSION = '2025-09-03';

const jsonError = (res, status, error, details = {}) =>
  res.status(status).json({ ok: false, error, ...details });

const getEnv = (key) => {
  const value = process.env[key];
  return value && String(value).trim() ? String(value).trim() : '';
};

const pad2 = (n) => String(n).padStart(2, '0');

// Chicago-local day string for "yesterday".
const getYesterdayChicago = () => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const today = fmt.format(now); // YYYY-MM-DD
  const [y, m, d] = today.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const yUtc = new Date(utcNoon.getTime() - 24 * 60 * 60 * 1000);
  return `${yUtc.getUTCFullYear()}-${pad2(yUtc.getUTCMonth() + 1)}-${pad2(yUtc.getUTCDate())}`;
};

// Build UTC range [start,end) corresponding to a Chicago-local calendar day.
const dayRangeUtcFromChicagoDay = (dayStr) => {
  const [y, m, d] = String(dayStr).split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid day: ${dayStr}`);

  // Noon UTC is always safe across DST; then we map to Chicago midnight boundaries.
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Find the UTC instant that corresponds to Chicago 00:00:00 of that date.
  // Approach: take noon, then subtract hours to reach local midnight.
  // This is coarse but stable enough for daily ranges.
  const parts = Object.fromEntries(fmt.formatToParts(noonUtc).map((p) => [p.type, p.value]));
  const localHour = Number(parts.hour);
  const startUtc = new Date(noonUtc.getTime() - localHour * 60 * 60 * 1000);
  startUtc.setUTCMinutes(0, 0, 0);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() };
};

const parseJsonSafe = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const notionRequest = async (path, { method = 'GET', body = null } = {}) => {
  const key = getEnv('NOTION_API_KEY');
  if (!key) throw new Error('Missing NOTION_API_KEY');

  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(`Notion ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
};

const topN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const fmtPairs = (pairs) => pairs.map(([k, v]) => `${k} (${v})`).join(', ');

const supabaseRows = async (table, { startIso, endIso, select, limit = 50000 }) => {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured');

  const url = new URL(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  url.searchParams.set('created_at', `gte.${startIso}`);
  url.searchParams.append('created_at', `lt.${endIso}`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const message = json?.message || json?.error || `Supabase query failed (${res.status})`;
    throw new Error(message);
  }
  return Array.isArray(json) ? json : [];
};

const upsertNotionAccessDaily = async ({ databaseId, dataSourceId, dayStr, metrics }) => {
  const existing = await notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: {
      page_size: 1,
      filter: {
        property: 'Date',
        date: { equals: dayStr }
      }
    }
  });

  const props = {
    Name: { title: [{ type: 'text', text: { content: `Access Daily ${dayStr}` } }] },
    Date: { date: { start: dayStr } },
    Sessions: { number: metrics.sessions },
    Turns: { number: metrics.turns },
    'Top Ref': { rich_text: [{ type: 'text', text: { content: metrics.topRefText || 'n/a' } }] },
    'Top Chips': { rich_text: [{ type: 'text', text: { content: metrics.topChipsText || 'n/a' } }] },
    'Intake Methods': { rich_text: [{ type: 'text', text: { content: metrics.intakeMethodsText || 'n/a' } }] }
  };

  const page = existing?.results?.[0];
  if (page?.id) {
    const updated = await notionRequest(`/pages/${page.id}`, { method: 'PATCH', body: { properties: props } });
    return { action: 'updated', pageId: updated.id };
  }

  const created = await notionRequest('/pages', {
    method: 'POST',
    body: { parent: { database_id: databaseId }, properties: props }
  });

  return { action: 'created', pageId: created.id };
};

export default async function handler(req, res) {
  const isCron = Boolean(req.headers['x-vercel-cron']);
  const syncToken = getEnv('SYNC_TOKEN');
  const providedToken = req.query?.token || req.headers['x-sync-token'] || '';

  if (!isCron) {
    if (!syncToken) return jsonError(res, 500, 'SYNC_TOKEN not configured');
    if (providedToken !== syncToken) return jsonError(res, 401, 'Unauthorized');
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  try {
    const accessDatabaseId = getEnv('SWY_NOTION_ACCESS_DATABASE_ID');
    const accessDataSourceId = getEnv('SWY_NOTION_ACCESS_DATA_SOURCE_ID');

    if (!accessDatabaseId || !accessDataSourceId) {
      return jsonError(res, 500, 'Missing Notion env vars', {
        required: ['SWY_NOTION_ACCESS_DATABASE_ID', 'SWY_NOTION_ACCESS_DATA_SOURCE_ID']
      });
    }

    const dayStr = (req.query?.day && String(req.query.day)) || getYesterdayChicago();
    const { startIso, endIso } = dayRangeUtcFromChicagoDay(dayStr);

    const rows = await supabaseRows('access_conversations', {
      startIso,
      endIso,
      select: 'session_id,ref,intake_method,chip_selected'
    });

    const sessions = new Set();
    const byRef = new Map();
    const byChip = new Map();
    const byMethod = new Map();

    for (const r of rows) {
      if (r.session_id) sessions.add(String(r.session_id));
      const ref = (r.ref || 'null').toString();
      const chip = (r.chip_selected || 'null').toString();
      const method = (r.intake_method || 'null').toString();
      byRef.set(ref, (byRef.get(ref) || 0) + 1);
      byChip.set(chip, (byChip.get(chip) || 0) + 1);
      byMethod.set(method, (byMethod.get(method) || 0) + 1);
    }

    const metrics = {
      sessions: sessions.size,
      turns: rows.length,
      topRefText: byRef.size ? fmtPairs(topN(byRef, 5)) : 'n/a',
      topChipsText: byChip.size ? fmtPairs(topN(byChip, 5)) : 'n/a',
      intakeMethodsText: byMethod.size ? fmtPairs(topN(byMethod, 5)) : 'n/a'
    };

    const notion = await upsertNotionAccessDaily({
      databaseId: accessDatabaseId,
      dataSourceId: accessDataSourceId,
      dayStr,
      metrics
    });

    return res.status(200).json({
      ok: true,
      mode: isCron ? 'cron' : 'manual',
      day: dayStr,
      range: { startIso, endIso },
      supabase: { turns: rows.length, sessions: sessions.size },
      metrics,
      notion
    });
  } catch (error) {
    console.error('❌ /api/notion-sync-access-daily error:', error);
    return jsonError(res, 500, 'Sync failed', { message: error.message });
  }
}
