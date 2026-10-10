import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Owner-only user management: list every account and change plan fields by hand (paid outside Stripe,
 * extra credits, new end dates). Only the owner's verified email may call it; nobody else, whatever their role.
 *
 *   GET    /api/admin            -> { users: [...] }
 *   PATCH  /api/admin  { id, changes: { planStatus?, creditsRemaining?, trialArticlesCreated?,
 *                        subscriptionStartDate?, subscriptionEndDate?, trialEndDate? }, note? }
 *
 * Every change is written to activity_logs (job_name 'admin') with the old and new values.
 * Self-contained on purpose (relative imports break in the Vercel ESM function).
 */

const OWNER_EMAILS = (process.env.ADMIN_EMAILS || 'ngohueminh@gmail.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const PLAN_STATUSES = ['trial', 'paid', 'expired'] as const;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

let admin: SupabaseClient | null = null;
const getAdmin = (): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (admin ??= createClient(url, key, { auth: { persistSession: false } }));
};

/** The caller, if they are signed in with the owner's verified email. */
const authorizeOwner = async (request: Request): Promise<{ id: string; email: string } | null> => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } });
  if (!res.ok) return null;
  const user = await res.json();
  const email = String(user?.email || '').toLowerCase();
  if (typeof user?.id !== 'string' || !email || !user.email_confirmed_at || !OWNER_EMAILS.includes(email)) return null;
  return { id: user.id, email };
};

// ---------------- list ----------------
const listUsers = async (db: SupabaseClient) => {
  const authUsers: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const [{ data: profiles, error: pErr }, { data: businesses }, { data: posts }] = await Promise.all([
    db.from('profiles').select('id, email, full_name, role, plan_status, credits_remaining, trial_articles_created, subscription_start_date, subscription_end_date, trial_end_date, stripe_customer_id, updated_at'),
    db.from('businesses').select('id, user_id, name, url'),
    db.from('posts').select('business_id, status'),
  ]);
  if (pErr) throw pErr;

  const bizByUser = new Map<string, { id: string; name: string; url: string }[]>();
  for (const b of businesses || []) bizByUser.set(b.user_id, [...(bizByUser.get(b.user_id) || []), { id: b.id, name: b.name, url: b.url }]);
  const published = new Map<string, number>();
  for (const p of posts || []) if (p.status === 'published') published.set(p.business_id, (published.get(p.business_id) || 0) + 1);
  const profileById = new Map((profiles || []).map(p => [p.id, p]));

  return authUsers.map(u => {
    const p: any = profileById.get(u.id) || {};
    const biz = bizByUser.get(u.id) || [];
    return {
      id: u.id,
      email: u.email || p.email || '',
      fullName: p.full_name || '',
      role: p.role || 'user',
      planStatus: p.plan_status || 'trial',
      creditsRemaining: p.credits_remaining ?? null,
      trialArticlesCreated: p.trial_articles_created ?? 0,
      subscriptionStartDate: p.subscription_start_date ?? null,
      subscriptionEndDate: p.subscription_end_date ?? null,
      trialEndDate: p.trial_end_date ?? null,
      stripeCustomer: !!p.stripe_customer_id,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      businesses: biz.map(b => ({ name: b.name, url: b.url })),
      publishedArticles: biz.reduce((n, b) => n + (published.get(b.id) || 0), 0),
      hasProfile: profileById.has(u.id),
    };
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

// ---------------- update ----------------
const FIELDS = {
  planStatus: 'plan_status',
  creditsRemaining: 'credits_remaining',
  trialArticlesCreated: 'trial_articles_created',
  subscriptionStartDate: 'subscription_start_date',
  subscriptionEndDate: 'subscription_end_date',
  trialEndDate: 'trial_end_date',
} as const;
type Field = keyof typeof FIELDS;

const cleanChanges = (raw: any): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } => {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No changes sent.' };
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in FIELDS)) return { ok: false, error: `Unknown field: ${key}` };
    const col = FIELDS[key as Field];
    if (key === 'planStatus') {
      if (!PLAN_STATUSES.includes(value as any)) return { ok: false, error: 'Plan status must be trial, paid or expired.' };
      row[col] = value;
    } else if (key === 'creditsRemaining' || key === 'trialArticlesCreated') {
      if (value === null && key === 'creditsRemaining') { row[col] = null; continue; }
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { ok: false, error: `${key} must be a whole number from 0.` };
      row[col] = n;
    } else {
      if (value === null || value === '') { row[col] = null; continue; }
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return { ok: false, error: `${key} is not a valid date.` };
      row[col] = d.toISOString();
    }
  }
  if (!Object.keys(row).length) return { ok: false, error: 'No changes sent.' };
  return { ok: true, row };
};

const updateUser = async (db: SupabaseClient, owner: { email: string }, body: any) => {
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: 'A valid user id is required.' });
  const cleaned = cleanChanges(body.changes);
  if (cleaned.ok === false) return json(400, { error: cleaned.error });

  const { data: before, error: readErr } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (readErr) return json(500, { error: readErr.message });
  if (!before) return json(404, { error: 'This user has no profile row yet.' });

  // A database trigger resets end date (+30 days), credits (30) and status (paid) whenever the start date changes.
  // So a new start date goes first on its own, then the other fields, which then win over the trigger's defaults.
  const { subscription_start_date, ...rest } = cleaned.row as Record<string, unknown>;
  if (subscription_start_date !== undefined) {
    const { error } = await db.from('profiles').update({ subscription_start_date }).eq('id', id);
    if (error) return json(500, { error: error.message });
  }
  let after = before;
  if (Object.keys(rest).length) {
    const { data, error } = await db.from('profiles').update(rest).eq('id', id).select('*').single();
    if (error) return json(500, { error: error.message });
    after = data;
  } else {
    const { data } = await db.from('profiles').select('*').eq('id', id).single();
    after = data;
  }

  const changed = Object.values(FIELDS).filter(c => String(before[c] ?? '') !== String(after[c] ?? ''))
    .map(c => `${c}: ${before[c] ?? 'empty'} -> ${after[c] ?? 'empty'}`);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  if (changed.length) {
    await db.from('activity_logs').insert({
      business_id: null, status: 'success', job_name: 'admin',
      message: `Admin ${owner.email} updated ${after.email || id}: ${changed.join('; ')}${note ? ` (note: ${note})` : ''}`,
    }).then(() => {}, () => {});
  }
  return json(200, { ok: true, changed });
};

const handle = async (request: Request, method: 'GET' | 'PATCH') => {
  const owner = await authorizeOwner(request);
  if (!owner) return json(403, { error: 'Not allowed.' });
  const db = getAdmin();
  if (!db) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' });
  try {
    if (method === 'GET') return json(200, { users: await listUsers(db) });
    const raw = await request.text();
    if (raw.length > 10_000) return json(413, { error: 'Request too large.' });
    let body: any;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON.' }); }
    return await updateUser(db, owner, body);
  } catch (err: any) {
    console.error('admin error', err?.message);
    return json(500, { error: 'Admin request failed.' });
  }
};

export async function GET(request: Request): Promise<Response> { return handle(request, 'GET'); }
export async function PATCH(request: Request): Promise<Response> { return handle(request, 'PATCH'); }
