// Supabase sync functions for DayTracker
import { supabase, DbActivityType, DbLogEntry, DbSuggestion } from './supabase';
import { ActivityType, LogEntry, Suggestion, DEFAULT_ACTIVITY_TYPES } from '@/types';

// Convert DB types to app types
function dbToActivityType(db: DbActivityType): ActivityType {
  return {
    id: db.id,
    name: db.name,
    icon: db.icon || undefined,
    valueType: db.value_type,
    unit: db.unit || undefined,
    order: db.sort_order || undefined,
    isDefault: db.is_default,
    hidden: db.hidden,
    createdAt: new Date(db.created_at),
  };
}

function dbToLogEntry(db: DbLogEntry): LogEntry {
  return {
    id: db.id,
    date: db.date,
    activityTypeId: db.activity_type_id,
    value: db.value,
    note: db.note || undefined,
    imdbId: db.imdb_id || undefined,
    poster: db.poster || undefined,
    imdbRating: db.imdb_rating || undefined,
    year: db.year || undefined,
    userRating: db.user_rating || undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function dbToSuggestion(db: DbSuggestion): Suggestion {
  return {
    activityTypeId: db.activity_type_id,
    value: db.value,
    count: db.count,
    lastUsed: new Date(db.last_used),
  };
}

// Activity Types
export async function getActivityTypesFromSupabase(userId: string): Promise<ActivityType[]> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data || []).map(dbToActivityType);
}

// Initialize default activity types for new users
export async function initializeDefaultActivityTypes(userId: string): Promise<ActivityType[]> {
  const createdTypes: ActivityType[] = [];
  
  for (let i = 0; i < DEFAULT_ACTIVITY_TYPES.length; i++) {
    const type = DEFAULT_ACTIVITY_TYPES[i];
    const newType = await addActivityTypeToSupabase(userId, {
      ...type,
      order: i,
    });
    createdTypes.push(newType);
  }
  
  return createdTypes;
}

export async function addActivityTypeToSupabase(
  userId: string,
  type: Omit<ActivityType, 'id' | 'createdAt'>
): Promise<ActivityType> {
  const { data, error } = await supabase
    .from('activity_types')
    .insert({
      user_id: userId,
      name: type.name,
      icon: type.icon || null,
      value_type: type.valueType,
      unit: type.unit || null,
      sort_order: type.order || null,
      is_default: type.isDefault || false,
      hidden: type.hidden || false,
    })
    .select()
    .single();

  if (error) throw error;
  return dbToActivityType(data);
}

export async function updateActivityTypeInSupabase(type: ActivityType): Promise<void> {
  const { error } = await supabase
    .from('activity_types')
    .update({
      name: type.name,
      icon: type.icon || null,
      value_type: type.valueType,
      unit: type.unit || null,
      sort_order: type.order || null,
      is_default: type.isDefault || false,
      hidden: type.hidden || false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', type.id);

  if (error) throw error;
}

export async function deleteActivityTypeFromSupabase(id: string): Promise<void> {
  const { error } = await supabase
    .from('activity_types')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderActivityTypesInSupabase(types: ActivityType[]): Promise<void> {
  const updates = types.map((type, index) => ({
    id: type.id,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('activity_types')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);
    
    if (error) throw error;
  }
}

// Log Entries
export async function getEntriesFromSupabase(
  userId: string,
  startDate: string,
  endDate: string
): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map(dbToLogEntry);
}

export async function addEntryToSupabase(
  userId: string,
  entry: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LogEntry> {
  const { data, error } = await supabase
    .from('log_entries')
    .insert({
      user_id: userId,
      activity_type_id: entry.activityTypeId,
      date: entry.date,
      value: entry.value,
      note: entry.note || null,
      imdb_id: entry.imdbId || null,
      poster: entry.poster || null,
      imdb_rating: entry.imdbRating || null,
      year: entry.year || null,
      user_rating: entry.userRating || null,
    })
    .select()
    .single();

  if (error) throw error;
  return dbToLogEntry(data);
}

export async function updateEntryInSupabase(entry: LogEntry): Promise<LogEntry> {
  const { data, error } = await supabase
    .from('log_entries')
    .update({
      activity_type_id: entry.activityTypeId,
      date: entry.date,
      value: entry.value,
      note: entry.note || null,
      imdb_id: entry.imdbId || null,
      poster: entry.poster || null,
      imdb_rating: entry.imdbRating || null,
      year: entry.year || null,
      user_rating: entry.userRating || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
    .select()
    .single();

  if (error) throw error;
  return dbToLogEntry(data);
}

export async function deleteEntryFromSupabase(id: string): Promise<void> {
  const { error } = await supabase
    .from('log_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Suggestions
export async function getSuggestionsFromSupabase(
  userId: string,
  activityTypeId: string
): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_type_id', activityTypeId)
    .order('count', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map(dbToSuggestion);
}

export async function addOrUpdateSuggestionInSupabase(
  userId: string,
  activityTypeId: string,
  value: string
): Promise<void> {
  // Try to update existing suggestion
  const { data: existing } = await supabase
    .from('suggestions')
    .select('id, count')
    .eq('user_id', userId)
    .eq('activity_type_id', activityTypeId)
    .eq('value', value)
    .single();

  if (existing) {
    await supabase
      .from('suggestions')
      .update({
        count: existing.count + 1,
        last_used: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('suggestions')
      .insert({
        user_id: userId,
        activity_type_id: activityTypeId,
        value,
        count: 1,
      });
  }
}

// Sync local data to Supabase (for migration)
export async function syncLocalToSupabase(
  userId: string,
  activityTypes: ActivityType[],
  entries: LogEntry[]
): Promise<{ activityTypeIdMap: Map<string, string> }> {
  const activityTypeIdMap = new Map<string, string>();

  // First, get existing activity types from cloud
  const existingTypes = await getActivityTypesFromSupabase(userId);
  const existingByName = new Map(existingTypes.map(t => [t.name.toLowerCase(), t]));

  // Add or map activity types
  for (const type of activityTypes) {
    const existing = existingByName.get(type.name.toLowerCase());
    if (existing) {
      // Already exists in cloud, just map the ID
      activityTypeIdMap.set(type.id, existing.id);
    } else {
      // Doesn't exist, create new
      const newType = await addActivityTypeToSupabase(userId, type);
      activityTypeIdMap.set(type.id, newType.id);
    }
  }

  // Get existing entries to avoid duplicates
  const existingEntries = await getEntriesFromSupabase(userId, "1900-01-01", "2100-12-31");
  const existingEntryKeys = new Set(
    existingEntries.map(e => `${e.date}-${e.activityTypeId}-${JSON.stringify(e.value)}`)
  );

  // Then add entries that don't already exist
  for (const entry of entries) {
    const newActivityTypeId = activityTypeIdMap.get(entry.activityTypeId);
    if (newActivityTypeId) {
      const entryKey = `${entry.date}-${newActivityTypeId}-${JSON.stringify(entry.value)}`;
      if (!existingEntryKeys.has(entryKey)) {
        await addEntryToSupabase(userId, {
          ...entry,
          activityTypeId: newActivityTypeId,
        });
      }
    }
  }

  return { activityTypeIdMap };
}
