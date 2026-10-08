
import React from 'react';

export const PerplexityIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
       <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
       <path d="M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18z"></path>
       <path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"></path>
    </svg>
);