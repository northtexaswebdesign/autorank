
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { LightbulbIcon } from './icons/LightbulbIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { ScheduledPost } from '../types.ts';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';

// Helper component for the stat cards
const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    colorClass: string;
}> = ({ title, value, subtitle, icon, colorClass }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-full transition-all hover:shadow-md">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 mt-1">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
                {React.isValidElement(icon) 
                    ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 ${colorClass.replace('bg-', 'text-')}` })
                    : icon}
            </div>
        </div>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
);

const RecentArticleItem: React.FC<{ post: ScheduledPost }> = ({ post }) => (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors -mx-2 px-2 rounded-lg">
        <div className="flex items-start gap-3 overflow-hidden">
            <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate pr-4">{post.keyword}</p>
                <p className="text-xs text-slate-500 mt-0.5">Published on {new Date(post.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
        </div>
        {(post.publishedUrl || post.published_url) && (post.publishedUrl || post.published_url) !== '#' && (
             <a 
                href={post.publishedUrl || post.published_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-shrink-0 text-xs font-medium text-slate-500 hover:text-orange-600 flex items-center transition-colors px-3 py-1.5 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm"
            >
                View Live <LinkIcon className="w-3 h-3 ml-1.5" />
            </a>
        )}
    </div>
);

export const DashboardTab: React.FC = () => {
    const { scheduledPosts, selectedBusiness, setActiveTab, suggestedKeywords, queuedKeywords } = useApp();

    // --- Calculations ---

    // 1. Keyword Counts
    const allKeywordsCount = suggestedKeywords.length + queuedKeywords.length;
    const contentPlanCount = queuedKeywords.length;

    // 2. Next Scheduled Post
    const nextScheduledPost = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Compare against start of today to include today's pending posts

        const upcoming = scheduledPosts
            .filter(p => p.status !== 'published' && new Date(p.publishDate) >= today)
            .sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime());
        
        return upcoming.length > 0 ? upcoming[0] : null;
    }, [scheduledPosts]);

    // 3. System Health
    const isAutoScheduleOn = selectedBusiness?.autoSchedule || false;

    // 4. Recent Published Posts (Limit to 5)
    const recentPublishedPosts = useMemo(() => {
        return scheduledPosts
            .filter(p => p.status === 'published')
            .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
            .slice(0, 5);
    }, [scheduledPosts]);


    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-600 mt-1">Welcome back, {selectedBusiness?.name}. Here's your content automation overview.</p>
                </div>
                <div className="flex items-center bg-white border border-slate-200/80 px-4 py-2 rounded-lg shadow-sm">
                    <div className={`w-3 h-3 rounded-full mr-2 ${isAutoScheduleOn ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    <span className="text-sm font-medium text-slate-700">
                        Auto-Schedule: <span className={isAutoScheduleOn ? 'text-green-600' : 'text-slate-500'}>{isAutoScheduleOn ? 'Active' : 'Paused'}</span>
                    </span>
                    {!isAutoScheduleOn && (
                         <button 
                            onClick={() => setActiveTab('settings')} 
                            className="ml-3 text-xs text-orange-600 hover:underline font-medium"
                        >
                            Enable
                        </button>
                    )}
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1: All Keywords */}
                <StatCard
                    title="All Keywords"
                    value={allKeywordsCount}
                    subtitle="Total opportunities discovered"
                    icon={<KeywordIcon />}
                    colorClass="bg-blue-500 text-blue-600"
                />

                {/* Metric 2: Content Plan */}
                <StatCard
                    title="Content Plan"
                    value={contentPlanCount}
                    subtitle="Keywords ready to schedule"
                    icon={<LightbulbIcon />}
                    colorClass="bg-amber-500 text-amber-600"
                />

                {/* Timeline Metric */}
                <StatCard
                    title="Next Scheduled Post"
                    value={nextScheduledPost ? new Date(nextScheduledPost.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "None Scheduled"}
                    subtitle={nextScheduledPost ? nextScheduledPost.keyword : "Add to your calendar"}
                    icon={<CalendarIcon />}
                    colorClass="bg-orange-500 text-orange-600"
                />
            </div>

            {/* Secondary Section: Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Recent Published Articles Feed */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center">
                            <HistoryIcon className="w-5 h-5 mr-2 text-slate-400" />
                            Recently Published Articles
                        </h2>
                        <button onClick={() => setActiveTab('past-articles')} className="text-sm text-orange-600 hover:text-orange-700 font-medium hover:underline">
                            View All
                        </button>
                    </div>
                    <div className="space-y-1">
                        {recentPublishedPosts.length > 0 ? (
                            recentPublishedPosts.map(post => <RecentArticleItem key={post.id} post={post} />)
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-500">No articles published yet.</p>
                                <button 
                                    onClick={() => setActiveTab('planner')}
                                    className="mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
                                >
                                    Start generating content
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions / Status */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl shadow-sm p-6 flex flex-col">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                        <SparklesIcon className="w-5 h-5 mr-2 text-orange-500" />
                        Quick Actions
                    </h2>
                    <div className="space-y-3 flex-grow">
                         <button 
                            onClick={() => setActiveTab('planner')}
                            className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                            <span className="block font-semibold text-slate-800 group-hover:text-orange-600">Generate Ideas</span>
                            <span className="text-xs text-slate-500">Find new high-value keywords</span>
                        </button>
                        
                        <button 
                            onClick={() => setActiveTab('calendar')}
                            className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                            <span className="block font-semibold text-slate-800 group-hover:text-orange-600">Manage Schedule</span>
                            <span className="text-xs text-slate-500">Review upcoming posts</span>
                        </button>

                        <button 
                            onClick={() => setActiveTab('past-articles')}
                            className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                            <span className="block font-semibold text-slate-800 group-hover:text-orange-600">View History</span>
                            <span className="text-xs text-slate-500">See all published content</span>
                        </button>
                    </div>
                    
                    {!selectedBusiness?.autoSchedule && (
                        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs text-amber-800 font-medium flex items-start">
                                <span className="mr-2 text-lg leading-none">⚠️</span>
                                Automation is paused. Articles will not publish automatically.
                            </p>
                            <button onClick={() => setActiveTab('settings')} className="text-xs text-amber-700 underline mt-1 ml-6">Enable in Settings</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
