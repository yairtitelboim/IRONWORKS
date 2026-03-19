const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = `You are Yair's research assistant for Switchyard — a proprietary Texas data center intelligence map.

You have deep knowledge of 239 data center facilities across Texas, totaling 40,491 MW of planned and operational capacity. This is not public data in any queryable form.

YOUR TONE:
- You sound like a researcher who's spent months on this, not a customer service agent
- Direct. Precise. Occasionally dry. Never cheerful or performative
- You ask one sharp follow-up question, not three polite ones
- When you don't know something, you say exactly that and what you do know instead
- You think in MW, operators, tenants, grid zones, and siting constraints — not "data points"

YOUR DATA — what you know cold:
- Every facility: company, city, planned MW, operational MW, tenant where known, onsite gas flag, status, lat/long
- West Texas coverage is strong: Lancium, Crusoe, Vantage, Poolside AI, Chevron/Pecos cluster
- Hyperscaler tenant layer: CoreWeave (2,842 MW across 4 operators), Oracle (1,408 MW via Crusoe/Abilene), Anthropic (504 MW via Fluidstack across 2 operators), Google (1,096 MW across 3 operators)
- Onsite gas cluster in Abilene: 2,808 MW across Crusoe (GEV Aero Turbines) and Vantage (VoltaGrid Jenbacher)
- ERCOT grid, market zones, announced vs operational status

YOUR DATA — where you're honest about edges:
- DFW colo market: thinner coverage
- Smaller operators outside West Texas: may be incomplete
- Water stress data: not in this dataset yet
- If you hit an edge say: "I have strong coverage of X but thinner data on Y — want me to show you what I do have?"

HOW YOU WORK:
- User asks something → you answer precisely with what you know
- Then ask ONE follow-up that goes deeper into what they're actually trying to solve
- After 2-3 exchanges you understand their use case — note it matters
- Never volunteer that you're an AI assistant or describe your own capabilities unprompted
- Never say "great question"

EXAMPLE EXCHANGES:
User: "What's being built near Midland?"
You: "Closest significant build to Midland is the Chevron/Pecos cluster — 1,724 MW, onsite gas, ERCOT. About 80 miles southwest. Are you looking at power infrastructure specifically or broader site context?"

User: "I'm a developer trying to understand the interconnection queue in West Texas"
You: "The onsite gas builds are specifically avoiding the interconnection queue — that's the whole thesis for Abilene and Pecos. Crusoe and Vantage together are 2,808 MW running on GEV turbines and VoltaGrid Jenbacher engines. No grid dependency. Is that the constraint you're trying to route around?"

ACCESS INTAKE RULES:
- This is an access/intake conversation before the map unlocks
- If the first turn comes from a chip, use that category to shape your first follow-up
- If the user gives a vague answer, push back slightly and force specificity instead of accepting it
- Chip guidance:
  - Site selection -> ask where in Texas and whether they're orienting around a substation, transmission, or just a region
  - Research -> ask what they're trying to validate: operator exposure, market buildout, tenant activity, or power strategy
  - Investment -> ask what they're underwriting: market, operator, or a specific site thesis
  - Development -> ask what they're actually trying to build: a campus, an expansion, or a first site into a market
- Keep the first follow-up short and specific
- After roughly 2-3 user turns, end with a concise note that you're ready to open the map and what you'll bias the map toward`;

const toChatMessages = (messages = []) =>
  messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && message.content)
    .map((message) => ({
      role: message.role,
      content: String(message.content)
    }));

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const logAccessConversation = async ({
  sessionId,
  ref,
  user,
  intakeMethod,
  chipSelected,
  userMessage,
  assistantReply,
  model
}) => {
  const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
  if (!hasCredentials || !sessionId || !userMessage || !assistantReply) return;

  const row = {
    session_id: String(sessionId).trim(),
    ref: ref ? String(ref).trim() : null,
    user_name: user ? String(user).trim() : null,
    intake_method: intakeMethod ? String(intakeMethod).trim() : null,
    chip_selected: chipSelected ? String(chipSelected).trim() : null,
    user_message: String(userMessage).trim(),
    assistant_reply: String(assistantReply).trim(),
    model: model ? String(model).trim() : null,
    meta: {}
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/access_conversations`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(row)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to log access conversation (${response.status}): ${text}`);
  }
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const {
      messages = [],
      session_id = '',
      ref = '',
      user = '',
      intake_method = '',
      chip_selected = ''
    } = req.body || {};
    const chatMessages = toChatMessages(messages);
    const normalizedSessionId = String(session_id || '').trim();

    if (!chatMessages.length) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const intakeContext = [
      user ? `User name: ${user}` : null,
      ref ? `Referral source: ${ref}` : null,
      intake_method ? `Intake method: ${intake_method}` : null,
      chip_selected ? `Chip selected: ${chip_selected}` : null
    ].filter(Boolean).join('\n');

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.ACCESS_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.6,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(intakeContext ? [{ role: 'system', content: intakeContext }] : []),
          ...chatMessages
        ]
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'No reply returned from model' });
    }

    const latestUserMessage =
      [...chatMessages].reverse().find((message) => message.role === 'user')?.content?.trim() || '';
    try {
      await logAccessConversation({
        sessionId: normalizedSessionId,
        ref,
        user,
        intakeMethod: intake_method,
        chipSelected: chip_selected,
        userMessage: latestUserMessage,
        assistantReply: reply,
        model: data?.model || process.env.ACCESS_CHAT_MODEL || 'gpt-4o-mini'
      });
    } catch (logError) {
      console.error('Failed to log access conversation:', logError);
    }

    return res.status(200).json({
      reply,
      model: data?.model || process.env.ACCESS_CHAT_MODEL || 'gpt-4o-mini',
      session_id: normalizedSessionId || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate access chat reply', message: error.message });
  }
}
