// Core data models for the life-logging app

export interface ActivityType {
  id: string;
  name: string;
  icon?: string;
  valueType: 'text' | 'boolean' | 'checkmark' | 'counter' | 'mood';
  unit?: string; // e.g., "km", "minutes", "glasses"
  order?: number; // For custom ordering
  isDefault?: boolean; // True for built-in activity types that can't be deleted
  hidden?: boolean; // True if the activity type is hidden from the main UI
  createdAt: Date;
}

export interface LogEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  activityTypeId: string;
  value: string | number | boolean;
  note?: string;
  // Media metadata (for movies/TV series)
  imdbId?: string;
  poster?: string;
  imdbRating?: string;
  year?: string;
  userRating?: number; // 1-10 scale
  createdAt: Date;
  updatedAt: Date;
}

export interface Suggestion {
  activityTypeId: string;
  value: string;
  count: number; // How many times this value was used
  lastUsed: Date;
}

// For statistics
export interface StatisticsSummary {
  activityTypeId: string;
  activityTypeName: string;
  totalEntries: number;
  uniqueDays: number;
  mostCommonValue?: string | number;
  averageValue?: number; // For numeric types
  entries: LogEntry[];
}

export type TimeRange = 'week' | 'month' | 'year' | 'all';

// Default activity types to start with (using icon names from Icons.tsx)
export const DEFAULT_ACTIVITY_TYPES: Omit<ActivityType, 'id' | 'createdAt'>[] = [
  { name: 'Workout', icon: 'workout', valueType: 'checkmark', isDefault: true },
  { name: 'Alcohol', icon: 'alcohol', valueType: 'checkmark', isDefault: true },
  { name: 'Movie', icon: 'movie', valueType: 'text', isDefault: true },
  { name: 'TV Series', icon: 'tv', valueType: 'text', isDefault: true },
  { name: 'Protein', icon: 'protein', valueType: 'text', isDefault: true },
  { name: 'Period', icon: 'period', valueType: 'checkmark', isDefault: true },
  { name: 'Sleep', icon: 'sleep', valueType: 'mood', isDefault: true },
];
