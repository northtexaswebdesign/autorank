import React from 'react';

interface SimpleMarkdownRendererProps {
    text: string;
    as?: 'span' | 'p' | 'li' | 'div';
    className?: string;
}

export const SimpleMarkdownRenderer: React.FC<SimpleMarkdownRendererProps> = ({ text, as = 'span', className }) => {
    const Component = as;
    
    const createMarkup = () => {
        if (!text) return { __html: '' };
        
        const html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
            
        return { __html: html };
    };

    return <Component className={className} dangerouslySetInnerHTML={createMarkup()} />;
};
