
import React from 'react';

export const LightbulbIcon: React.FC<{ className?: string }> = ({ className }) => (
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
        <path d="M15.09 16.05A6.49 6.49 0 0 1 9 20c-3.31 0-6-2.69-6-6a6.5 6.5 0 0 1 10.39-5.44" />
        <path d="M12 2a7 7 0 0 0-2.43 13.61" />
        <path d="M12 2l.34 2.04" />
        <path d="M15.91 3.91l-1.03 1.79" />
        <path d="M19.06 7.06l-2.04.34" />
        <path d="M19.06 12l-2.04-.34" />
        <path d="M15.91 20.09l-1.03-1.79" />
        <path d="M5.04 7.06l2.04.34" />
    </svg>
);