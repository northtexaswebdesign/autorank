import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ScheduledPost } from '../types.ts';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { useApp } from '../context/AppContext.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import { WrittenIcon } from './icons/WrittenIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon.tsx';
import { ChevronRightIcon } from './icons/ChevronRightIcon.tsx';

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = React.memo(({ icon, label, count, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`p-4 text-left bg-gradient-to-br from-white to-slate-50 border rounded-xl shadow-lg transition-all duration-300 ease-in-out ${
            isActive 
                ? 'border-orange-400 shadow-orange-500/20' 
                : 'border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1'
        }`}
    >
        <div className="flex items-start justify-between">
            <div className="text-slate-500">
                {icon}
            </div>
            <p className="text-3xl font-bold text-slate-900">{count}</p>
        </div>
        <h3 className="text-base font-semibold text-slate-800 mt-3">{label}</h3>
    </button>
));

const PastArticleRow: React.FC<{ post: ScheduledPost; onView: () => void; onDelete: () => void; }> = React.memo(({ post, onView, onDelete }) => {
    
    const statusConfig = {
        draft: { text: 'DRAFT', bg: 'bg-amber-100', textColor: 'text-amber-800' },
        published: { text: 'PUBLISHED', bg: 'bg-green-100', textColor: 'text-green-700' }
    };

    const getScoreColor = (score: number | undefined | null) => {
        if (score == null) return 'text-slate-500';
        if (score >= 75) return 'text-orange-600';
        if (score >= 35) return 'text-orange-500';
        return 'text-stone-500';
    }
    
    const currentStatus = post.status === 'published' ? statusConfig.published : statusConfig.draft;
    const displayDate = post.updatedAt ? new Date(post.updatedAt) : new Date(post.publishDate);
    const dateLabel = post.status === 'published' ? 'Published' : 'Last updated';

    return (
        <tr className="md:border-b md:border-slate-200/80">
            <td data-label="Article" className="md:table-cell md:px-6 md:py-4">
                <p className="font-medium text-slate-800 md:text-left">{post.keyword}</p>
                <p className="text-xs text-slate-500 md:text-left">
                    {dateLabel} on {displayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
            </td>
            <td data-label="Status" className="md:table-cell md:px-6 md:py-4 text-center">
                 <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${currentStatus.bg} ${currentStatus.textColor}`}>
                    {currentStatus.text}
                </span>
            </td>
            <td className="md:table-cell md:px-6 md:py-4 md:text-right">
                <div className="flex items-center justify-end gap-1">
                    {post.publishedUrl && post.publishedUrl !== '#' && (
                        <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" title="View Live Article" className="text-slate-500 hover:text-orange-600 inline-flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 transition-colors">
                            <LinkIcon className="w-4 h-4" />
                        </a>
                    )}
                    <button onClick={onView} className="bg-orange-100 text-orange-700 px-4 py-2 text-sm rounded-lg font-semibold hover:bg-orange-200 transition-colors">
                        View Article
                    </button>
                    <button onClick={onDelete} className="text-slate-500 hover:text-slate-800 inline-flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

export const PastArticlesTab: React.FC = () => {
    const { scheduledPosts, setEditingPost, deleteScheduledPost } = useApp();
    const [activeFilter, setActiveFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ARTICLES_PER_PAGE = 20;

    const pastArticles = useMemo(() => {
        return scheduledPosts
            .filter(p => p.status === 'draft' || p.status === 'published')
            .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
    }, [scheduledPosts]);
    
    const filteredPosts = useMemo(() => {
        let filtered = pastArticles;

        if (activeFilter !== 'all') {
            filtered = filtered.filter(p => p.status === activeFilter);
        }

        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.keyword.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return filtered;
    }, [pastArticles, activeFilter, searchTerm]);
    
    const statCounts = useMemo(() => ({
        all: pastArticles.length,
        draft: pastArticles.filter(p => p.status === 'draft').length,
        published: pastArticles.filter(p => p.status === 'published').length,
    }), [pastArticles]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter, searchTerm]);

    const paginatedPosts = useMemo(() => {
        const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
        return filteredPosts.slice(startIndex, startIndex + ARTICLES_PER_PAGE);
    }, [currentPage, filteredPosts]);
    
    const totalPages = Math.ceil(filteredPosts.length / ARTICLES_PER_PAGE);

    const handleDelete = (post: ScheduledPost) => {
        deleteScheduledPost(post.id);
    };
    
    const handleFilterAll = useCallback(() => setActiveFilter('all'), []);
    const handleFilterDraft = useCallback(() => setActiveFilter('draft'), []);
    const handleFilterPublished = useCallback(() => setActiveFilter('published'), []);

    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Past Articles</h1>
            <p className="mt-1 text-slate-600 mb-8">Manage all your written and published content.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard icon={<HistoryIcon className="w-6 h-6"/>} label="All Past Articles" count={statCounts.all} isActive={activeFilter === 'all'} onClick={handleFilterAll} />
                <StatCard icon={<WrittenIcon className="w-6 h-6"/>} label="Written (Drafts)" count={statCounts.draft} isActive={activeFilter === 'draft'} onClick={handleFilterDraft} />
                <StatCard icon={<CheckIcon className="w-6 h-6"/>} label="Published" count={statCounts.published} isActive={activeFilter === 'published'} onClick={handleFilterPublished} />
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200/80">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search articles..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-72 bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                {filteredPosts.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm responsive-table">
                                <thead className="md:table-header-group">
                                    <tr className="text-left text-sm font-semibold text-slate-500 bg-slate-50">
                                        <th className="px-6 py-3">Article</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPosts.map(post => (
                                        <PastArticleRow 
                                            key={post.id} 
                                            post={post} 
                                            onView={() => setEditingPost(post)}
                                            onDelete={() => handleDelete(post)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center p-4 border-t border-slate-200/80 text-sm">
                                <div>
                                    <p className="text-slate-600">
                                        Showing <span className="font-semibold">{paginatedPosts.length}</span> of <span className="font-semibold">{filteredPosts.length}</span> articles
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <span className="text-slate-600 font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20">
                        <SparklesIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h2 className="text-xl font-bold text-slate-700">No Articles Found</h2>
                        <p className="text-slate-500 mt-2">No articles match your current filter. Try generating some from the planner!</p>
                    </div>
                )}
            </div>
        </div>
    );
}