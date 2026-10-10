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

    const QUEUED_STATUS = { text: 'QUEUED', bg: 'bg-amber-100', text_color: 'text-amber-800' };
    const statusConfig: { [key in ScheduledPost['status']]: { text: string, bg: string, text_color: string } } = {
        'scheduled': QUEUED_STATUS,
        'published': { text: 'PUBLISHED', bg: 'bg-green-100', text_color: 'text-green-700' },
        'draft': { text: 'DRAFT', bg: 'bg-amber-100', text_color: 'text-amber-800' },
        'generating-text': QUEUED_STATUS,
        'generating-images': QUEUED_STATUS,
        'analyzing': QUEUED_STATUS,
        'rewriting': QUEUED_STATUS,
        'brief-generating': QUEUED_STATUS,
        'generating-meta': QUEUED_STATUS,
    };

    const currentStatus = statusConfig[post.status] || QUEUED_STATUS;

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => setEditingPost(post)}
            className="bg-stone-50 rounded-lg border border-stone-200 p-2.5 shadow-md hover:shadow-lg hover:border-brand-400 transition-all cursor-pointer text-sm"
        >
            <div className="flex justify-between items-center">
                <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider rounded ${currentStatus.bg} ${currentStatus.text_color}`}>
                    {currentStatus.text}
                </span>
                 <div className="flex items-center space-x-1">
                    <button onClick={handleEdit} className="p-1 text-stone-400 hover:text-stone-800 transition-colors" aria-label="Edit Post">
                        <SparklesIcon className="w-4 h-4" />
                    </button>
                    <button onClick={handleDelete} className="p-1 text-stone-400 hover:text-stone-800 transition-colors" aria-label="Delete Post">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <p className="font-semibold text-stone-800 leading-tight mt-2">{post.keyword}</p>
            
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
            {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="border-r border-b border-stone-200/80 bg-stone-50/50"></div>)}
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
                        className={`min-h-[9rem] p-2 border-r border-b border-stone-200/80 flex flex-col transition-colors duration-200`}
                    >
                        <span className={`text-xs font-semibold self-end ${isToday ? 'text-brand-600' : 'text-stone-500'}`}>
                            {day.getDate()}
                        </span>
                        <div className="flex-grow space-y-2 pt-1">
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

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6 flex-shrink-0">
                 <div>
                    <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Calendar</h1>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start md:self-end">
                     <button
                        onClick={handleAutofillAll}
                        disabled={suggestedKeywords.length === 0 || isAutofilling}
                        className="w-full sm:w-auto justify-center bg-stone-800 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-stone-900 disabled:bg-stone-400 disabled:cursor-not-allowed flex items-center transition-all shadow-sm hover:shadow-md"
                    >
                        Autofill from All Keywords ({suggestedKeywords.length})
                    </button>
                    <button
                        onClick={handleAutofill}
                        disabled={queuedKeywords.length === 0 || isAutofilling}
                        className="w-full sm:w-auto justify-center bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:bg-stone-400 disabled:cursor-not-allowed flex items-center transition-all shadow-sm hover:shadow-md"
                    >
                        Autofill from Content Plan ({queuedKeywords.length})
                    </button>
                </div>
            </div>

            <div ref={calendarContainerRef} className="bg-white border border-stone-200/80 rounded-xl shadow-sm overflow-y-auto flex-grow">
                 <div className="p-0">
                    <div ref={topSentinelRef} style={{ height: 1 }} />
                    {visibleMonths.map(month => (
                        <div key={month.getTime()}>
                             <h2 
                                className="text-lg font-semibold text-stone-800 p-4 sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-stone-200/80"
                                data-month-iso={month.toISOString()}
                            >
                                {getMonthYearString(month)}
                            </h2>
                             <div className="grid grid-cols-7 text-center text-xs font-semibold text-stone-500 bg-stone-50/80 border-b border-stone-200/80">
                                {WEEKDAYS.map(day => <div key={day} className="py-2">
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