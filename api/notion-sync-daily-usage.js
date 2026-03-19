const NOTION_VERSION = '2025-09-03';

const getEnv = (key) => process.env[key];

const jsonError = (res, status, message, extra = {}) => {
  res.status(status).json({ error: message, ...extra });
};

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const getChicagoDayString = (date) => {
  // Format as YYYY-MM-DD in America/Chicago
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
};

const getYesterdayChicago = () => {
  const now = new Date();
  // Subtract 24h then re-format in Chicago; good enough for daily rollups.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getChicagoDayString(yesterday);
};

const dayRangeUtcFromChicagoDay = (dayStr) => {
  // Convert a Chicago calendar day into UTC boundaries by using noon trick.
  // We avoid timezone math dependencies; this is robust across DST changes.
  // Strategy: create two Date objects from Chicago-local strings via Intl parts.

  // Build a Date representing Chicago day at 00:00 by searching UTC time that formats to that.
  // Simpler: use Date from components in local runtime timezone, then interpret as Chicago via Intl.
  // For our purposes, we can query by created_at between [dayStrT00:00-06:00-ish, nextDay)...
  // But safest is to compute boundaries by leveraging the fact that Supabase stores timestamptz and accepts ISO.

  const [y, m, d] = dayStr.split('-').map(Number);

  // Create a Date at UTC noon for the target day and next day, then ask what the Chicago offset is.
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const nextNoonUtc = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));

  const chicagoOffsetMinutes = (dt) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const parts = fmt.formatToParts(dt);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value);
    const mm = Number(parts.find((p) => p.type === 'minute')?.value);
    const dd = Number(parts.find((p) => p.type === 'day')?.value);

    // dt is UTC noon. If Chicago time is e.g. 06:00, offset is -360.
    // Compute minutes difference between Chicago clock and UTC clock.
    const utcH = dt.getUTCHours();
    const utcM = dt.getUTCMinutes();
    // Day delta matters; compare Chicago day to UTC day.
    const utcD = dt.getUTCDate();
    const dayDelta = dd - utcD;

    return (hh - utcH + dayDelta * 24) * 60 + (mm - utcM);
  };

  const offStart = chicagoOffsetMinutes(noonUtc);
  const offEnd = chicagoOffsetMinutes(nextNoonUtc);

  // Chicago 00:00 corresponds to UTC 00:00 - offset
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offStart * 60 * 1000);
  const endUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - offEnd * 60 * 1000);

  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() };
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

const supabaseRequest = async (path, { method = 'GET', headers = {}, body = null } = {}) => {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const url = `${supabaseUrl.replace(/\/+$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res;
};

const supabaseCount = async (table, { startIso, endIso, extraFilters = [] } = {}) => {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.append('created_at', `gte.${startIso}`);
  params.append('created_at', `lt.${endIso}`);
  for (const [k, v] of extraFilters) params.append(k, v);

  const res = await supabaseRequest(`/rest/v1/${table}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Prefer: 'count=exact',
      Range: '0-0'
    }
  });

  if (!res.ok) {
    const j = await parseJsonSafe(res);
    throw new Error(`Supabase count failed for ${table} (${res.status}): ${JSON.stringify(j)}`);
  }

  const contentRange = res.headers.get('content-range');
  const total = contentRange?.split('/')?.[1];
  return total ? Number(total) : 0;
};

const supabaseRows = async (table, { startIso, endIso, select, limit = 50000, extraFilters = [] } = {}) => {
  const params = new URLSearchParams();
  params.set('select', select);
  params.append('created_at', `gte.${startIso}`);
  params.append('created_at', `lt.${endIso}`);
  params.set('limit', String(limit));
  for (const [k, v] of extraFilters) params.append(k, v);

  const res = await supabaseRequest(`/rest/v1/${table}?${params.toString()}`);
  const j = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(`Supabase query failed for ${table} (${res.status}): ${JSON.stringify(j)}`);
  }
  return Array.isArray(j) ? j : [];
};

const topN = (map, n = 5) => {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
};

const buildTopText = ({ eventsCount, topEvents, topAssetTypes }) => {
  const fmtList = (pairs) => pairs.map(([k, v]) => `${k} (${v})`).join(', ');
  return [
    `ui_events: ${eventsCount}`,
    `top event_type: ${topEvents.length ? fmtList(topEvents) : 'n/a'}`,
    `top asset_type: ${topAssetTypes.length ? fmtList(topAssetTypes) : 'n/a'}`
  ].join('\n');
};

const queryDatabaseByDate = async ({ databaseId, dayStr }) => {
  const q = await notionRequest(`/databases/${databaseId}/query`, {
    method: 'POST',
    body: {
      filter: { property: 'Date', date: { equals: dayStr } },
      page_size: 2
    }
  });
  return q?.results?.[0] || null;
};

const upsertDailyUsageExec = async ({ databaseId, dayStr, metrics }) => {
  const name = `Exec Daily Usage ${dayStr}`;
  const props = {
    Name: { title: [{ type: 'text', text: { content: name } }] },
    Date: { date: { start: dayStr } },
    'Metrics Version': { select: { name: 'v2' } },

    Sessions: { number: metrics.sessions || 0 },
    Searches: { number: metrics.searches || 0 },
    'Address Searches': { number: metrics.addressSearches || 0 },
    Events: { number: metrics.eventsCount || 0 },

    'Returning Users (7d)': { number: metrics.returningUsers7d || 0 },
    'Users 1-2': { number: metrics.users1to2 || 0 },
    'Users 3-9': { number: metrics.users3to9 || 0 },
    'Users 10+': { number: metrics.users10plus || 0 },

    'Top Projects': { rich_text: [{ type: 'text', text: { content: metrics.topProjectsText || '' } }] },
    Notes: { rich_text: [{ type: 'text', text: { content: metrics.notes || '' } }] }
  };

  const existing = await queryDatabaseByDate({ databaseId, dayStr });
  if (existing?.id) {
    await notionRequest(`/pages/${existing.id}`, { method: 'PATCH', body: { properties: props } });
    return { action: 'updated', pageId: existing.id };
  }

  const created = await notionRequest('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: databaseId },
      properties: props
    }
  });
  return { action: 'created', pageId: created.id };
};

const upsertDailyUsageProduct = async ({ databaseId, dayStr, metrics }) => {
  const name = `Product Daily Usage ${dayStr}`;

  const props = {
    Name: { title: [{ type: 'text', text: { content: name } }] },
    Date: { date: { start: dayStr } },
    'Metrics Version': { select: { name: 'v2' } },

    Events: { number: metrics.eventsCount || 0 },
    Searches: { number: metrics.searches || 0 },

    'Marker Clicks': { number: metrics.markerClicks || 0 },
    'FocusBlock Impressions': { number: metrics.focusblockImpressions || 0 },
    'FocusBlock Latest Clicks': { number: metrics.focusblockLatestClicks || 0 },
    'FocusBlock Expand Toggles': { number: metrics.focusblockExpandToggles || 0 },
    'FocusBlock Show More': { number: metrics.focusblockShowMore || 0 },

    'Top Events': { rich_text: [{ type: 'text', text: { content: metrics.topEventsText || '' } }] },
    'Top Asset Types': { rich_text: [{ type: 'text', text: { content: metrics.topAssetTypesText || '' } }] },
    'Top Addresses': { rich_text: [{ type: 'text', text: { content: metrics.topAddressesText || '' } }] },
    'Top Projects': { rich_text: [{ type: 'text', text: { content: metrics.topProjectsText || '' } }] },

    Notes: { rich_text: [{ type: 'text', text: { content: metrics.notes || '' } }] }
  };

  const existing = await queryDatabaseByDate({ databaseId, dayStr });
  if (existing?.id) {
    await notionRequest(`/pages/${existing.id}`, { method: 'PATCH', body: { properties: props } });
    return { action: 'updated', pageId: existing.id };
  }

  const created = await notionRequest('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: databaseId },
      properties: props
    }
  });
  return { action: 'created', pageId: created.id };
};

export default async function handler(req, res) {
  // Allow Vercel cron OR manual triggering with SYNC_TOKEN
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
    const execDatabaseId = getEnv('SWY_NOTION_EXEC_DATABASE_ID') || '26c56f4d-0a45-4a08-92f3-5de95b212769';
    const productDatabaseId = getEnv('SWY_NOTION_PRODUCT_DATABASE_ID') || '8e89af54-e7d7-4103-ad50-1daa1125df8d';

    const dayStr = (req.query?.day && String(req.query.day)) || getYesterdayChicago();
    const { startIso, endIso } = dayRangeUtcFromChicagoDay(dayStr);

    const eventsCount = await supabaseCount('ui_events', { startIso, endIso });

    const uiRows = await supabaseRows('ui_events', {
      startIso,
      endIso,
      select: 'event_type,asset_type,project_id',
      limit: 50000
    });

    const byEvent = new Map();
    const byAsset = new Map();
    const byProject = new Map();
    for (const r of uiRows) {
      const e = r.event_type || 'null';
      byEvent.set(e, (byEvent.get(e) || 0) + 1);
      const a = r.asset_type || 'null';
      byAsset.set(a, (byAsset.get(a) || 0) + 1);
      if (r.project_id) byProject.set(String(r.project_id), (byProject.get(String(r.project_id)) || 0) + 1);
    }

    // sessions + searches (+ address list) from search_logs
    const searchRows = await supabaseRows('search_logs', {
      startIso,
      endIso,
      select: 'session_id,query_type,query,metadata,created_at',
      limit: 50000
    });

    const sessionsSet = new Set();
    let searches = 0;
    let addressSearches = 0;
    const byAddress = new Map();

    // user_id for returning + engagement bins
    const userEventsToday = new Map();

    for (const r of searchRows) {
      if (r.session_id) sessionsSet.add(r.session_id);
      if (r.query_type && r.query_type !== 'event') searches += 1;

      const uid = r?.metadata?.user_id ? String(r.metadata.user_id) : null;
      if (uid) userEventsToday.set(uid, (userEventsToday.get(uid) || 0) + 1);

      if (r.query_type === 'address') {
        addressSearches += 1;
        const q = (r.query || '').trim();
        if (q) byAddress.set(q, (byAddress.get(q) || 0) + 1);
      }
    }

    // returning users (seen in prior 7d)
    const lookbackStart = new Date(new Date(startIso).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const priorRows = await supabaseRows('search_logs', {
      startIso: lookbackStart,
      endIso: startIso,
      select: 'metadata',
      limit: 50000
    });
    const priorUsers = new Set();
    for (const r of priorRows) {
      const uid = r?.metadata?.user_id ? String(r.metadata.user_id) : null;
      if (uid) priorUsers.add(uid);
    }

    let returningUsers7d = 0;
    for (const uid of userEventsToday.keys()) {
      if (priorUsers.has(uid)) returningUsers7d += 1;
    }

    // engagement bins (based on search_logs rows per user today)
    let users1to2 = 0;
    let users3to9 = 0;
    let users10plus = 0;
    for (const n of userEventsToday.values()) {
      if (n <= 2) users1to2 += 1;
      else if (n <= 9) users3to9 += 1;
      else users10plus += 1;
    }

    const topEvents = topN(byEvent, 5);
    const topAssetTypes = topN(byAsset, 5);
    const topProjects = topN(byProject, 10);
    const topAddresses = topN(byAddress, 10);

    const normalizeAddress = (q) => String(q || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    // rebuild byAddress with normalization so Dallas/dallas collapse
    const byAddressNorm = new Map();
    for (const [k, v] of byAddress.entries()) {
      const nk = normalizeAddress(k);
      if (!nk) continue;
      byAddressNorm.set(nk, (byAddressNorm.get(nk) || 0) + v);
    }

    const fmtPairs = (pairs) => pairs.map(([k, v]) => `${k} (${v})`).join(', ');

    const topEventsText = buildTopText({ eventsCount, topEvents, topAssetTypes });
    const topAssetTypesText = topAssetTypes.length ? fmtPairs(topAssetTypes) : 'n/a';
    const topProjectsText = topProjects.length ? fmtPairs(topProjects) : 'n/a';
    const topAddressesText = topN(byAddressNorm, 10).length ? fmtPairs(topN(byAddressNorm, 10)) : 'n/a';

    const getCount = (key) => Number(byEvent.get(key) || 0);
    const focusblockImpressions = [...byEvent.entries()]
      .filter(([k]) => String(k).startsWith('focusblock.v1.impression'))
      .reduce((sum, [, v]) => sum + v, 0);
    const focusblockLatestClicks = [...byEvent.entries()]
      .filter(([k]) => String(k).startsWith('focusblock.v1.latest_signal_click'))
      .reduce((sum, [, v]) => sum + v, 0);
    const focusblockExpandToggles = [...byEvent.entries()]
      .filter(([k]) => String(k).startsWith('focusblock.v1.expand_toggle'))
      .reduce((sum, [, v]) => sum + v, 0);
    const focusblockShowMore = [...byEvent.entries()]
      .filter(([k]) => String(k).startsWith('focusblock.v1.show_more'))
      .reduce((sum, [, v]) => sum + v, 0);

    const execNotion = await upsertDailyUsageExec({
      databaseId: execDatabaseId,
      dayStr,
      metrics: {
        sessions: sessionsSet.size,
        searches,
        addressSearches,
        eventsCount,
        topProjectsText,
        returningUsers7d,
        users1to2,
        users3to9,
        users10plus
      }
    });

    const productNotion = await upsertDailyUsageProduct({
      databaseId: productDatabaseId,
      dayStr,
      metrics: {
        eventsCount,
        searches,
        markerClicks: getCount('marker_click'),
        focusblockImpressions,
        focusblockLatestClicks,
        focusblockExpandToggles,
        focusblockShowMore,
        topEventsText,
        topAssetTypesText,
        topAddressesText,
        topProjectsText
      }
    });

    return res.status(200).json({
      ok: true,
      mode: isCron ? 'cron' : 'manual',
      day: dayStr,
      range: { startIso, endIso },
      supabase: {
        ui_events: { count: eventsCount, topEvents, topAssetTypes },
        search_logs: { sessions: sessionsSet.size, searches }
      },
      notion: {
        exec: execNotion,
        product: productNotion
      }
    });
  } catch (error) {
    console.error('❌ /api/notion-sync-daily-usage error:', error);
    return jsonError(res, 500, 'Sync failed', { message: error.message });
  }
}
