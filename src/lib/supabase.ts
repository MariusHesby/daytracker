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
  global: {
    headers: {
      'x-client-info': 'daytracker-pwa',
    },
  },
});

// Handle auth errors globally - clear invalid sessions
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      // Clear any stale auth data
      localStorage.removeItem('daytracker-auth');
    }
  });
}

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

export interface DbShareRequest {
  id: string;
  from_user_id: string;
  from_email: string;
  to_email: string;
  to_user_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface DbShare {
  id: string;
  owner_id: string;
  viewer_id: string;
  activity_type_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbLockedDay {
  id: string;
  user_id: string;
  date: string;
  created_at: string;
}

// Locked days functions
export async function getLockedDays(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('locked_days')
      .select('date')
      .eq('user_id', userId);
    
    if (error) {
      // Table might not exist yet - this is ok, just return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('locked_days table does not exist yet');
        return [];
      }
      console.error('Error fetching locked days:', error.message);
      return [];
    }
    
    return (data || []).map(d => d.date);
  } catch (e) {
    console.warn('getLockedDays failed:', e);
    return [];
  }
}

export async function lockDay(userId: string, date: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('locked_days')
      .insert({ user_id: userId, date });
    
    if (error) {
      console.error('Error locking day:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('lockDay failed:', e);
    return false;
  }
}

export async function unlockDay(userId: string, date: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('locked_days')
      .delete()
      .eq('user_id', userId)
      .eq('date', date);
    
    if (error) {
      console.error('Error unlocking day:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('unlockDay failed:', e);
    return false;
  }
}
