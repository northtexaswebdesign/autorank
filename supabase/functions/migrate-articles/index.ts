import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find all posts that have a base64 feature image
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, images')
    .not('images', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of posts ?? []) {
    const featureImage = post.images?.featureImage ?? post.images?.feature_image;

    // Skip if no base64 or already has a URL
    if (!featureImage?.base64 || featureImage?.url) {
      skipped++;
      continue;
    }

    try {
      // Upload base64 to Supabase Storage
      const base64Clean = featureImage.base64.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Clean);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const filePath = `auto-generated/${year}/${month}/${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('articles')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('articles')
        .getPublicUrl(filePath);

      // Update the post — replace base64 with URL, keep prompt
      await supabase
        .from('posts')
        .update({
          images: {
            featureImage: {
              url: urlData.publicUrl,
              prompt: featureImage.prompt ?? '',
            },
          },
        })
        .eq('id', post.id);

      fixed++;
    } catch (e) {
      console.error(`Failed to migrate post ${post.id}:`, e);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, fixed, skipped, failed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});