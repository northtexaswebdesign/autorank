// In-article images, shared by the web app and the auto-publisher (plain TypeScript, no imports).
// The article HTML gets <p>[IMAGE_n]</p> placeholders (n >= 2; [IMAGE_1] is the cover) after the first paragraph
// of the section an image belongs to; at render/publish time each placeholder becomes a <figure>.

export interface ArticleSection { heading: string; text: string }

const stripTags = (html: string): string =>
    html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const norm = (s: string) => stripTags(s).toLowerCase();

const H2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;

/** The article's H2 sections: heading text and the start of their plain text (for planning images). */
export const articleSections = (html: string, max = 12, textChars = 600): ArticleSection[] => {
    const marks = [...html.matchAll(H2)].map(m => ({ heading: stripTags(m[1]), start: m.index!, end: m.index! + m[0].length }));
    return marks.slice(0, max).map((m, i) => ({
        heading: m.heading,
        text: stripTags(html.slice(m.end, i + 1 < marks.length ? marks[i + 1].start : html.length)).slice(0, textChars),
    })).filter(s => s.heading);
};

/**
 * Puts <p>[IMAGE_n]</p> after the first paragraph of the section whose H2 matches `heading` (or right after the
 * H2 when the section has no paragraph). Placements whose heading is not found, or whose placeholder is already
 * in the article, are skipped. Returns the new HTML and the numbers actually placed.
 */
export const insertImagePlaceholders = (html: string, placements: { heading: string; n: number }[]): { html: string; placed: number[] } => {
    const placed: number[] = [];
    for (const p of placements) {
        if (html.includes(`[IMAGE_${p.n}]`)) continue;
        const marks = [...html.matchAll(H2)];
        const i = marks.findIndex(m => norm(m[1]) === norm(p.heading));
        if (i < 0) continue;
        const after = marks[i].index! + marks[i][0].length;
        const sectionEnd = i + 1 < marks.length ? marks[i + 1].index! : html.length;
        const pEnd = html.slice(after, sectionEnd).search(/<\/p>/i);
        const at = pEnd >= 0 ? after + pEnd + 4 : after;
        html = `${html.slice(0, at)}\n<p>[IMAGE_${p.n}]</p>\n${html.slice(at)}`;
        placed.push(p.n);
    }
    return { html, placed };
};

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A <figure> for an in-article image, with the photo credit (linked when there is a page for it) as caption. */
export const figureHtml = (src: string, alt: string, caption?: string, creditUrl?: string, imgStyle = 'width:100%;height:auto;border-radius:8px;display:block;'): string => {
    const cap = caption
        ? `<figcaption style="font-size:0.85em;opacity:0.7;margin-top:0.5rem;">${creditUrl && /^https:\/\//.test(creditUrl) ? `<a href="${attr(creditUrl)}" target="_blank" rel="nofollow noopener">${attr(caption)}</a>` : attr(caption)}</figcaption>`
        : '';
    return `<figure style="margin:2rem 0;"><img src="${attr(src)}" alt="${attr(alt)}" style="${imgStyle}" />${cap}</figure>`;
};

/** Replaces [IMAGE_n] (and the <p> wrapped around it, since a figure cannot sit inside a paragraph). */
export const replaceImagePlaceholder = (html: string, n: number, replacement: string): string =>
    html.replace(new RegExp(`<p>\\s*\\[IMAGE_${n}\\]\\s*</p>|\\[IMAGE_${n}\\]`, 'g'), () => replacement);
