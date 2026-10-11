import React from 'react';

// Part of the app's single icon family: 24px grid, 1.9px stroke, round caps and joins (see NavIcons.tsx).

export const HamburgerIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />
  </svg>
);
