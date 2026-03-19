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

const supabaseRows = async (table, { startIso, endIso, select, limit = 50000 } = {}) => {
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

const buildSessionName = (sessionId, ref, userName) => {
  const parts = [];
  if (userName) parts.push(userName);
  if (ref) parts.push(ref);
  parts.push(sessionId.slice(0, 8));
  return parts.join(' · ');
};

const toRichText = (value) => ({
  type: 'text',
  text: { content: String(value ?? '') }
});

const upsertNotionSession = async ({ databaseId, dataSourceId, dayStr, session }) => {
  const props = {
    Name: { title: [toRichText(buildSessionName(session.sessionId, session.ref, session.userName))] },
    Date: { date: { start: dayStr } },
    'Session ID': { rich_text: [toRichText(session.sessionId)] },
    Ref: { rich_text: [toRichText(session.ref || '')] },
    User: { rich_text: [toRichText(session.userName || '')] },
    'Intake Method': { rich_text: [toRichText(session.intakeMethod || '')] },
    Chip: { rich_text: [toRichText(session.chip || '')] },
    'Answer 1': { rich_text: [toRichText(session.answer1 || '')] },
    'Answer 2': { rich_text: [toRichText(session.answer2 || '')] },
    'Answer 3': { rich_text: [toRichText(session.answer3 || '')] },
    'Chat Turns': { number: session.chatTurns || 0 },
    'Seconds to CTA': { number: session.secondsToCta ?? null },
    'CTA Clicked': { checkbox: Boolean(session.ctaClicked) },
    'First Search': { rich_text: [toRichText(session.firstSearch || '')] },
    'Search Count': { number: session.searchCount || 0 },
    'Focus Clicks': { number: session.focusClicks || 0 },
    'Opposition Clicks': { number: session.oppositionClicks || 0 },
    'Top Project IDs': { rich_text: [toRichText(session.topProjectIds || '')] },
    Notes: { rich_text: [toRichText(session.notes || '')] }
  };

  // One row per session: upsert by Session ID.
  // Use data_sources query for reliability on Notion API v2025-09-03.
  const existing = await notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: {
      page_size: 5,
      filter: {
        property: 'Session ID',
        rich_text: { equals: session.sessionId }
      }
    }
  });

  const page = existing?.results?.[0];
  if (page?.id) {
    const updated = await notionRequest(`/pages/${page.id}`, {
      method: 'PATCH',
      body: { properties: props }
    });
    return { action: 'updated', pageId: updated.id, matched: existing?.results?.length || 1 };
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
    const sessionsDatabaseId =
      getEnv('SWY_NOTION_ACCESS_SESSIONS_DATABASE_ID') || getEnv('SWY_NOTION_ACCESS_DATABASE_ID');
    const sessionsDataSourceId =
      getEnv('SWY_NOTION_ACCESS_SESSIONS_DATA_SOURCE_ID') || getEnv('SWY_NOTION_ACCESS_DATA_SOURCE_ID');

    if (!sessionsDatabaseId || !sessionsDataSourceId) {
      return jsonError(res, 500, 'Missing Notion env vars', {
        required: [
          'SWY_NOTION_ACCESS_SESSIONS_DATABASE_ID (or SWY_NOTION_ACCESS_DATABASE_ID)',
          'SWY_NOTION_ACCESS_SESSIONS_DATA_SOURCE_ID (or SWY_NOTION_ACCESS_DATA_SOURCE_ID)'
        ]
      });
    }

    const dayStr = (req.query?.day && String(req.query.day)) || getYesterdayChicago();
    const { startIso, endIso } = dayRangeUtcFromChicagoDay(dayStr);

    // 1) Pull access_conversations for the day
    const convoRows = await supabaseRows('access_conversations', {
      startIso,
      endIso,
      select: 'session_id,ref,user_name,intake_method,chip_selected,user_message,assistant_reply,created_at'
    });

    // 2) Pull ui_events for the day (map behavior)
    const uiRows = await supabaseRows('ui_events', {
      startIso,
      endIso,
      select: 'event_type,access_session_id,project_id,query_text,meta_time_to_cta_ms,meta_time_from_cta_shown_ms,created_at'
    });

    // Group conversations by session_id
    const bySession = new Map();
    for (const row of convoRows) {
      const sessionId = String(row.session_id || '').trim();
      if (!sessionId) continue;
      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, {
          sessionId,
          ref: row.ref || '',
          userName: row.user_name || '',
          intakeMethod: row.intake_method || '',
          chip: row.chip_selected || '',
          messages: []
        });
      }
      const s = bySession.get(sessionId);
      s.messages.push({
        userMessage: row.user_message || '',
        assistantReply: row.assistant_reply || '',
        createdAt: row.created_at
      });
    }

    // Attach ui_events to sessions via access_session_id
    const uiBySession = new Map();
    for (const row of uiRows) {
      const sessionId = String(row.access_session_id || '').trim();
      if (!sessionId) continue;
      if (!uiBySession.has(sessionId)) {
        uiBySession.set(sessionId, []);
      }
      uiBySession.get(sessionId).push(row);
    }

    const sessions = [];

    for (const [sessionId, convo] of bySession.entries()) {
      const msgs = [...convo.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const chatTurns = msgs.length;

      const answer1 = msgs[0]?.userMessage || '';
      const answer2 = msgs[1]?.userMessage || '';
      const answer3 = msgs[2]?.userMessage || '';

      // Map activity
      const ui = uiBySession.get(sessionId) || [];
      const uiSorted = [...ui].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      let firstSearch = '';
      let searchCount = 0;
      let focusClicks = 0;
      let oppositionClicks = 0;
      const projectCounts = new Map();

      let secondsToCta = null;
      let ctaClicked = false;

      for (const ev of uiSorted) {
        const type = ev.event_type || '';

        if (type === 'search') {
          searchCount += 1;
          if (!firstSearch) {
            firstSearch = (ev.query_text && String(ev.query_text).trim()) || 'search';
          }
        }

        if (type === 'focusblock.v1.site_select' || type === 'focusblock.v1.expand_toggle') {
          focusClicks += 1;
        }

        if (
          type === 'opposition.cluster_open' ||
          type === 'opposition.nearby_click' ||
          type === 'opposition.blocked_click' ||
          type === 'opposition.sequence_click'
        ) {
          oppositionClicks += 1;
        }

        if (ev.project_id) {
          const pid = String(ev.project_id);
          projectCounts.set(pid, (projectCounts.get(pid) || 0) + 1);
        }

        if (type === 'access_cta_clicked') {
          ctaClicked = true;
          if (Number.isFinite(Number(ev.meta_time_to_cta_ms))) {
            secondsToCta = Math.round(Number(ev.meta_time_to_cta_ms) / 1000);
          }
        }
      }

      const topProjects = [...projectCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      sessions.push({
        sessionId,
        ref: convo.ref,
        userName: convo.userName,
        intakeMethod: convo.intakeMethod,
        chip: convo.chip,
        answer1,
        answer2,
        answer3,
        chatTurns,
        secondsToCta,
        ctaClicked,
        firstSearch,
        searchCount,
        focusClicks,
        oppositionClicks,
        topProjectIds: topProjects.join(', '),
        notes: ''
      });
    }

    const notionResults = [];
    for (const session of sessions) {
      try {
        const result = await upsertNotionSession({
          databaseId: sessionsDatabaseId,
          dataSourceId: sessionsDataSourceId,
          dayStr,
          session
        });
        notionResults.push({ sessionId: session.sessionId, result });
      } catch (err) {
        notionResults.push({
          sessionId: session.sessionId,
          error: err?.message || String(err)
        });
      }
    }

    return res.status(200).json({
      ok: true,
      mode: isCron ? 'cron' : 'manual',
      day: dayStr,
      range: { startIso, endIso },
      supabase: {
        access_conversations: convoRows.length,
        ui_events: uiRows.length,
        sessions: sessions.length
      },
      notion: notionResults
    });
  } catch (error) {
    console.error('❌ /api/notion-sync-access-sessions error:', error);
    return jsonError(res, 500, 'Sync failed', { message: error.message });
  }
}

