
import { supabase } from '../services/supabaseClient.ts';

const BUCKET_NAME = 'articles';

/**
 * Uploads a Base64 image string to Supabase Storage and returns the public URL.
 * It automatically handles Base64 decoding and unique filename generation.
 */
export const uploadImageFromBase64 = async (base64: string, folder: string = 'general'): Promise<string | null> => {
    try {
        // 1. Generate a unique path: YYYY/MM/uuid.jpg
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const fileName = `${year}/${month}/${crypto.randomUUID()}.jpg`;
        const fullPath = folder === 'general' ? fileName : `${folder}/${fileName}`;

        // 2. Convert Base64 to Blob
        // Strip metadata prefix if present (e.g. "data:image/jpeg;base64,")
        const base64Clean = base64.replace(/^data:image\/\w+;base64,/, "");
        const byteCharacters = atob(base64Clean);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        // 3. Upload to Supabase
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fullPath, blob, {
                contentType: 'image/jpeg',
                cacheControl: '31536000', // Cache for 1 year (immutable)
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Storage Upload Error:', uploadError);
            // If upload fails, return null so the app can fallback to base64 or retry
            return null;
        }

        // 4. Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fullPath);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('Error in uploadImageFromBase64:', e);
        return null;
    }
};
