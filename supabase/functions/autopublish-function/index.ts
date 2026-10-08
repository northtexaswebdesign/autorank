// Scheduled auto-publisher (invoked by pg_cron every 2 hours).
// Generates any missing article text with Claude, then publishes due posts to WordPress.
//
// Required secrets:  ANTHROPIC_API_KEY, CRON_SECRET
// Deploy with verify_jwt = false and call it with header:  x-cron-secret: <CRON_SECRET>
// Optional JSON body {"business_id": "...", "post_id": "..."} runs just that business/post (manual testing).
//
// Images: Claude cannot generate images, so each article gets one Pexels stock photo (resized to
// under 200 KB). Optional secret: PEXELS_API_KEY (without it, posts publish without an image).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const Deno = (globalThis as any).Deno;

const MODEL_ARTICLE = Deno.env.get('CLAUDE_MODEL_SMART') || 'claude-sonnet-5-5';
const MODEL_LIGHT = Deno.env.get('CLAUDE_MODEL_FAST') || 'claude-haiku-5-5';
const MAX_POSTS_PER_RUN = 10; // keeps a single run inside the function time limit and bounds spend

// --- camelCase <-> snake_case ---
const toCamel = (s: string): string => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
const toSnake = (s: string): string => {
    if (s === 'aiFeedback') return s;
    if (s.startsWith('_')) return s;
    return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};
const processKeys = <T>(obj: any, fn: (s: string) => string): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => processKeys(v, fn)) as any;
    return Object.keys(obj).reduce((acc, key) => {
        (acc as any)[fn(key)] = processKeys(obj[key], fn);
        return acc;
    }, {} as T);
};
const snakeToCamel = <T>(obj: any): T => processKeys<T>(obj, toCamel);
const camelToSnake = <T>(obj: any): T => processKeys<T>(obj, toSnake);

interface BusinessInfo { id: string; url: string; name: string; description: string; audience: string; language?: string; }
interface ScheduledPost {
    id: string; businessId: string; keyword: string; publishDate: string; status: string; articleContent?: string;
    publishedUrl?: string; geoScore?: number; aiFeedback?: string[]; metaTitle?: string; metaDescription?: string; slug?: string;
}
interface CmsIntegration { id: string; businessId: string; platform: 'wordpress'; url: string; username: string; applicationPassword?: string; }
interface UserProfile { id: string; planStatus: 'trial' | 'paid' | 'expired'; creditsRemaining?: number; }

// --- Claude helpers ---
let client: Anthropic;
const getClient = () => (client ??= new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') }));

const textOf = (m: Anthropic.Message) => m.content.filter(b => b.type === 'text').map((b: any) => b.text).join('');

const askJson = async (model: string, prompt: string, schema: Record<string, unknown>, maxTokens = 1500) => {
    const m = await getClient().messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    } as any);
    return JSON.parse(textOf(m));
};

const generateArticleText = async (keyword: string, business: BusinessInfo): Promise<string> => {
    const languageInstruction = business.language && business.language !== 'English'
        ? `\n**CRITICAL LANGUAGE REQUIREMENT:** The entire article MUST be written in ${business.language}.\n` : '';
    const year = new Date().getUTCFullYear();

    const prompt = `You are an expert-level SEO content writer specializing in GEO (Generative-Engine-Optimization) content.
${languageInstruction}
**Topic:** "${keyword}"
**Primary Goal: E-E-A-T & User Intent**
- **Current Year Reference:** Use "${year}". Do not use past years.
- **E-E-A-T:** Demonstrate Experience, Expertise, Authoritativeness, and Trustworthiness. Be factual and objective. Do not invent statistics or sources.
- **Answer Intent:** Solve the user's problem completely.
**Article Length Requirement:** 1500-2300 words.
**Content Structure:**
- **Direct Answer First:** Immediately after the H1, include a <div class="key-takeaways"><h3>Key Takeaways</h3><ul>...</ul></div>.
- **Question-Based Headings:** Use <h2> headings phrased as questions.
- **Structured Data:** Use lists and tables where helpful.
- **Logical Flow:** Clean H1 -> H2 -> H3 structure, exactly one <h1>.
**SEO & Linking Requirements:**
- Integrate "${keyword}" 5-10 times naturally.
- Embed exactly one internal link to: ${business.url}.
- Include 2-3 external links to high-authority, non-competing websites.
**Formatting and Style:**
- Output clean HTML only (<h1>, <h2>, <h3>, <p>, <a>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>). No <html>, <head>, <body>, no markdown, no code fences, no images or image placeholders.
- Do not invent an author name or byline. Short paragraphs, no fluff.
**Business Integration:** Mention ${business.name} 2-3 times where it adds value. Informational tone.
Output only the HTML of the article.`;

    const stream = getClient().messages.stream({
        model: MODEL_ARTICLE,
        max_tokens: 12000,
        messages: [{ role: 'user', content: prompt }],
        output_config: { effort: 'medium' },
    } as any);
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('Article generation was declined by the model.');

    let html = textOf(message).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (html.length < 200) throw new Error(`Article generation returned an empty or too-short response (stop_reason: ${message.stop_reason}).`);
    return html;
};

const analyzeArticleForGEO = async (articleContent: string, keyword: string) =>
    await askJson(MODEL_LIGHT,
        `Analyze the article for GEO & E-E-A-T principles for keyword "${keyword}". Give a GEO score (1-100) and 2-3 actionable feedback points.\n\nArticle: ${articleContent.substring(0, 8000)}`,
        {
            type: 'object',
            properties: { geoScore: { type: 'integer' }, aiFeedback: { type: 'array', items: { type: 'string' } } },
            required: ['geoScore', 'aiFeedback'], additionalProperties: false,
        });

const generateMetaData = async (articleContent: string, keyword: string, business: BusinessInfo) => {
    const lang = business.language && business.language !== 'English' ? `The meta title and description MUST be in ${business.language}.` : '';
    return await askJson(MODEL_LIGHT,
        `Generate an SEO meta title (under 60 chars) and meta description (under 160 chars) for keyword "${keyword}". ${lang}\n\nArticle: ${articleContent.substring(0, 4000)}`,
        {
            type: 'object',
            properties: { metaTitle: { type: 'string' }, metaDescription: { type: 'string' } },
            required: ['metaTitle', 'metaDescription'], additionalProperties: false,
        });
};

// --- WordPress ---
const safeParseJson = async (response: Response, label: string): Promise<any> => {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    if (!contentType.includes('application/json')) {
        const snippet = rawText.slice(0, 300).replace(/\s+/g, ' ').trim();
        throw new Error(`${label} returned non-JSON response (HTTP ${response.status}). Body starts with: "${snippet}". A security plugin/firewall or caching page is likely intercepting the REST API.`);
    }
    try { return JSON.parse(rawText); }
    catch { throw new Error(`${label} claimed JSON but failed to parse: "${rawText.slice(0, 300)}"`); }
};

// --- Stock photo (Pexels), always under 200 KB ---
const PHOTO_MAX_BYTES = 200_000;
const PHOTO_WIDTHS = [1200, 1000, 800, 640];

const getStockPhoto = async (keyword: string, businessName: string): Promise<{ bytes: Uint8Array; alt: string } | null> => {
    const pexelsKey = Deno.env.get('PEXELS_API_KEY');
    if (!pexelsKey) return null;

    const q = await askJson(MODEL_LIGHT,
        `We need a stock photo for a blog article about "${keyword}" published by ${businessName}. Give: "query": a 2-4 word search query for a stock photo site that finds a realistic, relevant photo (concrete things you could photograph, no abstract words); "alt": SEO alt text under 125 characters describing a fitting photo.`,
        { type: 'object', properties: { query: { type: 'string' }, alt: { type: 'string' } }, required: ['query', 'alt'], additionalProperties: false }, 300);

    const search = async (term: string) => {
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&orientation=landscape&size=large&per_page=15`, { headers: { Authorization: pexelsKey } });
        if (!res.ok) throw new Error(`Pexels search failed (${res.status}).`);
        const data = await res.json();
        return (data.photos || []).filter((p: any) => p.width >= 1200 && typeof p.src?.original === 'string');
    };
    let photos = await search(q.query);
    if (photos.length === 0) photos = await search(businessName || 'business office');
    if (photos.length === 0) return null;

    const original = new URL(photos[0].src.original);
    if (original.hostname !== 'images.pexels.com') return null;
    for (const w of PHOTO_WIDTHS) {
        const res = await fetch(`${original.origin}${original.pathname}?auto=compress&cs=tinysrgb&w=${w}&h=${Math.round((w * 9) / 16)}&fit=crop`);
        if (!res.ok) continue;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length <= PHOTO_MAX_BYTES) return { bytes, alt: q.alt };
    }
    return null;
};

// Use the photo the app already attached to the post (stored in Supabase storage), else pick a stock photo.
const getPhotoForPost = async (post: ScheduledPost, businessName: string): Promise<{ bytes: Uint8Array; alt: string } | null> => {
    const existing = (post as any).images?.featureImage;
    if (existing?.url) {
        const res = await fetch(existing.url);
        if (res.ok) return { bytes: new Uint8Array(await res.arrayBuffer()), alt: existing.prompt || post.keyword };
    }
    return await getStockPhoto(post.keyword, businessName);
};

const uploadMedia = async (baseApiUrl: string, credentials: string, bytes: Uint8Array, filename: string, alt: string): Promise<{ id: number; url: string }> => {
    const res = await fetch(`${baseApiUrl}/media`, {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${filename}"` },
        body: bytes,
    });
    const data = await safeParseJson(res, 'WordPress Media API');
    if (!res.ok) throw new Error(`WordPress Media API Error: ${data?.message || `HTTP ${res.status}`}`);
    // set alt text / title (best effort)
    await fetch(`${baseApiUrl}/media/${data.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
        body: JSON.stringify({ alt_text: alt, title: alt }),
    }).catch(() => {});
    return { id: data.id, url: data.source_url };
};

const publishToWordPress = async (cms: CmsIntegration, post: ScheduledPost, businessName: string): Promise<{ link: string; featureImage?: { url: string; prompt: string } }> => {
    if (!cms.url || !cms.username || !cms.applicationPassword) throw new Error('WordPress integration details are incomplete.');
    if (!post.articleContent) throw new Error('Article content is empty at the final stage before publishing.');

    const credentials = btoa(`${cms.username}:${cms.applicationPassword}`);
    const baseApiUrl = `${cms.url.replace(/\/$/, '')}/wp-json/wp/v2`;
    const slug = post.slug || post.keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Photo step must never block publishing: on any failure the post goes out without an image.
    let featuredMediaId: number | undefined;
    let featureImage: { url: string; prompt: string } | undefined;
    let content = post.articleContent;
    try {
        const photo = await getPhotoForPost(post, businessName);
        if (photo) {
            const media = await uploadMedia(baseApiUrl, credentials, photo.bytes, `${slug}-feature.jpg`, photo.alt);
            featuredMediaId = media.id;
            featureImage = { url: media.url, prompt: photo.alt };
            const imgTag = `<p><img src="${media.url}" alt="${photo.alt.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;border-radius:8px" /></p>`;
            if (/\[IMAGE_1\]/.test(content)) content = content.replace(/<p>\s*\[IMAGE_1\]\s*<\/p>|\[IMAGE_1\]/, imgTag);
            else if (/<\/h1>/i.test(content)) content = content.replace(/<\/h1>/i, (m) => m + imgTag);
            else content = imgTag + content;
        }
    } catch (photoError: any) {
        console.error('Photo step failed, publishing without image:', photoError.message);
    }
    content = content.replace(/<p>\s*\[IMAGE_\d+\]\s*<\/p>/g, '').replace(/\[IMAGE_\d+\]/g, '');

    const response = await fetch(`${baseApiUrl}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
        body: JSON.stringify({
            title: post.metaTitle || post.keyword,
            content,
            status: 'publish',
            slug,
            excerpt: post.metaDescription || '',
            ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
        }),
    });
    const data = await safeParseJson(response, 'WordPress Posts API');
    if (!response.ok) throw new Error(`WordPress API Error: ${data?.message || JSON.stringify(data)}`);
    if (!data.link) throw new Error('Post created, but no URL was returned.');
    return { link: data.link, featureImage };
};

// --- Main ---
Deno.serve(async (req: Request) => {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    let target: { business_id?: string; post_id?: string } = {};
    try { target = (await req.json()) ?? {}; } catch { /* cron sends an empty body */ }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const log = async (business_id: string | null, status: 'success' | 'error', message: string) => {
        await supabaseAdmin.from('activity_logs').insert({ business_id, status, message, job_name: 'publish-articles' });
    };

    try {
        await log(null, 'success', 'Cron job invoked: Starting article publisher.');
        const utcNowISO = new Date().toISOString();
        let processed = 0;

        const bizQuery = supabaseAdmin.from('businesses').select('*');
        const { data: businesses, error: bizError } = await (target.business_id ? bizQuery.eq('id', target.business_id) : bizQuery.eq('auto_schedule', true));
        if (bizError) throw bizError;

        for (const businessRaw of businesses ?? []) {
            if (processed >= MAX_POSTS_PER_RUN) break;
            const business = snakeToCamel<BusinessInfo>(businessRaw);

            const profileResult = await supabaseAdmin.from('profiles').select('id, plan_status, credits_remaining').eq('id', businessRaw.user_id).single();
            if (profileResult.error || !profileResult.data) {
                await log(business.id, 'error', 'Could not fetch user profile for business. Skipping publishing.');
                continue;
            }
            const profile = snakeToCamel<UserProfile>(profileResult.data);

            let postsQuery = supabaseAdmin.from('posts').select('*')
                .eq('business_id', business.id).in('status', ['scheduled', 'draft']).lte('publish_date', utcNowISO);
            if (target.post_id) postsQuery = postsQuery.eq('id', target.post_id);
            const postsResult = await postsQuery;
            if (postsResult.error) { await log(business.id, 'error', `Failed to fetch posts: ${postsResult.error.message}`); continue; }
            const postsRaw = postsResult.data || [];
            if (postsRaw.length === 0) continue;

            const cmsResult = await supabaseAdmin.from('cms_integrations').select('*').eq('business_id', business.id).single();
            if (cmsResult.error || !cmsResult.data) { await log(business.id, 'error', `No CMS integration found. Skipping ${postsRaw.length} posts.`); continue; }
            const cms = snakeToCamel<CmsIntegration>(cmsResult.data);

            for (const postRaw of postsRaw) {
                if (processed >= MAX_POSTS_PER_RUN) break;
                let post = snakeToCamel<ScheduledPost>(postRaw);
                try {
                    if (profile.planStatus === 'expired') {
                        await log(business.id, 'error', `Subscription expired. Skipping "${post.keyword}".`);
                        continue;
                    }
                    if (profile.planStatus === 'paid' && (profile.creditsRemaining ?? 0) <= 0) {
                        await log(business.id, 'error', `No credits remaining for "${post.keyword}". Skipping publish.`);
                        continue;
                    }
                    processed++;

                    // Article body may be inline or in storage (content_url); only generate when truly missing.
                    let content: string | undefined = post.articleContent || postRaw.article_content;
                    if ((!content || !content.trim()) && postRaw.content_url) {
                        const res = await fetch(postRaw.content_url);
                        if (res.ok) content = await res.text();
                    }

                    if (!content || !content.trim()) {
                        await log(business.id, 'success', `Content not found for "${post.keyword}". Generating new article...`);
                        const articleContent = await generateArticleText(post.keyword, business);
                        const [analysis, meta] = await Promise.all([
                            analyzeArticleForGEO(articleContent, post.keyword),
                            generateMetaData(articleContent, post.keyword, business),
                        ]);
                        const updates = {
                            articleContent, status: 'draft',
                            geoScore: analysis.geoScore, aiFeedback: analysis.aiFeedback,
                            metaTitle: meta.metaTitle, metaDescription: meta.metaDescription,
                        };
                        const { error: updateError } = await supabaseAdmin.from('posts').update(camelToSnake(updates)).eq('id', post.id);
                        if (updateError) throw new Error(`Failed to save generated content: ${updateError.message}`);
                        post = { ...post, ...updates };
                    } else {
                        await log(business.id, 'success', `Content found for draft "${post.keyword}". Preparing to publish.`);
                        post.articleContent = content;
                    }

                    const { link: publishedUrl, featureImage } = await publishToWordPress(cms, post, business.name);
                    const { error: pubErr } = await supabaseAdmin.from('posts').update({ status: 'published', published_url: publishedUrl, ...(featureImage ? { images: { featureImage } } : {}) }).eq('id', post.id);
                    if (pubErr) throw new Error(`Failed to update post status after publishing: ${pubErr.message}`);
                    await log(business.id, 'success', `Successfully published article: "${post.keyword}"`);

                    if (profile.planStatus === 'paid') {
                        const newCredits = (profile.creditsRemaining ?? 1) - 1;
                        const { error: creditError } = await supabaseAdmin.from('profiles').update({ credits_remaining: newCredits }).eq('id', businessRaw.user_id);
                        if (creditError) await log(business.id, 'error', `Failed to deduct credit for "${post.keyword}": ${creditError.message}`);
                        else profile.creditsRemaining = newCredits;
                    }
                } catch (postError: any) {
                    await log(business.id, 'error', `Failed to publish "${postRaw.keyword}": ${postError.message}`);
                    await supabaseAdmin.from('posts').update({ status: 'scheduled' }).eq('id', postRaw.id);
                }
            }
        }

        return new Response(JSON.stringify({ message: 'Publish job completed.', processed }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    } catch (e: any) {
        console.error('Critical error in autopublish-function:', e);
        await log(null, 'error', `A critical error occurred: ${e.message}`);
        return new Response(JSON.stringify({ error: e.message }), { headers: { 'Content-Type': 'application/json' }, status: 500 });
    }
});
