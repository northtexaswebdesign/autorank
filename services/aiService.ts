import { BusinessInfo, Keyword, ContentCluster, CompetitorAnalysis, CmsIntegration, ScheduledPost, PostImages, GeneratedImage, ContentBrief, KeywordOpportunity } from "../types.ts";
import { uploadImageFromBase64 } from '../utils/imageStorage.ts';

import { callClaude, callClaudeDetailed, callCover, verifyArticleLinks, reserveCompetitorAnalysis, releaseCompetitorAnalysis } from './claudeClient.ts';
import { findExistingWpPost, slugFromUrl } from '../supabase/functions/_shared/wordpress.ts';
import { SOURCE_RULES, TRUST_RULES, STRUCTURE_RULES, INTERNAL_LINK_RULES, ARTICLE_SEARCHES, keywordRules, buildRepairPrompt, buildSourcePassPrompt, needsSourcePass, sourceStats, stripFences, lintArticle, finalizeForPublish, FOCUS_RULES, RESEARCH_SEARCHES, ARTICLE_SEARCHES_WITH_BRIEF, buildResearchPrompt, researchBriefBlock, dropTitleH1, stripSourcesSection, type LintIssue } from '../supabase/functions/_shared/articleQuality.ts';

// Articles get one branded cover (1080x1080 JPEG under 200 KB, made by /api/cover) as the featured/first image.
// It uses the business's brand style, else colours read from its website, else a look Claude picks for the topic.
const IMAGES_ENABLED = true;

/**
 * Senior Developer Fix: 
 * Prevents the deletion of valid HTML structural tags.
 * Bypasses destructive cleaning that causes "Empty Content" bugs.
 */
export const cleanAIResponse = (text: string): string => {
    if (!text) return "";
    let content = text.trim();

    if (content.startsWith('```')) {
        const lines = content.split('\n');
        if (lines.length > 1 && lines[0].startsWith('```')) {
            lines.shift();
        }
        if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
            lines.pop();
        }
        content = lines.join('\n').trim();
    }
    
    if (!content.startsWith('{') && !content.startsWith('[')) {
        const firstBrace = content.indexOf('{');
        const firstBracket = content.indexOf('[');
        const lastBrace = content.lastIndexOf('}');
        const lastBracket = content.lastIndexOf(']');
        
        let start = -1;
        let end = -1;
        
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            end = lastBrace > firstBrace ? lastBrace : content.length - 1;
        } else if (firstBracket !== -1) {
            start = firstBracket;
            end = lastBracket > firstBracket ? lastBracket : content.length - 1;
        }
        
        if (start !== -1) {
            content = content.substring(start, end + 1);
        }
    }
    
    return content;
};

const parseArticleResponse = (text: string, defaultKeyword: string, businessName: string) => {
    let parsedData = { articleContent: '', metaTitle: '', metaDescription: '', slug: '' };
    try {
        parsedData = JSON.parse(cleanAIResponse(text || '{}'));
    } catch (e) {
        console.error("Failed to parse article JSON", e);
        
        // Fallback for truncated JSON
        try {
            const contentMatch = text.match(/"articleContent"\s*:\s*"([\s\S]*)/);
            if (contentMatch && contentMatch[1]) {
                let rawContent = contentMatch[1];
                
                const nextKeyIndex = rawContent.indexOf('","metaTitle"');
                if (nextKeyIndex !== -1) {
                    rawContent = rawContent.substring(0, nextKeyIndex);
                } else {
                    if (rawContent.endsWith('"')) {
                        rawContent = rawContent.substring(0, rawContent.length - 1);
                    } else if (rawContent.endsWith('"}')) {
                        rawContent = rawContent.substring(0, rawContent.length - 2);
                    }
                }
                
                parsedData.articleContent = rawContent
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\')
                    .replace(/\\t/g, '\t');
            }
            
            const titleMatch = text.match(/"metaTitle"\s*:\s*"([^"]*)/);
            if (titleMatch && titleMatch[1]) parsedData.metaTitle = titleMatch[1].replace(/\\"/g, '"');
            
            const descMatch = text.match(/"metaDescription"\s*:\s*"([^"]*)/);
            if (descMatch && descMatch[1]) parsedData.metaDescription = descMatch[1].replace(/\\"/g, '"');
            
            const slugMatch = text.match(/"slug"\s*:\s*"([^"]*)/);
            if (slugMatch && slugMatch[1]) parsedData.slug = slugMatch[1].replace(/\\"/g, '"');
            
            // If we still don't have content, check if the AI just returned raw HTML or markdown instead of JSON
            if (!parsedData.articleContent && text.length > 500) { // If it's a long response, it's probably the article
                // Strip markdown code blocks if present
                parsedData.articleContent = text.replace(/^```(html|json|markdown)?\n/i, '').replace(/\n```$/i, '').trim();
                
                // If it looks like markdown (has # or **), we should ideally convert it, but for now just wrap in basic HTML if it lacks it
                if (!parsedData.articleContent.includes('<p>') && !parsedData.articleContent.includes('<h')) {
                    // Very basic markdown to HTML conversion for fallback
                    parsedData.articleContent = parsedData.articleContent
                        .split('\n\n')
                        .map(para => {
                            if (para.startsWith('# ')) return `<h1>${para.substring(2)}</h1>`;
                            if (para.startsWith('## ')) return `<h2>${para.substring(3)}</h2>`;
                            if (para.startsWith('### ')) return `<h3>${para.substring(4)}</h3>`;
                            if (para.startsWith('- ')) return `<ul>${para.split('\n').map(li => `<li>${li.substring(2)}</li>`).join('')}</ul>`;
                            return `<p>${para}</p>`;
                        })
                        .join('\n');
                }
            }
            
        } catch (fallbackErr) {
            console.error("Fallback parsing also failed", fallbackErr);
        }
    }
    
    return {
        articleContent: parsedData.articleContent || '',
        metaTitle: parsedData.metaTitle || `${defaultKeyword} | ${businessName}`,
        metaDescription: parsedData.metaDescription || `Read our comprehensive guide about ${defaultKeyword} for ${businessName} audiences.`,
        slug: parsedData.slug || defaultKeyword.toLowerCase().replace(/\s+/g, '-')
    };
};

/** Lowercased, single-spaced form of a keyword, used to spot duplicates. */
const normKeyword = (k: string) => k.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Business facts every keyword prompt needs, including what the site already targets. */
const keywordContext = (business: BusinessInfo, existing: string[]) => {
    const competitors = business.competitorAnalysis?.strategicRecommendations?.slice(0, 5).join(' | ');
    return `Business: ${business.name} (${business.url})
Description: ${business.description}
Audience: ${business.audience}
${business.competitors?.length ? `Competitors: ${business.competitors.join(', ')}` : ''}
${competitors ? `Competitor analysis takeaways: ${competitors}` : ''}
${existing.length ? `ALREADY TARGETED (never repeat these or close variants that would compete for the same search results):\n${existing.slice(0, 150).join('\n')}` : ''}`;
};

/** Drops keywords that are already targeted or repeated within the list. */
const dedupeKeywords = <T extends { keyword: string }>(items: T[], existing: string[]): T[] => {
    const seen = new Set(existing.map(normKeyword));
    return items.filter(k => {
        const n = normKeyword(k.keyword || '');
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
    });
};

const KEYWORD_RULES = `WHAT MAKES A GOOD KEYWORD HERE:
- Relevant: the business can genuinely answer it, and a reader searching it could plausibly become a customer. Tie it to the actual products, services, problems and audience above, not the industry in general.
- Winnable: a newer site with modest authority can reach page one. Prefer specific long-tail phrases (usually 3-7 words): questions, "how to", "best X for Y", "X vs Y", cost/price, problems and fixes, use cases, buying guides. Avoid one- or two-word head terms and anything dominated by huge brands, marketplaces, Wikipedia or government sites.
- Real: phrased the way people actually type or ask it, with real search demand. No invented jargon, no keyword stuffing, no brand names of competitors unless it is a natural "vs" or "alternative" search.
- Distinct: each keyword needs its own search intent. Two phrases that would show the same Google results count as one; keep the better one.
- Balanced: mostly informational and commercial-investigation keywords (these suit blog articles), plus a few transactional ones tied to what the business sells. Include local modifiers only if the business serves a specific area.`;

/**
 * Keyword research in two steps. 1) Brainstorm a wide candidate list from the business, skipping what is already
 * targeted. 2) Check real search results for the most promising candidates and keep the ones that are relevant and
 * winnable, rating opportunity from what actually ranks. If step 2 fails, step 1's best picks are used.
 */
export const generateKeywords = async (business: BusinessInfo, language: string = 'English', existing: string[] = []): Promise<Keyword[]> => {
    const context = keywordContext(business, existing);
    const candidateSchema = {
        type: 'object',
        properties: {
            candidates: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        keyword: { type: 'string' },
                        intent: { type: 'string', enum: ['informational', 'commercial', 'transactional'] },
                        relevance: { type: 'integer', description: '1-10: how closely it maps to what the business sells' },
                        winnability: { type: 'integer', description: '1-10: estimated chance a modest site reaches page one' }
                    },
                    required: ['keyword', 'intent', 'relevance', 'winnability'],
                    additionalProperties: false
                }
            }
        },
        required: ['candidates'],
        additionalProperties: false
    };

    try {
        // Step 1: wide brainstorm (cheap, no search)
        const step1 = await callClaude({
            tier: 'fast',
            maxTokens: 5000,
            messages: [{ role: 'user', content: `You are an SEO strategist doing keyword research in ${language} for this business:
${context}

${KEYWORD_RULES}

List 45 candidate keywords in ${language}. Cover every main product or service line and the problems, questions and comparisons customers have before buying. Score each one honestly.` }],
            schema: candidateSchema
        });
        let candidates: { keyword: string; intent: string; relevance: number; winnability: number }[] = [];
        try { candidates = JSON.parse(cleanAIResponse(step1 || '{}')).candidates || []; } catch { candidates = []; }
        candidates = dedupeKeywords(candidates, existing)
            .filter(c => c.relevance >= 6)
            .sort((a, b) => (b.relevance + b.winnability) - (a.relevance + a.winnability))
            .slice(0, 30);
        if (candidates.length === 0) return [];

        const fallback = (): Keyword[] => candidates.slice(0, 20).map(c => ({
            keyword: c.keyword,
            opportunity: c.relevance + c.winnability >= 16 ? KeywordOpportunity.High : c.relevance + c.winnability >= 13 ? KeywordOpportunity.Medium : KeywordOpportunity.Low
        }));

        // Step 2: check what actually ranks (cheap model, a few searches cover groups of similar candidates)
        try {
            const step2 = await callClaude({
                tier: 'fast',
                webSearch: true,
                maxSearches: 5,
                maxTokens: 4000,
                messages: [{ role: 'user', content: `You are an SEO strategist vetting keyword candidates in ${language} for this business:
${context}

${KEYWORD_RULES}

CANDIDATES (keyword | intent | relevance | winnability):
${candidates.map(c => `${c.keyword} | ${c.intent} | ${c.relevance} | ${c.winnability}`).join('\n')}

Use your searches on the candidates you are least sure about (group similar ones; one search can inform several). Look at who ranks:
- Weak results (forums, Reddit/Quora, thin or outdated posts, small sites, pages that don't really answer the query) = a good chance to rank.
- Strong results (major brands, marketplaces, Wikipedia, government, large publishers holding every top spot) = hard.
- Results that are product pages, videos or tools when we would write an article = intent mismatch, drop it.
- Rephrase a candidate to the wording that search results and "People also ask" show people really use.

Then choose the best 20: relevant to what the business sells, realistic to rank, each with a distinct intent, and a sensible spread across products/services and funnel stages. Rate opportunity: High = clearly relevant and the results looked weak or beatable; Medium = relevant with moderate competition; Low = relevant but hard, kept for coverage.

Reply with ONLY this JSON, no other text: {"keywords":[{"keyword":"...","opportunity":"High|Medium|Low"}]}` }]
            });
            const parsed = JSON.parse(cleanAIResponse(step2 || '{}')).keywords || [];
            const valid = Object.values(KeywordOpportunity) as string[];
            const vetted: Keyword[] = dedupeKeywords<Keyword>(parsed, existing)
                .filter((k: any) => typeof k.keyword === 'string' && valid.includes(k.opportunity))
                .slice(0, 20);
            return vetted.length >= 10 ? vetted : fallback();
        } catch (e) {
            console.error('Keyword SERP check failed, using brainstorm picks:', e);
            return fallback();
        }
    } catch (apiError) {
        console.error("Keyword generation API call failed:", apiError);
        throw apiError; // let the UI tell the user (auth, rate limit, outage) instead of silently showing nothing
    }
};

/**
 * A topic cluster around one keyword: a pillar plus supporting articles, each a real search phrase with its own
 * intent, so the articles support each other instead of competing for the same results.
 */
export const suggestContentCluster = async (targetKeyword: string, business: BusinessInfo, existing: string[] = []): Promise<ContentCluster | null> => {
    try {
        const responseText = await callClaude({
            tier: 'fast',
            webSearch: true,
            maxSearches: 2,
            maxTokens: 2500,
            messages: [{ role: 'user', content: `You are an SEO strategist building a topic cluster around "${targetKeyword}".
${keywordContext(business, existing)}

Search for "${targetKeyword}" (and one closely related query if useful) and note the related searches, "People also ask" questions and the subtopics the top results cover.

Then return:
- pillar: the broad guide keyword the cluster hangs on. Use "${targetKeyword}" itself unless a slightly broader phrase is clearly the better hub; keep it closely related.
- clusters: 6-8 supporting article keywords. Each must be a real search phrase (long-tail, the way people type it), answerable by this business, and have its own search intent: no two that would show the same results, none that would compete with the pillar, none from ALREADY TARGETED. Mix questions, how-tos, comparisons, costs and problems, and include at least one that leads toward what the business sells.

${KEYWORD_RULES}

Reply with ONLY this JSON, no other text: {"pillar":"...","clusters":["...","..."]}` }]
        });

        try {
            const cluster = JSON.parse(cleanAIResponse(responseText || 'null')) as ContentCluster;
            if (!cluster?.pillar || !Array.isArray(cluster.clusters)) return null;
            const clusters = dedupeKeywords(cluster.clusters.filter(c => typeof c === 'string').map(keyword => ({ keyword })), [...existing, cluster.pillar]).map(c => c.keyword);
            return { pillar: cluster.pillar, clusters };
        } catch (e) {
            return null;
        }
    } catch (apiError) {
        console.error("Content cluster API call failed:", apiError);
        throw apiError;
    }
};

const MAX_COMPETITORS = 6;

/** Researches one competitor with its own search budget. Never throws; an unverified result says so. */
const researchCompetitor = async (business: BusinessInfo, url: string): Promise<CompetitorAnalysis['analysis'][number]> => {
    const unverified = (why: string) => ({ url, strengths: [], weaknesses: [], contentStrategySummary: `Could not research this competitor (${why}). Try again, or check the site directly.` });
    const request = () => callClaudeDetailed({
        tier: 'smart',
        webSearch: true,
        maxSearches: 6,
        maxTokens: 3000,
        messages: [{ role: 'user', content: `Research one competitor of ${business.name} (${business.description}): ${url}

Use web search to look at what this site actually publishes: its blog or resources, topics covered, content formats, how often it posts, how it presents products or services, and how well it appears to target search and AI answers. Use at most 5 searches. Base every point on what you found; if something could not be verified, say so rather than guessing.

Return ONLY a JSON object (no markdown fences, no commentary):
{ "url": "${url}", "strengths": ["3-4 specific points"], "weaknesses": ["3-4 specific gaps ${business.name} could exploit"], "contentStrategySummary": "2-3 sentences on their content strategy" }` }],
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { text, searchErrors } = await request();
            if (searchErrors.length && attempt === 0 && searchErrors.some(e => /too_many_requests|max_uses|unavailable/.test(e))) continue; // search was throttled; one retry
            const data = JSON.parse(cleanAIResponse(text || '{}'));
            if (!Array.isArray(data.strengths) || !data.contentStrategySummary) throw new Error('incomplete');
            return { url, strengths: data.strengths, weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [], contentStrategySummary: data.contentStrategySummary };
        } catch (e: any) {
            if (attempt === 1) { console.error(`Competitor research failed for ${url}:`, e?.message); return unverified('the research step failed'); }
        }
    }
    return unverified('web search was unavailable');
};

/**
 * AI competitive analysis. Limited to 1 per business per calendar month (enforced by /api/claude).
 * Throws when the limit is used up or when every research step failed (the run is then given back), so the
 * caller never overwrites an existing report with an error message.
 */
export const analyzeCompetitors = async (
    business: BusinessInfo, 
    onProgress: (progress: { value: number; text: string }) => void
): Promise<CompetitorAnalysis> => {
    const competitors = (business.competitors || []).map(c => c.trim()).filter(Boolean).slice(0, MAX_COMPETITORS);
    if (!competitors.length) throw new Error('Add at least one competitor URL in Business Info, then run the analysis again.');

    onProgress({ value: 5, text: "Checking this month's analysis limit..." });
    const { previous } = await reserveCompetitorAnalysis(business.id); // throws with the next available date if used

    try {
        onProgress({ value: 10, text: "Scanning competitor domains..." });
        // One request per competitor so each gets its own search budget (a single shared budget ran out after ~2 sites).
        let done = 0;
        const analysis = await Promise.all(competitors.map(async (url) => {
            const result = await researchCompetitor(business, url);
            onProgress({ value: 10 + Math.round((++done / competitors.length) * 70), text: `Researched ${done} of ${competitors.length} competitors...` });
            return result;
        }));

        const researched = analysis.filter(a => a.strengths.length > 0);
        if (!researched.length) throw new Error('Competitor research failed for every site, so no report was made. This did not use up your monthly analysis; please try again in a minute.');

        onProgress({ value: 85, text: "Building strategic recommendations..." });
        let strategicRecommendations: string[] = [];
        try {
            const text = await callClaude({
                tier: 'smart',
                maxTokens: 1500,
                messages: [{ role: 'user', content: `${business.name} (${business.description}) targets ${business.audience}. Here is research on its competitors:\n${JSON.stringify(researched)}\n\nGive 4-6 specific, actionable content-strategy recommendations that exploit these competitors' gaps. Use only what the research says.` }],
                schema: { type: 'object', properties: { recommendations: { type: 'array', items: { type: 'string' } } }, required: ['recommendations'], additionalProperties: false },
            });
            strategicRecommendations = JSON.parse(cleanAIResponse(text)).recommendations || [];
        } catch (e) { console.error('Competitor recommendations failed:', e); }
        if (!strategicRecommendations.length) strategicRecommendations = ['Recommendations could not be generated this time; the competitor findings above are still valid.'];

        onProgress({ value: 100, text: "Analysis complete" });
        return { analysis, strategicRecommendations, analyzedAt: new Date().toISOString() };
    } catch (e) {
        await releaseCompetitorAnalysis(business.id, previous);
        onProgress({ value: 100, text: "Analysis failed" });
        throw e;
    }
};

/**
 * Quality pass run on every generated or rewritten article:
 *  1. drop outside links the web search never returned, blocked hosts and dead pages (server side);
 *  2. lint (keyword stuffing, leaked text, unsourced figures, missing summary/FAQ/sources, meta lengths);
 *  3. if there are errors, one targeted repair edit (no new facts or links), then lint again.
 * Remaining findings come back as feedback lines for the editor panel. Never throws: on failure the article is returned as is.
 */
const polishArticle = async (html: string, keyword: string, business: BusinessInfo, searchUrls: string[], meta: { metaTitle?: string; metaDescription?: string }) => {
    const lintOpts = { keyword, ownUrl: business.url, imagesAllowed: !(business.skipImageGeneration || !IMAGES_ENABLED) ? undefined : false, ...meta };
    let content = stripSourcesSection(html);
    let urls = [...searchUrls];
    const notes: string[] = [];
    const verify = async (candidate: string) => {
        const checked = await verifyArticleLinks(candidate, business.url, urls);
        if (checked.removed.length) notes.push(`${checked.removed.length} link(s) were removed because they were not found by search, were unreachable, or were not a credible page.`);
        return checked.html;
    };
    try { content = await verify(content); } catch (e) { console.error('Link verification failed, keeping links as written:', e); }

    // Too few outside sources (or the model said it had none): a dedicated pass that searches for them.
    if (needsSourcePass(content, business.url)) {
        try {
            const { text, sources } = await callClaudeDetailed({ tier: 'smart', webSearch: true, maxSearches: ARTICLE_SEARCHES, maxTokens: 16000, messages: [{ role: 'user', content: buildSourcePassPrompt(content, keyword) }] });
            const candidate = stripFences(text);
            if (candidate.length > content.length * 0.7 && /<h[12]/i.test(candidate)) {
                urls = [...new Set([...urls, ...sources])];
                const before = sourceStats(content, business.url).publishers;
                const verified = await verify(candidate);
                if (sourceStats(verified, business.url).publishers >= before) content = verified;
            }
        } catch (e) { console.error('Source pass failed, keeping the article as written:', e); }
    }

    let { issues } = lintArticle(content, lintOpts);
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length) {
        try {
            const fixed = stripFences(await callClaude({ tier: 'smart', maxTokens: 16000, messages: [{ role: 'user', content: buildRepairPrompt(content, errors) }] }));
            if (fixed.length > content.length * 0.7 && /<h[12]/i.test(fixed)) {
                // the repair must not introduce links; re-check against the same search results
                content = await verify(fixed).catch(() => fixed);
                issues = lintArticle(content, lintOpts).issues;
            }
        } catch (e) { console.error('Repair pass failed, keeping the article as written:', e); }
    }
    return { content, feedback: [...issues.map((i: LintIssue) => `${i.severity === 'error' ? 'Fix' : 'Improve'}: ${i.message}`), ...notes] };
};

/** Alt text for an image tag: never a file name, quotes escaped. */
const altAttr = (alt: string | undefined, fallback: string) => {
    const text = !alt || /\.(jpe?g|png|webp|gif)$/i.test(alt) ? fallback : alt;
    return text.replace(/"/g, '&quot;');
};

/**
 * Gap research before writing: a cheap model reads the current top results and returns a short private brief
 * (what ranks, what it misses, credible sources). The writer uses it so the article adds what the top results
 * lack. Never blocks writing: on any failure the article is written without a brief.
 */
const researchContentGaps = async (keyword: string, business: BusinessInfo): Promise<string> => {
    try {
        const text = await callClaude({
            tier: 'fast',
            webSearch: true,
            maxSearches: RESEARCH_SEARCHES,
            maxTokens: 2500,
            messages: [{ role: 'user', content: buildResearchPrompt(keyword, business.name, business.description) }]
        });
        return text.trim().length > 200 ? text.trim() : '';
    } catch (e) {
        console.error('Gap research failed, writing without a brief:', e);
        return '';
    }
};

export const generateFullArticle = async (
    keyword: string, 
    business: BusinessInfo, 
    instructions?: string, 
    brief?: ContentBrief | null, 
    onProgress?: (progress: { value: number; text: string }) => void
) => {
    onProgress?.({ value: 5, text: "Studying the top-ranking articles..." });
    const research = await researchContentGaps(keyword, business);
    onProgress?.({ value: 20, text: "Gathering authoritative sources via search..." });
    
    const imageInstruction = (business.skipImageGeneration || !IMAGES_ENABLED) 
        ? "5. STRICTLY NO IMAGES: Do NOT include any <img> tags, markdown images, image placeholders, base64 images, or data URIs in the HTML. The content must be 100% text only."
        : "5. IMAGES: You MUST include exactly one image placeholder in the format <p>[IMAGE_1]</p> near the beginning of the article. Do NOT include any actual <img> tags, markdown images, base64 images, or external image URLs.";

    const prompt = `You are tasked with writing the absolute best, most comprehensive SEO article on the internet for the keyword: "${keyword}".
    
    ${research ? researchBriefBlock(research) : `First, use at most 3 searches to analyze the top-ranking articles for this keyword. Identify what they cover, but more importantly, identify their gaps, missing information, and areas where they lack depth or clarity. Then write a superior article that covers what they cover PLUS fills those gaps.`}
    
    CRITICAL REQUIREMENTS:
    1. Add a well-formatted, clearly written summary at the very beginning of the article, optimized for generative AI engines to quickly extract the main points. Do NOT use the term "TL;DR" or "TL DR". Use a professional heading like "Executive Summary" or "Key Takeaways".
    2. Include a dedicated FAQ section at the end with conversational questions to capture natural language queries.
    3. The article MUST be between 1500 and 2000 words in length. This is a strict requirement for comprehensive coverage.
    4. ${SOURCE_RULES}
    ${imageInstruction}
    6. ${INTERNAL_LINK_RULES(business.url, business.sitemapUrl)}
    
    ${keywordRules(keyword)}

    ${STRUCTURE_RULES}

    ${FOCUS_RULES}

    ${TRUST_RULES}

    Business Context: ${business.name} (${business.description})
    Target Audience: ${business.audience}
    ${instructions ? `Additional Instructions: ${instructions}` : ''}
    ${brief ? `Content Brief Outline: ${brief.outline.join(', ')}` : ''}
    
    Return a JSON object with the following structure:
    {
        "articleContent": "The HTML content of the article. Ensure it is highly formatted with H2s, H3s, bullet points, and bold text for readability. ${(business.skipImageGeneration || !IMAGES_ENABLED) ? 'Do NOT include any images.' : 'Must include <p>[IMAGE_1]</p>.'} Must include an AI-optimized summary at the beginning and an FAQ section at the end.",
        "metaTitle": "SEO optimized meta title (around 60 characters)",
        "metaDescription": "SEO optimized meta description (around 150 characters)",
        "slug": "url-friendly-slug"
    }`;

    const { text: responseText, sources: searchUrls } = await callClaudeDetailed({
        tier: 'smart',
        kind: 'article',
        webSearch: true,
        maxSearches: research ? ARTICLE_SEARCHES_WITH_BRIEF : ARTICLE_SEARCHES,
        maxTokens: 16000,
        system: "You are an expert SEO content writer specialized in GEO (Generative Engine Optimization). Write in-depth, helpful content.",
        messages: [{ role: 'user', content: prompt + "\n\nRespond with ONLY the JSON object. No markdown fences, no text before or after it." }]
    });

    onProgress?.({ value: 90, text: "Optimizing for Generative Search..." });
    
    const parsedData = parseArticleResponse(responseText || '{}', keyword, business.name);
    
    const content = parsedData.articleContent || '';
    if (!content.trim()) throw new Error('The AI returned an empty article. Please try again.');
    const polished = await polishArticle(content, keyword, business, searchUrls, parsedData);
    const analysis = await analyzeArticleForGEO(polished.content, keyword);

    return { 
        articleContent: polished.content, 
        geoScore: analysis.geoScore, 
        aiFeedback: [...polished.feedback, ...(analysis.aiFeedback || [])], 
        metaTitle: parsedData.metaTitle, 
        metaDescription: parsedData.metaDescription, 
        slug: parsedData.slug 
    };
};

export const generateArticleImages = async (
    keyword: string,
    business: BusinessInfo,
    onProgress?: (progress: { value: number; text: string }) => void,
    title?: string
): Promise<PostImages> => {
    onProgress?.({ value: 10, text: "Designing the cover image..." });
    const cover = await callCover({ title: title || keyword, keyword, businessId: business.id, businessName: business.name, businessUrl: business.url, description: business.description, brandStyle: business.brandStyle });

    onProgress?.({ value: 50, text: "Uploading cover image..." });
    const url = await uploadImageFromBase64(cover.base64, 'covers');
    if (!url) throw new Error('The cover image could not be uploaded to storage. Please try again.');

    return { featureImage: { url, prompt: cover.alt } };
};

export const analyzeArticleForGEO = async (content: string, keyword: string) => {
    try {
        const responseText = await callClaude({
            tier: 'smart',
            maxTokens: 2000,
            messages: [{ role: 'user', content: `Analyze this article for keyword "${keyword}" based on GEO (Generative Engine Optimization) principles. Give a geoScore from 0-100 and a list of specific, actionable feedback items.
            Content: ${content}` }],
            schema: {
                type: 'object',
                properties: { geoScore: { type: 'integer' }, aiFeedback: { type: 'array', items: { type: 'string' } } },
                required: ['geoScore', 'aiFeedback'],
                additionalProperties: false
            }
        });
        try {
            return JSON.parse(cleanAIResponse(responseText || '{"geoScore": 70, "aiFeedback": []}'));
        } catch (e) {
            return { geoScore: 75, aiFeedback: ["Analyzed with standard parameters."] };
        }
    } catch (apiError) {
        console.error('GEO analysis API call failed, using fallback score:', apiError);
        return { geoScore: 75, aiFeedback: ["Analysis skipped due to a temporary API error."] };
    }
};

export const rewriteArticle = async (content: string, keyword: string, feedback: string[], business: BusinessInfo) => {
    const imageInstruction = (business.skipImageGeneration || !IMAGES_ENABLED) 
        ? "5. STRICTLY NO IMAGES: Do NOT include any <img> tags, markdown images, image placeholders, base64 images, or data URIs in the HTML. The content must be 100% text only."
        : "5. IMAGES: You MUST include exactly one image placeholder in the format <p>[IMAGE_1]</p> near the beginning of the article. Do NOT include any actual <img> tags, markdown images, base64 images, or external image URLs.";

    const { text: responseText, sources: searchUrls } = await callClaudeDetailed({
        tier: 'smart',
        webSearch: true,
        maxSearches: ARTICLE_SEARCHES,
        maxTokens: 16000,
        messages: [{ role: 'user', content: `Rewrite this article for "${keyword}" for ${business.name} based on this feedback: ${feedback.join('. ')}.
        Current content: ${content}
        
        CRITICAL REQUIREMENTS:
        1. Ensure there is a well-formatted, clearly written summary at the very beginning of the article, optimized for generative AI engines to quickly extract the main points. Do NOT use the term "TL;DR" or "TL DR". Use a professional heading like "Executive Summary" or "Key Takeaways".
        2. Ensure there is a dedicated FAQ section at the end with conversational questions to capture natural language queries.
        3. The article MUST be between 1500 and 2000 words in length. This is a strict requirement for comprehensive coverage.
        4. ${SOURCE_RULES}
        ${imageInstruction}
        6. ${INTERNAL_LINK_RULES(business.url, business.sitemapUrl)}

        ${keywordRules(keyword)}

        ${STRUCTURE_RULES}

        ${FOCUS_RULES}

        ${TRUST_RULES}

        Return a JSON object with the following structure:
        {
            "articleContent": "The HTML content of the rewritten article. ${(business.skipImageGeneration || !IMAGES_ENABLED) ? 'Do NOT include any images.' : 'Must include <p>[IMAGE_1]</p>.'} Must include an AI-optimized summary at the beginning and an FAQ section at the end.",
            "metaTitle": "SEO optimized meta title (around 60 characters)",
            "metaDescription": "SEO optimized meta description (around 150 characters)",
            "slug": "url-friendly-slug"
        }

        Respond with ONLY the JSON object. No markdown fences, no text before or after it.` }]
    });

    const parsed = parseArticleResponse(responseText || '{}', keyword, business.name);
    const polished = parsed.articleContent
        ? await polishArticle(parsed.articleContent, keyword, business, searchUrls, parsed)
        : { content, feedback: [] as string[] };
    return {
        articleContent: polished.content,
        qualityFeedback: polished.feedback,
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
        slug: parsed.slug
    };
};

/**
 * Internal helper to upload any GeneratedImage to WordPress Media Library
 */
const uploadImageToWP = async (auth: string, cmsUrl: string, image: GeneratedImage, filename: string): Promise<{ id: number; url: string } | null> => {
    try {
        let blob: Blob;
        // Priority: 1. URL (Supabase Storage), 2. Base64 (Legacy/New generation)
        if (image.url) {
            blob = await fetch(image.url).then(r => r.blob());
        } else if (image.base64) {
            blob = await fetch(`data:image/jpeg;base64,${image.base64}`).then(r => r.blob());
        } else {
            return null;
        }

        const formData = new FormData();
        formData.append('file', blob, filename);
        if (image.prompt) {
            formData.append('alt_text', image.prompt);
            formData.append('title', image.prompt.substring(0, 50));
        }

        let mediaRes;
        try {
            mediaRes = await fetch(`${cmsUrl}/wp-json/wp/v2/media`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${auth}` },
                body: formData
            });
        } catch (e: any) {
            if (e.message === 'Failed to fetch') {
                console.error("WP Media upload failed due to CORS or network error.");
                return null;
            }
            throw e;
        }

        const mediaContentType = mediaRes.headers.get('content-type') || '';
        if (!mediaContentType.includes('application/json')) {
            const rawText = await mediaRes.text();
            console.error(`WP media endpoint returned non-JSON (status ${mediaRes.status}):`, rawText.slice(0, 500));
            return null;
        }

        if (mediaRes.ok) {
            const data = await mediaRes.json();
            return { id: data.id, url: data.source_url };
        } else {
            const err = await mediaRes.text();
            console.error("WP Media upload failed:", err);
        }
        return null;
    } catch (e) {
        console.error("WP Media upload exception:", e);
        return null;
    }
};

export const publishToWordPress = async (cms: CmsIntegration, post: ScheduledPost, business?: BusinessInfo) => {
    const auth = btoa(`${cms.username}:${cms.applicationPassword}`);
    let finalContent = (post as any).article_content || post.articleContent || '';
    
    if (!finalContent) throw new Error("Article content is empty. Generate content before publishing.");

    // 1. Process Featured Image and [IMAGE_1] placeholder
    let featuredMediaId = 0;
    let featuredImageUrl: string | undefined;
    if (post.images?.featureImage) {
        const wpImg = await uploadImageToWP(auth, cms.url, post.images.featureImage, 'featured-image.jpg');
        if (wpImg) {
            featuredMediaId = wpImg.id;
            featuredImageUrl = wpImg.url;
            // Build the real HTML tag for the content
            const imgTag = `<img src="${wpImg.url}" alt="${altAttr(post.images.featureImage.prompt, post.keyword)}" class="wp-post-image" style="width:100%; height:auto; border-radius:8px; margin-bottom:2rem;" />`;
            // Replace placeholder in body
            finalContent = finalContent.replace(/\[IMAGE_1\]/g, imgTag);
        }
    }

    // 2. Process Inline Images and [IMAGE_2+] placeholders
    if (post.images?.inlineImages) {
        for (let i = 0; i < post.images.inlineImages.length; i++) {
            const img = post.images.inlineImages[i];
            const placeholder = `[IMAGE_${i + 2}]`;
            const wpImg = await uploadImageToWP(auth, cms.url, img, `inline-image-${i + 1}.jpg`);
            if (wpImg) {
                const imgTag = `<img src="${wpImg.url}" alt="${altAttr(img.prompt, post.keyword)}" class="wp-inline-image" style="width:100%; height:auto; border-radius:8px; margin:2rem 0;" />`;
                // Global regex to replace all occurrences of this specific placeholder
                finalContent = finalContent.replace(new RegExp(`\\[IMAGE_${i + 2}\\]`, 'g'), imgTag);
            }
        }
    }

    // Final cleanup: If any stray placeholders exist (e.g. AI skipped them or they weren't generated), remove them so they don't show to users
    finalContent = finalContent.replace(/\[IMAGE_\d+\]/g, '');

    const metaTitle = post.meta_title ?? post.metaTitle ?? post.keyword;
    const metaDesc = post.meta_description ?? post.metaDescription ?? '';

    // Visible "Last updated" line + Article/FAQPage JSON-LD (WordPress keeps the script for users allowed unfiltered HTML)
    if (business) {
        finalContent = finalizeForPublish(finalContent, {
            headline: metaTitle, description: metaDesc, keyword: post.keyword, businessName: business.name,
            businessUrl: business.url, imageUrl: featuredImageUrl, language: business.language,
        });
    }
    finalContent = dropTitleH1(finalContent);

    const wpPost = {
        title: metaTitle,
        content: finalContent,
        status: 'publish',
        slug: post.slug,
        excerpt: metaDesc,
        featured_media: featuredMediaId > 0 ? featuredMediaId : undefined,
        meta: {
            _yoast_wpseo_metadesc: metaDesc,
            rank_math_description: metaDesc,
            _yoast_wpseo_title: metaTitle,
            rank_math_title: metaTitle
        }
    };

    // publishing again (an update, or a retry) updates the post it already became instead of creating slug-2
    const apiBase = `${cms.url.replace(/\/$/, '')}/wp-json/wp/v2`;
    const publishedUrl = (post as any).published_url || post.publishedUrl;
    const existingId = await findExistingWpPost(apiBase, `Basic ${auth}`, {
        wpPostId: (post as any).wp_post_id ?? post.wpPostId,
        slug: slugFromUrl(publishedUrl) || post.slug,
        lookUpSlug: !!publishedUrl,
    });

    let res;
    try {
        res = await fetch(existingId ? `${apiBase}/posts/${existingId}` : `${apiBase}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(wpPost)
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            throw new Error(`Failed to connect to WordPress at ${cms.url}. This is usually caused by CORS restrictions on your WordPress site. Please install a CORS plugin or configure your server to allow cross-origin requests from this app.`);
        }
        throw e;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const rawText = await res.text();
        console.error(`WP posts endpoint returned non-JSON (status ${res.status}):`, rawText.slice(0, 500));
        throw new Error(
            `WordPress returned an HTML page instead of JSON (status ${res.status}). ` +
            `This usually means a security plugin or firewall (Wordfence, Sucuri, etc.) is blocking the ` +
            `automated POST request, or the REST route is being redirected/cached. ` +
            `Check your site's firewall logs and REST API access rules for /wp-json/wp/v2/posts.`
        );
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`WordPress publishing failed: ${errText}`);
    }
    const data = await res.json();
    return { url: data.link, slug: data.slug, wpPostId: typeof data.id === 'number' ? data.id : existingId };
};

export const generateMetaData = async (content: string, keyword: string, business: BusinessInfo) => {
    const responseText = await callClaude({
        tier: 'fast',
        maxTokens: 1000,
        messages: [{ role: 'user', content: `Generate SEO metadata for an article about "${keyword}" for ${business.name}. Meta title around 60 characters, meta description around 150 characters, and a url-friendly slug.
        Content snippet: ${content.substring(0, 1000)}` }],
        schema: {
            type: 'object',
            properties: { metaTitle: { type: 'string' }, metaDescription: { type: 'string' }, slug: { type: 'string' } },
            required: ['metaTitle', 'metaDescription', 'slug'],
            additionalProperties: false
        }
    });
    try {
        return JSON.parse(cleanAIResponse(responseText || '{}'));
    } catch (e) {
        return {
            metaTitle: `${keyword} | ${business.name}`,
            metaDescription: `Read our comprehensive guide about ${keyword} for ${business.name} audiences.`,
            slug: keyword.toLowerCase().replace(/\s+/g, '-')
        };
    }
};

/** Returns the base64 of a new cover for the article (a different layout each call). Used by the "regenerate image" button. */
export const generateSingleImage = async (title: string, keyword: string, business: BusinessInfo): Promise<string> => {
    const cover = await callCover({ title, keyword, businessId: business.id, businessName: business.name, businessUrl: business.url, description: business.description, brandStyle: business.brandStyle, variant: 1 + Math.floor(Math.random() * 20) });
    return cover.base64;
};

export const generateImageAltText = async (base64: string, keyword: string) => {
    try {
        const text = await callClaude({
            tier: 'fast',
            maxTokens: 300,
            messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
                { type: 'text', text: `Write concise SEO alt text (under 125 characters) for this image, for an article about "${keyword}". Reply with the alt text only.` }
            ] }]
        });
        return text.trim();
    } catch (e) {
        console.error("Alt text generation failed, using fallback:", e);
        return `Image related to ${keyword}`;
    }
};

export const syncFeaturedImageToWordPress = async (cms: CmsIntegration, post: ScheduledPost) => {
    const auth = btoa(`${cms.username}:${cms.applicationPassword}`);
    
    // 1. Get the image blob
    const imagePart = post.images?.featureImage;
    if (!imagePart) return false;

    let blob: Blob;
    try {
        if (imagePart.url) {
            const response = await fetch(imagePart.url);
            blob = await response.blob();
        } else if (imagePart.base64) {
            const response = await fetch(`data:image/jpeg;base64,${imagePart.base64}`);
            blob = await response.blob();
        } else {
            return false;
        }
    } catch (e) {
        console.error("Failed to fetch image for sync:", e);
        return false;
    }

    // 2. Upload to Media
    const formData = new FormData();
    formData.append('file', blob, 'featured-image.jpg');
    formData.append('title', post.keyword);
    formData.append('alt_text', imagePart.prompt || post.keyword);

    let mediaRes;
    try {
        mediaRes = await fetch(`${cms.url}/wp-json/wp/v2/media`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}` },
            body: formData
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            console.error("WP Media upload failed due to CORS or network error.");
            return false;
        }
        throw e;
    }

    if (!mediaRes.ok) {
        const err = await mediaRes.text();
        console.error("WP Media upload failed:", err);
        return false;
    }
    const mediaData = await mediaRes.json();
    const mediaId = mediaData.id;

    // 3. Find post by slug to get ID
    let postSearchRes;
    try {
        postSearchRes = await fetch(`${cms.url}/wp-json/wp/v2/posts?slug=${post.slug}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            console.error("WP Post search failed due to CORS or network error.");
            return false;
        }
        throw e;
    }
    
    if (postSearchRes.ok) {
        const posts = await postSearchRes.json();
        if (posts.length > 0) {
            const wpPostId = posts[0].id;
            // 4. Update post with featured media
            let updateRes;
            try {
                updateRes = await fetch(`${cms.url}/wp-json/wp/v2/posts/${wpPostId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ featured_media: mediaId })
                });
            } catch (e: any) {
                if (e.message === 'Failed to fetch') {
                    console.error("WP Post update failed due to CORS or network error.");
                    return false;
                }
                throw e;
            }
            return updateRes.ok;
        }
    }

    return false; 
};

export const getChatbotResponse = async (messages: any[]) => {
    // UI uses Gemini-style {role:'model', parts:[{text}]}; Claude needs user/assistant, starting with a user turn.
    const mapped = messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.parts[0].text as string
    }));
    while (mapped.length && mapped[0].role !== 'user') mapped.shift();

    return callClaude({
        tier: 'fast',
        maxTokens: 1500,
        system: "You are RankBot, a helpful assistant for Autorank AI. Answer questions about SEO and how to use the app. Reply in simple HTML using only <p>, <ul>, <ol>, <li>, <strong> and <em> tags (no markdown, no scripts).",
        messages: mapped
    });
};
