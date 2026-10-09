import { supabase } from './supabaseClient.ts';

export type ClaudeTier = 'fast' | 'smart';

export interface ClaudeRequest {
    tier: ClaudeTier;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: any }[];
    maxTokens?: number;
    webSearch?: boolean;
    /** searches allowed in this one request when webSearch is on (server default 5, max 10) */
    maxSearches?: number;
    /** 'article' = a new article; uses one credit / free trial article */
    kind?: 'article';
    schema?: Record<string, unknown>;
}

const post = async (payload: unknown): Promise<any> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in to use AI features.');

    const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
    });

    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `AI request failed (${res.status}).`);
    return data;
};

/** Calls the /api/claude serverless function (which holds the Anthropic key). Returns the model's text. */
export const callClaude = async (req: ClaudeRequest): Promise<string> => (await post(req)).text as string;

/** Like callClaude, but also returns every URL the web search found (used to drop links the model made up). */
export const callClaudeDetailed = async (req: ClaudeRequest): Promise<{ text: string; sources: string[]; searchErrors: string[] }> => {
    const data = await post(req);
    return { text: data.text as string, sources: Array.isArray(data.sources) ? data.sources : [], searchErrors: Array.isArray(data.searchErrors) ? data.searchErrors : [] };
};

export interface LinkCheck { html: string; removed: { url: string; reason: string }[]; kept: string[]; }

/** Server-side check of the outside links in article HTML: removes links not found by search, blocked hosts and dead pages. */
export const verifyArticleLinks = async (html: string, ownUrl: string, searchUrls: string[]): Promise<LinkCheck> =>
    post({ action: 'verify-links', html, ownUrl, searchUrls });

export interface CoverImage { base64: string; alt: string; width: number; height: number; bytes: number; layout: string; brandStyle?: Record<string, unknown> | null; }

/** Designs a branded 1080x1080 cover (JPEG under 200 KB). `variant` > 0 gives a different layout. */
export const callCover = async (req: { title: string; keyword: string; businessId?: string; businessName: string; businessUrl?: string; description?: string; brandStyle?: unknown; variant?: number }): Promise<CoverImage> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in to use AI features.');
    const res = await fetch('/api/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(req),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `Cover image request failed (${res.status}).`);
    return data as CoverImage;
};

export interface StockPhoto { base64: string; alt: string; width: number; height: number; bytes: number; photographer?: string; photographerUrl?: string; pexelsUrl?: string; }

/** Fetches a relevant stock photo (JPEG, under 200 KB) via the server. `variant` > 0 returns a different photo. */
export const callStockPhoto = async (keyword: string, businessName: string, variant = 0): Promise<StockPhoto> =>
    post({ action: 'photo', keyword, businessName, variant });
