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

// Common exercises - empty by default, users add their own
export const COMMON_EXERCISES: { name: string; category: ExerciseCategory; trackWeight?: boolean; trackReps?: boolean; trackDistance?: boolean; trackDuration?: boolean }[] = [];

// Custom exercise configuration (for user-defined exercises)
export interface CustomExercise {
  name: string;
  category: ExerciseCategory;
  trackWeight?: boolean;
  trackReps?: boolean;
  trackDistance?: boolean;
  trackDuration?: boolean;
  wgerId?: number; // wger.de API exercise ID
  imageUrl?: string; // Exercise image from API
  muscles?: string[]; // Target muscles
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

// Checklist item for bullet list type
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  addedDate?: string; // YYYY-MM-DD date when item was first added (for repeating checklists)
}

// Template item for repeating checklists (stored on ActivityType)
export interface ChecklistTemplateItem {
  text: string;
  addedDate: string; // YYYY-MM-DD date when item was first added
}

// Checklist data for bullet list entries
export interface ChecklistData {
  items: ChecklistItem[];
}

// Checklist repeat frequency
export type ChecklistRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

// Timer/screen time tracking
export type TimerLimitPeriod = 'daily' | 'weekly' | 'monthly';

export interface TimerSubject {
  id: string;
  name: string; // e.g., "Theodor", "Abel"
  limitMinutes?: number; // Per-subject time limit (overrides global)
}

export interface TimerConfig {
  subjects: TimerSubject[];
  limitMinutes: number; // Global/fallback max allowed time (deprecated in favor of per-subject)
  limitPeriod: TimerLimitPeriod; // Per day, week, or month
}

export interface TimerAdjustment {
  id: string;
  type: 'add' | 'subtract';
  minutes: number;
  comment?: string;
}

export interface TimerEntry {
  subjectId: string;
  minutes: number; // Total positive time (base + add adjustments)
  subtractMinutes?: number; // Total subtract time (sum of subtract adjustments)
  adjustments?: TimerAdjustment[]; // Individual add/subtract entries with comments
}

export interface TimerData {
  entries: TimerEntry[];
}

// Football coach types
export type FootballPosition =
  | 'GK'
  | 'RB' | 'CB' | 'LB'
  | 'CDM' | 'CM' | 'RM' | 'LM' | 'CAM'
  | 'RW' | 'LW'
  | 'CF' | 'ST'
  | 'Bench';

export const FOOTBALL_POSITIONS: { value: FootballPosition; label: string; group: string }[] = [
  { value: 'GK',  label: 'Goalkeeper (GK)',                group: 'Goalkeeper' },
  { value: 'RB',  label: 'Right Back (RB)',                group: 'Defence' },
  { value: 'CB',  label: 'Centre Back (CB)',               group: 'Defence' },
  { value: 'LB',  label: 'Left Back (LB)',                 group: 'Defence' },
  { value: 'CDM', label: 'Defensive Midfielder (CDM)',     group: 'Midfield' },
  { value: 'CM',  label: 'Central Midfielder (CM)',        group: 'Midfield' },
  { value: 'RM',  label: 'Right Midfielder (RM)',          group: 'Midfield' },
  { value: 'LM',  label: 'Left Midfielder (LM)',           group: 'Midfield' },
  { value: 'CAM', label: 'Attacking Midfielder (CAM)',     group: 'Midfield' },
  { value: 'RW',  label: 'Right Winger (RW)',              group: 'Attack' },
  { value: 'LW',  label: 'Left Winger (LW)',               group: 'Attack' },
  { value: 'CF',  label: 'Centre Forward (CF)',            group: 'Attack' },
  { value: 'ST',  label: 'Striker (ST)',                   group: 'Attack' },
  { value: 'Bench', label: 'Bench',                        group: 'Bench' },
];

export interface CoachPlayer {
  id: string;
  name: string;
  number: number;
  preferredPosition: FootballPosition;
}

export interface CoachConfig {
  players: CoachPlayer[];
  tradeTimerMinutes: number;    // suggested interval between subs (1-30)
  halfDurationMinutes: number;  // length of each half in minutes
  teamSize: number;             // players on pitch at once (5, 7, 9, 11, etc.)
  subConsiderTime?: boolean;    // prioritise players with least/most time played
  subConsiderPosition?: boolean; // prefer natural positional replacements
  subConsiderKeeper?: boolean;  // former GK prioritised for non-defensive positions
  subConsiderSubOrder?: boolean; // last sub-in player is last to come off
  vibrateOnWarning?: boolean;   // vibrate device when sub timer turns yellow
  isHomeTeam?: boolean;          // true = home (our score left), false = away (our score right)
}

export interface CoachLineupEntry {
  playerId: string;
  position: FootballPosition;
  onPitchSince: number | null;   // Date.now() when player last came on
  totalMinutesPlayed: number;    // accumulated minutes from previous stints
}

export interface CoachSubstitution {
  id: string;
  timestamp: number;             // Date.now()
  playerOffId: string;
  playerOnId: string;
  matchMinute: number;           // match minute when sub happened
}

export interface CoachData {
  matchStartTime: number | null;    // Date.now() when current half started
  halfStartTime: number | null;
  currentHalf: number;              // 1 or 2
  isRunning: boolean;
  lineup: CoachLineupEntry[];       // all players with their current state
  substitutions: CoachSubstitution[];
  lastTradeTime: number | null;     // Date.now() of last substitution
  goals?: { id: string; playerId: string; matchMinute: number }[];
  homeTeamName?: string;
  awayTeamName?: string;
}

export interface ActivityType {
  id: string;
  name: string;
  icon?: string;
  valueType: 'text' | 'boolean' | 'checkmark' | 'counter' | 'mood' | 'nutrition' | 'workout' | 'checklist' | 'timer' | 'coach';
  unit?: string; // e.g., "km", "minutes", "glasses"
  order?: number; // For custom ordering
  isDefault?: boolean; // True for built-in activity types that can't be deleted
  hidden?: boolean; // True if the activity type is hidden from the main UI
  nutritionGoal?: NutritionGoal; // Goal for nutrition type
  showDailyGoals?: boolean; // Show daily goal tracking for nutrition type
  showProteinMap?: boolean; // Show quick-select protein source map for nutrition type
  foodIcons?: Record<string, string>; // Map of food name -> icon name for nutrition quick-select
  mergedNutritionTypeIds?: string[]; // IDs of other nutrition types to merge progress with
  mergedNutritionGoal?: NutritionGoal; // Common goal for all merged nutrition activities
  customExercises?: CustomExercise[]; // Custom exercises for workout type
  workoutRoutines?: WorkoutRoutine[]; // Workout routines/groups for organizing exercises
  timerConfig?: TimerConfig; // Config for timer/screen time type
  checklistRepeat?: ChecklistRepeat; // Repeat frequency for checklist type
  checklistTemplate?: ChecklistTemplateItem[]; // Master template for repeating checklists
  standalone?: boolean; // If true, shown as separate card on front page (not grouped)
  coachConfig?: CoachConfig; // Config for coach/team management type
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
  isWatchlist?: boolean; // True if this is a watchlist item (want to watch)
  // Nutrition data
  nutritionData?: NutritionData;
  // Workout data
  workoutData?: WorkoutData;
  // Checklist data
  checklistData?: ChecklistData;
  // Timer/screen time data
  timerData?: TimerData;
  // Coach/match data
  coachData?: CoachData;
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
export const DEFAULT_ACTIVITY_TYPES_VERSION = 6;

// Default activity types to start with (using icon names from Icons.tsx)
// isDefault: true means it cannot be deleted
export const DEFAULT_ACTIVITY_TYPES: Omit<ActivityType, 'id' | 'createdAt'>[] = [
  { name: 'Movie', icon: 'movie', valueType: 'text', isDefault: true, order: 0 },
  { name: 'TV Series', icon: 'tv', valueType: 'text', isDefault: true, order: 1 },
  { name: 'Nutrition', icon: 'meal', valueType: 'nutrition', isDefault: false, order: 2 },
  { name: 'Sleep', icon: 'sleep', valueType: 'mood', isDefault: false, hidden: true, order: 3 },
  { name: 'Workout', icon: 'workout', valueType: 'workout', isDefault: true, order: 4 },
  { name: 'Todo', icon: 'checklist', valueType: 'checklist', isDefault: true, standalone: true, order: 5 },
];
