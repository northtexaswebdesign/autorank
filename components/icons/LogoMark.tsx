import React from 'react';

/** The full Autorank mark: a black rounded square with a white "A" and a grey dot. */
export const LogoMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#111214" />
    <path d="M11 30L20 11l9 19" fill="none" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="20" cy="24.5" r="2.6" fill="#A1A1AA" />
  </svg>
);
