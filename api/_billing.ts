import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const TRIAL_ARTICLE_LIMIT = 3;
export const CREDITS_PER_ARTICLE = 1;

export interface Profile {
  plan_status: 'trial' | 'paid' | 'expired' | null;
  credits_remaining: number | null;
  trial_articles_created: number | null;
}

// (tsconfig is not strict, so a flat shape narrows more reliably than a discriminated union)
export type Decision = { ok: boolean; message?: string };

/**
 * Pure entitlement rules.
 *  - expired: nothing allowed.
 *  - paid:    "heavy" calls (smart model or web search) need credits left; light calls are free.
 *  - trial:   heavy calls allowed until TRIAL_ARTICLE_LIMIT articles have been created.
 */
export const decide = (profile: Profile | null, heavy: boolean): Decision => {
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
export const getAdmin = (): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (admin ??= createClient(url, key, { auth: { persistSession: false } }));
};

export const loadProfile = async (db: SupabaseClient, userId: string): Promise<Profile | null> => {
  const { data } = await db.from('profiles').select('plan_status, credits_remaining, trial_articles_created').eq('id', userId).maybeSingle();
  return (data as Profile) ?? null;
};

/**
 * Reserve one article before generating (compare-and-swap so parallel requests can't overdraw).
 * Returns a function that gives it back if generation fails.
 */
export const reserveArticle = async (db: SupabaseClient, userId: string): Promise<{ ok: boolean; message?: string; refund?: () => Promise<void> }> => {
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
