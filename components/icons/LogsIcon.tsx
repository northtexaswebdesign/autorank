import React from 'react';

// Part of the app's single icon family: 24px grid, 1.9px stroke, round caps and joins (see NavIcons.tsx).

export const LogsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 12h-3.5l-2.5 7.5L9 4.5 6.5 12H3" />
  </svg>
);
