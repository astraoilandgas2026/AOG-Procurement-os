// ============================================================
// SUPABASE CLIENT STUB
// ============================================================
// This file creates the Supabase client instance for future
// use when the persistent backend is connected.
//
// The client is NOT used by the UI directly. Instead, a
// Supabase-backed DataStore implementation will be created
// in src/data/supabase-store.ts that implements the same
// DataStore interface defined in store.ts.
//
// The UI always talks to getStore() — it never imports
// this file or the Supabase client directly.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
