import { supabase } from '../services/supabaseClient.ts';

const BUCKET_NAME = 'articles';

/**
 * Uploads HTML/text content to Supabase Storage and returns the public URL.
 */
export const uploadArticleContent = async (html: string, postId: string): Promise<string | null> => {
    try {
        const fileName = `content/${postId}-${Date.now()}.html`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, blob, {
                contentType: 'text/html;charset=utf-8',
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('Content Upload Error:', uploadError);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('Error in uploadArticleContent:', e);
        return null;
    }
};

/**
 * Fetches the HTML/text content from a given URL.
 */
export const fetchArticleContent = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch content');
        return await response.text();
    } catch (e) {
        console.error('Error fetching article content:', e);
        return null;
    }
};
