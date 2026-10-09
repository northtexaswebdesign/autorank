/**
 * Article quality helpers shared by the web app (services/aiService.ts) and the auto-publisher edge function.
 * Pure TypeScript: no DOM, no Deno or Node APIs except fetch, so it runs in the browser, Deno and Node.
 * (api/claude.ts keeps its own small copy of the server-side link check because relative imports break
 * in the Vercel function.)
 *
 * Everything here is topic-agnostic: nothing assumes a particular business, product or industry.
 */

// ---------------------------------------------------------------- prompt rules

export const ARTICLE_MIN_WORDS = 1500;
export const ARTICLE_MAX_WORDS = 2000;

/** How many times the exact keyword phrase may appear in a body of `words` words (about one per 250 words). */
export const keywordBudget = (words = 1800): number => Math.max(4, Math.round(words / 250));

export const keywordRules = (keyword: string, words = 1800): string => `KEYWORD USE (strict):
    - The exact phrase "${keyword}" belongs in: the H1, the first paragraph, and at most 2 later places (at most one H2). That is all.
    - Everywhere else use natural variants: shorter forms, synonyms, related terms, or "it" / "this" / "these". Never repeat the exact phrase in heading after heading.
    - Never use the exact phrase more than ${keywordBudget(words)} times in the whole article. Write for a reader first; stuffing hurts rankings.
    - Cover the topic's related questions and subtopics (the terms people also search for) so the article is complete without repeating the phrase.`;

export const SOURCE_RULES = `CREDIBLE SOURCES (strict):
    - Every statistic, number, study result, legal or regulatory claim, and "experts say" claim MUST be backed by a source you found with your search tool, linked inline as <a href="URL" target="_blank" rel="noopener">descriptive anchor text</a>. Use only URLs exactly as they appear in your search results. Never guess, shorten or reconstruct a URL. Links that were not in your search results are removed automatically.
    - Name the source and year in the sentence, for example: According to the U.S. Bureau of Labor Statistics (2025), ...
    - Prefer: government (.gov), universities (.edu), peer-reviewed research, official standards bodies and industry bodies, professional associations, and well-known publications or data providers.
    - Avoid: competitors, content farms, anonymous blogs, press-release sites, forums and social posts.
    - Use 4 to 8 different outside sources in total, from at least 3 different publishers.
    - If the topic touches health, safety, money or legal matters, cite at least one authoritative body for the core guidance.
    - If you cannot find a credible source for a claim, remove the claim or rewrite it as general guidance without numbers. Never invent statistics, quotes, studies, or URLs.
    - After the FAQ section, add <h2>Sources</h2> followed by a <ul> listing each source you linked: publisher, title, year, with the link.`;

export const TRUST_RULES = `TRUST AND HONESTY (strict):
    - Do not invent an author, credentials, personal experience, testing, case studies, reviews, customer quotes or awards. Do not write "we tested" or "in our experience" unless the business context above states it.
    - Product or service facts about the business come only from the business context provided. Anything not stated there, say plainly that readers should confirm it with the provider.
    - Be even-handed: say what a solution does not do as well as what it does. Do not exaggerate.
    - Never write meta-commentary about the article or its format (for example "no diagram is needed", "as an AI", "in this article we will"). Do not add a "last updated" line or schema markup; those are added automatically.`;

export const STRUCTURE_RULES = `STRUCTURE FOR SEARCH AND AI ANSWERS:
    - Open with a 40-60 word direct answer to the main question, then the summary section. Each section should open with a self-contained sentence that answers its heading, so it can be quoted on its own.
    - Use descriptive headings (many as questions), short paragraphs, and lists or tables where they make comparisons or steps clearer.
    - Be specific: give concrete numbers, ranges, steps or examples (sourced if they are facts). Add information a reader would not get from a generic overview, such as a decision checklist, common mistakes, or a worked example.
    - Match the search intent: if people searching this phrase are choosing between options, include how to compare them and what to check before choosing.`;

export const buildRepairPrompt = (html: string, issues: LintIssue[]): string => `Edit the article HTML below to fix ONLY these problems. Keep everything else, including headings, structure, every existing <a> link, and the Sources section.

Problems to fix:
${issues.map(i => `- ${i.message}`).join('\n')}

Rules: do not add new facts, statistics, quotes or links. If a number has no link next to it, remove the number or reword it as general guidance. Reduce repeated exact-phrase use by using natural variants. Return ONLY the full corrected HTML, no commentary, no code fences.

ARTICLE HTML:
${html}`;

// ---------------------------------------------------------------- text helpers

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#8217;': "'", '&#8220;': '"', '&#8221;': '"' };

export const stripTags = (html: string): string =>
    html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m.toLowerCase()] ?? ' ')
        .replace(/\s+/g, ' ')
        .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countPhrase = (text: string, phrase: string): number =>
    phrase.trim() ? (text.match(new RegExp(`(?<![a-z0-9])${escapeRe(phrase.trim())}(?![a-z0-9])`, 'gi')) || []).length : 0;

export const normalizeUrl = (raw: string): string => {
    try {
        const u = new URL(raw.trim());
        u.hash = '';
        for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        return `${host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
    } catch { return raw.trim().toLowerCase(); }
};

export const hostOf = (raw: string): string => {
    try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
};

const externalLinks = (html: string, ownHost: string): string[] =>
    [...html.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]).filter(u => hostOf(u) !== ownHost);

// ---------------------------------------------------------------- source quality

const BLOCKED_HOSTS = /(^|\.)(reddit|quora|facebook|instagram|twitter|x|tiktok|pinterest|linkedin|medium|tumblr|blogspot|wordpress|wixsite|youtube|youtu)\.(com|be|net)$/i;
const CREDIBLE_TLD = /\.(gov|edu|mil|int)(\.[a-z]{2})?$/i;
const CREDIBLE_HOSTS = /(^|\.)(iso|ansi|astm|iec|ieee|w3|nist|resna|aota|apta|who|nature|science|sciencedirect|springer|wiley|jamanetwork|thelancet|bmj|nejm|mayoclinic|clevelandclinic|hopkinsmedicine|pewresearch|nngroup|hbr|reuters|apnews|bbc|nytimes|wsj|economist|statista|gartner|forrester|mckinsey|developers\.google|support\.google|schema)\.(org|com|co\.uk|net|edu)$/i;

export const isBlockedHost = (host: string) => BLOCKED_HOSTS.test(host);
export const isCredibleHost = (host: string) => CREDIBLE_TLD.test(host) || CREDIBLE_HOSTS.test(host);

// ---------------------------------------------------------------- search-result sources

/** Collects every URL the model's web search actually returned (tool results and citations). */
export const collectSearchUrls = (blocks: any[]): string[] => {
    const urls = new Set<string>();
    const walk = (node: any, inResult: boolean) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(n => walk(n, inResult)); return; }
        const isResult = inResult || (typeof node.type === 'string' && /tool_result$/.test(node.type));
        if (typeof node.url === 'string' && (isResult || /^web_search_result/.test(node.type || ''))) urls.add(node.url);
        if (Array.isArray(node.citations)) node.citations.forEach((c: any) => typeof c?.url === 'string' && urls.add(c.url));
        for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, isResult);
    };
    walk(blocks, false);
    return [...urls];
};

// ---------------------------------------------------------------- link verification

/** Only plain public http(s) hosts may be fetched (the URLs come from model output). */
export const isSafePublicUrl = (raw: string): boolean => {
    try {
        const u = new URL(raw);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return false;
        const h = u.hostname.toLowerCase();
        if (!h.includes('.') || h.startsWith('[') || /^[\d.]+$/.test(h)) return false;
        if (/(^|\.)(localhost|local|internal|localdomain|lan|home|corp)$/.test(h)) return false;
        return true;
    } catch { return false; }
};

export interface LinkReport { removed: { url: string; reason: 'not-in-search-results' | 'blocked-host' | 'unsafe' | 'dead' }[]; kept: string[]; }

const unlink = (html: string, bad: Set<string>) =>
    bad.size ? html.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => (bad.has(href) ? inner : m)) : html;

/**
 * Removes (keeping the link text) any outside link that was not in the model's search results, points at a
 * blocked host or an unsafe address, or no longer loads. An empty `searchUrls` skips the provenance test
 * (search results were not captured) but the other checks still run.
 */
export const verifyLinks = async (html: string, opts: { ownUrl?: string; searchUrls?: string[]; checkLive?: boolean } = {}): Promise<{ html: string; report: LinkReport }> => {
    const ownHost = hostOf(opts.ownUrl && /^https?:/.test(opts.ownUrl) ? opts.ownUrl : opts.ownUrl ? `https://${opts.ownUrl}` : '');
    const allowed = new Set((opts.searchUrls || []).map(normalizeUrl));
    const urls = [...new Set([...html.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]))];
    const bad = new Map<string, LinkReport['removed'][number]['reason']>();
    const toCheck: string[] = [];

    for (const u of urls) {
        const host = hostOf(u);
        const own = !!ownHost && host === ownHost;
        if (!isSafePublicUrl(u)) bad.set(u, 'unsafe');
        else if (isBlockedHost(host)) bad.set(u, 'blocked-host');
        else if (!own && allowed.size > 0 && !allowed.has(normalizeUrl(u))) bad.set(u, 'not-in-search-results');
        else if (opts.checkLive !== false) toCheck.push(u);
    }

    await Promise.all(toCheck.slice(0, 25).map(async (u) => {
        try {
            const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutorankLinkCheck/1.0)' } });
            if (res.status === 404 || res.status === 410) bad.set(u, 'dead');
            await res.body?.cancel();
        } catch (e: any) {
            if (e?.name !== 'TimeoutError') bad.set(u, 'dead'); // DNS failure or refused; a slow site is kept. Bot-blocking 403/429/999 are kept.
        }
    }));

    return {
        html: unlink(html, new Set(bad.keys())),
        report: { removed: [...bad].map(([url, reason]) => ({ url, reason })), kept: urls.filter(u => !bad.has(u)) },
    };
};

// ---------------------------------------------------------------- lint

export interface LintIssue { code: string; severity: 'error' | 'warning'; message: string; }

const LEAK_PATTERNS: [RegExp, string][] = [
    [/no (diagram|image|chart|picture)s? (is|are) needed/i, 'meta-commentary about the format'],
    [/\bas an ai\b|\bi (searched|found|looked)\b|let me search|\bin this article,? (we|i) will\b/i, 'AI or process narration'],
    [/lorem ipsum|\bTODO\b|\[citation needed\]|\[insert[^\]]*\]|\[(source|link|url)\]/i, 'placeholder text'],
    [/```|<html|<body|<head>/i, 'code fence or page wrapper'],
];

const FIGURE = /(\d[\d,.]*\s?(%|percent\b)|\$\s?\d|\b\d[\d,.]*\s?(million|billion|trillion)\b|\b(study|survey|research|report)s?\s+(found|show|shows|showed|suggest|suggests)\b)/i;

export interface LintOptions { keyword: string; ownUrl?: string; metaTitle?: string; metaDescription?: string; imagesAllowed?: boolean; }

export const lintArticle = (html: string, o: LintOptions): { issues: LintIssue[]; metrics: Record<string, number> } => {
    const issues: LintIssue[] = [];
    const add = (code: string, severity: LintIssue['severity'], message: string) => issues.push({ code, severity, message });

    const body = html.replace(/<h2[^>]*>\s*sources\s*<\/h2>[\s\S]*$/i, ''); // keyword/figure checks ignore the Sources list
    const text = stripTags(body);
    const words = stripTags(html).split(/\s+/).filter(Boolean).length;
    const phraseCount = countPhrase(text, o.keyword);
    const budget = keywordBudget(words);
    const headings = [...body.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ level: +m[1], text: stripTags(m[2]) }));
    const phraseHeadings = headings.filter(h => h.level > 1 && countPhrase(h.text, o.keyword) > 0).length;

    if (phraseCount > Math.ceil(budget * 1.5) || phraseHeadings > 2)
        add('keyword-stuffing', 'error', `The exact phrase "${o.keyword}" is overused (${phraseCount} times, ${phraseHeadings} subheadings; aim for at most ${budget} times and at most 2 subheadings). Replace repeats with natural variants.`);
    else if (phraseCount > budget)
        add('keyword-density', 'warning', `The exact phrase "${o.keyword}" appears ${phraseCount} times; ${budget} or fewer reads more naturally.`);
    if (phraseCount === 0) add('keyword-missing', 'warning', `The exact phrase "${o.keyword}" never appears; use it in the H1 and first paragraph.`);

    for (const [re, label] of LEAK_PATTERNS) if (re.test(html)) add('leaked-text', 'error', `Remove ${label} found in the article.`);
    if (o.imagesAllowed === false && /<img\b|\[IMAGE_\d+\]/i.test(html)) add('images', 'error', 'Remove images and image placeholders; this article must be text only.');
    if ((html.match(/<h1[\s>]/gi) || []).length > 1) add('multiple-h1', 'error', 'There is more than one H1; keep exactly one.');

    if (words < 1200 || words > 2600) add('length', 'warning', `Article is ${words} words; the target is ${ARTICLE_MIN_WORDS}-${ARTICLE_MAX_WORDS}.`);

    const ownHost = hostOf(o.ownUrl && /^https?:/.test(o.ownUrl) ? o.ownUrl : o.ownUrl ? `https://${o.ownUrl}` : '');
    const ext = externalLinks(body, ownHost);
    const publishers = new Set(ext.map(hostOf));
    const credible = [...publishers].filter(isCredibleHost).length;
    if (ext.length < 3 || publishers.size < 3) add('few-sources', 'warning', `Only ${ext.length} outside links from ${publishers.size} publishers; credible articles cite at least 3-4 independent sources.`);
    else if (credible === 0) add('weak-sources', 'warning', 'None of the cited sources is a government, university, standards body or major publication.');
    if (!/<h2[^>]*>\s*sources\s*<\/h2>/i.test(html)) add('no-sources-section', 'warning', 'Add a "Sources" section listing each cited source.');

    const unsourced = (body.match(/<(p|li)[^>]*>[\s\S]*?<\/\1>/gi) || []).filter(p => FIGURE.test(stripTags(p)) && !/<a\s[^>]*href=/i.test(p));
    if (unsourced.length) add('unsourced-figure', unsourced.length >= 3 ? 'error' : 'warning', `${unsourced.length} statement(s) contain a statistic or study claim with no linked source, for example: "${stripTags(unsourced[0]).slice(0, 110)}".`);

    if (!/<h[23][^>]*>[^<]*(key takeaways|summary|at a glance|quick answer)/i.test(html.slice(0, 4000))) add('no-summary', 'warning', 'Add a Key Takeaways or Summary section near the top.');
    if (extractFaq(html).length < 3) add('few-faq', 'warning', 'Add an FAQ section with at least 3-5 questions (each question as an <h3> followed by its answer).');

    if (o.metaTitle) {
        if (o.metaTitle.length > 60) add('meta-title', 'warning', `Meta title is ${o.metaTitle.length} characters; keep it at 60 or fewer.`);
        if (!countPhrase(o.metaTitle, o.keyword)) add('meta-title-keyword', 'warning', 'Meta title should contain the target phrase.');
    }
    if (o.metaDescription && (o.metaDescription.length < 110 || o.metaDescription.length > 160)) add('meta-description', 'warning', `Meta description is ${o.metaDescription.length} characters; aim for 110-160.`);

    return { issues, metrics: { words, phraseCount, phraseHeadings, externalLinks: ext.length, publishers: publishers.size, crediblePublishers: credible } };
};

// ---------------------------------------------------------------- FAQ + JSON-LD

export const extractFaq = (html: string): { question: string; answer: string }[] => {
    const m = html.match(/<h2[^>]*>[^<]*(?:faq|frequently asked)[^<]*<\/h2>([\s\S]*?)(?=<h2[\s>]|$)/i);
    if (!m) return [];
    const section = m[1];
    const out: { question: string; answer: string }[] = [];
    const parts = section.split(/<h3[^>]*>([\s\S]*?)<\/h3>/i); // [pre, q1, a1, q2, a2, ...]
    for (let i = 1; i < parts.length; i += 2) {
        const question = stripTags(parts[i]);
        const answer = stripTags(parts[i + 1] || '').slice(0, 1200);
        if (question && answer) out.push({ question, answer });
    }
    if (out.length) return out;
    for (const p of section.matchAll(/<p[^>]*>\s*<strong>([^<]*\?)<\/strong>\s*([\s\S]*?)<\/p>/gi)) {
        const answer = stripTags(p[2]);
        if (answer) out.push({ question: stripTags(p[1]), answer });
    }
    return out;
};

export interface JsonLdInput {
    html: string; headline: string; description?: string; keyword?: string;
    businessName: string; businessUrl?: string; imageUrl?: string; pageUrl?: string;
    datePublished?: string; dateModified?: string; language?: string;
}

/** Article + FAQPage (when the article has an FAQ section) as one <script type="application/ld+json"> block. */
export const buildJsonLd = (i: JsonLdInput): string => {
    const org = { '@type': 'Organization', name: i.businessName, ...(i.businessUrl ? { url: /^https?:/.test(i.businessUrl) ? i.businessUrl : `https://${i.businessUrl}` } : {}) };
    const ownHost = hostOf(org.url || '');
    const citations = [...new Set(externalLinks(i.html.replace(/<h2[^>]*>\s*sources\s*<\/h2>[\s\S]*$/i, ''), ownHost))].slice(0, 12);
    const now = new Date().toISOString();
    const article: any = {
        '@type': 'Article',
        headline: i.headline.slice(0, 110),
        ...(i.description ? { description: i.description } : {}),
        ...(i.imageUrl ? { image: [i.imageUrl] } : {}),
        ...(i.keyword ? { keywords: i.keyword } : {}),
        inLanguage: i.language && i.language !== 'English' ? i.language : 'en',
        datePublished: i.datePublished || now,
        dateModified: i.dateModified || now,
        author: org, publisher: org,
        ...(i.pageUrl ? { mainEntityOfPage: { '@type': 'WebPage', '@id': i.pageUrl } } : {}),
        ...(citations.length ? { citation: citations.map(url => ({ '@type': 'CreativeWork', url })) } : {}),
    };
    const faq = extractFaq(i.html);
    const graph: any[] = [article];
    if (faq.length >= 2) graph.push({ '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) });
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
};

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Adds a visible "Last updated" line under the H1 and the JSON-LD block. Idempotent. */
export const finalizeForPublish = (html: string, i: Omit<JsonLdInput, 'html'>): string => {
    let out = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').replace(/<p class="article-updated">[\s\S]*?<\/p>/gi, '');
    const now = new Date();
    const line = `<p class="article-updated"><em>Last updated: <time datetime="${now.toISOString().slice(0, 10)}">${formatDate(now)}</time></em></p>`;
    out = /<\/h1>/i.test(out) ? out.replace(/<\/h1>/i, m => m + line) : line + out;
    return out + '\n' + buildJsonLd({ ...i, html: out, dateModified: now.toISOString() });
};
