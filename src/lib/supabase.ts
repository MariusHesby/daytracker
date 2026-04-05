import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Clear invalid auth data before creating client
if (typeof window !== 'undefined') {
  try {
    const authData = localStorage.getItem('daytracker-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      // Only clear if the data is completely invalid (missing tokens)
      // Don't clear based on expiry - let Supabase handle refresh
      const isInvalid = !parsed || 
        !parsed.refresh_token || 
        !parsed.access_token;
      
      if (isInvalid) {
        console.warn('Clearing invalid auth session (missing tokens)');
        localStorage.removeItem('daytracker-auth');
        // Also clear any other Supabase storage keys
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      }
    }
  } catch {
    // If we can't parse, remove the invalid data
    localStorage.removeItem('daytracker-auth');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
  }
}

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

// Handle auth errors globally - only clear on explicit sign out
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // Only clear auth data on explicit sign out
      localStorage.removeItem('daytracker-auth');
    }
    // Don't clear on TOKEN_REFRESHED - let Supabase retry
  });
}

// Type definitions for Supabase tables
export interface DbActivityType {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  value_type: 'text' | 'boolean' | 'checkmark' | 'counter' | 'mood' | 'nutrition' | 'workout' | 'checklist' | 'timer';
  unit: string | null;
  sort_order: number | null;
  is_default: boolean;
  hidden: boolean;
  nutrition_goal: Record<string, number> | null;
  custom_exercises: Record<string, unknown>[] | null;
  workout_routines: Record<string, unknown>[] | null;
  timer_config: Record<string, unknown> | null;
  checklist_repeat: string | null;
  checklist_template: Record<string, unknown>[] | null;
  standalone: boolean;
  show_daily_goals: boolean;
  show_protein_map: boolean;
  food_icons: Record<string, string> | null;
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
  is_watchlist: boolean | null;
  nutrition_data: Record<string, unknown> | null;
  workout_data: Record<string, unknown> | null;
  checklist_data: Record<string, unknown> | null;
  timer_data: Record<string, unknown> | null;
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
