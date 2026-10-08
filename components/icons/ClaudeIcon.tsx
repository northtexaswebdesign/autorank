
import React from 'react';

export const ClaudeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
       <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
       <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"></path>
       <path d="M12 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path>
       <path d="M12 15a6 6 0 0 0 -6 -6"></path>
    </svg>
);