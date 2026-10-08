import React from 'react';

export const RewriteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2.69l.34 2.03" />
    <path d="m2.5 9.5 1.58.53" />
    <path d="M20 21.31V21l-2.5-2.5" />
    <path d="M4.34 16.51 6.5 15" />
    <path d="M16.51 4.34 15 6.5" />
    <path d="M21.5 14.5h-1.51" />
    <path d="M9.5 2.5v1.51" />
    <path d="M21.31 4 21 4.34" />
    <path d="M3 20l2.5-2.5" />
    <path d="M14.5 21.5h-1.51" />
    <path d="M15 15h6v6" />
    <path d="M3 15h6v6" />
    <path d="M9 3v6H3" />
    <path d="M21 9v-6h-6" />
  </svg>
);