import crypto from 'crypto';

const ERROR_CACHE_CONTROL = 'no-store';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

const stableId = (input) => crypto.createHash('sha256').update(String(input || '')).digest('hex').slice(0, 16);

const normalizeToIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const firstParagraph = (text) => {
  const t = String(text || '').trim();
  if (!t) return '';
  const parts = t.split(/\n\s*\n/);
  return String(parts[0] || t).trim().slice(0, 800);
};

const buildGeminiExtractionPrompt = ({ headline, first_paragraph }) => {
  return `You are an information extraction system for Texas data-center news signals.

Task: Extract structured fields from the text below.

Return ONLY valid JSON. No markdown. No code fences. No commentary.

JSON schema (must match exactly):
{
  "extracted_county": string | null,
  "extracted_company": string[],
  "extracted_project": string | null,
  "extraction_confidence": number
}

Field definitions:
- extracted_county: Texas county name if explicitly present. Return just the county name without the word "County" (e.g., "Bastrop", not "Bastrop County"). If multiple counties are mentioned, pick the primary one most directly tied to the data center/project described. If none, null.
- extracted_company: Array of organization/company/operator/developer names explicitly present. Proper names only. Do NOT include generic terms ("data center", "facility", "project", "Texas", "county", "city", "ERCOT"). If none, return [].
- extracted_project: A specific project/campus/site name if explicitly present (e.g., a named campus, a branded site, or a clearly named project). If the text only refers generically to “a data center” with no name, return null.
- extraction_confidence: Float from 0.0 to 1.0 representing confidence in the overall extraction.

Rules:
- Use only information supported by the text. Do not guess.
- Do not invent counties/companies/projects.
- If a field is uncertain, prefer null/[] and lower confidence.
- Confidence guidance:
  - >= 0.85 only when at least two fields are clearly supported by the text
  - 0.50–0.84 when exactly one field is clearly supported or mentions are weak/ambiguous
  - < 0.50 when nothing reliable is present

Text to extract from:
HEADLINE:
${String(headline || '').trim()}

FIRST_PARAGRAPH:
${String(first_paragraph || '').trim()}`;
};

const extractJsonObjectFromText = (text) => {
  const t = String(text || '').trim();
  if (!t) return null;

  // Strip common markdown code fences.
  const withoutFences = t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
};

const extractWithGeminiFlash = async ({ headline, raw_text }) => {
  // Soft-fail: enrichment must never take the pipeline down.
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  const fp = firstParagraph(raw_text);
  if (!headline && !fp) return null;

  const prompt = buildGeminiExtractionPrompt({ headline, first_paragraph: fp });

  try {
    const resp = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: 'application/json'
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });

    const data = await resp.json().catch(() => null);
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!resp.ok || !textOut) return null;

    const jsonText = extractJsonObjectFromText(textOut);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText);
    return {
      extracted_county: parsed?.extracted_county ?? null,
      extracted_company: Array.isArray(parsed?.extracted_company) ? parsed.extracted_company : [],
      extracted_project: parsed?.extracted_project ?? null,
      extraction_confidence: Number(parsed?.extraction_confidence)
    };
  } catch {
    return null;
  }
};

const extractPublishedAtFromHtml = (html) => {
  if (!html) return null;

  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']publishdate["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']timestamp["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const iso = normalizeToIso(m[1]);
      if (iso) return iso;
    }
  }

  // JSON-LD datePublished
  const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatches?.length) {
    for (const block of ldMatches) {
      const m = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      const raw = m?.[1]?.trim();
      if (!raw) continue;
      try {
        const json = JSON.parse(raw);
        const nodes = Array.isArray(json) ? json : [json];
        for (const n of nodes) {
          const iso = normalizeToIso(n?.datePublished);
          if (iso) return iso;
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
};

const fetchArticlePublishedAt = async (url) => {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SwitchyardScanner/1.0)'
      },
      signal: controller.signal
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    return extractPublishedAtFromHtml(html);
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return res.status(500).json({ error: 'TAVILY_API_KEY not configured' });

  const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
  if (!hasCredentials) {
    return res.status(500).json({ error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
    const { query, days = 7, maxResults = 10 } = req.body || {};
    const searchQuery = query || '"data center" (moratorium OR lawsuit OR zoning) Texas';

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: searchQuery,
        search_depth: 'advanced',
        max_results: maxResults,
        days
      })
    });

    const tavilyJson = await parseJson(tavilyRes);
    if (!tavilyRes.ok) {
      const message = tavilyJson?.message || tavilyJson?.error || `Tavily error (${tavilyRes.status})`;
      throw new Error(message);
    }

    const results = Array.isArray(tavilyJson?.results) ? tavilyJson.results : [];

    const nowIso = new Date().toISOString();

    const rows = [];
    for (const r of results) {
      const url = r?.url || null;
      const title = r?.title || r?.content?.slice?.(0, 120) || 'News item';

      // Prefer Tavily's published_date if present; otherwise try to extract from the article.
      let publishedAt = normalizeToIso(r?.published_date || r?.publishedDate || null);
      if (!publishedAt && url) {
        publishedAt = await fetchArticlePublishedAt(url);
      }

      // Enrichment: extract county/company/project from headline + first paragraph.
      // Must happen after normalization but before write. Soft-fail on any enrichment errors.
      const extraction = await extractWithGeminiFlash({
        headline: title,
        raw_text: r?.content || null
      });

      // IMPORTANT: keep ids stable even if published_at is discovered later.
      const base = url || title;

      rows.push({
        signal_id: stableId(`tavily|${base}`),
        ingested_at: nowIso,
        published_at: publishedAt,
        source_type: 'TAVILY',
        source_name: 'Tavily',
        source_id: url,
        url,
        headline: title,
        raw_text: r?.content || null,
        extracted_county: extraction?.extracted_county ?? null,
        extracted_company: extraction?.extracted_company ?? null,
        extracted_project: extraction?.extracted_project ?? null,
        extraction_confidence:
          Number.isFinite(extraction?.extraction_confidence) ? extraction.extraction_confidence : null,
        status: 'NEW',
        lane: 'CONTEXT',
        change_type: 'NEW',
        raw_payload: r || null
      });
    }

    if (rows.length) {
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/scanner_signals?on_conflict=signal_id`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      });

      if (!upsertRes.ok) {
        const errJson = await parseJson(upsertRes);
        const message = errJson?.message || errJson?.error || `Supabase upsert failed (${upsertRes.status})`;
        throw new Error(message);
      }

      const snapshotRow = {
        snapshot_id: stableId(`tavily|${searchQuery}|${Date.now()}`),
        source_type: 'TAVILY',
        query: searchQuery,
        captured_at: nowIso,
        raw_payload: tavilyJson
      };

      await fetch(`${supabaseUrl}/rest/v1/scanner_source_snapshots?on_conflict=snapshot_id`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(snapshotRow)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'NEWS ingestion completed',
      query: searchQuery,
      daysFilter: days,
      signalsFound: results.length,
      signalsStored: rows.length
    });
  } catch (error) {
    console.error('❌ /api/scanner-ingest-news error:', error);
    return res.status(500).json({
      error: 'Failed to trigger NEWS ingestion',
      message: error.message
    });
  }
}
