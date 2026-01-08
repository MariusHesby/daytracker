import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage to persist sessions - works across browser and PWA
    persistSession: true,
    storageKey: 'daytracker-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Auto refresh tokens
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Type definitions for Supabase tables
export interface DbActivityType {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  value_type: 'text' | 'boolean' | 'checkmark' | 'counter' | 'mood';
  unit: string | null;
  sort_order: number | null;
  is_default: boolean;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbLogEntry {
  id: string;
  user_id: string;
  activity_type_id: string;
  date: string;
  value: string | number | boolean;
  note: string | null;
  imdb_id: string | null;
  poster: string | null;
  imdb_rating: string | null;
  year: string | null;
  user_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbSuggestion {
  id: string;
  user_id: string;
  activity_type_id: string;
  value: string;
  count: number;
  last_used: string;
}
