// Clip harness: renders the real Autorank screens with mock data and drives them from a frame-accurate timeline.
// render.mjs calls __pre(t) / __post(t) for every frame and takes a screenshot in between.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppContext } from '../../context/AppContext.tsx';
import { AIKeywordsIntelligenceTab } from '../../components/AIKeywordsIntelligenceTab.tsx';
import { AnalysisProgressModal } from '../../components/AnalysisProgressModal.tsx';
import { KeywordPlannerTab } from '../../components/KeywordPlannerTab.tsx';
import { CalendarTab } from '../../components/CalendarTab.tsx';
import { ContentGenerationScreen } from '../../components/ContentGenerationScreen.tsx';
import { BusinessInfo, CompetitorAnalysis, Keyword, KeywordOpportunity, ScheduledPost } from '../../types.ts';
import geist400 from '../fonts/geist-sans-latin-400-normal.woff2?inline';
import geist600 from '../fonts/geist-sans-latin-600-normal.woff2?inline';
import serif400 from '../fonts/instrument-serif-latin-400-normal.woff2?inline';

const W = 1120, H = 990, INSET = 20;
const w = window as any;
w.__pending = w.__pending || {};

// ---------------------------------------------------------------- data
const H_ = KeywordOpportunity.High, M_ = KeywordOpportunity.Medium, L_ = KeywordOpportunity.Low;
let kid = 0;
const kw = (keyword: string, opportunity: KeywordOpportunity, extra: Partial<Keyword> = {}): Keyword =>
  ({ id: `k${++kid}`, businessId: 'b1', keyword, opportunity, isQueued: false, isStarred: false, ...extra });

const analysis: CompetitorAnalysis = {
  analyzedAt: '2026-10-10T10:00:00',
  strategicRecommendations: [
    'Publish **answer-first guides** on the GEO questions rival-seo.com only covers in passing.',
    'Add an FAQ block with schema to every article to win **AI Overview** citations.',
    'Build a **topical authority** pillar with six supporting cluster posts.',
    'Cite primary sources in every post. Neither rival links out to data.',
  ],
  analysis: [
    {
      url: 'https://rival-seo.com',
      contentStrategySummary: 'Three posts a week, mostly listicles aimed at **high-volume head terms**.',
      strengths: ['Fast publishing cadence', 'Strong backlink profile', 'Ranks for 40+ head terms'],
      weaknesses: ['Thin answers, no FAQ sections', 'No structured data', 'Rarely cites a source'],
    },
    {
      url: 'https://contentmill.io',
      contentStrategySummary: 'Long, keyword-heavy tutorials that are **rarely updated**.',
      strengths: ['Deep step-by-step tutorials', 'High domain authority'],
      weaknesses: ['Most guides are 2+ years old', 'Not cited in AI answers', 'No niche or local angles'],
    },
  ],
};

const baseBusiness: BusinessInfo = {
  id: 'b1', url: 'https://acmegrowth.com', name: 'Acme Growth',
  description: 'Content marketing studio for B2B software companies.', audience: 'B2B SaaS marketers',
  competitors: ['https://rival-seo.com', 'https://contentmill.io'], autoSchedule: true, language: 'English',
};

const day = (d: number, h = 9) => new Date(2026, 9, d, h, 0, 0).toISOString();
const post = (id: string, keyword: string, d: number, status: ScheduledPost['status'], extra: Partial<ScheduledPost> = {}): ScheduledPost =>
  ({ id, businessId: 'b1', keyword, publishDate: day(d), status, ...extra });

const fontCss = `@font-face{font-family:Geist;src:url(${geist400});font-weight:400}@font-face{font-family:Geist;src:url(${geist600});font-weight:600 700}@font-face{font-family:'Instrument Serif';src:url(${serif400})}`;
const ARTICLE = `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}
body{margin:0;padding:40px 48px;font-family:Geist,sans-serif;color:#292524;line-height:1.7;font-size:16px}
h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:44px;line-height:1.05;color:#111214;margin:0 0 10px}
.meta{font-size:13px;color:#8C887F;margin-bottom:26px}
.kt{background:#F7F6F3;border:1px solid #ECE9E2;border-radius:14px;padding:18px 22px;margin:0 0 28px}
.kt b{display:block;font-size:12px;letter-spacing:.08em;color:#111214;margin-bottom:6px}
.kt li{margin:4px 0;color:#44403C}
h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:30px;color:#111214;margin:30px 0 8px}
p{margin:0 0 14px;color:#44403C}
.src{display:flex;gap:8px;flex-wrap:wrap}.src span{font-size:12px;border:1px solid #E7E4DC;border-radius:999px;padding:4px 12px;color:#57534E}
</style></head><body>
<h1>Generative Engine Optimization: The Complete Guide</h1>
<div class="meta">Last updated October 10, 2026 · 2,140 words · 6 sources</div>
<div class="kt"><b>KEY TAKEAWAYS</b><ul><li>GEO is the practice of writing content that AI search engines quote as a source.</li><li>Answer the question in the first two sentences, then go deeper.</li><li>Cite primary sources and mark up FAQs with schema.</li></ul></div>
<p><strong>Generative engine optimization (GEO)</strong> means shaping your content so that ChatGPT, Perplexity, Claude and Google AI Overviews pick it as the source for their answers.</p>
<h2>How AI search engines choose sources</h2>
<p>AI engines favour pages that answer directly, show who wrote them, and back each claim with a source the model can check.</p>
<h2>A GEO checklist for every article</h2>
<p>Lead with the answer, keep one idea per section, add an FAQ block, and link the data you quote.</p>
<h2>Sources</h2><div class="src"><span>Google Search Central</span><span>Search Engine Journal</span><span>Ahrefs</span><span>Semrush</span></div>
</body></html>`;

// ---------------------------------------------------------------- store + context
type S = {
  business: BusinessInfo; suggested: Keyword[]; queued: Keyword[]; posts: ScheduledPost[];
  editingPost: ScheduledPost | null; modal?: boolean; progress?: { value: number; text: string }; complete?: boolean;
  [k: string]: any;
};

const waitFor = (name: string) => new Promise<any>(res => { w.__pending[name] = res; });

function useMockContext(s: S, set: (fn: (p: S) => Partial<S>) => void) {
  return useMemo(() => ({
    selectedBusiness: s.business,
    updateBusiness: async () => {}, createBusiness: async () => null, cachePlanData: async () => {},
    analyzeCompetitors: async () => {},
    suggestedKeywords: s.suggested, queuedKeywords: s.queued,
    addKeyword: async () => {},
    addKeywordToQueue: async (k: Keyword) => set(p => ({ suggested: p.suggested.filter(x => x.id !== k.id), queued: [...p.queued, { ...k, isQueued: true }] })),
    addKeywordsToQueue: async () => {},
    removeKeywordFromQueue: async (k: Keyword) => set(p => ({ queued: p.queued.filter(x => x.id !== k.id), suggested: [{ ...k, isQueued: false }, ...p.suggested] })),
    deleteKeyword: async () => {}, deleteKeywords: async () => {},
    toggleKeywordStar: async (k: Keyword) => set(p => ({
      suggested: p.suggested.map(x => x.id === k.id ? { ...x, isStarred: !x.isStarred } : x),
      queued: p.queued.map(x => x.id === k.id ? { ...x, isStarred: !x.isStarred } : x),
    })),
    schedulePostsFromContentPlan: () => waitFor('autofill'),
    schedulePostsFromAllKeywords: () => waitFor('autofill'),
    generateAndStoreKeywords: () => waitFor('generate'),
    suggestContentCluster: async () => null,
    generateArticleFromKeyword: async () => {},
    scheduledPosts: s.posts,
    addScheduledPosts: async () => null,
    updateScheduledPost: async (id: string, updates: Partial<ScheduledPost>) => {
      let out: ScheduledPost | null = null;
      set(p => {
        const merge = (x: ScheduledPost) => (x.id === id ? (out = { ...x, ...updates }) : x);
        return { posts: p.posts.map(merge), editingPost: p.editingPost ? merge(p.editingPost) : null };
      });
      return out || ({ id, ...updates } as ScheduledPost);
    },
    deleteScheduledPost: async () => {}, unschedulePost: async () => {},
    cmsIntegration: { id: 'c1', businessId: 'b1', platform: 'wordpress', url: 'https://acmegrowth.com', username: 'acme' },
    updateCmsIntegration: async () => {},
    loading: false,
    editingPost: s.editingPost, setEditingPost: () => {},
    activeTab: 'planner', setActiveTab: () => {},
    activityLogs: [], logActivity: async () => {},
    isLoadingEditingPost: false, editingPostId: s.editingPost?.id ?? null,
    userProfile: { id: 'u1', planStatus: 'paid', creditsRemaining: 24, trialArticlesCreated: 0, fullName: 'Acme Growth' },
    updateUserProfile: async () => {},
    isLocked: false, isTrialExpired: false, isSubscriptionExpired: false,
  }), [s]);
}

// ---------------------------------------------------------------- helpers for timelines
const $$ = (sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const byText = (sel: string, text: string, root: ParentNode = document) => $$(sel, root).find(e => e.textContent?.includes(text)) || null;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const POP = 'cubic-bezier(.34,1.56,.64,1)';

/** Runs an entrance animation on each matching element the first time it is seen (after `after`). */
const seen = new WeakSet<Element>();
function enter(els: Element[], t: number, after: number, frames: Keyframe[], opts: KeyframeAnimationOptions & { stagger?: number } = {}) {
  let i = 0;
  for (const el of els) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (t < after) continue;
    el.animate(frames, { duration: 520, easing: EASE_OUT, fill: 'backwards', ...opts, delay: (opts.delay || 0) + i++ * (opts.stagger || 0) });
  }
}
const RISE: Keyframe[] = [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }];
const PopIn: Keyframe[] = [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }];

/** Smoothly slides elements whose layout position changed since the last frame (FLIP). */
const lastTop = new WeakMap<HTMLElement, number>();
function flip(els: HTMLElement[]) {
  for (const el of els) {
    const top = el.offsetTop;
    const prev = lastTop.get(el);
    lastTop.set(el, top);
    if (prev !== undefined && Math.abs(prev - top) > 1) {
      el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'none' }], { duration: 420, easing: EASE_OUT, composite: 'add' });
    }
  }
}

/** Keeps a fading copy of rows that just left the DOM, so removals read as motion instead of a cut. */
const lastRect = new Map<HTMLElement, DOMRect>();
function ghosts(els: HTMLElement[]) {
  const cam = document.getElementById('cam')!;
  for (const [el, r] of lastRect) {
    if (el.isConnected) continue;
    lastRect.delete(el);
    const g = el.cloneNode(true) as HTMLElement;
    const c = cam.getBoundingClientRect(), s = camState.s;
    const table = document.createElement('table');
    table.className = 'w-full text-sm';
    table.style.cssText = `position:absolute;left:${(r.left - c.left) / s}px;top:${(r.top - c.top) / s}px;width:${r.width / s}px;z-index:40;pointer-events:none;background:#fff`;
    const tb = document.createElement('tbody'); tb.appendChild(g); table.appendChild(tb);
    cam.appendChild(table);
    const a = table.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(28px)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => table.remove();
  }
  for (const el of els) lastRect.set(el, el.getBoundingClientRect());
}

/** Pulses a number when its text changes. */
const lastText = new WeakMap<Element, string>();
function pulseOnChange(els: Element[]) {
  for (const el of els) {
    const txt = el.textContent || '';
    const prev = lastText.get(el);
    lastText.set(el, txt);
    if (prev !== undefined && prev !== txt) el.animate([{ transform: 'scale(1.18)', color: '#EA580C' }, { transform: 'none' }], { duration: 380, easing: EASE_OUT });
  }
}

type Target = [number, number] | (() => Element | [number, number] | null);
type CursorKey = { t: number; at: Target; dx?: number; dy?: number };
type CamKey = { t: number; s: number; x: number; y: number };

interface Clip {
  duration: number;
  initial: () => S;
  view: (s: S, set: (fn: (p: S) => Partial<S>) => void) => React.ReactNode;
  events: [number, (api: Api) => void][];
  cursor: CursorKey[];
  clicks: number[];
  camera: CamKey[];
  scroll?: { t: number; y: number }[];
  decorate?: (t: number) => void;
}
type Api = { set: (fn: (p: S) => Partial<S>) => void; resolve: (name: string, v?: any) => void };

// ---------------------------------------------------------------- clips
const panel = (children: React.ReactNode, padded = true) => (
  <div className="absolute bg-white rounded-2xl border border-[#E7E4DC] shadow-[0_1px_2px_rgba(28,27,25,0.04),0_8px_24px_rgba(28,27,25,0.05)] overflow-hidden"
    style={{ left: INSET, top: INSET, right: INSET, bottom: INSET }} id="panel">
    {padded ? <div className="px-9 py-8 h-full overflow-hidden" id="page">{children}</div> : children}
  </div>
);

const reportClip: Clip = {
  duration: 7.5,
  initial: () => ({ business: { ...baseBusiness }, suggested: [], queued: [], posts: [], editingPost: null, modal: true, progress: { value: 0, text: 'Starting analysis…' }, complete: false }),
  view: (s, set) => (
    <>
      {panel(<AIKeywordsIntelligenceTab />)}
      <AnalysisProgressModal isOpen={!!s.modal} onClose={() => {}} progress={s.progress!} isComplete={!!s.complete}
        onGoToReport={() => set(p => ({ modal: false, business: { ...p.business, competitorAnalysis: analysis } }))} />
    </>
  ),
  events: [
    [0.15, ({ set }) => set(() => ({ progress: { value: 12, text: 'Reading rival-seo.com and contentmill.io…' } }))],
    [0.75, ({ set }) => set(() => ({ progress: { value: 38, text: 'Checking live Google results for your keywords…' } }))],
    [1.35, ({ set }) => set(() => ({ progress: { value: 64, text: 'Comparing content strategies…' } }))],
    [1.9, ({ set }) => set(() => ({ progress: { value: 90, text: 'Writing your playbook…' } }))],
    [2.3, ({ set }) => set(() => ({ progress: { value: 100, text: 'Writing your playbook…' } }))],
    [2.6, ({ set }) => set(() => ({ complete: true }))],
  ],
  cursor: [
    { t: 0, at: [W * 0.66, H * 0.84] },
    { t: 2.75, at: [W * 0.66, H * 0.84] },
    { t: 3.3, at: () => byText('button', 'View Report') },
    { t: 4.3, at: () => byText('button', 'View Report') ?? null },
    { t: 5.6, at: () => byText('a', 'rival-seo.com'), dx: -10 },
    { t: 6.6, at: () => byText('a', 'contentmill.io'), dx: -10 },
  ],
  clicks: [3.55],
  camera: [
    { t: 0, s: 1.0, x: W / 2, y: H / 2 },
    { t: 3.4, s: 1.035, x: W / 2, y: H / 2 },
    { t: 4.0, s: 1.0, x: W / 2, y: H / 2 },
  ],
  scroll: [{ t: 0, y: 0 }, { t: 5.0, y: 0 }, { t: 6.6, y: 250 }],
  decorate: (t) => {
    const modal = document.querySelector('.fixed.inset-0 > div');
    if (modal) enter([modal], t, 0, [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 600 });
    const done = byText('h2', 'Analysis Complete');
    if (done) enter([done.previousElementSibling!, done, done.nextElementSibling!, done.nextElementSibling!.nextElementSibling!], t, 2.5, PopIn, { duration: 520, stagger: 70, easing: POP });
    const page = document.getElementById('page');
    if (!page || !byText('h2', 'Competitive intelligence report')) return;
    const root = page.querySelector('.space-y-8')!;
    enter([root.children[0]], t, 3, RISE, { duration: 600 });
    enter($$('#recs-heading', root), t, 3, RISE, { delay: 90 });
    enter($$('ol li', root), t, 3, RISE, { delay: 160, stagger: 85 });
    enter($$('#competitors-heading', root), t, 3, RISE, { delay: 450 });
    enter($$('article', root), t, 3, [{ opacity: 0, transform: 'translateY(30px) scale(.98)' }, { opacity: 1, transform: 'none' }], { delay: 520, stagger: 140, duration: 700 });
    enter($$('article li', root), t, 3, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { delay: 850, stagger: 70, duration: 420 });
  },
};

const initialSuggested = () => [
  kw('what is generative engine optimization', H_), kw('how to rank in chatgpt answers', H_), kw('topical authority seo', H_),
  kw('programmatic seo guide', M_), kw('ai content strategy for small business', M_), kw('schema markup for articles', M_),
  kw('long-tail keyword strategy', M_), kw('how to do a content audit', L_), kw('seo content brief example', L_), kw('link building outreach templates', L_),
];
const newKeywords = () => [
  kw('how ai search engines choose sources', H_), kw('perplexity seo ranking factors', H_), kw('get cited in google ai overviews', H_),
  kw('answer engine optimization checklist', H_), kw('brand mentions in chatgpt', H_), kw('faq schema for ai overviews', M_),
  kw('llm citation optimization', H_), kw('how to track ai search traffic', M_), kw('entity seo for b2b saas', M_),
  kw('zero click search strategy', M_), kw('e-e-a-t signals for ai answers', M_), kw('how to write answer-first content', M_),
  kw('best ai seo tools 2026', M_), kw('content refresh for ai search', L_), kw('internal linking for topical authority', L_),
  kw('structured data for llms', L_), kw('claude search visibility', M_),
];

const keywordsClip: Clip = {
  duration: 7.5,
  initial: () => {
    kid = 0;
    return {
      business: { ...baseBusiness, competitorAnalysis: analysis }, suggested: initialSuggested(),
      queued: [kw('geo vs seo', H_, { isQueued: true }), kw('ai overviews optimization', H_, { isQueued: true })],
      posts: [post('p1', 'geo vs seo', 2, 'published'), post('p2', 'what is llm seo', 6, 'published')], editingPost: null, fresh: newKeywords(),
    };
  },
  view: () => panel(<KeywordPlannerTab setActiveTab={() => {}} />),
  events: [
    ...Array.from({ length: 17 }, (_, i) => [2.05 + i * 0.035, ({ set }: Api) => set(p => ({ suggested: [p.fresh[16 - i], ...p.suggested] }))] as [number, (a: Api) => void]),
    [2.7, ({ resolve }) => resolve('generate')],
  ],
  cursor: [
    { t: 0, at: [W * 0.5, H * 0.62] },
    { t: 0.35, at: [W * 0.5, H * 0.62] },
    { t: 1.05, at: () => byText('button', 'Generate with AI Insights') || byText('button', 'Generating') },
    { t: 2.9, at: () => byText('button', 'Generate with AI Insights') || byText('button', 'Generating') },
    { t: 3.6, at: () => byText('button', 'Add to Plan', $$('tbody tr')[0]) },
    { t: 4.2, at: () => byText('button', 'Add to Plan', $$('tbody tr')[0]) },
    { t: 4.85, at: () => $$('tbody tr')[1]?.querySelectorAll('button')[0] || null },
    { t: 5.4, at: () => $$('tbody tr')[1]?.querySelectorAll('button')[0] || null },
    { t: 6.05, at: () => $$('button').find(b => b.textContent?.includes('Content Plan') && b.textContent.includes('Approved')) || null },
    { t: 7.5, at: () => $$('button').find(b => b.textContent?.includes('Content Plan') && b.textContent.includes('Approved')) || null, dy: 20 },
  ],
  clicks: [1.3, 3.85, 5.05, 6.3],
  camera: [
    { t: 0, s: 1.08, x: W / 2, y: 300 },
    { t: 1.6, s: 1.08, x: W / 2, y: 330 },
    { t: 2.6, s: 1.0, x: W / 2, y: H / 2 },
    { t: 3.4, s: 1.0, x: W / 2, y: H / 2 },
    { t: 4.0, s: 1.08, x: W / 2, y: 560 },
    { t: 5.4, s: 1.08, x: W / 2, y: 560 },
    { t: 6.1, s: 1.04, x: W / 2, y: 300 },
    { t: 8.0, s: 1.06, x: W / 2, y: 320 },
  ],
  scroll: [{ t: 0, y: 0 }, { t: 2.3, y: 0 }, { t: 3.2, y: 150 }, { t: 5.4, y: 150 }, { t: 6.0, y: 0 }],
  decorate: (t) => {
    const rows = $$('tbody tr');
    enter(rows, t, 1.5, [{ opacity: 0, transform: 'translateY(-10px)', backgroundColor: '#FFF4ED' }, { opacity: 1, transform: 'none', backgroundColor: 'rgba(255,244,237,0)' }], { duration: 700 });
    flip(rows);
    if (t > 3.7 && t < 4.6) ghosts(rows); else lastRect.clear();
    pulseOnChange($$('p.font-serif.tabular-nums'));
    const desc = byText('p', 'Approved keywords that are ready');
    if (desc) enter([desc], t, 6, RISE, { duration: 400 });
  },
};

const plan7 = () => ['answer engine optimization checklist', 'faq schema for ai overviews', 'perplexity seo ranking factors',
  'brand mentions in chatgpt', 'how to track ai search traffic', 'llm citation optimization', 'zero click search strategy']
  .map(k => kw(k, H_, { isQueued: true }));

const calendarClip: Clip = {
  duration: 7.2,
  initial: () => ({
    business: { ...baseBusiness }, suggested: initialSuggested(), queued: plan7(), editingPost: null,
    posts: [
      post('p1', 'what is generative engine optimization', 1, 'published'), post('p2', 'geo vs seo', 3, 'published'),
      post('p3', 'how to rank in chatgpt answers', 5, 'published'), post('p4', 'topical authority seo', 7, 'published'),
      post('p5', 'get cited in google ai overviews', 8, 'published'), post('p6', 'schema markup for articles', 10, 'draft', { articleContent: '<p>…</p>' }),
    ],
  }),
  view: () => panel(<CalendarTab />),
  events: [
    ...Array.from({ length: 7 }, (_, i) => [1.45 + i * 0.16, ({ set }: Api) => set(p => ({
      posts: [...p.posts, post(`n${i}`, p.queued[0].keyword, 11 + i, 'scheduled')], queued: p.queued.slice(1),
    }))] as [number, (a: Api) => void]),
    [2.7, ({ resolve }) => resolve('autofill')],
    [5.0, ({ set }) => set(p => ({ posts: p.posts.map(x => x.id === 'p6' ? { ...x, status: 'published' } : x) }))],
  ],
  cursor: [
    { t: 0, at: [W * 0.55, H * 0.55] },
    { t: 0.3, at: [W * 0.55, H * 0.55] },
    { t: 1.0, at: () => byText('button', 'Autofill from content plan') },
    { t: 2.6, at: () => byText('button', 'Autofill from content plan') },
    { t: 3.5, at: () => byText('[title]', 'perplexity seo ranking factors'), dx: -10 },
    { t: 4.3, at: () => byText('[title]', 'perplexity seo ranking factors'), dx: 10 },
    { t: 4.9, at: [W * 0.78, H * 0.86] },
    { t: 7.2, at: [W * 0.8, H * 0.88] },
  ],
  clicks: [1.2],
  camera: [
    { t: 0, s: 1.06, x: W / 2, y: 260 },
    { t: 1.5, s: 1.06, x: W / 2, y: 260 },
    { t: 2.5, s: 1.0, x: W / 2, y: H / 2 },
    { t: 3.7, s: 1.0, x: W / 2, y: H / 2 },
    { t: 4.8, s: 1.06, x: W / 2, y: 520 },
    { t: 8.0, s: 1.08, x: W / 2, y: 540 },
  ],
  decorate: (t) => {
    const c = $$('div').find(d => d.className.includes('overflow-y-auto flex-grow'));
    const oct = byText('h2', 'October 2026');
    if (c && oct) c.scrollTop += (oct.parentElement!.getBoundingClientRect().top - c.getBoundingClientRect().top) / camState.s;
    for (const id of ['page', 'panel', 'cam', 'root']) { const e = document.getElementById(id); if (e) e.scrollTop = 0; }
    document.scrollingElement!.scrollTop = 0;
    const cards = $$('[draggable="true"]');
    enter(cards, t, 1.3, [{ opacity: 0, transform: 'scale(.6) translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: POP });
    pulseOnChange($$('section[aria-label="This month"] .tabular-nums'));
    const live = byText('[title]', 'Published: schema markup');
    if (live && !seen.has(live)) {
      seen.add(live);
      live.animate([{ boxShadow: '0 0 0 0 rgba(22,163,74,.55)', transform: 'scale(1.08)' }, { boxShadow: '0 0 0 14px rgba(22,163,74,0)', transform: 'none' }], { duration: 900, easing: EASE_OUT });
    }
  },
};

const articlePost = (): ScheduledPost => post('a1', 'generative engine optimization', 10, 'draft', {
  articleContent: ARTICLE, metaTitle: 'Generative Engine Optimization: The Complete Guide',
  metaDescription: 'What GEO is, how AI search engines pick their sources, and a checklist to get your articles cited.',
  slug: 'generative-engine-optimization-guide', images: { featureImage: { url: '/cover.jpg', prompt: 'GEO guide cover' } },
});

const articleClip: Clip = {
  duration: 7.2,
  initial: () => { const p = articlePost(); return { business: { ...baseBusiness }, suggested: [], queued: [], posts: [p], editingPost: p }; },
  view: (s) => panel(<div className="absolute inset-0">{s.editingPost && <ContentGenerationScreen post={s.editingPost} onBack={() => {}} />}</div>, false),
  events: [
    [1.85, ({ resolve }) => resolve('analyzeArticleForGEO', { geoScore: 92, aiFeedback: ['Add one more primary source to the checklist section.'] })],
    [1.95, ({ resolve }) => resolve('generateMetaData', { metaTitle: 'Generative Engine Optimization: The Complete Guide', metaDescription: 'What GEO is, how AI search engines pick their sources, and a checklist to get your articles cited.', slug: 'generative-engine-optimization-guide' })],
    [4.4, ({ resolve }) => resolve('publishToWordPress', { url: 'https://acmegrowth.com/blog/generative-engine-optimization-guide', slug: 'generative-engine-optimization-guide', wpPostId: 812 })],
  ],
  cursor: [
    { t: 0, at: [W * 0.6, H * 0.6] },
    { t: 0.3, at: [W * 0.6, H * 0.6] },
    { t: 1.0, at: () => byText('button', 'Analyze GEO Score') || byText('button', 'Analyzing') },
    { t: 2.6, at: () => byText('button', 'Analyze GEO Score') || byText('button', 'Analyzing') || [W - 230, 330] },
    { t: 3.2, at: () => byText('button', 'Publish to WordPress') || byText('button', 'Publishing') },
    { t: 4.7, at: () => byText('button', 'Publish') || byText('button', 'Update Live Article') },
    { t: 5.6, at: () => $$('a').find(a => a.textContent?.includes('acmegrowth.com/blog')) || null, dx: 40 },
    { t: 7.2, at: () => $$('a').find(a => a.textContent?.includes('acmegrowth.com/blog')) || null, dx: 70 },
  ],
  clicks: [1.2, 3.45],
  camera: [
    { t: 0, s: 1.05, x: W / 2, y: 300 },
    { t: 2.7, s: 1.05, x: W / 2, y: 300 },
    { t: 3.3, s: 1.03, x: W / 2, y: 260 },
    { t: 4.4, s: 1.03, x: W / 2, y: 260 },
    { t: 5.4, s: 1.0, x: W / 2, y: H / 2 },
    { t: 8.0, s: 1.03, x: W / 2, y: 380 },
  ],
  decorate: (t) => {
    const ring = $$('svg circle').filter(c => c.getAttribute('stroke-linecap') === 'round' || c.getAttribute('strokeLinecap') === 'round' || (c as any).style.strokeDasharray)[0] as unknown as SVGCircleElement | undefined;
    if (ring && !seen.has(ring)) {
      seen.add(ring);
      const C = parseFloat(ring.style.strokeDasharray);
      ring.animate([{ strokeDashoffset: `${C}` }, { strokeDashoffset: ring.style.strokeDashoffset }], { duration: 1100, easing: EASE_OUT, fill: 'backwards' });
      w.__ringStart = t;
    }
    const num = ring?.closest('div')?.querySelector('span');
    if (num && w.__ringStart !== undefined) {
      const p = 1 - Math.pow(1 - clamp((t - w.__ringStart) / 1.1), 3);
      num.textContent = String(Math.round(92 * p));
    }
    const bar = $$('header > div').find(d => d.textContent?.includes('Copy URL'));
    if (bar) enter([bar], t, 4, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 500 });
    const live = $$('span').filter(s => s.textContent === 'Live' || s.textContent === 'Published');
    enter(live, t, 4, PopIn, { duration: 520, easing: POP, stagger: 90 });
  },
};

const CLIPS: Record<string, Clip> = { report: reportClip, keywords: keywordsClip, calendar: calendarClip, article: articleClip };
const clip = CLIPS[new URLSearchParams(location.search).get('clip') || 'report'];

// ---------------------------------------------------------------- frame engine
const camState = { s: 1, tx: 0, ty: 0 };
function cameraAt(t: number) {
  const k = clip.camera;
  let a = k[0], b = k[k.length - 1];
  for (let i = 0; i < k.length - 1; i++) if (t >= k[i].t && t <= k[i + 1].t) { a = k[i]; b = k[i + 1]; break; }
  if (t < k[0].t) b = a;
  const p = b.t > a.t ? ease(clamp((t - a.t) / (b.t - a.t))) : 1;
  const s = a.s + (b.s - a.s) * p, x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p;
  let tx = W / 2 - x * s, ty = H / 2 - y * s;
  tx = Math.min(0, Math.max(W - W * s, tx));
  ty = Math.min(0, Math.max(H - H * s, ty));
  return { s, tx, ty };
}

function targetPoint(k: CursorKey): [number, number] {
  if (Array.isArray(k.at)) return [k.at[0] * camState.s + camState.tx, k.at[1] * camState.s + camState.ty];
  const el = k.at() as Element | [number, number] | null;
  if (Array.isArray(el)) return [el[0] * camState.s + camState.tx, el[1] * camState.s + camState.ty];
  if (!el) return lastCursor;
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2 + (k.dx || 0), r.top + r.height / 2 + (k.dy || 0)];
}
let lastCursor: [number, number] = [W / 2, H / 2];
function cursorAt(t: number): [number, number] {
  const k = clip.cursor;
  let i = k.length - 2;
  for (let j = 0; j < k.length - 1; j++) if (t <= k[j + 1].t) { i = j; break; }
  const a = targetPoint(k[i]), b = targetPoint(k[i + 1]);
  const p = ease(clamp((t - k[i].t) / (k[i + 1].t - k[i].t)));
  const arc = Math.sin(p * Math.PI) * Math.min(60, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.12);
  lastCursor = [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p - arc];
  return lastCursor;
}

let apiSet: Api['set'] = () => {};
const api: Api = {
  set: (fn) => apiSet(fn),
  resolve: (name, v) => { const r = w.__pending[name]; delete w.__pending[name]; r?.(v); },
};
let ran = 0;

w.__pre = (t: number) => {
  w.__vt = t;
  while (ran < clip.events.length && clip.events[ran][0] <= t) clip.events[ran++][1](api);
  const c = cameraAt(t);
  Object.assign(camState, c);
  const cam = document.getElementById('cam')!;
  cam.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
  if (clip.scroll) {
    const k = clip.scroll;
    let y = k[k.length - 1].y;
    for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1].t) { y = k[i].y + (k[i + 1].y - k[i].y) * ease(clamp((t - k[i].t) / (k[i + 1].t - k[i].t))); break; }
    const page = document.getElementById('page');
    if (page) page.scrollTop = y;
  }
  const [x, y] = cursorAt(t);
  const down = clip.clicks.some(ct => t >= ct && t < ct + 0.1);
  return { x, y, down };
};

const raf = () => new Promise(r => requestAnimationFrame(() => r(null)));
w.__post = async (t: number) => {
  await raf(); await raf();
  clip.decorate?.(t);
  for (const a of document.getAnimations()) {
    const any = a as any;
    if (any.__s === undefined) any.__s = t;
    a.pause();
    a.currentTime = Math.max(0, (t - any.__s) * 1000);
  }
  const [x, y] = lastCursor;
  const press = clip.clicks.map(ct => t - ct).filter(d => d >= 0 && d < 0.45)[0];
  const cur = document.getElementById('cursor')!;
  const sq = press !== undefined && press < 0.16 ? 0.86 : 1;
  cur.style.transform = `translate(${x - 2}px, ${y - 2}px) scale(${sq})`;
  const rip = document.getElementById('ripple')!;
  if (press !== undefined) {
    const p = press / 0.45;
    rip.style.left = `${x}px`; rip.style.top = `${y}px`;
    rip.style.opacity = String(0.9 * (1 - p));
    rip.style.transform = `scale(${0.3 + p * 0.9})`;
  } else rip.style.opacity = '0';
  await raf();
};

const Root: React.FC = () => {
  const [s, setS] = useState<S>(clip.initial);
  apiSet = (fn) => setS(p => ({ ...p, ...fn(p) }));
  const ctx = useMockContext(s, apiSet);
  useEffect(() => { w.__ready = true; }, []);
  return (
    <AppContext.Provider value={ctx as any}>
      <div id="cam" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', background: '#F4F3EF', overflow: 'hidden' }}>
        {clip.view(s, apiSet)}
      </div>
    </AppContext.Provider>
  );
};
w.__duration = clip.duration;
createRoot(document.getElementById('root')!).render(<Root />);
