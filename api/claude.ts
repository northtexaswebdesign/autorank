import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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
 *   maxSearches optional, searches allowed per request when webSearch is on (default 5, max 10)
 *   webFetch   optional, enables Claude's web fetch tool so it can open pages named in the prompt
 *   maxFetches optional, fetches allowed per request when webFetch is on (default 4, max 8)
 *   kind       'article' marks a new-article generation: it uses 1 credit (paid) or 1 of the free trial articles
 *   action     'photo' returns a stock photo (JPEG under 200KB) instead of text; see handlePhoto
 *              'competitor-quota' reserves / releases the monthly competitor analysis; see handleCompetitorQuota
 *              'verify-links' checks the outside links in an article's HTML; see handleVerifyLinks
 * Responses also carry `sources`: every URL the web search returned, so callers can drop links the model made up.
 *   schema     optional JSON schema; response is then guaranteed to match it
 *              (ignored when webSearch or webFetch is on - citations can't be combined with it)
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
          // best effort; add back relative to the current value (compare-and-swap, so a parallel change is not lost)
          for (let i = 0; i < 4; i++) {
            const latest = await loadProfile(db, userId);
            if (!latest) return;
            const cur = (isPaid ? latest.credits_remaining : latest.trial_articles_created) ?? 0;
            const { data: done } = await db.from('profiles').update({ [column]: isPaid ? cur + CREDITS_PER_ARTICLE : Math.max(0, cur - 1) }).eq('id', userId).eq(column, cur).select('id');
            if (done && done.length) return;
          }
        },
      };
    }
  }
  return { ok: false, message: 'Could not reserve a credit. Please try again.' };
};

/**
 * Calls that do not take an article credit (rewrites, repair and source passes, keyword and gap research) are
 * counted per user per UTC day and capped relative to the articles charged that day. The browser chooses which
 * kind of call it sends, so without this cap a user could run unlimited expensive calls for free.
 */
// One article or one rewrite makes up to 4 smart calls (write/rewrite, source pass, repair pass, GEO score),
// so these allow about 4 rewrites a day plus about 3 per article written that day.
const FREE_SMART_PER_DAY = 16;
const SMART_PER_ARTICLE = 12;
const FREE_SEARCH_PER_DAY = 40;
const SEARCH_PER_ARTICLE = 4;

const meterUsage = async (db: SupabaseClient, userId: string, kind: 'article' | 'smart' | 'search'): Promise<Decision> => {
  const { data, error } = await db.rpc('bump_ai_usage', { p_user: userId, p_kind: kind });
  if (error || !Array.isArray(data) || !data[0]) {
    console.error('usage meter failed', error?.message); // fail open: a metering outage must not block paying users
    return { ok: true };
  }
  const u = data[0] as { articles: number; smart: number; search: number };
  if (kind === 'smart' && u.smart > FREE_SMART_PER_DAY + SMART_PER_ARTICLE * u.articles)
    return { ok: false, message: 'Daily limit for AI rewrites reached. It resets at midnight UTC, or write a new article to unlock more.' };
  if (kind === 'search' && u.search > FREE_SEARCH_PER_DAY + SEARCH_PER_ARTICLE * u.articles)
    return { ok: false, message: 'Daily limit for AI research reached. It resets at midnight UTC.' };
  return { ok: true };
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

// ---------------- stock photos (Pexels) ----------------
const PHOTO_MAX_BYTES = 200_000;
const PHOTO_WIDTHS = [1200, 1000, 800, 640];

const handlePhoto = async (body: any, userId: string, db: SupabaseClient): Promise<Response> => {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return json(500, { error: 'PEXELS_API_KEY is not configured on the server.' });

  const decision = decide(await loadProfile(db, userId), false);
  if (!decision.ok) return json(402, { error: decision.message });

  const topic = String(body.keyword || '').slice(0, 200).trim();
  const businessName = String(body.businessName || '').slice(0, 100).trim();
  if (!topic) return json(400, { error: 'keyword is required.' });
  const variant = Math.abs(Number(body.variant) || 0);

  try {
    // 1. A short, visual search query + SEO alt text (cheap model)
    const q = await new Anthropic().messages.create({
      model: MODELS.fast.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: `We need a stock photo for a blog article about "${topic}"${businessName ? ` published by ${businessName}` : ''}.
Give: (1) "query": a 2-4 word search query for a stock photo site that finds a realistic, relevant photo (concrete things you could photograph, no abstract words); (2) "alt": SEO alt text under 125 characters describing a fitting photo for this article.` }],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: { type: 'object', properties: { query: { type: 'string' }, alt: { type: 'string' } }, required: ['query', 'alt'], additionalProperties: false } },
      },
    } as any);
    const { query, alt } = JSON.parse(q.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));

    // 2. Search Pexels (landscape, large); fall back to a generic query if nothing fits
    const search = async (term: string) => {
      const page = 1 + (variant % 3);
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&orientation=landscape&size=large&per_page=15&page=${page}`, { headers: { Authorization: pexelsKey } });
      if (!res.ok) throw new Error(`Pexels search failed (${res.status}).`);
      const data = await res.json();
      return (data.photos || []).filter((p: any) => p.width >= 1200 && typeof p.src?.original === 'string');
    };
    let photos = await search(query);
    if (photos.length === 0) photos = await search(businessName || 'business office');
    if (photos.length === 0) return json(404, { error: 'No suitable stock photo found.' });
    const photo = photos[variant ? (variant * 7) % Math.min(photos.length, 8) : 0];

    // 3. Download from Pexels' image CDN, stepping the width down until the file is under the size limit
    const original = new URL(photo.src.original);
    if (original.hostname !== 'images.pexels.com') return json(502, { error: 'Unexpected image host.' });
    for (const w of PHOTO_WIDTHS) {
      const h = Math.round((w * 9) / 16);
      const res = await fetch(`${original.origin}${original.pathname}?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length <= PHOTO_MAX_BYTES) {
        return json(200, {
          base64: bytes.toString('base64'), alt, width: w, height: h, bytes: bytes.length,
          photographer: photo.photographer, photographerUrl: photo.photographer_url, pexelsUrl: photo.url,
        });
      }
    }
    return json(502, { error: 'Could not produce a photo under the size limit.' });
  } catch (err: any) {
    console.error('photo error', err?.message);
    return json(502, { error: 'Could not fetch a stock photo.' });
  }
};

// ---------------- link verification ----------------
// Self-contained copy of the checks in supabase/functions/_shared/articleQuality.ts (relative imports break in this function).
const BLOCKED_HOSTS = /(^|\.)(reddit|quora|facebook|instagram|twitter|x|tiktok|pinterest|linkedin|medium|tumblr|blogspot|wordpress|wixsite|youtube|youtu)\.(com|be|net)$/i;
const isNonContentUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return /\.(xml|json|txt|rss|atom)$/i.test(u.pathname) || /\/(sitemap[^/]*|feed|rss|wp-json|wp-admin|wp-content)(\/|$)/i.test(u.pathname) || u.searchParams.has('s');
  } catch { return false; }
};
const normUrl = (raw: string): string => {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch { return raw.trim().toLowerCase(); }
};
const hostOf = (raw: string): string => { try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

const isPrivateIp = (ip: string): boolean => {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || (l.startsWith('::ffff:') && isPrivateIp(l.slice(7)));
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

/** Collects every URL the web search returned (tool results and text citations). */
const collectSearchUrls = (blocks: any[]): string[] => {
  const urls = new Set<string>();
  const walk = (node: any, inResult: boolean) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walk(n, inResult)); return; }
    const isResult = inResult || (typeof node.type === 'string' && /tool_result$/.test(node.type));
    if (typeof node.url === 'string' && (isResult || /^web_search_result/.test(node.type || ''))) urls.add(node.url);
    if (Array.isArray(node.citations)) node.citations.forEach((c: any) => typeof c?.url === 'string' && urls.add(c.url));
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, isResult);
  };
  walk(blocks, false);
  return [...urls];
};

/** 'ok' | 'dead' (404/410/unreachable) | 'unsafe' (private or odd address). Bot-blocking statuses count as ok. */
const checkLink = async (rawUrl: string, hops = 3): Promise<'ok' | 'dead' | 'unsafe'> => {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return 'unsafe'; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || (url.port && url.port !== '80' && url.port !== '443')) return 'unsafe';
  const records = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!records.length) return 'dead';
  if (records.some(r => isPrivateIp(r.address))) return 'unsafe';
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutorankLinkCheck/1.0)' } });
    await res.body?.cancel();
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      return hops > 0 ? checkLink(new URL(res.headers.get('location')!, url).toString(), hops - 1) : 'ok';
    }
    return res.status === 404 || res.status === 410 ? 'dead' : 'ok';
  } catch (e: any) {
    return e?.name === 'TimeoutError' ? 'ok' : 'dead';
  }
};

const handleVerifyLinks = async (body: any, userId: string, db: SupabaseClient): Promise<Response> => {
  const decision = decide(await loadProfile(db, userId), false);
  if (!decision.ok) return json(402, { error: decision.message });
  const html = typeof body.html === 'string' ? body.html : '';
  if (!html) return json(400, { error: 'html is required.' });
  const ownHost = hostOf(/^https?:/.test(String(body.ownUrl || '')) ? body.ownUrl : body.ownUrl ? `https://${body.ownUrl}` : '');
  const allowed = new Set((Array.isArray(body.searchUrls) ? body.searchUrls : []).filter((u: unknown) => typeof u === 'string').slice(0, 500).map(normUrl));
  const urls = [...new Set([...html.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]))].slice(0, 30);

  const bad = new Map<string, string>();
  const live: string[] = [];
  for (const u of urls) {
    const host = hostOf(u);
    if (BLOCKED_HOSTS.test(host)) bad.set(u, 'blocked-host');
    else if (isNonContentUrl(u)) bad.set(u, 'not-a-content-page');
    else if (host !== ownHost && allowed.size > 0 && !allowed.has(normUrl(u))) bad.set(u, 'not-in-search-results');
    else live.push(u);
  }
  await Promise.all(live.map(async u => { const r = await checkLink(u); if (r !== 'ok') bad.set(u, r); }));

  const cleaned = bad.size
    ? html.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => (bad.has(href) ? inner : m))
    : html;
  return json(200, { html: cleaned, removed: [...bad].map(([url, reason]) => ({ url, reason })), kept: urls.filter(u => !bad.has(u)) });
};

// ---------------- competitor analysis quota ----------------
// 1 AI competitive analysis per business per calendar month (UTC). `businesses.competitor_analyzed_at` is stamped here with the
// service role (a trigger stops signed-in users from editing it). Reserve before researching; release if every step failed.
const COMPETITOR_ANALYSES_PER_MONTH = 1;
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const nextMonthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
const RELEASE_WINDOW_MS = 30 * 60_000;

const handleCompetitorQuota = async (body: any, userId: string, db: SupabaseClient): Promise<Response> => {
  const businessId = String(body.businessId || '');
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return json(400, { error: 'businessId is required.' });
  if (body.op !== 'reserve' && body.op !== 'release') return json(400, { error: 'op must be reserve or release.' });

  const { data: row, error: readError } = await db.from('businesses').select('id, user_id, competitor_analyzed_at, competitor_prev_analyzed_at, competitor_released_at').eq('id', businessId).maybeSingle();
  if (readError) { console.error('quota read failed', readError.message); return json(500, { error: 'The monthly limit could not be checked. Please try again later.' }); }
  if (!row || row.user_id !== userId) return json(404, { error: 'Business not found.' });

  if (body.op === 'release') {
    // Give a failed run back: only a fresh stamp (this attempt), at most once per month, restoring the value the
    // server saved at reserve time (never a value sent by the browser).
    const fresh = row.competitor_analyzed_at && Date.now() - Date.parse(row.competitor_analyzed_at) < RELEASE_WINDOW_MS;
    const releasedThisMonth = row.competitor_released_at && Date.parse(row.competitor_released_at) >= monthStart().getTime();
    if (!fresh || releasedThisMonth) return json(200, { ok: true, released: false });
    await db.from('businesses')
      .update({ competitor_analyzed_at: row.competitor_prev_analyzed_at ?? null, competitor_released_at: new Date().toISOString() })
      .eq('id', businessId).eq('user_id', userId).eq('competitor_analyzed_at', row.competitor_analyzed_at);
    return json(200, { ok: true, released: true });
  }

  const decision = decide(await loadProfile(db, userId), true);
  if (!decision.ok) return json(402, { error: decision.message });

  const start = monthStart().toISOString();
  const { data: updated, error } = await db.from('businesses')
    .update({ competitor_analyzed_at: new Date().toISOString(), competitor_prev_analyzed_at: row.competitor_analyzed_at ?? null })
    .eq('id', businessId).eq('user_id', userId)
    .or(`competitor_analyzed_at.is.null,competitor_analyzed_at.lt.${start}`)
    .select('id');
  if (error) { console.error('quota reserve failed', error.message); return json(500, { error: 'The monthly limit could not be checked. Please try again later.' }); }
  if (!updated || updated.length === 0) {
    const next = nextMonthStart();
    return json(429, {
      error: `AI competitive analysis is limited to ${COMPETITOR_ANALYSES_PER_MONTH} per month for each business. The next one is available on ${next.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}.`,
      nextAvailable: next.toISOString(),
    });
  }
  return json(200, { ok: true, previous: row.competitor_analyzed_at ?? null });
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

  if (body.action === 'photo') {
    const photoDb = getAdmin();
    if (!photoDb) return json(500, { error: 'Billing is not configured on the server (SUPABASE_SERVICE_ROLE_KEY).' });
    return handlePhoto(body, userId, photoDb);
  }
  if (body.action === 'competitor-quota') {
    const quotaDb = getAdmin();
    if (!quotaDb) return json(500, { error: 'Billing is not configured on the server (SUPABASE_SERVICE_ROLE_KEY).' });
    return handleCompetitorQuota(body, userId, quotaDb);
  }
  if (body.action === 'verify-links') {
    const linkDb = getAdmin();
    if (!linkDb) return json(500, { error: 'Billing is not configured on the server (SUPABASE_SERVICE_ROLE_KEY).' });
    return handleVerifyLinks(body, userId, linkDb);
  }

  const tier = MODELS[body.tier];
  if (!tier) return json(400, { error: 'Unknown tier.' });
  if (!validMessages(body.messages)) return json(400, { error: 'Invalid messages.' });
  if (body.system !== undefined && typeof body.system !== 'string') return json(400, { error: 'Invalid system prompt.' });

  // --- plan / credit enforcement ---
  const db = getAdmin();
  if (!db) return json(500, { error: 'Billing is not configured on the server (SUPABASE_SERVICE_ROLE_KEY).' });
  const heavy = body.tier === 'smart' || body.webSearch === true || body.webFetch === true;
  let refund: (() => Promise<void>) | null = null;
  if (body.kind === 'article') {
    const reservation = await reserveArticle(db, userId);
    if (!reservation.ok) return json(402, { error: reservation.message });
    refund = reservation.refund ?? null;
    await meterUsage(db, userId, 'article');
  } else {
    const decision = decide(await loadProfile(db, userId), heavy);
    if (!decision.ok) return json(402, { error: decision.message });
    if (heavy) {
      const metered = await meterUsage(db, userId, body.tier === 'smart' ? 'smart' : 'search');
      if (!metered.ok) return json(429, { error: metered.message });
    }
  }

  const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 8000, 256), MAX_TOKENS_CAP);
  const webSearch = body.webSearch === true;
  const maxSearches = Math.min(Math.max(Math.floor(Number(body.maxSearches)) || 5, 1), 10);
  const webFetch = body.webFetch === true;
  const maxFetches = Math.min(Math.max(Math.floor(Number(body.maxFetches)) || 4, 1), 8);
  const useSchema = !!body.schema && typeof body.schema === 'object' && !webSearch && !webFetch;
  const tools: any[] = [
    ...(webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }] : []),
    // opens pages named in the prompt directly, for sites the search index barely covers
    ...(webFetch ? [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: maxFetches, max_content_tokens: 20000 }] : []),
  ];

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...body.messages];

  try {
    let final: Anthropic.Message | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    const sources = new Set<string>();
    const searchErrors = new Set<string>();

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
        ...(tools.length ? { tools } : {}),
      } as Anthropic.MessageStreamParams);
      final = await stream.finalMessage();
      inputTokens += final.usage.input_tokens;
      outputTokens += final.usage.output_tokens;
      collectSearchUrls(final.content as any[]).forEach(u => sources.add(u));
      for (const b of final.content as any[]) {
        if (b.type === 'web_search_tool_result' && b.content?.type === 'web_search_tool_result_error') searchErrors.add(String(b.content.error_code));
        if (b.type === 'web_fetch_tool_result' && b.content?.type === 'web_fetch_tool_result_error') searchErrors.add(`fetch:${String(b.content.error_code)}`);
      }
      if (final.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: final.content });
    }

    if (!final) { await refund?.(); return json(502, { error: 'No response from model.' }); }
    if (final.stop_reason === 'refusal') { await refund?.(); return json(422, { error: 'The model declined this request.' }); }
    if (refund && (final.stop_reason === 'max_tokens' || final.stop_reason === 'pause_turn')) {
      await refund();
      return json(502, { error: 'The article came back incomplete (it was cut off). You were not charged; please try again.' });
    }

    // Keep only text produced after the last tool step, so any "let me search..."
    // narration doesn't end up in front of the JSON/article payload.
    let text = '';
    for (const block of final.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type !== 'thinking' && block.type !== 'redacted_thinking') text = '';
    }

    console.log(JSON.stringify({ user: userId, model: tier.model, in: inputTokens, out: outputTokens, stop: final.stop_reason }));
    return json(200, { text, sources: [...sources], searchErrors: [...searchErrors], stopReason: final.stop_reason, usage: { inputTokens, outputTokens } });
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
