import React from 'react';

/** Page title in the editorial serif, with an optional eyebrow line, subtitle and actions on the right. */
export const PageHeader: React.FC<{
    title: React.ReactNode;
    eyebrow?: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
}> = ({ title, eyebrow, subtitle, actions }) => (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="min-w-0">
            {eyebrow && <div className="text-xs font-medium tracking-wide text-stone-500 mb-1.5">{eyebrow}</div>}
            <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">{title}</h1>
            {subtitle && <p className="mt-2.5 text-sm text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
);
