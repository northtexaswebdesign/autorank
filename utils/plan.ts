import { UserProfile } from '../types.ts';

// Plan rules, shared by the app. api/claude.ts and the auto-publisher carry their own copy (keep them in sync).
export const TRIAL_ARTICLE_LIMIT = 3;
// a card-on-file trial stays open a day past its end, while Stripe collects the first $97 payment
const CARD_TRIAL_GRACE_MS = 24 * 3600_000;

/** A new trial that has not added a card yet. Older trials have no end date and never need one. */
export const needsCard = (p: UserProfile | null | undefined): boolean =>
  !!p && p.planStatus === 'trial' && !p.stripeCustomerId && !!p.trialEndDate;

/** The trial is used up: all trial articles written, or its end date (plus grace with a card) has passed. */
export const trialOver = (p: UserProfile | null | undefined): boolean => {
  if (!p || p.planStatus !== 'trial') return false;
  if ((p.trialArticlesCreated ?? 0) >= TRIAL_ARTICLE_LIMIT) return true;
  if (!p.trialEndDate) return false;
  const grace = p.stripeCustomerId ? CARD_TRIAL_GRACE_MS : 0;
  return new Date(p.trialEndDate).getTime() + grace < Date.now();
};
