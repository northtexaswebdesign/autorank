import React from 'react';

// Part of the app's single icon family: 24px grid, 1.9px stroke, round caps and joins (see NavIcons.tsx).

export const KeywordIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
  </svg>
);
