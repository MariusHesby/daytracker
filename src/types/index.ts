// Core data models for the life-logging app

// Nutrition goal configuration
export interface NutritionGoal {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

// Nutrition data for a food entry
export interface NutritionData {
  foodName: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

// Workout types for exercise logging
export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'other';

export interface WorkoutSetData {
  reps?: number;
  weight?: number;
  distance?: number;
  duration?: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  sets?: number;
  reps?: number;
  weight?: number; // in kg
  distance?: number; // in km
  duration?: number; // in minutes
  notes?: string;
  setsData?: WorkoutSetData[]; // Individual set data
}

export interface WorkoutData {
  exercises: WorkoutExercise[];
  totalDuration?: number; // total workout duration in minutes
  notes?: string;
}

// Common exercises with their typical tracking fields
export const COMMON_EXERCISES: { name: string; category: ExerciseCategory; trackWeight?: boolean; trackReps?: boolean; trackDistance?: boolean; trackDuration?: boolean }[] = [
  // Strength - Upper Body
  { name: 'Bench Press', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Overhead Press', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Bicep Curls', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Tricep Dips', category: 'strength', trackReps: true },
  { name: 'Pull-ups', category: 'strength', trackReps: true },
  { name: 'Push-ups', category: 'strength', trackReps: true },
  { name: 'Lat Pulldown', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Rows', category: 'strength', trackWeight: true, trackReps: true },
  // Strength - Lower Body
  { name: 'Squats', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Deadlift', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Leg Press', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Lunges', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Leg Curls', category: 'strength', trackWeight: true, trackReps: true },
  { name: 'Calf Raises', category: 'strength', trackWeight: true, trackReps: true },
  // Cardio
  { name: 'Running', category: 'cardio', trackDistance: true, trackDuration: true },
  { name: 'Walking', category: 'cardio', trackDistance: true, trackDuration: true },
  { name: 'Cycling', category: 'cardio', trackDistance: true, trackDuration: true },
  { name: 'Swimming', category: 'cardio', trackDistance: true, trackDuration: true },
  { name: 'Rowing', category: 'cardio', trackDistance: true, trackDuration: true },
  { name: 'Jump Rope', category: 'cardio', trackDuration: true },
  { name: 'Elliptical', category: 'cardio', trackDuration: true },
  { name: 'Stair Climber', category: 'cardio', trackDuration: true },
  // Flexibility
  { name: 'Yoga', category: 'flexibility', trackDuration: true },
  { name: 'Stretching', category: 'flexibility', trackDuration: true },
  { name: 'Pilates', category: 'flexibility', trackDuration: true },
];

// Custom exercise configuration (for user-defined exercises)
export interface CustomExercise {
  name: string;
  category: ExerciseCategory;
  trackWeight?: boolean;
  trackReps?: boolean;
  trackDistance?: boolean;
  trackDuration?: boolean;
}

// Workout routine/group for organizing exercises
export interface WorkoutRoutine {
  id: string;
  name: string; // e.g., "Push Day", "Leg Day", "Cardio"
  exerciseNames: string[]; // Names of exercises in this routine
  color?: string; // Color for the routine badge
}

// Preset colors for workout routines
export const ROUTINE_COLORS = [
  '#007AFF', // iOS Blue
  '#34C759', // iOS Green
  '#FF9500', // iOS Orange
  '#AF52DE', // iOS Purple
  '#FF2D55', // iOS Pink
  '#5AC8FA', // iOS Light Blue
  '#FFCC00', // iOS Yellow
  '#FF3B30', // iOS Red
];

export interface ActivityType {
  id: string;
  name: string;
  icon?: string;
  valueType: 'text' | 'boolean' | 'checkmark' | 'counter' | 'mood' | 'nutrition' | 'workout';
  unit?: string; // e.g., "km", "minutes", "glasses"
  order?: number; // For custom ordering
  isDefault?: boolean; // True for built-in activity types that can't be deleted
  hidden?: boolean; // True if the activity type is hidden from the main UI
  nutritionGoal?: NutritionGoal; // Goal for nutrition type
  customExercises?: CustomExercise[]; // Custom exercises for workout type
  workoutRoutines?: WorkoutRoutine[]; // Workout routines/groups for organizing exercises
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
  // Nutrition data
  nutritionData?: NutritionData;
  // Workout data
  workoutData?: WorkoutData;
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

// Version number for default activity types - increment this when defaults change
// This will reset local IndexedDB to new defaults for non-logged-in users
export const DEFAULT_ACTIVITY_TYPES_VERSION = 3;

// Default activity types to start with (using icon names from Icons.tsx)
export const DEFAULT_ACTIVITY_TYPES: Omit<ActivityType, 'id' | 'createdAt'>[] = [
  { name: 'Movie', icon: 'movie', valueType: 'text', isDefault: true },
  { name: 'TV Series', icon: 'tv', valueType: 'text', isDefault: true },
  { name: 'Lunch', icon: 'meal', valueType: 'nutrition', isDefault: true },
  { name: 'Dinner', icon: 'meal', valueType: 'nutrition', isDefault: true },
  { name: 'Alcohol', icon: 'alcohol', valueType: 'checkmark', isDefault: true },
  { name: 'Workout', icon: 'workout', valueType: 'workout', isDefault: true },
  { name: 'Event', icon: 'event', valueType: 'text', isDefault: true },
  { name: 'Period', icon: 'period', valueType: 'mood', isDefault: true },
  { name: 'Sleep', icon: 'sleep', valueType: 'mood', isDefault: true },
];
