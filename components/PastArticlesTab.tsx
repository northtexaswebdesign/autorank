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
        className={`px-[18px] py-4 text-left bg-[#F7F6F3] border rounded-2xl shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(28,27,25,0.05)] transition-colors duration-150 ${
            isActive 
                ? 'border-stone-900' 
                : 'border-[#ECE9E2] hover:border-stone-300'
        }`}
    >
        <div className="flex items-start justify-between">
            <div className="text-stone-500">
                {icon}
            </div>
            <p className="font-serif text-[40px] leading-none text-stone-900 tabular-nums">{count}</p>
        </div>
        <h3 className="text-base font-semibold text-stone-800 mt-3">{label}</h3>
    </button>
));

const PastArticleRow: React.FC<{ post: ScheduledPost; onView: () => void; onDelete: () => void; }> = React.memo(({ post, onView, onDelete }) => {
    
    const statusConfig = {
        draft: { text: 'DRAFT', bg: 'bg-amber-100', textColor: 'text-amber-800' },
        published: { text: 'PUBLISHED', bg: 'bg-green-100', textColor: 'text-green-700' }
    };

    const getScoreColor = (score: number | undefined | null) => {
        if (score == null) return 'text-stone-500';
        if (score >= 75) return 'text-brand-600';
        if (score >= 35) return 'text-brand-500';
        return 'text-stone-500';
    }
    
    const currentStatus = post.status === 'published' ? statusConfig.published : statusConfig.draft;
    const displayDate = post.updatedAt ? new Date(post.updatedAt) : new Date(post.publishDate);
    const dateLabel = post.status === 'published' ? 'Published' : 'Last updated';

    return (
        <tr className="md:border-b md:border-[#F3F1EC] hover:bg-[#FBFAF7] transition-colors">
            <td data-label="Article" className="md:table-cell md:px-5 md:py-3">
                <div className="flex items-center gap-3 min-w-0">
                    {post.images?.featureImage?.url ? (
                        <img src={post.images.featureImage.url} alt="" loading="lazy" className="hidden md:block w-11 h-11 rounded-lg object-cover border border-[#ECE9E2] flex-shrink-0" />
                    ) : (
                        <span aria-hidden="true" className="hidden md:flex w-11 h-11 rounded-lg bg-[#F4F3EF] border border-[#E7E4DC] flex-shrink-0 p-1.5 flex-col justify-between overflow-hidden">
                            <span className="w-3 h-0.5 rounded-sm bg-stone-400" />
                            <span className="font-serif text-[8px] leading-[1.05] text-stone-700 line-clamp-2">{post.keyword}</span>
                        </span>
                    )}
                    <div className="min-w-0">
                        <p className="font-medium text-stone-900 md:text-left truncate">{post.keyword}</p>
                        <p className="text-xs text-stone-500 md:text-left">
                            {dateLabel} {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </td>
            <td data-label="Status" className="md:table-cell md:px-5 md:py-3">
                <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-[#ECE9E2] bg-white text-xs text-stone-700">
                    <span className={`w-1.5 h-1.5 rounded-full ${post.status === 'published' ? 'bg-green-600' : 'bg-stone-400'}`} />
                    {post.status === 'published' ? 'Live' : 'Draft'}
                </span>
            </td>
            <td className="md:table-cell md:px-5 md:py-3 md:text-right">
                <div className="flex items-center justify-end gap-1">
                    {post.publishedUrl && post.publishedUrl !== '#' && (
                        <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" title="View live article" aria-label="View live article" className="text-stone-500 hover:text-stone-900 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#ECE9E2] hover:border-stone-300 transition-colors">
                            <LinkIcon className="w-4 h-4" />
                        </a>
                    )}
                    <button onClick={onView} className="h-8 px-3 rounded-lg border border-[#ECE9E2] bg-white text-xs font-medium text-stone-900 hover:border-stone-300 transition-colors">
                        Open
                    </button>
                    <button onClick={onDelete} aria-label="Delete article" className="text-stone-400 hover:text-red-700 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors">
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
    const ARTICLES_PER_PAGE = 10;

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
            <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Articles</h1>
            <p className="mt-2.5 text-sm text-stone-500 mb-8">Everything Autorank has written for you, drafts and published.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard icon={<HistoryIcon className="w-6 h-6"/>} label="All articles" count={statCounts.all} isActive={activeFilter === 'all'} onClick={handleFilterAll} />
                <StatCard icon={<WrittenIcon className="w-6 h-6"/>} label="Drafts" count={statCounts.draft} isActive={activeFilter === 'draft'} onClick={handleFilterDraft} />
                <StatCard icon={<CheckIcon className="w-6 h-6"/>} label="Published" count={statCounts.published} isActive={activeFilter === 'published'} onClick={handleFilterPublished} />
            </div>

            <div className="bg-white border border-[#ECE9E2] rounded-2xl shadow-[0_1px_2px_rgba(28,27,25,0.05)] overflow-hidden">
                <div className="p-3 border-b border-[#ECE9E2]">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search articles..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            aria-label="Search articles" className="w-full md:w-72 h-9 bg-white border border-[#E4E1D9] rounded-lg pl-9 pr-3 text-[13px] text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                {filteredPosts.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm responsive-table">
                                <thead className="md:table-header-group">
                                    <tr className="text-left text-xs font-medium text-stone-500 bg-[#FBFAF7] border-b border-[#ECE9E2]">
                                        <th className="px-5 py-2.5">Article</th>
                                        <th className="px-5 py-2.5">Status</th>
                                        <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
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
                            <div className="flex justify-between items-center px-5 py-3 border-t border-[#ECE9E2] bg-[#FBFAF7] text-[13px]">
                                <div>
                                    <p className="text-stone-600">
                                        Showing <span className="font-semibold">{(currentPage - 1) * ARTICLES_PER_PAGE + 1}–{(currentPage - 1) * ARTICLES_PER_PAGE + paginatedPosts.length}</span> of <span className="font-semibold">{filteredPosts.length}</span> articles
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1.5 border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <span className="text-stone-600 font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1.5 border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20">
                        <SparklesIcon className="w-12 h-12 mx-auto text-stone-300 mb-4" />
                        <h2 className="font-serif text-[26px] leading-tight text-stone-900">No Articles Found</h2>
                        <p className="text-stone-500 mt-2">No articles match your current filter. Try generating some from the planner!</p>
                    </div>
                )}
            </div>
        </div>
    );
}