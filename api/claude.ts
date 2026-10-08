import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-side proxy to the Claude API. The browser never sees ANTHROPIC_API_KEY.
 * Every request must carry a valid Supabase access token.
 *
 * Request body:
 *   tier       'fast' | 'smart'   which model tier to use (mapped server-side)
 *   system     optional system prompt
 *   messages   [{ role: 'user' | 'assistant', content: string | blocks[] }]
 *   maxTokens  optional, capped at MAX_TOKENS_CAP
 *   webSearch  optional, enables Claude's web search tool
 *   schema     optional JSON schema; response is then guaranteed to match it
 *              (ignored when webSearch is on - citations can't be combined with it)
 */

const MODELS: Record<string, { model: string; effort: 'low' | 'medium' | 'high' }> = {
  fast: { model: process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5', effort: 'low' },
  smart: { model: process.env.CLAUDE_MODEL_SMART || 'claude-sonnet-5-5', effort: 'medium' },
};

const MAX_TOKENS_CAP = 16000;
const MAX_BODY_BYTES = 600_000;
const MAX_MESSAGES = 40;
const MAX_PAUSE_RESUMES = 4;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };

export const config = { maxDuration: 300 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Best-effort per-instance limiter. Serverless instances don't share memory, so
// this only blunts bursts; the real cost guard is auth + the token caps above.
const hits = new Map<string, number[]>();
const rateLimited = (userId: string) => {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter(t => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT.max;
};

const authenticate = async (request: Request): Promise<string | null> => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === 'string' ? user.id : null;
};

const validMessages = (messages: unknown): messages is Anthropic.MessageParam[] => {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  return messages.every(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false;
    if (typeof m.content === 'string') return true;
    return Array.isArray(m.content) && m.content.every((b: any) =>
      b?.type === 'text' ||
      (b?.type === 'image' && b.source?.type === 'base64' &&
        ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.source.media_type))
    );
  });
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY is not configured on the server.' });

  const userId = await authenticate(request);
  if (!userId) return json(401, { error: 'Not authenticated.' });
  if (rateLimited(userId)) return json(429, { error: 'Too many requests. Please slow down.' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large.' });

  let body: any;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON.' }); }

  const tier = MODELS[body.tier];
  if (!tier) return json(400, { error: 'Unknown tier.' });
  if (!validMessages(body.messages)) return json(400, { error: 'Invalid messages.' });
  if (body.system !== undefined && typeof body.system !== 'string') return json(400, { error: 'Invalid system prompt.' });

  const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 8000, 256), MAX_TOKENS_CAP);
  const webSearch = body.webSearch === true;
  const useSchema = !!body.schema && typeof body.schema === 'object' && !webSearch;

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...body.messages];

  try {
    let final: Anthropic.Message | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    // Web search can end a turn with pause_turn; resume until the model is done.
    for (let i = 0; i <= MAX_PAUSE_RESUMES; i++) {
      const stream = client.messages.stream({
        model: tier.model,
        max_tokens: maxTokens,
        ...(body.system ? { system: body.system } : {}),
        messages,
        output_config: {
          effort: tier.effort,
          ...(useSchema ? { format: { type: 'json_schema', schema: body.schema } } : {}),
        },
        ...(webSearch ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] } : {}),
      } as Anthropic.MessageStreamParams);
      final = await stream.finalMessage();
      inputTokens += final.usage.input_tokens;
      outputTokens += final.usage.output_tokens;
      if (final.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: final.content });
    }

    if (!final) return json(502, { error: 'No response from model.' });
    if (final.stop_reason === 'refusal') return json(422, { error: 'The model declined this request.' });

    // Keep only text produced after the last tool step, so any "let me search..."
    // narration doesn't end up in front of the JSON/article payload.
    let text = '';
    for (const block of final.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type !== 'thinking' && block.type !== 'redacted_thinking') text = '';
    }

    console.log(JSON.stringify({ user: userId, model: tier.model, in: inputTokens, out: outputTokens, stop: final.stop_reason }));
    return json(200, { text, stopReason: final.stop_reason, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'The AI service is busy. Please retry shortly.' });
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return json(502, { error: 'The AI service returned an error.' });
    }
    console.error('Unexpected error', err);
    return json(500, { error: 'Unexpected server error.' });
  }
}
