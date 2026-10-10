import type { ScheduledPost } from '../types.ts';

export const toYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** A 'YYYY-MM-DD' day as a local date (new Date('YYYY-MM-DD') would be UTC midnight, the previous day in the US). */
export const fromYYYYMMDD = (day: string, hours = 9, minutes = 0): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes);
};

export const getDaysInMonth = (date: Date): Date[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
};

export const getMonthYearString = (date: Date): string => {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

export const getStartDayOfMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const getPostsForDate = (date: Date, posts: ScheduledPost[]): ScheduledPost[] => {
    if (!posts || !Array.isArray(posts)) return [];
    return posts.filter(post => {
        if (!post.publishDate) return false;
        // Convert the ISO string from the database into a local Date object for comparison.
        const postDate = new Date(post.publishDate);
        if (isNaN(postDate.getTime())) return false;
        return isSameDay(date, postDate);
    });
};
