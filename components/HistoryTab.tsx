//- unused
import React, { useState, useMemo, useEffect } from 'react';
import { ScheduledPost } from '../types.ts';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { useApp } from '../context/AppContext.tsx';
// FIX: Removed unused import for 'parseYYYYMMDD' which was causing a compile error.
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon.tsx';
import { ChevronRightIcon } from './icons/ChevronRightIcon.tsx';

interface HistoryTabProps {
  posts: ScheduledPost[];
}

const PostHistoryItem: React.FC<{ post: ScheduledPost; onView: () => void; onDelete: () => void; }> = React.memo(({ post, onView, onDelete }) => {
    
    const getScoreColor = (score: number | undefined | null) => {
        if (score == null) return 'text-slate-500';
        if (score >= 75) return 'text-orange-600';
        if (score >= 35) return 'text-orange-500';
        return 'text-stone-500';
    }

    return (
        <tr className="border-b border-slate-200/80">
            <td className="px-6 py-4">
                <p className="font-medium text-slate-800">{post.keyword}</p>
                <p className="text-xs text-slate-500">
                    {/* FIX: Replaced the non-existent 'parseYYYYMMDD' with the standard new Date() constructor to correctly parse the ISO date string. */}
                    Published on {new Date(post.publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </p>
            </td>
            <td className="px-6 py-4 text-center">
                 {post.impressions != null && post.clicks != null ? (
                    <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
                        <span><span className="font-bold">{post.impressions.toLocaleString()}</span> Imp.</span>
                        <span><span className="font-bold">{post.clicks}</span> Clicks</span>
                    </div>
                ) : (
                    <span className="text-xs text-slate-400 italic">No data</span>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                    {/* FIX: Corrected property access from 'publishedUrl' to 'published_url' to match the type definition. */}
                    {post.publishedUrl && post.publishedUrl !== '#' && (
                        <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-orange-600 inline-flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 transition-colors">
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

export const HistoryTab: React.FC<HistoryTabProps> = ({ posts }) => {
    const { setEditingPost, deleteScheduledPost } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ARTICLES_PER_PAGE = 20;

    const publishedPosts = useMemo(() => {
        // FIX: Corrected property access from 'publishedUrl' to 'published_url' to match the type definition.
        return posts
            .filter(p => p.status === 'published' && p.publishedUrl && p.publishedUrl !== '#')
            .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
    }, [posts]);

    const filteredPosts = useMemo(() => {
        if (!searchTerm) return publishedPosts;
        return publishedPosts.filter(p =>
            p.keyword.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [publishedPosts, searchTerm]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const paginatedPosts = useMemo(() => {
        const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
        return filteredPosts.slice(startIndex, startIndex + ARTICLES_PER_PAGE);
    }, [currentPage, filteredPosts]);
    
    const totalPages = Math.ceil(filteredPosts.length / ARTICLES_PER_PAGE);

    const handleDelete = (post: ScheduledPost) => {
        deleteScheduledPost(post.id);
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Article History</h1>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search articles..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
                {filteredPosts.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm font-semibold text-slate-500 bg-slate-50">
                                        <th className="px-6 py-3">Article</th>
                                        <th className="px-6 py-3 text-center">Performance</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPosts.map(post => (
                                        <PostHistoryItem 
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
                        <h2 className="text-xl font-bold text-slate-700">No Published Articles Yet</h2>
                        <p className="text-slate-500 mt-2">Once you publish articles to your CMS, they will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};