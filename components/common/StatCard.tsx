import React from 'react';

/** Small line chart for a stat card. `values` are plotted left to right, scaled to the largest value. */
export const Sparkline: React.FC<{ values: number[]; className?: string }> = ({ values, className }) => {
    if (values.length < 2) return null;
    const max = Math.max(...values, 1);
    const step = 80 / (values.length - 1);
    const points = values.map((v, i) => `${(2 + i * step).toFixed(1)},${(26 - (v / max) * 22).toFixed(1)}`).join(' ');
    return (
        <svg width="84" height="28" viewBox="0 0 84 28" fill="none" className={className} aria-hidden="true">
            <polyline points={points} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

/** Warm grey stat card with a serif number. Clickable when `onClick` is given. */
export const StatCard: React.FC<{
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
    trend?: number[];
    onClick?: () => void;
    selected?: boolean;
    children?: React.ReactNode;
}> = ({ label, value, hint, trend, onClick, selected, children }) => {
    const body = (
        <>
            <span className="flex items-center justify-between text-xs font-medium text-stone-600">
                {label}
                {onClick && <span className="text-stone-400" aria-hidden="true">→</span>}
            </span>
            <span className="flex items-end justify-between gap-2.5">
                <span className="font-serif text-[44px] leading-[0.95] text-stone-900 tabular-nums truncate">{value}</span>
                {trend && <Sparkline values={trend} className="text-stone-900 flex-shrink-0" />}
            </span>
            {hint && <span className="text-xs text-stone-500">{hint}</span>}
            {children}
        </>
    );
    const cls = `text-left bg-[#F7F6F3] border rounded-2xl px-[18px] py-4 flex flex-col gap-1.5 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(28,27,25,0.05)] ${
        selected ? 'border-stone-900' : 'border-[#ECE9E2]'
    }`;
    return onClick
        ? <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} transition-colors hover:border-stone-300`}>{body}</button>
        : <div className={cls}>{body}</div>;
};
