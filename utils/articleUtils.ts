
export interface ArticleMetrics {
    wordCount: number;
    keywordDensity: string; // percentage string
    headings: number;
    images: number;
    internalLinks: number;
    externalLinks: number;
}

function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function calculateArticleMetrics(htmlContent: string, keyword: string): ArticleMetrics {
    if (!htmlContent) {
        return {
            wordCount: 0,
            keywordDensity: '0.0%',
            headings: 0,
            images: 0,
            internalLinks: 0,
            externalLinks: 0,
        };
    }

    const textContent = stripHtml(htmlContent).toLowerCase();
    const words = textContent.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    let keywordCount = 0;
    if (keyword) {
        try {
            // Escape the keyword to handle characters like '(', ')', '?', etc. without crashing
            const escapedKeyword = escapeRegExp(keyword.toLowerCase());
            const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
            const keywordMatches = textContent.match(keywordRegex);
            keywordCount = keywordMatches ? keywordMatches.length : 0;
        } catch (e) {
            console.warn("Regex match failed, falling back to simple split count", e);
            // Fallback for edge cases where boundary matching might still fail or simple check is preferred
            keywordCount = textContent.split(keyword.toLowerCase()).length - 1;
        }
    }

    const keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(1) + '%' : '0.0%';

    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    const images = doc.querySelectorAll('img').length;
    
    const links = Array.from(doc.querySelectorAll('a'));
    const internalLinks = links.filter(a => {
        const href = a.getAttribute('href');
        return href && (href.startsWith('/') || href.startsWith('#') || !/^(https|http|ftp|mailto):/.test(href));
    }).length;
    const externalLinks = links.length - internalLinks;

    return {
        wordCount,
        keywordDensity,
        headings,
        images,
        internalLinks,
        externalLinks,
    };
}
