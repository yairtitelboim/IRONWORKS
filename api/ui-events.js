import crypto from 'crypto';

const ERROR_CACHE_CONTROL = 'no-store';

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const stableHash = (secret, text) => {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!normalized) return null;
  return crypto.createHash('sha256').update(`${secret}|${normalized}`).digest('hex');
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

const escapeHtml = (value) =>
  String(value ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));

const sendFeedbackEmail = async ({ email, message }) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL || 'onboarding@resend.dev';
  const toEmail = process.env.FEEDBACK_TO_EMAIL || 'titel.y@gmail.com';

  if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');
  if (!message) throw new Error('Feedback message is required');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45;">
      <h2 style="margin: 0 0 10px;">Switchyard Feedback</h2>
      <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(email || 'Not provided')}</p>
      <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
      <div style="padding: 10px; border: 1px solid #ddd; border-radius: 6px;">${escapeHtml(message).replace(/\n/g, '<br/>')}</div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: `Switchyard feedback${email ? ` from ${email}` : ''}`,
      html
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg = payload?.message || payload?.error || `Resend failed (${response.status})`;
    throw new Error(errMsg);
  }

  return payload?.id || null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      event_type,
      asset_type,
      county = null,
      state = null,
      zoom_level = null,
      query_text = null,
      project_id = null,
      access_session_id = null,
      center_lat = null,
      center_lon = null,
      feedback_email = '',
      feedback_message = ''
    } = req.body || {};

    if (!event_type) return res.status(400).json({ error: 'event_type is required' });

    if (event_type === 'feedback_contact') {
      const id = await sendFeedbackEmail({
        email: String(feedback_email || '').trim(),
        message: String(feedback_message || '').trim()
      });
      return res.status(200).json({ success: true, id });
    }

    const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
    if (!hasCredentials) {
      return res.status(500).json({
        error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
      });
    }

    const secret = process.env.UI_EVENTS_HASH_SECRET || process.env.SCANNER_CRON_TOKEN || '';
    if (!secret) {
      return res.status(500).json({
        error: 'UI_EVENTS_HASH_SECRET not configured'
      });
    }

    const normalizedQueryText =
      typeof query_text === 'string' ? query_text.trim() || null : null;
    const query_hash = normalizedQueryText ? stableHash(secret, normalizedQueryText) : null;

    const row = {
      event_type,
      asset_type: asset_type || null,
      county,
      state,
      query_text: normalizedQueryText,
      project_id: project_id ? String(project_id) : null,
      access_session_id: access_session_id ? String(access_session_id).trim() || null : null,
      zoom_level: Number.isFinite(Number(zoom_level)) ? Math.round(Number(zoom_level)) : null,
      query_hash,
      center_lat: Number.isFinite(Number(center_lat)) ? Number(center_lat) : null,
      center_lon: Number.isFinite(Number(center_lon)) ? Number(center_lon) : null
    };

    const sres = await fetch(`${supabaseUrl}/rest/v1/ui_events`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    });

    if (!sres.ok) {
      const errJson = await parseJson(sres);
      const message = errJson?.message || errJson?.error || `Supabase insert failed (${sres.status})`;
      throw new Error(message);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ /api/ui-events error:', error);
    return res.status(500).json({ error: 'Failed to log ui event', message: error.message });
  }
}
