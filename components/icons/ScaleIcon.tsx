import React from 'react';

// Part of the app's single icon family: 24px grid, 1.9px stroke, round caps and joins (see NavIcons.tsx).

export const ScaleIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M9.5 17.5h5" /><path d="M10.5 20.5h3" /><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2v1h5v-1c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3.5z" />
  </svg>
);
