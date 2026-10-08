
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// --- Configuration ---
// The permanent domain for your production application.
const permanentDomain = 'https://autorank-ai-745674590769.us-west1.run.app';
// The suffix for the temporary development domains.
const devDomainSuffix = '.scf.usercontent.goog';

// --- Main Server Function ---
serve(async (req) => {
  // Determine if the request origin is allowed.
  const origin = req.headers.get('Origin') || '';
  const isAllowed = origin === permanentDomain || origin.endsWith(devDomainSuffix);

  // Dynamically set CORS headers based on the allowed origin.
  // 'Vary: Origin' is important for telling caches that the response depends on the Origin header.
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : permanentDomain,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };

  // This is a preflight request. A browser sends this before making a request
  // to a different origin to check if the server will allow it.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = (globalThis as any).Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is not set');

    // The frontend client calls '/functions/v1/auth-proxy/token', but the real
    // Supabase endpoint is '/auth/v1/token'. This line reconstructs the correct URL.
    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/auth-proxy', '/auth/v1');
    const proxyUrl = `${supabaseUrl}${path}${url.search}`; // Include query parameters

    // We only forward the necessary headers from the client to the Supabase auth service.
    const headers = new Headers();
    if (req.headers.has('apikey')) headers.set('apikey', req.headers.get('apikey')!);
    if (req.headers.has('Authorization')) headers.set('Authorization', req.headers.get('Authorization')!);
    if (req.headers.has('Content-Type')) headers.set('Content-Type', req.headers.get('Content-Type')!);
    if (req.headers.has('x-client-info')) headers.set('x-client-info', req.headers.get('x-client-info')!);
    
    // Forward the request to the real Supabase auth endpoint.
    const response = await fetch(proxyUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    });
    
    // We need to return a new response that includes the CORS headers.
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
