
import React from 'react';

export const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
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
        <path d="M12 3L9.27 9.27L3 12l6.27 2.73L12 21l2.73-6.27L21 12l-6.27-2.73z"/>
        <path d="M4.5 4.5l1.5 1.5"/>
        <path d="M18 6l1.5-1.5"/>
        <path d="M18 18l1.5 1.5"/>
        <path d="M6 18l-1.5 1.5"/>
    </svg>
);
