import React from 'react';

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* RankBot Body */}
    <rect x="6" y="11" width="12" height="9" rx="2" />
    
    {/* RankBot Eye */}
    <circle cx="12" cy="16" r="1" />
    
    {/* Antenna with upward-trending graph */}
    <path d="M12 11V6L14 8L16 6L18 4" />
  </svg>
);