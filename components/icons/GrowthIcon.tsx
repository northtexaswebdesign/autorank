
import React from 'react';

export const GrowthIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
       <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
       <path d="M16.5 15h-13a.5 .5 0 0 0 0 1h13a.5 .5 0 0 0 0 -1z"></path>
       <path d="M17 15.5a2.5 2.5 0 0 0 0 -5a2.5 2.5 0 0 0 -2.5 -2.5a2.5 2.5 0 0 0 -2.5 2.5a2.5 2.5 0 0 0 0 5"></path>
       <path d="M17 10.5a2.5 2.5 0 0 1 0 -5a2.5 2.5 0 0 1 2.5 -2.5a2.5 2.5 0 0 1 2.5 2.5a2.5 2.5 0 0 1 0 5"></path>
       <path d="M12 8a2.5 2.5 0 0 0 0 5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5 -2.5a2.5 2.5 0 0 0 0 -5"></path>
       <path d="M7 10.5a2.5 2.5 0 0 0 0 -5a2.5 2.5 0 0 0 -2.5 -2.5a2.5 2.5 0 0 0 -2.5 2.5a2.5 2.5 0 0 0 0 5"></path>
    </svg>
);