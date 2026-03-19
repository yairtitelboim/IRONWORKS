import fs from 'fs';

const loadEnvFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return;
    const txt = fs.readFileSync(filePath, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2] ?? '';
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] == null) process.env[k] = v;
    }
  } catch {
    // ignore
  }
};

// Load local env files (so running this script locally works without exporting vars)
loadEnvFile(new URL('../.env.local', import.meta.url).pathname);
loadEnvFile(new URL('../.env', import.meta.url).pathname);
loadEnvFile(new URL('../.env.production.local', import.meta.url).pathname);

const GEOJSON_PATH = new URL('../public/data/texas_data_centers.geojson', import.meta.url).pathname;
const OUT_PATH = new URL('../staging/texas_data_centers_enrichment_active.json', import.meta.url).pathname;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const firstParagraph = (text) => {
  const t = String(text || '').trim();
  if (!t) return '';
  const parts = t.split(/\n\s*\n/);
  return String(parts[0] || t).trim().slice(0, 1200);
};

const normalizeToIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const buildPrompt = ({ feature }) => {
  const p = feature?.properties || {};
  const inputs = {
    project_id: p.project_id || null,
    project_name: p.project_name || null,
    article_title: p.article_title || null,
    source_url: p.source_url || null,
    company: p.company || null,
    location: p.location || null,
    existing_announced_date: p.announced_date || null,
    existing_status: p.status || null,
    existing_probability_score: p.probability_score || null,
    existing_size_mw: p.size_mw ?? null,
    existing_size_acres: p.size_acres ?? null,
    existing_size_sqft: p.size_sqft ?? null,
    source_count: p.source_count ?? null
  };

  return `You are an OSINT enrichment assistant for a Texas data center projects dataset.

Goal: Fill missing or low-quality fields using provided metadata and evidence snippets.

Return ONLY valid JSON (no markdown, no code fences, no extra keys).

Return JSON with exactly these keys:
{
  "announced_date": null,
  "status": null,
  "probability_score": null,
  "size_mw": null,
  "extraction_confidence": 0.0,
  "evidence": {
    "announced_date": null,
    "status": null,
    "probability_score": null,
    "size_mw": null,
    "urls": []
  }
}

Allowed values:
- status: "active" | "under construction" | "speculative" | "cancelled" | null
- probability_score: "high" | "medium" | "low" | null
- announced_date: ISO-8601 date/time string when possible, else null
- size_mw: number (MW) or null
- extraction_confidence: number 0.0-1.0

Rules:
- Use only information supported by evidence. If not supported, return null for that field.
- Prefer primary sources (the provided source_url page) when available.
- announced_date should reflect when the project was announced/reported (article publish date is acceptable if it’s clearly tied to the project and no better date exists).
- If the project seems planned/proposed with no construction, status should be "speculative".
- If the project is halted/withdrawn/rejected, status should be "cancelled".
- If status indicates in service/operational, use "active".
- If construction/groundbreaking is mentioned, use "under construction".
- probability_score is about likelihood of progressing (not about being real). If already active/under construction, usually high.

Inputs:
${JSON.stringify(inputs, null, 2)}

Evidence snippets (may be empty):
SOURCE_URL_SNIPPET:
{{SOURCE_URL_SNIPPET}}

SEARCH_SNIPPETS:
{{SEARCH_SNIPPETS}}`;
};

const fetchText = async (url) => {
  if (!url) return '';
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwitchyardEnricher/1.0)' },
      signal: controller.signal
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const html = await res.text();
    // crude extraction: strip tags
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
  } catch {
    return '';
  }
};

const tavilySearch = async (query) => {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'advanced',
        max_results: 5,
        days: 3650
      })
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) return [];
    const items = Array.isArray(j?.results) ? j.results : [];
    return items.map((r) => ({
      title: r?.title || null,
      url: r?.url || null,
      snippet: r?.content || null,
      published_date: r?.published_date || r?.publishedDate || null
    }));
  } catch {
    return [];
  }
};

const extractJsonObjectFromText = (text) => {
  const t = String(text || '').trim();
  if (!t) return null;
  const withoutFences = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
};

const gemini = async (prompt) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');

  const resp = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json'
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })
  });

  const data = await resp.json();
  const candidate = data?.candidates?.[0] || null;
  const finishReason = candidate?.finishReason || null;
  const textOut = candidate?.content?.parts?.[0]?.text || '';
  if (!resp.ok) throw new Error(`Gemini error ${resp.status}: ${JSON.stringify(data).slice(0, 200)}`);

  const jsonText = extractJsonObjectFromText(textOut) || textOut;
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    const snippet = String(jsonText).slice(0, 240);
    const len = String(jsonText).length;
    throw new Error(`JSON.parse failed: ${e.message} (finishReason=${finishReason}, len=${len}) :: ${snippet}`);
  }
};

const main = async () => {
  fs.mkdirSync(new URL('../staging', import.meta.url).pathname, { recursive: true });

  const geo = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const feats = Array.isArray(geo.features) ? geo.features : [];
  const active = feats.filter((f) => String(f?.properties?.status || '').trim() === 'active');

  const results = [];

  for (let i = 0; i < active.length; i++) {
    const feature = active[i];
    const p = feature.properties || {};

    const qParts = [p.project_name, p.company, p.location, p.article_title].filter(Boolean);
    const query = qParts.join(' ');

    const sourceUrlSnippet = firstParagraph(await fetchText(p.source_url));
    const search = await tavilySearch(query);
    const searchSnippets = search
      .map((r, idx) => `(${idx + 1}) ${r.title || ''}\n${r.url || ''}\n${(r.snippet || '').slice(0, 500)}\npublished_date: ${r.published_date || ''}`)
      .join('\n\n')
      .slice(0, 3500);

    let prompt = buildPrompt({ feature });
    prompt = prompt
      .replace('{{SOURCE_URL_SNIPPET}}', sourceUrlSnippet || '')
      .replace('{{SEARCH_SNIPPETS}}', searchSnippets || '');

    let extracted = null;
    let error = null;
    try {
      extracted = await gemini(prompt);
    } catch (e) {
      error = e?.message || String(e);
    }

    const out = {
      project_id: p.project_id || null,
      project_name: p.project_name || null,
      source_url: p.source_url || null,
      article_title: p.article_title || null,
      company: p.company || null,
      location: p.location || null,
      extracted,
      error,
      debug: {
        query,
        evidence_urls: [p.source_url, ...(search.map((s) => s.url))].filter(Boolean).slice(0, 6),
        source_url_snippet_len: sourceUrlSnippet.length,
        search_results_count: search.length
      }
    };

    // normalize announced_date if it looks like a date
    if (out.extracted?.announced_date) {
      out.extracted.announced_date_iso = normalizeToIso(out.extracted.announced_date);
    }

    results.push(out);

    // gentle pacing
    await sleep(600);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    count: results.length,
    results
  }, null, 2));

  console.log(`Wrote ${results.length} records to ${OUT_PATH}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
