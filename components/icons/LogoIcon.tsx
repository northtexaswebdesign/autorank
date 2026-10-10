import React from 'react';

/** The Autorank "A" glyph (a summit with a dot marking the top spot). Inherits the text colour. */
export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M5.5 19.5L12 5l6.5 14.5" />
    <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" opacity="0.6" />
  </svg>
);
