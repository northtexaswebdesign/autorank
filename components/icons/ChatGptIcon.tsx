
import React from 'react';

export const ChatGptIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
       <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
       <path d="M7 15.25c0 .414 .336 .75 .75 .75h8.5a.75 .75 0 0 0 .75 -.75v-8.5a.75 .75 0 0 0 -.75 -.75h-8.5a.75 .75 0 0 0 -.75 .75z"></path>
       <path d="M12 8.25v7.5"></path>
       <path d="M12 12h-3.25"></path>
       <path d="M15.25 12h-3.25"></path>
       <path d="M15.25 15v-2.25"></path>
       <path d="M8.75 15v-2.25"></path>
       <path d="M8.75 8.25v2.25"></path>
       <path d="M15.25 8.25v2.25"></path>
    </svg>
);