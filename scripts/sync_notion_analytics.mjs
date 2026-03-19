#!/usr/bin/env node

/**
 * Sync Switchyard usage analytics from Supabase -> Notion (Daily Usage database).
 *
 * Reads:
 *  - PHA/.env.local: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY
 *  - ~/.config/notion/api_key
 *
 * Writes:
 *  - Notion database rows (one per day) into the Daily Usage database.
 */

import fs from 'node:fs';
import path from 'node:path';

const NOTION_VERSION = '2025-09-03';
const DAILY_USAGE_DATABASE_ID = 'aa249a2c-9bca-479a-bf6f-aed59a801a09';
// Notion 2025-09-03+: querying uses the data_source id
const DAILY_USAGE_DATA_SOURCE_ID = 'f3bf08cb-699a-4709-86ca-5f8e002415a4';

function readEnvFile(envPath) {
  const out = {};
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

function isoDay(iso) {
  // iso: 2026-02-27T20:52:03.52096+00:00
  return String(iso).slice(0, 10);
}

async function notionFetch(url, { method = 'GET', body } = {}) {
  const notionKey = fs.readFileSync(path.join(process.env.HOME, '.config/notion/api_key'), 'utf8').trim();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${notionKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Notion ${method} ${url} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function supabaseFetchJson(url, anonKey) {
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase GET ${url} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function loadEvents({ supabaseUrl, supabaseAnonKey, days = 14 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const url = `${supabaseUrl}/rest/v1/search_logs?select=created_at,session_id,query,query_type,source,metadata&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=10000`;
  return supabaseFetchJson(url, supabaseAnonKey);
}

function aggregate(events) {
  // day -> buckets
  const byDay = new Map();
  const sessionDayEvents = new Map(); // `${day}::${session}` -> Set(eventName)

  const ensure = (day) => {
    if (!byDay.has(day)) {
      byDay.set(day, {
        sessions: new Set(),
        events: 0,
        searches: 0,
        activatedSessions: new Set(),
        oppositionViewedSessions: new Set(),
        verdictViewedSessions: new Set(),
        oppositionTileOpens: 0,
        clusterMapOpens: 0,
        nearbySiteClicks: 0,
        powerCircleActivations: 0,
        layerToggles: 0,
        sharesCopied: 0,
        aiFailures: 0,
        topEvents: new Map(),
      });
    }
    return byDay.get(day);
  };

  for (const row of events) {
    const day = isoDay(row.created_at);
    const bucket = ensure(day);
    const sessionId = row.session_id || 'unknown';
    bucket.sessions.add(sessionId);

    if (row.query_type === 'event') {
      bucket.events += 1;
      const name = row.query || 'unknown_event';
      bucket.topEvents.set(name, (bucket.topEvents.get(name) || 0) + 1);

      const key = `${day}::${sessionId}`;
      if (!sessionDayEvents.has(key)) sessionDayEvents.set(key, new Set());
      sessionDayEvents.get(key).add(name);

      // Counters / session sets
      if (name === 'opposition_section_viewed') bucket.oppositionViewedSessions.add(sessionId);
      if (name === 'verdict_section_viewed') bucket.verdictViewedSessions.add(sessionId);

      if (name === 'opposition_cluster_toggled' || name === 'opposition_blocked_toggled' || name === 'opposition_sequence_toggled') {
        const expanded = row?.metadata?.expanded;
        if (expanded === true) bucket.oppositionTileOpens += 1;
      }

      if (name === 'opposition_cluster_action_clicked' || name === 'carousel_full_opposition_opened') bucket.clusterMapOpens += 1;
      if (name === 'nearby_site_clicked') bucket.nearbySiteClicks += 1;
      if (name === 'power_circle_activated') bucket.powerCircleActivations += 1;
      if (name === 'layer_toggled') bucket.layerToggles += 1;
      if (name === 'carousel_finding_copied' || name === 'share_copied') bucket.sharesCopied += 1;
      if (name === 'ai_insights_failed' || name === 'UNHANDLED_ERROR' || name === 'UNHANDLED_PROMISE_REJECTION') bucket.aiFailures += 1;
    }

    if (row.query_type === 'address' || row.query_type === 'perplexity') {
      bucket.searches += 1;
    }
  }

  // activated = location_search_card_status_seen + (nearby_site_clicked OR power_circle_activated)
  for (const [key, set] of sessionDayEvents.entries()) {
    const [day, sessionId] = key.split('::');
    const activated = set.has('location_search_card_status_seen') && (set.has('nearby_site_clicked') || set.has('power_circle_activated'));
    if (activated) byDay.get(day)?.activatedSessions.add(sessionId);
  }

  const rows = [];
  for (const [day, bucket] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sessions = bucket.sessions.size;
    const activated = bucket.activatedSessions.size;
    const activationRate = sessions > 0 ? activated / sessions : 0;
    const top = [...bucket.topEvents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topText = top.map(([name, count]) => `${name} (${count})`).join(' · ');

    rows.push({
      day,
      name: day,
      sessions,
      events: bucket.events,
      searches: bucket.searches,
      activatedSessions: activated,
      activationRate,
      oppositionViewedSessions: bucket.oppositionViewedSessions.size,
      verdictViewedSessions: bucket.verdictViewedSessions.size,
      oppositionTileOpens: bucket.oppositionTileOpens,
      clusterMapOpens: bucket.clusterMapOpens,
      nearbySiteClicks: bucket.nearbySiteClicks,
      powerCircleActivations: bucket.powerCircleActivations,
      layerToggles: bucket.layerToggles,
      sharesCopied: bucket.sharesCopied,
      aiFailures: bucket.aiFailures,
      topEvents: topText,
    });
  }
  return rows;
}

async function findExistingByDate(day) {
  // Query database by Date property equals day
  const body = {
    filter: {
      property: 'Date',
      date: { equals: day }
    },
    page_size: 1
  };
  const result = await notionFetch(`https://api.notion.com/v1/data_sources/${DAILY_USAGE_DATA_SOURCE_ID}/query`, { method: 'POST', body });
  return result.results?.[0] || null;
}

async function upsertRow(row) {
  const existing = await findExistingByDate(row.day);
  const props = {
    Name: { title: [{ type: 'text', text: { content: row.name } }] },
    Date: { date: { start: row.day } },
    Sessions: { number: row.sessions },
    Events: { number: row.events },
    Searches: { number: row.searches },
    'Activated Sessions': { number: row.activatedSessions },
    'Activation Rate': { number: row.activationRate },
    'Opposition Viewed Sessions': { number: row.oppositionViewedSessions ?? 0 },
    'Verdict Viewed Sessions': { number: row.verdictViewedSessions ?? 0 },
    'Opposition Tile Opens': { number: row.oppositionTileOpens ?? 0 },
    'Cluster Map Opens': { number: row.clusterMapOpens ?? 0 },
    'Nearby Site Clicks': { number: row.nearbySiteClicks ?? 0 },
    'Power Circle Activations': { number: row.powerCircleActivations ?? 0 },
    'Layer Toggles': { number: row.layerToggles ?? 0 },
    'Shares Copied': { number: row.sharesCopied ?? 0 },
    'AI Failures': { number: row.aiFailures ?? 0 },
    'Top Events': { rich_text: row.topEvents ? [{ type: 'text', text: { content: row.topEvents } }] : [] },
  };

  if (existing) {
    await notionFetch(`https://api.notion.com/v1/pages/${existing.id}`, { method: 'PATCH', body: { properties: props } });
    return { action: 'updated', id: existing.id };
  }

  const created = await notionFetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    body: {
      parent: { database_id: DAILY_USAGE_DATABASE_ID },
      properties: props,
    },
  });
  return { action: 'created', id: created.id };
}

function shouldRunNow() {
  // Toggle behavior with env var:
  //   NOTION_SYNC_MODE=weekly|hourly
  //
  // The scheduler can run hourly forever; weekly mode simply no-ops except in a small window.
  const mode = String(process.env.NOTION_SYNC_MODE || 'weekly').toLowerCase();
  if (mode === 'hourly') return { ok: true, mode };

  // Weekly mode: run only Mondays 09:00-09:10 UTC (adjust if you want a different window).
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const hour = now.getUTCHours();
  const min = now.getUTCMinutes();
  const inWindow = day === 1 && hour === 9 && min < 10;
  return { ok: inWindow, mode };
}

async function main() {
  const runCheck = shouldRunNow();
  if (!runCheck.ok) {
    process.stdout.write(`Skip (mode=${runCheck.mode})\n`);
    return;
  }

  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const env = readEnvFile(envLocalPath);
  const supabaseUrl = env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in .env.local');
  }

  const days = Number(process.env.DAYS || (String(process.env.NOTION_SYNC_MODE || 'weekly').toLowerCase() === 'weekly' ? 7 : 14));
  const events = await loadEvents({ supabaseUrl, supabaseAnonKey, days });
  const rows = aggregate(events);

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const result = await upsertRow(row);
    if (result.action === 'created') created += 1;
    else updated += 1;
    process.stdout.write(`${result.action}: ${row.day} (${result.id})\n`);
  }
  process.stdout.write(`Done. mode=${runCheck.mode} created=${created} updated=${updated} days=${rows.length}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
