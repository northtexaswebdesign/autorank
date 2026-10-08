import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
 *   kind       'article' marks a new-article generation: it uses 1 credit (paid) or 1 of the free trial articles
 *   schema     optional JSON schema; response is then guaranteed to match it
 *              (ignored when webSearch is on - citations can't be combined with it)
 */

// ---------------- plan / credit rules ----------------
const TRIAL_ARTICLE_LIMIT = 3;
const CREDITS_PER_ARTICLE = 1;

interface Profile {
  plan_status: 'trial' | 'paid' | 'expired' | null;
  credits_remaining: number | null;
  trial_articles_created: number | null;
}

// (tsconfig is not strict, so a flat shape narrows more reliably than a discriminated union)
type Decision = { ok: boolean; message?: string };

/**
 * Pure entitlement rules.
 *  - expired: nothing allowed.
 *  - paid:    "heavy" calls (smart model or web search) need credits left; light calls are free.
 *  - trial:   heavy calls allowed until TRIAL_ARTICLE_LIMIT articles have been created.
 */
const decide = (profile: Profile | null, heavy: boolean): Decision => {
  if (!profile) return { ok: false, message: 'Account not found.' };
  switch (profile.plan_status) {
    case 'paid':
      if (heavy && (profile.credits_remaining ?? 0) < CREDITS_PER_ARTICLE) {
        return { ok: false, message: 'You have no credits left this month. Please renew your plan.' };
      }
      return { ok: true };
    case 'trial':
      if (heavy && (profile.trial_articles_created ?? 0) >= TRIAL_ARTICLE_LIMIT) {
        return { ok: false, message: `You have used your ${TRIAL_ARTICLE_LIMIT} free trial articles. Please upgrade to continue.` };
      }
      return { ok: true };
    default:
      return { ok: false, message: 'Your plan has expired. Please upgrade to continue.' };
  }
};

let admin: SupabaseClient | null = null;
const getAdmin = (): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (admin ??= createClient(url, key, { auth: { persistSession: false } }));
};

const loadProfile = async (db: SupabaseClient, userId: string): Promise<Profile | null> => {
  const { data } = await db.from('profiles').select('plan_status, credits_remaining, trial_articles_created').eq('id', userId).maybeSingle();
  return (data as Profile) ?? null;
};

/**
 * Reserve one article before generating (compare-and-swap so parallel requests can't overdraw).
 * Returns a function that gives it back if generation fails.
 */
const reserveArticle = async (db: SupabaseClient, userId: string): Promise<{ ok: boolean; message?: string; refund?: () => Promise<void> }> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await loadProfile(db, userId);
    const decision = decide(profile, true);
    if (!decision.ok) return decision;

    const isPaid = profile!.plan_status === 'paid';
    const column = isPaid ? 'credits_remaining' : 'trial_articles_created';
    const current = (isPaid ? profile!.credits_remaining : profile!.trial_articles_created) ?? 0;
    const next = isPaid ? current - CREDITS_PER_ARTICLE : current + 1;

    const { data, error } = await db.from('profiles').update({ [column]: next }).eq('id', userId).eq(column, current).select('id');
    if (!error && data && data.length > 0) {
      return {
        ok: true,
        refund: async () => {
          // best effort; add back relative to the current value
          const latest = await loadProfile(db, userId);
          if (!latest) return;
          const cur = (isPaid ? latest.credits_remaining : latest.trial_articles_created) ?? 0;
          await db.from('profiles').update({ [column]: isPaid ? cur + CREDITS_PER_ARTICLE : Math.max(0, cur - 1) }).eq('id', userId);
        },
      };
    }
  }
  return { ok: false, message: 'Could not reserve a credit. Please try again.' };
};
// ------------------------------------------------------

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

  // --- plan / credit enforcement ---
  const db = getAdmin();
  if (!db) return json(500, { error: 'Billing is not configured on the server (SUPABASE_SERVICE_ROLE_KEY).' });
  const heavy = body.tier === 'smart' || body.webSearch === true;
  let refund: (() => Promise<void>) | null = null;
  if (body.kind === 'article') {
    const reservation = await reserveArticle(db, userId);
    if (!reservation.ok) return json(402, { error: reservation.message });
    refund = reservation.refund ?? null;
  } else {
    const decision = decide(await loadProfile(db, userId), heavy);
    if (!decision.ok) return json(402, { error: decision.message });
  }

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

    if (!final) { await refund?.(); return json(502, { error: 'No response from model.' }); }
    if (final.stop_reason === 'refusal') { await refund?.(); return json(422, { error: 'The model declined this request.' }); }

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
    await refund?.();
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'The AI service is busy. Please retry shortly.' });
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return json(502, { error: 'The AI service returned an error.' });
    }
    console.error('Unexpected error', err);
    return json(500, { error: 'Unexpected server error.' });
  }
}
