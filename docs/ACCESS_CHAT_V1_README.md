# /access Chat (V1) — Build Plan (Phased w/ Gates)

**Goal (V1):** Add a mobile-first chat landing page at **`/access`** inside the existing PHA (Switchyard) codebase and deploy on the **same Vercel project + domain**.

- Single page, **no map**.
- Dark background, minimal UI.
- Chat input pinned to bottom.
- Messages render from top; assistant responses stream in.
- After ~2–3 exchanges (or when the bot decides it’s “done”), UI renders a **button linking to the main map**.
- Every turn is logged to Supabase in a new table: **`access_conversations`**.
- Page is accessed via DM links like: `https://switchyard-six.vercel.app/access?ref=li_dm&user=firstname`
  - `user` should appear in the assistant’s opening line.

**Non-goals (V1):**
- No map embedding on `/access`.
- No “tools” / browsing / external actions.
- No notion sync changes.
- No authentication system.

---

## Architecture (V1)

### Frontend
- New route: **`/access`** (React Router)
- New page component: `src/pages/AccessChat/AccessChatPage.jsx` (suggested)
- Minimal styling (prefer CSS module or a single CSS file)

### Backend
- New API route: **`/api/chat.js`** (Vercel Serverless Function)
- Calls a **normal LLM API** (OpenAI/Claude) using a system prompt provided by Yair.
- Returns streamed tokens (SSE) or a single JSON response (start w/ non-streaming if you want the absolute fastest path; streaming can be Phase 3).

### Data / Logging
- Supabase table: **`access_conversations`**
- Logging happens server-side inside `/api/chat.js` (don’t trust client logging).

---

## Phased Approach (with Gates)

### Phase 0 — Prep (Schema + keys) (Gate: "can log safely")

**Work:**
1. Add Supabase migration to create `access_conversations`.
2. Add env vars in Vercel.
3. Add RLS policy: allow **insert-only** via service key (no public reads).

**Schema (proposed):**
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `session_id text not null` (client-generated UUID)
- `ref text null` (e.g. `li_dm`)
- `user_name text null` (from query param)
- `turn_index int not null` (0..n)
- `role text not null` (`user`|`assistant`)
- `content text not null`
- `model text null`
- `done boolean not null default false`
- `meta jsonb not null default '{}'::jsonb` (optional: latency, token counts)

**Env vars:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `LLM_API_KEY` (provider-specific)
- `ACCESS_SYSTEM_PROMPT` (or store prompt in code for V1, but env is better for iteration)
- (optional) `ACCESS_DEFAULT_MODEL`

**Gate criteria:**
- Migration applied in Supabase.
- Insert works using service key from a serverless function.
- RLS prevents anonymous reads.

---

### Phase 1 — Minimal `/access` page (no chat yet) (Gate: "route works on prod")

**Work:**
1. Add React route `/access`.
2. Render a minimal static UI:
   - page title
   - placeholder chat area
   - fixed input bar
3. Parse query params `ref` + `user` and show `user` in a welcome line.

**Gate criteria:**
- `https://switchyard-six.vercel.app/access?ref=li_dm&user=Yair` renders correctly on mobile.
- No map/layers load.
- Lighthouse mobile perf reasonable (no giant bundles pulled in).

---

### Phase 2 — API route `/api/chat.js` (non-streaming) + logging (Gate: "end-to-end turns logged")

**Work:**
1. Implement `/api/chat.js`:
   - input: `{ session_id, ref, user, messages: [{role, content}] }`
   - server constructs final prompt:
     - system prompt (from env)
     - optionally inject first-name greeting behavior
   - call LLM provider (OpenAI/Claude).
   - output: `{ message: { role: 'assistant', content }, done: boolean }`
2. Logging:
   - insert each user turn + assistant turn into `access_conversations`.
   - store `turn_index`.
   - store `done` on assistant turns.

**Notes:**
- Keep the bot deterministic for V1: cap tokens, one follow-up question, short answers.
- If you want model-driven “done”, require the model to return JSON (see Phase 3). For v1, you can use a simple heuristic (after N turns => done).

**Gate criteria:**
- You can send a message from `/access`, get a response, and see two rows in Supabase (user + assistant).
- No keys leak to client.
- Basic rate limiting present (IP or session-based).

---

### Phase 3 — Streaming + "done" contract (Gate: "2–3 exchanges then CTA reliably")

**Work:**
1. Switch `/api/chat.js` to SSE streaming.
2. Add a strict response contract:
   - assistant must output a JSON object at the end (or use tool/structured output if supported):
     - `answer` (string)
     - `follow_up` (string, must end with `?`)
     - `done` (boolean)
     - `handoff_cta` (string, only when done)
3. Frontend renders:
   - streamed `answer`
   - follow-up question
   - when `done=true`, show "Open map" button.

**Gate criteria:**
- On mobile, assistant text visibly streams.
- Button appears consistently by turn 2–3.
- Supabase logs contain final assistant response + done flag.

---

### Phase 4 — Production polish + analytics loops (Gate: "operational")

**Work:**
1. Add alerting / monitoring:
   - if `/api/chat.js` errors > threshold, email alert (reuse Resend pattern).
2. Add daily aggregation query (optional):
   - sessions count, conversion to map click (requires logging CTA click event).
3. Add lightweight spam protection:
   - turn cap per session
   - per-IP request cap

**Gate criteria:**
- No spam runaway costs.
- Conversion is measurable.
- Error alerts tested.

---

## Implementation Notes (keep it "quick and easy")

### UI behavior
- Start with a single assistant opening message using `user` param:
  - Example: "{user}, tell me what part of Texas you’re underwriting and what the constraint is — power, gas, or land."
- Hard-cap the chat to 3 assistant turns in v1 if you want certainty.

### Logging strategy
- Log on server only.
- Treat `session_id` as the join key for a conversation.
- Store `ref` and `user_name` redundantly on every row (simplifies querying).

### Security
- `/api/chat.js` must never expose:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - raw provider keys
- RLS: insert-only from service key; no client reads.

---

## Acceptance Checklist (V1)

- [ ] `/access` route exists, no map loads
- [ ] `/api/chat.js` exists, returns assistant responses
- [ ] Supabase `access_conversations` table exists
- [ ] Each turn inserts rows (user + assistant)
- [ ] After 2–3 exchanges, CTA button appears linking to `/` (map)
- [ ] Works on production domain

---

## Future (not V1)
- Persist conversation context into map (e.g. auto-focus market)
- Auth + lead capture
- Retrieval over your proprietary dataset (RAG) instead of pure prompt
- Admin dashboard for transcripts + conversion
