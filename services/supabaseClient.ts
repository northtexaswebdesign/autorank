import { createClient } from '@supabase/supabase-js';

// Set in .env.local for dev and in the Vercel project settings for production.
// The anon key is designed to be public; access is enforced by Row Level Security.
export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. See .env.example.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
