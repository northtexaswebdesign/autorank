import React from 'react';

// Part of the app's single icon family: 24px grid, 1.9px stroke, round caps and joins (see NavIcons.tsx).

export const ChatbotIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.6a8 8 0 1 1 15.1-3.9z" /><path d="M8.5 11.5h.01" /><path d="M12.5 11.5h.01" /><path d="M16.5 11.5h.01" />
  </svg>
);
