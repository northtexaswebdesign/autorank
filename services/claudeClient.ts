import { supabase } from './supabaseClient.ts';

export type ClaudeTier = 'fast' | 'smart';

export interface ClaudeRequest {
    tier: ClaudeTier;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: any }[];
    maxTokens?: number;
    webSearch?: boolean;
    schema?: Record<string, unknown>;
}

/** Calls the /api/claude serverless function (which holds the Anthropic key). Returns the model's text. */
export const callClaude = async (req: ClaudeRequest): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in to use AI features.');

    const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(req),
    });

    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `AI request failed (${res.status}).`);
    return data.text as string;
};
