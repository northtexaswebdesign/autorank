import { createClient } from '@supabase/supabase-js';

// As requested, using the Supabase URL and anon key you provided.
// For security, these should be stored in environment variables.
export const supabaseUrl = 'https://thyfuwjcntzmlkudoqhw.supabase.co'; // Export for better error reporting
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoeWZ1d2pjbnR6bWxrdWRvcWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTUxMjQsImV4cCI6MjA3Njc5MTEyNH0.3P3YcWYwvh8Ad3HOip7I-TdN1Z0kK5eYhN7-7wurmZM'; // Replace with your Supabase anon key

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and anon key are required. Please update them in services/supabaseClient.ts");
}

// Using standard configuration to ensure AuthClient initializes correctly.
// Removed the proxy configuration for auth as it's not a standard Supabase JS client feature in v2
// and was causing initialization errors.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);