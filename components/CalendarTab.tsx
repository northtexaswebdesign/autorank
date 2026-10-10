import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Keyword, ScheduledPost } from '../types.ts';
import { getDaysInMonth, getMonthYearString, getStartDayOfMonth, isSameDay, getPostsForDate, toYYYYMMDD, fromYYYYMMDD } from '../utils/dateUtils.ts';
import { useApp } from '../context/AppContext.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ChartBarIcon } from './icons/ChartBarIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { InfoIcon } from './icons/InfoIcon.tsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A new component for the cards in the calendar
const PostCard: React.FC<{ post: ScheduledPost }> = React.memo(({ post }) => {
    const { setEditingPost, unschedulePost } = useApp();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('postId', post.id);
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent opening the editor
        unschedulePost(post.id);
    };
    
    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPost(post);
    }

    const IN_PROGRESS = { label: 'Writing', dot: 'bg-accent animate-pulse', card: 'bg-white border-[#ECE9E2]' };
    const statusConfig: { [key in ScheduledPost['status']]: { label: string; dot: string; card: string } } = {
        'scheduled': { label: 'Scheduled', dot: 'bg-blue-600', card: 'bg-[#F3F7FE] border-[#DCE6F7]' },
        'published': { label: 'Published', dot: 'bg-green-600', card: 'bg-white border-[#ECE9E2]' },
        'draft': { label: 'Draft', dot: 'bg-stone-400', card: 'bg-[#F7F6F3] border-[#ECE9E2]' },
        'generating-text': IN_PROGRESS,
        'generating-images': IN_PROGRESS,
        'analyzing': IN_PROGRESS,
        'rewriting': IN_PROGRESS,
        'brief-generating': IN_PROGRESS,
        'generating-meta': IN_PROGRESS,
    };

    const currentStatus = statusConfig[post.status] || statusConfig.scheduled;

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => setEditingPost(post)}
            title={`${currentStatus.label}: ${post.keyword}`}
            className={`group relative rounded-lg border px-2 py-1.5 cursor-pointer text-xs transition-colors hover:border-stone-400 ${currentStatus.card}`}
        >
            <div className="flex items-start gap-1.5 min-w-0">
                <span className={`mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentStatus.dot}`} aria-hidden="true" />
                <span className="sr-only">{currentStatus.label}:</span>
                <p className="font-medium text-stone-800 leading-snug line-clamp-2 break-words">{post.keyword}</p>
            </div>
            <div className="absolute top-1 right-1 hidden group-hover:flex group-focus-within:flex items-center gap-0.5 rounded-md bg-white/95 shadow-sm border border-[#ECE9E2]">
                <button onClick={handleEdit} className="p-1 text-stone-500 hover:text-stone-900 transition-colors" aria-label="Edit post">
                    <SparklesIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleDelete} className="p-1 text-stone-500 hover:text-red-700 transition-colors" aria-label="Remove from calendar">
                    <TrashIcon className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
});

const Month: React.FC<{
    month: Date;
    allPosts: ScheduledPost[];
    handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}> = React.memo(({ month, allPosts, handleDragEnter, handleDragOver, handleDragLeave, handleDrop }) => {
    const daysInMonth = getDaysInMonth(month);
    const startDay = getStartDayOfMonth(month);
    const today = new Date();

    return (
        <div className="grid grid-cols-7">
            {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="border-r border-b border-[#F0EEE9] bg-[#FBFAF7]"></div>)}
            {daysInMonth.map(day => {
                const dateString = toYYYYMMDD(day);
                const postsOnDay = getPostsForDate(day, allPosts);
                const isToday = isSameDay(day, today);
                
                return (
                    <div
                        key={day.toString()}
                        id={isToday ? 'calendar-today' : undefined}
                        data-date={dateString}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`min-h-[8rem] min-w-0 p-1.5 sm:p-2 border-r border-b border-[#F0EEE9] flex flex-col gap-1 transition-colors duration-200 ${isToday ? 'bg-[#FBFAF7]' : ''}`}
                    >
                        <span className={`self-start min-w-[22px] h-[22px] px-1 rounded-md flex items-center justify-center text-xs tabular-nums ${isToday ? 'bg-stone-900 text-white font-semibold' : 'text-stone-500'}`}>
                            {day.getDate()}
                        </span>
                        <div className="flex-grow space-y-1">
                            {postsOnDay.map(post => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    );
});


export const CalendarTab: React.FC = () => {
    const { scheduledPosts, queuedKeywords, suggestedKeywords, updateScheduledPost, schedulePostsFromContentPlan, schedulePostsFromAllKeywords } = useApp();
    const [visibleMonths, setVisibleMonths] = useState<Date[]>(() => {
        const today = new Date();
        // Start from one month before the current month to allow users to see past events.
        const firstDayOfStartMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const initialMonths: Date[] = [];
        // Show the previous month, the current month, and the next 3 future months for a total of 5.
        for (let i = 0; i < 5; i++) {
            const monthDate = new Date(firstDayOfStartMonth);
            monthDate.setMonth(monthDate.getMonth() + i);
            initialMonths.push(monthDate);
        }
        return initialMonths;
    });
    const observer = useRef<IntersectionObserver | null>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    const hasScrolledUpOnce = useRef(false);
    const didScrollToToday = useRef(false);

    useEffect(() => {
        // Scroll to today's date on initial load to center the user's view
        if (!didScrollToToday.current && visibleMonths.length > 0) {
            const timer = setTimeout(() => {
                const todayEl = document.getElementById('calendar-today');
                if (todayEl) {
                    todayEl.scrollIntoView({ block: 'center', behavior: 'auto' });
                    didScrollToToday.current = true;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [visibleMonths]);

    const loadMoreMonths = useCallback((direction: 'up' | 'down') => {
        setVisibleMonths(prevMonths => {
            if (prevMonths.length === 0) return [];
            
            if (direction === 'down') {
                const lastMonth = prevMonths[prevMonths.length - 1];
                // Create a new Date object based on the last month to avoid mutation
                const nextMonth = new Date(lastMonth);
                // Set the date to the 1st to avoid issues with different month lengths
                nextMonth.setDate(1); 
                // Then, safely set the month. JS handles the year rollover automatically.
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                return [...prevMonths, nextMonth];
            } else { // direction === 'up'
                const firstMonth = prevMonths[0];
                // Create a new Date object
                const prevMonth = new Date(firstMonth);
                // Set the date to the 1st
                prevMonth.setDate(1);
                // Set the month. JS handles year rollback.
                prevMonth.setMonth(prevMonth.getMonth() - 1);
                return [prevMonth, ...prevMonths];
            }
        });
    }, []);

    useEffect(() => {
        const options = {
            root: calendarContainerRef.current,
            rootMargin: '400px',
            threshold: 0
        };

        observer.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target === topSentinelRef.current) {
                        if (hasScrolledUpOnce.current) {
                           loadMoreMonths('up');
                        }
                        hasScrolledUpOnce.current = true;
                    } else if (entry.target === bottomSentinelRef.current) {
                        loadMoreMonths('down');
                    }
                }
            });
        }, options);

        if (topSentinelRef.current) observer.current.observe(topSentinelRef.current);
        if (bottomSentinelRef.current) observer.current.observe(bottomSentinelRef.current);

        return () => {
            observer.current?.disconnect();
        };
    }, [loadMoreMonths]);

    // one autofill at a time: a second click would schedule every keyword twice
    const [isAutofilling, setIsAutofilling] = useState(false);
    const runAutofill = async (fill: () => Promise<void>) => {
        if (isAutofilling) return;
        setIsAutofilling(true);
        try { await fill(); }
        catch (e: any) { alert(e?.message || 'Could not schedule the posts. Please try again.'); }
        finally { setIsAutofilling(false); }
    };

    const handleAutofill = async () => {
        if (queuedKeywords.length === 0) {
            alert("Your content plan is empty. Add some keywords from the planner first!");
            return;
        }
        await runAutofill(schedulePostsFromContentPlan);
    };

    const handleAutofillAll = async () => {
        if (suggestedKeywords.length === 0) {
            alert("You have no recommended keywords to schedule. Generate some in the planner first!");
            return;
        }
        await runAutofill(schedulePostsFromAllKeywords);
    };

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const postId = e.dataTransfer.getData('postId');
        const targetDateStr = e.currentTarget.dataset.date;

        if (!postId || !targetDateStr) {
            console.warn('Invalid drop target or missing post ID.');
            return;
        }
        
        // the target day in the user's timezone, keeping the post's time of day
        const postToMove = scheduledPosts.find(p => p.id === postId);
        const oldTime = postToMove ? new Date(postToMove.publishDate) : null;
        const newPublishDate = fromYYYYMMDD(targetDateStr, oldTime ? oldTime.getHours() : 9, oldTime ? oldTime.getMinutes() : 0).toISOString();

        if (!postToMove || postToMove.publishDate === newPublishDate) {
            return;
        }

        const existingPostOnTarget = scheduledPosts.find(p => p.id !== postId && isSameDay(new Date(p.publishDate), fromYYYYMMDD(targetDateStr)));

        if (existingPostOnTarget) {
            const originalDate = postToMove.publishDate;
            await Promise.all([
                updateScheduledPost(postToMove.id, { publishDate: newPublishDate }),
                updateScheduledPost(existingPostOnTarget.id, { publishDate: originalDate })
            ]);
        } else {
            await updateScheduledPost(postToMove.id, { publishDate: newPublishDate });
        }
    }, [scheduledPosts, updateScheduledPost]);

    const now = new Date();
    const thisMonth = scheduledPosts.filter(p => {
        const d = new Date(p.publishDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const publishedThisMonth = thisMonth.filter(p => p.status === 'published').length;
    const scheduledThisMonth = thisMonth.filter(p => p.status !== 'published' && p.status !== 'draft').length;

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 flex-shrink-0">
                <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Calendar</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                        onClick={handleAutofillAll}
                        disabled={suggestedKeywords.length === 0 || isAutofilling}
                        className="justify-center h-9 px-3.5 rounded-[10px] border border-stone-300 bg-white text-[13px] font-medium text-stone-900 hover:border-stone-400 hover:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed flex items-center transition-colors"
                    >
                        Autofill from all keywords <span className="ml-1.5 text-stone-500">{suggestedKeywords.length}</span>
                    </button>
                    <button
                        onClick={handleAutofill}
                        disabled={queuedKeywords.length === 0 || isAutofilling}
                        className="justify-center h-9 px-3.5 rounded-[10px] bg-stone-900 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-black disabled:bg-stone-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center transition-colors"
                    >
                        Autofill from content plan <span className="ml-1.5 text-stone-400">{queuedKeywords.length}</span>
                    </button>
                </div>
            </div>

            <section aria-label="This month" className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 mb-4 rounded-2xl bg-[#F7F6F3] border border-[#ECE9E2] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(28,27,25,0.05)] text-[13px] flex-shrink-0">
                <span className="font-semibold text-stone-900">This month</span>
                <span className="flex items-center gap-2 text-stone-600"><span className="w-2 h-2 rounded-full bg-green-600" />Published <span className="font-semibold text-stone-900 tabular-nums">{publishedThisMonth}</span></span>
                <span className="flex items-center gap-2 text-stone-600"><span className="w-2 h-2 rounded-full bg-blue-600" />Scheduled <span className="font-semibold text-stone-900 tabular-nums">{scheduledThisMonth}</span></span>
            </section>

            <div ref={calendarContainerRef} className="bg-white border border-[#ECE9E2] rounded-2xl shadow-[0_1px_2px_rgba(28,27,25,0.05)] overflow-y-auto flex-grow">
                 <div className="p-0">
                    <div ref={topSentinelRef} style={{ height: 1 }} />
                    {visibleMonths.map(month => (
                        <div key={month.getTime()}>
                             <h2 
                                className="font-serif text-[24px] leading-none text-stone-900 px-4 py-3.5 sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-[#ECE9E2]"
                                data-month-iso={month.toISOString()}
                            >
                                {getMonthYearString(month)}
                            </h2>
                             <div className="grid grid-cols-7 text-xs font-medium text-stone-500 bg-[#FBFAF7] border-b border-[#ECE9E2]">
                                {WEEKDAYS.map(day => <div key={day} className="py-2 px-2 sm:px-2.5">
                                    <span className="hidden sm:inline">{day}</span>
                                    <span className="sm:hidden">{day.charAt(0)}</span>
                                </div>)}
                            </div>
                            <Month
                                month={month}
                                allPosts={scheduledPosts}
                                handleDragEnter={handleDragEnter}
                                handleDragOver={handleDragOver}
                                handleDragLeave={handleDragLeave}
                                handleDrop={handleDrop}
                            />
                        </div>
                    ))}
                    <div ref={bottomSentinelRef} style={{ height: 1 }} />
                 </div>
            </div>
        </div>
    );
};