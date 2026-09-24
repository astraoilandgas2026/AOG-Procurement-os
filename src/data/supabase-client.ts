import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dhswxxathvzzlybxukat.supabase.co';
// Public publishable key: safe for browser use; RLS/Auth remain the security boundary.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gXvGtf3cyN4fhEViQ9QEKA_UuJxkZAU';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}
