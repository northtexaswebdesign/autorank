import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ScheduledPost } from '../types.ts';
import { PageHeader } from './common/PageHeader.tsx';
import { StatCard } from './common/StatCard.tsx';
import { NavArrowUpRightIcon, NavPlusIcon } from './icons/NavIcons.tsx';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Which step of writing a post is on, for the "writing now" card. -1 = not started yet. */
const STEPS = ['Research', 'Draft', 'Cover image', 'Publish'];
const stepIndex = (status: ScheduledPost['status']): number => {
    switch (status) {
        case 'brief-generating':
        case 'analyzing': return 0;
        case 'generating-text':
        case 'rewriting':
        case 'generating-meta': return 1;
        case 'generating-images': return 2;
        default: return -1;
    }
};

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const coverUrl = (post: ScheduledPost) => post.images?.featureImage?.url;
const liveUrl = (post: ScheduledPost) => {
    const url = post.publishedUrl || post.published_url;
    return url && url !== '#' ? url : undefined;
};

/** Typographic stand-in used when an article has no cover image yet. */
const COVER_LOOKS = [
    'bg-stone-900 text-white border-stone-900',
    'bg-[#F4F3EF] text-stone-900 border-[#E7E4DC]',
    'bg-[#E9E6DE] text-stone-900 border-[#DCD8CD]',
    'bg-[#2A2B30] text-[#F4F3EF] border-[#2A2B30]',
];
const CoverFallback: React.FC<{ title: string; look: number; className?: string }> = ({ title, look, className = '' }) => (
    <span aria-hidden="true" className={`flex flex-col justify-between p-4 rounded-xl border ${COVER_LOOKS[look % COVER_LOOKS.length]} ${className}`}>
        <span className="w-6 h-[3px] rounded-sm bg-current opacity-60" />
        <span className="font-serif text-[21px] leading-[1.08] line-clamp-4">{title}</span>
    </span>
);

const RecentArticleCard: React.FC<{ post: ScheduledPost; index: number }> = ({ post, index }) => {
    const url = liveUrl(post);
    const img = coverUrl(post);
    const date = new Date(post.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const inner = (
        <>
            {img
                ? <img src={img} alt="" loading="lazy" className="aspect-square w-full object-cover rounded-xl border border-[#E7E4DC] shadow-[0_1px_2px_rgba(28,27,25,0.06)] transition-transform duration-300 group-hover:-translate-y-0.5" />
                : <CoverFallback title={post.metaTitle || post.keyword} look={index} className="aspect-square shadow-[0_1px_2px_rgba(28,27,25,0.06)] transition-transform duration-300 group-hover:-translate-y-0.5" />}
            <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[13px] font-medium text-stone-900 truncate">{post.metaTitle || post.keyword}</span>
                <span className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600" />Live · {date}
                    {url && <NavArrowUpRightIcon className="w-3 h-3 ml-auto text-stone-400 group-hover:text-stone-900" />}
                </span>
            </span>
        </>
    );
    return url
        ? <a href={url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2.5 min-w-0">{inner}</a>
        : <div className="group flex flex-col gap-2.5 min-w-0">{inner}</div>;
};

const NextArticleCard: React.FC<{ post: ScheduledPost | null; onPlan: () => void; onCalendar: () => void }> = ({ post, onPlan, onCalendar }) => {
    if (!post) {
        return (
            <section className="rounded-2xl bg-stone-900 text-white px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_12px_32px_rgba(17,18,20,0.18)]">
                <div>
                    <div className="text-xs text-stone-400">Nothing scheduled</div>
                    <h2 className="font-serif text-3xl leading-tight mt-1.5">Give Autorank something to write.</h2>
                </div>
                <button onClick={onPlan} className="self-start sm:self-auto h-9 px-4 rounded-[10px] bg-white text-stone-900 text-[13px] font-medium hover:bg-stone-100 transition-colors">Plan articles</button>
            </section>
        );
    }
    const step = stepIndex(post.status);
    const writing = step >= 0;
    const when = new Date(post.publishDate);
    const today = new Date();
    const isToday = when.toDateString() === today.toDateString();
    const whenText = isToday ? 'publishes today' : `publishes ${when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    const img = coverUrl(post);

    return (
        <section aria-labelledby="next-article" className="relative overflow-hidden rounded-2xl bg-stone-900 text-white px-6 py-[22px] flex flex-wrap items-center gap-6 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_12px_32px_rgba(17,18,20,0.18)]">
            <div className="flex-1 min-w-[260px] flex flex-col gap-3.5">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span className={`w-[7px] h-[7px] rounded-full bg-accent ${writing ? 'animate-pulse' : ''}`} />
                    {writing ? `Autorank is writing your next article · ${whenText}` : `Up next · ${whenText}`}
                </div>
                <h2 id="next-article" className="font-serif text-[30px] leading-[1.1]">{post.metaTitle || post.keyword}</h2>
                <ol aria-label="Progress" className="flex flex-wrap gap-1.5">
                    {STEPS.map((label, i) => {
                        const done = writing && i < step;
                        const active = writing && i === step;
                        return (
                            <li key={label} className={`flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-xs border ${
                                active ? 'bg-[#1E1F23] border-[#3A3A3F] text-white' : done ? 'border-[#2E2F34] text-white' : 'border-[#232428] text-[#8B8B93]'
                            }`}>
                                {done && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                                {active && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                                {label}
                            </li>
                        );
                    })}
                </ol>
                {writing ? (
                    <div className="relative h-[3px] rounded-full bg-[#26272B] overflow-hidden">
                        <div className="h-[3px] rounded-full bg-white transition-all" style={{ width: `${Math.max(10, post.progress ?? ((step + 0.5) / STEPS.length) * 100)}%` }} />
                        <div className="ar-shimmer absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    </div>
                ) : (
                    <button onClick={onCalendar} className="self-start text-xs font-medium text-stone-300 hover:text-white">View calendar →</button>
                )}
            </div>
            {img ? (
                <img src={img} alt="" className="w-[168px] h-[168px] object-cover rounded-xl rotate-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hidden sm:block" />
            ) : (
                <CoverFallback title={post.metaTitle || post.keyword} look={1} className="w-[168px] h-[168px] rotate-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hidden sm:flex" />
            )}
        </section>
    );
};

export const DashboardTab: React.FC = () => {
    const { scheduledPosts, selectedBusiness, setActiveTab, suggestedKeywords, queuedKeywords, userProfile } = useApp();

    const nextPost = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // include today's posts that have not gone out yet
        return scheduledPosts
            .filter(p => p.status !== 'published' && p.status !== 'draft' && new Date(p.publishDate) >= today)
            .sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime())[0] || null;
    }, [scheduledPosts]);

    const published = useMemo(() => scheduledPosts
        .filter(p => p.status === 'published')
        .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()), [scheduledPosts]);

    // published articles per week for the last 8 weeks, oldest first
    const publishedTrend = useMemo(() => {
        const now = Date.now();
        const weeks = new Array(8).fill(0);
        published.forEach(p => {
            const age = Math.floor((now - new Date(p.publishDate).getTime()) / WEEK_MS);
            if (age >= 0 && age < 8) weeks[7 - age]++;
        });
        return weeks;
    }, [published]);

    const now = new Date();
    const publishedThisMonth = published.filter(p => {
        const d = new Date(p.publishDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const draftCount = scheduledPosts.filter(p => p.status === 'draft').length;
    const allKeywords = suggestedKeywords.length + queuedKeywords.length;
    const firstName = (userProfile?.fullName || '').trim().split(/\s+/)[0];
    const autoOn = !!selectedBusiness?.autoSchedule;

    return (
        <div>
            <PageHeader
                eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                title={<>{greeting()}{firstName ? <>, <span className="italic">{firstName}</span></> : ''}</>}
                actions={<>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="flex items-center gap-2 h-8 px-3 rounded-full border border-[#E7E4DC] text-xs text-stone-600 hover:border-stone-300 transition-colors"
                        title={autoOn ? 'Articles publish automatically' : 'Turn on in Business profile'}
                    >
                        <span className={`w-[7px] h-[7px] rounded-full ${autoOn ? 'bg-accent animate-pulse' : 'bg-stone-400'}`} />
                        {autoOn ? 'Auto-publish on · every 2 hours' : 'Auto-publish paused'}
                    </button>
                    <button
                        onClick={() => setActiveTab('planner')}
                        className="flex items-center gap-1.5 h-[34px] px-3.5 rounded-[10px] bg-stone-900 text-white text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-black transition-colors"
                    >
                        <NavPlusIcon className="w-3.5 h-3.5" />
                        New article
                    </button>
                </>}
            />

            <div className="flex flex-col gap-5">
                <NextArticleCard post={nextPost} onPlan={() => setActiveTab('planner')} onCalendar={() => setActiveTab('calendar')} />

                <section aria-label="Overview" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <StatCard label="Keywords found" value={allKeywords} hint={`${suggestedKeywords.length} waiting to be planned`} onClick={() => setActiveTab('planner')} />
                    <StatCard label="In content plan" value={queuedKeywords.length} hint={queuedKeywords.length ? 'Ready to schedule' : 'Add keywords to keep publishing'} onClick={() => setActiveTab('planner')} />
                    <StatCard label="Published" value={published.length} hint={`${publishedThisMonth} this month`} trend={publishedTrend} onClick={() => setActiveTab('past-articles')} />
                    <StatCard label="Drafts" value={draftCount} hint={draftCount ? 'Waiting for a date' : 'None waiting'} onClick={() => setActiveTab('past-articles')} />
                </section>

                <section aria-labelledby="recent-articles" className="flex flex-col gap-3 mt-2">
                    <div className="flex items-baseline justify-between">
                        <h2 id="recent-articles" className="font-serif text-[26px] text-stone-900">Recent articles</h2>
                        <button onClick={() => setActiveTab('past-articles')} className="text-xs font-medium text-stone-600 hover:text-stone-900">View all →</button>
                    </div>
                    {published.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {published.slice(0, 4).map((post, i) => <RecentArticleCard key={post.id} post={post} index={i} />)}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
                            <p className="font-serif text-2xl text-stone-900">Your first article is one click away.</p>
                            <p className="text-sm text-stone-500 mt-1.5">Pick a keyword and Autorank writes, illustrates and publishes it for you.</p>
                            <button onClick={() => setActiveTab('planner')} className="mt-4 h-9 px-4 rounded-[10px] bg-stone-900 text-white text-[13px] font-medium hover:bg-black">Find keywords</button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
